export interface MeterReading {
  left: number;
  right: number;
  peak: number;
  rms: number;
}
/** Actual stereo sample peaks; no pan-derived approximation or gain multiplier. */
export class StereoMeter {
  private split: ChannelSplitterNode;
  private channels: AnalyserNode[];
  private data: Float32Array<ArrayBuffer>;
  constructor(ctx: BaseAudioContext, input: AudioNode) {
    this.split = ctx.createChannelSplitter(2);
    input.connect(this.split);
    this.channels = [ctx.createAnalyser(), ctx.createAnalyser()];
    this.data = new Float32Array(512);
    this.channels.forEach((node, i) => {
      node.fftSize = 512;
      this.split.connect(node, i);
    });
  }
  read(): MeterReading {
    let energy = 0;
    const peaks = this.channels.map((node) => {
      node.getFloatTimeDomainData(this.data);
      let peak = 0;
      for (const sample of this.data) {
        peak = Math.max(peak, Math.abs(sample));
        energy += sample * sample;
      }
      return peak;
    });
    return {
      left: peaks[0]!,
      right: peaks[1]!,
      peak: Math.max(...peaks),
      rms: Math.sqrt(energy / (this.data.length * 2)),
    };
  }
  dispose() {
    this.split.disconnect();
    this.channels.forEach((node) => node.disconnect());
  }
}
