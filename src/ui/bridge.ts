export type StudioView =
  "forge" | "arrange" | "audio" | "launch" | "perform" | "mix";
export interface StudioSnapshot {
  view: StudioView;
  language: "en" | "es";
  context: string;
  inspector: boolean;
  playing: boolean;
  paused: boolean;
  armed: boolean;
  songMode: boolean;
  expanded: boolean;
}
let snapshot: StudioSnapshot = {
  view: "forge",
  language: "en",
  context: "",
  inspector: false,
  playing: false,
  paused: false,
  armed: false,
  songMode: false,
  expanded: false,
};
const subscribers = new Set<() => void>();
export const studioBridge = {
  getSnapshot: () => snapshot,
  subscribe: (fn: () => void) => {
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  },
  update: (patch: Partial<StudioSnapshot>) => {
    const next = { ...snapshot, ...patch };
    if (
      Object.keys(next).every(
        (k) =>
          next[k as keyof StudioSnapshot] ===
          snapshot[k as keyof StudioSnapshot],
      )
    )
      return;
    snapshot = next;
    subscribers.forEach((fn) => fn());
  },
  navigate: (_view: StudioView) => {},
  toggleInspector: () => {},
  toggleFocus: () => {},
  release: () => {},
  openLocalAI: () => {},
  melodyTarget: (): MelodyTarget | null => null,
  applyMelody: (
    _target: MelodyTarget,
    _name: string,
    _bars: number,
    _notes: NoteEvent[],
    _options?: MelodyApplyOptions,
  ) => {},
  auditionMelody: (
    _target: MelodyTarget,
    _notes: NoteEvent[],
    _onEnd: (error?: string) => void,
    _sound?: SoundPreset,
    _options?: { bars: number; loop: boolean },
  ): MelodyAudition => ({
    stop: () => {},
    replace: (_notes: NoteEvent[]) => {},
  }),
  storeSoundPreset: (_preset: SoundPreset) => {},
};
import type { MelodyTarget } from "../ai/melody";
import type { NoteEvent } from "../model";
import type { MelodyApplyOptions, SoundPreset } from "../ai/presets";
export interface MelodyAudition {
  stop(): void;
  replace(notes: NoteEvent[]): void;
}
