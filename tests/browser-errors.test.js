import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser, preview, goToView } from './browser-support.js';

const server = preview(4279);
test.after(() => server.close());
const playlistError = "TypeError: undefined is not an object (evaluating 'window.__firefox__.playlistLongPressed_210153B2661C4')";
const browsers = ['chromium', 'firefox'];
if (process.env.TEST_WEBKIT) browsers.push('webkit');
async function launch(kind) {
  if (kind !== 'webkit') return launchBrowser(kind);
  const { webkit } = await import('playwright');
  return webkit.launch();
}
function sampleWav() {
  const frames = 32000, buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) buffer.writeInt16LE(Math.round(8000 * Math.sin(i * 2 * Math.PI * 220 / 8000)), 44 + i * 2);
  return buffer;
}

for (const kind of browsers) {
  test(`${kind}: browser script failures stay diagnostic while genuine Studio faults remain visible`, { timeout: 60000 }, async t => {
    await server.ready(); const browser = await launch(kind); t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
    // A different port creates a genuine opaque cross-origin ErrorEvent, without CORS.
    const foreign = createServer((_req, res) => { res.setHeader('Content-Type', 'text/javascript'); res.end('throw new Error("foreign startup fixture");'); });
    await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => foreign.close(resolve)));
    await page.goto(server.url); await page.locator('#app.studio-shell').waitFor();
    await page.evaluate(src => new Promise(resolve => {
      const script = document.createElement('script'); script.onload = resolve; script.onerror = resolve; script.src = src; document.head.append(script);
    }), `http://127.0.0.1:${foreign.address().port}/foreign-startup.js`);
    if (kind === 'firefox') {
      // Firefox exposes this same-site cross-port failure in full. Keep actionable errors visible.
      assert.match(await page.locator('#toast').textContent(), /foreign startup fixture/);
      await page.evaluate(() => { globalThis.__kvErrors.length = 0; document.querySelector('#toast').classList.remove('show'); });
      await page.evaluate(() => globalThis.dispatchEvent(new globalThis.ErrorEvent('error', { message: 'Script error.', error: null })));
    }
    assert.deepEqual(await page.evaluate(() => globalThis.__kvErrors), []);
    assert.equal(await page.locator('#toast.show').count(), 0);
    // Safari's exact native Playlist failure, with an injected-script source rather than app code.
    await page.evaluate(message => globalThis.dispatchEvent(new globalThis.ErrorEvent('error', {
      message, filename: 'user-script:brave-playlist', error: { message, stack: 'global code@user-script:1:1' },
    })), playlistError);
    assert.deepEqual(await page.evaluate(() => globalThis.__kvErrors), []);
    assert.equal(await page.locator('#toast.show').count(), 0);
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { globalThis.__copiedCompatibility = JSON.parse(text); } } }); });
    await page.locator('#menuBtn').click(); await page.locator('#compatBtn').click(); await page.locator('#copyCompatBtn').click();
    const report = await page.evaluate(() => globalThis.__copiedCompatibility);
    const opaque = report.pageErrors.find(entry => entry.origin === 'unattributed');
    assert.ok(opaque); assert.match(opaque.message, /^Script error\.?$/i);
    const browserIssue = report.pageErrors.find(entry => entry.origin === 'browser');
    assert.ok(browserIssue); assert.equal(browserIssue.message, playlistError);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { const script = document.createElement('script'); script.textContent = 'throw new Error("Studio regression sentinel");'; document.head.append(script); });
    assert.match(await page.locator('#toast').textContent(), /Studio error: .*Studio regression sentinel/);
    const faults = await page.evaluate(() => globalThis.__kvErrors);
    assert.equal(faults.length, 1); assert.match(faults[0], /Studio regression sentinel/);
    await page.evaluate(() => { void Promise.reject(new Error('Audio startup regression sentinel')); });
    await page.waitForFunction(() => globalThis.__kvErrors.some(message => message.includes('Audio startup regression sentinel')));
    assert.match(await page.locator('#toast').textContent(), /Audio startup regression sentinel/);
  });

  // WebKit's driver cannot persist selected Files (Playwright #42795). Keep its
  // supplemental keyboard check on synth adapters; Chromium/Firefox also cover sampler.
  const keyboards = [['forge', '#keyboard', 'liveVoices'], ['perform', '#performanceKeyboard', 'liveVoices']];
  if (kind !== 'webkit') keyboards.push(['audio', '#samplerKeyboard', 'samplerVoices']);
  test(`${kind}: long presses in Compose, Live${kind === 'webkit' ? '' : ' and sampler'} preserve held notes and release cleanly`, { timeout: 60000 }, async t => {
    await server.ready(); const browser = await launch(kind); t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
    await page.goto(server.url); await page.locator('#app.studio-shell').waitFor();
    const touch = kind === 'chromium' ? await page.context().newCDPSession(page) : null;
    for (const [view, selector, voiceField] of keyboards) {
      await goToView(page, view);
      if (view === 'audio') {
        // Exercise native file selection and real decoding/storage before holding the sampler key.
        const directory = await mkdtemp(join(tmpdir(), 'kv-held-key-'));
        t.after(() => rm(directory, { recursive: true, force: true }));
        const path = join(directory, 'held-note.wav'); await writeFile(path, sampleWav());
        await page.locator('#samplerImport').setInputFiles(path);
        // Decoding precedes asset persistence; wait for the ready UI before playing.
        await page.waitForFunction(() => globalThis.__kvDiagnostics().samplerLoaded && document.querySelector('#samplerRemove')?.disabled === false);
      }
      const key = page.locator(`${selector} .keyboard-key.natural`).first(); await key.scrollIntoViewIfNeeded();
      const box = await key.boundingBox(), point = { x: box.x + box.width / 2, y: box.y + box.height - 20 };
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
      await page.waitForFunction(field => globalThis.__kvDiagnostics()[field] > 0, voiceField);
      await page.waitForTimeout(650);
      assert.equal(await key.getAttribute('aria-pressed'), 'true');
      const cancelled = await key.locator('b').evaluate(element => !element.dispatchEvent(new globalThis.MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
      assert.equal(cancelled, true);
      await page.evaluate(message => globalThis.dispatchEvent(new globalThis.ErrorEvent('error', { message })), playlistError);
      assert.equal(await key.getAttribute('aria-pressed'), 'true');
      assert.ok(await page.evaluate(field => globalThis.__kvDiagnostics()[field] > 0, voiceField));
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
      await page.waitForFunction(field => globalThis.__kvDiagnostics()[field] === 0, voiceField);
      assert.equal(await key.getAttribute('aria-pressed'), 'false');
      assert.deepEqual(await page.evaluate(() => globalThis.__kvErrors), []);
      assert.equal(await page.locator('#toast').evaluate(el => el.classList.contains('show') && el.textContent.includes('ERROR')), false);
    }
    // Native editing menus remain available outside the musical surface.
    assert.equal(await page.locator('#title').evaluate(element => element.dispatchEvent(new globalThis.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))), true);
  });
}
