import { AlphaTabApi, Settings, importer } from "@coderline/alphatab";
import type { ScoreDocument } from "./model";
import { scoreMusicXml } from "./musicxml";
export function showNotation(
  element: HTMLElement,
  document: ScoreDocument,
  sectionIndex: number,
  partIndex: number,
  firstBar = 1,
): () => void {
  const settings = new Settings();
  settings.player.enablePlayer = false;
  // A bounded eight-bar excerpt keeps rendering independent of worker/font startup races.
  settings.core.useWorkers = false;
  settings.core.fontDirectory = new URL(
    "./notation-fonts/",
    window.document.baseURI,
  ).href;
  settings.display.startBar = 1;
  settings.display.barCount = 8;
  settings.display.scale = 0.8;
  const source = document.sections[sectionIndex]!;
  let start = 0;
  const advance = (at: number) => {
    const meter = source.meters.findLast((item) => item.step <= at) || {
      beats: 4,
      unit: 4,
    };
    return Math.min(
      source.durationSteps,
      at + (meter.beats * 16) / meter.unit,
      source.meters.find((item) => item.step > at)?.step ?? Infinity,
    );
  };
  for (let bar = 1; bar < firstBar && start < source.durationSteps; bar++)
    start = advance(start);
  let end = start;
  for (let bar = 0; bar < 8 && end < source.durationSteps; bar++)
    end = advance(end);
  if (end <= start) {
    element.textContent = "—";
    return () => {};
  }
  const part = source.parts[partIndex]!;
  const excerpt: ScoreDocument = {
    ...document,
    sections: [
      {
        ...source,
        durationSteps: end - start,
        parts: [
          {
            ...part,
            notes: part.notes
              .filter(
                (note) => note.step < end && note.step + note.length > start,
              )
              .map((note) => ({
                ...note,
                step: Math.max(0, note.step - start),
                length:
                  Math.min(end, note.step + note.length) -
                  Math.max(start, note.step),
              })),
          },
        ],
        tempos: [
          {
            ...(source.tempos.findLast((item) => item.step <= start) || {
              bpm: 120,
            }),
            step: 0,
          },
          ...source.tempos
            .filter((item) => item.step > start && item.step < end)
            .map((item) => ({ ...item, step: item.step - start })),
        ],
        meters: [
          {
            ...(source.meters.findLast((item) => item.step <= start) || {
              beats: 4,
              unit: 4 as const,
            }),
            step: 0,
          },
          ...source.meters
            .filter((item) => item.step > start && item.step < end)
            .map((item) => ({ ...item, step: item.step - start })),
        ],
      },
    ],
  };
  const score = importer.ScoreLoader.loadScoreFromBytes(
    new TextEncoder().encode(scoreMusicXml(excerpt)),
    settings,
  );
  const api = new AlphaTabApi(element, settings);
  api.error.on((error) => {
    element.textContent = String(error);
  });
  api.renderScore(score, [0]);
  return () => api.destroy();
}
