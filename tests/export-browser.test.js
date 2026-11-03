import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, preview } from './browser-support.js';

const server = preview(4262);
test.after(() => server.close());

for (const browserName of ['chromium', 'firefox']) {
  test(`${browserName} exports real WAV and local OGG, preserving duration and stereo audio`, { timeout: 120000 }, async t => {
    await server.ready();
    const browser = await launchBrowser(browserName);
    t.after(() => browser.close());
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const external = [];
    page.on('request', request => { if (!request.url().startsWith(server.url)) external.push(request.url()); });
    await page.goto(server.url);
    const result = await page.evaluate(async () => {
      const { createEmptyProject, activeClip, makeNote } = await import('/core.js');
      const { renderWav } = await import('/audio.js');
      const p = createEmptyProject();
      p.tempo = 120; p.masterSettings.bypass = true;
      const clip = activeClip(p, 'lead');
      clip.notes = [makeNote(0, 57, 8), makeNote(8, 64, 4)];
      clip.character.fx.bypass = true;
      const progress = [];
      const options = { sampleRate: 48000, tailSeconds: 0, song: false, normalize: true, onProgress: f => progress.push(f) };
      const wav = await renderWav(p, options);
      const ogg = await renderWav(p, { ...options, format: 'ogg', oggQuality: 4 });
      const decoder = new globalThis.AudioContext();
      const decoded = await decoder.decodeAudioData(await ogg.arrayBuffer());
      const pcm = decoded.getChannelData(0);
      let peak = 0, energy = 0;
      for (const value of pcm) { peak = Math.max(peak, Math.abs(value)); energy += value * value; }
      await decoder.close();
      return { wavDuration: (wav.size - 44) / 4 / 48000, wavSize: wav.size, oggSize: ogg.size, mime: ogg.type,
        magic: [...new Uint8Array(await ogg.slice(0, 4).arrayBuffer())], duration: decoded.duration,
        channels: decoded.numberOfChannels, peak, rms: Math.sqrt(energy / pcm.length), progress };
    });
    assert.deepEqual(result.magic, [79, 103, 103, 83]);
    assert.equal(result.mime, 'audio/ogg');
    assert.equal(result.channels, 2);
    assert.ok(Math.abs(result.duration - result.wavDuration) < .1, JSON.stringify(result));
    assert.ok(result.rms > .01 && result.peak < 1.3, JSON.stringify(result));
    assert.ok(result.oggSize < result.wavSize / 3, JSON.stringify(result));
    assert.ok(result.progress.some(f => f === 1));
    assert.deepEqual(external, []);
  });
}

test('OGG export is reachable from the dialog and downloads a real compressed file', { timeout: 60000 }, async t => {
  await server.ready();
  const browser = await launchBrowser(); t.after(() => browser.close());
  const page = await browser.newPage();
  await page.addInitScript(() => { globalThis.showSaveFilePicker = undefined; });
  await page.goto(server.url + '/?qa=1');
  await page.locator('#exportAsBtn').click();
  await page.locator('.export-advanced').nth(0).locator('summary').click();
  await page.locator('#oggQuality').selectOption('1');
  await page.locator('#wavRegion').check();
  await page.locator('#wavTail').selectOption('0');
  await page.locator('.export-advanced').nth(1).locator('summary').click();
  const download = page.waitForEvent('download', { timeout: 45000 });
  await page.locator('[data-export="ogg"]').click();
  const file = await download;
  assert.match(file.suggestedFilename(), /-song\.ogg$/);
  assert.equal(await file.failure(), null);
  assert.match(await page.locator('#renderStatus').textContent(), /READY|LISTO/);
});

test('cancel during native rendering or OGG encoding prevents a completed export', { timeout: 60000 }, async t => {
  await server.ready();
  const browser = await launchBrowser(); t.after(() => browser.close());
  const page = await browser.newPage(); await page.goto(server.url);
  const result = await page.evaluate(async () => {
    const { createEmptyProject, activeClip, makeNote } = await import('/core.js');
    const { renderWav } = await import('/audio.js');
    const p = createEmptyProject(); activeClip(p, 'lead').notes = [makeNote(0, 60, 8)];
    const errors = [];
    for (const stage of ['render', 'encode']) {
      const controller = new globalThis.AbortController();
      let encoding = false;
      try {
        await renderWav(p, { format: 'ogg', song: false, tailSeconds: 0, signal: controller.signal,
          onStage: value => { encoding = value === 'encode'; if (stage === 'render' && value === stage) controller.abort(); },
          onProgress: () => { if (stage === 'encode' && encoding) controller.abort(); } });
        errors.push('unexpected success');
      } catch (error) { errors.push(error.name); }
    }
    return errors;
  });
  assert.deepEqual(result, ['AbortError', 'AbortError']);
});

test('windowed rendering preserves notes across checkpoints and distortion returns to silence', { timeout: 60000 }, async t => {
  await server.ready();
  const browser = await launchBrowser(); t.after(() => browser.close());
  const page = await browser.newPage(); await page.goto(server.url);
  const result = await page.evaluate(async () => {
    const { createEmptyProject, activeClip, makeNote } = await import('/core.js');
    const { renderWav } = await import('/audio.js');
    const p = createEmptyProject();
    p.masterSettings.bypass = true;
    for (const clip of p.clips) clip.bars = 4;
    const clip = activeClip(p, 'lead');
    clip.notes = [makeNote(0, 57, 6), makeNote(17, 60, 12), makeNote(30, 64, 12), makeNote(47, 62, 4)];
    clip.character.lfo.enabled = false;
    clip.character.fx = { bypass: false, distortion: .4, saturation: .3, chorus: 0, delay: 0, reverb: 0, tone: .5 };
    p.tracks.lead.release = .1;
    const options = { song: false, sampleRate: 44100, tailSeconds: 2, bitDepth: 32 };
    const windowed = new Float32Array(await (await renderWav(p, options)).arrayBuffer(), 44);
    const Native = globalThis.OfflineAudioContext;
    let reference;
    try {
      globalThis.OfflineAudioContext = class extends Native {
        constructor(...args) { super(...args); this.suspend = undefined; this.resume = undefined; }
      };
      reference = new Float32Array(await (await renderWav(p, options)).arrayBuffer(), 44);
    } finally { globalThis.OfflineAudioContext = Native; }
    let maxError = 0, tail = 0;
    for (let i = 0; i < reference.length; i++) maxError = Math.max(maxError, Math.abs(windowed[i] - reference[i]));
    for (const sample of windowed.subarray(windowed.length - 44100)) tail = Math.max(tail, Math.abs(sample));
    return { maxError, tail, length: reference.length, windowedLength: windowed.length };
  });
  assert.equal(result.length, result.windowedLength);
  assert.ok(result.maxError < .0001, JSON.stringify(result));
  assert.ok(result.tail < .0001, JSON.stringify(result));
});

test('OGG finalization transfers bytes without creating a Blob in its worker', { timeout: 60000 }, async t => {
  await server.ready();
  const browser = await launchBrowser(); t.after(() => browser.close());
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.route('**/assets/ogg-worker-*.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: 'globalThis.Blob=class {constructor(){throw new Error("Worker Blob is unavailable")}};\n' + await response.text() });
  });
  await page.goto(server.url);
  const result = await page.evaluate(async () => {
    const { createEmptyProject, activeClip, makeNote } = await import('/core.js');
    const { renderWav } = await import('/audio.js');
    const p = createEmptyProject(); activeClip(p, 'lead').notes = [makeNote(0, 60, 2)];
    const progress = [];
    const blob = await renderWav(p, { format: 'ogg', song: false, region: { start: 0, end: 4 }, tailSeconds: 0, onProgress: value => progress.push(value) });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let offset = 0, eos = false;
    while (offset + 27 <= bytes.length) {
      eos = Boolean(bytes[offset + 5] & 4);
      const segments = bytes[offset + 26]; let size = 0;
      for (let i = 0; i < segments; i++) size += bytes[offset + 27 + i];
      offset += 27 + segments + size;
    }
    return { magic: [...bytes.slice(0, 4)], eos, parsed: offset, size: bytes.length, progress };
  });
  assert.deepEqual(result.magic, [79, 103, 103, 83]);
  assert.equal(result.parsed, result.size);
  assert.equal(result.eos, true);
  assert.equal(result.progress.at(-1), 1);
  assert.ok(result.progress.slice(0, -1).every(value => value < 1));
});

for (const failure of ['loading', 'finalization']) {
  test(`OGG ${failure} errors identify the phase and never report completion`, { timeout: 60000 }, async t => {
    await server.ready();
    const browser = await launchBrowser(); t.after(() => browser.close());
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.route('**/assets/ogg-worker-*.js', async route => {
      if (failure === 'loading') return route.fulfill({ status: 404, body: 'Not found' });
      const response = await route.fetch();
      const intercept = 'self.addEventListener("message",e=>{if(e.data.type==="finish"){e.stopImmediatePropagation();self.postMessage({id:e.data.id,error:"Finalization fixture"});}});\n';
      await route.fulfill({ response, body: intercept + await response.text() });
    });
    await page.goto(server.url);
    const result = await page.evaluate(async () => {
      const { createEmptyProject, activeClip, makeNote } = await import('/core.js');
      const { renderWav } = await import('/audio.js');
      const p = createEmptyProject(); activeClip(p, 'lead').notes = [makeNote(0, 60, 2)];
      const progress = [];
      try {
        await renderWav(p, { format: 'ogg', normalize: true, song: false, region: { start: 0, end: 4 }, tailSeconds: 0, onProgress: value => progress.push(value) });
        return { error: '', progress };
      } catch (error) { return { error: error.message, progress }; }
    });
    assert.match(result.error, new RegExp(failure));
    assert.ok(result.progress.every(value => value < 1), JSON.stringify(result));
  });
}
