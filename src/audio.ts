import { createTempoClock } from "./state/tempo-clock";
import { encodeWavPcm } from "./audio/wav-codec";
import { encodeAudioBuffer, offlineContext } from "./audio/wav-export";
import {
  prepareGmNotes,
  prepareGmProject,
  playGmNote,
  type SampleVoice,
} from "./audio/gm-bank";
import { projectTrackIds, trackState } from "./state/tracks";
import { StereoMeter } from "./audio/meter";
import { AudioFx } from "./audio/effects";
import { normalizeOutputMix } from "./core";
import { DeckProcessor, type DeckId } from "./audio/deck";
import scratchWorkletUrl from "./scratch-worklet.ts?worker&url";
import {
  activeClip,
  clipTrackState,
  audioRegionRate,
  automationValue,
  clipLengthSteps,
  dbToGain,
  masterValue,
  mixAudible,
  frequency,
  meterSteps,
  notesAtStep,
  playbackEvents,
  renderAssets,
  sceneLengthSteps,
  songDurationSteps,
  sidechainFactor,
  secondsPerStep,
} from "./core.js";
import type {
  ClipCharacter,
  MacroState,
  NoteExpression,
  Project,
  SamplerInstrument,
  TrackId,
  TrackState,
  Waveform,
} from "./model.js";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const STANDARD_WAVES = new Set<string>([
  "sine",
  "square",
  "sawtooth",
  "triangle",
]);
function applyWave(
  context: BaseAudioContext,
  oscillator: OscillatorNode,
  wave: Waveform = "sawtooth",
) {
  if (STANDARD_WAVES.has(wave)) {
    oscillator.type = wave as OscillatorType;
    return;
  }
  const count = 32,
    real = new Float32Array(count),
    imag = new Float32Array(count);
  for (let harmonic = 1; harmonic < count; harmonic++) {
    if (wave === "pulse")
      imag[harmonic] =
        (2 * Math.sin(Math.PI * harmonic * 0.25)) / (Math.PI * harmonic);
    else {
      const metallic = [1, 1.414, 2.31, 3.76, 5.43, 8.21],
        distance = Math.min(...metallic.map((r) => Math.abs(harmonic - r)));
      imag[harmonic] = Math.exp(-distance * 1.6) / harmonic ** 0.35;
    }
  }
  oscillator.setPeriodicWave(
    context.createPeriodicWave(real, imag, { disableNormalization: false }),
  );
}

interface LiveVoice {
  id: string;
  track: TrackId;
  pitch: number;
  velocity: number;
  channel: number | null;
  cfg: TrackState;
  macros: MacroState;
  filter: BiquadFilterNode;
  gain: GainNode;
  pan: StereoPannerNode;
  oscillators: Array<{ node: OscillatorNode; ratio: number }>;
  expression: NoteExpression;
}
interface InstrumentBus {
  pre: GainNode;
  reverb: ConvolverNode;
  input: GainNode;
  tone: BiquadFilterNode;
  saturation: WaveShaperNode;
  shape: WaveShaperNode;
  dry: GainNode;
  chorus: DelayNode;
  chorusWet: GainNode;
  lfo: OscillatorNode;
  depth: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  delayWet: GainNode;
  reverbWet: GainNode;
  output: GainNode;
  sendOutput: GainNode;
  analyser: AnalyserNode;
  distortionAmount?: number;
  saturationAmount?: number;
}

export class AudioEngine {
  /** Assigned once by init(); public audio operations initialize or guard it. */
  ctx!: AudioContext;
  master!: GainNode;
  masterTone!: BiquadFilterNode;
  compressor!: DynamicsCompressorNode;
  limiter!: DynamicsCompressorNode;
  programGain!: GainNode;
  analyser!: AnalyserNode;
  captureDestination!: MediaStreamAudioDestinationNode;
  impulse?: AudioBuffer;
  sceneIndex = 0;
  sceneStep = 0;
  sceneRepeat = 0;
  countInRemaining = 0;
  sequenceStartTime = 0;
  performanceRecorder?: MediaRecorder;
  performanceChunks: Blob[] = [];
  buses: Record<string, InstrumentBus> = {};
  project!: Project;
  timer: ReturnType<typeof setInterval> | null = null;
  nextTime = 0;
  position = 0;
  playing = false;
  countingIn = false;
  onStep: (
    step: number,
    time: number,
    scene: number,
    info: Record<string, unknown>,
  ) => void;
  songMode = false;
  lastFrequency: Partial<Record<TrackId, number>> = {};
  metronome = false;
  liveVoices = new Map<string, LiveVoice>();
  samplerBuffer: AudioBuffer | null = null;
  samplerVoices = new Map<
    string,
    {
      source: AudioBufferSourceNode;
      filter: BiquadFilterNode;
      gain: GainNode;
      settings: SamplerInstrument;
    }
  >();
  launchQueue = new Map<TrackId, { clipId: string; quantization: number }>();
  launcherStopped = new Set<TrackId>();
  onLaunch: ((track: TrackId, clipId: string, step: number) => void) | null =
    null;
  onScratchGesture: ((target: string, value: number | boolean) => void) | null =
    null;
  drumSamples = new Map<
    number,
    {
      buffer: AudioBuffer;
      trimStart: number;
      trimEnd: number;
      tune: number;
      attack: number;
      release: number;
      reverse: boolean;
    }
  >();
  audioAssets = new Map<string, AudioBuffer>();
  audioLaneOutputs = new Map<string, GainNode>();
  audioLaneGraphs = new Map<
    string,
    {
      fx: AudioFx;
      pre: GainNode;
      pan: StereoPannerNode;
      meter: AnalyserNode;
      stereo: StereoMeter;
    }
  >();
  regionGraphs = new Map<AudioFx, string>();
  regionCleanup = new Map<AudioFx, ReturnType<typeof setTimeout>>();
  trackInputs = new Map<TrackId, GainNode>();
  outputMeter: StereoMeter | null = null;
  deckMeters = new Map<DeckId, StereoMeter>();
  instrumentMeters = new Map<TrackId, StereoMeter>();
  finalInput!: GainNode;
  finalGain!: GainNode;
  samplerOutput!: GainNode;
  finalLimiter!: DynamicsCompressorNode;
  previewGain!: GainNode;
  previewSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  cuedDeck: DeckId | null = null;

  activeAudioSources = new Set<AudioBufferSourceNode>();
  audioResumeStep: number | null = null;
  lastKickTime = -Infinity;
  readonly decks = {
    A: new DeckProcessor("A", (target, value) =>
      this.onScratchGesture?.(target, value),
    ),
    B: new DeckProcessor("B", (target, value) =>
      this.onScratchGesture?.(target, value),
    ),
  };
  private deckInitialization: Promise<void> | null = null;
  scratchCueDestination!: MediaStreamAudioDestinationNode;
  scratchCrossfade = 0;
  scratchMix = 0;
  scratchError = "";
  deck(id: DeckId = "A") {
    return this.decks[id];
  }
  get scratchNode() {
    return this.decks.A.node;
  }
  get scratchFilter() {
    return this.decks.A.filter;
  }
  get scratchGain() {
    return this.decks.A.gain;
  }
  get scratchFrames() {
    return this.decks.A.frames;
  }
  get scratchSampleRate() {
    return this.decks.A.sampleRate;
  }
  get scratchReady() {
    return this.decks.A.ready;
  }
  get scratchPlaying() {
    return this.decks.A.playing;
  }
  set scratchPlaying(value: boolean) {
    this.decks.A.playing = value;
  }
  get scratchPosition() {
    return this.decks.A.position;
  }
  set scratchPosition(value: number) {
    this.decks.A.position = value;
  }
  get scratchSpeed() {
    return this.decks.A.speed;
  }
  set scratchSpeed(value: number) {
    this.decks.A.speed = value;
  }
  get onScratchPosition() {
    return this.decks.A.onPosition;
  }
  set onScratchPosition(
    value: import("./audio/deck").DeckProcessor["onPosition"],
  ) {
    this.decks.A.onPosition = value;
  }
  get scratchNodeB() {
    return this.decks.B.node;
  }
  get scratchFilterB() {
    return this.decks.B.filter;
  }
  get scratchGainB() {
    return this.decks.B.gain;
  }
  get scratchFramesB() {
    return this.decks.B.frames;
  }
  get scratchSampleRateB() {
    return this.decks.B.sampleRate;
  }
  get scratchReadyB() {
    return this.decks.B.ready;
  }
  get scratchPlayingB() {
    return this.decks.B.playing;
  }
  set scratchPlayingB(value: boolean) {
    this.decks.B.playing = value;
  }
  get scratchPositionB() {
    return this.decks.B.position;
  }
  set scratchPositionB(value: number) {
    this.decks.B.position = value;
  }
  get scratchSpeedB() {
    return this.decks.B.speed;
  }
  set scratchSpeedB(value: number) {
    this.decks.B.speed = value;
  }
  get onScratchPositionB() {
    return this.decks.B.onPosition;
  }
  set onScratchPositionB(
    value: import("./audio/deck").DeckProcessor["onPosition"],
  ) {
    this.decks.B.onPosition = value;
  }
  constructor(
    onStep: (
      step: number,
      time: number,
      scene: number,
      info: Record<string, unknown>,
    ) => void = () => {},
  ) {
    this.onStep = onStep;
  }
  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext!)({
        latencyHint: "interactive",
      });
      this.master = this.ctx.createGain();
      this.samplerOutput = this.ctx.createGain();
      this.samplerOutput.connect(this.master);
      this.masterTone = this.ctx.createBiquadFilter();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.programGain = this.ctx.createGain();
      this.scratchCueDestination = this.ctx.createMediaStreamDestination();
      this.analyser = this.ctx.createAnalyser();
      this.captureDestination = this.ctx.createMediaStreamDestination();
      this.masterTone.type = "highshelf";
      this.masterTone.frequency.value = 5200;
      this.masterTone.gain.value = 1.2;
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 3;
      this.compressor.attack.value = 0.012;
      this.compressor.release.value = 0.2;
      this.limiter.threshold.value = -1.5;
      this.limiter.knee.value = 1;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.001;
      this.limiter.release.value = 0.08;
      this.analyser.fftSize = 256;
      this.scratchCrossfade = 0;
      this.scratchMix = 0;
      this.finalInput = this.ctx.createGain();
      this.finalGain = this.ctx.createGain();
      this.finalLimiter = this.ctx.createDynamicsCompressor();
      this.finalLimiter.threshold.value = -1;
      this.finalLimiter.knee.value = 0;
      this.finalLimiter.ratio.value = 20;
      this.finalLimiter.attack.value = 0.001;
      this.finalLimiter.release.value = 0.08;
      this.previewGain = this.ctx.createGain();
      this.master
        .connect(this.masterTone)
        .connect(this.compressor)
        .connect(this.programGain)
        .connect(this.finalInput);
      this.finalInput
        .connect(this.finalGain)
        .connect(this.finalLimiter)
        .connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.analyser.connect(this.captureDestination);
      this.outputMeter = new StereoMeter(this.ctx, this.analyser);
      this.previewGain.connect(this.ctx.destination);
      for (const deck of Object.values(this.decks)) {
        deck.connect(this.ctx, this.finalInput, this.scratchCueDestination);
        this.deckMeters.set(deck.id, new StereoMeter(this.ctx, deck.gain!));
      }
      this.createEffectBuses();
      // Apply persisted levels before the first live note or sampler voice.
      const initialMix = normalizeOutputMix(this.project?.outputMix);
      this.finalGain.gain.value = initialMix.muted ? 0 : initialMix.master;
      this.previewGain.gain.value = initialMix.muted
        ? 0
        : initialMix.master * initialMix.preview;
      this.samplerOutput.gain.value = this.project?.sampler?.gain ?? 1;
      this.master.gain.value = this.project?.master ?? 1;
      if (this.project) this.setProject(this.project);
      if (this.ctx.state === "suspended") await this.ctx.resume();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    await this.initScratchDeck();
    return this.ctx;
  }
  async initScratchDeck() {
    if (!this.ctx?.audioWorklet) return;
    if (!this.deckInitialization)
      this.deckInitialization = (async () => {
        const moduleUrl = import.meta.env.DEV
          ? `${import.meta.env.BASE_URL}src/scratch-worklet.ts`
          : scratchWorkletUrl;
        await this.ctx.audioWorklet.addModule(moduleUrl);
        for (const deck of Object.values(this.decks)) deck.attach(this.ctx);
      })().catch((error: unknown) => {
        this.scratchError =
          error instanceof Error ? error.message : String(error);
        this.deckInitialization = null;
      });
    await this.deckInitialization;
  }
  async loadScratchBuffer(buffer: AudioBuffer, deck: DeckId = "A") {
    await this.init();
    await this.decks[deck].load(buffer);
    this.decks[deck].setSpeed(1, 0);
    this.setScratchMix(0.72);
  }
  setScratchPlaying(value: boolean, deck: DeckId = "A") {
    this.decks[deck].setPlaying(value);
  }
  setScratchSpeed(value: number, ramp = 0.025, deck: DeckId = "A") {
    this.decks[deck].setSpeed(value, ramp);
  }
  setScratchMix(value: number) {
    this.scratchMix = Math.max(0, Math.min(1, value));
    this.updateScratchGains();
    this.onScratchGesture?.("mix", this.scratchMix);
  }
  setScratchCrossfade(value: number) {
    this.scratchCrossfade = Math.max(0, Math.min(1, value));
    this.updateScratchGains();
    this.onScratchGesture?.("crossfade", this.scratchCrossfade);
  }
  setScratchCue(deck: "A" | "B" | null) {
    if (!this.ctx || !this.decks.A.cueGain || !this.decks.B.cueGain) return;
    const now = this.ctx.currentTime;
    this.cuedDeck = deck;
    const level = normalizeOutputMix(this.project?.outputMix).cue;
    this.decks.A.cueGain.gain.setTargetAtTime(
      deck === "A" ? level : 0,
      now,
      0.015,
    );
    this.decks.B.cueGain.gain.setTargetAtTime(
      deck === "B" ? level : 0,
      now,
      0.015,
    );
  }
  updateScratchGains() {
    if (
      !this.ctx ||
      !this.programGain ||
      !this.scratchGain ||
      !this.scratchGainB
    )
      return;
    const mix = this.scratchMix ?? 0,
      crossfade = this.scratchCrossfade ?? 0,
      now = this.ctx.currentTime,
      deckGain = Math.sin((mix * Math.PI) / 2);
    this.programGain.gain.setTargetAtTime(
      Math.cos((mix * Math.PI) / 2),
      now,
      0.018,
    );
    this.scratchGain.gain.setTargetAtTime(
      deckGain *
        Math.cos((crossfade * Math.PI) / 2) *
        normalizeOutputMix(this.project?.outputMix).deckA,
      now,
      0.018,
    );
    this.scratchGainB.gain.setTargetAtTime(
      deckGain *
        Math.sin((crossfade * Math.PI) / 2) *
        normalizeOutputMix(this.project?.outputMix).deckB,
      now,
      0.018,
    );
  }
  setScratchFilter(value: number, deck: DeckId = "A") {
    this.decks[deck].setFilter(value);
  }
  setScratchStutter(frames: number, deck: DeckId = "A") {
    this.decks[deck].setStutter(frames);
  }
  syncScratch(beatFrames: number, deck: DeckId = "A", speed = 1) {
    this.decks[deck].sync(beatFrames, speed);
  }
  updateOutputMix() {
    if (!this.ctx || !this.finalGain) return;
    const mix = normalizeOutputMix(this.project?.outputMix),
      now = this.ctx.currentTime;
    this.finalGain.gain.setTargetAtTime(mix.muted ? 0 : mix.master, now, 0.02);
    this.previewGain.gain.setTargetAtTime(
      mix.muted ? 0 : mix.master * mix.preview,
      now,
      0.02,
    );
    this.updateScratchGains();
    this.setScratchCue(this.cuedDeck);
  }
  async routePreview(element: HTMLMediaElement) {
    await this.init();
    if (!this.previewSources.has(element)) {
      const node = this.ctx.createMediaElementSource(element);
      node.connect(this.previewGain);
      this.previewSources.set(element, node);
    }
    this.updateOutputMix();
  }
  disposeAudioLane(id: string) {
    const graph = this.audioLaneGraphs.get(id);
    if (graph) {
      graph.fx.dispose();
      graph.pre.disconnect();
      graph.pan.disconnect();
      graph.meter.disconnect();
      graph.stereo.dispose();
      this.audioLaneGraphs.delete(id);
    }
  }
  audioLaneMeter(id: string) {
    return (
      this.audioLaneGraphs.get(id)?.stereo.read() ?? {
        left: 0,
        right: 0,
        peak: 0,
        rms: 0,
      }
    );
  }
  private tempoClock?: ReturnType<typeof createTempoClock>;
  private get clock() {
    return (this.tempoClock ??= createTempoClock(this.project));
  }
  setProject(project: Project) {
    this.project = project;
    this.tempoClock = createTempoClock(project);
    if (this.samplerOutput)
      this.samplerOutput.gain.setTargetAtTime(
        project.sampler.gain,
        this.ctx.currentTime,
        0.02,
      );
    this.updateOutputMix();
    for (const [fx, id] of this.regionGraphs) {
      const region = project.audioLanes
        .flatMap((lane) => lane.regions)
        .find((region) => region.id === id);
      if (region) fx.update(region.effects);
    }
    for (const [id, graph] of this.audioLaneGraphs) {
      const lane = project.audioLanes.find((lane) => lane.id === id);
      if (lane) {
        graph.fx.update(lane.effects);
        graph.pre.gain.setTargetAtTime(
          dbToGain(lane.preGainDb ?? 0),
          this.ctx.currentTime,
          0.02,
        );
        graph.pan.pan.setTargetAtTime(lane.pan, this.ctx.currentTime, 0.02);
      }
    }
    for (const [id, output] of this.audioLaneOutputs) {
      const lane = project.audioLanes.find((item) => item.id === id);
      const group = project.mixerGroups.find(
        (item) => item.id === lane?.groupId,
      );
      output.gain.setTargetAtTime(
        lane && mixAudible(project, id)
          ? lane.volume * (group?.volume ?? 1)
          : 0,
        this.ctx.currentTime,
        0.02,
      );
      if (!lane) {
        output.disconnect();
        this.disposeAudioLane(id);
        this.audioLaneOutputs.delete(id);
      }
    }
    if (this.master) {
      const bypass = Boolean(project.masterSettings?.bypass),
        now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(project.master, now, 0.02);
      this.masterTone.gain.setTargetAtTime(bypass ? 0 : 1.2, now, 0.02);
      this.compressor.ratio.setTargetAtTime(bypass ? 1 : 3, now, 0.02);
      this.compressor.threshold.setTargetAtTime(
        Math.max(
          -30,
          Math.min(-6, (project.masterSettings?.targetLufs ?? -14) - 1),
        ),
        now,
        0.02,
      );
      this.finalLimiter.threshold.setTargetAtTime(
        project.masterSettings?.ceilingDb ?? -1,
        now,
        0.02,
      );
      this.finalLimiter.ratio.setTargetAtTime(bypass ? 1 : 20, now, 0.02);
      this.finalInput.channelCount = project.masterSettings?.monoCheck ? 1 : 2;
      this.finalInput.channelCountMode = project.masterSettings?.monoCheck
        ? "explicit"
        : "max";
      this.createEffectBuses();
      for (const id of projectTrackIds(this.project)) {
        this.updateEffectBus(
          id,
          clipTrackState(project, activeClip(project, id), this.position),
          activeClip(project, id).character,
        );
      }
    }
  }
  private launchReservations: Array<() => void> = [];
  get loadingInstruments() {
    return Boolean(this.starting);
  }
  private pendingLaunches = new Map<TrackId, AbortController>();
  async prepareClipLaunch(track: TrackId, clipId: string) {
    this.pendingLaunches.get(track)?.abort();
    const request = new AbortController();
    this.pendingLaunches.set(track, request);
    try {
      const prepared = {
        ...this.project,
        activeClipIds: { ...this.project.activeClipIds, [track]: clipId },
      };
      const release = await prepareGmProject(prepared, false, request.signal);
      if (request.signal.aborted || !this.playing) {
        release();
        return false;
      }
      this.launchReservations.push(release);
      return true;
    } finally {
      if (this.pendingLaunches.get(track) === request)
        this.pendingLaunches.delete(track);
    }
  }
  queueClip(track: TrackId, clipId: string, quantization = 16) {
    if (
      !this.project.clips.some(
        (clip) => clip.id === clipId && clip.track === track,
      )
    )
      return false;
    this.launchQueue ??= new Map();
    this.launchQueue.set(track, {
      clipId,
      quantization: Math.max(1, Math.round(quantization)),
    });
    return true;
  }
  stopLauncherTrack(track: TrackId, stopped = true) {
    this.launcherStopped ??= new Set<TrackId>();
    if (stopped) {
      this.pendingLaunches.get(track)?.abort();
      this.launcherStopped.add(track);
      for (const [id, voice] of this.gmVoices)
        if (voice.track === track) this.stopLive(id);
      for (const [id, voice] of this.liveVoices)
        if (voice.track === track) this.stopLive(id);
    } else this.launcherStopped.delete(track);
    return stopped;
  }
  async setDrumSample(
    kind: number,
    data: ArrayBuffer,
    settings: Partial<{
      trimStart: number;
      trimEnd: number;
      tune: number;
      attack: number;
      release: number;
      reverse: boolean;
    }> = {},
  ) {
    await this.init();
    const buffer = await this.ctx.decodeAudioData(data.slice(0));
    if (settings.reverse)
      for (let channel = 0; channel < buffer.numberOfChannels; channel++)
        buffer.getChannelData(channel).reverse();
    this.drumSamples.set(kind, {
      buffer,
      trimStart: settings.trimStart ?? 0,
      trimEnd: settings.trimEnd ?? 1,
      tune: settings.tune ?? 0,
      attack: settings.attack ?? 0.002,
      release: settings.release ?? 0.08,
      reverse: settings.reverse ?? false,
    });
    return buffer.duration;
  }
  clearDrumSample(kind: number) {
    this.drumSamples.delete(kind);
  }
  async setAudioAsset(id: string, data: ArrayBuffer) {
    await this.init();
    const buffer = await this.ctx.decodeAudioData(data.slice(0));
    this.audioAssets.set(id, buffer);
    return buffer.duration;
  }
  clearAudioAsset(id: string) {
    this.audioAssets.delete(id);
  }
  async setSamplerSample(data: ArrayBuffer, reverse = false) {
    await this.init();
    const decoded: AudioBuffer = await this.ctx.decodeAudioData(data.slice(0));
    if (!reverse) this.samplerBuffer = decoded;
    else {
      const flipped = this.ctx.createBuffer(
        decoded.numberOfChannels,
        decoded.length,
        decoded.sampleRate,
      );
      for (let channel = 0; channel < decoded.numberOfChannels; channel++)
        flipped.copyToChannel(
          Float32Array.from(decoded.getChannelData(channel)).reverse(),
          channel,
        );
      this.samplerBuffer = flipped;
    }
    return decoded.duration;
  }
  clearSamplerSample() {
    for (const id of this.samplerVoices.keys()) this.stopSampler(id, true);
    this.samplerBuffer = null;
  }
  private pendingSampler = new Map<string, symbol>();
  async startSampler(
    id: string,
    pitch: number,
    velocity = 0.8,
    settings: SamplerInstrument = this.project.sampler,
  ) {
    const request = Symbol();
    this.pendingSampler.set(id, request);
    await this.init();
    if (this.pendingSampler.get(id) !== request) return false;
    const buffer = this.samplerBuffer;
    if (!buffer) return false;
    this.stopSampler(id, true);
    while (this.samplerVoices.size >= Math.max(1, settings.polyphony || 12))
      this.stopSampler(this.samplerVoices.keys().next().value!, true);
    const now = this.ctx.currentTime,
      start = Math.max(0, Math.min(0.98, settings.trimStart)) * buffer.duration,
      end =
        Math.max(start + 0.001, Math.min(1, settings.trimEnd)) *
        buffer.duration,
      duration = end - start,
      rate = 2 ** ((pitch - settings.rootNote + settings.tune) / 12),
      source = this.ctx.createBufferSource(),
      filter = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain(),
      level = Math.max(0.001, velocity),
      attack = Math.min(
        (duration / rate) * 0.45,
        Math.max(0.001, settings.attack),
      );
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.loop = settings.mode === "loop";
    source.loopStart = start;
    source.loopEnd = end;
    filter.type = "lowpass";
    filter.frequency.value =
      160 + Math.max(0, Math.min(1, settings.filter)) ** 2 * 19840;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + attack);
    source.connect(filter).connect(gain).connect(this.samplerOutput);
    const voice = { source, filter, gain, settings };
    this.samplerVoices.set(id, voice);
    source.onended = () => {
      if (this.samplerVoices.get(id) === voice) this.samplerVoices.delete(id);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    if (source.loop) source.start(now, start);
    else source.start(now, start, duration);
    return true;
  }
  stopSampler(id: string | undefined, immediate = false) {
    if (!id) return;
    this.pendingSampler.delete(id);
    const voice = this.samplerVoices.get(id);
    if (!voice || !this.ctx) return;
    if (voice.settings.mode === "one-shot" && !immediate) return;
    this.samplerVoices.delete(id);
    const now = this.ctx.currentTime,
      release = immediate
        ? 0.008
        : Math.max(0.01, voice.settings.release || 0.18);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, release / 4);
    try {
      voice.source.stop(now + release);
    } catch {}
  }
  createEffectBuses() {
    this.buses ??= {};
    if (!this.project) return;
    const impulse = this.reverbImpulse();
    const ids = new Set(projectTrackIds(this.project));
    for (const id of Object.keys(this.buses))
      if (!ids.has(id)) {
        const bus = this.buses[id]!;
        try {
          bus.lfo.stop();
        } catch {}
        for (const node of Object.values(bus))
          if (node && typeof (node as AudioNode).disconnect === "function")
            (node as AudioNode).disconnect();
        this.instrumentMeters.get(id)?.dispose();
        this.instrumentMeters.delete(id);
        this.trackInputs.delete(id);
        delete this.buses[id];
      }
    for (const id of projectTrackIds(this.project)) {
      if (this.buses[id]) continue;
      const input = this.ctx.createGain(),
        tone = this.ctx.createBiquadFilter(),
        saturation = this.ctx.createWaveShaper(),
        shape = this.ctx.createWaveShaper(),
        dry = this.ctx.createGain(),
        chorus = this.ctx.createDelay(0.05),
        chorusWet = this.ctx.createGain(),
        lfo = this.ctx.createOscillator(),
        depth = this.ctx.createGain(),
        delay = this.ctx.createDelay(0.8),
        feedback = this.ctx.createGain(),
        delayWet = this.ctx.createGain(),
        reverb = this.ctx.createConvolver(),
        reverbWet = this.ctx.createGain(),
        output = this.ctx.createGain(),
        sendOutput = this.ctx.createGain(),
        analyser = this.ctx.createAnalyser();
      tone.type = "highshelf";
      tone.frequency.value = 1800;
      saturation.oversample = "4x";
      shape.oversample = "2x";
      dry.gain.value = 0.82;
      chorus.delayTime.value = 0.018;
      chorusWet.gain.value = 0;
      depth.gain.value = 0;
      feedback.gain.value = 0;
      delayWet.gain.value = 0;
      reverbWet.gain.value = 0;
      reverb.buffer = impulse;
      analyser.fftSize = 64;
      const pre = this.ctx.createGain();
      this.trackInputs.set(id, pre);
      input.connect(pre).connect(tone).connect(saturation).connect(shape);
      shape.connect(dry).connect(output);
      shape.connect(chorus).connect(chorusWet).connect(output);
      lfo.connect(depth).connect(chorus.delayTime);
      shape.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(delayWet).connect(sendOutput);
      shape.connect(reverb).connect(reverbWet).connect(sendOutput);
      output.connect(analyser);
      sendOutput.connect(analyser);
      analyser.connect(this.master);
      lfo.start();
      this.instrumentMeters.set(id, new StereoMeter(this.ctx, analyser));
      this.buses[id] = {
        pre,
        reverb,
        input,
        tone,
        saturation,
        shape,
        dry,
        chorus,
        chorusWet,
        lfo,
        depth,
        delay,
        feedback,
        delayWet,
        reverbWet,
        output,
        sendOutput,
        analyser,
      };
    }
  }
  updateEffectBus(
    id: TrackId,
    cfg: TrackState,
    character: ClipCharacter,
    time = this.ctx.currentTime,
  ) {
    const bus = this.buses?.[id];
    if (!bus) return;
    const fx = character.fx || {},
      macros = character.macros,
      bypass = fx.bypass,
      space = 0.55 + macros.space * 0.75,
      energy = 0.78 + macros.energy * 0.25 + (macros.aggression || 0) * 0.32,
      soloActive = projectTrackIds(this.project).some(
        (track) => trackState(this.project, track).solo,
      ),
      audible =
        mixAudible(this.project, id) &&
        (!soloActive || cfg.solo) &&
        !this.launcherStopped?.has(id),
      smooth = (p: AudioParam, v: number) =>
        p.setTargetAtTime(v, Math.max(this.ctx.currentTime, time), 0.025),
      fader =
        Math.max(0, cfg.volume ?? 1) *
        sidechainFactor(this.project, cfg.groupId, time - this.lastKickTime);
    smooth(this.trackInputs.get(id)!.gain, dbToGain(cfg.preGainDb ?? 0));
    const saturation = bypass ? 0 : (fx.saturation || 0) * energy,
      distortion = bypass ? 0 : (fx.distortion || 0) * energy;
    if (bus.saturationAmount !== saturation) {
      bus.saturation.curve = makeSaturationCurve(saturation);
      bus.saturationAmount = saturation;
    }
    if (bus.distortionAmount !== distortion) {
      bus.shape.curve = makeCurve(distortion);
      bus.distortionAmount = distortion;
    }
    smooth(
      bus.tone.gain,
      bypass ? 0 : ((fx.tone ?? 0.5) - 0.5) * 18 - macros.darkness * 2,
    );
    smooth(bus.dry.gain, bypass ? 1 : 0.82);
    smooth(bus.chorusWet.gain, bypass ? 0 : (fx.chorus || 0) * 0.4);
    smooth(bus.lfo.frequency, 0.18 + (fx.chorus || 0) * 0.8);
    smooth(bus.depth.gain, 0.002 + (fx.chorus || 0) * 0.006);
    smooth(bus.delay.delayTime, 0.16 + (fx.delay || 0) * 0.22);
    smooth(
      bus.feedback.gain,
      bypass ? 0 : Math.min(0.55, 0.1 + (fx.delay || 0) * 0.4),
    );
    smooth(bus.delayWet.gain, bypass ? 0 : (fx.delay || 0) * 0.34 * space);
    smooth(bus.reverbWet.gain, bypass ? 0 : (fx.reverb || 0) * 0.42 * space);
    smooth(bus.output.gain, audible ? fader : 0);
    smooth(
      bus.sendOutput.gain,
      audible ? (cfg.sendMode === "pre" ? 1 : fader) : 0,
    );
  }
  private releaseGm: (() => void) | undefined;
  private starting: AbortController | undefined;
  private scheduledGm = new Set<SampleVoice>();
  private gmVoices = new Map<
    string,
    { voice: SampleVoice; channel: number | null; track: TrackId }
  >();
  async start(
    project: Project,
    {
      countInBars = 0,
      startStep = 0,
    }: { countInBars?: number; startStep?: number } = {},
  ) {
    if (this.playing || this.starting) return;
    const request = new AbortController();
    this.starting = request;
    try {
      await this.init();
      const release = await prepareGmProject(
        project,
        this.songMode,
        request.signal,
      );
      if (request.signal.aborted) {
        release();
        return;
      }
      this.releaseGm = release;
    } finally {
      if (this.starting === request) this.starting = undefined;
    }
    this.setProject(project);
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.sceneIndex = 0;
    this.sceneStep = 0;
    this.sceneRepeat = 0;
    this.seek(startStep, this.songMode);
    this.countInRemaining = Math.max(
      0,
      countInBars * meterSteps(project.meter),
    );
    this.countingIn = this.countInRemaining > 0;
    this.sequenceStartTime =
      this.nextTime -
      this.position * secondsPerStep(project.tempo) +
      this.countInRemaining * secondsPerStep(project.tempo);
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }
  stopActiveAudioRegions() {
    for (const source of this.activeAudioSources)
      try {
        source.stop();
      } catch {}
    this.activeAudioSources.clear();
    for (const output of this.audioLaneOutputs.values()) output.disconnect();
    this.audioLaneOutputs.clear();
    for (const id of this.audioLaneGraphs.keys()) this.disposeAudioLane(id);
    for (const [fx, timer] of this.regionCleanup) {
      clearTimeout(timer);
      fx.dispose();
    }
    this.regionCleanup.clear();
    for (const fx of this.regionGraphs.keys()) fx.dispose();
    this.regionGraphs.clear();
  }
  stop() {
    for (const request of this.pendingLaunches.values()) request.abort();
    this.pendingLaunches.clear();
    for (const release of this.launchReservations) release();
    this.launchReservations = [];
    this.starting?.abort();
    this.starting = undefined;
    this.releaseGm?.();
    this.releaseGm = undefined;
    for (const id of this.gmVoices.keys()) this.stopLive(id, true);
    for (const voice of this.scheduledGm)
      voice.stop(this.ctx?.currentTime, true);
    this.scheduledGm.clear();
    this.playing = false;
    this.countingIn = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stopActiveAudioRegions();
    this.audioResumeStep = null;
    this.onStep(-1, 0, -1, { stopped: true });
  }
  seek(step: number, songMode = this.songMode) {
    if (!this.project) return;
    const requested = Math.max(0, step);
    if (this.playing && this.timer) this.stopActiveAudioRegions();
    if (!songMode) {
      const length = Math.max(
        ...projectTrackIds(this.project).map((track) =>
          clipLengthSteps(activeClip(this.project, track)),
        ),
      );
      this.position = requested % Math.max(1, length);
      this.audioResumeStep = null;
      return this.position;
    }
    const durationSteps = songDurationSteps(this.project),
      target = requested % Math.max(1, durationSteps);
    this.audioResumeStep = target;
    let cursor = 0;
    for (
      let sceneIndex = 0;
      sceneIndex < this.project.arrangement.length;
      sceneIndex++
    ) {
      const scene = this.project.arrangement[sceneIndex]!,
        length = sceneLengthSteps(this.project, scene);
      for (let repeat = 0; repeat < scene.repeats; repeat++) {
        if (target < cursor + length) {
          this.position = target;
          this.sceneIndex = sceneIndex;
          this.sceneRepeat = repeat;
          this.sceneStep = target - cursor;
          return target;
        }
        cursor += length;
      }
    }
    if (target < songDurationSteps(this.project)) {
      this.position = target;
      this.sceneIndex = this.project.arrangement.length;
      this.sceneStep = target - cursor;
      this.sceneRepeat = 0;
      return target;
    }
    this.position = 0;
    this.sceneIndex = 0;
    this.sceneRepeat = 0;
    this.sceneStep = 0;
    this.audioResumeStep = 0;
    return 0;
  }
  schedule() {
    if (!this.playing || !this.project) return;
    if (this.nextTime < this.ctx.currentTime - 0.1)
      this.nextTime = this.ctx.currentTime + 0.03;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const position = this.position,
        base = secondsPerStep(this.clock.tempo(position)),
        wasCounting = this.countInRemaining > 0,
        span = wasCounting ? 1 : this.stepSpan();
      if (wasCounting) {
        const count = this.countInRemaining;
        this.click(this.nextTime, count % 4 === 0);
        this.onStep(-2, this.nextTime, -1, { countIn: count });
        this.countInRemaining--;
        if (this.countInRemaining === 0) this.countingIn = false;
      } else {
        this.scheduleMusicStep(this.nextTime, span);
        this.advanceTransport(span);
      }
      this.nextTime += wasCounting ? base : this.clock.duration(position, span);
    }
  }
  private stepSpan() {
    const scene = this.songMode
      ? this.project.arrangement[this.sceneIndex]
      : undefined;
    let span = Math.min(1, 1 - (this.position % 1));
    if (scene)
      span = Math.min(
        span,
        sceneLengthSteps(this.project, scene) - this.sceneStep,
      );
    for (const track of projectTrackIds(this.project)) {
      if (this.songMode && !scene?.clipIds[track]) continue;
      const clip = scene
        ? this.project.clips.find((c) => c.id === scene.clipIds[track])!
        : activeClip(this.project, track);
      const length = clipLengthSteps(clip),
        local = (this.songMode ? this.sceneStep : this.position) % length;
      span = Math.min(span, length - local);
    }
    return span > 1e-7 ? span : 1;
  }
  scheduleMusicStep(time: number, span = 1) {
    const beatSteps = 16 / (this.project.meter?.unit || 4);
    if (this.metronome && this.position % beatSteps === 0)
      this.click(time, this.position % meterSteps(this.project.meter) === 0);
    const scene = this.songMode
        ? this.project.arrangement[this.sceneIndex]
        : null,
      soloActive = projectTrackIds(this.project).some(
        (track) => trackState(this.project, track).solo,
      );
    if (
      mixAudible(this.project, "drums") &&
      !this.launcherStopped.has("drums") &&
      (!this.songMode || scene)
    ) {
      const drums = scene
        ? this.project.clips.find((clip) => clip.id === scene.clipIds.drums) ||
          activeClip(this.project, "drums")
        : activeClip(this.project, "drums");
      const local =
        (this.songMode ? this.sceneStep : this.position) %
        clipLengthSteps(drums);
      if (
        notesAtStep(this.project, drums, "drums", local, span).some(
          (note) => note.pitch === 0,
        )
      )
        this.lastKickTime = time;
    }
    for (const track of projectTrackIds(this.project)) {
      if (this.songMode && (!scene || !scene.clipIds[track])) continue;
      const clip = scene
          ? this.project.clips.find((c) => c.id === scene.clipIds[track]) ||
            activeClip(this.project, track)
          : activeClip(this.project, track),
        local =
          (this.songMode ? this.sceneStep : this.position) %
          clipLengthSteps(clip),
        cfg = clipTrackState(this.project, clip, this.position),
        character = clip.character;
      this.updateEffectBus(track, cfg, character, time);
      if (
        cfg.mute ||
        (soloActive && !cfg.solo) ||
        this.launcherStopped?.has(track)
      )
        continue;
      const volume = automationValue(clip, "volume", local, 1);
      for (const n of notesAtStep(this.project, clip, track, local, span)) {
        const expression = n.expression || {},
          velocity =
            n.velocity *
            volume *
            (0.65 + (expression.pressure ?? n.velocity) * 0.35),
          noteTime = Math.max(
            this.ctx.currentTime + 0.001,
            time + this.clock.duration(this.position, n.offset || 0),
          ),
          cutoff = Math.max(
            0,
            Math.min(
              1,
              automationValue(clip, "cutoff", local, 0.5) +
                (expression.timbre ?? 0.5) -
                0.5,
            ),
          );
        if (cfg.kind === "drums") {
          this.drum(n.pitch, noteTime, velocity, cfg, track);
          if (n.pitch === 0) this.duckGroups(noteTime);
        } else
          this.voice(
            track,
            n.pitch + (expression.bend || 0),
            noteTime,
            this.clock.duration(this.position + (n.offset || 0), n.length),
            velocity,
            cfg,
            character,
            cutoff,
            automationValue(clip, "pan", local, 0.5),
          );
      }
    }
    if (this.songMode) this.scheduleAudioRegions(time, this.position);
    this.master?.gain.setTargetAtTime(
      masterValue(this.project, this.position),
      time,
      0.015,
    );
    this.onStep(
      this.songMode ? this.sceneStep : this.position,
      time,
      this.songMode ? this.sceneIndex : -1,
      { sceneStep: this.sceneStep, position: this.position },
    );
  }
  duckGroups(time: number) {
    this.lastKickTime = time;
  }
  scheduleAudioRegions(time: number, step: number) {
    const resuming = this.audioResumeStep === step,
      stepSeconds = secondsPerStep(this.clock.tempo(step));
    for (const lane of this.project.audioLanes || []) {
      let output = this.audioLaneOutputs.get(lane.id);
      if (!output) {
        const created: GainNode = this.ctx.createGain();
        output = created;
        const group = this.project.mixerGroups.find(
          (item) => item.id === lane.groupId,
        );
        created.gain.value = mixAudible(this.project, lane.id)
          ? lane.volume * (group?.volume ?? 1)
          : 0;
        const fx = new AudioFx(this.ctx, lane.effects),
          pre = this.ctx.createGain(),
          pan = this.ctx.createStereoPanner(),
          meter = this.ctx.createAnalyser();
        pre.gain.value = dbToGain(lane.preGainDb ?? 0);
        pan.pan.value = lane.pan;
        meter.fftSize = 256;
        pre.connect(fx.input);
        fx.output
          .connect(pan)
          .connect(created)
          .connect(meter)
          .connect(this.master);
        this.audioLaneGraphs.set(lane.id, {
          fx,
          pre,
          pan,
          meter,
          stereo: new StereoMeter(this.ctx, meter),
        });
        this.audioLaneOutputs.set(lane.id, created);
      }
      for (const region of lane.regions) {
        const trigger = Math.floor(region.startStep),
          startsNow = trigger === step,
          insideOnResume =
            resuming &&
            region.startStep < step &&
            region.startStep + region.lengthSteps > step;
        if (!startsNow && !insideOnResume) continue;
        const buffer = this.audioAssets.get(region.assetId);
        if (!buffer) continue;
        const rate = audioRegionRate(region, this.project.tempo),
          elapsedSteps = insideOnResume ? step - region.startStep : 0,
          fraction = startsNow ? Math.max(0, region.startStep - trigger) : 0,
          when = Math.max(
            this.ctx.currentTime + 0.001,
            time + fraction * stepSeconds,
          ),
          offset = Math.max(
            0,
            Math.min(
              buffer.duration - 0.001,
              region.offsetSeconds +
                this.clock.duration(region.startStep, elapsedSteps) * rate,
            ),
          ),
          available = Math.max(0.001, buffer.duration - offset),
          wanted = Math.max(
            0.001,
            this.clock.duration(
              region.startStep + elapsedSteps,
              region.lengthSteps - elapsedSteps,
            ) * rate,
          ),
          duration = Math.min(available, wanted),
          source = this.ctx.createBufferSource(),
          gain = this.ctx.createGain(),
          pan = this.ctx.createStereoPanner();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        pan.pan.value = 0;
        const level = Math.max(0.0001, dbToGain(region.gainDb)),
          audible = Math.max(0.01, duration / rate),
          fadeInTotal = Math.min(
            region.lengthSteps * stepSeconds * 0.45,
            region.fadeInSteps * stepSeconds,
          ),
          fadeOut = Math.min(audible * 0.45, region.fadeOutSteps * stepSeconds),
          elapsedSeconds = elapsedSteps * stepSeconds,
          remainingFadeIn = Math.max(0, fadeInTotal - elapsedSeconds),
          startLevel =
            fadeInTotal && elapsedSeconds < fadeInTotal
              ? Math.max(0.0001, (level * elapsedSeconds) / fadeInTotal)
              : level;
        gain.gain.setValueAtTime(startLevel, when);
        if (remainingFadeIn)
          gain.gain.linearRampToValueAtTime(
            level,
            when + Math.min(audible, remainingFadeIn),
          );
        if (fadeOut) {
          gain.gain.setValueAtTime(
            level,
            Math.max(
              when + Math.min(audible, remainingFadeIn),
              when + audible - fadeOut,
            ),
          );
          gain.gain.linearRampToValueAtTime(0.0001, when + audible);
        }
        const fx = new AudioFx(this.ctx, region.effects);
        this.regionGraphs.set(fx, region.id);
        source.connect(gain).connect(fx.input);
        fx.output.connect(pan).connect(this.audioLaneGraphs.get(lane.id)!.pre);
        this.activeAudioSources.add(source);
        source.onended = () => {
          this.activeAudioSources.delete(source);
          source.disconnect();
          gain.disconnect();
          const timer = setTimeout(() => {
            fx.dispose();
            pan.disconnect();
            this.regionGraphs.delete(fx);
            this.regionCleanup.delete(fx);
          }, 2500);
          this.regionCleanup.set(fx, timer);
        };
        source.start(when, offset, duration);
      }
    }
    if (resuming) this.audioResumeStep = null;
  }
  advanceTransport(span = 1) {
    this.position += span;
    if (!this.songMode && this.launchQueue?.size) {
      for (const [track, launch] of this.launchQueue)
        if (this.position % launch.quantization === 0) {
          this.project.activeClipIds[track] = launch.clipId;
          this.launchQueue.delete(track);
          this.launcherStopped?.delete(track);
          this.onLaunch?.(track, launch.clipId, this.position);
        }
    }
    if (
      this.songMode &&
      this.project.loop?.enabled &&
      this.position >= this.project.loop.end
    ) {
      this.seek(this.project.loop.start, this.songMode);
      return;
    }
    if (!this.songMode) return;
    const scene = this.project.arrangement[this.sceneIndex];
    if (!scene) {
      if (this.position >= songDurationSteps(this.project)) this.seek(0, true);
      else this.sceneStep += span;
      return;
    }
    this.sceneStep += span;
    if (this.sceneStep >= sceneLengthSteps(this.project, scene) - 1e-7) {
      this.sceneStep = 0;
      this.sceneRepeat++;
      if (this.sceneRepeat >= scene.repeats) {
        this.sceneRepeat = 0;
        this.sceneIndex++;
        if (this.position >= songDurationSteps(this.project))
          this.seek(0, true);
      }
    }
  }
  recordPosition(
    track: TrackId,
    { quantized = true }: { quantized?: boolean } = {},
  ) {
    if (!this.ctx || !this.playing || this.countingIn) return null;
    const raw = Math.max(
        0,
        (this.ctx.currentTime - this.sequenceStartTime) /
          secondsPerStep(this.project.tempo),
      ),
      clip = activeClip(this.project, track),
      position = raw % clipLengthSteps(clip);
    return quantized
      ? (Math.round(position / this.project.editor.snap) *
          this.project.editor.snap) %
          clipLengthSteps(clip)
      : position;
  }
  click(time: number, accent = false) {
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.frequency.value = accent ? 1250 : 900;
    g.gain.setValueAtTime(0.07, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    o.connect(g).connect(this.master);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
    o.start(time);
    o.stop(time + 0.04);
  }
  voice(
    track: TrackId,
    pitch: number,
    time: number,
    duration: number,
    velocity: number,
    cfg: TrackState,
    character: ClipCharacter,
    cutoffAuto = 0.5,
    panAuto = 0.5,
  ) {
    if (!this.ctx) return;
    if (cfg.kind === "gm") {
      const voice = playGmNote(
        this.ctx,
        this.buses[track]!.input,
        cfg,
        pitch,
        time,
        duration,
        velocity,
        (cfg.pan || 0) + (panAuto - 0.5) * 2,
      );
      this.scheduledGm.add(voice);
      void voice.ended.then(() => this.scheduledGm.delete(voice));
      return;
    }
    if (cfg.kind === "guitar") {
      this.guitar(
        pitch,
        time,
        duration,
        velocity,
        cfg,
        character,
        cutoffAuto,
        panAuto,
        track,
      );
      return;
    }
    const { lfo, macros } = character,
      filter = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain(),
      pan = this.ctx.createStereoPanner(),
      oscillators: AudioNode[] = [],
      unison = Math.max(1, Math.min(3, cfg.unison || 1)),
      target = frequency(pitch),
      previous = this.lastFrequency[track] || target,
      lfoNode = lfo.enabled ? this.ctx.createOscillator() : null,
      lfoGain: any = lfoNode ? this.ctx.createGain() : null;
    filter.type = cfg.filterType || "lowpass";
    filter.frequency.setValueAtTime(
      Math.max(
        120,
        (cfg.cutoff || 1800) *
          (0.35 + cutoffAuto * 1.1) *
          (1 - macros.darkness * 0.35),
      ),
      time,
    );
    filter.Q.value = cfg.resonance || 1;
    pan.pan.value = Math.max(
      -1,
      Math.min(1, (panAuto - 0.5) * 1.3 + (cfg.pan || 0)),
    );
    const peak = Math.min(0.34, (velocity * 0.23) / Math.sqrt(unison)),
      attack = Math.max(0.005, cfg.attack || 0.005),
      decay = Math.max(0.01, cfg.decay || 0.1),
      sustain = Math.max(0.01, cfg.sustain ?? 0.72),
      attackEnd = time + Math.min(attack, duration),
      decayEnd = Math.min(time + duration, attackEnd + decay);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), attackEnd);
    if (decayEnd > attackEnd)
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, peak * sustain),
        decayEnd,
      );
    if (time + duration > decayEnd)
      gain.gain.setValueAtTime(
        Math.max(0.001, peak * sustain),
        time + duration,
      );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      time + duration + (cfg.release || 0.12),
    );
    filter.connect(gain).connect(pan).connect(this.buses[track]!.input);
    if (lfoNode) {
      lfoNode.frequency.value = lfo.rate;
      lfoGain.gain.value =
        lfo.target === "cutoff"
          ? (cfg.cutoff || 1800) * lfo.depth * 0.45
          : lfo.target === "pan"
            ? lfo.depth * 0.8
            : lfo.depth * 100;
      lfoNode.connect(lfoGain);
      if (lfo.target === "cutoff") lfoGain.connect(filter.frequency);
      if (lfo.target === "pan") lfoGain.connect(pan.pan);
      lfoNode.start(time);
      lfoNode.stop(time + duration + (cfg.release || 0.12) + 0.05);
    }
    const addOsc = (wave: Waveform, level = 1, octave = 1) => {
      for (let i = 0; i < unison; i++) {
        const o = this.ctx.createOscillator(),
          og = this.ctx.createGain(),
          spread = (i - (unison - 1) / 2) * (cfg.detune || 6);
        applyWave(this.ctx, o, wave);
        o.detune.value = spread;
        o.frequency.setValueAtTime(previous * octave, time);
        if (cfg.glide)
          o.frequency.exponentialRampToValueAtTime(
            target * octave,
            time + cfg.glide,
          );
        else o.frequency.setValueAtTime(target * octave, time);
        og.gain.value = level;
        if (lfoNode && lfo.target === "pitch") lfoGain.connect(o.detune);
        o.connect(og).connect(filter);
        o.start(time);
        o.stop(time + duration + (cfg.release || 0.12) + 0.05);
        oscillators.push(o, og);
      }
    };
    addOsc(cfg.wave || "sawtooth", 1 - (cfg.osc2Mix || 0) * 0.35);
    if (cfg.osc2Wave && cfg.osc2Wave !== "off" && (cfg.osc2Mix || 0) > 0)
      addOsc(cfg.osc2Wave, cfg.osc2Mix || 0, 0.5);
    this.lastFrequency[track] = target;
    const tail = oscillators.filter((n) => "onended" in n).at(-1) as
      OscillatorNode | undefined;
    if (tail)
      tail.onended = () => {
        oscillators.forEach((o) => o.disconnect());
        lfoNode?.disconnect();
        lfoGain?.disconnect();
        filter.disconnect();
        gain.disconnect();
        pan.disconnect();
      };
  }
  guitar(
    pitch: number,
    time: number,
    duration: number,
    velocity: number,
    cfg: TrackState,
    character: ClipCharacter,
    cutoffAuto = 0.5,
    panAuto = 0.5,
    track: TrackId = "guitar",
  ) {
    const target = frequency(pitch),
      filter = this.ctx.createBiquadFilter(),
      body = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain(),
      pan = this.ctx.createStereoPanner(),
      nodes: AudioNode[] = [],
      release = Math.max(0.12, cfg.release || 0.35),
      end = time + Math.max(0.12, duration) + release,
      peak = Math.max(0.002, Math.min(0.28, velocity * 0.27));
    let tail: OscillatorNode | undefined;
    filter.type = "lowpass";
    filter.frequency.value = Math.max(
      900,
      (cfg.cutoff || 5200) *
        (0.45 + cutoffAuto * 0.75) *
        (1 - character.macros.darkness * 0.28),
    );
    filter.Q.value = cfg.resonance || 2;
    body.type = "peaking";
    body.frequency.value = 190 + target * 0.28;
    body.Q.value = 1.2;
    body.gain.value = 4;
    pan.pan.value = Math.max(
      -1,
      Math.min(1, (panAuto - 0.5) * 1.3 + (cfg.pan || 0)),
    );
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, peak * 0.34),
      Math.min(end - 0.02, time + 0.16),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    filter
      .connect(body)
      .connect(gain)
      .connect(pan)
      .connect(this.buses[track]!.input);
    const harmonics = [1, 2, 3, 4],
      levels = [1, 0.34, 0.16, 0.07];
    harmonics.forEach((ratio, index) => {
      const osc = this.ctx.createOscillator(),
        level = this.ctx.createGain();
      osc.type = index === 0 ? "triangle" : "sine";
      osc.frequency.value = target * ratio;
      osc.detune.value = (index % 2 ? 0.7 : -0.7) * (cfg.detune || 3);
      level.gain.value = levels[index]!;
      osc.connect(level).connect(filter);
      osc.start(time);
      osc.stop(end + 0.02);
      tail = osc;
      nodes.push(osc, level);
    });
    const pickLength = 0.018,
      buffer = this.ctx.createBuffer(
        1,
        Math.ceil(this.ctx.sampleRate * pickLength),
        this.ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const pick = this.ctx.createBufferSource(),
      pickFilter = this.ctx.createBiquadFilter(),
      pickGain = this.ctx.createGain();
    pick.buffer = buffer;
    pickFilter.type = "bandpass";
    pickFilter.frequency.value = Math.min(9000, target * 8);
    pickFilter.Q.value = 0.7;
    pickGain.gain.value = peak * 0.75;
    pick.connect(pickFilter).connect(pickGain).connect(filter);
    pick.start(time);
    nodes.push(pick, pickFilter, pickGain);
    if (tail)
      tail.onended = () => {
        nodes.forEach((n) => n.disconnect());
        filter.disconnect();
        body.disconnect();
        gain.disconnect();
        pan.disconnect();
      };
  }
  private pendingLive = new Map<string, symbol>();
  async startLive(
    id: string,
    track: TrackId,
    pitch: number,
    velocity = 0.8,
    expression: Partial<NoteExpression> = {},
    channel: number | null = null,
  ) {
    this.stopLive(id, true);
    const request = Symbol();
    this.pendingLive.set(id, request);
    await this.init();
    if (this.pendingLive.get(id) !== request) return;
    this.setProject(this.project);
    const now = this.ctx.currentTime,
      cfg = clipTrackState(
        this.project,
        activeClip(this.project, track),
        this.position,
      ),
      character = activeClip(this.project, track).character,
      macros = character.macros;
    if (cfg.kind === "gm") {
      try {
        await prepareGmNotes(cfg, [pitch]);
        if (this.pendingLive.get(id) !== request) return;
        const voice = playGmNote(
          this.ctx,
          this.buses[track]!.input,
          cfg,
          pitch,
          this.ctx.currentTime,
          Infinity,
          velocity,
          cfg.pan || 0,
        );
        if (expression.bend) voice.bend(expression.bend, this.ctx.currentTime);
        this.gmVoices.set(id, { voice, channel, track });
        void voice.ended.then(() => {
          if (this.gmVoices.get(id)?.voice === voice) this.gmVoices.delete(id);
        });
      } finally {
        if (this.pendingLive.get(id) === request) this.pendingLive.delete(id);
      }
      return;
    }
    this.pendingLive.delete(id);
    if (cfg.kind === "drums") {
      this.drum(pitch, now, velocity, cfg, track);
      return;
    }
    const filter = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain(),
      pan = this.ctx.createStereoPanner(),
      oscillators: Array<{ node: OscillatorNode; ratio: number }> = [],
      unison = Math.max(1, Math.min(3, cfg.unison || 1)),
      pressure = expression.pressure ?? velocity,
      timbre = expression.timbre ?? 0.5,
      bend = expression.bend ?? 0,
      peak = Math.max(
        0.001,
        (velocity * (0.65 + pressure * 0.35) * 0.23) / Math.sqrt(unison),
      );
    filter.type = cfg.filterType || "lowpass";
    filter.Q.value = cfg.resonance || 1;
    filter.frequency.value = Math.max(
      120,
      (cfg.cutoff || 1800) *
        (0.35 + timbre * 1.1) *
        (1 - macros.darkness * 0.35),
    );
    pan.pan.value = cfg.pan || 0;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      peak,
      now + Math.max(0.005, cfg.attack || 0.005),
    );
    gain.gain.setTargetAtTime(
      Math.max(0.001, peak * (cfg.sustain ?? 0.72)),
      now + Math.max(0.005, cfg.attack || 0.005),
      Math.max(0.01, cfg.decay || 0.1),
    );
    filter.connect(gain).connect(pan).connect(this.buses[track]!.input);
    const add = (wave: Waveform, level: number, ratio: number) => {
      for (let i = 0; i < unison; i++) {
        const node = this.ctx.createOscillator(),
          levelNode = this.ctx.createGain();
        applyWave(this.ctx, node, wave);
        node.detune.value = (i - (unison - 1) / 2) * (cfg.detune || 6);
        node.frequency.value = frequency(pitch + bend) * ratio;
        levelNode.gain.value = level;
        node.connect(levelNode).connect(filter);
        node.start(now);
        oscillators.push({ node, ratio });
      }
    };
    add(cfg.wave || "sawtooth", 1 - (cfg.osc2Mix || 0) * 0.35, 1);
    if (cfg.osc2Wave && cfg.osc2Wave !== "off" && (cfg.osc2Mix || 0) > 0)
      add(cfg.osc2Wave, cfg.osc2Mix || 0, 0.5);
    this.liveVoices.set(id, {
      id,
      track,
      pitch,
      velocity,
      channel,
      cfg,
      macros,
      filter,
      gain,
      pan,
      oscillators,
      expression: { pressure, timbre, bend },
    });
  }
  updateLive(id: string, expression: Partial<NoteExpression>) {
    const sampled = this.gmVoices.get(id);
    if (sampled && expression.bend !== undefined)
      sampled.voice.bend(expression.bend, this.ctx.currentTime);
    const voice = this.liveVoices.get(id);
    if (!voice || !this.ctx) return;
    Object.assign(voice.expression, expression);
    const now = this.ctx.currentTime,
      { pressure, timbre, bend } = voice.expression;
    voice.oscillators.forEach(
      ({ node, ratio }: { node: OscillatorNode; ratio: number }) =>
        node.frequency.setTargetAtTime(
          frequency(voice.pitch + bend) * ratio,
          now,
          0.008,
        ),
    );
    voice.filter.frequency.setTargetAtTime(
      Math.max(
        120,
        (voice.cfg.cutoff || 1800) *
          (0.35 + timbre * 1.1) *
          (1 - voice.macros.darkness * 0.35),
      ),
      now,
      0.012,
    );
    voice.gain.gain.setTargetAtTime(
      Math.max(
        0.001,
        (voice.velocity *
          (0.65 + pressure * 0.35) *
          0.23 *
          (voice.cfg.sustain ?? 0.72)) /
          Math.sqrt(Math.max(1, voice.cfg.unison || 1)),
      ),
      now,
      0.012,
    );
  }
  updateLiveChannel(channel: number, expression: Partial<NoteExpression>) {
    for (const [id, voice] of this.gmVoices)
      if (voice.channel === channel) this.updateLive(id, expression);
    for (const [id, voice] of this.liveVoices)
      if (voice.channel === channel) this.updateLive(id, expression);
  }
  stopLive(id: string, immediate = false) {
    this.pendingLive.delete(id);
    this.gmVoices.get(id)?.voice.stop(this.ctx?.currentTime, immediate);
    this.gmVoices.delete(id);
    const voice = this.liveVoices.get(id);
    if (!voice || !this.ctx) return;
    this.liveVoices.delete(id);
    const now = this.ctx.currentTime,
      release = immediate ? 0.01 : Math.max(0.02, voice.cfg.release || 0.12);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, release / 4);
    for (const { node } of voice.oscillators)
      try {
        node.stop(now + release);
      } catch {}
    setTimeout(
      () => {
        for (const { node } of voice.oscillators) node.disconnect();
        voice.filter.disconnect();
        voice.gain.disconnect();
        voice.pan.disconnect();
      },
      Math.ceil((release + 0.05) * 1000),
    );
  }
  drum(
    kind: number,
    time: number,
    velocity: number,
    cfg: TrackState = this.project.tracks.drums,
    track: TrackId = "drums",
  ) {
    if (!this.ctx) return;
    const custom = this.drumSamples.get(kind),
      g = this.ctx.createGain(),
      pan = this.ctx.createStereoPanner();
    pan.pan.value = cfg.pan || 0;
    g.connect(pan).connect(this.buses[track]!.input);
    if (custom) {
      const source = this.ctx.createBufferSource(),
        start =
          Math.max(0, Math.min(0.98, custom.trimStart)) *
          custom.buffer.duration,
        end =
          Math.max(start + 0.001, Math.min(1, custom.trimEnd)) *
          custom.buffer.duration,
        duration = end - start,
        rate = 2 ** (custom.tune / 12),
        audibleDuration = duration / rate,
        attack = Math.min(
          audibleDuration * 0.4,
          Math.max(0.001, custom.attack),
        ),
        release = Math.min(
          audibleDuration * 0.7,
          Math.max(0.005, custom.release),
        );
      source.buffer = custom.buffer;
      source.playbackRate.value = rate;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(Math.max(0.001, velocity), time + attack);
      g.gain.setValueAtTime(
        Math.max(0.001, velocity),
        Math.max(time + attack, time + audibleDuration - release),
      );
      g.gain.linearRampToValueAtTime(0.0001, time + audibleDuration);
      source.connect(g);
      source.onended = () => {
        source.disconnect();
        g.disconnect();
        pan.disconnect();
      };
      source.start(time, start, duration);
      return;
    }
    if (kind === 0 || kind === 4) {
      const o = this.ctx.createOscillator(),
        start = kind === 0 ? 145 : kind === 4 ? 125 : 180,
        end = kind === 0 ? 42 : 72,
        len = kind === 0 ? 0.2 : 0.28;
      o.type = kind === 4 ? "triangle" : "sine";
      o.frequency.setValueAtTime(start, time);
      o.frequency.exponentialRampToValueAtTime(end, time + len * 0.65);
      g.gain.setValueAtTime(velocity * (kind === 0 ? 0.7 : 0.42), time);
      g.gain.exponentialRampToValueAtTime(0.001, time + len);
      o.connect(g);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
        pan.disconnect();
      };
      o.start(time);
      o.stop(time + len);
    } else {
      const len =
          kind === 2 ? 0.045 : kind === 3 ? 0.28 : kind === 6 ? 0.65 : 0.13,
        buf = this.ctx.createBuffer(
          1,
          Math.ceil(this.ctx.sampleRate * len),
          this.ctx.sampleRate,
        ),
        d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++)
        d[i] =
          (Math.random() * 2 - 1) *
          Math.pow(1 - i / d.length, kind === 6 ? 0.7 : 1);
      const s = this.ctx.createBufferSource(),
        f = this.ctx.createBiquadFilter();
      f.type = kind === 2 || kind === 3 || kind === 6 ? "highpass" : "bandpass";
      f.frequency.value =
        kind === 2
          ? 6500
          : kind === 3
            ? 4700
            : kind === 6
              ? 3500
              : kind === 5
                ? 2400
                : 1800;
      g.gain.setValueAtTime(
        velocity * (kind === 2 ? 0.2 : kind === 6 ? 0.3 : 0.35),
        time,
      );
      g.gain.exponentialRampToValueAtTime(0.001, time + len);
      s.buffer = buf;
      s.connect(f).connect(g);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        g.disconnect();
        pan.disconnect();
      };
      s.start(time);
    }
  }
  distortionCurve(amount: number) {
    return makeCurve(amount);
  }
  saturationCurve(amount: number) {
    return makeSaturationCurve(amount);
  }
  reverbImpulse() {
    if (this.impulse) return this.impulse;
    const length = this.ctx.sampleRate * 1.8,
      buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.4);
    }
    return (this.impulse = buffer);
  }
  async preview(track: TrackId, pitch: number, velocity = 0.8) {
    await this.init();
    this.setProject(this.project);
    const cfg = clipTrackState(this.project, activeClip(this.project, track));
    await prepareGmNotes(cfg, [pitch]);
    if (cfg.kind === "drums")
      this.drum(pitch, this.ctx.currentTime, velocity, cfg, track);
    else
      this.voice(
        track,
        pitch,
        this.ctx.currentTime,
        0.22,
        velocity,
        cfg,
        activeClip(this.project, track).character,
      );
  }
  draw(canvas: HTMLCanvasElement) {
    if (!this.analyser) return;
    const c = canvas.getContext("2d")!,
      data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    c.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = c.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, "#9d5b28");
    gradient.addColorStop(1, "#ffcf67");
    c.fillStyle = gradient;
    const w = canvas.width / data.length;
    data.forEach((v, i) =>
      c.fillRect(
        i * w,
        canvas.height,
        Math.max(1, w - 1),
        (-v / 255) * canvas.height,
      ),
    );
  }
  private meterBuffers = new WeakMap<AnalyserNode, Uint8Array<ArrayBuffer>>();
  trackLevel(track: TrackId) {
    const analyser = this.buses?.[track]?.analyser;
    if (!analyser) return 0;
    let data = this.meterBuffers.get(analyser);
    if (!data || data.length !== analyser.fftSize) {
      data = new Uint8Array(analyser.fftSize);
      this.meterBuffers.set(analyser, data);
    }
    analyser.getByteTimeDomainData(data);
    let energy = 0;
    for (const value of data) {
      const sample = (value - 128) / 128;
      energy += sample * sample;
    }
    return Math.min(1, Math.sqrt(energy / data.length) * 3.2);
  }
  trackMeter(track: TrackId) {
    return (
      this.instrumentMeters.get(track)?.read() ?? {
        left: 0,
        right: 0,
        peak: 0,
        rms: 0,
      }
    );
  }
  async startPerformanceCapture() {
    await this.init();
    if (this.performanceRecorder?.state === "recording") return;
    const type =
        ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(
          (value) => MediaRecorder.isTypeSupported(value),
        ) || "",
      chunks: Blob[] = [];
    this.performanceRecorder = new MediaRecorder(
      this.captureDestination.stream,
      type ? { mimeType: type } : undefined,
    );
    this.performanceChunks = chunks;
    this.performanceRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size) chunks.push(event.data);
    };
    this.performanceRecorder.start(250);
    return type || this.performanceRecorder.mimeType;
  }
  stopPerformanceCapture() {
    return new Promise<Blob>((resolve, reject) => {
      const recorder = this.performanceRecorder;
      if (!recorder || recorder.state !== "recording") {
        reject(new Error("No performance capture is active"));
        return;
      }
      recorder.onerror = () => reject(new Error("Performance capture failed"));
      recorder.onstop = () =>
        resolve(
          new Blob(this.performanceChunks || [], {
            type: recorder.mimeType || "audio/webm",
          }),
        );
      recorder.stop();
    });
  }
  diagnostics() {
    return {
      effectBuses: Object.keys(this.buses || {}).length,
      liveVoices: this.liveVoices.size + this.gmVoices.size,
      scheduledSampleVoices: this.scheduledGm.size,
      samplerLoaded: Boolean(this.samplerBuffer),
      samplerVoices: this.samplerVoices.size,
      audioAssets: this.audioAssets.size,
      audioLaneLevels: [...this.audioLaneOutputs.values()].map(
        (output) => output.gain.value,
      ),
      activeAudioRegions: this.activeAudioSources.size,
      schedulerActive: Boolean(this.timer),
      contextState: this.ctx?.state || "uninitialized",
      sampleRate: this.ctx?.sampleRate || null,
      countingIn: this.countingIn,
      position: Number(this.position || 0),
      sceneIndex: Number(this.sceneIndex || 0),
      songMode: Boolean(this.songMode),
      performanceRecording: this.performanceRecorder?.state === "recording",
      scratchReady: Boolean(this.scratchReady),
      scratchFrames: this.scratchFrames || 0,
      scratchPlaying: Boolean(this.scratchPlaying),
      scratchSpeed: Number(this.scratchSpeed || 0),
      scratchMix: Number(this.scratchMix || 0),
      scratchReadyB: Boolean(this.scratchReadyB),
      scratchFramesB: this.scratchFramesB || 0,
      scratchPlayingB: Boolean(this.scratchPlayingB),
      scratchSpeedB: Number(this.scratchSpeedB || 0),
      scratchCrossfade: Number(this.scratchCrossfade || 0),
      scratchGainA: Number(this.scratchGain?.gain.value || 0),
      scratchGainB: Number(this.scratchGainB?.gain.value || 0),
      scratchCueGainA: Number(this.decks.A.cueGain?.gain.value || 0),
      scratchCueGainB: Number(this.decks.B.cueGain?.gain.value || 0),
    };
  }
}

function makeCurve(amount: number) {
  const c = new Float32Array(256),
    k = amount * 180;
  for (let i = 0; i < c.length; i++) {
    const x = (i * 2) / (c.length - 1) - 1;
    c[i] = amount < 0.005 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}
function makeSaturationCurve(amount: number) {
  const c = new Float32Array(256),
    drive = 1 + amount * 8,
    norm = Math.tanh(drive);
  for (let i = 0; i < c.length; i++) {
    const x = (i * 2) / (c.length - 1) - 1;
    c[i] = amount < 0.005 ? x : Math.tanh(x * drive) / norm;
  }
  return c;
}
export function wavBlob(
  buffer: AudioBuffer,
  bitDepth: 16 | 32 = 16,
  normalize = false,
  dither = false,
) {
  const channels = [
    buffer.getChannelData(0),
    buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1)),
  ];
  return new Blob(
    [
      encodeWavPcm({
        channels,
        sampleRate: buffer.sampleRate,
        bitDepth,
        normalize,
        dither,
      }),
    ],
    { type: "audio/wav" },
  );
}
export interface RenderWavOptions {
  song?: boolean;
  bitDepth?: 16 | 32;
  normalize?: boolean;
  sampleRate?: 44100 | 48000 | 96000;
  tailSeconds?: number;
  dither?: boolean;
  region?: { start: number; end: number } | undefined;
  signal?: AbortSignal | undefined;
  dry?: boolean;
  drumSamples?: Map<
    number,
    {
      buffer: AudioBuffer;
      trimStart: number;
      trimEnd: number;
      tune: number;
      attack: number;
      release: number;
      reverse: boolean;
    }
  >;
  audioAssets?: Map<string, AudioBuffer>;
  onStage?: (stage: "prepare" | "schedule" | "render" | "encode") => void;
  renderTimeoutMs?: number;
  onProgress?: (fraction: number) => void;
  format?: "wav" | "ogg";
  oggQuality?: number;
}
export async function renderWav(
  project: Project,
  {
    song = true,
    bitDepth = 16,
    normalize = false,
    sampleRate = 44100,
    tailSeconds = 3,
    dither = false,
    region,
    signal,
    dry = false,
    drumSamples,
    audioAssets,
    onStage,
    renderTimeoutMs,
    onProgress,
    format = "wav",
    oggQuality = 4,
  }: RenderWavOptions = {},
) {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
  const encodeOutput = async (buffer: AudioBuffer) => {
    onStage?.("encode");
    if (signal?.aborted)
      throw new DOMException("Export cancelled", "AbortError");
    if (format === "ogg") {
      const { encodeOgg } = await import("./audio/ogg");
      return encodeOgg(buffer, {
        quality: oggQuality,
        normalize,
        signal,
        onProgress: (fraction) => onProgress?.(fraction),
      });
    }
    return encodeAudioBuffer(buffer, bitDepth, normalize, dither, signal);
  };
  onStage?.("prepare");
  for (const asset of renderAssets(project, song, region)) {
    const sample = project.samples.find((item) => item.id === asset.id);
    const loaded = sample
      ? drumSamples?.has(sample.slot)
      : audioAssets?.has(asset.id);
    if (!loaded)
      throw new Error(
        `Audio source unavailable or undecodable: ${asset.name} (${asset.id})`,
      );
  }
  const playback = playbackEvents(project, { song }),
    regionStart = Math.max(0, region?.start || 0),
    regionEnd = Math.max(
      regionStart + 1,
      Math.min(playback.durationSteps, region?.end || playback.durationSteps),
    ),
    events = playback.events
      .filter(
        (event) =>
          event.step < regionEnd && event.step + event.length > regionStart,
      )
      .map((event) => {
        const clippedStart = Math.max(event.step, regionStart),
          clippedEnd = Math.min(event.step + event.length, regionEnd);
        return {
          ...event,
          step: clippedStart - regionStart,
          length: clippedEnd - clippedStart,
        };
      }),
    durationSteps = regionEnd - regionStart,
    clock = createTempoClock(project),
    eventTime = (step: number) =>
      clock.seconds(regionStart + step) - clock.seconds(regionStart),
    eventDuration = (step: number, length: number) =>
      clock.duration(regionStart + step, length),
    sr = sampleRate,
    duration =
      eventTime(durationSteps) + Math.max(0, Math.min(12, tailSeconds)),
    ctx = offlineContext(Math.ceil(duration * sr), sr, bitDepth),
    master = ctx.createGain(),
    tone = ctx.createBiquadFilter(),
    comp = ctx.createDynamicsCompressor(),
    limiter = ctx.createDynamicsCompressor();
  master.gain.value = project.master;
  master.channelCount = project.masterSettings?.monoCheck ? 1 : 2;
  master.channelCountMode = project.masterSettings?.monoCheck
    ? "explicit"
    : "max";
  comp.knee.value = 12;
  comp.attack.value = 0.012;
  comp.release.value = 0.2;
  limiter.knee.value = 1;
  limiter.attack.value = 0.001;
  tone.type = "highshelf";
  tone.frequency.value = 5200;
  tone.gain.value = 1.2;
  comp.threshold.value = Math.max(
    -30,
    Math.min(-6, (project.masterSettings?.targetLufs ?? -14) - 1),
  );
  comp.ratio.value = 3;
  limiter.threshold.value = project.masterSettings?.ceilingDb ?? -1;
  limiter.ratio.value = 20;
  const finalGain = ctx.createGain(),
    outputMix = normalizeOutputMix(project.outputMix);
  finalGain.gain.value = outputMix.muted ? 0 : outputMix.master;
  if (project.masterSettings?.bypass)
    master.connect(finalGain).connect(ctx.destination);
  else
    master
      .connect(tone)
      .connect(comp)
      .connect(finalGain)
      .connect(limiter)
      .connect(ctx.destination);
  onStage?.("schedule");
  const audibleEvents = events.filter((event) =>
    mixAudible(project, event.track),
  );
  const hasAudio =
    song &&
    project.audioLanes.some(
      (lane) =>
        mixAudible(project, lane.id) &&
        lane.regions.some(
          (item) =>
            audioAssets?.has(item.assetId) &&
            item.startStep < regionEnd &&
            item.startStep + item.lengthSteps > regionStart,
        ),
    );
  // No source can excite the offline graph. Avoid starting idle feedback and
  // convolution nodes (which can stall some Chromium audio backends).
  if (!audibleEvents.length && !hasAudio)
    return encodeOutput(ctx.createBuffer(2, Math.ceil(duration * sr), sr));
  const releaseGm = await prepareGmProject(project, song, signal);
  try {
    let impulse: AudioBuffer | undefined;
    const getImpulse = () => {
      if (impulse) return impulse;
      impulse = ctx.createBuffer(2, Math.floor(sr * 1.8), sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = impulse.getChannelData(ch);
        for (let i = 0; i < d.length; i++)
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.4);
      }
      return impulse;
    };
    const buses: any = {},
      trackOutputs = Object.fromEntries(
        projectTrackIds(project).map((track) => {
          const output = ctx.createGain(),
            cfg = trackState(project, track),
            audible = mixAudible(project, track);
          output.gain.value = audible ? cfg.volume : 0;
          output.connect(master);
          return [track, output];
        }),
      ) as Record<TrackId, GainNode>,
      preSendOutputs = Object.fromEntries(
        projectTrackIds(project).map((track) => {
          const output = ctx.createGain(),
            audible = mixAudible(project, track);
          output.gain.value = audible ? 1 : 0;
          output.connect(master);
          return [track, output];
        }),
      ) as Record<TrackId, GainNode>;
    const kicks = audibleEvents
      .filter((event) => event.track === "drums" && event.pitch === 0)
      .map((event) => eventTime(event.step))
      .sort((a, b) => a - b);
    let kickIndex = 0,
      lastKick = -Infinity;
    for (let step = 0; step < durationSteps; step++) {
      const time = eventTime(step),
        absolute = step + regionStart;
      while (kickIndex < kicks.length && kicks[kickIndex]! <= time)
        lastKick = kicks[kickIndex++]!;
      master.gain.setTargetAtTime(masterValue(project, absolute), time, 0.015);
      for (const track of projectTrackIds(project)) {
        const cfg = clipTrackState(
          project,
          activeClip(project, track),
          absolute,
        );
        const level = cfg.mute
          ? 0
          : cfg.volume * sidechainFactor(project, cfg.groupId, time - lastKick);
        trackOutputs[track]!.gain.setTargetAtTime(level, time, 0.025);
        preSendOutputs[track]!.gain.setTargetAtTime(
          cfg.mute ? 0 : 1,
          time,
          0.025,
        );
      }
    }
    const busRoutes = new Map<
      string,
      { routes: [AudioNode, AudioNode][]; active: boolean; end: number }
    >();
    for (const clip of project.clips.filter((clip) =>
      audibleEvents.some((event) => event.clipId === clip.id),
    )) {
      const { fx, macros } = clip.character,
        input = ctx.createGain(),
        pre = ctx.createGain(),
        space = 0.55 + macros.space * 0.75,
        drive = 0.78 + macros.energy * 0.25 + (macros.aggression || 0) * 0.32,
        bypassed = dry || fx.bypass,
        trackOutput = trackOutputs[clip.track]!,
        sendTarget =
          trackState(project, clip.track).sendMode === "pre"
            ? preSendOutputs[clip.track]!
            : trackOutput;
      pre.gain.value = dbToGain(trackState(project, clip.track).preGainDb ?? 0);
      input.connect(pre);
      let output: AudioNode = pre;
      if (!bypassed) {
        const tone = ((fx.tone ?? 0.5) - 0.5) * 18 - macros.darkness * 2;
        if (tone !== 0) {
          const eq = ctx.createBiquadFilter();
          eq.type = "highshelf";
          eq.frequency.value = 1800;
          eq.gain.value = tone;
          output.connect(eq);
          output = eq;
        }
        if ((fx.saturation || 0) * drive >= 0.005) {
          const saturation = ctx.createWaveShaper();
          saturation.curve = makeSaturationCurve((fx.saturation || 0) * drive);
          saturation.oversample = "4x";
          output.connect(saturation);
          output = saturation;
        }
        if ((fx.distortion || 0) * drive >= 0.005) {
          const shape = ctx.createWaveShaper();
          shape.curve = makeCurve((fx.distortion || 0) * drive);
          shape.oversample = "2x";
          output.connect(shape);
          output = shape;
        }
      }
      const dryGain = ctx.createGain();
      dryGain.gain.value = bypassed ? 1 : 0.82;
      const routes: [AudioNode, AudioNode][] = [[dryGain, trackOutput]];
      output.connect(dryGain);
      if (!bypassed && fx.chorus > 0) {
        const chorus = ctx.createDelay(0.05),
          wet = ctx.createGain(),
          lfo = ctx.createOscillator(),
          depth = ctx.createGain();
        chorus.delayTime.value = 0.018;
        wet.gain.value = fx.chorus * 0.4;
        lfo.frequency.value = 0.18 + fx.chorus * 0.8;
        depth.gain.value = 0.002 + fx.chorus * 0.006;
        output.connect(chorus).connect(wet);
        routes.push([wet, trackOutput]);
        lfo.connect(depth).connect(chorus.delayTime);
        lfo.start(0);
        lfo.stop(duration);
      }
      if (!bypassed && fx.delay > 0) {
        const delay = ctx.createDelay(0.8),
          feedback = ctx.createGain(),
          wet = ctx.createGain();
        delay.delayTime.value = 0.16 + fx.delay * 0.22;
        feedback.gain.value = Math.min(0.55, 0.1 + fx.delay * 0.4);
        wet.gain.value = fx.delay * 0.34 * space;
        output.connect(delay);
        delay.connect(feedback).connect(delay);
        delay.connect(wet);
        routes.push([wet, sendTarget]);
      }
      if (!bypassed && fx.reverb > 0) {
        const reverb = ctx.createConvolver(),
          wet = ctx.createGain();
        reverb.buffer = getImpulse();
        wet.gain.value = fx.reverb * 0.42 * space;
        output.connect(reverb).connect(wet);
        routes.push([wet, sendTarget]);
      }
      busRoutes.set(clip.id, { routes, active: false, end: 0 });
      buses[clip.id] = input;
    }
    // Keep only a small window of voices connected. Scheduling the entire song
    // upfront leaves thousands of per-note filters/panners in the offline graph.
    const clipsById = new Map(project.clips.map((clip) => [clip.id, clip]));
    let voiceNodes: AudioNode[] = [];
    const ownVoice = <T extends AudioNode>(node: T): T => {
      voiceNodes.push(node);
      return node;
    };
    const voices: { end: number; nodes: AudioNode[] }[] = [];
    const guitarEvent = (
      e: import("./core.js").PlaybackEvent,
      cfg: TrackState,
    ) => {
      const start = eventTime(e.step),
        noteDuration = eventDuration(e.step, e.length),
        end =
          start +
          Math.max(0.12, noteDuration) +
          Math.max(0.12, cfg.release || 0.35),
        clip = clipsById.get(e.clipId)!,
        macros = clip.character.macros,
        cut = automationValue(clip, "cutoff", e.localStep, 0.5),
        vol = automationValue(clip, "volume", e.localStep, 1),
        target = frequency(e.pitch),
        filter = ownVoice(ctx.createBiquadFilter()),
        body = ownVoice(ctx.createBiquadFilter()),
        gain = ownVoice(ctx.createGain()),
        pan = ownVoice(ctx.createStereoPanner()),
        peak = Math.max(0.002, Math.min(0.24, e.velocity * vol * 0.22));
      filter.type = "lowpass";
      filter.frequency.value = Math.max(
        900,
        (cfg.cutoff || 5200) *
          (0.45 + cut * 0.75) *
          (1 - macros.darkness * 0.28),
      );
      filter.Q.value = cfg.resonance || 2;
      body.type = "peaking";
      body.frequency.value = 190 + target * 0.28;
      body.Q.value = 1.2;
      body.gain.value = 4;
      pan.pan.value = Math.max(
        -1,
        Math.min(
          1,
          (automationValue(clip, "pan", e.localStep, 0.5) - 0.5) * 1.3 +
            (cfg.pan || 0),
        ),
      );
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, peak * 0.34),
        Math.min(end - 0.02, start + 0.16),
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      filter.connect(body).connect(gain).connect(pan).connect(buses[e.clipId]);
      [1, 2, 3, 4].forEach((ratio, index) => {
        const osc = ownVoice(ctx.createOscillator()),
          level = ownVoice(ctx.createGain());
        osc.type = index === 0 ? "triangle" : "sine";
        osc.frequency.value = target * ratio;
        osc.detune.value = (index % 2 ? 0.7 : -0.7) * (cfg.detune || 3);
        level.gain.value = [1, 0.34, 0.16, 0.07][index]!;
        osc.connect(level).connect(filter);
        osc.start(start);
        osc.stop(end + 0.02);
      });
      const pickLength = 0.018,
        buffer = ctx.createBuffer(1, Math.ceil(sr * pickLength), sr),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const pick = ownVoice(ctx.createBufferSource()),
        pickFilter = ownVoice(ctx.createBiquadFilter()),
        pickGain = ownVoice(ctx.createGain());
      pick.buffer = buffer;
      pickFilter.type = "bandpass";
      pickFilter.frequency.value = Math.min(9000, target * 8);
      pickFilter.Q.value = 0.7;
      pickGain.gain.value = peak * 0.75;
      pick.connect(pickFilter).connect(pickGain).connect(filter);
      pick.start(start);
    };
    const toneEvent = (
      e: import("./core.js").PlaybackEvent,
      cfg: TrackState,
    ) => {
      const start = eventTime(e.step),
        end = start + eventDuration(e.step, e.length),
        clip = clipsById.get(e.clipId)!,
        { lfo, macros } = clip.character,
        f = ownVoice(ctx.createBiquadFilter()),
        g = ownVoice(ctx.createGain()),
        pan = ownVoice(ctx.createStereoPanner()),
        cut = automationValue(clip, "cutoff", e.localStep, 0.5),
        vol = automationValue(clip, "volume", e.localStep, 1),
        unison = Math.max(1, Math.min(3, cfg.unison || 1)),
        peak = Math.max(0.002, (e.velocity * vol * 0.16) / Math.sqrt(unison)),
        attack = Math.max(0.005, cfg.attack || 0.005),
        decay = Math.max(0.01, cfg.decay || 0.1),
        sustain = Math.max(0.01, cfg.sustain ?? 0.72),
        release = cfg.release || 0.1,
        noteDuration = end - start,
        attackEnd = start + Math.min(attack, noteDuration),
        decayEnd = Math.min(end, attackEnd + decay);
      f.type = cfg.filterType || "lowpass";
      f.frequency.value = Math.max(
        120,
        (cfg.cutoff || 1800) *
          (0.35 + cut * 1.1) *
          (1 - macros.darkness * 0.35),
      );
      f.Q.value = cfg.resonance || 1;
      pan.pan.value = Math.max(
        -1,
        Math.min(
          1,
          (automationValue(clip, "pan", e.localStep, 0.5) - 0.5) * 1.3 +
            (cfg.pan || 0),
        ),
      );
      g.gain.setValueAtTime(0.001, start);
      g.gain.exponentialRampToValueAtTime(peak, attackEnd);
      if (decayEnd > attackEnd)
        g.gain.exponentialRampToValueAtTime(
          Math.max(0.001, peak * sustain),
          decayEnd,
        );
      if (end > decayEnd)
        g.gain.setValueAtTime(Math.max(0.001, peak * sustain), end);
      g.gain.exponentialRampToValueAtTime(0.001, end + release);
      f.connect(g).connect(pan).connect(buses[e.clipId]);
      const lfoNode = lfo.enabled ? ownVoice(ctx.createOscillator()) : null,
        lfoGain: any = lfoNode ? ownVoice(ctx.createGain()) : null;
      if (lfoNode) {
        lfoNode.frequency.value = lfo.rate;
        lfoGain.gain.value =
          lfo.target === "cutoff"
            ? (cfg.cutoff || 1800) * lfo.depth * 0.45
            : lfo.target === "pan"
              ? lfo.depth * 0.8
              : lfo.depth * 100;
        lfoNode.connect(lfoGain);
        if (lfo.target === "cutoff") lfoGain.connect(f.frequency);
        if (lfo.target === "pan") lfoGain.connect(pan.pan);
        lfoNode.start(start);
        lfoNode.stop(end + release + 0.02);
      }
      const addOsc = (wave: Waveform, level = 1, octave = 1) => {
        for (let i = 0; i < unison; i++) {
          const o = ownVoice(ctx.createOscillator()),
            og = ownVoice(ctx.createGain());
          applyWave(ctx, o, wave);
          o.frequency.value = frequency(e.pitch) * octave;
          o.detune.value = (i - (unison - 1) / 2) * (cfg.detune || 6);
          og.gain.value = level;
          if (lfoNode && lfo.target === "pitch") lfoGain.connect(o.detune);
          o.connect(og).connect(f);
          o.start(start);
          o.stop(end + release + 0.02);
        }
      };
      addOsc(cfg.wave || "sawtooth", 1 - (cfg.osc2Mix || 0) * 0.35);
      if (cfg.osc2Wave && cfg.osc2Wave !== "off" && (cfg.osc2Mix || 0) > 0)
        addOsc(cfg.osc2Wave, cfg.osc2Mix || 0, 0.5);
    };
    const drumEvent = (
      e: import("./core.js").PlaybackEvent,
      cfg: TrackState,
    ) => {
      const start = eventTime(e.step),
        g = ownVoice(ctx.createGain()),
        pan = ownVoice(ctx.createStereoPanner()),
        custom = drumSamples?.get(e.pitch);
      pan.pan.value = cfg.pan || 0;
      g.connect(pan).connect(buses[e.clipId]);
      if (custom) {
        const source = ownVoice(ctx.createBufferSource()),
          offset =
            Math.max(0, Math.min(0.98, custom.trimStart)) *
            custom.buffer.duration,
          end =
            Math.max(offset + 0.001, Math.min(1, custom.trimEnd)) *
            custom.buffer.duration,
          sampleDuration = end - offset,
          rate = 2 ** (custom.tune / 12),
          audibleDuration = sampleDuration / rate,
          attack = Math.min(
            audibleDuration * 0.4,
            Math.max(0.001, custom.attack),
          ),
          release = Math.min(
            audibleDuration * 0.7,
            Math.max(0.005, custom.release),
          );
        source.buffer = custom.buffer;
        source.playbackRate.value = rate;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(
          Math.max(0.001, e.velocity),
          start + attack,
        );
        g.gain.setValueAtTime(
          Math.max(0.001, e.velocity),
          Math.max(start + attack, start + audibleDuration - release),
        );
        g.gain.linearRampToValueAtTime(0.0001, start + audibleDuration);
        source.connect(g);
        source.start(start, offset, sampleDuration);
        return;
      }
      if (e.pitch === 0 || e.pitch === 4) {
        const o = ownVoice(ctx.createOscillator()),
          len = e.pitch === 0 ? 0.21 : 0.28;
        o.type = e.pitch === 4 ? "triangle" : "sine";
        o.frequency.setValueAtTime(e.pitch === 0 ? 150 : 125, start);
        o.frequency.exponentialRampToValueAtTime(
          e.pitch === 0 ? 43 : 72,
          start + len * 0.65,
        );
        g.gain.setValueAtTime(
          e.velocity * (e.pitch === 0 ? 0.45 : 0.32),
          start,
        );
        g.gain.exponentialRampToValueAtTime(0.001, start + len);
        o.connect(g);
        o.start(start);
        o.stop(start + len);
      } else {
        const length =
            e.pitch === 2
              ? 0.05
              : e.pitch === 3
                ? 0.28
                : e.pitch === 6
                  ? 0.65
                  : 0.14,
          buf = ctx.createBuffer(1, Math.ceil(sr * length), sr),
          data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++)
          data[i] =
            (Math.random() * 2 - 1) *
            Math.pow(1 - i / data.length, e.pitch === 6 ? 0.7 : 1);
        const source = ownVoice(ctx.createBufferSource()),
          filter = ownVoice(ctx.createBiquadFilter());
        filter.type = [2, 3, 6].includes(e.pitch) ? "highpass" : "bandpass";
        filter.frequency.value =
          e.pitch === 2
            ? 6500
            : e.pitch === 3
              ? 4700
              : e.pitch === 6
                ? 3500
                : e.pitch === 5
                  ? 2400
                  : 1800;
        g.gain.setValueAtTime(
          e.velocity * (e.pitch === 2 ? 0.2 : e.pitch === 6 ? 0.3 : 0.24),
          start,
        );
        g.gain.exponentialRampToValueAtTime(0.001, start + length);
        source.buffer = buf;
        source.connect(filter).connect(g);
        source.start(start);
      }
    };
    const scheduledEvents = audibleEvents
      .map((event) => ({ event, time: eventTime(event.step) }))
      .sort((a, b) => a.time - b.time);
    let nextEvent = 0;
    const scheduleUntil = (until: number) => {
      while (
        nextEvent < scheduledEvents.length &&
        scheduledEvents[nextEvent]!.time < until
      ) {
        const { event: e, time } = scheduledEvents[nextEvent++]!;
        const clip = clipsById.get(e.clipId) || activeClip(project, e.track);
        const cfg = clipTrackState(project, clip, e.step + regionStart);
        voiceNodes = [];
        if (cfg.kind === "gm")
          playGmNote(
            ctx,
            buses[e.clipId],
            cfg,
            e.pitch,
            time,
            eventDuration(e.step, e.length),
            e.velocity,
            cfg.pan || 0,
          );
        else if (cfg.kind === "drums") drumEvent(e, cfg);
        else if (cfg.kind === "guitar") guitarEvent(e, cfg);
        else toneEvent(e, cfg);
        const custom =
          cfg.kind === "drums" ? drumSamples?.get(e.pitch) : undefined;
        const customDuration = custom
          ? custom.buffer.duration / 2 ** (custom.tune / 12)
          : 0;
        voices.push({
          end:
            time +
            Math.max(
              1,
              customDuration,
              eventDuration(e.step, e.length) + Math.max(0.5, cfg.release || 0),
            ) +
            0.25,
          nodes: voiceNodes,
        });
        const bus = busRoutes.get(e.clipId)!;
        bus.end = Math.max(bus.end, voices.at(-1)!.end + 8);
        if (!bus.active) {
          for (const [output, target] of bus.routes) output.connect(target);
          bus.active = true;
        }
      }
    };
    const releaseVoices = (time: number) => {
      for (const bus of busRoutes.values()) {
        if (bus.active && bus.end <= time) {
          for (const [output, target] of bus.routes) output.disconnect(target);
          bus.active = false;
        }
      }
      for (let i = voices.length - 1; i >= 0; i--) {
        if (voices[i]!.end > time) continue;
        for (const node of voices[i]!.nodes) node.disconnect();
        voices.splice(i, 1);
      }
    };

    for (const lane of song ? project.audioLanes : []) {
      if (!mixAudible(project, lane.id)) continue;
      const laneFx = new AudioFx(ctx, dry ? undefined : lane.effects),
        lanePre = ctx.createGain(),
        lanePan = ctx.createStereoPanner(),
        laneOut = ctx.createGain();
      lanePre.gain.value = dbToGain(lane.preGainDb ?? 0);
      lanePan.pan.value = lane.pan;
      laneOut.gain.value =
        lane.volume *
        (project.mixerGroups.find((group) => group.id === lane.groupId)
          ?.volume ?? 1);
      lanePre.connect(laneFx.input);
      laneFx.output.connect(lanePan).connect(laneOut).connect(master);
      for (const regionItem of lane.regions) {
        const buffer = audioAssets?.get(regionItem.assetId);
        if (!buffer) continue;
        const absoluteStart = regionItem.startStep - regionStart;
        if (
          absoluteStart >= durationSteps ||
          absoluteStart + regionItem.lengthSteps <= 0
        )
          continue;
        const rate = audioRegionRate(regionItem, project.tempo),
          startStep = Math.max(0, absoluteStart),
          skipSteps = Math.max(0, -absoluteStart),
          start = eventTime(startStep),
          offset = Math.max(
            0,
            Math.min(
              buffer.duration - 0.001,
              regionItem.offsetSeconds +
                eventDuration(absoluteStart, skipSteps) * rate,
            ),
          ),
          available = Math.max(0.001, buffer.duration - offset),
          wanted =
            eventDuration(
              startStep,
              Math.min(
                regionItem.lengthSteps - skipSteps,
                durationSteps - startStep,
              ),
            ) * rate,
          sampleDuration = Math.min(available, wanted),
          audible = sampleDuration / rate,
          source = ctx.createBufferSource(),
          gain = ctx.createGain(),
          pan = ctx.createStereoPanner(),
          level = Math.max(0.0001, dbToGain(regionItem.gainDb));
        source.buffer = buffer;
        source.playbackRate.value = rate;
        pan.pan.value = 0;
        gain.gain.setValueAtTime(level, start);
        const fadeIn = Math.min(
            audible * 0.45,
            eventDuration(startStep, regionItem.fadeInSteps),
          ),
          fadeOut = Math.min(
            audible * 0.45,
            eventDuration(startStep, regionItem.fadeOutSteps),
          );
        if (fadeIn) {
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(level, start + fadeIn);
        }
        if (fadeOut) {
          gain.gain.setValueAtTime(
            level,
            Math.max(start + fadeIn, start + audible - fadeOut),
          );
          gain.gain.linearRampToValueAtTime(0.0001, start + audible);
        }
        const regionFx = new AudioFx(ctx, dry ? undefined : regionItem.effects);
        source.connect(gain).connect(regionFx.input);
        regionFx.output.connect(pan).connect(lanePre);
        source.start(start, offset, sampleDuration);
      }
    }
    onStage?.("render");
    if (signal?.aborted)
      throw new DOMException("Export cancelled", "AbortError");
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let abortListener: (() => void) | undefined;
    let rendered: AudioBuffer;
    let abandoned = false;
    try {
      rendered = await Promise.race([
        (async () => {
          // Firefox currently lacks OfflineAudioContext.suspend/resume.
          if (
            typeof ctx.suspend !== "function" ||
            typeof ctx.resume !== "function"
          ) {
            scheduleUntil(Infinity);
            return await ctx.startRendering();
          }
          const windowSeconds = 2;
          scheduleUntil(windowSeconds);
          let boundary = windowSeconds;
          let paused = boundary < duration ? ctx.suspend(boundary) : undefined;
          const rendering = ctx.startRendering();
          while (paused) {
            await Promise.race([paused, rendering]);
            if (abandoned || signal?.aborted)
              throw new DOMException("Export cancelled", "AbortError");
            releaseVoices(ctx.currentTime);
            onProgress?.(Math.min(1, ctx.currentTime / duration));
            boundary += windowSeconds;
            scheduleUntil(boundary);
            paused = boundary < duration ? ctx.suspend(boundary) : undefined;
            await ctx.resume();
          }
          return await rendering;
        })(),
        new Promise<never>((_, reject) => {
          const fail = () =>
            reject(
              new Error("Offline render timed out during audio processing"),
            );
          if (renderTimeoutMs !== undefined) {
            deadline = setTimeout(fail, Math.max(1000, renderTimeoutMs));
          } else {
            let lastTime = ctx.currentTime,
              lastProgress = performance.now();
            watchdog = setInterval(() => {
              if (ctx.currentTime > lastTime) {
                lastTime = ctx.currentTime;
                lastProgress = performance.now();
              } else if (performance.now() - lastProgress > 45000) fail();
            }, 1000);
          }
          abortListener = () =>
            reject(new DOMException("Export cancelled", "AbortError"));
          signal?.addEventListener("abort", abortListener, { once: true });
        }),
      ]);
    } finally {
      abandoned = true;
      clearTimeout(deadline);
      clearInterval(watchdog);
      if (abortListener) signal?.removeEventListener("abort", abortListener);
    }
    return await encodeOutput(rendered);
  } finally {
    releaseGm();
  }
}

export { AudioFx, processAudio } from "./audio/effects";
export { normalizeEffects, AUDIO_FX_PRESETS } from "./audio/effects-model";
