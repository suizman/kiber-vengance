import { trackKind, trackMeta } from "../state/tracks";
import { DRUM_NAMES, isInScale, clipLengthSteps, meterSteps } from "../core";
import type { Clip, Project, TrackId, NoteEvent } from "../model";
import { translate } from "./i18n";
interface RollView {
  clip: Clip;
  project: Project;
  track: TrackId;
  rows: number[];
  selected: Set<string>;
  pitchNames: string[];
  step: number;
  bindNote?: (element: HTMLElement) => void;
}
const grids = new WeakMap<HTMLElement, string>();
const rolls = new WeakMap<
  HTMLElement,
  { view: RollView; frame: number; paint: () => void }
>();
export function updateNoteGeometry(
  element: HTMLElement,
  note: NoteEvent,
  track: TrackId,
  zoom: number,
  rowHeight = 22,
  highestPitch = track === "drums"
    ? DRUM_NAMES.length - 1
    : trackMeta(null, track).high,
) {
  const row = highestPitch - note.pitch;
  element.style.left = `${(note.step + (note.offset || 0)) * zoom + 1}px`;
  element.style.top = `${row * rowHeight + 2}px`;
  element.style.width = `${Math.max(5, note.length * zoom - 2)}px`;
  element.style.height = `${rowHeight - 4}px`;
  element.style.setProperty("--vel", String(note.velocity));
}
/** Grid geometry and keyed note nodes have independent lifetimes. */
export function renderRoll(root: HTMLElement, view: RollView) {
  const pane = root.querySelector<HTMLElement>("#rollPane")!;
  let state = rolls.get(pane);
  if (!state) {
    state = { view, frame: 0, paint: () => {} };
    const current = state;
    current.paint = () => {
      if (current.frame) return;
      current.frame = requestAnimationFrame(() => {
        current.frame = 0;
        const currentRoot = pane.closest<HTMLElement>("#app");
        if (currentRoot) paintRoll(currentRoot, current.view, false);
      });
    };
    pane.addEventListener("scroll", current.paint, { passive: true });
    new ResizeObserver(current.paint).observe(pane);
    rolls.set(pane, current);
  }
  state.view = view;
  return paintRoll(root, view);
}

/** Offscreen notes stay in the musical model, never in the DOM or selection state. */
function paintRoll(root: HTMLElement, view: RollView, updateHead = true) {
  const { clip, project, track, rows, selected, pitchNames, step } = view;
  const zoom = project.editor.zoom,
    rowH = 22,
    steps = clipLengthSteps(clip);
  const seq = root.querySelector<HTMLElement>("#sequencer")!;
  const pane = root.querySelector<HTMLElement>("#rollPane")!;
  if (
    pane.clientWidth &&
    pane.clientHeight &&
    seq.dataset.viewportClip !== clip.id
  ) {
    seq.dataset.viewportClip = clip.id;
    seq.style.height = `${rows.length * rowH}px`;
    if (!pane.scrollTop)
      pane.scrollTop = Math.max(
        0,
        (rows[0]! - (clip.notes[0]?.pitch ?? trackMeta(project, track).base)) *
          rowH -
          pane.clientHeight / 2,
      );
  }
  const firstStep = Math.max(0, Math.floor(pane.scrollLeft / zoom) - 4);
  const lastStep = Math.min(
    steps,
    Math.ceil((pane.scrollLeft + pane.clientWidth) / zoom) + 4,
  );
  const firstRow = Math.max(0, Math.floor(pane.scrollTop / rowH) - 3);
  const lastRow = Math.min(
    rows.length,
    Math.ceil((pane.scrollTop + pane.clientHeight) / rowH) + 3,
  );
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
          `<div class="pitch-label ${trackKind(project, track) !== "drums" && isInScale(p, project.key, project.scale) ? "in-scale" : ""}">${trackKind(project, track) === "drums" ? (DRUM_NAMES[p] ?? "DRUM") : (pitchNames[p % 12] ?? "N") + Math.floor(p / 12 - 1)}</div>`,
      )
      .join("");
    labels.style.height = `${rows.length * rowH}px`;
    const bar = clip.stepsPerBar || meterSteps(project.meter),
      beat = project.meter.unit === 8 ? 2 : 4;
    root.querySelector<HTMLElement>("#rollRuler")!.innerHTML =
      `<div class="ruler-content" style="width:${steps * zoom}px"></div>`;
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
  const ruler = root.querySelector<HTMLElement>(".ruler-content")!;
  const rulerKey = `${key}:${firstStep}:${lastStep}`;
  if (ruler.dataset.window !== rulerKey) {
    const bar = clip.stepsPerBar || meterSteps(project.meter),
      beat = 16 / project.meter.unit;
    ruler.innerHTML = Array.from(
      { length: Math.max(0, lastStep - firstStep) },
      (_, index) => {
        const s = firstStep + index;
        return `<span style="left:${s * zoom}px;width:${zoom}px">${s % bar === 0 ? `${translate("Bar", "Compás")} ${Math.floor(s / bar) + 1}` : s % beat === 0 ? (Math.floor(s / beat) % project.meter.beats) + 1 : ""}</span>`;
      },
    ).join("");
    ruler.dataset.window = rulerKey;
  }
  const existing = new Map(
    [...seq.querySelectorAll<HTMLElement>(".note-block")].map((el) => [
      el.dataset.note!,
      el,
    ]),
  );
  for (const note of clip.notes) {
    const row = rows[0]! - note.pitch;
    if (
      clip.notes.length > 128 &&
      (row < firstRow ||
        row >= lastRow ||
        note.step + note.offset + note.length < firstStep ||
        note.step + note.offset > lastStep)
    )
      continue;
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
    updateNoteGeometry(element, note, track, zoom, rowH, rows[0]);
    element.classList.toggle("selected", selected.has(note.id));
    element.title = `${trackKind(project, track) === "drums" ? DRUM_NAMES[note.pitch] : pitchNames[note.pitch % 12]} · ${note.length.toFixed(3)} steps · offset ${(note.offset || 0).toFixed(3)} · velocity ${Math.round(note.velocity * 127)}`;
    view.bindNote?.(element);
  }
  existing.forEach((el) => el.remove());
  seq.dataset.totalNotes = String(clip.notes.length);
  let playhead = seq.querySelector<HTMLElement>(".roll-playhead");
  if (!playhead) {
    playhead = document.createElement("div");
    playhead.className = "roll-playhead";
    seq.append(playhead);
    updateHead = true;
  }
  if (updateHead) playhead.style.left = `${Math.max(0, step % steps) * zoom}px`;
  return seq;
}
