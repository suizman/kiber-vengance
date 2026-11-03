import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import axe from 'axe-core';
import { launchBrowser, preview, goToView } from './browser-support.js';
const server=preview(4267);test.after(()=>server.close());
const fixture=await readFile(new URL('./fixtures/scores/voices-tempo-transposition.musicxml',import.meta.url));
for(const kind of ['chromium','firefox']) test(`${kind}: local score review, acoustic audition, notation, undo, assets and reload`,{timeout:90000},async t=>{
  await server.ready();const browser=await launchBrowser(kind);t.after(()=>browser.close());
  const page=await browser.newPage({viewport:kind==='chromium'?{width:390,height:844}:{width:1440,height:1000},hasTouch:kind==='chromium',serviceWorkers:'block'}),errors=[],remote=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(server.url)&&/^https?:/.test(request.url()))remote.push(request.url())});
  await page.addInitScript(()=>{globalThis.__scoreAudio=[];const Native=globalThis.AudioContext;globalThis.AudioContext=class extends Native{constructor(...args){super(...args);globalThis.__scoreAudio.push(this)}}});
  await page.goto(server.url+'/?qa=1');await page.locator('#app.studio-shell').waitFor();await page.locator('#importScoreBtn').click();
  await page.locator('#scoreFile').setInputFiles({name:'ensemble.musicxml',mimeType:'application/xml',buffer:fixture});await page.locator('#insertScore').waitFor();
  assert.equal(await page.locator('#scorePart option').count(),2);await page.locator('#scorePartName').fill('Piano <review>');await page.locator('#scorePartName').press('Tab');
  await page.locator('#scoreListen').click();await page.waitForFunction(()=>globalThis.__scoreAudio.some(ctx=>ctx.state==='running'));await page.getByRole('button',{name:'Stop preview',exact:true}).click();await page.waitForFunction(()=>globalThis.__scoreAudio.every(ctx=>ctx.state==='closed'));
  await page.getByRole('button',{name:'Notation preview',exact:true}).click();await page.locator('.score-notation').scrollIntoViewIfNeeded();await page.locator('.score-notation svg, .score-notation canvas').first().waitFor().catch(async error=>{throw new Error(`${error.message}: ${await page.locator('.score-notation').innerHTML()}; ${errors}; ${remote}`)});
  await page.addScriptTag({content:axe.source});const audit=await page.evaluate(()=>globalThis.axe.run(document.querySelector('#scoreImportDialog')));assert.deepEqual(audit.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  assert.equal(await page.locator('#scoreImportDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await page.locator('#insertScore').click();await page.waitForFunction(()=>!document.querySelector('#scoreImportDialog'));assert.equal(await page.locator('.track').count(),7);
  await page.locator('#undoBtn').click();assert.equal(await page.locator('.track').count(),5);await page.locator('#redoBtn').click();assert.equal(await page.locator('.track').count(),7);
  await page.waitForFunction(async()=>Object.keys((await globalThis.__readSavedProject())?.tracks||{}).length===7);await page.reload();await page.locator('#app.studio-shell').waitFor();assert.equal(await page.locator('.track').count(),7);
  const assets=await page.evaluate(async()=>{const p=await globalThis.__readSavedProject(),source=p.scoreSources[0];const db=await new Promise(resolve=>{const r=globalThis.indexedDB.open('kiber-vengance-assets-v1');r.onsuccess=()=>resolve(r.result)});try{return await Promise.all([source.assetId,source.reviewAssetId,source.musicXmlAssetId].map(id=>new Promise(resolve=>{const r=db.transaction('assets').objectStore('assets').get(id);r.onsuccess=()=>resolve({id,bytes:r.result?.size||0})})))}finally{db.close()}});assert.equal(assets.length,3);assert.ok(assets.every(asset=>asset.bytes>100));
  await goToView(page,'mix');assert.equal(await page.locator('.mixer-channel').count(),7);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=globalThis.innerWidth+1),true);
  await goToView(page,'forge');await page.locator('#importScoreBtn').click();await page.locator('#scoreFile').setInputFiles({name:'broken.xml',mimeType:'application/xml',buffer:Buffer.from('<broken>')});await page.locator('.score-error').waitFor();assert.equal(await page.locator('#insertScore').count(),0);
  assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
});

test('real acoustic bank produces stereo PCM, per-clip effects and cancellable exports',{timeout:60000},async t=>{
  await server.ready();const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage({serviceWorkers:'block'});await page.goto(server.url+'/?qa=1');
  const result=await page.evaluate(async()=>{
    const {createEmptyProject,addInstrumentTrack,activeClip,makeNote}=await import('/core.js'),{renderWav}=await import('/audio.js');
    const p=createEmptyProject();p.swing=0;const id=addInstrumentTrack(p,'Piano','gm',0),clip=activeClip(p,id);clip.notes=[makeNote(0,60,4)];clip.durationSteps=8;p.arrangement=[{id:'s',name:'Piano',clipIds:{[id]:clip.id},repeats:1}];
    const energy=async blob=>{const v=new DataView(await blob.arrayBuffer());let sum=0,peak=0;for(let i=44;i<v.byteLength;i+=4){const n=v.getFloat32(i,true);sum+=n*n;peak=Math.max(peak,Math.abs(n))}return{energy:sum,peak,size:blob.size}};
    const options={song:true,bitDepth:32,sampleRate:44100,tailSeconds:.5};const dry=await energy(await renderWav(p,{...options,dry:true}));clip.character.fx.distortion=.9;clip.character.fx.reverb=.8;const wet=await energy(await renderWav(p,options));
    const controller=new globalThis.AbortController();controller.abort();let cancelled=false;try{await renderWav(p,{...options,signal:controller.signal})}catch(error){cancelled=error.name==='AbortError'}return{dry,wet,cancelled};
  });assert.ok(result.dry.energy>1&&result.dry.peak>.001);assert.ok(Math.abs(result.dry.energy-result.wet.energy)>.01);assert.equal(result.cancelled,true);
});

test('canonical save corruption is preserved and large editors keep a bounded visible note tree',{timeout:60000},async t=>{
  await server.ready();const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});await page.goto(server.url+'/?qa=1');await page.locator('#app.studio-shell').waitFor();
  await page.evaluate(async()=>{const{createEmptyProject,activeClip,makeNote}=await import('/core.js');const p=createEmptyProject(),clip=activeClip(p,'lead');clip.bars=64;clip.notes=Array.from({length:10000},(_,i)=>makeNote((i*7)%1024,48+i%40,1));await globalThis.__writeSavedProject(p)});await page.reload();await page.locator('#app.studio-shell .note-block').first().waitFor();assert.ok(await page.locator('.note-block').count()<3000);
  await page.locator('#rollPane').evaluate(el=>{el.scrollLeft=20000});await page.waitForTimeout(100);assert.ok(await page.locator('.note-block').count()>0);assert.ok(await page.locator('.note-block').count()<3000);
  await page.evaluate(async()=>{const p=await globalThis.__readSavedProject();p.version=999;await globalThis.__writeSavedProject(p)});await page.reload();await page.locator('#app.studio-shell').waitFor();
  const quarantined=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=globalThis.indexedDB.open('kiber-vengance-state-v7');r.onsuccess=()=>resolve(r.result)});try{return await new Promise(resolve=>{const r=db.transaction('metadata').objectStore('metadata').getAll();r.onsuccess=()=>resolve(r.result.some(value=>value?.project?.version===999))})}finally{db.close()}});assert.equal(quarantined,true);
});
