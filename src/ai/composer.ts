import { KEYS, SCALES, TRACK_META, makeNote } from "../core";
import type { NoteEvent, Project, TrackId } from "../model";
import type { MelodyPlan, MelodyTarget } from "./melody";

export type ComposeMode =
  "new" | "continue" | "answer" | "variation" | "rhythm";
export interface CompositionOptions {
  mode: ComposeMode;
  context: boolean;
  structure: "phrase" | "loop" | "free";
  density: number; // 0 follows the plan; otherwise exact onsets per bar.
  register: "low" | "middle" | "high";
  maxLeap: number; // Semitones, including the transition from the source.
  repetition: number;
  variation: number;
}
export const DEFAULT_COMPOSITION: CompositionOptions = {
  mode: "new",
  context: true,
  structure: "phrase",
  density: 0,
  register: "middle",
  maxLeap: 7,
  repetition: 65,
  variation: 35,
};
export interface ContextVoice {
  track: Exclude<TrackId, "drums">;
  bars: number;
  notes: NoteEvent[];
}
export interface MusicalContext {
  source: ContextVoice & { name: string };
  voices: ContextVoice[];
}

/** Only active musical clips, never audio blobs, titles from other projects or a whole song. */
export function captureMusicalContext(
  project: Project,
  track: Exclude<TrackId, "drums">,
): MusicalContext {
  const source = project.clips.find(
    (c) => c.id === project.activeClipIds[track] && c.track === track,
  );
  if (!source) throw new Error("Select a clip first.");
  const voices: ContextVoice[] = [];
  for (const id of ["bass", "pad", "guitar", "lead"] as const) {
    if (id === track) continue;
    const clip = project.clips.find(
      (c) => c.id === project.activeClipIds[id] && c.track === id,
    );
    if (clip?.notes.length)
      voices.push({
        track: id,
        bars: clip.bars,
        notes: structuredClone(clip.notes.slice(0, 512)),
      });
  }
  return {
    source: {
      track,
      name: source.name,
      bars: source.bars,
      notes: structuredClone(source.notes.slice(0, 512)),
    },
    voices,
  };
}

export function validateComposition(value: unknown): CompositionOptions {
  const v = value as CompositionOptions;
  if (
    !v ||
    !["new", "continue", "answer", "variation", "rhythm"].includes(v.mode) ||
    typeof v.context !== "boolean" ||
    !["phrase", "loop", "free"].includes(v.structure) ||
    ![0, 2, 4, 8, 12].includes(v.density) ||
    !["low", "middle", "high"].includes(v.register) ||
    ![2, 5, 7, 12].includes(v.maxLeap) ||
    ![v.repetition, v.variation].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 100,
    )
  )
    throw new Error("Invalid composition settings.");
  return {
    mode: v.mode,
    context: v.context,
    structure: v.structure,
    density: v.density,
    register: v.register,
    maxLeap: v.maxLeap,
    repetition: v.repetition,
    variation: v.variation,
  };
}

const pc = (n: number) => ((n % 12) + 12) % 12;
function sourceLine(target: MelodyTarget): NoteEvent[] {
  const sorted = (target.context?.source.notes ?? [])
    .map((n) => (n.step + n.offset < 0 ? { ...n, step: 0, offset: 0 } : n))
    .sort(
      (a, b) => a.step + a.offset - (b.step + b.offset) || b.pitch - a.pitch,
    );
  // A polyphonic source contributes its top melody; the source itself is untouched.
  return sorted.filter(
    (n, i) =>
      !i ||
      Math.abs(
        sorted[i - 1]!.step + sorted[i - 1]!.offset - n.step - n.offset,
      ) > 0.00001,
  );
}
function harmony(
  target: MelodyTarget,
  bar: number,
  mode: ComposeMode,
  beat?: number,
): number[] {
  const scores = new Map<number, number>();
  const offset = mode === "continue" ? (target.context?.source.bars ?? 0) : 0;
  for (const voice of target.context?.voices ?? []) {
    const start =
      ((bar + offset) % voice.bars) * target.stepsPerBar + (beat ?? 0);
    for (const note of voice.notes) {
      const overlap =
        Math.min(
          start + (beat === undefined ? target.stepsPerBar : 4),
          note.step + note.length,
        ) - Math.max(start, note.step);
      if (overlap > 0)
        scores.set(
          pc(note.pitch),
          (scores.get(pc(note.pitch)) ?? 0) +
            overlap *
              (voice.track === "bass" ? 2 : voice.track === "pad" ? 1.5 : 0.5),
        );
    }
  }
  return [...scores]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pitch]) => pitch);
}
/** Bounded context avoids inflating the small model's prefill time. No titles are sent. */
export function compositionPrompt(
  target: MelodyTarget,
  options: CompositionOptions,
): string {
  const source = sourceLine(target);
  const pitches = source
    .slice(
      options.mode === "continue" ? -8 : 0,
      options.mode === "continue" ? undefined : 8,
    )
    .map((n) => pc(n.pitch));
  const chord = options.context
    ? [0, 1, 2, 3]
        .map((bar) => harmony(target, bar, options.mode).join(","))
        .join(" / ")
    : "";
  return (
    `Task: ${options.mode}. Form: ${options.structure}.` +
    (options.mode !== "new" && pitches.length
      ? ` Source pitch classes: ${pitches.join(",")}.`
      : "") +
    (chord.replace(/[ /]/g, "")
      ? ` Accompaniment pitch classes by bar: ${chord}.`
      : "")
  );
}
function randomAt(seed: number, bar: number, index: number): number {
  let x =
    (seed + Math.imul(bar + 1, 374761393) + Math.imul(index + 1, 668265263)) |
    0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
const nearest = (values: number[], wanted: number) =>
  values.reduce((a, b) =>
    Math.abs(b - wanted) < Math.abs(a - wanted) ? b : a,
  );

/** One inferred plan, several inexpensive arrangements. All hard musical controls are enforced here. */
export function composeMelody(
  plan: MelodyPlan,
  target: MelodyTarget,
  bars: number,
  options: CompositionOptions,
  seed = 1,
): NoteEvent[] {
  validateComposition(options);
  const scale: readonly number[] = SCALES[target.scale as keyof typeof SCALES];
  const root = KEYS.indexOf(target.key as (typeof KEYS)[number]);
  const meta = TRACK_META[target.track];
  if (
    !scale ||
    root < 0 ||
    !meta ||
    ![1, 2, 4, 8].includes(bars) ||
    ![12, 16, 24].includes(target.stepsPerBar)
  )
    throw new Error("Invalid melody target.");
  const line = sourceLine(target);
  if (options.mode !== "new" && !line.length)
    throw new Error("The selected clip has no notes.");
  const all = Array.from(
    { length: meta.high - meta.low + 1 },
    (_, i) => meta.low + i,
  ).filter((n) => scale.includes(pc(n - root)));
  const center =
    meta.low +
    (meta.high - meta.low) *
      { low: 0.25, middle: 0.5, high: 0.75 }[options.register];
  const range = all.filter((n) => Math.abs(n - center) <= 12);
  const palette = range.length ? range : all;
  const sourcePitches = line.map((n) => n.pitch).sort((a, b) => a - b);
  const sourceShift = sourcePitches.length
    ? Math.round(
        (center - sourcePitches[Math.floor(sourcePitches.length / 2)]!) / 12,
      ) * 12
    : 0;
  const base = nearest(palette, Math.floor(center / 12) * 12 + root);
  const degreePitch = (degree: number) =>
    base +
    scale[((degree % scale.length) + scale.length) % scale.length]! +
    12 * Math.floor(degree / scale.length);
  const spb = target.stepsPerBar,
    total = bars * spb;
  const count =
    options.density ||
    Math.max(
      2,
      Math.round(
        spb / (plan.rhythm === "sparse" ? 8 : plan.rhythm === "steady" ? 4 : 2),
      ),
    );
  const notes: NoteEvent[] = [];
  let previous: number | undefined =
    options.mode === "continue" || options.mode === "answer"
      ? nearest(palette, line.at(-1)!.pitch + sourceShift)
      : undefined;
  for (let bar = 0; bar < bars; bar++) {
    const chord = options.context
      ? harmony(target, bar, options.mode).filter((n) =>
          scale.includes(pc(n - root)),
        )
      : [];
    const repeated =
      bar > 0 && randomAt(seed, bar, 0) * 100 < options.repetition;
    const phraseBar = repeated ? bar % 2 : bar;
    const sourceBar = bar % (target.context?.source.bars ?? 1);
    const sourceNotes = line.filter(
      (n) => Math.floor(n.step / spb) === sourceBar,
    );
    if (
      options.mode === "variation" &&
      options.density === 0 &&
      !sourceNotes.length
    )
      continue;
    // Variations retain the source rhythm when density follows the source.
    const useSourceGrid =
      options.mode === "variation" &&
      options.density === 0 &&
      sourceNotes.length > 0;
    const rawOnsets = useSourceGrid
      ? sourceNotes.map((n) => (n.step % spb) + n.offset)
      : Array.from(
          { length: count },
          (_, i) =>
            (i * spb) / count +
            (plan.rhythm === "syncopated" && i % 2 ? (spb / count) * 0.45 : 0) +
            (options.variation > 0 && i > 0
              ? (spb / count) * (randomAt(seed, phraseBar, i + 201) - 0.5) * 0.4
              : 0),
        );
    // v6 persists offsets only in [-.49, .49]; normalize before computing gates.
    const onsets = rawOnsets
      .map((onset) => {
        const step = Math.min(spb - 1, Math.max(0, Math.round(onset)));
        return Math.max(
          0,
          step + Math.max(-0.49, Math.min(0.49, onset - step)),
        );
      })
      .filter(
        (onset, i, values) => i === 0 || onset - values[i - 1]! > 0.00001,
      );
    for (let i = 0; i < onsets.length; i++) {
      const onset = bar * spb + onsets[i]!;
      const beatChord = options.context
        ? harmony(
            target,
            bar,
            options.mode,
            Math.floor(onsets[i]! / 4) * 4,
          ).filter((n) => scale.includes(pc(n - root)))
        : [];
      const next = bar * spb + (onsets[i + 1] ?? spb);
      const index = i + phraseBar * onsets.length;
      let wanted = degreePitch(plan.motif[index % plan.motif.length]!);
      if (options.mode !== "new") {
        const n =
          options.mode === "continue"
            ? line[
                line.length -
                  Math.min(8, line.length) +
                  (index % Math.min(8, line.length))
              ]!
            : (sourceNotes[i % Math.max(1, sourceNotes.length)] ??
                line[index % line.length])!;
        wanted = n.pitch + sourceShift;
        if (options.mode === "answer")
          wanted =
            line[0]!.pitch +
            sourceShift -
            (n.pitch - line[0]!.pitch) +
            (bar % 2 ? 2 : 0);
      }
      const mutate =
        options.mode !== "rhythm" &&
        randomAt(seed, repeated ? bar % 2 : bar, i + 1) * 100 <
          options.variation;
      if (mutate)
        wanted +=
          (randomAt(seed, bar, i + 91) > 0.5 ? 1 : -1) * (2 + (seed % 3) * 2);
      if (options.mode === "new" || options.mode === "continue") {
        const contour =
          plan.contour === "rise"
            ? bar
            : plan.contour === "fall"
              ? -bar
              : plan.contour === "arch"
                ? Math.round(
                    Math.sin((bar / Math.max(1, bars - 1)) * Math.PI) * 4,
                  )
                : 0;
        wanted += contour;
      }
      if (
        options.structure === "phrase" &&
        bar >= bars / 2 &&
        bar < bars - 1 &&
        !repeated
      )
        wanted += 2;
      let allowed =
        previous === undefined
          ? palette
          : palette.filter((n) => Math.abs(n - previous!) <= options.maxLeap);
      if (!allowed.length) allowed = [nearest(palette, previous!)];
      const last = bar === bars - 1 && i === onsets.length - 1;
      let preferred = allowed;
      if (last && options.structure !== "free") {
        const cadence =
          options.structure === "loop"
            ? pc(notes[0]?.pitch ?? base)
            : (chord[0] ?? root);
        const endings = allowed.filter((n) => pc(n) === cadence);
        if (endings.length) preferred = endings;
      } else if (Math.abs(onsets[i]! % 4) < 0.5 && beatChord.length) {
        const chordTones = allowed.filter((n) => beatChord.includes(pc(n)));
        if (chordTones.length) preferred = chordTones;
      }
      const pitch = nearest(preferred, wanted);
      const sourceLength = useSourceGrid ? sourceNotes[i]!.length : Infinity;
      const length = Math.min(
        sourceLength,
        (next - onset) *
          (last && options.structure === "phrase"
            ? 0.96
            : (plan.articulation === "short" ? 0.5 : 0.9) *
              (options.variation > 0
                ? 0.65 + randomAt(seed, phraseBar, i + 301) * 0.35
                : 1)),
      );
      notes.push(
        makeNote(
          Math.min(total - 1, Math.round(onset)),
          pitch,
          Math.max(0.01, Math.min(length, total - onset)),
          Math.min(1, 0.45 + plan.energy * 0.35 + (i === 0 ? 0.12 : 0)),
          Math.max(
            -0.49,
            Math.min(0.49, onset - Math.min(total - 1, Math.round(onset))),
          ),
        ),
      );
      previous = pitch;
    }
  }
  if (!notes.length)
    throw new Error("The selected clip has no notes in this range.");
  return notes;
}

/** Never present identical arrangements as different choices. */
export function composeAlternatives(
  plan: MelodyPlan,
  target: MelodyTarget,
  bars: number,
  options: CompositionOptions,
  seed: number,
): { notes: NoteEvent[]; seed: number }[] {
  const proposals: { notes: NoteEvent[]; seed: number }[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < 12 && proposals.length < 3; attempt++) {
    const candidateSeed = seed + attempt;
    const notes = composeMelody(plan, target, bars, options, candidateSeed);
    const signature = JSON.stringify(
      notes.map((n) => [n.step, n.offset, n.pitch, n.length, n.velocity]),
    );
    if (!seen.has(signature)) {
      seen.add(signature);
      proposals.push({ notes, seed: candidateSeed });
    }
  }
  return proposals;
}

/** Keep every event outside selected bars byte-for-byte, including expression and IDs. */
export function replaceMelodyBars(
  original: NoteEvent[],
  replacement: NoteEvent[],
  selected: number[],
  target: MelodyTarget,
  options: CompositionOptions,
): NoteEvent[] {
  const chosen = new Set(selected),
    spb = target.stepsPerBar;
  const selectedNote = (n: NoteEvent) => chosen.has(Math.floor(n.step / spb));
  const onset = (n: NoteEvent) => n.step + n.offset;
  const notes = [
    ...original.filter((n) => !selectedNote(n)),
    ...replacement.filter(selectedNote).map((n) => structuredClone(n)),
  ].sort((a, b) => onset(a) - onset(b));
  const scale: readonly number[] = SCALES[target.scale as keyof typeof SCALES];
  const root = KEYS.indexOf(target.key as (typeof KEYS)[number]);
  const meta = TRACK_META[target.track];
  const center =
    meta.low +
    (meta.high - meta.low) *
      { low: 0.25, middle: 0.5, high: 0.75 }[options.register];
  const palette = Array.from(
    { length: meta.high - meta.low + 1 },
    (_, i) => meta.low + i,
  ).filter((n) => Math.abs(n - center) <= 12 && scale.includes(pc(n - root)));
  // A bounded shortest path connects both protected boundaries, not just the left one.
  for (let start = 0; start < notes.length; start++) {
    if (!selectedNote(notes[start]!)) continue;
    let end = start;
    while (end + 1 < notes.length && selectedNote(notes[end + 1]!)) end++;
    const left = notes[start - 1],
      right = notes[end + 1];
    const paths: Map<number, { cost: number; path: number[] }>[] = [];
    for (let i = start; i <= end; i++) {
      const row = new Map<number, { cost: number; path: number[] }>();
      for (const pitch of palette) {
        if (i === start) {
          if (!left || Math.abs(left.pitch - pitch) <= options.maxLeap)
            row.set(pitch, {
              cost: Math.abs(pitch - notes[i]!.pitch),
              path: [pitch],
            });
        } else {
          for (const [previous, entry] of paths.at(-1)!) {
            if (Math.abs(previous - pitch) > options.maxLeap) continue;
            const cost = entry.cost + Math.abs(pitch - notes[i]!.pitch);
            if (!row.has(pitch) || cost < row.get(pitch)!.cost)
              row.set(pitch, { cost, path: [...entry.path, pitch] });
          }
        }
      }
      paths.push(row);
    }
    const best = [...paths.at(-1)!]
      .filter(
        ([pitch]) => !right || Math.abs(pitch - right.pitch) <= options.maxLeap,
      )
      .sort((a, b) => a[1].cost - b[1].cost)[0]?.[1];
    if (!best)
      throw new Error(
        "Cannot connect these bars within the leap limit. Select a wider range of bars.",
      );
    for (let i = start; i <= end; i++) {
      const n = notes[i]!;
      n.pitch = best.path[i - start]!;
      const next = notes[i + 1];
      if (next) n.length = Math.min(n.length, onset(next) - onset(n));
    }
    if (left && onset(left) + left.length > onset(notes[start]!))
      throw new Error(
        "A protected note crosses these bars. Include its starting bar in the selection.",
      );
    start = end;
  }
  return notes;
}

/** A transparent local heuristic, not an assertion of perceptual quality. */
export function selectDiverseMelodies<T extends { notes: NoteEvent[] }>(
  candidates: T[],
  limit = 3,
): T[] {
  const signature = (notes: NoteEvent[]) =>
    notes
      .map(
        (n) =>
          `${n.step}:${n.offset.toFixed(2)}:${n.pitch}:${n.length.toFixed(2)}`,
      )
      .join("|");
  const features = (notes: NoteEvent[]) => {
    const intervals = notes.slice(1).map((n, i) => n.pitch - notes[i]!.pitch);
    const rhythms = new Set(
      notes.map((n) => `${n.offset.toFixed(1)}:${n.length.toFixed(1)}`),
    );
    return [
      rhythms.size / Math.max(1, notes.length),
      new Set(intervals).size / Math.max(1, intervals.length),
      intervals.filter((n) => Math.abs(n) > 7).length /
        Math.max(1, intervals.length),
    ];
  };
  const unique = [
    ...new Map(candidates.map((c) => [signature(c.notes), c])).values(),
  ];
  const score = (candidate: T) => {
    const f = features(candidate.notes);
    return f[0]! + f[1]! - f[2]!;
  };
  const chosen: T[] = [];
  while (unique.length && chosen.length < limit) {
    unique.sort((a, b) => {
      const value = (c: T) =>
        score(c) +
        (chosen.length
          ? Math.min(
              ...chosen.map((other) => {
                const cf = features(c.notes),
                  of = features(other.notes);
                return cf.reduce((sum, v, i) => sum + Math.abs(v - of[i]!), 0);
              }),
            )
          : 0);
      return value(b) - value(a);
    });
    chosen.push(unique.shift()!);
  }
  return chosen;
}
