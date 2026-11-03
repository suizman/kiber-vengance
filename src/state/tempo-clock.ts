import type { Project } from "../model";

/** Compile once per project edit. Lookups are O(log tempo changes), including linear ramps. */
export function createTempoClock(
  project: Pick<Project, "tempo" | "tempoMap" | "swing">,
) {
  const events = [
    ...new Map(
      project.tempoMap.map((event) => [event.step, { ...event }]),
    ).values(),
  ].sort((a, b) => a.step - b.step);
  if (!events.length || events[0]!.step > 0)
    events.unshift({
      id: "origin",
      step: 0,
      bpm: events[0]?.bpm ?? project.tempo,
      curve: "jump",
    });
  const prefixes: number[] = [0];
  const integral = (bpm: number, slope: number, steps: number) =>
    Math.abs(slope) < 1e-10
      ? (steps * 15) / bpm
      : (15 * Math.log((bpm + slope * steps) / bpm)) / slope;
  const slopes = events.map((event, index) =>
    event.curve === "linear" && events[index + 1]
      ? (events[index + 1]!.bpm - event.bpm) /
        (events[index + 1]!.step - event.step)
      : 0,
  );
  for (let index = 1; index < events.length; index++)
    prefixes[index] =
      prefixes[index - 1]! +
      integral(
        events[index - 1]!.bpm,
        slopes[index - 1]!,
        events[index]!.step - events[index - 1]!.step,
      );
  const indexAt = (step: number) => {
    let low = 0,
      high = events.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (events[mid]!.step <= step) low = mid;
      else high = mid - 1;
    }
    return low;
  };
  const tempo = (step: number) => {
    const index = indexAt(step);
    return (
      events[index]!.bpm +
      slopes[index]! * Math.max(0, step - events[index]!.step)
    );
  };
  const swingAmount = project.swing;
  const seconds = (step: number, swing = true) => {
    if (step < 0) return (step * 15) / tempo(0);
    const index = indexAt(step),
      event = events[index]!;
    let value =
      prefixes[index]! + integral(event.bpm, slopes[index]!, step - event.step);
    if (swing && swingAmount) {
      const at = Math.floor(step),
        fraction = step - at;
      const delay = (position: number) =>
        position % 2 ? (15 / tempo(position)) * swingAmount : 0;
      value += delay(at) * (1 - fraction) + delay(at + 1) * fraction;
    }
    return value;
  };
  return {
    tempo,
    seconds,
    duration: (start: number, length: number) =>
      seconds(start + length) - seconds(start),
  };
}
