export interface WavPcm {
  channels: Float32Array[];
  sampleRate: number;
  bitDepth: 16 | 32;
  normalize: boolean;
  dither: boolean;
}
/** Shared encoder for the small synchronous utility and cancellable export worker. */
export function encodeWavPcm({
  channels,
  sampleRate,
  bitDepth,
  normalize,
  dither,
}: WavPcm): ArrayBuffer {
  const frames = channels[0]?.length || 0,
    count = channels.length,
    bytes = bitDepth / 8,
    block = count * bytes;
  if (
    !count ||
    count > 2 ||
    channels.some((channel) => channel.length !== frames)
  )
    throw new Error("Invalid PCM channels");
  const buffer = new ArrayBuffer(44 + frames * block),
    view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, index) =>
      view.setUint8(offset + index, char.charCodeAt(0)),
    );
  let peak = 0;
  if (normalize)
    for (const channel of channels)
      for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const gain = normalize && peak > 0 ? Math.min(8, 0.988 / peak) : 1;
  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true);
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * block, true);
  view.setUint16(32, block, true);
  view.setUint16(34, bitDepth, true);
  text(36, "data");
  view.setUint32(40, buffer.byteLength - 44, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame++)
    for (const channel of channels) {
      const noise =
          dither && bitDepth === 16
            ? (Math.random() - Math.random()) / 65536
            : 0,
        sample = channel[frame] || 0,
        value = Math.max(-1, Math.min(1, sample * gain + noise));
      if (bitDepth === 32) view.setFloat32(offset, value, true);
      else
        view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true);
      offset += bytes;
    }
  return buffer;
}
