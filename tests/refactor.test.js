import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformWithOxc} from 'vite';
const load = async path => {
  const {code:outputText}=await transformWithOxc(await readFile(new URL(path,import.meta.url),'utf8'),path);
  return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
};
const {DeckProcessor}=await load('../src/audio/deck.ts');
const {ProjectSession}=await load('../src/state/project-session.ts');
const {chatterboxUnavailable,voiceGenerationUnavailable}=await load('../src/ai/voice-safety.ts');
const {modelBytes}=await load('../src/ai/model-download.ts');

test('voice generation is desktop-only without treating touch laptops as tablets',()=>{
 for(const device of [
  {userAgent:'Mozilla iPhone Safari'}, {userAgent:'Mozilla Android Chrome'},
  {userAgent:'Mozilla Macintosh Safari',maxTouchPoints:5},
  {userAgent:'desktop',userAgentData:{mobile:true}},
 ])assert.equal(voiceGenerationUnavailable(device),true,JSON.stringify(device));
 for(const device of [
  {userAgent:'Macintosh Safari',maxTouchPoints:0},
  {userAgent:'Windows Chrome',maxTouchPoints:10,deviceMemory:8},
  {userAgent:'Linux Firefox'},
  {userAgent:'Windows Chrome',deviceMemory:4},
 ])assert.equal(voiceGenerationUnavailable(device),false,JSON.stringify(device));
 assert.equal(chatterboxUnavailable({userAgent:'Windows Chrome',deviceMemory:4}),true);
 assert.equal(chatterboxUnavailable({userAgent:'Windows Chrome',deviceMemory:8}),false);
});

test('large voice downloads are consumed into cache before reading and recover from unavailable storage',async()=>{
 const originalFetch=globalThis.fetch,originalCaches=Object.getOwnPropertyDescriptor(globalThis,'caches');
 let requests=0,puts=0,cached=null,quota=false;
 const bytes=new Uint8Array([1,2,3,4]);
 globalThis.fetch=async()=>{requests++;const response=new globalThis.Response(bytes);response.clone=()=>{throw Error('Large response must never be cloned')};return response};
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{open:async()=>({
  match:async()=>cached?new globalThis.Response(cached):undefined,
  put:async(url,response)=>{puts++;const body=await response.arrayBuffer();assert.equal(response.bodyUsed,true);if(quota)throw Error('quota');cached=body;},
 })}});
 try{
  assert.deepEqual(await modelBytes('https://model.test/weights','weights',()=>{}),bytes);
  assert.equal(puts,1);assert.equal(requests,1);
  assert.deepEqual(await modelBytes('https://model.test/weights','weights',()=>{}),bytes);assert.equal(requests,1);
  quota=true;cached=null;const messages=[];
  assert.deepEqual(await modelBytes('https://model.test/weights','weights',s=>messages.push(s)),bytes);
  assert.equal(requests,3);assert.ok(messages.some(s=>s.includes('without storage')));
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{open:async()=>{throw Error('Unavailable')}}});
  assert.deepEqual(await modelBytes('https://model.test/weights','weights',()=>{}),bytes);assert.equal(requests,4);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalCaches)Object.defineProperty(globalThis,'caches',originalCaches);else delete globalThis.caches;
 }
});

test('deck load acknowledgements cannot resolve a replaced load or the other deck',async()=>{
 const Original=globalThis.AudioWorkletNode;
 globalThis.AudioWorkletNode=class{constructor(){this.port={postMessage:message=>{this.sent=message},onmessage:null};}connect(){} };
 try{
  const a=new DeckProcessor('A',()=>{}),b=new DeckProcessor('B',()=>{});
  a.attach({});b.attach({});
  const buffer={sampleRate:44100,numberOfChannels:1,getChannelData:()=>new Float32Array(100)};
  const first=a.load(buffer);const failed=assert.rejects(first,/Superseded/);const old=a.node.sent.requestId;
  const second=a.load(buffer);const current=a.node.sent.requestId;const other=b.load(buffer);
  a.node.port.onmessage({data:{type:'ready',requestId:old}});assert.equal(a.ready,false);assert.equal(b.ready,false);
  a.node.port.onmessage({data:{type:'ready',requestId:current}});await second;await failed;assert.equal(a.ready,true);assert.equal(b.ready,false);
  b.node.port.onmessage({data:{type:'ready',requestId:b.node.sent.requestId}});await other;assert.equal(b.ready,true);
 }finally{globalThis.AudioWorkletNode=Original;}
});
test('a gesture commits one history snapshot and saves the final project, including recovery failures',()=>{
 const project={title:'Original',modifiedAt:0},snapshots=[],writes=[],states=[];
 const session=new ProjectSession(()=>project,{push:value=>snapshots.push(globalThis.structuredClone(value))},{storage:{setItem:(key,value)=>writes.push([key,JSON.parse(value)])},key:'project',status:s=>states.push(s),recovery:()=>{throw Error('quota')},recoveryFailed:()=>states.push('recovery-failed')});
 const gesture=session.beginEdit(()=>session.changed());
 gesture.markChanged();project.title='Drag 1';gesture.markChanged();project.title='Final';gesture.commit();gesture.commit();session.flush();session.dispose();
 assert.equal(snapshots.length,1);assert.equal(snapshots[0].title,'Original');assert.equal(writes.length,1);assert.equal(writes[0][1].title,'Final');assert.deepEqual(states,['pending','saved','recovery-failed']);
});

test('audio FX and output defaults preserve legacy projects and sanitize optional parameters',async()=>{
 const {normalizeEffects,AUDIO_FX_PRESETS}=await import('../dist/audio.js');
 const {createEmptyProject,createAudioLane,createAudioRegion,migrateProject,normalizeOutputMix}=await import('../dist/core.js');
 const p=createEmptyProject(),lane=createAudioLane('Voice'),region=createAudioRegion('speech','Take');lane.regions.push(region);p.audioLanes.push(lane);delete p.outputMix;
 const migrated=migrateProject(p);assert.equal(migrated.outputMix.master,1);assert.equal(migrated.outputMix.deckA,1);assert.equal(migrated.audioLanes[0].effects.reverb,0);assert.equal(migrated.audioLanes[0].regions[0].effects.filter,1);
 assert.equal(normalizeEffects({filter:NaN,delay:3,tone:-9}).delay,1);assert.equal(normalizeEffects({filter:NaN}).filter,1);assert.equal(normalizeOutputMix({master:-1,preview:NaN}).master,0);
 migrated.audioLanes[0].effects={...AUDIO_FX_PRESETS.radio.settings};migrated.audioLanes[0].regions[0].effects={...AUDIO_FX_PRESETS.ambience.settings};migrated.outputMix.master=.5;
 const restored=migrateProject(JSON.parse(JSON.stringify(migrated)));assert.deepEqual(restored.audioLanes,migrated.audioLanes);assert.equal(restored.outputMix.master,.5);
});
