import type { NoteEditorContext } from "../state/contracts";
import type { Clip } from "../model";
import { TRACK_META, clipLengthSteps } from "../core";
import { updateNoteGeometry } from "../ui/piano-roll";
import { captureGesture } from "../ui/gestures";
export function bindNoteDrag(
  ctx: NoteEditorContext,
  el: HTMLElement,
  c: Clip,
  rows: number[],
  zoom: number,
  rowH: number,
) {
  el.onpointerdown = (e: PointerEvent) => {
    if (ctx.editorTool === "navigate" || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const id = el.dataset.note;
    if (!id) return;
    const wasSelected = ctx.selectedNotes.has(id);
    const selecting = ctx.editorTool === "select";
    const pointerId = e.pointerId;
    const capture = el.closest(".roll-pane") as HTMLElement;
    if (e.shiftKey) {
      ctx.selectedNotes.has(id)
        ? ctx.selectedNotes.delete(id)
        : ctx.selectedNotes.add(id);
    } else if (!wasSelected) {
      if (selecting) ctx.selectedNotes.add(id);
      else ctx.selectedNotes = new Set([id]);
    }
    ctx.syncSelectedClasses();
    ctx.renderSelection();
    const originals = new Map(
        c.notes
          .filter((n) => ctx.selectedNotes.has(n.id))
          .map(
            (n) =>
              [
                n.id,
                { step: n.step, pitch: n.pitch, length: n.length },
              ] as const,
          ),
      ),
      startX = e.clientX,
      startY = e.clientY,
      resizing = (e.target as Element).classList.contains("note-resize"),
      edit = ctx.beginProjectEdit();
    let moved = false,
      frame = 0;
    const elements = new Map<string, HTMLElement>(
      [...document.querySelectorAll<HTMLElement>(".note-block")].map((node) => [
        node.dataset.note!,
        node,
      ]),
    );
    const paint = () => {
      frame = 0;
      for (const note of c.notes)
        if (ctx.selectedNotes.has(note.id)) {
          const node = elements.get(note.id);
          if (node)
            updateNoteGeometry(node, note, ctx.selectedTrack, zoom, rowH);
        }
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const dx =
          Math.round((ev.clientX - startX) / zoom / ctx.project.editor.snap) *
          ctx.project.editor.snap,
        dy = Math.round((ev.clientY - startY) / rowH);
      if (!moved && !dx && (!dy || resizing)) return;
      if (!moved) {
        edit.markChanged();
        moved = true;
      }
      for (const n of c.notes.filter((n) => ctx.selectedNotes.has(n.id))) {
        const o = originals.get(n.id)!;
        if (resizing)
          n.length = Math.max(
            ctx.project.editor.snap,
            Math.min(clipLengthSteps(c) - n.step, o.length + dx),
          );
        else {
          n.step = Math.max(
            0,
            Math.min(clipLengthSteps(c) - o.length, o.step + dx),
          );
          if (ctx.selectedTrack !== "drums")
            n.pitch = Math.max(
              TRACK_META[ctx.selectedTrack].low,
              Math.min(TRACK_META[ctx.selectedTrack].high, o.pitch - dy),
            );
        }
      }
      if (!frame) frame = requestAnimationFrame(paint);
    };
    captureGesture(capture ?? el, e, {
      move,
      end(ev) {
        if (!moved && selecting && wasSelected && ev?.type === "pointerup") {
          ctx.selectedNotes.delete(id);
          ctx.syncSelectedClasses();
          ctx.renderSelection();
        }
        cancelAnimationFrame(frame);
        paint();
        if (moved) {
          ctx.renderPiano();
          edit.commit();
        }
      },
    });
  };
}
