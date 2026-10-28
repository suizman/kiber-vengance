import type { AudioEffects } from "../model";
import { normalizeEffects } from "./effects-model";
/** Shared live/offline graph. Neutral audio allocates only two gains. */
export class AudioFx {
  readonly input: GainNode;
  readonly output: GainNode;
  private original: GainNode;
  private processed: GainNode;
  private stages = new Map<
    string,
    { input: AudioNode; output: AudioNode; update: (value: number) => void }
  >();
  private nodes: AudioNode[] = [];
  private oscillators: OscillatorNode[] = [];
  private settings = normalizeEffects();
  private disposed = false;
  constructor(
    private ctx: BaseAudioContext,
    settings?: AudioEffects,
  ) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.original = ctx.createGain();
    this.processed = ctx.createGain();
    this.original.gain.value = settings?.bypass ? 1 : 0;
    this.processed.gain.value = settings?.bypass ? 0 : 1;
    this.input.connect(this.original).connect(this.output);
    this.input.connect(this.processed).connect(this.output);
    this.update(settings);
  }
  private smooth(param: AudioParam, value: number) {
    param.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }
  update(settings?: AudioEffects) {
    if (this.disposed) return;
    this.settings = normalizeEffects(settings);
    this.smooth(this.original.gain, this.settings.bypass ? 1 : 0);
    this.smooth(this.processed.gain, this.settings.bypass ? 0 : 1);
    const active = this.settings;
    let topology = false;
    for (const key of [
      "filter",
      "tone",
      "compression",
      "saturation",
      "distortion",
      "chorus",
      "delay",
      "reverb",
    ] as const) {
      const value = active[key];
      if (!this.stages.has(key) && value !== (key === "filter" ? 1 : 0)) {
        this.stages.set(key, this.create(key));
        topology = true;
      }
      this.stages.get(key)?.update(value);
    }
    if (topology) {
      this.input.disconnect();
      this.input.connect(this.original);
      for (const stage of this.stages.values()) stage.output.disconnect();
      let last: AudioNode = this.input;
      for (const key of [
        "filter",
        "tone",
        "compression",
        "saturation",
        "distortion",
        "chorus",
        "delay",
        "reverb",
      ]) {
        const stage = this.stages.get(key);
        if (stage) {
          last.connect(stage.input);
          last = stage.output;
        }
      }
      last.connect(this.processed);
    }
  }
  private create(key: string) {
    const c = this.ctx,
      own = <T extends AudioNode>(node: T): T => {
        this.nodes.push(node);
        return node;
      },
      smooth = this.smooth.bind(this);
    if (key === "filter" || key === "tone") {
      const node = own(c.createBiquadFilter());
      node.type = key === "filter" ? "lowpass" : "highshelf";
      node.Q.value = 0.707;
      if (key === "filter") {
        const input = own(c.createGain()),
          output = own(c.createGain()),
          dry = own(c.createGain()),
          wet = own(c.createGain());
        dry.gain.value = 1;
        wet.gain.value = 0;
        input.connect(dry).connect(output);
        input.connect(node).connect(wet).connect(output);
        return {
          input,
          output,
          update: (v: number) => {
            smooth(
              node.frequency,
              Math.min(c.sampleRate * 0.49, 120 * Math.pow(20000 / 120, v)),
            );
            smooth(dry.gain, v >= 1 ? 1 : 0);
            smooth(wet.gain, v >= 1 ? 0 : 1);
          },
        };
      }
      return {
        input: node,
        output: node,
        update: (v: number) => (
          smooth(node.frequency, 2200),
          smooth(node.gain, v * 12)
        ),
      };
    }
    if (key === "compression") {
      const node = own(c.createDynamicsCompressor());
      node.attack.value = 0.008;
      node.release.value = 0.16;
      node.knee.value = 12;
      return {
        input: node,
        output: node,
        update: (v: number) => {
          smooth(node.threshold, -8 - v * 24);
          smooth(node.ratio, 1 + v * 7);
        },
      };
    }
    const input = own(c.createGain()),
      output = own(c.createGain()),
      dry = own(c.createGain()),
      wet = own(c.createGain());
    dry.gain.value = 1;
    wet.gain.value = 0;
    input.connect(dry).connect(output);
    wet.connect(output);
    const mix = (v: number) => {
      smooth(dry.gain, 1 - v);
      smooth(wet.gain, v);
    };
    if (key === "saturation" || key === "distortion") {
      const node = own(c.createWaveShaper());
      node.oversample = "2x";
      input.connect(node).connect(wet);
      const curve = new Float32Array(2048);
      for (let i = 0; i < curve.length; i++) {
        const x = (i * 2) / (curve.length - 1) - 1;
        curve[i] =
          key === "saturation"
            ? Math.tanh(x * 3) / Math.tanh(3)
            : Math.max(-1, Math.min(1, x * 8));
      }
      node.curve = curve;
      return { input, output, update: mix };
    }
    if (key === "chorus") {
      const node = own(c.createDelay(0.06)),
        osc = own(c.createOscillator()),
        depth = own(c.createGain());
      node.delayTime.value = 0.019;
      osc.frequency.value = 0.7;
      depth.gain.value = 0.003;
      osc.connect(depth).connect(node.delayTime);
      osc.start();
      this.oscillators.push(osc);
      input.connect(node).connect(wet);
      return { input, output, update: (v: number) => mix(v * 0.5) };
    }
    if (key === "delay") {
      const delay = own(c.createDelay(1)),
        feedback = own(c.createGain());
      delay.delayTime.value = 0.28;
      feedback.gain.value = 0.35;
      input.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet);
      return { input, output, update: (v: number) => mix(v * 0.6) };
    }
    const node = own(c.createConvolver()),
      impulse = c.createBuffer(2, Math.ceil(c.sampleRate * 2), c.sampleRate);
    // Deterministic impulse: live and offline use identical coefficients.
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let seed = 1 + ch;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        data[i] = (seed / 2147483648) * Math.pow(1 - i / data.length, 3);
      }
    }
    node.buffer = impulse;
    input.connect(node).connect(wet);
    return { input, output, update: (v: number) => mix(v * 0.65) };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const osc of this.oscillators) osc.stop();
    this.input.disconnect();
    this.output.disconnect();
    this.original.disconnect();
    this.processed.disconnect();
    for (const node of this.nodes) node.disconnect();
  }
}
export async function processAudio(
  buffer: AudioBuffer,
  effects: AudioEffects,
  tail = 2.5,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    Math.ceil((buffer.duration + tail) * buffer.sampleRate),
    buffer.sampleRate,
  );
  const graph = new AudioFx(ctx, effects),
    source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(graph.input);
  graph.output.connect(ctx.destination);
  source.start();
  try {
    return await ctx.startRendering();
  } finally {
    graph.dispose();
  }
}
