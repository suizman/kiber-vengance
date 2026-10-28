import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMelodyPlan,
  compileMelody,
  expandCompactMelodyPlan,
} from "../dist/melody.js";
import { isInScale } from "../dist/core.js";
const plan = {
  title: "Scarlet Signal",
  motif: [0, 2, 4, 7, 5, 3, 2, 0],
  rhythm: "syncopated",
  contour: "rise",
  articulation: "short",
  energy: 0.8,
};
test("compact CPU plans validate categorical IDs and preserve model-selected notes", () => {
  assert.deepEqual(
    expandCompactMelodyPlan("[[0,2,4,7],3,1,0,8]", "Dark rise"),
    {
      title: "AI · Dark rise",
      motif: [0, 2, 4, 7],
      rhythm: "syncopated",
      contour: "rise",
      articulation: "short",
      energy: 0.8,
    },
  );
  for (const bad of [
    "[]",
    "[[0,2,4,7],9,1,0,8]",
    '[[0,2,4,7],3,1,0,"8"]',
    "[[0,2,-4,7],3,1,0,8]",
  ])
    assert.throws(() => expandCompactMelodyPlan(bad, "test"));
});
test("local model plans reject malformed output rather than inventing an AI result", () => {
  assert.deepEqual(parseMelodyPlan(JSON.stringify(plan)), plan);
  assert.deepEqual(
    parseMelodyPlan("<think>\n\n</think>\n" + JSON.stringify(plan)),
    plan,
  );
  for (const bad of [
    "<think>hi</think>",
    "{}",
    JSON.stringify({ ...plan, motif: [-1, 2, 4, 7] }),
    JSON.stringify({ ...plan, energy: 2 }),
    JSON.stringify({ ...plan, rhythm: "whatever" }),
  ])
    assert.throws(() => parseMelodyPlan(bad));
});
test("AI melody compilation respects keys, scales, meters, ranges and clip bounds", () => {
  for (const track of ["lead", "guitar", "bass", "pad"])
    for (const key of ["C", "D#", "B"])
      for (const scale of [
        "minor",
        "major",
        "phrygian",
        "dorian",
        "harmonicMinor",
      ])
        for (const stepsPerBar of [12, 16, 24])
          for (const bars of [1, 2, 4, 8]) {
            const target = {
              projectId: "p",
              clipId: "c",
              track,
              key,
              scale,
              stepsPerBar,
              tempo: 120,
            };
            const notes = compileMelody(plan, target, bars);
            assert.ok(notes.length > 0);
            assert.equal(new Set(notes.map((n) => n.id)).size, notes.length);
            for (const [index, note] of notes.entries()) {
              assert.ok(isInScale(note.pitch, key, scale));
              assert.ok(note.pitch >= 0 && note.pitch <= 127);
              assert.ok(
                note.step >= 0 &&
                  note.length > 0 &&
                  note.step + note.length <= bars * stepsPerBar,
              );
              assert.ok(note.velocity > 0 && note.velocity <= 1);
              if (index)
                assert.ok(
                  notes[index - 1].step + notes[index - 1].length <= note.step,
                );
            }
          }
});

import { createProject, makeNote, TRACK_META } from "../dist/core.js";
import {
  captureMusicalContext,
  composeMelody,
  compositionPrompt,
  replaceMelodyBars,
  DEFAULT_COMPOSITION,
  validateComposition,
} from "../dist/composer.js";
import { parseRecipeLibrary, recipeLibrary } from "../dist/recipes.js";
const target = {
  projectId: "p",
  clipId: "c",
  track: "lead",
  key: "C",
  scale: "minor",
  stepsPerBar: 16,
  tempo: 120,
};
const musical = (n) => n.map(({ id: _id, ...event }) => event);
const onset = (n) => n.step + n.offset;

test("composition controls enforce exact density, scale, register, leaps and playable timing in every meter", () => {
  for (const track of ["lead", "guitar", "bass", "pad"])
    for (const scale of [
      "minor",
      "major",
      "dorian",
      "phrygian",
      "harmonicMinor",
    ])
      for (const stepsPerBar of [12, 16, 24])
        for (const register of ["low", "middle", "high"])
          for (const maxLeap of [2, 7, 12]) {
            const options = {
              ...DEFAULT_COMPOSITION,
              register,
              maxLeap,
              density: 12,
            };
            const t = { ...target, track, scale, stepsPerBar, key: "B" };
            const notes = composeMelody(plan, t, 4, options, 7);
            assert.equal(notes.length, 48);
            const meta = TRACK_META[track],
              center =
                meta.low +
                (meta.high - meta.low) *
                  { low: 0.25, middle: 0.5, high: 0.75 }[register];
            for (const [i, note] of notes.entries()) {
              assert.ok(
                Number.isInteger(note.step),
                "the sequencer must be able to schedule every note",
              );
              assert.ok(note.offset >= -0.49 && note.offset <= 0.49);
              assert.ok(isInScale(note.pitch, t.key, scale));
              assert.ok(
                note.pitch >= meta.low &&
                  note.pitch <= meta.high &&
                  Math.abs(note.pitch - center) <= 12,
              );
              assert.ok(
                note.length > 0 &&
                  onset(note) + note.length <= stepsPerBar * 4 + 1e-8,
              );
              if (i) {
                assert.ok(Math.abs(note.pitch - notes[i - 1].pitch) <= maxLeap);
                assert.ok(
                  onset(notes[i - 1]) + notes[i - 1].length <=
                    onset(note) + 1e-8,
                );
              }
            }
          }
  assert.throws(() =>
    validateComposition({ ...DEFAULT_COMPOSITION, density: NaN }),
  );
  assert.throws(() => composeMelody(plan, target, 3, DEFAULT_COMPOSITION));
});

test("context snapshots are bounded and isolated; harmony influences strong beats", () => {
  const project = createProject();
  const source = project.clips.find((c) => c.id === project.activeClipIds.lead);
  const context = captureMusicalContext(project, "lead");
  assert.equal(context.source.name, source.name);
  assert.ok(
    context.voices.every((v) => v.track !== "lead" && v.track !== "drums"),
  );
  context.source.notes.length = 0;
  assert.ok(source.notes.length > 0);
  const reference = {
    ...target,
    context: {
      source: { name: "Source", track: "lead", bars: 1, notes: [] },
      voices: [{ track: "bass", bars: 1, notes: [makeNote(0, 43, 16)] }],
    },
  };
  const notes = composeMelody(
    plan,
    reference,
    4,
    { ...DEFAULT_COMPOSITION, maxLeap: 12 },
    4,
  );
  assert.equal(notes[0].pitch % 12, 7);
  assert.match(
    compositionPrompt(reference, DEFAULT_COMPOSITION),
    /Accompaniment pitch classes/,
  );
  assert.doesNotMatch(
    compositionPrompt(reference, { ...DEFAULT_COMPOSITION, context: false }),
    /Accompaniment pitch classes/,
  );
});

test("continuation and response depend on the selected source, preserve it and remain deterministic", () => {
  const context = {
    source: {
      name: "Phrase",
      track: "lead",
      bars: 1,
      notes: [
        makeNote(0, 72, 1),
        makeNote(4, 75, 1),
        makeNote(8, 79, 1),
        makeNote(12, 77, 1),
      ],
    },
    voices: [],
  };
  const t = { ...target, context },
    before = JSON.stringify(context);
  for (const mode of ["continue", "answer", "variation", "rhythm"]) {
    const options = {
      ...DEFAULT_COMPOSITION,
      mode,
      context: false,
      structure: "free",
      variation: 0,
      repetition: 100,
      maxLeap: 12,
    };
    const notes = composeMelody(
      { ...plan, rhythm: "steady", contour: "repeat" },
      t,
      2,
      options,
      4,
    );
    assert.deepEqual(
      musical(notes),
      musical(
        composeMelody(
          { ...plan, rhythm: "steady", contour: "repeat" },
          t,
          2,
          options,
          4,
        ),
      ),
    );
    assert.equal(JSON.stringify(context), before);
    if (mode === "variation" || mode === "rhythm")
      assert.deepEqual(
        notes.slice(0, 4).map((n) => n.pitch),
        [72, 75, 79, 77],
      );
    if (mode === "continue") assert.ok(Math.abs(notes[0].pitch - 77) <= 12);
  }
  assert.throws(
    () =>
      composeMelody(plan, target, 4, {
        ...DEFAULT_COMPOSITION,
        mode: "continue",
      }),
    /no notes/,
  );
});

test("phrase endings resolve, variants differ and shaping is cheap without another inference", () => {
  const settings = { ...DEFAULT_COMPOSITION, maxLeap: 12 };
  const a = composeMelody(plan, target, 4, settings, 4),
    b = composeMelody(plan, target, 4, settings, 5);
  assert.equal(a.at(-1).pitch % 12, 0);
  assert.notDeepEqual(musical(a), musical(b));
  const loop = composeMelody(
    plan,
    target,
    4,
    { ...settings, structure: "loop" },
    4,
  );
  assert.equal(loop.at(-1).pitch % 12, loop[0].pitch % 12);
  const start = globalThis.performance.now();
  for (let i = 0; i < 100; i++) composeMelody(plan, target, 8, settings, i);
  assert.ok(
    globalThis.performance.now() - start < 1000,
    "100 full phrases should take less than one second",
  );
});

test("regenerating selected bars preserves protected events exactly and connects both boundaries", () => {
  const options = { ...DEFAULT_COMPOSITION, maxLeap: 2, density: 8 };
  const original = composeMelody(plan, target, 4, options, 4),
    replacement = composeMelody(
      { ...plan, motif: [7, 4, 2, 0] },
      target,
      4,
      options,
      31,
    );
  const before = JSON.stringify(original);
  for (const selected of [[0], [1], [2], [3], [1, 2], [0, 3]]) {
    const next = replaceMelodyBars(
      original,
      replacement,
      selected,
      target,
      options,
    );
    assert.deepEqual(
      next.filter((n) => !selected.includes(Math.floor(n.step / 16))),
      original.filter((n) => !selected.includes(Math.floor(n.step / 16))),
    );
    for (let i = 1; i < next.length; i++) {
      assert.ok(Math.abs(next[i].pitch - next[i - 1].pitch) <= 2);
      assert.ok(
        onset(next[i - 1]) + next[i - 1].length <= onset(next[i]) + 1e-8,
      );
    }
    assert.equal(JSON.stringify(original), before);
  }
});

test("personal recipes validate persisted controls and reject invalid libraries without retaining project context", () => {
  const recipe = {
    kind: "melody",
    id: "saved",
    name: "My idea",
    tags: [],
    style: "synthwave",
    rhythm: "steady",
    tempo: 120,
    bars: 4,
    key: "C",
    scale: "minor",
    prompt: "A dark motif",
  };
  const input = recipeLibrary([
    {
      recipe,
      composition: { ...DEFAULT_COMPOSITION, context: true },
      favorite: true,
      projectSecret: "discard",
    },
  ]);
  const parsed = parseRecipeLibrary(JSON.parse(JSON.stringify(input)));
  assert.equal(parsed[0].favorite, true);
  assert.equal(parsed[0].composition.context, true);
  assert.equal("projectSecret" in parsed[0], false);
  for (const invalid of [
    { ...input, version: 2 },
    recipeLibrary([
      {
        ...input.recipes[0],
        composition: { ...DEFAULT_COMPOSITION, maxLeap: 99 },
      },
    ]),
    recipeLibrary([input.recipes[0], input.recipes[0]]),
  ])
    assert.throws(() => parseRecipeLibrary(invalid));
});

test("generated timing survives v6 persistence and sources with early microtiming stay inside the clip", async () => {
  const { migrateProject } = await import("../dist/core.js");
  const project = createProject(),
    clip = project.clips.find((c) => c.id === project.activeClipIds.lead);
  const t = {
    ...target,
    projectId: project.id,
    clipId: clip.id,
    stepsPerBar: 12,
  };
  const notes = composeMelody(
    { ...plan, rhythm: "steady" },
    t,
    4,
    { ...DEFAULT_COMPOSITION, density: 8 },
    5,
  );
  clip.notes = notes;
  clip.bars = 4;
  clip.stepsPerBar = 12;
  const restored = migrateProject(
    JSON.parse(JSON.stringify(project)),
  ).clips.find((c) => c.id === clip.id);
  assert.deepEqual(restored.notes, notes);
  const context = {
    source: {
      track: "lead",
      name: "Early",
      bars: 1,
      notes: [makeNote(0, 72, 1, 0.8, -0.2), makeNote(4, 75, 1, 0.8, -0.2)],
    },
    voices: [],
  };
  const varied = composeMelody(
    plan,
    { ...target, context },
    2,
    { ...DEFAULT_COMPOSITION, mode: "variation" },
    3,
  );
  assert.ok(varied.every((n) => onset(n) >= 0 && onset(n) + n.length <= 32));
});

test("automatic-density variations keep silent bars and exact duplicate alternatives are omitted", async () => {
  const { composeAlternatives } = await import("../dist/composer.js");
  const context = {
    source: {
      track: "lead",
      name: "With rests",
      bars: 2,
      notes: [
        makeNote(0, 72, 1),
        makeNote(4, 75, 1),
        makeNote(8, 79, 1),
        makeNote(12, 77, 1),
      ],
    },
    voices: [],
  };
  const options = {
    ...DEFAULT_COMPOSITION,
    mode: "variation",
    structure: "free",
    context: false,
    variation: 0,
    repetition: 100,
    maxLeap: 12,
  };
  const proposals = composeAlternatives(
    plan,
    { ...target, context },
    4,
    options,
    1,
  );
  assert.equal(proposals.length, 1);
  assert.ok(proposals[0].notes.every((n) => Math.floor(n.step / 16) % 2 === 0));
});


test("composer preserves octave degrees instead of reducing the motif to pitch classes", () => {
  const settings = {...DEFAULT_COMPOSITION, density:4, variation:0, repetition:0, maxLeap:12, context:false, structure:"free"};
  const flat = composeMelody({...plan,motif:[0,0,0,0],contour:"flat"},target,1,settings,1);
  const octaves = composeMelody({...plan,motif:[0,7,0,7],contour:"flat"},target,1,settings,1);
  assert.notDeepEqual(octaves.map(n=>n.pitch),flat.map(n=>n.pitch));
  assert.equal(Math.abs(octaves[1].pitch-octaves[0].pitch),12);
});

test('quality selection retains diverse unique proposals without changing their notes', async()=>{
  const {selectDiverseMelodies}=await import('../dist/composer.js');
  const settings={...DEFAULT_COMPOSITION,density:8};
  const a={notes:composeMelody(plan,target,4,settings,1)};
  const b={notes:composeMelody({...plan,motif:[7,6,4,2]},target,4,settings,7)};
  const c={notes:composeMelody({...plan,rhythm:'sparse'},target,4,settings,11)};
  const frozen=JSON.stringify([a,b,c]);
  const result=selectDiverseMelodies([a,a,b,c],3);
  assert.equal(result.length,3);assert.equal(new Set(result).size,3);
  assert.equal(JSON.stringify([a,b,c]),frozen);
});
