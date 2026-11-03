import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseScore, insertScore, scoreMusicXml} from '../dist/scores.js';
import {createEmptyProject,createProject,migrateProject,activeClip,playbackEvents,projectAssets,encodeMidi,History} from '../dist/core.js';
const file = async name => new Uint8Array(await readFile(new URL('./fixtures/scores/'+name,import.meta.url)));
const source = {id:'fixture',assetId:'original',reviewAssetId:'review',musicXmlAssetId:'xml',name:'fixture.musicxml',format:'MusicXML',partTracks:[]};
const notes = score => score.sections.flatMap(section=>section.parts.flatMap(part=>part.notes));
test('MusicXML, compressed MXL and GP7 retain every staff, repeat, meter and sounding pitch', async()=>{
 for(const extension of ['musicxml','mxl','gp']){
  const score=parseScore(await file('voices-tempo-transposition.'+extension),'fixture.'+extension),section=score.sections[0];
  assert.equal(section.parts.length,2);assert.equal(section.parts[0].staves,2);assert.equal(notes(score).length,18);
  assert.equal(section.durationSteps,56);assert.deepEqual(section.tempos.map(event=>[event.step,event.bpm]),[[0,120],[16,90],[28,120],[44,90]]);
  assert.equal(section.parts[1].notes[0].pitch,70);assert.ok(section.parts[0].notes.some(note=>note.staff===2&&note.pitch===48));
 }
});
test('MIDI formats 0 and 2 retain overlapping attacks, program assignments and independent sequences',async()=>{
 const overlapping=parseScore(await file('format-0-overlapping-notes.mid'),'input.mid');assert.equal(notes(overlapping).length,3);assert.deepEqual(overlapping.sections[0].parts.map(part=>part.program),[0,71]);assert.equal(overlapping.sections[0].parts[0].notes[1].step,1);
 const independent=parseScore(await file('format-2-independent-sequences.mid'),'input.mid');assert.equal(independent.sections.length,2);assert.deepEqual(independent.sections.map(section=>section.tempos[0].bpm),[120,60]);
 const project=createEmptyProject();insertScore(project,independent,source);assert.equal(playbackEvents(project).durationSteps,32);assert.deepEqual(playbackEvents(project).events.map(note=>note.step),[0,16]);
});
test('ABC tempo changes are applied once and repeated voices keep their fractional score positions',async()=>{
 const score=parseScore(await file('polyphony-tempo-repeat.abc'),'fixture.abc');assert.equal(notes(score).length,26);assert.equal(score.sections[0].durationSteps,64);assert.deepEqual(score.sections[0].tempos.map(event=>event.step),[0,16,32,48]);assert.deepEqual(score.sections[0].parts[0].notes.filter(note=>note.pitch===67).map(note=>note.step),[16,48]);
 const triplet=parseScore(new TextEncoder().encode('X:1\nT:Tuplet\nM:4/4\nL:1/4\nK:C\n(3CDE F2|'),'triplet.abc');assert.ok(Math.abs(triplet.sections[0].parts[0].notes[1].step-8/3)<.0001);
});
test('corrected MusicXML round-trip retains all parts, chords, timings and ties',async()=>{
 const score=parseScore(await file('voices-tempo-transposition.musicxml'),'fixture.xml');const xml=scoreMusicXml(score);const result=parseScore(new TextEncoder().encode(xml),'corrected.musicxml');
 const signature=value=>notes(value).map(note=>[note.pitch,+note.step.toFixed(4),+note.length.toFixed(4),note.staff]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 assert.deepEqual(signature(result),signature(score));assert.equal(result.sections[0].parts.length,2);
});
test('score insertion is one reversible edit, adds no music to older scenes and retains binary asset references',async()=>{
 const score=parseScore(await file('voices-tempo-transposition.musicxml'),'fixture.xml'),project=createProject(),before=structuredClone(project),history=new History();const original=playbackEvents(project).events;
 history.push(project);const tracks=insertScore(project,score,source);history.finish(project);assert.equal(tracks.length,2);assert.deepEqual(playbackEvents(project).events.slice(0,original.length),original);assert.deepEqual(projectAssets(project).filter(asset=>['original','review','xml'].includes(asset.id)).map(asset=>asset.id),['original','review','xml']);assert.deepEqual(history.undo(project),before);assert.equal(history.redo(before).tracks[tracks[0]].kind,'gm');
 const migrated=migrateProject(project);assert.equal(migrated.version,7);assert.equal(activeClip(migrated,tracks[0]).notes.length,14);assert.equal(migrated.arrangement[0].clipIds[tracks[0]],undefined);
});
test('successive pages reuse matching instruments and export more than sixteen parts without invalid MIDI channels',async()=>{
 const score=parseScore(await file('voices-tempo-transposition.musicxml'),'fixture.xml');score.sections.push(structuredClone(score.sections[0]));score.sections[1].id='page-2';const p=createEmptyProject();const ids=insertScore(p,score,source);assert.equal(ids.length,2);assert.equal(playbackEvents(p).events.length,36);
 const many=structuredClone(score);many.sections= [many.sections[0]];many.sections[0].parts=Array.from({length:20},(_,index)=>({...structuredClone(many.sections[0].parts[1]),id:'part-'+index,name:'Part '+index}));const big=createEmptyProject();insertScore(big,many,source);const midi=parseScore(encodeMidi(big),'export.mid');assert.equal(notes(midi).length,80);assert.equal(midi.sections[0].parts.length,20);
});
test('malformed files fail without changing a project',()=>{assert.throws(()=>parseScore(new TextEncoder().encode('<broken>'),'broken.xml'));assert.throws(()=>migrateProject({version:999,clips:[]}));});

test('corrected percussion MusicXML retains drum keys and multi-clip MIDI retains programs',async()=>{
 const document=parseScore(await file('format-0-overlapping-notes.mid'),'fixture.mid');const section=document.sections[0];section.parts=[section.parts[0]];const part=section.parts[0];part.percussion=true;part.notes=part.notes.map((note,index)=>({...note,pitch:[36,42,38][index]}));
 const roundtrip=parseScore(new TextEncoder().encode(scoreMusicXml(document)),'drums.musicxml');assert.deepEqual(notes(roundtrip).map(n=>n.pitch),notes(document).map(n=>n.pitch));
 const p=createEmptyProject();insertScore(p,document,source);const first=p.clips.find(c=>c.track.startsWith('part-'));first.instrument.percussion=false;first.instrument.program=0;const second=structuredClone(first);second.id='second';second.instrument.program=40;p.clips.push(second);p.arrangement.push({id:'next',name:'Next',repeats:1,clipIds:{[first.track]:second.id}});
 const midi=parseScore(encodeMidi(p),'programs.mid');assert.deepEqual(midi.sections[0].parts.map(part=>part.program),[0,40]);
});
