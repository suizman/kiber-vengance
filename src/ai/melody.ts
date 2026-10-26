import { KEYS, SCALES, TRACK_META, makeNote } from "../core";
import type { NoteEvent, TrackId } from "../model";

export interface MelodyTarget {
  projectId: string;
  clipId: string;
  track: Exclude<TrackId, "drums">;
  key: string;
  scale: string;
  stepsPerBar: number;
  tempo: number;
}
export interface MelodyPlan {
  title: string;
  motif: number[];
  rhythm: "sparse" | "steady" | "driving" | "syncopated";
  contour: "repeat" | "rise" | "fall" | "arch";
  articulation: "short" | "sustained";
  energy: number;
}
export const melodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    motif: {
      type: "array",
      items: { type: "integer", minimum: 0, maximum: 14 },
      minItems: 4,
      maxItems: 8,
    },
    rhythm: {
      type: "string",
      enum: ["sparse", "steady", "driving", "syncopated"],
    },
    contour: { type: "string", enum: ["repeat", "rise", "fall", "arch"] },
    articulation: { type: "string", enum: ["short", "sustained"] },
    energy: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["title", "motif", "rhythm", "contour", "articulation", "energy"],
};
export function parseMelodyPlan(text: string): MelodyPlan {
  // Qwen can include a completed thinking envelope even with thinking disabled.
  const json = text.trim().replace(/^<think>[\s\S]*?<\/think>\s*/, "");
  const plan = JSON.parse(json) as MelodyPlan;
  if (
    !plan ||
    typeof plan.title !== "string" ||
    !plan.title.trim() ||
    !Array.isArray(plan.motif) ||
    plan.motif.length < 4 ||
    plan.motif.length > 8 ||
    !plan.motif.every((n) => Number.isInteger(n) && n >= 0 && n <= 14) ||
    !["sparse", "steady", "driving", "syncopated"].includes(plan.rhythm) ||
    !["repeat", "rise", "fall", "arch"].includes(plan.contour) ||
    !["short", "sustained"].includes(plan.articulation) ||
    !Number.isFinite(plan.energy) ||
    plan.energy < 0 ||
    plan.energy > 1
  )
    throw new Error("Invalid musical plan returned by the local model.");
  return { ...plan, title: plan.title.trim().slice(0, 48) };
}
/** Compact CPU output avoids spending time generating JSON field names. */
export function expandCompactMelodyPlan(
  text: string,
  prompt: string,
): MelodyPlan {
  const values = JSON.parse(text);
  if (
    !Array.isArray(values) ||
    values.length !== 5 ||
    !values.slice(1).every(Number.isInteger)
  )
    throw new Error("Invalid musical plan returned by the CPU model.");
  return parseMelodyPlan(
    JSON.stringify({
      title: `AI · ${prompt.trim().slice(0, 42)}`,
      motif: values[0],
      rhythm: ["sparse", "steady", "driving", "syncopated"][values[1]],
      contour: ["repeat", "rise", "fall", "arch"][values[2]],
      articulation: ["short", "sustained"][values[3]],
      energy: values[4] / 10,
    }),
  );
}
/** Compile scale degrees into bounded, monophonic, editable project notes. */
export function compileMelody(
  plan: MelodyPlan,
  target: MelodyTarget,
  bars: number,
): NoteEvent[] {
  if (
    ![1, 2, 4, 8].includes(bars) ||
    !Number.isInteger(target.stepsPerBar) ||
    target.stepsPerBar < 1 ||
    target.stepsPerBar > 48
  )
    throw new Error("Invalid melody length.");
  const scale = SCALES[target.scale as keyof typeof SCALES];
  const root = KEYS.indexOf(target.key as (typeof KEYS)[number]);
  if (
    !scale ||
    root < 0 ||
    !["lead", "guitar", "bass", "pad"].includes(target.track)
  )
    throw new Error("Invalid melody target.");
  const total = bars * target.stepsPerBar;
  const stride =
    plan.rhythm === "sparse" ? 8 : plan.rhythm === "steady" ? 4 : 2;
  const notes: NoteEvent[] = [];
  let index = 0;
  for (let step = 0; step < total; step += stride, index++) {
    const bar = Math.floor(step / target.stepsPerBar);
    const variation =
      plan.contour === "rise"
        ? bar
        : plan.contour === "fall"
          ? -bar
          : plan.contour === "arch"
            ? Math.round(Math.sin((bar / Math.max(1, bars - 1)) * Math.PI) * 3)
            : 0;
    const degree = Math.max(
      0,
      Math.min(14, plan.motif[index % plan.motif.length]! + variation),
    );
    const meta = TRACK_META[target.track];
    let pitch =
      Math.floor(meta.base / 12) * 12 +
      root +
      scale[degree % scale.length]! +
      12 * Math.floor(degree / scale.length);
    while (pitch > meta.high) pitch -= 12;
    while (pitch < meta.low) pitch += 12;
    const onset = Math.min(
      total - 0.25,
      step + (plan.rhythm === "syncopated" && index % 2 ? 1 : 0),
    );
    const next = Math.min(
      total,
      step + stride + (plan.rhythm === "syncopated" && index % 2 === 0 ? 1 : 0),
    );
    const length = Math.max(
      0.25,
      (next - onset) * (plan.articulation === "short" ? 0.45 : 0.95),
    );
    notes.push(
      makeNote(
        onset,
        pitch,
        Math.min(length, total - onset),
        Math.min(
          1,
          0.45 +
            plan.energy * 0.4 +
            (step % target.stepsPerBar === 0 ? 0.12 : 0),
        ),
      ),
    );
  }
  return notes;
}
