import {
  trackIds,
  type BuiltinTrackId,
  type InstrumentKind,
  type Project,
  type TrackId,
  type TrackState,
} from "../model";

export const BUILTIN_META = {
  lead: { label: "VOLT LEAD", color: "#ff3bd4", base: 60, low: 48, high: 96 },
  guitar: {
    label: "NEON GUITAR",
    color: "#ff9f43",
    base: 52,
    low: 40,
    high: 88,
  },
  bass: { label: "IRON BASS", color: "#2ee8ff", base: 36, low: 24, high: 67 },
  pad: { label: "ASH VEIL", color: "#8b7cff", base: 48, low: 36, high: 84 },
  drums: { label: "IMPACT RIG", color: "#a7ff5b", base: 0, low: 0, high: 6 },
} satisfies Record<
  BuiltinTrackId,
  { label: string; color: string; base: number; low: number; high: number }
>;

export function builtinKind(id: string): BuiltinTrackId {
  return (trackIds as readonly string[]).includes(id)
    ? (id as BuiltinTrackId)
    : "lead";
}

export function projectTrackIds(
  project: Pick<Project, "tracks"> & Partial<Pick<Project, "trackOrder">>,
): TrackId[] {
  return [
    ...new Set([...(project.trackOrder || []), ...Object.keys(project.tracks)]),
  ].filter((id) => Object.hasOwn(project.tracks, id));
}

export function trackState(
  project: Pick<Project, "tracks">,
  id: TrackId,
): TrackState {
  const state = project.tracks[id];
  if (!state) throw new Error(`Unknown instrument track: ${id}`);
  return state;
}

export function trackKind(
  project: Pick<Project, "tracks"> &
    Partial<Pick<Project, "clips" | "activeClipIds">>,
  id: TrackId,
): InstrumentKind {
  return (
    project.clips?.find((clip) => clip.id === project.activeClipIds?.[id])
      ?.instrument.kind ||
    project.tracks[id]?.kind ||
    builtinKind(id)
  );
}

export function trackMeta(
  project: Pick<Project, "tracks"> | null,
  id: TrackId,
) {
  const state = project?.tracks[id];
  const kind = state?.kind || builtinKind(id);
  const original = BUILTIN_META[kind === "gm" ? "lead" : kind];
  return {
    ...original,
    ...(id in BUILTIN_META && kind !== "gm"
      ? {}
      : {
          low: 0,
          high: kind === "drums" ? 6 : 127,
          base: kind === "drums" ? 0 : 60,
        }),
    label: state?.name || (id in BUILTIN_META ? original.label : "Instrument"),
    color: state?.color || original.color,
  };
}
