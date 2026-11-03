import { trackMeta } from "../state/tracks";
import type { NoteEditorContext } from "../state/contracts";
import type { Clip } from "../model";
import { clipLengthSteps } from "../core";
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
      if (ctx.selectedNotes.has(id)) ctx.selectedNotes.delete(id);
      else ctx.selectedNotes.add(id);
    } else if (!wasSelected) {
      if (selecting) ctx.selectedNotes.add(id);
      else ctx.selectedNotes = new Set([id]);
    }
    ctx.syncSelectedClasses();
    ctx.renderSelection();
    const selected = c.notes.filter((n) => ctx.selectedNotes.has(n.id));
    if (!selected.length) return;
    const limits = selected.reduce(
      (b, n) => ({
        minStep: Math.min(b.minStep, n.step),
        maxEnd: Math.max(b.maxEnd, n.step + n.length),
        minPitch: Math.min(b.minPitch, n.pitch),
        maxPitch: Math.max(b.maxPitch, n.pitch),
        minLength: Math.min(b.minLength, n.length),
        resizeRoom: Math.min(
          b.resizeRoom,
          clipLengthSteps(c) - n.step - n.length,
        ),
      }),
      {
        minStep: Infinity,
        maxEnd: 0,
        minPitch: Infinity,
        maxPitch: -Infinity,
        minLength: Infinity,
        resizeRoom: Infinity,
      },
    );
    const originals = new Map(
        selected.map(
          (n) =>
            [n.id, { step: n.step, pitch: n.pitch, length: n.length }] as const,
        ),
      ),
      startX = e.clientX,
      startY = e.clientY,
      scrollLeft = capture?.scrollLeft || 0,
      scrollTop = capture?.scrollTop || 0,
      resizing = (e.target as Element).classList.contains("note-resize"),
      edit = ctx.beginProjectEdit();
    let moved = false,
      frame = 0,
      scrollFrame = 0;
    let pointer = e;
    const paint = () => {
      frame = 0;
      const elements = new Map(
        [...capture.querySelectorAll<HTMLElement>(".note-block")].map(
          (node) => [node.dataset.note!, node],
        ),
      );
      for (const note of selected) {
        const node = elements.get(note.id);
        if (node)
          updateNoteGeometry(
            node,
            note,
            ctx.selectedTrack,
            zoom,
            rowH,
            rows[0],
          );
      }
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      pointer = ev;
      const dx =
          Math.round(
            (ev.clientX - startX + (capture?.scrollLeft || 0) - scrollLeft) /
              zoom /
              ctx.project.editor.snap,
          ) * ctx.project.editor.snap,
        dy = Math.round(
          (ev.clientY - startY + (capture?.scrollTop || 0) - scrollTop) / rowH,
        );
      if (!moved && !dx && (!dy || resizing)) return;
      if (!moved) {
        edit.markChanged();
        moved = true;
      }
      const timeDelta = Math.max(
        -limits.minStep,
        Math.min(clipLengthSteps(c) - limits.maxEnd, dx),
      );
      const meta = trackMeta(ctx.project, ctx.selectedTrack);
      const pitchDelta = Math.max(
        meta.low - limits.minPitch,
        Math.min(meta.high - limits.maxPitch, -dy),
      );
      const lengthDelta = Math.max(
        Math.min(ctx.project.editor.snap, limits.minLength) - limits.minLength,
        Math.min(limits.resizeRoom, dx),
      );
      for (const n of selected) {
        const o = originals.get(n.id)!;
        if (resizing) n.length = o.length + lengthDelta;
        else {
          n.step = o.step + timeDelta;
          n.pitch = o.pitch + pitchDelta;
        }
      }
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const autoScroll = () => {
      if (moved && capture) {
        const rect = capture.getBoundingClientRect();
        const speed = (value: number, start: number, end: number) =>
          value < start + 32
            ? -Math.min(16, (start + 32 - value) / 2)
            : value > end - 32
              ? Math.min(16, (value - end + 32) / 2)
              : 0;
        const left = capture.scrollLeft,
          top = capture.scrollTop;
        capture.scrollLeft += speed(pointer.clientX, rect.left, rect.right);
        if (!resizing)
          capture.scrollTop += speed(pointer.clientY, rect.top, rect.bottom);
        if (left !== capture.scrollLeft || top !== capture.scrollTop)
          move(pointer);
      }
      scrollFrame = requestAnimationFrame(autoScroll);
    };
    scrollFrame = requestAnimationFrame(autoScroll);
    captureGesture(capture ?? el, e, {
      move,
      end(ev) {
        if (!moved && selecting && wasSelected && ev?.type === "pointerup") {
          ctx.selectedNotes.delete(id);
          ctx.syncSelectedClasses();
          ctx.renderSelection();
        }
        cancelAnimationFrame(frame);
        cancelAnimationFrame(scrollFrame);
        paint();
        if (moved) {
          ctx.renderPiano();
          edit.commit();
        }
      },
    });
  };
}
