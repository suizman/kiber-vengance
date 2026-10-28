import type {
  AudioLane,
  AudioRegion,
  Automation,
  AutomationLane,
  AutomationParameter,
  Clip,
  ClipCharacter,
  EffectChain,
  InstrumentState,
  MacroState,
  NoteEvent,
  NoteExpression,
  PerformanceEvent,
  PerformanceTake,
  Project,
  SamplerInstrument,
  Scene,
  TrackId,
  TrackState,
} from "./model.js";

export const PROJECT_VERSION = 6 as const;
export const STEPS_PER_BAR = 16;
export const STEPS = STEPS_PER_BAR;
export const TRACKS = [
  "lead",
  "guitar",
  "bass",
  "pad",
  "drums",
] as const satisfies readonly TrackId[];
export const TRACK_META = {
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
  TrackId,
  { label: string; color: string; base: number; low: number; high: number }
>;
export const DRUM_NAMES = [
  "KICK",
  "SNARE",
  "CLOSED HAT",
  "OPEN HAT",
  "TOM",
  "PERC",
  "CRASH",
] as const;
export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
} as const;
export type ScaleName = keyof typeof SCALES;
export const KEYS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;
export function samplerDefaults(): SamplerInstrument {
  return {
    assetId: null,
    name: "NO SAMPLE LOADED",
    size: 0,
    type: "",
    duration: 0,
    rootNote: 60,
    tune: 0,
    gain: 0.8,
    attack: 0.005,
    release: 0.18,
    filter: 1,
    trimStart: 0,
    trimEnd: 1,
    mode: "gate",
    reverse: false,
    polyphony: 12,
  };
}

export function cryptoId(): string {
  return (
    globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  );
}
export function makeNote(
  step: number,
  pitch: number,
  length = 1,
  velocity = 0.8,
  offset = 0,
  expression: Partial<NoteExpression> = {},
): NoteEvent {
  return {
    id: cryptoId(),
    step,
    pitch,
    length,
    velocity,
    offset,
    expression: { pressure: velocity, timbre: 0.5, bend: 0, ...expression },
  };
}
export function createClip(
  track: TrackId,
  name = "New Clip",
  bars = 2,
  stepsPerBar = STEPS_PER_BAR,
): Clip {
  return {
    id: cryptoId(),
    track,
    name,
    bars,
    stepsPerBar,
    notes: [],
    automation: { cutoff: {}, volume: {}, pan: {} },
    character: characterDefaults(track),
    instrument: instrumentSettings(track),
  };
}
/** Copy only sound parameters, never mixer or routing state from preset banks. */
export function instrumentSettings(
  track: TrackId,
  source: Partial<TrackState> = {},
): InstrumentState {
  const defaults = trackDefaults()[track];
  const keys = [
    "preset",
    "wave",
    "osc2Wave",
    "osc2Mix",
    "filterType",
    "cutoff",
    "resonance",
    "attack",
    "decay",
    "sustain",
    "release",
    "glide",
    "unison",
    "detune",
  ] as const;
  return Object.fromEntries(
    keys
      .filter((key) => source[key] !== undefined || defaults[key] !== undefined)
      .map((key) => [key, source[key] ?? defaults[key]]),
  ) as InstrumentState;
}

export function mixAudible(project: Project, id: string): boolean {
  const all = [
    ...TRACKS.map((track) => ({ id: track, ...project.tracks[track] })),
    ...project.audioLanes,
  ];
  const source = all.find((item) => item.id === id);
  if (!source || source.mute || (all.some((item) => item.solo) && !source.solo))
    return false;
  const group = project.mixerGroups.find((item) => item.id === source.groupId);
  return (
    !group?.mute &&
    (!project.mixerGroups.some((item) => item.solo) || !!group?.solo)
  );
}
export function globalValue(
  project: Project,
  target: string,
  step: number,
  fallback: number,
): number {
  let value = fallback;
  for (const lane of project.automationLanes)
    if (lane.target === target)
      value = evaluateAutomationLane(lane, step, value);
  for (const route of project.modulationRoutes)
    if (route.target === target) {
      const wave = Math.sin(
        projectSeconds(project, step) *
          Math.PI *
          2 *
          Math.max(0.01, route.rate),
      );
      const modulation = (route.bipolar ? wave : (wave + 1) / 2) * route.amount;
      value += modulation * (target === "master.volume" ? 0.25 : 1);
    }
  return value;
}
export function sidechainFactor(
  project: Project,
  groupId: string | null | undefined,
  elapsedSeconds: number,
): number {
  const group = project.mixerGroups.find((item) => item.id === groupId);
  if (
    !group ||
    group.sidechainSource !== "drums" ||
    elapsedSeconds < 0 ||
    elapsedSeconds >= 0.22
  )
    return 1;
  const minimum = 1 - Math.max(0, Math.min(0.9, group.sidechainAmount));
  return minimum ** (1 - elapsedSeconds / 0.22);
}
export function masterValue(project: Project, step: number): number {
  return Math.max(
    0,
    Math.min(1.5, globalValue(project, "master.volume", step, project.master)),
  );
}

/** A voice gets its own snapshot; subsequent clip edits cannot change its release. */
export function clipTrackState(
  project: Project,
  clip: Clip,
  step?: number,
): TrackState {
  const cfg = {
    ...project.tracks[clip.track],
    ...instrumentSettings(
      clip.track,
      clip.instrument || project.tracks[clip.track],
    ),
  };
  if (step !== undefined) {
    const prefix = `track.${clip.track}.`;
    cfg.cutoff =
      120 +
      Math.max(
        0,
        Math.min(
          1,
          globalValue(
            project,
            prefix + "cutoff",
            step,
            ((cfg.cutoff || 1800) - 120) / 11880,
          ),
        ),
      ) *
        11880;
    cfg.pan = Math.max(
      -1,
      Math.min(
        1,
        globalValue(project, prefix + "pan", step, (cfg.pan + 1) / 2) * 2 - 1,
      ),
    );
    const group = project.mixerGroups.find((item) => item.id === cfg.groupId);
    cfg.volume =
      Math.max(0, globalValue(project, prefix + "volume", step, cfg.volume)) *
      (group?.volume ?? 1);
    cfg.mute = !mixAudible(project, clip.track);
  }
  return cfg;
}

export function clipLengthSteps(clip: Clip): number {
  return (
    Math.max(1, clip.bars) * Math.max(1, clip.stepsPerBar || STEPS_PER_BAR)
  );
}
export function meterSteps(
  meter: { beats: number; unit: number } = { beats: 4, unit: 4 },
): number {
  return Math.max(1, meter.beats) * (meter.unit === 8 ? 2 : 4);
}
export function frequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
/** All persistent binary references, deduplicated across project features. */
export function projectAssets(
  project: Project,
): Array<{ id: string; name: string; type: string }> {
  const assets = new Map<string, { id: string; name: string; type: string }>();
  const add = (id: string | null | undefined, name: string, type: string) => {
    if (id && !assets.has(id)) assets.set(id, { id, name, type });
  };
  for (const sample of project.samples)
    add(sample.id, sample.name, sample.type);
  add(
    project.sampler.assetId,
    project.sampler.name,
    project.sampler.type || "audio/wav",
  );
  for (const lane of project.audioLanes)
    for (const region of lane.regions)
      add(region.assetId, region.name, "audio/wav");
  for (const take of project.performanceTakes)
    add(take.audioAssetId, take.name, take.mimeType || "audio/webm");
  return [...assets.values()];
}

export function secondsPerStep(tempo: number): number {
  return 60 / tempo / 4;
}
export function tempoAtStep(project: Project, step: number): number {
  const events = [...(project.tempoMap || [])].sort((a, b) => a.step - b.step);
  if (!events.length) return project.tempo;
  const rightIndex = events.findIndex((event) => event.step > step),
    left =
      rightIndex < 0 ? events.at(-1)! : events[Math.max(0, rightIndex - 1)]!;
  if (left.curve !== "linear" || rightIndex < 0) return left.bpm;
  const right = events[rightIndex]!;
  return (
    left.bpm +
    (right.bpm - left.bpm) *
      Math.max(0, Math.min(1, (step - left.step) / (right.step - left.step)))
  );
}
/** Only sources participating in this composition render (takes/sampler are separate live captures). */
export function renderAssets(
  project: Project,
  song = true,
  region?: { start: number; end: number },
) {
  const ids = new Set<string>();
  const playback = playbackEvents(project, { song }),
    start = region?.start ?? 0,
    end = region?.end ?? playback.durationSteps;
  if (song)
    for (const lane of project.audioLanes) {
      if (!mixAudible(project, lane.id)) continue;
      for (const item of lane.regions)
        if (item.startStep < end && item.startStep + item.lengthSteps > start)
          ids.add(item.assetId);
    }
  if (mixAudible(project, "drums"))
    for (const event of playback.events) {
      if (
        event.track !== "drums" ||
        event.step >= end ||
        event.step + event.length <= start
      )
        continue;
      const sample = project.samples.find((item) => item.slot === event.pitch);
      if (sample) ids.add(sample.id);
    }
  return projectAssets(project).filter((asset) => ids.has(asset.id));
}

/** Shared musical clock. Linear BPM ramps are integrated analytically. */
export function projectSeconds(
  project: Project,
  step: number,
  swing = true,
): number {
  if (step < 0) return step * secondsPerStep(tempoAtStep(project, 0));
  const events = [...project.tempoMap].sort((a, b) => a.step - b.step);
  const boundaries = [
    0,
    ...events.map((e) => e.step).filter((s) => s > 0 && s < step),
    step,
  ];
  let seconds = 0;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]!,
      end = boundaries[i + 1]!,
      bpm = tempoAtStep(project, start);
    const active = events.filter((e) => e.step <= start).at(-1),
      next = events.find((e) => e.step > start);
    const slope =
      active?.curve === "linear" && next
        ? (next.bpm - active.bpm) / (next.step - active.step)
        : 0;
    seconds +=
      Math.abs(slope) < 1e-10
        ? ((end - start) * 15) / bpm
        : (15 * Math.log((bpm + slope * (end - start)) / bpm)) / slope;
  }
  if (swing && project.swing) {
    const integer = Math.floor(step),
      fraction = step - integer;
    const delay = (at: number) =>
      at % 2 ? secondsPerStep(tempoAtStep(project, at)) * project.swing : 0;
    seconds += delay(integer) * (1 - fraction) + delay(integer + 1) * fraction;
  }
  return seconds;
}
export function projectDuration(
  project: Project,
  start: number,
  length: number,
): number {
  return (
    projectSeconds(project, start + length) - projectSeconds(project, start)
  );
}

export function stepWithSwing(
  step: number,
  tempo: number,
  swing: number,
): number {
  return (
    step * secondsPerStep(tempo) +
    (step % 2 ? secondsPerStep(tempo) * swing : 0)
  );
}
export function activeClip(project: Project, track: TrackId): Clip {
  return (
    project.clips.find((c) => c.id === project.activeClipIds[track]) ||
    project.clips.find((c) => c.track === track)!
  );
}
export function clipsForTrack(project: Project, track: TrackId): Clip[] {
  return project.clips.filter((c) => c.track === track);
}
export function isInScale(pitch: number, key: string, scale: string): boolean {
  const root = Math.max(0, KEYS.indexOf(key as (typeof KEYS)[number])),
    degrees = SCALES[scale as ScaleName] || SCALES.minor;
  return degrees.includes(((pitch - root + 120) % 12) as never);
}

function fx(
  distortion: number,
  saturation: number,
  chorus: number,
  delay: number,
  reverb: number,
  tone: number,
): EffectChain {
  return { bypass: false, distortion, saturation, chorus, delay, reverb, tone };
}
const DEFAULT_MACROS: MacroState = {
  energy: 0.72,
  darkness: 0.64,
  tension: 0.58,
  aggression: 0.68,
  space: 0.42,
  complexity: 0.56,
};
export function characterDefaults(track: TrackId): ClipCharacter {
  const values: Record<TrackId, Omit<ClipCharacter, "macros">> = {
    lead: {
      arp: { enabled: false, mode: "up", octaves: 1, rate: 1 },
      lfo: { enabled: true, target: "cutoff", rate: 2.2, depth: 0.12 },
      fx: fx(0.28, 0.18, 0.14, 0.18, 0.12, 0.58),
    },
    guitar: {
      arp: { enabled: false, mode: "up", octaves: 1, rate: 1 },
      lfo: { enabled: false, target: "pitch", rate: 5.2, depth: 0.03 },
      fx: fx(0.34, 0.3, 0.12, 0.16, 0.18, 0.62),
    },
    bass: {
      arp: { enabled: false, mode: "up", octaves: 1, rate: 1 },
      lfo: { enabled: false, target: "cutoff", rate: 1.5, depth: 0.08 },
      fx: fx(0.38, 0.3, 0.04, 0.02, 0.03, 0.38),
    },
    pad: {
      arp: { enabled: false, mode: "updown", octaves: 2, rate: 1 },
      lfo: { enabled: true, target: "pan", rate: 0.18, depth: 0.32 },
      fx: fx(0.08, 0.1, 0.42, 0.32, 0.48, 0.52),
    },
    drums: {
      arp: { enabled: false, mode: "up", octaves: 1, rate: 1 },
      lfo: { enabled: false, target: "cutoff", rate: 1, depth: 0 },
      fx: fx(0.2, 0.22, 0, 0.08, 0.16, 0.62),
    },
  };
  return { ...structuredClone(values[track]), macros: { ...DEFAULT_MACROS } };
}
function trackDefaults(): Record<TrackId, TrackState> {
  return {
    lead: {
      volume: 0.72,
      pan: 0.08,
      mute: false,
      solo: false,
      preset: "Razor Choir",
      wave: "sawtooth",
      osc2Wave: "square",
      osc2Mix: 0.2,
      filterType: "lowpass",
      cutoff: 4200,
      resonance: 4,
      attack: 0.015,
      decay: 0.11,
      sustain: 0.72,
      release: 0.22,
      glide: 0.04,
      unison: 2,
      detune: 7,
      preGainDb: 0,
      sendMode: "post",
      color: "#ff3bd4",
      groupId: "music",
    },
    guitar: {
      volume: 0.7,
      pan: 0.12,
      mute: false,
      solo: false,
      preset: "Chrome Strings",
      wave: "triangle",
      osc2Wave: "sawtooth",
      osc2Mix: 0.18,
      filterType: "lowpass",
      cutoff: 5200,
      resonance: 2.4,
      attack: 0.003,
      decay: 0.24,
      sustain: 0.18,
      release: 0.38,
      glide: 0.015,
      unison: 1,
      detune: 4,
      preGainDb: 0,
      sendMode: "post",
      color: "#ff9f43",
      groupId: "music",
    },
    bass: {
      volume: 0.82,
      pan: 0,
      mute: false,
      solo: false,
      preset: "Foundry Pulse",
      wave: "square",
      osc2Wave: "sine",
      osc2Mix: 0.28,
      filterType: "lowpass",
      cutoff: 900,
      resonance: 6,
      attack: 0.008,
      decay: 0.08,
      sustain: 0.78,
      release: 0.14,
      glide: 0.02,
      unison: 1,
      detune: 3,
      preGainDb: 0,
      sendMode: "post",
      color: "#2ee8ff",
      groupId: "music",
    },
    pad: {
      volume: 0.52,
      pan: -0.1,
      mute: false,
      solo: false,
      preset: "Afterlight",
      wave: "triangle",
      osc2Wave: "sawtooth",
      osc2Mix: 0.18,
      filterType: "lowpass",
      cutoff: 2400,
      resonance: 2,
      attack: 0.45,
      decay: 0.65,
      sustain: 0.8,
      release: 1.8,
      glide: 0,
      unison: 2,
      detune: 5,
      preGainDb: 0,
      sendMode: "post",
      color: "#8b7cff",
      groupId: "music",
    },
    drums: {
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      preset: "Titan Frame",
      preGainDb: 0,
      sendMode: "post",
      color: "#a7ff5b",
      groupId: null,
    },
  };
}

function buildDemoClips(): Clip[] {
  const leadA = createClip("lead", "Razor Motif", 2),
    leadB = createClip("lead", "Ascension Lead", 4),
    guitarA = createClip("guitar", "Chrome Chugs", 2),
    guitarB = createClip("guitar", "Neon Ascension", 4),
    bassA = createClip("bass", "Foundry Pulse", 2),
    bassB = createClip("bass", "Reactor Drive", 4),
    padA = createClip("pad", "Afterlight Chords", 4),
    padB = createClip("pad", "Cathedral Rise", 4),
    drumsA = createClip("drums", "Titan Frame", 2),
    drumsB = createClip("drums", "Riot Assembly", 4);
  const notes = (data: number[][]): NoteEvent[] =>
    data.map(([step = 0, pitch = 0, length = 1, velocity = 0.8]) =>
      makeNote(step, pitch, length, velocity),
    );
  leadA.notes = notes([
    [0, 67, 2, 0.92],
    [3, 70, 1, 0.75],
    [4, 72, 2, 0.94],
    [7, 70, 1, 0.78],
    [8, 67, 2, 0.88],
    [11, 65, 1, 0.72],
    [12, 63, 2, 0.9],
    [15, 65, 1, 0.8],
    [16, 67, 3, 0.92],
    [20, 75, 2, 0.94],
    [24, 72, 4, 0.9],
    [29, 70, 2, 0.78],
  ]);
  leadB.notes = notes([
    [0, 72, 2, 0.9],
    [4, 75, 2, 0.95],
    [8, 79, 4, 1],
    [14, 77, 2, 0.8],
    [16, 75, 2, 0.92],
    [20, 72, 2, 0.84],
    [24, 70, 4, 0.9],
    [30, 67, 2, 0.82],
    [32, 72, 1, 0.92],
    [34, 75, 1, 0.86],
    [36, 79, 2, 1],
    [40, 82, 4, 0.98],
    [48, 79, 4, 0.92],
    [56, 77, 2, 0.85],
    [60, 75, 4, 0.9],
  ]);
  guitarA.notes = notes([
    [0, 52, 1.5, 0.94],
    [2, 52, 1.5, 0.72],
    [4, 55, 2, 0.9],
    [8, 52, 1.5, 0.94],
    [10, 58, 1.5, 0.82],
    [12, 55, 3, 0.88],
    [16, 52, 1.5, 0.96],
    [18, 52, 1.5, 0.74],
    [20, 60, 2, 0.92],
    [24, 58, 2, 0.86],
    [28, 55, 3, 0.9],
  ]);
  guitarB.notes = notes([
    [0, 52, 2, 0.9],
    [3, 55, 1, 0.76],
    [4, 60, 2, 0.92],
    [7, 62, 1, 0.8],
    [8, 63, 4, 0.94],
    [16, 60, 2, 0.88],
    [20, 67, 3, 0.96],
    [24, 65, 2, 0.84],
    [28, 63, 4, 0.9],
    [32, 52, 1.5, 0.94],
    [34, 55, 1.5, 0.78],
    [36, 60, 2, 0.92],
    [40, 67, 4, 0.98],
    [48, 65, 3, 0.9],
    [56, 63, 2, 0.86],
    [60, 60, 4, 0.92],
  ]);
  bassA.notes = notes([
    [0, 36, 3, 0.95],
    [4, 36, 3, 0.86],
    [8, 39, 3, 0.94],
    [12, 34, 3, 0.92],
    [16, 36, 3, 0.95],
    [20, 39, 3, 0.88],
    [24, 31, 3, 0.95],
    [28, 34, 3, 0.9],
  ]);
  bassB.notes = Array.from({ length: 32 }, (_, i) =>
    makeNote(
      i * 2,
      [36, 36, 39, 34, 31, 34, 36, 39][i % 8]!,
      1.5,
      i % 4 === 0 ? 0.98 : 0.75,
    ),
  );
  const addChords = (
    clip: Clip,
    data: Array<[number, number[]]>,
    velocity: number,
  ) =>
    data.forEach(([step, chord]) =>
      chord.forEach((pitch) =>
        clip.notes.push(makeNote(step, pitch, 16, velocity)),
      ),
    );
  addChords(
    padA,
    [
      [0, [48, 55, 63]],
      [16, [51, 58, 67]],
      [32, [46, 53, 62]],
      [48, [43, 51, 58]],
    ],
    0.5,
  );
  addChords(
    padB,
    [
      [0, [48, 55, 60]],
      [16, [53, 60, 65]],
      [32, [55, 62, 67]],
      [48, [51, 58, 63]],
    ],
    0.52,
  );
  for (let s = 0; s < 32; s++) {
    if (s % 4 === 0) drumsA.notes.push(makeNote(s, 0, 1, 0.96));
    if (s % 8 === 4) drumsA.notes.push(makeNote(s, 1, 1, 0.86));
    if (s % 2 === 0)
      drumsA.notes.push(makeNote(s, 2, 1, s % 4 === 2 ? 0.58 : 0.42));
    if (s % 16 === 15) drumsA.notes.push(makeNote(s, 5, 1, 0.7));
  }
  for (let s = 0; s < 64; s++) {
    if (s % 4 === 0 || s % 16 === 14)
      drumsB.notes.push(makeNote(s, 0, 1, s % 4 === 0 ? 0.98 : 0.7));
    if (s % 8 === 4) drumsB.notes.push(makeNote(s, 1, 1, 0.9));
    if (s % 2 === 0 || s % 16 > 11)
      drumsB.notes.push(makeNote(s, 2, 1, s % 4 === 2 ? 0.62 : 0.4));
    if (s % 16 === 15)
      drumsB.notes.push(makeNote(s, s % 32 === 31 ? 6 : 5, 1, 0.8));
  }
  leadA.automation.cutoff = { 0: 0.35, 8: 0.62, 16: 0.42, 24: 0.8, 31: 0.5 };
  leadB.automation.cutoff = { 0: 0.3, 16: 0.55, 32: 0.75, 48: 0.9, 63: 0.65 };
  guitarB.automation.pan = { 0: 0.36, 16: 0.64, 32: 0.4, 48: 0.62 };
  padB.automation.volume = { 0: 0.35, 32: 0.7, 63: 0.9 };
  return [
    leadA,
    leadB,
    guitarA,
    guitarB,
    bassA,
    bassB,
    padA,
    padB,
    drumsA,
    drumsB,
  ];
}

function createProjectBase(): Omit<Project, "sampler"> {
  const clips = buildDemoClips(),
    by = (track: TrackId, index = 0) =>
      clipsForTrack({ clips } as Project, track)[index]!.id,
    section = (
      name: string,
      indexes: Partial<Record<TrackId, number>> = {},
      repeats = 1,
    ): Scene => ({
      id: cryptoId(),
      name,
      clipIds: Object.fromEntries(
        TRACKS.map((track) => [track, by(track, indexes[track] || 0)]),
      ) as Record<TrackId, string>,
      repeats,
    });
  return {
    version: PROJECT_VERSION,
    id: cryptoId(),
    title: "Chrome Requiem",
    modifiedAt: Date.now(),
    tempo: 132,
    swing: 0.08,
    meter: { beats: 4, unit: 4 },
    key: "C",
    scale: "minor",
    master: 0.78,
    tracks: trackDefaults(),
    clips,
    activeClipIds: Object.fromEntries(
      TRACKS.map((track) => [track, by(track)]),
    ) as Record<TrackId, string>,
    arrangement: [
      section("IGNITION"),
      section("ASCENT", { guitar: 1, bass: 1, pad: 1 }),
      section("IMPACT", { lead: 1, guitar: 1, bass: 1, pad: 1, drums: 1 }, 2),
      section("AFTERMATH"),
    ],
    editor: {
      snap: 1,
      zoom: 32,
      pitchLow: 36,
      pitchHigh: 96,
      automationParam: "cutoff",
      recordMode: "quantized",
      arrangeZoom: 1,
    },
    markers: [],
    loop: { enabled: false, start: 0, end: 64, punch: false },
    launcher: { quantization: 16 },
    performanceTakes: [],
    samples: [],
    audioLanes: [],
    automationLanes: [],
    modulationRoutes: [],
    mixerGroups: [
      {
        id: "music",
        name: "MUSIC BUS",
        color: "#8b7cff",
        volume: 1,
        mute: false,
        solo: false,
        sidechainSource: "drums",
        sidechainAmount: 0.18,
      },
    ],
    tempoMap: [{ id: cryptoId(), step: 0, bpm: 132, curve: "jump" }],
    meterMap: [{ id: cryptoId(), step: 0, beats: 4, unit: 4 }],
    midiMappings: [],
    masterSettings: {
      bypass: false,
      targetLufs: -14,
      ceilingDb: -1,
      monoCheck: false,
      referenceLevel: -12,
    },
  };
}
export function createProject(): Project {
  return { ...createProjectBase(), sampler: samplerDefaults() };
}
export function createEmptyProject(): Project {
  const project = createProject(),
    clips = TRACKS.map((track) =>
      createClip(track, `${TRACK_META[track].label} 1`, 2),
    ),
    clipIds = Object.fromEntries(clips.map((c) => [c.track, c.id])) as Record<
      TrackId,
      string
    >;
  return {
    ...project,
    id: cryptoId(),
    title: "Untitled Signal",
    modifiedAt: Date.now(),
    clips,
    activeClipIds: { ...clipIds },
    arrangement: [
      { id: cryptoId(), name: "INTRO", clipIds: { ...clipIds }, repeats: 1 },
    ],
  };
}

function normalizeClip(input: any, fallback?: ClipCharacter): Clip {
  const bars = Math.max(1, Math.min(8, +input.bars! || 1)),
    stepsPerBar = Math.max(1, +input.stepsPerBar! || STEPS_PER_BAR),
    automation: {
      cutoff: Record<number, number>;
      volume: Record<number, number>;
      pan: Record<number, number>;
    } = { cutoff: {}, volume: {}, pan: {}, ...input.automation },
    base = fallback || characterDefaults(input.track),
    own = input.character || {},
    character: ClipCharacter = {
      arp: { ...base.arp, ...own.arp },
      lfo: { ...base.lfo, ...own.lfo },
      fx: { ...base.fx, ...own.fx },
      macros: { ...base.macros, ...own.macros },
    };
  const notes = (Array.isArray(input.notes) ? input.notes : []).map(
    (n: any) => ({
      id: n.id || cryptoId(),
      step: Math.max(0, +n.step || 0),
      pitch: +n.pitch || 0,
      length: Math.max(0.01, +n.length || 1),
      velocity: Math.max(0.01, Math.min(1, +n.velocity || 0.8)),
      offset: Math.max(-0.49, Math.min(0.49, +n.offset || 0)),
      expression: {
        pressure: n.expression?.pressure ?? n.velocity ?? 0.8,
        timbre: n.expression?.timbre ?? 0.5,
        bend: n.expression?.bend ?? 0,
      },
    }),
  );
  return {
    ...input,
    id: input.id,
    name: input.name,
    track: input.track,
    bars,
    stepsPerBar,
    notes,
    automation,
    character,
  };
}
type LegacyPattern = {
  id: string;
  name?: string;
  bars?: number;
  notes?: Partial<Record<TrackId, Array<Partial<NoteEvent>>>>;
};
type LegacyProject = {
  [key: string]: any;
  clips?: any[];
  patterns?: LegacyPattern[];
  activePatternId?: string;
  arrangement?: Array<{
    id?: string;
    name?: string;
    patternId?: string;
    clipIds?: Partial<Record<TrackId, string>>;
    repeats?: number;
  }>;
};
function legacyCharacter(source: LegacyProject, track: TrackId): ClipCharacter {
  const base = characterDefaults(track),
    old = source.tracks?.[track] || {},
    fxChain = { ...base.fx, ...old.fx };
  if (old.drive != null && old.fx?.distortion == null)
    fxChain.distortion = old.drive;
  if (old.delay != null && old.fx?.delay == null) fxChain.delay = old.delay;
  return {
    arp: { ...base.arp, ...old.arp },
    lfo: { ...base.lfo, ...old.lfo },
    fx: fxChain,
    macros: { ...base.macros, ...source.macros },
  };
}
function migrateLegacy(raw: LegacyProject, base: Project): Project {
  if (!raw.patterns?.length) return base;
  const clips: Clip[] = [],
    map = new Map<string, Record<TrackId, string>>();
  for (const pattern of raw.patterns) {
    const ids = {} as Record<TrackId, string>;
    for (const track of TRACKS) {
      const clip = createClip(
        track,
        `${pattern.name || "Pattern"} · ${TRACK_META[track].label}`,
        pattern.bars || 1,
      );
      clip.character = legacyCharacter(raw, track);
      clip.instrument = instrumentSettings(track, raw.tracks?.[track]);
      clip.notes = (pattern.notes?.[track] || []).map(
        (n) =>
          normalizeClip(
            {
              id: "temp",
              name: "temp",
              track,
              bars: 1,
              notes: [n as NoteEvent],
            },
            clip.character,
          ).notes[0]!,
      );
      clips.push(clip);
      ids[track] = clip.id;
    }
    map.set(pattern.id, ids);
  }
  const active =
    map.get(raw.activePatternId || "") || map.values().next().value!;
  return {
    ...base,
    ...raw,
    version: PROJECT_VERSION,
    clips,
    activeClipIds: active,
    arrangement: (raw.arrangement || []).map((s) => ({
      id: s.id || cryptoId(),
      name: s.name || "SECTION",
      clipIds: map.get(s.patternId || "") || active,
      repeats: s.repeats || 1,
    })),
  } as Project;
}
export function migrateProject(value: unknown): Project {
  if (!value || typeof value !== "object")
    throw new Error("Invalid КИБЕР VENGANCE project");
  const base = createProject(),
    raw = value as LegacyProject,
    source: LegacyProject = raw.clips ? raw : migrateLegacy(raw, base),
    defaults = trackDefaults(),
    tracks = {} as Record<TrackId, TrackState>;
  for (const id of TRACKS) {
    const incoming = source.tracks?.[id] || defaults[id],
      {
        arp: _arp,
        lfo: _lfo,
        fx: _fx,
        drive: _drive,
        delay: _delay,
        ...instrument
      } = incoming;
    tracks[id] = {
      ...defaults[id],
      ...instrument,
      color: instrument.color || TRACK_META[id].color,
    };
  }
  const clips = (source.clips || base.clips).map((c: any) =>
    normalizeClip(
      {
        ...c,
        instrument: instrumentSettings(
          c.track,
          c.instrument || tracks[c.track as TrackId],
        ),
      },
      legacyCharacter(source, c.track),
    ),
  );
  for (const track of TRACKS)
    if (!clips.some((c) => c.track === track))
      clips.push(
        createClip(
          track,
          `${TRACK_META[track].label} 1`,
          2,
          meterSteps(source.meter || base.meter),
        ),
      );
  const activeClipIds = { ...base.activeClipIds, ...source.activeClipIds };
  for (const track of TRACKS)
    if (!clips.some((c) => c.id === activeClipIds[track] && c.track === track))
      activeClipIds[track] = clips.find((c) => c.track === track)!.id;
  const arrangement = (
      source.arrangement?.length
        ? source.arrangement
        : (base.arrangement as Scene[])
    ).map(
      (s: any) =>
        ({
          id: s.id || cryptoId(),
          name: s.name || "SECTION",
          clipIds: { ...activeClipIds, ...("clipIds" in s ? s.clipIds : {}) },
          repeats: Math.max(1, Math.min(16, +s.repeats! || 1)),
        }) as Scene,
    ),
    { macros: _macros, ...cleanSource } = source;
  const duration = arrangement.reduce(
      (sum, scene) =>
        sum +
        Math.max(
          ...TRACKS.map((track) =>
            clipLengthSteps(
              clips.find((c) => c.id === scene.clipIds[track]) ||
                clips.find((c) => c.track === track)!,
            ),
          ),
        ) *
          scene.repeats,
      0,
    ),
    audioLanes = Array.isArray(source.audioLanes)
      ? source.audioLanes.map((lane: any) => ({
          ...createAudioLane(lane.name, lane.color),
          ...lane,
          regions: Array.isArray(lane.regions)
            ? lane.regions.map((region: any) => ({
                ...createAudioRegion(
                  region.assetId,
                  region.name,
                  region.startStep,
                  region.lengthSteps,
                  region.durationSeconds,
                ),
                ...region,
              }))
            : [],
        }))
      : [];
  return {
    ...base,
    ...cleanSource,
    version: PROJECT_VERSION,
    modifiedAt: Date.now(),
    meter: { ...base.meter, ...source.meter },
    tracks,
    clips,
    activeClipIds,
    arrangement,
    editor: { ...base.editor, ...source.editor },
    markers: Array.isArray(source.markers) ? source.markers : [],
    loop: {
      ...base.loop,
      ...source.loop,
      end: source.loop?.end || Math.min(64, duration),
    },
    launcher: { ...base.launcher, ...source.launcher },
    performanceTakes: Array.isArray(source.performanceTakes)
      ? source.performanceTakes
      : [],
    samples: Array.isArray(source.samples) ? source.samples : [],
    audioLanes,
    automationLanes: Array.isArray(source.automationLanes)
      ? source.automationLanes
      : [],
    modulationRoutes: Array.isArray(source.modulationRoutes)
      ? source.modulationRoutes
      : [],
    mixerGroups:
      Array.isArray(source.mixerGroups) && source.mixerGroups.length
        ? source.mixerGroups
        : base.mixerGroups,
    tempoMap:
      Array.isArray(source.tempoMap) && source.tempoMap.length
        ? source.tempoMap
        : [
            {
              id: cryptoId(),
              step: 0,
              bpm: +source.tempo || base.tempo,
              curve: "jump",
            },
          ],
    meterMap:
      Array.isArray(source.meterMap) && source.meterMap.length
        ? source.meterMap
        : [
            {
              id: cryptoId(),
              step: 0,
              beats: source.meter?.beats || 4,
              unit: source.meter?.unit || 4,
            },
          ],
    midiMappings: Array.isArray(source.midiMappings) ? source.midiMappings : [],
    masterSettings: { ...base.masterSettings, ...source.masterSettings },
  } as Project;
}

export function createAudioLane(
  name = "AUDIO 1",
  color = "#2ee8ff",
): AudioLane {
  return {
    id: cryptoId(),
    name,
    color,
    volume: 1,
    pan: 0,
    mute: false,
    solo: false,
    groupId: "music",
    regions: [],
  };
}
export function createAudioRegion(
  assetId: string,
  name = "AUDIO REGION",
  startStep = 0,
  lengthSteps = 16,
  durationSeconds = 0,
): AudioRegion {
  return {
    id: cryptoId(),
    assetId,
    name,
    startStep: Math.max(0, startStep),
    lengthSteps: Math.max(0.25, lengthSteps),
    offsetSeconds: 0,
    durationSeconds: Math.max(0, durationSeconds),
    gainDb: 0,
    fadeInSteps: 0,
    fadeOutSteps: 0,
    pitch: 0,
    sourceBpm: 120,
    warp: false,
    warpMode: "repitch",
    reverse: false,
  };
}
export function audioRegionRate(region: AudioRegion, tempo: number): number {
  const pitch = 2 ** (region.pitch / 12),
    warp = region.warp
      ? Math.max(0.1, tempo / Math.max(20, region.sourceBpm))
      : 1;
  return pitch * warp;
}
export function createAutomationLane(
  target = "master.volume",
  name = "MASTER VOLUME",
  min = 0,
  max = 1,
): AutomationLane {
  return {
    id: cryptoId(),
    name,
    target,
    min,
    max,
    enabled: true,
    writeMode: "read",
    points: [],
  };
}
export function evaluateAutomationLane(
  lane: AutomationLane,
  step: number,
  fallback = 0.5,
): number {
  const points = [...lane.points].sort((a, b) => a.step - b.step);
  if (!lane.enabled || !points.length) return fallback;
  if (step <= points[0]!.step) return points[0]!.value;
  if (step >= points.at(-1)!.step) return points.at(-1)!.value;
  const rightIndex = points.findIndex((point) => point.step >= step),
    left = points[rightIndex - 1]!,
    right = points[rightIndex]!;
  if (left.curve === "step") return left.value;
  let t = (step - left.step) / (right.step - left.step);
  if (left.curve === "smooth") t = t * t * (3 - 2 * t);
  else if (left.curve === "exponential") t = t * t;
  return left.value + (right.value - left.value) * t;
}
export function detectTransientSlices(
  samples: Float32Array,
  count = 8,
): number[] {
  if (samples.length < 2) return [0, 1];
  const window = Math.max(32, Math.floor(samples.length / 1024)),
    energies: number[] = [];
  for (let i = 0; i < samples.length; i += window) {
    let sum = 0;
    for (let j = i; j < Math.min(samples.length, i + window); j++)
      sum += Math.abs(samples[j]!);
    energies.push(sum / window);
  }
  const candidates = energies
      .map((energy, index) => ({
        index,
        delta: energy - (energies[index - 1] || 0),
      }))
      .filter((item) => item.index > 1)
      .sort((a, b) => b.delta - a.delta),
    minimum = Math.max(1, Math.floor(energies.length / Math.max(2, count * 2))),
    chosen = [0];
  for (const candidate of candidates)
    if (
      chosen.every((index) => Math.abs(index - candidate.index) >= minimum) &&
      chosen.push(candidate.index) >= count
    )
      break;
  return chosen
    .sort((a, b) => a - b)
    .map((index) => Math.min(1, (index * window) / samples.length))
    .concat(1)
    .filter((value, index, list) => index === 0 || value > list[index - 1]!);
}
export function transformNotes(
  clip: Clip,
  mode: "retrograde" | "invert" | "double" | "half" | "humanize",
  amount = 0.5,
): void {
  const length = clipLengthSteps(clip),
    center = clip.notes.length
      ? clip.notes.reduce((sum, n) => sum + n.pitch, 0) / clip.notes.length
      : 60;
  for (const note of clip.notes) {
    if (mode === "retrograde")
      note.step = Math.max(0, length - note.step - note.length);
    else if (mode === "invert")
      note.pitch = Math.round(center - (note.pitch - center));
    else if (mode === "double") {
      note.step = Math.min(length - 0.25, note.step * 2);
      note.length = Math.max(0.25, note.length * 2);
    } else if (mode === "half") {
      note.step = Math.max(0, note.step / 2);
      note.length = Math.max(0.25, note.length / 2);
    } else {
      const seed =
        ((note.pitch * 31 + Math.round(note.step * 17)) % 97) / 97 - 0.5;
      note.offset = Math.max(
        -0.49,
        Math.min(0.49, note.offset + seed * 0.4 * amount),
      );
      note.velocity = Math.max(
        0.05,
        Math.min(1, note.velocity + seed * 0.2 * amount),
      );
    }
  }
  clip.notes.sort((a, b) => a.step - b.step);
}

export function dbToGain(db: number): number {
  return db <= -60 ? 0 : 10 ** (db / 20);
}
export function gainToDb(gain: number): number {
  return gain <= 0.001 ? -60 : 20 * Math.log10(gain);
}
export function createPerformanceTake(
  name: string,
  durationSteps: number,
  events: PerformanceEvent[] = [],
): PerformanceTake {
  return {
    id: cryptoId(),
    name,
    createdAt: Date.now(),
    durationSteps: Math.max(1, durationSteps),
    trimStart: 0,
    trimEnd: Math.max(1, durationSteps),
    events: events.map((event) => ({ ...event, id: event.id || cryptoId() })),
  };
}
export function quantizePerformanceTake(
  take: PerformanceTake,
  resolution = 1,
): PerformanceTake {
  const amount = Math.max(0.25, resolution);
  take.events.forEach(
    (event) =>
      (event.step = Math.max(
        take.trimStart,
        Math.min(take.trimEnd, Math.round(event.step / amount) * amount),
      )),
  );
  take.events.sort((a, b) => a.step - b.step);
  return take;
}
export function captureLauncherScenes(
  project: Project,
  snapshots: Array<{
    name?: string;
    clipIds: Record<TrackId, string>;
    repeats?: number;
  }>,
): Scene[] {
  const scenes = snapshots.map((snapshot, index) => ({
    id: cryptoId(),
    name: snapshot.name || `LIVE ${String(index + 1).padStart(2, "0")}`,
    clipIds: { ...snapshot.clipIds },
    repeats: Math.max(1, Math.min(16, snapshot.repeats || 1)),
  }));
  if (scenes.length) project.arrangement.push(...scenes);
  return scenes;
}
export function duplicateArrangementSelection(
  project: Project,
  indexes: number[],
): Scene[] {
  const selected = [...new Set(indexes)]
      .filter((index) => index >= 0 && index < project.arrangement.length)
      .sort((a, b) => a - b),
    copies = selected.map((index) => ({
      ...structuredClone(project.arrangement[index]!),
      id: cryptoId(),
      name: `${project.arrangement[index]!.name} COPY`,
    }));
  if (copies.length)
    project.arrangement.splice(selected.at(-1)! + 1, 0, ...copies);
  return copies;
}
export function removeArrangementSelection(
  project: Project,
  indexes: number[],
): boolean {
  const selected = [...new Set(indexes)]
    .filter((index) => index >= 0 && index < project.arrangement.length)
    .sort((a, b) => b - a);
  if (!selected.length || project.arrangement.length - selected.length < 1)
    return false;
  selected.forEach((index) => project.arrangement.splice(index, 1));
  return true;
}

export function setProjectMeter(
  project: Project,
  beats: number,
  unit: 4 | 8,
): Project {
  const next = meterSteps({ beats, unit }),
    ratio = next / meterSteps(project.meter);
  for (const clip of project.clips) {
    clip.notes = clip.notes.map((n) => ({
      ...n,
      step: Math.round(n.step * ratio * 4) / 4,
      length: Math.max(0.01, Math.round(n.length * ratio * 1000) / 1000),
      offset: n.offset * ratio,
    }));
    for (const name of Object.keys(clip.automation) as AutomationParameter[]) {
      const lane = clip.automation[name];
      clip.automation[name] = Object.fromEntries(
        Object.entries(lane).map(([step, v]) => [
          Math.round(+step * ratio * 4) / 4,
          v,
        ]),
      );
    }
    clip.stepsPerBar = next;
    resizeClip(clip, clip.bars);
  }
  project.meter = { beats, unit };
  return project;
}
export function toggleNote(
  clip: Clip,
  step: number,
  pitch: number,
  velocity = 0.8,
  length = 1,
): boolean {
  const i = clip.notes.findIndex((n) => n.step === step && n.pitch === pitch);
  if (i >= 0) clip.notes.splice(i, 1);
  else clip.notes.push(makeNote(step, pitch, length, velocity));
  return i < 0;
}
export function duplicateClip(project: Project, id: string): Clip | null {
  const source = project.clips.find((c) => c.id === id);
  if (!source) return null;
  const copy = structuredClone(source);
  copy.id = cryptoId();
  copy.name = `${source.name} V${clipsForTrack(project, source.track).length + 1}`;
  copy.notes.forEach((n) => (n.id = cryptoId()));
  project.clips.push(copy);
  project.activeClipIds[source.track] = copy.id;
  return copy;
}
export function deleteClip(project: Project, id: string): Clip | null {
  const target = project.clips.find((c) => c.id === id);
  if (!target) return null;
  const siblings = clipsForTrack(project, target.track).filter(
    (c) => c.id !== id,
  );
  if (!siblings.length) return null;
  const replacement = siblings[0]!;
  project.clips = project.clips.filter((c) => c.id !== id);
  if (project.activeClipIds[target.track] === id)
    project.activeClipIds[target.track] = replacement.id;
  for (const scene of project.arrangement)
    if (scene.clipIds[target.track] === id)
      scene.clipIds[target.track] = replacement.id;
  return replacement;
}
export function varyClip(project: Project, clip: Clip, amount = 0.5): Clip {
  const copy = structuredClone(clip);
  copy.id = cryptoId();
  copy.name = `${clip.name} / MUTATION`;
  copy.notes.forEach((n) => (n.id = cryptoId()));
  const scale = SCALES[project.scale as ScaleName] || SCALES.minor,
    root = Math.max(0, KEYS.indexOf(project.key as (typeof KEYS)[number])),
    count = Math.max(1, Math.round(copy.notes.length * 0.2 * amount));
  for (let i = 0; i < count; i++) {
    const src = copy.notes[(i * 7) % Math.max(1, copy.notes.length)];
    if (src) {
      const old = scale.indexOf(((src.pitch - root + 120) % 12) as never),
        degree = scale[((old < 0 ? 0 : old) + 2) % scale.length]!;
      copy.notes.push(
        makeNote(
          (src.step + 3 + i * 4) % clipLengthSteps(copy),
          Math.floor(src.pitch / 12) * 12 + root + degree,
          src.length,
          Math.max(0.3, src.velocity - 0.12),
        ),
      );
    }
  }
  project.clips.push(copy);
  project.activeClipIds[clip.track] = copy.id;
  return copy;
}
export function resizeClip(clip: Clip, bars: number): void {
  clip.bars = Math.max(1, Math.min(8, +bars));
  const max = clipLengthSteps(clip);
  clip.notes = clip.notes
    .filter((n) => n.step < max)
    .map((n) => ({ ...n, length: Math.min(n.length, max - n.step) }));
  for (const lane of Object.values(clip.automation))
    for (const key of Object.keys(lane)) if (+key >= max) delete lane[+key];
}
export function quantizeClip(clip: Clip, resolution = 1): void {
  const max = clipLengthSteps(clip);
  for (const n of clip.notes) {
    n.step = Math.max(
      0,
      Math.min(
        max - resolution,
        Math.round((n.step + n.offset) / resolution) * resolution,
      ),
    );
    n.offset = 0;
    n.length = Math.max(
      resolution,
      Math.round(n.length / resolution) * resolution,
    );
  }
}
export function automationValue(
  clip: Clip,
  param: AutomationParameter,
  step: number,
  fallback = 0.5,
): number {
  const lane = clip.automation[param],
    points = Object.keys(lane)
      .map(Number)
      .sort((a, b) => a - b);
  if (!points.length) return fallback;
  const s =
      ((step % clipLengthSteps(clip)) + clipLengthSteps(clip)) %
      clipLengthSteps(clip),
    left = points.filter((p) => p <= s).at(-1) ?? points[0]!,
    right = points.find((p) => p >= s) ?? points.at(-1)!;
  if (left === right) return lane[left]!;
  return (
    lane[left]! + ((lane[right]! - lane[left]!) * (s - left)) / (right - left)
  );
}
export function notesAtStep(
  project: Project,
  clip: Clip,
  track: TrackId,
  step: number,
): NoteEvent[] {
  const local =
      ((step % clipLengthSteps(clip)) + clipLengthSteps(clip)) %
      clipLengthSteps(clip),
    arp = clip.character.arp;
  if (track === "drums" || !arp.enabled)
    return clip.notes.filter((n) => n.step === local);
  if (local % arp.rate !== 0) return [];
  const held = clip.notes
    .filter((n) => n.step <= local && n.step + n.length > local)
    .sort((a, b) => a.pitch - b.pitch);
  if (!held.length) return [];
  const span = held.length * Math.max(1, arp.octaves),
    phase = Math.floor(local / arp.rate);
  let index = phase % span;
  if (arp.mode === "down") index = span - 1 - index;
  if (arp.mode === "updown") {
    const cycle = Math.max(1, span * 2 - 2),
      p = phase % cycle;
    index = p < span ? p : cycle - p;
  }
  if (arp.mode === "random") index = (phase * 7 + 3) % span;
  const source = held[index % held.length]!,
    octave = Math.floor(index / held.length);
  return [
    {
      ...source,
      id: `arp-${local}-${source.id}`,
      step: local,
      offset: 0,
      pitch: source.pitch + octave * 12,
      length: Math.max(0.25, arp.rate * 0.82),
    },
  ];
}

export function generateClip(
  project: Project,
  clip: Clip,
  type = "riff",
  intensity = 0.6,
): Clip {
  const steps = clipLengthSteps(clip),
    root = Math.max(0, KEYS.indexOf(project.key as (typeof KEYS)[number])),
    scale = SCALES[project.scale as ScaleName] || SCALES.minor,
    base = TRACK_META[clip.track].base,
    degree = (i: number) =>
      base +
      root +
      scale[(i + scale.length) % scale.length]! +
      12 * Math.floor(i / scale.length);
  clip.notes = [];
  if (type === "chords") {
    const progression = project.scale === "major" ? [0, 4, 5, 3] : [0, 5, 3, 6];
    for (let bar = 0; bar < clip.bars; bar++) {
      const d = progression[bar % progression.length]!,
        start = bar * clip.stepsPerBar;
      [d, d + 2, d + 4].forEach((x, i) =>
        clip.notes.push(
          makeNote(start, degree(x), clip.stepsPerBar, 0.48 + i * 0.04),
        ),
      );
    }
  } else if (type === "bass") {
    const progression = [0, 0, 5, 3];
    for (let s = 0; s < steps; s += intensity > 0.65 ? 2 : 4) {
      const d = progression[Math.floor(s / clip.stepsPerBar) % 4]!;
      clip.notes.push(
        makeNote(
          s,
          degree(d) - 12,
          intensity > 0.65 ? 1.5 : 3,
          s % clip.stepsPerBar === 0 ? 0.95 : 0.72,
        ),
      );
    }
  } else if (type === "drums") {
    for (let s = 0; s < steps; s++) {
      const bar = clip.stepsPerBar;
      if (s % 4 === 0 || (intensity > 0.75 && s % bar === bar - 2))
        clip.notes.push(makeNote(s, 0, 1, 0.95));
      if (s % 8 === 4) clip.notes.push(makeNote(s, 1, 1, 0.86));
      if (s % (intensity > 0.55 ? 2 : 4) === 0)
        clip.notes.push(makeNote(s, 2, 1, s % 4 === 2 ? 0.58 : 0.4));
      if (s % bar === bar - 1 && intensity > 0.45)
        clip.notes.push(makeNote(s, intensity > 0.8 ? 3 : 5, 1, 0.72));
      if (intensity > 0.68 && s % bar === bar - 4)
        clip.notes.push(makeNote(s, 4, 1, 0.68));
      if (intensity > 0.9 && s % bar === 0)
        clip.notes.push(makeNote(s, 6, 1, 0.7));
    }
  } else {
    const rhythm = intensity > 0.72 ? 2 : 4,
      shape = [0, 2, 4, 7, 4, 2, 5, 3];
    for (let s = 0; s < steps; s += rhythm) {
      const i = Math.floor(s / rhythm),
        oct = i % 8 === 3 && intensity > 0.65 ? 12 : 0;
      clip.notes.push(
        makeNote(
          s,
          degree(shape[i % shape.length]!) + oct,
          Math.max(1, rhythm * 0.75),
          s % clip.stepsPerBar === 0 ? 0.94 : 0.76,
        ),
      );
    }
  }
  return clip;
}

export type BackingStyle = "cinematic" | "driving" | "dark";
export function generateBacking(
  project: Project,
  {
    sections = 3,
    intensity = 0.68,
    style = "cinematic",
  }: { sections?: number; intensity?: number; style?: BackingStyle } = {},
): Scene[] {
  const count = Math.max(2, Math.min(6, Math.round(sections))),
    amount = Math.max(0.2, Math.min(1, intensity)),
    names = {
      cinematic: [
        "AWAKENING",
        "ASCENT",
        "CLIMAX",
        "AFTERMATH",
        "RETURN",
        "FINALE",
      ],
      driving: [
        "COUNT IN",
        "DRIVE",
        "OVERLOAD",
        "BREAKDOWN",
        "REPRISE",
        "FINAL HIT",
      ],
      dark: ["SHADOW", "PRESSURE", "ABYSS", "RITUAL", "ECLIPSE", "FALLOUT"],
    }[style],
    scenes: Scene[] = [];
  for (let index = 0; index < count; index++) {
    const curve =
        count === 1
          ? amount
          : Math.max(
              0.25,
              Math.min(1, amount * (0.62 + (0.55 * index) / (count - 1))),
            ),
      clipIds = { ...project.activeClipIds };
    for (const [track, type] of [
      ["bass", "bass"],
      ["pad", "chords"],
      ["drums", "drums"],
    ] as Array<[TrackId, string]>) {
      const generated = createClip(
        track,
        `${names[index] || `BASE ${index + 1}`} · ${TRACK_META[track].label}`,
        4,
        meterSteps(project.meter),
      );
      generated.instrument = structuredClone(
        activeClip(project, track).instrument,
      );
      generateClip(
        project,
        generated,
        type,
        style === "driving"
          ? Math.min(1, curve + 0.15)
          : style === "dark"
            ? Math.min(1, curve + 0.06)
            : curve,
      );
      if (style === "dark" && track !== "drums")
        for (const note of generated.notes)
          note.velocity = Math.min(1, note.velocity * 1.08);
      project.clips.push(generated);
      clipIds[track] = generated.id;
      if (index === 0) project.activeClipIds[track] = generated.id;
    }
    scenes.push({
      id: cryptoId(),
      name: names[index] || `BASE ${index + 1}`,
      clipIds,
      repeats: index === count - 1 && style === "cinematic" ? 2 : 1,
    });
  }
  project.arrangement = scenes;
  return scenes;
}

export interface PlaybackEvent {
  track: TrackId;
  step: number;
  pitch: number;
  basePitch: number;
  length: number;
  velocity: number;
  expression: NoteExpression;
  clipId: string;
  localStep: number;
}
export function sceneLengthSteps(project: Project, scene: Scene): number {
  return Math.max(
    ...TRACKS.map((t) =>
      clipLengthSteps(
        project.clips.find((c) => c.id === scene.clipIds[t]) ||
          activeClip(project, t),
      ),
    ),
  );
}
export function songDurationSteps(project: Project): number {
  return Math.max(
    project.arrangement.reduce(
      (sum, scene) => sum + sceneLengthSteps(project, scene) * scene.repeats,
      0,
    ),
    ...project.audioLanes.flatMap((lane) =>
      lane.regions.map((region) => region.startStep + region.lengthSteps),
    ),
  );
}
export function playbackEvents(
  project: Project,
  { song = true }: { song?: boolean } = {},
): { events: PlaybackEvent[]; durationSteps: number } {
  const events: PlaybackEvent[] = [];
  let durationSteps = 0;
  const append = (
    clip: Clip,
    track: TrackId,
    start: number,
    duration: number,
  ) => {
    const loops = Math.ceil(duration / clipLengthSteps(clip));
    for (let loop = 0; loop < loops; loop++) {
      const loopStart = start + loop * clipLengthSteps(clip);
      if (clip.character.arp.enabled && track !== "drums") {
        for (
          let s = 0;
          s <
          Math.min(
            duration - loop * clipLengthSteps(clip),
            clipLengthSteps(clip),
          );
          s++
        )
          for (const n of notesAtStep(project, clip, track, s))
            events.push({
              track,
              step: loopStart + s,
              pitch: n.pitch,
              basePitch: n.pitch,
              length: n.length,
              velocity: n.velocity,
              expression: n.expression,
              clipId: clip.id,
              localStep: s,
            });
      } else
        for (const n of clip.notes)
          if (loop * clipLengthSteps(clip) + n.step < duration)
            events.push({
              track,
              step: loopStart + n.step + n.offset,
              pitch: n.pitch + n.expression.bend,
              basePitch: n.pitch,
              length: Math.min(
                n.length,
                duration - (loop * clipLengthSteps(clip) + n.step),
              ),
              velocity: n.velocity * (0.65 + n.expression.pressure * 0.35),
              expression: n.expression,
              clipId: clip.id,
              localStep: n.step,
            });
    }
  };
  if (song) {
    for (const scene of project.arrangement) {
      const length = sceneLengthSteps(project, scene);
      for (let r = 0; r < scene.repeats; r++) {
        for (const track of TRACKS)
          append(
            project.clips.find((c) => c.id === scene.clipIds[track]) ||
              activeClip(project, track),
            track,
            durationSteps,
            length,
          );
        durationSteps += length;
      }
    }
  } else {
    durationSteps = Math.max(
      ...TRACKS.map((t) => clipLengthSteps(activeClip(project, t))),
    );
    for (const track of TRACKS)
      append(activeClip(project, track), track, 0, durationSteps);
  }
  if (song) durationSteps = Math.max(durationSteps, songDurationSteps(project));
  return { events, durationSteps };
}

const SECTION_NAMES = [
  "IGNITION",
  "ASCENT",
  "IMPACT",
  "BREAKDOWN",
  "AFTERMATH",
  "REPRISE",
  "OVERDRIVE",
  "FALLOUT",
];
export function addArrangementScene(project: Project): Scene {
  const last = project.arrangement.at(-1),
    clipIds = {} as Record<TrackId, string>;
  for (const track of TRACKS) {
    const clips = clipsForTrack(project, track),
      i = Math.max(
        -1,
        clips.findIndex((c) => c.id === last?.clipIds[track]),
      );
    clipIds[track] = clips[(i + 1) % clips.length]!.id;
  }
  const scene = {
    id: cryptoId(),
    name:
      SECTION_NAMES[project.arrangement.length] ||
      `SIGNAL ${String(project.arrangement.length + 1).padStart(2, "0")}`,
    clipIds,
    repeats: 1,
  };
  project.arrangement.push(scene);
  return scene;
}
export function duplicateArrangementScene(
  project: Project,
  index: number,
): Scene | null {
  const source = project.arrangement[index];
  if (!source) return null;
  const scene = {
    ...structuredClone(source),
    id: cryptoId(),
    name: `${source.name} COPY`,
  };
  project.arrangement.splice(index + 1, 0, scene);
  return scene;
}
export function moveArrangementScene(
  project: Project,
  from: number,
  to: number,
): boolean {
  if (
    from < 0 ||
    to < 0 ||
    from >= project.arrangement.length ||
    to >= project.arrangement.length ||
    from === to
  )
    return false;
  const [scene] = project.arrangement.splice(from, 1);
  project.arrangement.splice(to, 0, scene!);
  return true;
}
export function removeArrangementScene(
  project: Project,
  index: number,
): boolean {
  if (
    project.arrangement.length <= 1 ||
    index < 0 ||
    index >= project.arrangement.length
  )
    return false;
  project.arrangement.splice(index, 1);
  return true;
}
export function distributeArrangementPatterns(project: Project): boolean {
  for (const track of TRACKS) {
    const clips = clipsForTrack(project, track);
    if (!clips.length) return false;
    project.arrangement.forEach(
      (scene, index) =>
        (scene.clipIds[track] = clips[index % clips.length]!.id),
    );
  }
  return true;
}

function variable(n: number): number[] {
  const a = [n & 127];
  while ((n >>= 7)) a.unshift((n & 127) | 128);
  return a;
}
interface MidiItem {
  t: number;
  order: number;
  bytes: number[];
}
function trackChunk(
  events: PlaybackEvent[],
  channel: number,
  drums = false,
): number[] {
  const list: MidiItem[] = [];
  for (const n of events) {
    const midiChannel = drums ? 9 : channel,
      pitch = drums
        ? [36, 38, 42, 46, 45, 39, 49][n.pitch] || 36
        : Math.round(n.basePitch),
      start = Math.max(0, Math.round(n.step * 120)),
      end = Math.max(start + 1, Math.round((n.step + n.length) * 120));
    if (!drums) {
      const bend = Math.max(
        0,
        Math.min(16383, Math.round(8192 + (n.expression.bend / 2) * 8192)),
      );
      list.push(
        {
          t: start,
          order: 2,
          bytes: [0xe0 | midiChannel, bend & 127, bend >> 7],
        },
        {
          t: start,
          order: 2,
          bytes: [
            0xb0 | midiChannel,
            74,
            Math.round(n.expression.timbre * 127),
          ],
        },
        {
          t: start,
          order: 2,
          bytes: [0xd0 | midiChannel, Math.round(n.expression.pressure * 127)],
        },
        { t: end, order: 1, bytes: [0xe0 | midiChannel, 0, 64] },
      );
    }
    list.push(
      {
        t: start,
        order: 3,
        bytes: [
          0x90 | midiChannel,
          pitch,
          Math.max(1, Math.round(n.velocity * 127)),
        ],
      },
      { t: end, order: 0, bytes: [0x80 | midiChannel, pitch, 0] },
    );
  }
  list.sort((a, b) => a.t - b.t || a.order - b.order);
  let last = 0;
  const data: number[] = [];
  for (const item of list) {
    data.push(...variable(item.t - last), ...item.bytes);
    last = item.t;
  }
  data.push(0, 0xff, 0x2f, 0);
  return data;
}
export function encodeMidi(
  project: Project,
  { song = true }: { song?: boolean } = {},
): Uint8Array {
  const { events } = playbackEvents(project, { song }),
    chunks: number[][] = [],
    u32 = (n: number) => [
      (n >>> 24) & 255,
      (n >>> 16) & 255,
      (n >>> 8) & 255,
      n & 255,
    ],
    u16 = (n: number) => [(n >>> 8) & 255, n & 255],
    meta: number[] = [];
  const changes: Array<{ step: number; bytes: number[] }> = [];
  const duration = playbackEvents(project, { song }).durationSteps;
  const tempoSteps = new Set<number>([0]);
  for (const event of project.tempoMap) {
    if (event.step <= duration) tempoSteps.add(event.step);
    const next = [...project.tempoMap]
      .sort((a, b) => a.step - b.step)
      .find((item) => item.step > event.step);
    if (event.curve === "linear" && next)
      for (
        let step = event.step + 0.25;
        step < Math.min(next.step, duration);
        step += 0.25
      )
        tempoSteps.add(step);
  }
  for (const step of tempoSteps) {
    const tempo = Math.round(60000000 / tempoAtStep(project, step));
    changes.push({
      step,
      bytes: [
        0xff,
        0x51,
        3,
        (tempo >> 16) & 255,
        (tempo >> 8) & 255,
        tempo & 255,
      ],
    });
  }
  const meters = [{ step: 0, ...project.meter }, ...project.meterMap];
  for (const event of meters.filter((item) => item.step <= duration))
    changes.push({
      step: event.step,
      bytes: [0xff, 0x58, 4, event.beats, Math.log2(event.unit), 24, 8],
    });
  changes.sort((a, b) => a.step - b.step);
  let lastTick = 0;
  for (const change of changes) {
    const tick = Math.round(change.step * 120);
    meta.push(...variable(tick - lastTick), ...change.bytes);
    lastTick = tick;
  }
  meta.push(0, 0xff, 0x2f, 0);
  chunks.push(meta);
  TRACKS.forEach((track, i) =>
    chunks.push(
      trackChunk(
        events.filter((e) => e.track === track),
        i,
        track === "drums",
      ),
    ),
  );
  const bytes = [
    77,
    84,
    104,
    100,
    ...u32(6),
    ...u16(1),
    ...u16(chunks.length),
    ...u16(480),
  ];
  for (const data of chunks)
    bytes.push(77, 84, 114, 107, ...u32(data.length), ...data);
  return new Uint8Array(bytes);
}

export class History<T = Project> {
  readonly limit: number;
  past: T[] = [];
  future: T[] = [];
  constructor(limit = 60) {
    this.limit = limit;
  }
  push(value: T): void {
    this.past.push(structuredClone(value));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: T): T {
    if (!this.past.length) return current;
    this.future.push(structuredClone(current));
    return this.past.pop()!;
  }
  redo(current: T): T {
    if (!this.future.length) return current;
    this.past.push(structuredClone(current));
    return this.future.pop()!;
  }
}
