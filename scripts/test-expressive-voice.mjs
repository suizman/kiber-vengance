// Opt-in genuine inference. VOICE_MODEL_MIRROR may supply original model bytes.
import assert from 'node:assert/strict';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {launchBrowser,preview} from '../tests/browser-support.js';
import {routeVoiceDownloads} from './voice-test-mirror.mjs';
const server=preview(Number(process.env.VOICE_TEST_PORT)||4265),directory=resolve(tmpdir(),'kiber-expressive-samples');let browser,closeMirror,monitor;
try{
 await server.ready();browser=await launchBrowser();const context=await browser.newContext({serviceWorkers:'block'});closeMirror=await routeVoiceDownloads(context);
 const page=await context.newPage();await page.goto(server.url+'/?qa=1');
 const file=(await readdir('dist/assets')).find(name=>/^chatterbox-worker-.*\.js$/.test(name));assert.ok(file);
 await page.evaluate(({file,device})=>{globalThis.voiceState={kind:'loading'};globalThis.voiceWorker=new Worker('/assets/'+file,{type:'module'});globalThis.voiceWorker.onerror=e=>{globalThis.voiceState={kind:'error',message:e.message}};globalThis.voiceWorker.onmessage=e=>{globalThis.voiceState=e.data;};globalThis.voiceWorker.postMessage({kind:'load',device});},{file,device:process.env.VOICE_DEVICE||'wasm'});
 monitor=setInterval(async()=>{try{const state=await page.evaluate(()=>({kind:globalThis.voiceState.kind,text:globalThis.voiceState.text}));console.log(state);}catch{}},10000);
 await page.waitForFunction(()=>['loaded','error'].includes(globalThis.voiceState.kind),null,{timeout:600000});assert.equal(await page.evaluate(()=>globalThis.voiceState.kind),'loaded',await page.evaluate(()=>globalThis.voiceState.message));await mkdir(directory,{recursive:true});
 const output=[];
 for(const settings of [{language:'es',text:'Hola, buenas noches.',intensity:.3},{language:'es',text:'Hola, buenas noches.',intensity:.8},{language:'en',text:'Hello, good evening.',intensity:.5}]){
  const start=Date.now();await page.evaluate(settings=>{globalThis.voiceState={kind:'generating'};globalThis.voiceWorker.postMessage({kind:'generate',...settings});},settings);
  await page.waitForFunction(()=>['audio','error'].includes(globalThis.voiceState.kind),null,{timeout:900000});assert.equal(await page.evaluate(()=>globalThis.voiceState.kind),'audio',await page.evaluate(()=>globalThis.voiceState.message));
  const result=await page.evaluate(()=>{const {pcm,sampleRate}=globalThis.voiceState;return {samples:Array.from(pcm),sampleRate}});assert.ok(result.samples.length>12000);assert.ok(result.samples.every(Number.isFinite));const energy=result.samples.reduce((sum,n)=>sum+n*n,0);assert.ok(Math.sqrt(energy/result.samples.length)>.005,'Silence is not usable speech');
  const wav=Buffer.alloc(44+result.samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(result.sampleRate,24);wav.writeUInt32LE(result.sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);result.samples.forEach((n,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,n))*32767),44+i*2));
  const name=`${settings.language}-${settings.intensity}.wav`;await writeFile(resolve(directory,name),wav);output.push({...settings,file:name,elapsedMs:Date.now()-start,seconds:result.samples.length/result.sampleRate,rms:Math.sqrt(energy/result.samples.length)});console.log(output.at(-1));
 }
 await writeFile(resolve(directory,'evidence.json'),JSON.stringify(output,null,2));console.log('Real model outputs saved for listening:',directory);
}finally{clearInterval(monitor);await browser?.close();closeMirror?.();server.close();}
