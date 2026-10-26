import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMelodyPlan,compileMelody,expandCompactMelodyPlan} from '../dist/melody.js';
import {isInScale} from '../dist/core.js';
const plan={title:'Scarlet Signal',motif:[0,2,4,7,5,3,2,0],rhythm:'syncopated',contour:'rise',articulation:'short',energy:.8};
test('compact CPU plans validate categorical IDs and preserve model-selected notes',()=>{
  assert.deepEqual(expandCompactMelodyPlan('[[0,2,4,7],3,1,0,8]','Dark rise'),{title:'AI · Dark rise',motif:[0,2,4,7],rhythm:'syncopated',contour:'rise',articulation:'short',energy:.8});
  for(const bad of ['[]','[[0,2,4,7],9,1,0,8]','[[0,2,4,7],3,1,0,"8"]','[[0,2,-4,7],3,1,0,8]'])assert.throws(()=>expandCompactMelodyPlan(bad,'test'));
});
test('local model plans reject malformed output rather than inventing an AI result',()=>{
  assert.deepEqual(parseMelodyPlan(JSON.stringify(plan)),plan);
  assert.deepEqual(parseMelodyPlan('<think>\n\n</think>\n'+JSON.stringify(plan)),plan);
  for(const bad of ['<think>hi</think>','{}',JSON.stringify({...plan,motif:[-1,2,4,7]}),JSON.stringify({...plan,energy:2}),JSON.stringify({...plan,rhythm:'whatever'})]) assert.throws(()=>parseMelodyPlan(bad));
});
test('AI melody compilation respects keys, scales, meters, ranges and clip bounds',()=>{
  for(const track of ['lead','guitar','bass','pad'])for(const key of ['C','D#','B'])for(const scale of ['minor','major','phrygian','dorian','harmonicMinor'])for(const stepsPerBar of [12,16,24])for(const bars of [1,2,4,8]){
    const target={projectId:'p',clipId:'c',track,key,scale,stepsPerBar,tempo:120};
    const notes=compileMelody(plan,target,bars);
    assert.ok(notes.length>0);assert.equal(new Set(notes.map(n=>n.id)).size,notes.length);
    for(const [index,note] of notes.entries()){
      assert.ok(isInScale(note.pitch,key,scale));assert.ok(note.pitch>=0&&note.pitch<=127);
      assert.ok(note.step>=0&&note.length>0&&note.step+note.length<=bars*stepsPerBar);
      assert.ok(note.velocity>0&&note.velocity<=1);
      if(index)assert.ok(notes[index-1].step+notes[index-1].length<=note.step);
    }
  }
});
