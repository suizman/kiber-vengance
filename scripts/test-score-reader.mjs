// Real local inference, not a worker-protocol fixture. An optional mirror must match pinned SHA-256 hashes.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { launchBrowser, preview } from '../tests/browser-support.js';
const kind=process.env.OMR_BROWSER||'chromium', directory=process.env.OMR_MODEL_DIRECTORY;
const manifest=JSON.parse(await readFile('public/omr/models.json','utf8'));
const mirror=new Map();
if(directory) for(const model of manifest.models){const bytes=await readFile(resolve(directory,model.name));assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256);mirror.set(model.name,bytes)}
const server=preview(4263);await server.ready();const browser=await launchBrowser(kind);
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});page.setDefaultTimeout(180000);
const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(!request.url().startsWith(server.url)&&/^https?:/.test(request.url()))network.push({url:request.url(),method:request.method()})});
if(directory) await page.route('https://huggingface.co/ngbcoder/Homr-onnx/resolve/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1),bytes=mirror.get(name);assert.ok(bytes,name);
  const range=route.request().headers().range?.match(/bytes=(\d+)-(\d+)/);
  if(range){const start=+range[1],end=+range[2];await route.fulfill({status:206,body:bytes.subarray(start,end+1),headers:{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':String(end-start+1),'Access-Control-Allow-Origin':'*'}})}
  else await route.fulfill({status:200,body:bytes,headers:{'Access-Control-Allow-Origin':'*'}});
});
const waitResult=()=>Promise.race([page.locator('#insertScore').waitFor(),page.locator('.score-error').waitFor().then(async()=>{throw Error(await page.locator('.score-error').innerText())})]);
try {
  await page.goto(server.url+'/?qa=1');await page.locator('#app.studio-shell').waitFor();await page.locator('#importScoreBtn').click();
  await page.locator('#scoreFile').setInputFiles('tests/fixtures/scores/printed-piano-cello.pdf');await page.locator('#recognizeScore').waitFor();await page.waitForFunction(()=>!document.querySelector('#recognizeScore').disabled);
  const start=Date.now();await page.locator('#recognizeScore').click();
  await page.waitForFunction(async()=>{const cache=await caches.open('kv-omr-homr-fbe8be58-v1');return (await cache.keys()).length>=3});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#recognizeScore').disabled);assert.equal(await page.locator('#insertScore').count(),0);
  const cachedBeforeResume=await page.evaluate(async()=>{const c=await caches.open('kv-omr-homr-fbe8be58-v1');return(await c.keys()).length});assert.ok(cachedBeforeResume>=3);
  const resumedAt=network.length;await page.locator('#recognizeScore').click();await waitResult();const recognizedMs=Date.now()-start;
  const parts=await page.locator('#scorePart option').allTextContents();assert.match(parts[0],/16 notes/);const resumeRequests=network.length-resumedAt;assert.ok(resumeRequests<39,'completed model pieces must be reused');
  const cachedAt=network.length;await page.locator('#recognizeScore').click();await page.waitForFunction(()=>!document.querySelector('#recognizeScore').disabled);assert.equal(network.length,cachedAt,'second recognition must use verified cached models');
  await page.getByRole('button',{name:'Separate staves into parts'}).click();assert.equal(await page.locator('#scorePart option').count(),2);await page.locator('#insertScore').click();await page.waitForFunction(()=>!document.querySelector('#scoreImportDialog'));await page.waitForFunction(async()=>Boolean((await globalThis.__readSavedProject())?.scoreSources?.length));
  const stored=await page.evaluate(async()=>await globalThis.__readSavedProject());const imported=stored.clips.filter(c=>c.track.startsWith('part-'));assert.equal(imported.reduce((sum,c)=>sum+c.notes.length,0),16);
  assert.deepEqual(errors,[]);assert.ok(network.every(request=>request.method==='GET'&&manifest.models.some(model=>model.url===request.url)),'no score uploads or unpinned remote requests');
  const result={browser:kind,modelRevision:manifest.modelMirrorRevision,realWeights:true,verifiedLocalMirror:!!directory,recognizedMs,cachedBeforeResume,resumeRequests,parts,notes:imported.flatMap(c=>c.notes).map(n=>[n.pitch,n.step,n.length]),errors};
  await writeFile(`docs/omr-${kind}-verification.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} finally {await browser.close();server.close()}
