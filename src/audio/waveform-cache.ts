/** Peak envelopes are independent of colour, selection and playback position. */
const cache = new WeakMap<AudioBuffer, Map<number, Float32Array>>();
export function waveformPeaks(
  buffer: AudioBuffer,
  width: number,
): Float32Array {
  const size = Math.max(1, Math.round(width));
  let widths = cache.get(buffer);
  if (!widths) {
    widths = new Map();
    cache.set(buffer, widths);
  }
  const found = widths.get(size);
  if (found) return found;
  const data = buffer.getChannelData(0),
    peaks = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const start = Math.floor((x * data.length) / size),
      end = Math.max(start + 1, Math.floor(((x + 1) * data.length) / size));
    let peak = 0;
    for (let i = start; i < Math.min(end, data.length); i++)
      peak = Math.max(peak, Math.abs(data[i]!));
    peaks[x] = peak;
  }
  if (widths.size >= 4) widths.delete(widths.keys().next().value!);
  widths.set(size, peaks);
  return peaks;
}
