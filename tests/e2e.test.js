import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, preview, goToView } from './browser-support.js';

const server=preview(4199),{url,ready}=server;
test.after(()=>server.close());

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
