export type DeckId = "A" | "B";
export interface DeckPosition {
  frame: number;
  speed: number;
  playing: boolean;
}
/** One processor, one load acknowledgement and one independent musical state. */
export class DeckProcessor {
  node: AudioWorkletNode | null = null;
  filter: BiquadFilterNode | null = null;
  gain: GainNode | null = null;
  cueGain: GainNode | null = null;
  frames = 0;
  sampleRate = 44100;
  position = 0;
  speed = 1;
  playing = false;
  ready = false;
  onPosition: ((state: DeckPosition) => void) | null = null;
  private sequence = 0;
  private pending: {
    id: number;
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  constructor(
    readonly id: DeckId,
    private gesture: (target: string, value: number | boolean) => void,
  ) {}
  connect(context: AudioContext, output: AudioNode, cueOutput: AudioNode) {
    this.filter = context.createBiquadFilter();
    this.filter.frequency.value = 20000;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.cueGain = context.createGain();
    this.cueGain.gain.value = 0;
    this.filter.connect(this.gain).connect(output);
    this.filter.connect(this.cueGain).connect(cueOutput);
  }
  attach(context: AudioContext) {
    if (this.node) return;
    const node = new AudioWorkletNode(context, "kv-scratch-deck", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      parameterData: { speed: 1 },
    });
    node.connect(this.filter!);
    this.node = node;
    node.port.onmessage = ({ data }) => {
      if (
        data.type === "ready" &&
        this.pending &&
        data.requestId === this.pending.id
      ) {
        this.ready = true;
        this.playing = true;
        clearTimeout(this.pending.timer);
        this.pending.resolve();
        this.pending = null;
      } else if (data.type === "position") {
        this.position = data.frame;
        this.speed = data.speed;
        this.playing = data.playing;
        this.onPosition?.(data);
      }
    };
  }
  load(buffer: AudioBuffer) {
    if (!this.node)
      return Promise.reject(new Error("Scratch AudioWorklet unavailable"));
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error("Superseded deck load"));
      this.pending = null;
    }
    const id = ++this.sequence;
    const left = new Float32Array(buffer.getChannelData(0));
    const right = new Float32Array(
      buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1)),
    );
    this.frames = left.length;
    this.sampleRate = buffer.sampleRate;
    this.ready = false;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.id === id) {
          this.pending = null;
          reject(new Error("Scratch processor did not acknowledge the buffer"));
        }
      }, 3000);
      this.pending = { id, resolve, reject, timer };
      this.node!.port.postMessage(
        { type: "load", requestId: id, left, right },
        [left.buffer, right.buffer],
      );
    });
  }
  private emit(target: string, value: number | boolean) {
    this.gesture(`${this.id === "B" ? "B:" : ""}${target}`, value);
  }
  setPlaying(value: boolean) {
    this.playing = value;
    this.node?.port.postMessage({ type: "play", value });
    this.emit("playing", value);
  }
  setSpeed(value: number, ramp = 0.025) {
    const parameter = this.node?.parameters.get("speed");
    if (!parameter || !this.node) return;
    const now = this.node.context.currentTime,
      target = Math.max(-6, Math.min(6, value));
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    if (ramp > 0) parameter.linearRampToValueAtTime(target, now + ramp);
    else parameter.setValueAtTime(target, now);
    this.speed = target;
    this.emit("speed", target);
  }
  setFilter(value: number) {
    const normalized = Math.max(0, Math.min(1, value));
    this.filter?.frequency.setTargetAtTime(
      120 * Math.pow(20000 / 120, normalized),
      this.filter.context.currentTime,
      0.018,
    );
    this.emit("filter", normalized);
  }
  setStutter(frames: number) {
    this.node?.port.postMessage({ type: "stutter", frames });
    this.emit("stutter", frames > 0);
  }
  seek(frame: number) {
    this.position = frame;
    this.node?.port.postMessage({ type: "seek", frame });
  }
  sync(beatFrames: number, speed = 1) {
    this.node?.port.postMessage({ type: "sync", beatFrames });
    this.setSpeed(speed, 0.08);
  }
}
