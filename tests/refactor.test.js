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
