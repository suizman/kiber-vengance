import { render } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { captureGesture } from "../gestures";

export interface DialProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  language: "en" | "es";
  disabled?: boolean;
  format?(value: number): string;
  onStart?(): void;
  onChange(value: number): void;
  onCommit?(value: number): void;
}

/** Continuous local value prevents the parent from re-rendering the studio per pixel. */
export function Dial(props: DialProps) {
  const [value, setValue] = useState(props.value);
  const [adjusting, setAdjusting] = useState(false);
  const latest = useRef(props);
  latest.current = props;
  const current = useRef(props.value);
  const gesture = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (!gesture.current) {
      current.current = props.value;
      setValue(props.value);
    }
  }, [props.value]);
  useLayoutEffect(() => () => gesture.current?.(), []);
  const range = props.max - props.min;
  const update = (next: number) => {
    const p = latest.current,
      span = p.max - p.min,
      step = p.step ?? span / 100;
    const clamped = Math.max(p.min, Math.min(p.max, next));
    const snapped =
      step > 0 ? Math.round((clamped - p.min) / step) * step + p.min : clamped;
    current.current = Math.max(p.min, Math.min(p.max, snapped));
    setValue(current.current);
    p.onChange(current.current);
  };
  const down = (event: PointerEvent) => {
    if (props.disabled || gesture.current || event.button !== 0) return;
    event.preventDefault();
    props.onStart?.();
    setAdjusting(true);
    let x = event.clientX,
      y = event.clientY,
      continuous = current.current;
    gesture.current = captureGesture(
      event.currentTarget as HTMLElement,
      event,
      {
        move: (move) => {
          const dx = move.clientX - x,
            dy = y - move.clientY;
          x = move.clientX;
          y = move.clientY;
          continuous = Math.max(
            props.min,
            Math.min(
              props.max,
              continuous +
                (Math.abs(dy) >= Math.abs(dx) ? dy / 300 : dx / 1500) *
                  range *
                  (move.shiftKey ? 0.15 : 1),
            ),
          );
          update(continuous);
        },
        end: () => {
          gesture.current = null;
          setAdjusting(false);
          latest.current.onCommit?.(current.current);
        },
      },
    );
  };
  const stepOnce = (delta: number) => {
    props.onStart?.();
    update(current.current + delta);
    props.onCommit?.(current.current);
  };
  const key = (event: KeyboardEvent) => {
    const direction = ["ArrowRight", "ArrowUp"].includes(event.key)
      ? 1
      : ["ArrowLeft", "ArrowDown"].includes(event.key)
        ? -1
        : 0;
    if (!direction && !["Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    props.onStart?.();
    update(
      event.key === "Home"
        ? props.min
        : event.key === "End"
          ? props.max
          : current.current +
            direction *
              Math.max(
                props.step ?? 0,
                range * (event.shiftKey ? 0.002 : 0.02),
              ),
    );
    props.onCommit?.(current.current);
  };
  const normalized = range ? (value - props.min) / range : 0;
  const formatted = props.format?.(value) ?? String(Number(value.toFixed(3)));
  return (
    <div class="knob-control">
      <button
        type="button"
        class="knob-nudge"
        aria-label={`${props.language === "es" ? "Reducir" : "Reduce"} ${props.label}`}
        disabled={props.disabled}
        onClick={() => stepOnce(-Math.max(props.step ?? 0, range * 0.02))}
      >
        −
      </button>
      <div
        class={`knob ${adjusting ? "adjusting" : ""}`}
        role="slider"
        tabIndex={props.disabled ? -1 : 0}
        aria-label={props.label}
        aria-valuemin={props.min}
        aria-valuemax={props.max}
        aria-valuenow={value}
        aria-valuetext={formatted}
        aria-disabled={props.disabled ?? false}
        style={{
          "--n": normalized,
          "--v": `${normalized * 75}%`,
          touchAction: "none",
        }}
        title={
          props.language === "es"
            ? "Arrastra verticalmente; horizontalmente para ajuste fino"
            : "Drag vertically; horizontally for fine adjustment"
        }
        onPointerDown={down}
        onKeyDown={key}
      />
      <button
        type="button"
        class="knob-nudge"
        aria-label={`${props.language === "es" ? "Aumentar" : "Increase"} ${props.label}`}
        disabled={props.disabled}
        onClick={() => stepOnce(Math.max(props.step ?? 0, range * 0.02))}
      >
        +
      </button>
      <label>{props.label}</label>
      <output>{formatted}</output>
    </div>
  );
}

export function mountDial(container: HTMLElement, props: DialProps) {
  render(<Dial {...props} />, container);
}
export function unmountDial(container: HTMLElement) {
  render(null, container);
}
