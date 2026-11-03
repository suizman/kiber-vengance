export function encodeAudioBuffer(
  buffer: AudioBuffer,
  bitDepth: 16 | 32,
  normalize: boolean,
  dither: boolean,
  signal?: AbortSignal,
): Promise<Blob> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./wav-worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener("abort", cancel);
      clearTimeout(deadline);
    };
    const cancel = () => {
      finish();
      reject(new DOMException("Export cancelled", "AbortError"));
    };
    const deadline = setTimeout(() => {
      finish();
      reject(new Error("WAV encoding timed out"));
    }, 60_000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "WAV encoder failed"));
    };
    worker.onmessage = ({
      data,
    }: MessageEvent<{ buffer?: ArrayBuffer; error?: string }>) => {
      finish();
      if (data.buffer) resolve(new Blob([data.buffer], { type: "audio/wav" }));
      else reject(new Error(data.error || "WAV encoder returned no data"));
    };
    const channels = Array.from(
      { length: buffer.numberOfChannels },
      (_, index) => buffer.getChannelData(index).slice(),
    );
    worker.postMessage(
      { channels, sampleRate: buffer.sampleRate, bitDepth, normalize, dither },
      channels.map((channel) => channel.buffer),
    );
  });
}
export function offlineContext(
  frames: number,
  sampleRate: number,
  bitDepth: number,
): OfflineAudioContext {
  const mobile =
    /Android|iPhone|iPad/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const workingBytes = frames * 2 * (12 + bitDepth / 8),
    budget = (mobile ? 160 : 512) * 1024 * 1024;
  if (!Number.isFinite(frames) || frames < 1 || workingBytes > budget)
    throw new Error(
      `This export exceeds the device memory budget. Export a shorter region or lower the sample rate (about ${Math.floor(budget / (sampleRate * 2 * (12 + bitDepth / 8)))} seconds at these settings).`,
    );
  return new OfflineAudioContext(2, frames, sampleRate);
}
