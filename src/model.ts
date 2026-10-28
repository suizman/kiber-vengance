export const trackIds = ["lead", "guitar", "bass", "pad", "drums"] as const;
export type TrackId = (typeof trackIds)[number];
export type Waveform =
  "sine" | "square" | "sawtooth" | "triangle" | "pulse" | "metal";
export type FilterMode = "lowpass" | "highpass" | "bandpass";
export type ArpMode = "up" | "down" | "updown" | "random";
export type AutomationParameter = "cutoff" | "volume" | "pan";
export type SendMode = "pre" | "post";
export type PerformanceEventKind =
  "macro" | "mixer" | "scratch" | "scene" | "launcher";
export type AutomationCurve = "linear" | "smooth" | "step" | "exponential";
export type AutomationWriteMode = "read" | "touch" | "latch" | "write";
export type AudioWarpMode = "repitch" | "stretch";

export interface NoteExpression {
  pressure: number;
  timbre: number;
  bend: number;
}
export interface NoteEvent {
  id: string;
  step: number;
  pitch: number;
  length: number;
  velocity: number;
  offset: number;
  expression: NoteExpression;
}
export interface Automation {
  cutoff: Record<number, number>;
  volume: Record<number, number>;
  pan: Record<number, number>;
}
export interface EffectChain {
  [key: string]: any;
  bypass: boolean;
  distortion: number;
  saturation: number;
  chorus: number;
  delay: number;
  reverb: number;
  tone: number;
}
export interface Arpeggiator {
  [key: string]: any;
  enabled: boolean;
  mode: ArpMode;
  octaves: number;
  rate: number;
}
export interface Modulation {
  [key: string]: any;
  enabled: boolean;
  target: "cutoff" | "pitch" | "pan";
  rate: number;
  depth: number;
}
export interface MacroState {
  [key: string]: number;
  energy: number;
  darkness: number;
  tension: number;
  aggression: number;
  space: number;
  complexity: number;
}
export interface ClipCharacter {
  arp: Arpeggiator;
  lfo: Modulation;
  fx: EffectChain;
  macros: MacroState;
}
export interface Clip {
  id: string;
  track: TrackId;
  name: string;
  bars: number;
  stepsPerBar: number;
  notes: NoteEvent[];
  automation: Automation;
  character: ClipCharacter;
  instrument: InstrumentState;
}
export interface TrackState {
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  preset: string;
  wave?: Waveform;
  osc2Wave?: Waveform | "off";
  osc2Mix?: number;
  filterType?: FilterMode;
  cutoff?: number;
  resonance?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  glide?: number;
  unison?: number;
  detune?: number;
  preGainDb: number;
  sendMode: SendMode;
  color: string;
  groupId?: string | null;
}
// Mixer settings remain on TrackState; its instrument fields also support legacy files.
export type InstrumentState = Pick<
  TrackState,
  | "preset"
  | "wave"
  | "osc2Wave"
  | "osc2Mix"
  | "filterType"
  | "cutoff"
  | "resonance"
  | "attack"
  | "decay"
  | "sustain"
  | "release"
  | "glide"
  | "unison"
  | "detune"
>;
export interface Scene {
  id: string;
  name: string;
  clipIds: Record<TrackId, string>;
  repeats: number;
}
export interface SongMarker {
  id: string;
  step: number;
  name: string;
  color: string;
}
export interface PerformanceEvent {
  id: string;
  step: number;
  kind: PerformanceEventKind;
  target: string;
  value: number | string | boolean;
}
export interface PerformanceTake {
  id: string;
  name: string;
  createdAt: number;
  durationSteps: number;
  trimStart: number;
  trimEnd: number;
  events: PerformanceEvent[];
  audioAssetId?: string;
  mimeType?: string;
}
export interface SampleSlice {
  id: string;
  name: string;
  start: number;
  end: number;
  rootNote: number;
}
export interface SampleAsset {
  id: string;
  name: string;
  slot: number;
  size: number;
  type: string;
  trimStart: number;
  trimEnd: number;
  tune: number;
  attack: number;
  release: number;
  reverse: boolean;
  mode?: "one-shot" | "gate" | "loop";
  rootNote?: number;
  chokeGroup?: number;
  loopStart?: number;
  loopEnd?: number;
  slices?: SampleSlice[];
}
export interface SamplerInstrument {
  assetId: string | null;
  name: string;
  size: number;
  type: string;
  duration: number;
  rootNote: number;
  tune: number;
  gain: number;
  attack: number;
  release: number;
  filter: number;
  trimStart: number;
  trimEnd: number;
  mode: "one-shot" | "gate" | "loop";
  reverse: boolean;
  polyphony: number;
}
export interface AudioEffects {
  bypass: boolean;
  filter: number;
  tone: number;
  compression: number;
  saturation: number;
  distortion: number;
  chorus: number;
  delay: number;
  reverb: number;
}
export interface OutputMix {
  master: number;
  deckA: number;
  deckB: number;
  cue: number;
  preview: number;
  muted: boolean;
}
export interface SpeechGeneration {
  kind: "speech";
  engine?: "kokoro" | "chatterbox";
  device?: "wasm" | "webgpu";
  intensity?: number;
  pauseMs?: number;
  segments?: { text: string; speed: number; pauseMs: number }[];
  revision?: string;
  precision?: string;
  model: string;
  text: string;
  language: "en" | "es";
  voice: string;
  speed: number;
  dtype: "fp32" | "q8";
  phonemes: string;
  createdAt: number;
}
export interface AudioRegion {
  effects?: AudioEffects;
  generation?: SpeechGeneration;
  id: string;
  assetId: string;
  name: string;
  startStep: number;
  lengthSteps: number;
  offsetSeconds: number;
  durationSeconds: number;
  gainDb: number;
  fadeInSteps: number;
  fadeOutSteps: number;
  pitch: number;
  sourceBpm: number;
  warp: boolean;
  warpMode: AudioWarpMode;
  reverse: boolean;
}
export interface AudioLane {
  effects?: AudioEffects;
  preGainDb?: number;
  id: string;
  name: string;
  color: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  groupId: string | null;
  regions: AudioRegion[];
}
export interface AutomationPoint {
  id: string;
  step: number;
  value: number;
  curve: AutomationCurve;
}
export interface AutomationLane {
  id: string;
  name: string;
  target: string;
  min: number;
  max: number;
  enabled: boolean;
  writeMode: AutomationWriteMode;
  points: AutomationPoint[];
}
export interface ModulationRoute {
  id: string;
  source:
    | "lfo-1"
    | "lfo-2"
    | "velocity"
    | "pressure"
    | "envelope"
    | "macro-energy"
    | "macro-space";
  target: string;
  amount: number;
  bipolar: boolean;
  rate: number;
}
export interface MixerGroup {
  id: string;
  name: string;
  color: string;
  volume: number;
  mute: boolean;
  solo: boolean;
  sidechainSource: TrackId | "none";
  sidechainAmount: number;
}
export interface TempoEvent {
  id: string;
  step: number;
  bpm: number;
  curve: "jump" | "linear";
}
export interface MeterEvent {
  id: string;
  step: number;
  beats: number;
  unit: 4 | 8;
}
export interface MidiMapping {
  id: string;
  channel: number;
  controller: number;
  target: string;
  min: number;
  max: number;
}
export interface MasteringSettings {
  bypass: boolean;
  targetLufs: number;
  ceilingDb: number;
  monoCheck: boolean;
  referenceLevel: number;
}
export interface Project {
  version: 6;
  id: string;
  title: string;
  modifiedAt: number;
  tempo: number;
  swing: number;
  meter: { beats: number; unit: 4 | 8 };
  key: string;
  scale: string;
  master: number;
  outputMix?: OutputMix;
  tracks: Record<TrackId, TrackState>;
  clips: Clip[];
  activeClipIds: Record<TrackId, string>;
  arrangement: Scene[];
  editor: {
    snap: number;
    zoom: number;
    pitchLow: number;
    pitchHigh: number;
    automationParam: AutomationParameter;
    recordMode: "quantized" | "free";
    arrangeZoom: number;
  };
  markers: SongMarker[];
  loop: { enabled: boolean; start: number; end: number; punch: boolean };
  launcher: { quantization: number };
  performanceTakes: PerformanceTake[];
  samples: SampleAsset[];
  sampler: SamplerInstrument;
  audioLanes: AudioLane[];
  automationLanes: AutomationLane[];
  modulationRoutes: ModulationRoute[];
  mixerGroups: MixerGroup[];
  tempoMap: TempoEvent[];
  meterMap: MeterEvent[];
  midiMappings: MidiMapping[];
  masterSettings: MasteringSettings;
}

export function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Project>;
  return (
    candidate.version === 6 &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.clips) &&
    Array.isArray(candidate.arrangement) &&
    trackIds.every(
      (track) => typeof candidate.activeClipIds?.[track] === "string",
    )
  );
}
