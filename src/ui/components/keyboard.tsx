import { render } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { PointerLifecycle } from "../gestures";

export interface KeyboardNote {
  pitch: number;
  label?: string;
  shortcut?: string;
  root?: boolean;
}
export interface KeyboardProps {
  notes: KeyboardNote[];
  onStart(
    source: string,
    pitch: number,
    velocity: number,
    element: HTMLElement,
  ): void;
  onEnd(source: string, element: HTMLElement): void;
  label: string;
  sourcePrefix: string;
  kind?: "piano" | "pads";
  language: "en" | "es";
  sampler?: boolean;
  onOctave?(offset: number): void;
  octave?: string;
  disabled?: boolean;
}
interface HeldKey {
  source: string;
  element: HTMLElement;
}
const activeReleases = new Set<() => void>();
/** Release voices before navigation without throwing away keyboard DOM or focus state. */
export function releaseAllKeyboards() {
  for (const release of activeReleases) release();
}
/** Reveal an externally played note without moving the page or inspector. */
export function revealKeyboardKey(element: HTMLElement) {
  const scroll = element.closest<HTMLElement>(".keyboard-scroll");
  if (!scroll || !scroll.clientWidth) return;
  const left = element.getBoundingClientRect().left - scroll.getBoundingClientRect().left + scroll.scrollLeft;
  const right = left + element.offsetWidth;
  if (left < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, left - 12);
  else if (right > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = right - scroll.clientWidth + 12;
}
const blackPitches = new Set([1, 3, 6, 8, 10]);
const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const noteName = (pitch: number) =>
  `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;

export function InstrumentKeyboard(props: KeyboardProps) {
  const latest = useRef(props);
  latest.current = props;
  const pointers = useRef<PointerLifecycle<HeldKey> | null>(null);
  const keyboardHeld = useRef(new Map<number, HeldKey>());
  const signature = `${props.sourcePrefix}:${props.kind}:${props.notes.map((note) => note.pitch).join(",")}:${!!props.disabled}`;
  useLayoutEffect(() => {
    const releaseKey = (held: HeldKey) => {
      latest.current.onEnd(held.source, held.element);
      const sameElementHeld = [
        ...(pointers.current?.values() ?? []),
        ...keyboardHeld.current.values(),
      ].some((other) => other.element === held.element);
      held.element.classList.toggle("active", sameElementHeld);
      held.element.setAttribute("aria-pressed", String(sameElementHeld));
    };
    pointers.current = new PointerLifecycle(releaseKey);
    const releaseKeyboard = () => {
      const held = [...keyboardHeld.current.values()];
      keyboardHeld.current.clear();
      held.forEach(releaseKey);
    };
    const releaseAll = () => {
      pointers.current?.releaseAll();
      releaseKeyboard();
    };
    activeReleases.add(releaseAll);
    const hidden = () => {
      if (document.hidden) releaseKeyboard();
    };
    window.addEventListener("blur", releaseKeyboard);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      activeReleases.delete(releaseAll);
      pointers.current?.dispose();
      pointers.current = null;
      releaseKeyboard();
      window.removeEventListener("blur", releaseKeyboard);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [signature]);

  const down = (event: PointerEvent, note: KeyboardNote) => {
    if (event.button !== 0 || latest.current.disabled) return;
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    const source = `${latest.current.sourcePrefix}:pointer:${event.pointerId}`;
    pointers.current?.hold(event.pointerId, { source, element });
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      pointers.current?.release(event.pointerId);
      return;
    }
    element.classList.add("active");
    element.setAttribute("aria-pressed", "true");
    latest.current.onStart(source, note.pitch, 0.85, element);
  };
  const keyDown = (event: KeyboardEvent, note: KeyboardNote) => {
    if (![" ", "Enter"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (
      event.repeat ||
      keyboardHeld.current.has(note.pitch) ||
      latest.current.disabled
    )
      return;
    const element = event.currentTarget as HTMLElement;
    const held = {
      source: `${latest.current.sourcePrefix}:keyboard:${note.pitch}`,
      element,
    };
    keyboardHeld.current.set(note.pitch, held);
    element.classList.add("active");
    element.setAttribute("aria-pressed", "true");
    latest.current.onStart(held.source, note.pitch, 0.85, element);
  };
  const keyUp = (event: KeyboardEvent | FocusEvent, note: KeyboardNote) => {
    if (event instanceof KeyboardEvent && ![" ", "Enter"].includes(event.key))
      return;
    event.stopPropagation();
    const held = keyboardHeld.current.get(note.pitch);
    if (!held) return;
    keyboardHeld.current.delete(note.pitch);
    latest.current.onEnd(held.source, held.element);
    const stillHeld = [...(pointers.current?.values() ?? [])].some(
      (other) => other.element === held.element,
    );
    held.element.classList.toggle("active", stillHeld);
    held.element.setAttribute("aria-pressed", String(stillHeld));
  };
  let whites = 0;
  const pads = props.kind === "pads";
  const notes = props.notes.map((note) => {
    const accidental = !pads && blackPitches.has(((note.pitch % 12) + 12) % 12);
    const left = accidental ? Math.max(0, whites * 48 - 15) : whites++ * 48;
    return { ...note, accidental, left };
  });
  return (
    <section
      class={`instrument-keyboard ${pads ? "instrument-pads" : ""}`}
      aria-label={props.label}
    >
      <div class="keyboard-toolbar">
        <span>{props.label}</span>
        {props.onOctave && (
          <div class="keyboard-octave">
            <button
              type="button"
              onClick={() => props.onOctave?.(-1)}
              aria-label={
                props.language === "es" ? "Bajar octava" : "Octave down"
              }
            >
              −
            </button>
            <output>{props.octave ?? ""}</output>
            <button
              type="button"
              onClick={() => props.onOctave?.(1)}
              aria-label={
                props.language === "es" ? "Subir octava" : "Octave up"
              }
            >
              +
            </button>
          </div>
        )}
      </div>
      <div
        class="keyboard-scroll"
        tabIndex={0}
        aria-label={
          props.language === "es"
            ? "Desplazar rango del teclado"
            : "Scroll keyboard range"
        }
      >
        <div
          class="keyboard-surface"
          style={{
            width: `${Math.max(48, whites * 48)}px`,
            position: "relative",
            height: pads ? "96px" : "144px",
          }}
        >
          {notes.map((note) => (
            <button
              key={note.pitch}
              type="button"
              class={`keyboard-key ${props.sampler ? "sampler-key" : "key"} ${note.accidental ? "accidental" : "natural"} ${note.root ? "root" : ""}`}
              style={{
                "--key-left": `${note.left}px`,
                left: `${note.left}px`,
                position: "absolute",
                width: note.accidental ? "30px" : "48px",
              }}
              data-pitch={note.pitch}
              data-source={note.shortcut?.toLowerCase() ?? ""}
              data-sampler-pitch={props.sampler ? note.pitch : undefined}
              aria-label={note.label ?? noteName(note.pitch)}
              aria-pressed="false"
              disabled={props.disabled}
              onPointerDown={(event) => down(event, note)}
              onPointerUp={(event) =>
                pointers.current?.release(event.pointerId)
              }
              onPointerCancel={(event) =>
                pointers.current?.release(event.pointerId)
              }
              onLostPointerCapture={(event) =>
                pointers.current?.release(event.pointerId)
              }
              onDblClick={(event) => event.preventDefault()}
              onKeyDown={(event) => keyDown(event, note)}
              onKeyUp={(event) => keyUp(event, note)}
              onBlur={(event) => keyUp(event, note)}
            >
              <b>{note.label ?? noteName(note.pitch)}</b>
              {note.shortcut && <span>{note.shortcut.toUpperCase()}</span>}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function mountKeyboard(container: HTMLElement, props: KeyboardProps) {
  render(<InstrumentKeyboard {...props} />, container);
}
export function unmountKeyboard(container: HTMLElement) {
  render(null, container);
}
