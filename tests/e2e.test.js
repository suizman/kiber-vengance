import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, preview, goToView, setSoundInspector } from './browser-support.js';
import { createServer } from 'vite';

const server=preview(4199),{url,ready}=server;
test.after(()=>server.close());

for (const mode of ['development', 'production']) {
  test(`Firefox Scratch Deck imports and captures with ${mode} assets`, async t => {
    let target = url;
    if (mode === 'development') {
      const dev = await createServer({ server: { host: '127.0.0.1', port: 4203, strictPort: true } });
      t.after(() => dev.close());
      await dev.listen();
      target = 'http://127.0.0.1:4203';
    } else await ready();
    const browser = await launchBrowser('firefox');
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // A non-silent PCM fixture exercises the real decoder and processor.
    const frames = 8000, wav = Buffer.alloc(44 + frames * 2);
    wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(frames * 2, 40);
    for (let i = 0; i < frames; i++) wav.writeInt16LE(Math.round(8000 * Math.sin(i * 2 * Math.PI * 220 / 8000)), 44 + i * 2);
    for (const action of ['import', 'capture']) {
      // Each action must initialize the worklet successfully from a fresh page.
      await page.goto(`${target}/?qa=1`);
      await goToView(page, 'perform');
      if (action === 'import') {
        await page.locator('#scratchImport').setInputFiles({ name: 'firefox-deck.wav', mimeType: 'audio/wav', buffer: wav });
      } else {
        await page.locator('#scratchBars').selectOption('1');
        await page.locator('#scratchCaptureBtn').click();
      }
      await page.waitForFunction(() => globalThis.__kvDiagnostics().scratchReady, null, { timeout: 20000 });
      assert.ok((await page.evaluate(() => globalThis.__kvDiagnostics())).scratchFrames > 1000);
      assert.equal(await page.locator('#scratchPlayBtn').isEnabled(), true);
      assert.match(await page.locator('#scratchStatus').textContent(), action === 'import' ? /firefox-deck\.wav/ : /BUFFER ARMED/);
    }
    assert.deepEqual(errors, []);
  });
}

test('complete composition, live input, persistence and export work in Firefox',async t=>{
  await ready();const browser=await launchBrowser('firefox');t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${url}/?qa=1`);await page.locator('.note-block').first().waitFor();
  assert.equal(await page.locator('.track').count(),5);
  assert.ok(await page.locator('.pitch-label').count()>=40);
  assert.ok(await page.locator('.note-block').count()>5);
  const count=await page.locator('#clipSelect option').count();
  await page.locator('#duplicateBtn').click();assert.equal(await page.locator('#clipSelect option').count(),count+1);
  await page.locator('#undoBtn').click();assert.equal(await page.locator('#clipSelect option').count(),count);
  await page.locator('#redoBtn').click();assert.equal(await page.locator('#clipSelect option').count(),count+1);
  await goToView(page,'arrange');const scenes=await page.locator('.scene').count();await page.locator('#addSceneBtn').click();assert.equal(await page.locator('.scene').count(),scenes+1);
  await page.locator('#playBtn').click();await page.waitForFunction(()=>globalThis.__kvDiagnostics().schedulerActive);
  await page.locator('#pauseBtn').click();await page.waitForFunction(()=>!globalThis.__kvDiagnostics().schedulerActive);
  await goToView(page,'forge');
  const liveKey=page.locator('#keyboard .key').first();await liveKey.scrollIntoViewIfNeeded();const box=await liveKey.boundingBox();assert.ok(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.8);await page.mouse.down();await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===1);await page.mouse.up();await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===0);
  await page.locator('#exportAsBtn').click();await page.locator('.export-advanced').nth(1).locator('summary').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-export="clip-wav"]').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.wav$/);assert.equal(await download.failure(),null);
  await page.waitForFunction(()=>Boolean(globalThis.localStorage.getItem('kiber-vengance-project-v6')));
  const stored=await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6')));assert.equal(stored.version,6);assert.ok(stored.clips.length>=10);assert.ok(stored.clips.every(clip=>clip.character?.fx&&clip.character?.macros));
  await page.reload();await page.locator('.note-block').first().waitFor();assert.equal(await page.locator('#clipSelect option').count(),count+1);assert.deepEqual(errors,[]);
});

for (const kind of ['firefox', 'chromium']) {
  test(`${kind} keeps clip sounds through editing, history, reload and WAV rendering`, async t => {
    await ready();
    const browser = await launchBrowser(kind); t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => {
      globalThis.__clipMidi = { onmidimessage: null };
      Object.defineProperty(globalThis.navigator, 'requestMIDIAccess', { configurable: true, value: async () => ({ inputs: new Map([['test', globalThis.__clipMidi]]) }) });
    });
    await page.goto(`${url}/?qa=1`);
    await page.locator('#clipSelect option').first().waitFor({ state: 'attached' });
    const ids = await page.locator('#clipSelect option').evaluateAll(options => options.map(option => option.value));
    await setSoundInspector(page, true);
    await page.locator('#preset').selectOption('Neon Talon');
    await page.locator('#clipSelect').selectOption(ids[1]);
    assert.equal(await page.locator('#preset').inputValue(), 'Razor Choir');
    await page.locator('#preset').selectOption('Solar Vengeance');
    await setSoundInspector(page, false); await page.locator('#undoBtn').click(); await setSoundInspector(page, true);
    assert.equal(await page.locator('#preset').inputValue(), 'Razor Choir');
    await setSoundInspector(page, false); await page.locator('#redoBtn').click(); await setSoundInspector(page, true);
    assert.equal(await page.locator('#preset').inputValue(), 'Solar Vengeance');
    await page.locator('#clipSelect').selectOption(ids[0]);
    assert.equal(await page.locator('#preset').inputValue(), 'Neon Talon');
    await setSoundInspector(page, false); await page.keyboard.press('Shift+n'); await setSoundInspector(page, true);
    assert.equal(await page.locator('#preset').inputValue(), 'Neon Talon');
    await page.locator('#preset').selectOption('Razor Choir');
    await page.locator('#clipSelect').selectOption(ids[0]);
    assert.equal(await page.locator('#preset').inputValue(), 'Neon Talon');
    await page.waitForFunction(() => {
      const p = JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6') || 'null');
      return p?.clips.some(c => c.instrument?.preset === 'Solar Vengeance');
    });
    await page.evaluate(() => {
      const key = 'kiber-vengance-project-v6', p = JSON.parse(globalThis.localStorage.getItem(key));
      p.midiMappings = [{ id: 'clip-cutoff', channel: 0, controller: 21, target: 'track.lead.cutoff', min: 0, max: 1 }];
      globalThis.localStorage.setItem(key, JSON.stringify(p));
    });
    await page.reload(); await setSoundInspector(page, true);
    await page.locator('#clipSelect').selectOption(ids[1]);
    assert.equal(await page.locator('#preset').inputValue(), 'Solar Vengeance');
    await page.waitForFunction(() => typeof globalThis.__clipMidi?.onmidimessage === 'function');
    await page.evaluate(() => globalThis.__clipMidi.onmidimessage({ data: [0xb0, 21, 64] }));
    await page.locator('#clipSelect').selectOption(ids[0]);
    assert.equal(+await page.locator('[data-dial="cutoff"] [role="slider"]').getAttribute('aria-valuenow'), 5600);
    await page.locator('#clipSelect').selectOption(ids[1]);
    assert.ok(Math.abs(+await page.locator('[data-dial="cutoff"] [role="slider"]').getAttribute('aria-valuenow') - (120 + 64 / 127 * 11880)) < 1);
    await setSoundInspector(page, false);
    await page.locator('#menuBtn').click(); await page.locator('#presetLibraryBtn').click();
    await page.locator('#saveUserPresetBtn').click();
    await page.locator('[data-request-dialog] input[name=name]').fill('Clip Solar');
    await page.locator('[data-request-dialog] button[type=submit]').click();
    const saved = await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('kiber-vengance-user-presets-v1')).at(-1));
    assert.equal(saved.instrument.preset, 'Solar Vengeance');
    assert.equal(saved.instrument.volume, undefined);
    const beforeMixer = await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6')).tracks.lead);
    // Old user banks bundled mixer state: importing one must not mute/change the track.
    const legacyPreset = { ...saved, id: 'legacy-clip-test', name: 'Legacy Clip', instrument: { ...saved.instrument, preset: 'Legacy Clip', wave: 'triangle', volume: 0, pan: -1, mute: true, solo: true } };
    await page.locator('#importPresetBank').setInputFiles({ name: 'legacy-bank.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'kiber-vengance-preset-bank', presets: [legacyPreset] })) });
    await page.locator('[data-preset-id="legacy-clip-test"] [data-preset-load]').click();
    await setSoundInspector(page, true);
    assert.equal(await page.locator('#preset').inputValue(), 'Legacy Clip');
    assert.equal(await page.locator('#waveSelect').inputValue(), 'triangle');
    await page.locator('#clipSelect').selectOption(ids[0]);
    assert.equal(await page.locator('#preset').inputValue(), 'Neon Talon');
    await page.waitForFunction(() => JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6')).clips.some(c => c.instrument?.preset === 'Legacy Clip'));
    const afterMixer = await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6')).tracks.lead);
    assert.deepEqual(afterMixer, beforeMixer);
    const results = await page.evaluate(async () => {
      const { createEmptyProject, activeClip, duplicateClip, makeNote } = await import('/core.js');
      const { renderWav, AudioEngine } = await import('/audio.js');
      const p = createEmptyProject(); p.tempo = 120; p.swing = 0; p.masterSettings.bypass = true;
      for (const clip of p.clips) clip.bars = 1;
      const a = activeClip(p, 'lead'); a.notes = [makeNote(0, 60, 4)]; a.character.lfo.enabled = false;
      Object.assign(a.instrument, { wave: 'sine', osc2Wave: 'off', unison: 1, attack: .005, release: .05 });
      const b = duplicateClip(p, a.id); b.instrument.wave = 'square';
      p.tracks.lead.solo = true;
      p.arrangement = [a, b].map(c => ({ id: c.id, name: c.name, repeats: 1, clipIds: { ...p.activeClipIds, lead: c.id } }));
      const render = async () => {
        const blob = await renderWav(p, { song: true, dry: true, tailSeconds: 0, bitDepth: 32, sampleRate: 44100 });
        const ctx = new globalThis.OfflineAudioContext(2, 1, 44100);
        return (await ctx.decodeAudioData(await blob.arrayBuffer())).getChannelData(0);
      };
      const mixed = await render(); b.instrument.wave = 'sine'; const allSine = await render();
      a.instrument.wave = 'square'; b.instrument.wave = 'square'; const allSquare = await render();
      const diff = (x, y, start) => {
        let total = 0; for (let i = start; i < start + 4000; i++) total += Math.abs(x[i] - y[i]);
        return total / 4000;
      };
      // A live voice also keeps its original envelope when its clip is edited.
      const engine = new AudioEngine(); engine.project = p;
      p.activeClipIds.lead = a.id; a.instrument.release = .8;
      await engine.startLive('held', 'lead', 60);
      const voice = engine.liveVoices.get('held'); a.instrument.release = .1;
      p.activeClipIds.lead = b.id; engine.setProject(p);
      const heldRelease = voice.cfg.release;
      const held = engine.liveVoices.has('held');
      engine.stopLive('held', true); await engine.ctx.close();
      return { firstMatch: diff(mixed, allSine, 5000), secondMatch: diff(mixed, allSquare, 93200),
        firstDiff: diff(mixed, allSquare, 5000), secondDiff: diff(mixed, allSine, 93200), heldRelease, held };
    });
    assert.ok(results.firstMatch < 1e-6, JSON.stringify(results));
    assert.ok(results.secondMatch < 1e-6, JSON.stringify(results));
    assert.ok(results.firstDiff > .001, JSON.stringify(results));
    assert.ok(results.secondDiff > .001, JSON.stringify(results));
    assert.equal(results.heldRelease, .8); assert.equal(results.held, true);
  });
}

for (const kind of ['firefox', 'chromium']) {
  test(`${kind} clip transport pauses and resumes at its cursor`, async t => {
    await ready(); const browser = await launchBrowser(kind); t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${url}/?qa=1`); await page.locator('.note-block').first().waitFor();
    const button = page.locator('#clipStartBtn');
    assert.equal(await button.getAttribute('aria-label'), 'Play or resume active clips');
    await page.locator('#clipPosition').fill('8'); await button.click();
    await page.waitForFunction(() => globalThis.__kvDiagnostics().schedulerActive && globalThis.__kvDiagnostics().position >= 11);
    assert.equal(await button.getAttribute('aria-label'), 'Pause active clips');
    await button.click();
    assert.equal((await page.evaluate(() => globalThis.__kvDiagnostics())).schedulerActive, false);
    const paused = +await page.locator('#clipPosition').inputValue();
    assert.ok(paused >= 8);
    await page.waitForTimeout(300);
    assert.equal(+await page.locator('#clipPosition').inputValue(), paused);
    assert.equal(await button.textContent(), '▶ CLIP');
    await button.click();
    await page.waitForFunction(start => {
      const d = globalThis.__kvDiagnostics();
      return d.schedulerActive && !d.songMode && d.position >= start && d.position < start + 4;
    }, paused);
    await page.locator('#pauseBtn').click();
    assert.equal(await button.textContent(), '▶ CLIP');
    await page.locator('#playBtn').click();
    assert.equal(await button.getAttribute('aria-label'), 'Pause active clips');
    await page.locator('#playBtn').click();
    assert.equal(await button.textContent(), '▶ CLIP');
    await goToView(page, 'arrange'); await page.locator('#globalStartBtn').click();
    await goToView(page, 'forge');
    assert.equal((await page.evaluate(() => globalThis.__kvDiagnostics())).songMode, true);
    assert.equal(await button.textContent(), '▶ CLIP');
    await button.click();
    await page.waitForFunction(() => globalThis.__kvDiagnostics().schedulerActive && !globalThis.__kvDiagnostics().songMode);
    await button.click();
    assert.equal((await page.evaluate(() => globalThis.__kvDiagnostics())).schedulerActive, false);
  });
}

for (const kind of ['firefox', 'chromium']) {
  test(`${kind} loads every clip in an arrangement section into Compose`, async t => {
    await ready();
    const browser = await launchBrowser(kind);
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${url}/?qa=1`);
    await page.locator('.note-block').first().waitFor();
    await goToView(page, 'arrange');
    const section = page.locator('.scene').nth(1),
      expected = await section.locator('[data-scene-track]').evaluateAll(selects =>
        Object.fromEntries(selects.map(select => [select.dataset.sceneTrack, select.value])),
      );
    await section.locator('[data-action="load-compose"]').click();
    assert.equal(await page.locator('#app').getAttribute('data-active-view'), 'forge');
    assert.equal(await page.locator('#studioInspector').getAttribute('aria-hidden'), 'true');
    for (const [track, clipId] of Object.entries(expected)) {
      await page.locator(`[data-track="${track}"]`).click();
      assert.equal(await page.locator('#clipSelect').inputValue(), clipId);
    }
    await page.locator('#languageSelect').selectOption('es');
    await goToView(page, 'arrange');
    assert.match(
      await page.locator('.scene').nth(1).locator('[data-action="load-compose"]').textContent(),
      /CARGAR EN COMPOSE/,
    );
  });
}
