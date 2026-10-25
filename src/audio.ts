import scratchWorkletUrl from "./scratch-worklet.ts?worker&url";
import {
  activeClip,
  audioRegionRate,
  automationValue,
  clipLengthSteps,
  dbToGain,
  evaluateAutomationLane,
  frequency,
  meterSteps,
  notesAtStep,
  playbackEvents,
  sceneLengthSteps,
  secondsPerStep,
  stepWithSwing,
  tempoAtStep,
  TRACKS,
} from "./core.js";
import type {
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

export class AudioEngine {
  [key: string]: any;
  ctx: any = null;
  project: Project;
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
  liveVoices = new Map<string, any>();
  samplerBuffer: AudioBuffer | null = null;
  samplerVoices = new Map<string, any>();
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
  activeAudioSources = new Set<AudioBufferSourceNode>();
  audioResumeStep: number | null = null;
  constructor(
    onStep: (
      step: number,
      time: number,
      scene: number,
      info: Record<string, unknown>,
    ) => void = () => {},
  ) {
    this.project = null as unknown as Project;
    this.onStep = onStep;
  }
  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive",
      });
      this.master = this.ctx.createGain();
      this.masterTone = this.ctx.createBiquadFilter();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.programGain = this.ctx.createGain();
      this.scratchFilter = this.ctx.createBiquadFilter();
      this.scratchGain = this.ctx.createGain();
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
      this.scratchFilter.type = "lowpass";
      this.scratchFilter.frequency.value = 20000;
      this.scratchGain.gain.value = 0;
      this.master
        .connect(this.masterTone)
        .connect(this.compressor)
        .connect(this.limiter)
        .connect(this.programGain)
        .connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.analyser.connect(this.captureDestination);
      this.scratchFilter.connect(this.scratchGain).connect(this.analyser);
      this.createEffectBuses();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      await this.initScratchDeck();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }
  async initScratchDeck() {
    if (this.scratchNode || !this.ctx?.audioWorklet) return;
    try {
      // Vite serves transformed TypeScript in dev. Its worker URL wrapper injects
      // importScripts there, which AudioWorkletGlobalScope does not provide.
      // Production uses the standalone, hashed processor emitted by Vite.
      const moduleUrl = import.meta.env.DEV
        ? `${import.meta.env.BASE_URL}src/scratch-worklet.ts`
        : scratchWorkletUrl;
      await this.ctx.audioWorklet.addModule(moduleUrl);
      this.scratchNode = new AudioWorkletNode(this.ctx, "kv-scratch-deck", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        parameterData: { speed: 1 },
      });
      this.scratchNode.connect(this.scratchFilter);
      this.scratchNode.port.onmessage = (event: MessageEvent) => {
        if (event.data.type === "ready") {
          this.scratchReady = true;
          this.scratchPlaying = true;
          this.pendingScratchReady?.();
          this.pendingScratchReady = null;
        } else if (event.data.type === "position") {
          this.scratchPosition = event.data.frame;
          this.scratchSpeed = event.data.speed;
          this.scratchPlaying = event.data.playing;
          this.onScratchPosition?.(event.data);
        }
      };
    } catch (error) {
      this.scratchError =
        error instanceof Error ? error.message : String(error);
    }
  }
  async loadScratchBuffer(buffer: AudioBuffer) {
    await this.init();
    if (!this.scratchNode)
      throw new Error(this.scratchError || "Scratch AudioWorklet unavailable");
    const left = new Float32Array(buffer.getChannelData(0)),
      right = new Float32Array(
        buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left,
      );
    this.scratchFrames = left.length;
    this.scratchSampleRate = buffer.sampleRate;
    this.scratchReady = false;
    const ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(new Error("Scratch processor did not acknowledge the buffer")),
        3000,
      );
      this.pendingScratchReady = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
    this.scratchNode.port.postMessage({ type: "load", left, right }, [
      left.buffer,
      right.buffer,
    ]);
    await ready;
    this.setScratchSpeed(1, 0);
    this.setScratchMix(0.72);
  }
  setScratchPlaying(value: boolean) {
    if (!this.scratchNode) return;
    this.scratchPlaying = value;
    this.scratchNode.port.postMessage({ type: "play", value });
    this.onScratchGesture?.("playing", value);
  }
  setScratchSpeed(value: number, ramp = 0.025) {
    if (!this.scratchNode || !this.ctx) return;
    const speed = this.scratchNode.parameters.get("speed"),
      now = this.ctx.currentTime,
      target = Math.max(-6, Math.min(6, value));
    if (!speed) return;
    speed.cancelScheduledValues(now);
    speed.setValueAtTime(speed.value, now);
    if (ramp > 0) speed.linearRampToValueAtTime(target, now + ramp);
    else speed.setValueAtTime(target, now);
    this.scratchSpeed = target;
    this.onScratchGesture?.("speed", target);
  }
  setScratchMix(value: number) {
    if (!this.ctx || !this.programGain || !this.scratchGain) return;
    const mix = Math.max(0, Math.min(1, value)),
      now = this.ctx.currentTime;
    this.scratchMix = mix;
    this.programGain.gain.setTargetAtTime(
      Math.cos((mix * Math.PI) / 2),
      now,
      0.018,
    );
    this.scratchGain.gain.setTargetAtTime(
      Math.sin((mix * Math.PI) / 2),
      now,
      0.018,
    );
    this.onScratchGesture?.("mix", mix);
  }
  setScratchFilter(value: number) {
    if (!this.ctx || !this.scratchFilter) return;
    const normalized = Math.max(0, Math.min(1, value)),
      frequency = 120 * Math.pow(20000 / 120, normalized);
    this.scratchFilter.frequency.setTargetAtTime(
      frequency,
      this.ctx.currentTime,
      0.018,
    );
    this.onScratchGesture?.("filter", normalized);
  }
  setScratchStutter(frames: number) {
    this.scratchNode?.port.postMessage({ type: "stutter", frames });
    this.onScratchGesture?.("stutter", frames > 0);
  }
  syncScratch(beatFrames: number) {
    this.scratchNode?.port.postMessage({ type: "sync", beatFrames });
    this.setScratchSpeed(1, 0.08);
  }
  setProject(project: Project) {
    this.project = project;
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
      this.limiter.threshold.setTargetAtTime(
        project.masterSettings?.ceilingDb ?? -1,
        now,
        0.02,
      );
      this.limiter.ratio.setTargetAtTime(bypass ? 1 : 20, now, 0.02);
      this.programGain.channelCount = project.masterSettings?.monoCheck ? 1 : 2;
      this.programGain.channelCountMode = project.masterSettings?.monoCheck
        ? "explicit"
        : "max";
      for (const id of TRACKS) {
        this.updateEffectBus(
          id,
          project.tracks[id],
          activeClip(project, id).character,
        );
        const cfg = project.tracks[id],
          group = project.mixerGroups?.find((item) => item.id === cfg.groupId);
        if (group && this.buses[id])
          this.buses[id].output.gain.setTargetAtTime(
            group.mute
              ? 0
              : (cfg.volume ?? 1) * dbToGain(cfg.preGainDb ?? 0) * group.volume,
            now,
            0.02,
          );
      }
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
    if (stopped) this.launcherStopped.add(track);
    else this.launcherStopped.delete(track);
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
    for (const id of [...this.samplerVoices.keys()]) this.stopSampler(id, true);
    this.samplerBuffer = null;
  }
  private pendingSampler = new Map<string,symbol>();
  async startSampler(
    id: string,
    pitch: number,
    velocity = 0.8,
    settings: SamplerInstrument = this.project.sampler,
  ) {
    const request=Symbol();this.pendingSampler.set(id,request);
    await this.init();
    if(this.pendingSampler.get(id)!==request)return false;
    const buffer = this.samplerBuffer;
    if (!buffer) return false;
    this.stopSampler(id, true);
    while (this.samplerVoices.size >= Math.max(1, settings.polyphony || 12))
      this.stopSampler(this.samplerVoices.keys().next().value, true);
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
      level = Math.max(0.001, Math.min(1.5, settings.gain) * velocity),
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
    source.connect(filter).connect(gain).connect(this.master);
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
    this.buses = {};
    const impulse = this.reverbImpulse();
    for (const id of TRACKS) {
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
      input.connect(tone).connect(saturation).connect(shape);
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
      this.buses[id] = {
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
    cfg: any,
    character: any,
    time = this.ctx.currentTime,
  ) {
    const bus = this.buses?.[id];
    if (!bus) return;
    const fx = character.fx || {},
      macros = character.macros,
      bypass = fx.bypass,
      space = 0.55 + macros.space * 0.75,
      energy = 0.78 + macros.energy * 0.25 + (macros.aggression || 0) * 0.32,
      soloActive = TRACKS.some((track) => this.project.tracks[track].solo),
      audible =
        !cfg.mute &&
        (!soloActive || cfg.solo) &&
        !this.launcherStopped?.has(id),
      smooth = (p: AudioParam, v: number) =>
        p.setTargetAtTime(v, Math.max(this.ctx.currentTime, time), 0.025),
      fader =
        Math.max(0, Math.min(2, cfg.volume ?? 1)) *
        dbToGain(cfg.preGainDb ?? 0);
    bus.saturation.curve = this.saturationCurve(
      bypass ? 0 : (fx.saturation || 0) * energy,
    );
    bus.shape.curve = this.distortionCurve(
      bypass ? 0 : (fx.distortion || 0) * energy,
    );
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
      audible
        ? cfg.sendMode === "pre"
          ? dbToGain(cfg.preGainDb ?? 0)
          : fader
        : 0,
    );
  }
  async start(
    project: Project,
    {
      countInBars = 0,
      startStep = 0,
    }: { countInBars?: number; startStep?: number } = {},
  ) {
    await this.init();
    this.setProject(project);
    if (this.playing) return;
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
  }
  stop() {
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
    const requested = Math.max(0, Math.floor(step));
    if (this.playing && this.timer) this.stopActiveAudioRegions();
    if (!songMode) {
      const length = Math.max(
        ...TRACKS.map((track) =>
          clipLengthSteps(activeClip(this.project, track)),
        ),
      );
      this.position = requested % Math.max(1, length);
      this.audioResumeStep = null;
      return this.position;
    }
    const { durationSteps } = playbackEvents(this.project, { song: true }),
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
      const base = secondsPerStep(tempoAtStep(this.project, this.position)),
        wasCounting = this.countInRemaining > 0;
      if (wasCounting) {
        const count = this.countInRemaining;
        this.click(this.nextTime, count % 4 === 0);
        this.onStep(-2, this.nextTime, -1, { countIn: count });
        this.countInRemaining--;
        if (this.countInRemaining === 0) this.countingIn = false;
      } else {
        this.scheduleMusicStep(this.nextTime);
        this.advanceTransport();
      }
      this.nextTime += wasCounting
        ? base
        : base +
          (this.position % 2
            ? base * this.project.swing
            : -base * this.project.swing);
    }
  }
  scheduleMusicStep(time: number) {
    const beatSteps = this.project.meter?.unit === 8 ? 2 : 4;
    if (this.metronome && this.position % beatSteps === 0)
      this.click(time, this.position % meterSteps(this.project.meter) === 0);
    const scene = this.songMode
        ? this.project.arrangement[this.sceneIndex]
        : null,
      soloActive = TRACKS.some((track) => this.project.tracks[track].solo);
    for (const track of TRACKS) {
      const clip = scene
          ? this.project.clips.find((c) => c.id === scene.clipIds[track]) ||
            activeClip(this.project, track)
          : activeClip(this.project, track),
        local =
          (this.songMode ? this.sceneStep : this.position) %
          clipLengthSteps(clip),
        cfg = this.project.tracks[track],
        character = clip.character;
      this.updateEffectBus(track, cfg, character, time);
      if (
        cfg.mute ||
        (soloActive && !cfg.solo) ||
        this.launcherStopped?.has(track)
      )
        continue;
      const volume = automationValue(clip, "volume", local, 1);
      for (const n of notesAtStep(this.project, clip, track, local)) {
        const expression = n.expression || {},
          velocity =
            n.velocity *
            volume *
            (0.65 + (expression.pressure ?? n.velocity) * 0.35),
          noteTime = Math.max(
            this.ctx.currentTime + 0.001,
            time + (n.offset || 0) * secondsPerStep(this.project.tempo),
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
        if (track === "drums") {
          this.drum(n.pitch, noteTime, velocity, cfg);
          if (n.pitch === 0) this.duckGroups(noteTime);
        } else
          this.voice(
            track,
            n.pitch + (expression.bend || 0),
            noteTime,
            n.length * secondsPerStep(this.project.tempo),
            velocity,
            cfg,
            character,
            cutoff,
            automationValue(clip, "pan", local, 0.5),
          );
      }
    }
    if (this.songMode) this.scheduleAudioRegions(time, this.position);
    for (const lane of this.project.automationLanes || []) {
      const value = evaluateAutomationLane(lane, this.position, 0.5);
      if (lane.target === "master.volume")
        this.master.gain.setTargetAtTime(value, time, 0.015);
      else {
        const match = /^track\.([^.]+)\.(volume|pan|cutoff)$/.exec(lane.target);
        if (match && TRACKS.includes(match[1] as TrackId)) {
          const track = match[1] as TrackId,
            param = match[2]!;
          if (param === "volume")
            this.buses[track]?.output.gain.setTargetAtTime(value, time, 0.015);
          else
            (this.project.tracks[track] as any)[param] =
              param === "cutoff" ? 120 + value * 11880 : value * 2 - 1;
        }
      }
    }
    for (const route of this.project.modulationRoutes || []) {
      const phase = Math.sin(time * Math.PI * 2 * Math.max(0.01, route.rate)),
        value = phase * route.amount;
      if (route.target === "master.volume")
        this.master.gain.setTargetAtTime(
          Math.max(0, Math.min(1.5, this.project.master + value * 0.25)),
          time,
          0.02,
        );
      else {
        const match = /^track\.([^.]+)\.(volume|pan|cutoff)$/.exec(
          route.target,
        );
        if (!match || !TRACKS.includes(match[1] as TrackId)) continue;
        const track = match[1] as TrackId,
          bus = this.buses[track],
          cfg = this.project.tracks[track];
        if (match[2] === "volume")
          bus.output.gain.setTargetAtTime(
            Math.max(0, (cfg.volume ?? 1) * (1 + value)),
            time,
            0.02,
          );
        else if (match[2] === "cutoff")
          bus.tone.gain.setTargetAtTime(
            Math.max(-18, Math.min(18, value * 12)),
            time,
            0.02,
          );
      }
    }
    this.onStep(
      this.songMode ? this.sceneStep : this.position,
      time,
      this.songMode ? this.sceneIndex : -1,
      { sceneStep: this.sceneStep, position: this.position },
    );
  }
  duckGroups(time: number) {
    for (const group of this.project.mixerGroups || []) {
      if (group.sidechainSource !== "drums" || group.sidechainAmount <= 0)
        continue;
      for (const track of TRACKS) {
        const cfg = this.project.tracks[track],
          bus = this.buses[track];
        if (cfg.groupId !== group.id || !bus) continue;
        const normal =
            Math.max(0, Math.min(2, cfg.volume ?? 1)) *
            dbToGain(cfg.preGainDb ?? 0) *
            group.volume,
          duck = normal * (1 - Math.min(0.9, group.sidechainAmount));
        bus.output.gain.cancelScheduledValues(time);
        bus.output.gain.setValueAtTime(
          Math.max(0.0001, bus.output.gain.value),
          time,
        );
        bus.output.gain.linearRampToValueAtTime(
          Math.max(0.0001, duck),
          time + 0.012,
        );
        bus.output.gain.exponentialRampToValueAtTime(
          Math.max(0.0001, normal),
          time + 0.22,
        );
      }
    }
  }
  scheduleAudioRegions(time: number, step: number) {
    const solo = (this.project.audioLanes || []).some((lane) => lane.solo),
      resuming = this.audioResumeStep === step,
      stepSeconds = secondsPerStep(this.project.tempo);
    for (const lane of this.project.audioLanes || []) {
      if (lane.mute || (solo && !lane.solo)) continue;
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
              region.offsetSeconds + elapsedSteps * stepSeconds * rate,
            ),
          ),
          available = Math.max(0.001, buffer.duration - offset),
          wanted = Math.max(
            0.001,
            (region.lengthSteps - elapsedSteps) * stepSeconds * rate,
          ),
          duration = Math.min(available, wanted),
          source = this.ctx.createBufferSource(),
          gain = this.ctx.createGain(),
          pan = this.ctx.createStereoPanner();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        pan.pan.value = Math.max(-1, Math.min(1, lane.pan));
        const level = Math.max(0.0001, lane.volume * dbToGain(region.gainDb)),
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
        source.connect(gain).connect(pan).connect(this.master);
        this.activeAudioSources.add(source);
        source.onended = () => {
          this.activeAudioSources.delete(source);
          source.disconnect();
          gain.disconnect();
          pan.disconnect();
        };
        source.start(when, offset, duration);
      }
    }
    if (resuming) this.audioResumeStep = null;
  }
  advanceTransport() {
    this.position++;
    if (!this.songMode && this.launchQueue?.size) {
      for (const [track, launch] of this.launchQueue)
        if (this.position % launch.quantization === 0) {
          this.project.activeClipIds[track] = launch.clipId;
          this.launchQueue.delete(track);
          this.launcherStopped?.delete(track);
          this.onLaunch?.(track, launch.clipId, this.position);
        }
    }
    if (this.project.loop?.enabled && this.position >= this.project.loop.end) {
      this.seek(this.project.loop.start, this.songMode);
      return;
    }
    if (!this.songMode) return;
    const scene = this.project.arrangement[this.sceneIndex];
    if (!scene) {
      this.seek(0, true);
      return;
    }
    this.sceneStep++;
    if (this.sceneStep >= sceneLengthSteps(this.project, scene)) {
      this.sceneStep = 0;
      this.sceneRepeat++;
      if (this.sceneRepeat >= scene.repeats) {
        this.sceneRepeat = 0;
        this.sceneIndex =
          (this.sceneIndex + 1) % this.project.arrangement.length;
        if (this.sceneIndex === 0) this.position = 0;
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
    cfg: any,
    character: any,
    cutoffAuto = 0.5,
    panAuto = 0.5,
  ) {
    if (!this.ctx) return;
    if (track === "guitar") {
      this.guitar(
        pitch,
        time,
        duration,
        velocity,
        cfg,
        character,
        cutoffAuto,
        panAuto,
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
        cfg.cutoff * (0.35 + cutoffAuto * 1.1) * (1 - macros.darkness * 0.35),
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
      time + duration + cfg.release,
    );
    filter.connect(gain).connect(pan).connect(this.buses[track].input);
    if (lfoNode) {
      lfoNode.frequency.value = lfo.rate;
      lfoGain.gain.value =
        lfo.target === "cutoff"
          ? cfg.cutoff * lfo.depth * 0.45
          : lfo.target === "pan"
            ? lfo.depth * 0.8
            : lfo.depth * 100;
      lfoNode.connect(lfoGain);
      if (lfo.target === "cutoff") lfoGain.connect(filter.frequency);
      if (lfo.target === "pan") lfoGain.connect(pan.pan);
      lfoNode.start(time);
      lfoNode.stop(time + duration + cfg.release + 0.05);
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
        o.stop(time + duration + cfg.release + 0.05);
        oscillators.push(o, og);
      }
    };
    addOsc(cfg.wave || "sawtooth", 1 - (cfg.osc2Mix || 0) * 0.35);
    if (cfg.osc2Wave && cfg.osc2Wave !== "off" && cfg.osc2Mix > 0)
      addOsc(cfg.osc2Wave, cfg.osc2Mix, 0.5);
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
    cfg: any,
    character: any,
    cutoffAuto = 0.5,
    panAuto = 0.5,
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
      .connect(this.buses.guitar.input);
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
    const request = Symbol();
    this.pendingLive.set(id, request);
    await this.init();
    if (this.pendingLive.get(id) !== request) return;
    this.setProject(this.project);
    this.stopLive(id, true);
    const now = this.ctx.currentTime,
      cfg = this.project.tracks[track],
      character = activeClip(this.project, track).character,
      macros = character.macros;
    if (track === "drums") {
      this.drum(pitch, now, velocity, cfg);
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
    filter.connect(gain).connect(pan).connect(this.buses[track].input);
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
    for (const [id, voice] of this.liveVoices)
      if (voice.channel === channel) this.updateLive(id, expression);
  }
  stopLive(id: string, immediate = false) {
    this.pendingLive.delete(id);
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
    cfg: any = this.project.tracks.drums,
  ) {
    if (!this.ctx) return;
    const custom = this.drumSamples.get(kind),
      g = this.ctx.createGain(),
      pan = this.ctx.createStereoPanner();
    pan.pan.value = cfg.pan || 0;
    g.connect(pan).connect(this.buses.drums.input);
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
    const n = 256,
      curve = new Float32Array(n),
      k = amount * 180;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = amount < 0.005 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }
  saturationCurve(amount: number) {
    const n = 256,
      curve = new Float32Array(n),
      drive = 1 + amount * 8,
      norm = Math.tanh(drive);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      curve[i] = amount < 0.005 ? x : Math.tanh(x * drive) / norm;
    }
    return curve;
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
    if (track === "drums") this.drum(pitch, this.ctx.currentTime, velocity);
    else
      this.voice(
        track,
        pitch,
        this.ctx.currentTime,
        0.22,
        velocity,
        this.project.tracks[track],
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
  trackLevel(track: TrackId) {
    const analyser = this.buses?.[track]?.analyser;
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let energy = 0;
    for (const value of data) {
      const sample = (value - 128) / 128;
      energy += sample * sample;
    }
    return Math.min(1, Math.sqrt(energy / data.length) * 3.2);
  }
  trackMeter(track: TrackId) {
    const analyser = this.buses?.[track]?.analyser;
    if (!analyser) return { rms: 0, peak: 0, left: 0, right: 0 };
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let energy = 0,
      peak = 0;
    for (const value of data) {
      const sample = (value - 128) / 128;
      energy += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    const rms = Math.min(1, Math.sqrt(energy / data.length) * 3.2),
      p = Math.min(1, peak * 1.8);
    return {
      rms,
      peak: p,
      left: Math.min(
        1,
        rms * (1 - Math.min(0, this.project.tracks[track].pan || 0) * 0.45),
      ),
      right: Math.min(
        1,
        rms * (1 + Math.max(0, this.project.tracks[track].pan || 0) * 0.45),
      ),
    };
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
      liveVoices: this.liveVoices.size,
      samplerLoaded: Boolean(this.samplerBuffer),
      samplerVoices: this.samplerVoices.size,
      audioAssets: this.audioAssets.size,
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
    };
  }
}

function makeCurve(amount: number) {
  const c = new Float32Array(256),
    k = amount * 180;
  for (let i = 0; i < c.length; i++) {
    const x = (i * 2) / c.length - 1;
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
function wavBlob(
  buffer: AudioBuffer,
  bitDepth: 16 | 32 = 16,
  normalize = false,
  dither = false,
) {
  const bytes = bitDepth / 8,
    block = bytes * 2,
    len = 44 + buffer.length * block,
    ab = new ArrayBuffer(len),
    v = new DataView(ab),
    str = (o: number, s: string) =>
      [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  let peak = 0;
  if (normalize)
    for (let ch = 0; ch < 2; ch++)
      for (const sample of buffer.getChannelData(ch))
        peak = Math.max(peak, Math.abs(sample));
  const gain = normalize && peak > 0 ? Math.min(8, 0.988 / peak) : 1;
  str(0, "RIFF");
  v.setUint32(4, len - 8, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, bitDepth === 32 ? 3 : 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * block, true);
  v.setUint16(32, block, true);
  v.setUint16(34, bitDepth, true);
  str(36, "data");
  v.setUint32(40, len - 44, true);
  let off = 44;
  for (let i = 0; i < buffer.length; i++)
    for (let ch = 0; ch < 2; ch++) {
      const noise =
          dither && bitDepth === 16
            ? (Math.random() - Math.random()) / 65536
            : 0,
        x = Math.max(
          -1,
          Math.min(1, buffer.getChannelData(ch)[i]! * gain + noise),
        );
      if (bitDepth === 32) v.setFloat32(off, x, true);
      else v.setInt16(off, x < 0 ? x * 32768 : x * 32767, true);
      off += bytes;
    }
  return new Blob([ab], { type: "audio/wav" });
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
  }: RenderWavOptions = {},
) {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
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
    sr = sampleRate,
    duration =
      stepWithSwing(durationSteps, project.tempo, project.swing) +
      Math.max(0, Math.min(12, tailSeconds)),
    ctx = new OfflineAudioContext(2, Math.ceil(duration * sr), sr),
    master = ctx.createGain(),
    tone = ctx.createBiquadFilter(),
    comp = ctx.createDynamicsCompressor(),
    limiter = ctx.createDynamicsCompressor();
  master.gain.value = project.master * 0.78;
  tone.type = "highshelf";
  tone.frequency.value = 5200;
  tone.gain.value = 1.2;
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  limiter.threshold.value = -1.5;
  limiter.ratio.value = 20;
  if (project.masterSettings?.bypass) master.connect(ctx.destination);
  else
    master
      .connect(tone)
      .connect(comp)
      .connect(limiter)
      .connect(ctx.destination);
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
    soloActive = TRACKS.some((track) => project.tracks[track].solo),
    trackOutputs = Object.fromEntries(
      TRACKS.map((track) => {
        const output = ctx.createGain(),
          cfg = project.tracks[track],
          audible = !cfg.mute && (!soloActive || cfg.solo);
        output.gain.value = audible
          ? cfg.volume * dbToGain(cfg.preGainDb ?? 0)
          : 0;
        output.connect(master);
        return [track, output];
      }),
    ) as Record<TrackId, GainNode>,
    preSendOutputs = Object.fromEntries(
      TRACKS.map((track) => {
        const output = ctx.createGain(),
          cfg = project.tracks[track],
          audible = !cfg.mute && (!soloActive || cfg.solo);
        output.gain.value = audible ? dbToGain(cfg.preGainDb ?? 0) : 0;
        output.connect(master);
        return [track, output];
      }),
    ) as Record<TrackId, GainNode>;
  for (const clip of project.clips) {
    const { fx, macros } = clip.character,
      input = ctx.createGain(),
      eq = ctx.createBiquadFilter(),
      saturation = ctx.createWaveShaper(),
      shape = ctx.createWaveShaper(),
      dryGain = ctx.createGain(),
      chorus = ctx.createDelay(0.05),
      chorusWet = ctx.createGain(),
      chorusLfo = ctx.createOscillator(),
      chorusDepth = ctx.createGain(),
      delay = ctx.createDelay(0.8),
      feedback = ctx.createGain(),
      delayWet = ctx.createGain(),
      reverb = ctx.createConvolver(),
      reverbWet = ctx.createGain(),
      space = 0.55 + macros.space * 0.75,
      drive = 0.78 + macros.energy * 0.25 + (macros.aggression || 0) * 0.32,
      bypassed = dry || fx.bypass,
      trackOutput = trackOutputs[clip.track],
      sendTarget =
        project.tracks[clip.track].sendMode === "pre"
          ? preSendOutputs[clip.track]
          : trackOutput;
    eq.type = "highshelf";
    eq.frequency.value = 1800;
    eq.gain.value = bypassed
      ? 0
      : ((fx.tone ?? 0.5) - 0.5) * 18 - macros.darkness * 2;
    saturation.curve = makeSaturationCurve(
      bypassed ? 0 : (fx.saturation || 0) * drive,
    );
    saturation.oversample = "4x";
    shape.curve = makeCurve(bypassed ? 0 : (fx.distortion || 0) * drive);
    shape.oversample = "2x";
    dryGain.gain.value = bypassed ? 1 : 0.82;
    chorus.delayTime.value = 0.018;
    chorusWet.gain.value = bypassed ? 0 : (fx.chorus || 0) * 0.4;
    chorusLfo.frequency.value = 0.18 + (fx.chorus || 0) * 0.8;
    chorusDepth.gain.value = 0.002 + (fx.chorus || 0) * 0.006;
    delay.delayTime.value = 0.16 + (fx.delay || 0) * 0.22;
    feedback.gain.value = bypassed
      ? 0
      : Math.min(0.55, 0.1 + (fx.delay || 0) * 0.4);
    delayWet.gain.value = bypassed ? 0 : (fx.delay || 0) * 0.34 * space;
    reverb.buffer = getImpulse();
    reverbWet.gain.value = bypassed ? 0 : (fx.reverb || 0) * 0.42 * space;
    input.connect(eq).connect(saturation).connect(shape);
    shape.connect(dryGain).connect(trackOutput);
    shape.connect(chorus).connect(chorusWet).connect(trackOutput);
    chorusLfo.connect(chorusDepth).connect(chorus.delayTime);
    chorusLfo.start(0);
    chorusLfo.stop(duration);
    shape.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(delayWet).connect(sendTarget);
    shape.connect(reverb).connect(reverbWet).connect(sendTarget);
    buses[clip.id] = input;
  }
  const guitarEvent = (e: import("./core.js").PlaybackEvent, cfg: any) => {
    const start = stepWithSwing(e.step, project.tempo, project.swing),
      noteDuration = e.length * secondsPerStep(project.tempo),
      end =
        start +
        Math.max(0.12, noteDuration) +
        Math.max(0.12, cfg.release || 0.35),
      clip = project.clips.find((c) => c.id === e.clipId)!,
      macros = clip.character.macros,
      cut = automationValue(clip, "cutoff", e.localStep, 0.5),
      vol = automationValue(clip, "volume", e.localStep, 1),
      target = frequency(e.pitch),
      filter = ctx.createBiquadFilter(),
      body = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      pan = ctx.createStereoPanner(),
      peak = Math.max(0.002, Math.min(0.24, e.velocity * vol * 0.22));
    filter.type = "lowpass";
    filter.frequency.value = Math.max(
      900,
      (cfg.cutoff || 5200) * (0.45 + cut * 0.75) * (1 - macros.darkness * 0.28),
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
      const osc = ctx.createOscillator(),
        level = ctx.createGain();
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
    const pick = ctx.createBufferSource(),
      pickFilter = ctx.createBiquadFilter(),
      pickGain = ctx.createGain();
    pick.buffer = buffer;
    pickFilter.type = "bandpass";
    pickFilter.frequency.value = Math.min(9000, target * 8);
    pickFilter.Q.value = 0.7;
    pickGain.gain.value = peak * 0.75;
    pick.connect(pickFilter).connect(pickGain).connect(filter);
    pick.start(start);
  };
  const toneEvent = (e: import("./core.js").PlaybackEvent, cfg: any) => {
    const start = stepWithSwing(e.step, project.tempo, project.swing),
      end = start + e.length * secondsPerStep(project.tempo),
      clip = project.clips.find((c) => c.id === e.clipId)!,
      { lfo, macros } = clip.character,
      f = ctx.createBiquadFilter(),
      g = ctx.createGain(),
      pan = ctx.createStereoPanner(),
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
      cfg.cutoff * (0.35 + cut * 1.1) * (1 - macros.darkness * 0.35),
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
    const lfoNode = lfo.enabled ? ctx.createOscillator() : null,
      lfoGain: any = lfoNode ? ctx.createGain() : null;
    if (lfoNode) {
      lfoNode.frequency.value = lfo.rate;
      lfoGain.gain.value =
        lfo.target === "cutoff"
          ? cfg.cutoff * lfo.depth * 0.45
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
        const o = ctx.createOscillator(),
          og = ctx.createGain();
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
    if (cfg.osc2Wave && cfg.osc2Wave !== "off" && cfg.osc2Mix > 0)
      addOsc(cfg.osc2Wave, cfg.osc2Mix, 0.5);
  };
  const drumEvent = (e: import("./core.js").PlaybackEvent, cfg: any) => {
    const start = stepWithSwing(e.step, project.tempo, project.swing),
      g = ctx.createGain(),
      pan = ctx.createStereoPanner(),
      custom = drumSamples?.get(e.pitch);
    pan.pan.value = cfg.pan || 0;
    g.connect(pan).connect(buses[e.clipId]);
    if (custom) {
      const source = ctx.createBufferSource(),
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
      const o = ctx.createOscillator(),
        len = e.pitch === 0 ? 0.21 : 0.28;
      o.type = e.pitch === 4 ? "triangle" : "sine";
      o.frequency.setValueAtTime(e.pitch === 0 ? 150 : 125, start);
      o.frequency.exponentialRampToValueAtTime(
        e.pitch === 0 ? 43 : 72,
        start + len * 0.65,
      );
      g.gain.setValueAtTime(e.velocity * (e.pitch === 0 ? 0.45 : 0.32), start);
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
      const source = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter();
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
  for (const e of events)
    if (
      !project.tracks[e.track].mute &&
      (!soloActive || project.tracks[e.track].solo)
    )
      e.track === "drums"
        ? drumEvent(e, project.tracks.drums)
        : e.track === "guitar"
          ? guitarEvent(e, project.tracks.guitar)
          : toneEvent(e, project.tracks[e.track]);
  const audioSolo = (project.audioLanes || []).some((lane) => lane.solo);
  for (const lane of project.audioLanes || []) {
    if (lane.mute || (audioSolo && !lane.solo)) continue;
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
        start = stepWithSwing(startStep, project.tempo, project.swing),
        offset = Math.max(
          0,
          Math.min(
            buffer.duration - 0.001,
            regionItem.offsetSeconds +
              skipSteps * secondsPerStep(project.tempo) * rate,
          ),
        ),
        available = Math.max(0.001, buffer.duration - offset),
        wanted =
          (regionItem.lengthSteps - skipSteps) *
          secondsPerStep(project.tempo) *
          rate,
        sampleDuration = Math.min(available, wanted),
        audible = sampleDuration / rate,
        source = ctx.createBufferSource(),
        gain = ctx.createGain(),
        pan = ctx.createStereoPanner(),
        level = Math.max(0.0001, lane.volume * dbToGain(regionItem.gainDb));
      source.buffer = buffer;
      source.playbackRate.value = rate;
      pan.pan.value = Math.max(-1, Math.min(1, lane.pan));
      gain.gain.setValueAtTime(level, start);
      const fadeIn = Math.min(
          audible * 0.45,
          regionItem.fadeInSteps * secondsPerStep(project.tempo),
        ),
        fadeOut = Math.min(
          audible * 0.45,
          regionItem.fadeOutSteps * secondsPerStep(project.tempo),
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
      source.connect(gain).connect(pan).connect(master);
      source.start(start, offset, sampleDuration);
    }
  }
  const rendered = await ctx.startRendering();
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
  return wavBlob(rendered, bitDepth, normalize, dither);
}
