import { captureGesture } from "./gestures";
export const levelDb = (gain: number) =>
  gain <= 0 ? -60 : Math.max(-60, 20 * Math.log10(gain));
export const levelGain = (db: number) => (db <= -60 ? 0 : 10 ** (db / 20));
export const formatDb = (db: number) =>
  db <= -60 ? "−∞ dB" : `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;
const mounted = new Map<HTMLElement, () => void>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;
function register(host: HTMLElement, sync: () => void) {
  mounted.set(host, sync);
  if (!refreshTimer)
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      for (const [element, update] of mounted) {
        if (!element.isConnected) mounted.delete(element);
        else update();
      }
      if (!mounted.size) {
        clearInterval(refreshTimer!);
        refreshTimer = null;
      }
    }, 150);
}
interface LevelOptions {
  label: string;
  get(): number;
  set(value: number): void;
  start(): void;
  commit(): void;
  reset?: number;
  max?: number;
}
/** Value is linear in the project, logarithmic in the entire shared control. */
export function mountLevel(host: HTMLElement, options: LevelOptions) {
  host.classList.add("level-control");
  const label = document.createElement("label"),
    title = document.createElement("span"),
    range = document.createElement("input"),
    number = document.createElement("input"),
    reset = document.createElement("button"),
    output = document.createElement("output");
  title.textContent = options.label;
  range.type = "range";
  range.min = "-60";
  range.max = String(options.max ?? 6);
  range.step = ".1";
  range.setAttribute("aria-label", options.label);
  number.type = "number";
  number.min = range.min;
  number.max = range.max;
  number.step = ".1";
  number.setAttribute("aria-label", `${options.label} dB`);
  reset.type = "button";
  reset.textContent = "↺";
  reset.setAttribute("aria-label", `${options.label} · 0 dB`);
  label.append(title, range);
  host.append(label, number, output, reset);
  let editing = false;
  const begin = () => {
    if (!editing) {
      options.start();
      editing = true;
    }
  };
  const commit = () => {
    if (editing) {
      editing = false;
      options.commit();
    }
  };
  const sync = () => {
    if (editing || document.activeElement === number) return;
    const db = levelDb(options.get());
    range.value = String(db);
    number.value = db.toFixed(1);
    if (output.textContent !== formatDb(db)) output.textContent = formatDb(db);
    range.setAttribute("aria-valuetext", formatDb(db));
  };
  const update = (db: number) => {
    if (!Number.isFinite(db)) return;
    begin();
    db = Math.max(-60, Math.min(options.max ?? 6, db));
    options.set(levelGain(db));
    range.value = String(db);
    number.value = db.toFixed(1);
    if (output.textContent !== formatDb(db)) output.textContent = formatDb(db);
    range.setAttribute("aria-valuetext", formatDb(db));
  };
  range.oninput = () => update(+range.value);
  range.onchange = commit;
  range.onblur = commit;
  range.onkeydown = (e) => {
    if (
      e.shiftKey &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    ) {
      e.preventDefault();
      update(
        +range.value + (["ArrowRight", "ArrowUp"].includes(e.key) ? 0.1 : -0.1),
      );
    }
  };
  range.onkeyup = commit;
  number.oninput = () => {
    if (number.value !== "" && number.validity.valid) update(+number.value);
  };
  number.onchange = () => {
    if (number.value !== "") update(+number.value);
    commit();
  };
  number.onblur = () => {
    commit();
    sync();
  };
  reset.onclick = () => {
    update(levelDb(options.reset ?? 1));
    commit();
  };
  // Custom thumb drag uses shared cancellation lifecycle; vertical page scrolling
  // remains available everywhere except the actual fader.
  range.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    begin();
    const bounds = range.getBoundingClientRect(),
      startX = e.clientX,
      start = +range.value;
    captureGesture(range, e, {
      move: (move) =>
        update(
          move.shiftKey
            ? start + ((move.clientX - startX) / bounds.width) * 6
            : -60 +
                ((move.clientX - bounds.left) / bounds.width) *
                  (60 + (options.max ?? 6)),
        ),
      end: commit,
    });
  };
  sync();
  register(host, sync);
  return sync;
}
