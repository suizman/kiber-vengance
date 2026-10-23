import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_VERSION, TRACKS, createProject, createEmptyProject, migrateProject, activeClip, clipsForTrack, createClip, meterSteps, setProjectMeter,
  makeNote, toggleNote, duplicateClip, deleteClip, varyClip, resizeClip, quantizeClip, automationValue, notesAtStep,
  generateClip, generateBacking, sceneLengthSteps, playbackEvents, encodeMidi, addArrangementScene, duplicateArrangementScene,
  moveArrangementScene, removeArrangementScene, distributeArrangementPatterns, isInScale, History
} from '../dist/core.js';
import { AudioEngine } from '../dist/audio.js';

test('v4 demo is a complete serializable multi-clip song with per-clip character', () => {
  const p=createProject();
  assert.equal(p.version,PROJECT_VERSION);
  assert.deepEqual(Object.keys(p.activeClipIds),TRACKS);
  assert.equal(p.clips.length,10);
  assert.ok(p.arrangement.every(s=>TRACKS.every(t=>s.clipIds[t])));
  assert.ok(playbackEvents(p,{song:true}).durationSteps>64);
  assert.equal(JSON.parse(JSON.stringify(p)).title,'Chrome Requiem');
  assert.ok(p.clips.every(c=>c.character?.arp&&c.character?.lfo&&c.character?.fx&&c.character?.macros));
});

test('empty projects and musical meters retain a complete five-track structure', () => {
  const empty=createEmptyProject();assert.equal(empty.clips.length,5);assert.ok(empty.clips.every(c=>c.notes.length===0));assert.equal(empty.arrangement.length,1);
  const p=createProject(),before=activeClip(p,'lead').notes[1].step;setProjectMeter(p,3,4);assert.equal(meterSteps(p.meter),12);assert.ok(p.clips.every(c=>c.stepsPerBar===12));assert.equal(activeClip(p,'lead').notes[1].step,Math.round(before*.75*4)/4);
  const midi=encodeMidi(p);assert.ok([...midi].some((byte,index,all)=>byte===0xff&&all[index+1]===0x58&&all[index+3]===3&&all[index+4]===2));
});

test('legacy v2 patterns migrate into independent per-track clips', () => {
  const legacy={version:2,title:'Legacy Signal',tempo:118,macros:{energy:.4},tracks:{lead:{drive:.7}},patterns:[{id:'p1',name:'Old Pattern',bars:2,notes:{lead:[{step:0,pitch:60,length:2,velocity:.8}],bass:[],pad:[],drums:[]}}],activePatternId:'p1',arrangement:[{id:'s1',name:'INTRO',patternId:'p1',repeats:2}]};
  const p=migrateProject(legacy);
  assert.equal(p.version,4);
  assert.equal(p.clips.length,5);
  assert.equal(activeClip(p,'lead').notes[0].pitch,60);
  assert.equal(activeClip(p,'lead').character.fx.distortion,.7);
  assert.equal(activeClip(p,'lead').character.macros.energy,.4);
  assert.ok(TRACKS.every(t=>p.arrangement[0].clipIds[t]));
});

test('v3 track character migrates into every existing clip without losing its sound',()=>{
  const legacy=createProject();legacy.version=3;legacy.macros={energy:.21,darkness:.32,tension:.43,aggression:.54,space:.65,complexity:.76};legacy.tracks.lead.arp={enabled:true,mode:'down',octaves:3,rate:2};legacy.tracks.lead.lfo={enabled:true,target:'pitch',rate:7,depth:.4};legacy.tracks.lead.fx={bypass:false,distortion:.81,saturation:.7,chorus:.2,delay:.3,reverb:.4,tone:.5};legacy.clips.forEach(c=>delete c.character);
  const migrated=migrateProject(JSON.parse(JSON.stringify(legacy))),lead=clipsForTrack(migrated,'lead');assert.equal(migrated.version,4);assert.ok(lead.every(c=>c.character.arp.mode==='down'&&c.character.fx.distortion===.81&&c.character.macros.space===.65));assert.equal(migrated.macros,undefined);assert.equal(migrated.tracks.lead.fx,undefined);
});

test('clip editing covers toggling, duplication, resizing and quantization', () => {
  const p=createProject(),c=activeClip(p,'lead'),before=c.notes.length;
  assert.equal(toggleNote(c,2,61,.9,2),true);
  assert.equal(c.notes.length,before+1);
  assert.equal(toggleNote(c,2,61),false);
  const copy=duplicateClip(p,c.id);assert.notEqual(copy.id,c.id);assert.equal(copy.track,'lead');
  copy.character.fx.delay=.99;assert.notEqual(c.character.fx.delay,.99);
  copy.notes.push(makeNote(31.7,70,8,.8));resizeClip(copy,2);quantizeClip(copy,1);
  assert.ok(copy.notes.every(n=>Number.isInteger(n.step)&&n.step+n.length<=32));
  const variation=varyClip(p,c,.8);assert.ok(variation.notes.length>c.notes.length);
});

test('clip deletion reassigns arrangement references and protects the last track clip',()=>{
  const p=createProject(),target=activeClip(p,'guitar'),replacement=clipsForTrack(p,'guitar').find(c=>c.id!==target.id);p.arrangement.forEach(scene=>scene.clipIds.guitar=target.id);const before=p.clips.length;
  assert.equal(deleteClip(p,target.id)?.id,replacement.id);assert.equal(p.clips.length,before-1);assert.equal(p.activeClipIds.guitar,replacement.id);assert.ok(p.arrangement.every(scene=>scene.clipIds.guitar===replacement.id));assert.equal(deleteClip(p,replacement.id),null);assert.equal(clipsForTrack(p,'guitar').length,1);
});

test('automation interpolates between editable points', () => {
  const c=createClip('lead','Automation',2);c.automation.cutoff={0:.2,8:.8,16:.4};
  assert.equal(automationValue(c,'cutoff',0),.2);
  assert.ok(Math.abs(automationValue(c,'cutoff',4)-.5)<.001);
  assert.equal(automationValue(c,'cutoff',20),.4);
});

test('free timing and expressive note data survive playback and MIDI export', () => {
  const p=createEmptyProject(),c=activeClip(p,'lead'),note=makeNote(4,64,1.375,.72,.183,{pressure:.91,timbre:.77,bend:1.25});c.notes.push(note);
  const event=playbackEvents(p,{song:false}).events.find(e=>e.track==='lead');assert.ok(Math.abs(event.step-4.183)<.0001);assert.equal(event.basePitch,64);assert.equal(event.pitch,65.25);assert.equal(event.expression.timbre,.77);
  const midi=encodeMidi(p,{song:false});assert.ok([...midi].some(byte=>(byte&0xf0)===0xe0));assert.ok([...midi].some(byte=>(byte&0xf0)===0xd0));assert.ok([...midi].some((byte,index,all)=>(byte&0xf0)===0xb0&&all[index+1]===74));
  const restored=migrateProject(JSON.parse(JSON.stringify(p))),restoredNote=activeClip(restored,'lead').notes[0];assert.equal(restoredNote.offset,.183);assert.equal(restoredNote.expression.bend,1.25);
});

test('every clip has an independent serializable character and saturation stage',()=>{const p=createProject(),first=p.clips[0],second=p.clips[1];assert.ok(p.clips.every(clip=>Number.isFinite(clip.character.fx.saturation)));first.character.macros.space=.99;assert.notEqual(second.character.macros.space,.99);const e=new AudioEngine(),curve=e.saturationCurve(.65);assert.equal(curve.length,256);assert.ok(curve[200]<1)});

test('harmonic helpers and generators stay in the selected scale', () => {
  const p=createProject(),c=createClip('lead','Generated',4);generateClip(p,c,'riff',.8);
  assert.ok(c.notes.length>8);
  assert.ok(c.notes.every(n=>isInScale(n.pitch,p.key,p.scale)));
  generateClip(p,c,'chords',.6);assert.ok(c.notes.some(n=>n.length===16));
  const drums=createClip('drums','Generated Beat',2);generateClip(p,drums,'drums',.8);assert.ok(drums.notes.some(n=>n.pitch===0));
});

test('backing generator builds structured accompaniment and preserves guitar material',()=>{
  const p=createProject(),guitarId=p.activeClipIds.guitar,guitarNotes=activeClip(p,'guitar').notes.length,before=p.clips.length,scenes=generateBacking(p,{sections:4,intensity:.8,style:'driving'});
  assert.equal(scenes.length,4);assert.equal(p.arrangement.length,4);assert.ok(p.clips.length>=before+12);assert.equal(p.activeClipIds.guitar,guitarId);assert.equal(activeClip(p,'guitar').notes.length,guitarNotes);assert.ok(scenes.every(scene=>['bass','pad','drums'].every(track=>p.clips.find(c=>c.id===scene.clipIds[track])?.notes.length)));
});

test('arpeggiator expands held chords deterministically', () => {
  const p=createProject(),c=createClip('lead','Chord',1);c.notes=[makeNote(0,60,16,.8),makeNote(0,64,16,.8),makeNote(0,67,16,.8)];p.clips.push(c);p.activeClipIds.lead=c.id;c.character.arp={enabled:true,mode:'updown',octaves:2,rate:1};
  const sequence=Array.from({length:8},(_,s)=>notesAtStep(p,c,'lead',s)[0].pitch);
  assert.deepEqual(sequence.slice(0,4),[60,64,67,72]);
  assert.equal(sequence.length,8);
});

test('full-song playback flattens scenes and loops independent clip lengths', () => {
  const p=createProject(),{events,durationSteps}=playbackEvents(p,{song:true}),expected=p.arrangement.reduce((sum,s)=>sum+sceneLengthSteps(p,s)*s.repeats,0);
  assert.equal(durationSteps,expected);
  assert.ok(events.some(e=>e.step>=64));
  assert.ok(TRACKS.every(t=>events.some(e=>e.track===t)));
  assert.ok(events.every(e=>e.clipId&&Number.isFinite(e.localStep)));
});

test('MIDI export is format 1 with tempo plus five musical tracks', () => {
  const midi=encodeMidi(createProject(),{song:true}),view=new DataView(midi.buffer,midi.byteOffset,midi.byteLength);
  assert.equal(new TextDecoder().decode(midi.slice(0,4)),'MThd');
  assert.equal(view.getUint16(8),1);
  assert.equal(view.getUint16(10),6);
  assert.ok(midi.length>500);
});

test('arrangement editing alternates and distributes clips per track', () => {
  const p=createProject(),before=p.arrangement.length,added=addArrangementScene(p);
  assert.equal(p.arrangement.length,before+1);assert.ok(TRACKS.every(t=>added.clipIds[t]));
  const dup=duplicateArrangementScene(p,p.arrangement.length-1);assert.ok(moveArrangementScene(p,p.arrangement.length-1,0));assert.equal(p.arrangement[0].id,dup.id);assert.ok(removeArrangementScene(p,0));
  p.arrangement.forEach(s=>TRACKS.forEach(t=>s.clipIds[t]=clipsForTrack(p,t)[0].id));assert.ok(distributeArrangementPatterns(p));assert.equal(p.arrangement[1].clipIds.lead,clipsForTrack(p,'lead')[1].id);
});

test('history preserves deep undo and redo states', () => {const h=new History(),a={clips:[{notes:[1]}]},b={clips:[{notes:[1,2]}]};h.push(a);assert.deepEqual(h.undo(b),a);assert.deepEqual(h.redo(a),b)});

test('scheduler drops stale time and survives a ten-minute controlled-clock soak', () => {
  const e=new AudioEngine();e.ctx={currentTime:0};e.project=createProject();e.playing=true;e.nextTime=0;e.scheduleMusicStep=()=>{};e.advanceTransport=()=>e.position++;e.click=()=>{};
  for(let second=0;second<600;second++){e.ctx.currentTime=second;e.schedule();assert.ok(e.nextTime>=second-.1);}
  e.ctx.currentTime=1000;e.nextTime=0;e.schedule();assert.ok(e.nextTime>=1000);assert.ok(e.position>0);
});

test('solo schedules only the isolated instrument',()=>{const p=createProject();p.tracks.guitar.solo=true;const heard=[];const e=new AudioEngine();e.ctx={currentTime:0};e.project=p;e.position=0;e.songMode=false;e.metronome=false;e.voice=track=>heard.push(track);e.drum=()=>heard.push('drums');e.scheduleMusicStep(0);assert.ok(heard.length>0);assert.deepEqual([...new Set(heard)],['guitar'])});

test('diagnostics keep the effects graph at exactly five persistent buses', () => {const e=new AudioEngine();e.buses={lead:{},guitar:{},bass:{},pad:{},drums:{}};assert.equal(e.diagnostics().effectBuses,5)});

test('metronome emits accented bar clicks while music is scheduled', () => {const p=createProject();TRACKS.forEach(t=>p.tracks[t].mute=true);const e=new AudioEngine();e.project=p;e.position=0;e.songMode=false;e.metronome=true;let accents=[];e.click=(_time,accent)=>accents.push(accent);e.scheduleMusicStep(0);e.position=4;e.scheduleMusicStep(.1);assert.deepEqual(accents,[true,false])});
