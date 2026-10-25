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
};
