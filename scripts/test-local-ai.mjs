// Opt-in real-model smoke test. Downloads the selected model; never runs in normal E2E.
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { launchBrowser, preview } from '../tests/browser-support.js';
import { webkit } from 'playwright';
const server=preview(Number(process.env.AI_TEST_PORT)||4206);let browser,monitor;
try {
  await server.ready();
  const kind=process.env.AI_TEST_BROWSER||'chromium';
  const compatibleRuntime=process.env.AI_TEST_PLAYWRIGHT_MODULE?await import(process.env.AI_TEST_PLAYWRIGHT_MODULE):null;
  const executable=process.env[`${kind.toUpperCase()}_EXECUTABLE_PATH`];
  browser=compatibleRuntime?await compatibleRuntime[kind].launch({headless:true,...(executable?{executablePath:executable}:{})}):kind==='webkit'?await webkit.launch({headless:true,...(process.env.WEBKIT_EXECUTABLE_PATH?{executablePath:process.env.WEBKIT_EXECUTABLE_PATH}:{})}):await launchBrowser(kind,{args:process.env.AI_TEST_UNSAFE_WEBGPU==='1'?['--enable-unsafe-webgpu']:[]});
  const page=await browser.newPage({viewport:{width:1366,height:1000}});
  monitor=setInterval(async()=>{
    try { console.log('Progress:',...(await page.locator('#localAIStatus,.ai-detail').allTextContents())); } catch { /* Browser may be closing. */ }
  },10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.url,{waitUntil:'networkidle'});
  const count=await page.locator('#clipSelect option').count();
  await page.locator('#settingsBtn').click();await page.locator('#openLocalAISettings').click();
  await page.locator('#localAIBackend').selectOption(process.env.AI_TEST_BACKEND||'gpu');
  const load=async()=>{
    await page.locator('#loadLocalAI').click();
    await page.waitForFunction(()=>/Ready/.test(document.querySelector('#localAIStatus')?.textContent||'')||document.querySelector('.ai-error'),null,{timeout:300000});
    assert.equal(await page.locator('.ai-error').count(),0,await page.locator('.ai-error').allTextContents());
    console.log('Real local model loaded:',await page.locator('#localAIStatus').textContent());
  };
  await load();
  if(process.env.AI_TEST_PRESETS==='1'){
    await page.locator('#aiPresetCatalog > summary').click();
    await page.locator('[data-ai-preset="scarlett-protocol"] button').click();
    await page.locator('[data-ai-preset="sound-scarlett-lead"] button').first().click();
    await page.locator('#aiApplyTempo').check();
    await page.locator('#aiPresetCatalog > summary').click();
    assert.equal(await page.locator('#aiRhythm').inputValue(),'driving');
  }
  await page.locator('#aiKey').selectOption('D');
  await page.locator('#aiPrompt').fill('A dark synthwave melody with short notes and a rising ending');
  await page.locator('#generateLocalAI').click();
  await page.locator('.ai-result,.ai-error').first().waitFor({timeout:300000});
  assert.equal(await page.locator('.ai-error').count(),0,await page.locator('.ai-error').allTextContents());
  console.log('Real inference:',await page.locator('.ai-result').textContent());
  assert.ok(await page.locator('.ai-note-preview i').count()>4);
  await page.screenshot({path:join(tmpdir(),'kiber-local-ai-real.png')});
  await page.locator('#auditionLocalAI').click();
  await page.waitForTimeout(600);await page.locator('#auditionLocalAI').click();
  await page.locator('#applyLocalAI').click();
  if(process.env.AI_TEST_PRESETS==='1'){
    assert.equal(await page.locator('#tempo').inputValue(),'128');
    await page.locator('#exportAsBtn').click();
    await page.locator('.export-advanced').nth(1).locator('summary').click();
    const downloading=page.waitForEvent('download');await page.locator('[data-export="project"]').click();
    const download=await downloading,project=JSON.parse(await readFile(await download.path(),'utf8'));
    const generated=project.clips.find(clip=>clip.id===project.activeClipIds.lead);
    assert.equal(generated.instrument.cutoff,3100);assert.equal(generated.character.fx.distortion,.5);
    assert.equal(project.tempoMap.find(point=>point.step===0).bpm,128);
    await page.locator('#exportDialog [data-close]').click();
    console.log('Verified exported clip sound and base tempo match the selected preset.');
  }
  assert.equal(await page.locator('#clipSelect option').count(),count+1);
  const notes=await page.locator('.note-block').count();assert.ok(notes>4);
  await page.locator('#undoBtn').click();assert.equal(await page.locator('#clipSelect option').count(),count);
  await page.locator('#redoBtn').click();assert.equal(await page.locator('#clipSelect option').count(),count+1);
  await page.waitForTimeout(500);await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#clipSelect option').count(),count+1);
  assert.equal(await page.locator('.note-block').count(),notes);
  await page.locator('#settingsBtn').click();await page.locator('#openLocalAISettings').click();
  // WebKit's offline emulation refuses even Blob module-worker startup.
  // Validate offline inference with its model loaded; Firefox/Chromium also
  // validate cold worker/model reload from cache under offline emulation.
  if(kind==='webkit'){await load();await page.context().setOffline(true);}
  else{await page.context().setOffline(true);await load();}
  await page.locator('#aiPrompt').fill('Una melodía tranquila y sostenida con un motivo descendente');
  await page.locator('#generateLocalAI').click();
  await page.locator('.ai-result,.ai-error').first().waitFor({timeout:300000});
  assert.equal(await page.locator('.ai-error').count(),0,await page.locator('.ai-error').allTextContents());
  console.log('Offline Spanish inference:',await page.locator('.ai-result').textContent());
  await page.locator('#unloadLocalAI').click();
  assert.match(await page.locator('#localAIStatus').textContent(),/not loaded/);
  assert.deepEqual(errors,[]);
  console.log('PASS: real local inference, audition, new clip, Undo/Redo, persistence, cached offline inference and unload.');
} finally {clearInterval(monitor);await browser?.close();server.close();}
