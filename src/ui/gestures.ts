/** One owner per pointer. Always terminate gestures when the browser loses input. */
export class PointerLifecycle<T> {
  private held = new Map<number, T>();
  private releaseHandler = (event: PointerEvent) =>
    this.release(event.pointerId);
  private blurHandler = () => this.releaseAll();
  private visibilityHandler = () => {
    if (document.hidden) this.releaseAll();
  };

  constructor(private onRelease: (value: T, pointerId: number) => void) {
    window.addEventListener("pointerup", this.releaseHandler, true);
    window.addEventListener("pointercancel", this.releaseHandler, true);
    window.addEventListener("blur", this.blurHandler);
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  has(pointerId: number) {
    return this.held.has(pointerId);
  }
  values() {
    return this.held.values();
  }
  hold(pointerId: number, value: T) {
    this.release(pointerId);
    this.held.set(pointerId, value);
  }
  release(pointerId: number) {
    const held = this.held.get(pointerId);
    if (held === undefined) return;
    this.held.delete(pointerId);
    this.onRelease(held, pointerId);
  }
  releaseAll() {
    for (const pointerId of [...this.held.keys()]) this.release(pointerId);
  }
  dispose() {
    this.releaseAll();
    window.removeEventListener("pointerup", this.releaseHandler, true);
    window.removeEventListener("pointercancel", this.releaseHandler, true);
    window.removeEventListener("blur", this.blurHandler);
    document.removeEventListener("visibilitychange", this.visibilityHandler);
  }
}

export interface CapturedGesture {
  move(event: PointerEvent): void;
  end(): void;
}

/** Capture survives leaving the dial; unrelated fingers never change its value. */
export function captureGesture(
  element: HTMLElement,
  start: PointerEvent,
  handlers: CapturedGesture,
) {
  let ended = false;
  const move = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId || ended) return;
    event.preventDefault();
    handlers.move(event);
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId === start.pointerId) end();
  };
  const visibility = () => {
    if (document.hidden) end();
  };
  const end = () => {
    if (ended) return;
    ended = true;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    window.removeEventListener("blur", end);
    document.removeEventListener("visibilitychange", visibility);
    element.removeEventListener("lostpointercapture", up);
    if (element.hasPointerCapture(start.pointerId))
      element.releasePointerCapture(start.pointerId);
    handlers.end();
  };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("blur", end);
  document.addEventListener("visibilitychange", visibility);
  element.addEventListener("lostpointercapture", up);
  try {
    element.setPointerCapture(start.pointerId);
  } catch {
    end();
  }
  return end;
}
