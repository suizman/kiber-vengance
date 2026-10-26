import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePresetCatalog, validateSoundPreset, buildPresetClip, commitPresetClip, enrichMelodyPrompt, enforceMelodyChoices, fetchPresetCatalog } from '../dist/presets.js';
import { createProject, activeClip, makeNote, History, tempoAtStep } from '../dist/core.js';
import { compileMelody } from '../dist/melody.js';

const factory=JSON.parse(readFileSync(new URL('../public/presets/catalog-v1.json',import.meta.url),'utf8'));
test('factory melody recipes and sound patches validate; incompatible and malformed banks fail',()=>{
  const presets=parsePresetCatalog(factory);
  assert.equal(presets.filter(p=>p.kind==='melody').length,9);
  assert.equal(presets.filter(p=>p.kind==='sound').length,6);
  for(const bank of [{}, {...factory,version:2}, {...factory,presets:[factory.presets[0],factory.presets[0]]}, {...factory,presets:[{...factory.presets[0],tempo:Infinity}]}, {...factory,presets:[{...factory.presets[0],bars:'4'}]}, {...factory,presets:[{...factory.presets[0],scale:'__proto__'}]}, {...factory,presets:Array(257).fill(factory.presets[0])}]) assert.throws(()=>parsePresetCatalog(bank));
  const sound=presets.find(p=>p.kind==='sound');
  const legacy=parsePresetCatalog({format:'kiber-vengance-preset-bank',version:1,presets:[{...sound,kind:undefined,instrument:{...sound.instrument,volume:0,pan:1,mute:true}}]})[0];
  assert.equal(legacy.name,sound.name);assert.equal(legacy.instrument.volume,undefined);assert.equal(legacy.instrument.mute,undefined);
  assert.throws(()=>validateSoundPreset({...sound,instrument:{wave:'custom'}}));
  assert.throws(()=>validateSoundPreset({...sound,character:{fx:{bypass:'yes'}}}));
});
test('explicit rhythm controls the grid and style and tempo enrich the local prompt',()=>{
  const prompt=enrichMelodyPrompt('Rising hook','synthwave','syncopated',128);
  assert.match(prompt,/Rising hook/);assert.match(prompt,/retro synthwave/);assert.match(prompt,/128 BPM/);assert.match(prompt,/syncopated/);
  const plan={title:'Hook',motif:[0,2,4,7],rhythm:'sparse',contour:'rise',articulation:'short',energy:.8};
  const target={projectId:'p',clipId:'c',track:'lead',key:'D',scale:'minor',stepsPerBar:16,tempo:128};
  assert.deepEqual(enforceMelodyChoices(plan,'auto'),plan);
  const sparse=compileMelody(plan,target,4), driving=compileMelody(enforceMelodyChoices(plan,'driving'),target,4);
  assert.ok(driving.length>sparse.length);assert.equal(driving[1].step,2);
});
test('preset clips preserve existing sounds and mixer, and optional base tempo is undoable',()=>{
  const project=createProject(),source=activeClip(project,'lead');
  const target={projectId:project.id,clipId:source.id,track:'lead',key:'D',scale:'minor',stepsPerBar:source.stepsPerBar,tempo:120};
  const before=globalThis.structuredClone(project),sound=parsePresetCatalog(factory).find(p=>p.kind==='sound'&&p.track==='lead');
  const generated=buildPresetClip(project,target,'New melody',4,[makeNote(0,60,2)],{sound});
  assert.deepEqual(project,before);assert.deepEqual(generated.instrument,sound.instrument);assert.notEqual(generated.instrument,sound.instrument);
  commitPresetClip(project,generated);assert.equal(project.tempo,before.tempo);assert.deepEqual(project.tempoMap,before.tempoMap);assert.deepEqual(project.tracks,before.tracks);assert.deepEqual(project.clips.slice(0,-1),before.clips);
  project.tempoMap.push({id:'later',step:64,bpm:160,curve:'jump'});
  const history=new History(),previous=globalThis.structuredClone(project);history.push(project);
  commitPresetClip(project,buildPresetClip(project,target,'Tempo clip',2,[]),124);
  assert.equal(project.tempo,124);assert.equal(tempoAtStep(project,0),124);assert.equal(project.tempoMap.at(-1).bpm,160);
  const undone=history.undo(project);assert.deepEqual(undone,previous);assert.equal(history.redo(undone).tempo,124);
  assert.throws(()=>buildPresetClip(project,{...target,projectId:'other'},'Invalid',4,[]));
  assert.throws(()=>buildPresetClip(project,target,'Invalid',4,[],{sound:{...sound,track:'bass'}}));
});
test('catalog fetching rejects non-HTTPS URLs before making a request',async()=>{
  await assert.rejects(fetchPresetCatalog('http://example.com/bank.json'),/HTTPS/);
  await assert.rejects(fetchPresetCatalog('file:///tmp/bank.json'),/HTTPS/);
});
