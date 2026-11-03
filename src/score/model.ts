import type { InstrumentKind, MeterUnit } from "../model";
/** Timing is always in sixteenth-note steps. Fractions preserve tuplets and MIDI ticks. */
export interface ScoreNote {
  id: string;
  step: number;
  length: number;
  pitch: number;
  velocity: number;
  staff: number;
  voice: string;
  sourceId?: string;
  lyric?: string;
  bend?: number;
}
export interface ScorePart {
  id: string;
  name: string;
  program: number;
  percussion: boolean;
  kind: InstrumentKind;
  notes: ScoreNote[];
  staves: number;
}
export interface ScoreTempo {
  step: number;
  bpm: number;
}
export interface ScoreMeter {
  step: number;
  beats: number;
  unit: MeterUnit;
}
export interface ScoreSection {
  id: string;
  title: string;
  parts: ScorePart[];
  durationSteps: number;
  tempos: ScoreTempo[];
  meters: ScoreMeter[];
}
export interface ScoreDocument {
  version: 1;
  title: string;
  format: string;
  sections: ScoreSection[];
  warnings: string[];
  sourceName: string;
  sourcePage?: number;
}
export const SCORE_LIMITS = {
  bytes: 32 * 1024 * 1024,
  notes: 100_000,
  parts: 256,
  steps: 262_144,
};
export function validateScore(document: ScoreDocument): ScoreDocument {
  let count = 0;
  const identities = new Set<string>();
  if (!document.sections.length) throw new Error("No score sections found");
  for (const section of document.sections) {
    if (
      section.parts.length > SCORE_LIMITS.parts ||
      !Number.isFinite(section.durationSteps) ||
      section.durationSteps <= 0 ||
      section.durationSteps > SCORE_LIMITS.steps
    )
      throw new Error(
        "This score exceeds the safe part or duration limit. Export it in sections.",
      );
    section.meters = cleanMap(section.meters);
    section.tempos = cleanMap(section.tempos);
    if (
      !section.parts.length ||
      !section.tempos.length ||
      !section.meters.length ||
      section.tempos.some(
        (t) =>
          !Number.isFinite(t.step) ||
          t.step < 0 ||
          !Number.isFinite(t.bpm) ||
          t.bpm < 10 ||
          t.bpm > 500,
      ) ||
      section.meters.some(
        (m) =>
          !Number.isFinite(m.step) ||
          m.step < 0 ||
          !Number.isInteger(m.beats) ||
          m.beats < 1 ||
          m.beats > 32 ||
          ![1, 2, 4, 8, 16, 32, 64].includes(m.unit),
      )
    )
      throw new Error(
        "Invalid tempo or meter map; review this score before inserting.",
      );
    for (const part of section.parts) {
      identities.add(
        `${part.id}:${part.name}:${part.kind}:${part.program}:${part.percussion}`,
      );
      if (identities.size > SCORE_LIMITS.parts)
        throw new Error(
          "This score exceeds the safe part or duration limit. Export it in sections.",
        );
      if (
        !Number.isInteger(part.program) ||
        part.program < 0 ||
        part.program > 127 ||
        !Number.isInteger(part.staves) ||
        part.staves < 1 ||
        part.staves > 32 ||
        !["gm", "lead", "guitar", "bass", "pad", "drums"].includes(part.kind)
      )
        throw new Error("Invalid instrument or staff count");
      if (
        part.percussion &&
        part.notes.some((n) => n.pitch < 35 || n.pitch > 81)
      )
        document.warnings.push(
          "GM percussion outside pitches 35–81 uses the nearest available drum. Review its instrument mapping.",
        );
    }
    for (const part of section.parts)
      for (const note of part.notes) {
        count++;
        if (
          ![note.step, note.length, note.pitch, note.velocity].every(
            Number.isFinite,
          ) ||
          note.step < 0 ||
          note.length <= 0 ||
          note.pitch < 0 ||
          note.pitch > 127 ||
          !Number.isInteger(note.staff) ||
          note.staff < 1 ||
          note.staff > part.staves ||
          typeof note.voice !== "string" ||
          note.velocity <= 0 ||
          note.velocity > 1 ||
          note.step + note.length > SCORE_LIMITS.steps
        )
          throw new Error(
            `Invalid note in ${part.name}; the score was not inserted.`,
          );
      }
  }
  if (!count) throw new Error("No playable notes found in this file");
  if (count > SCORE_LIMITS.notes)
    throw new Error(
      "This score contains more than 100,000 notes. Export it in sections.",
    );
  for (const section of document.sections)
    for (const part of section.parts)
      for (const note of part.notes)
        section.durationSteps = Math.max(
          section.durationSteps,
          note.step + note.length,
        );
  document.warnings = [...new Set(document.warnings)];
  return document;
}
export function newPart(
  id: string,
  name: string,
  program = 0,
  percussion = false,
): ScorePart {
  return { id, name, program, percussion, kind: "gm", notes: [], staves: 1 };
}
export function cleanMap<T extends { step: number }>(events: T[]): T[] {
  return [
    ...new Map(
      events.map((event) => [Math.round(event.step * 1e6) / 1e6, event]),
    ).values(),
  ].sort((a, b) => a.step - b.step);
}
