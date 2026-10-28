import {
  DRUM_NAMES,
  TRACK_META,
  isInScale,
  clipLengthSteps,
  meterSteps,
} from "../core";
import type { Clip, Project, TrackId, NoteEvent } from "../model";
interface RollView {
  clip: Clip;
  project: Project;
  track: TrackId;
  rows: number[];
  selected: Set<string>;
  pitchNames: string[];
  step: number;
}
const grids = new WeakMap<HTMLElement, string>();
export function updateNoteGeometry(
  element: HTMLElement,
  note: NoteEvent,
  track: TrackId,
  zoom: number,
  rowHeight = 22,
) {
  const row =
    track === "drums"
      ? DRUM_NAMES.length - 1 - note.pitch
      : TRACK_META[track].high - note.pitch;
  element.style.left = `${(note.step + (note.offset || 0)) * zoom + 1}px`;
  element.style.top = `${row * rowHeight + 2}px`;
  element.style.width = `${Math.max(5, note.length * zoom - 2)}px`;
  element.style.height = `${rowHeight - 4}px`;
  element.style.setProperty("--vel", String(note.velocity));
}
/** Grid geometry and keyed note nodes have independent lifetimes. */
export function renderRoll(root: HTMLElement, view: RollView) {
  const { clip, project, track, rows, selected, pitchNames, step } = view;
  const zoom = project.editor.zoom,
    rowH = 22,
    steps = clipLengthSteps(clip);
  const seq = root.querySelector<HTMLElement>("#sequencer")!;
  const key = JSON.stringify([
    clip.id,
    track,
    zoom,
    steps,
    clip.stepsPerBar,
    project.meter,
    project.key,
    project.scale,
  ]);
  if (grids.get(seq) !== key) {
    const labels = root.querySelector<HTMLElement>("#pianoLabelRows")!;
    labels.innerHTML = rows
      .map(
        (p) =>
          `<div class="pitch-label ${track !== "drums" && isInScale(p, project.key, project.scale) ? "in-scale" : ""}">${track === "drums" ? (DRUM_NAMES[p] ?? "DRUM") : (pitchNames[p % 12] ?? "N") + Math.floor(p / 12 - 1)}</div>`,
      )
      .join("");
    labels.style.height = `${rows.length * rowH}px`;
    const bar = clip.stepsPerBar || meterSteps(project.meter),
      beat = project.meter.unit === 8 ? 2 : 4;
    root.querySelector<HTMLElement>("#rollRuler")!.innerHTML =
      `<div class="ruler-content" style="width:${steps * zoom}px">${Array.from({ length: steps }, (_, s) => `<span style="left:${s * zoom}px;width:${zoom}px">${s % bar === 0 ? `BAR ${s / bar + 1}` : s % beat === 0 ? (Math.floor(s / beat) % project.meter.beats) + 1 : ""}</span>`).join("")}</div>`;
    seq.style.width = `${steps * zoom}px`;
    seq.style.height = `${rows.length * rowH}px`;
    for (const [name, value] of Object.entries({
      step: zoom,
      beat: zoom * beat,
      bar: zoom * bar,
      row: rowH,
    }))
      seq.style.setProperty(`--${name}`, `${value}px`);
    grids.set(seq, key);
  }
  const existing = new Map(
    [...seq.querySelectorAll<HTMLElement>(".note-block")].map((el) => [
      el.dataset.note!,
      el,
    ]),
  );
  for (const note of clip.notes) {
    let element = existing.get(note.id);
    if (!element) {
      element = document.createElement("button");
      element.className = "note-block";
      element.dataset.note = note.id;
      const handle = document.createElement("span");
      handle.className = "note-resize";
      element.append(handle);
      seq.append(element);
    }
    existing.delete(note.id);
    updateNoteGeometry(element, note, track, zoom, rowH);
    element.classList.toggle("selected", selected.has(note.id));
    element.title = `${track === "drums" ? DRUM_NAMES[note.pitch] : pitchNames[note.pitch % 12]} · ${note.length.toFixed(3)} steps · offset ${(note.offset || 0).toFixed(3)} · velocity ${Math.round(note.velocity * 127)}`;
  }
  existing.forEach((el) => el.remove());
  let playhead = seq.querySelector<HTMLElement>(".roll-playhead");
  if (!playhead) {
    playhead = document.createElement("div");
    playhead.className = "roll-playhead";
    seq.append(playhead);
  }
  playhead.style.left = `${Math.max(0, step % steps) * zoom}px`;
  return seq;
}
