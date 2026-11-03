/** Local Ogg/Vorbis encoding. Only one bounded PCM block crosses the worker at a time. */
export async function encodeOgg(
  buffer: AudioBuffer,
  {
    quality = 4,
    normalize = false,
    signal,
    onProgress,
  }: {
    quality?: number;
    normalize?: boolean;
    signal?: AbortSignal | undefined;
    onProgress?: ((fraction: number) => void) | undefined;
  } = {},
): Promise<Blob> {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
  const worker = new Worker(new URL("./ogg-worker.ts", import.meta.url), {
    type: "module",
  });
  type Reply = {
    id: number;
    type?: "ready" | "encoded";
    bytes?: ArrayBuffer;
    error?: string;
  };
  let serial = 0;
  let phase = "loading";
  let failure: Error | undefined;
  let pending:
    | {
        id: number;
        resolve: (value: Reply) => void;
        reject: (error: Error) => void;
      }
    | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const fail = (error: Error) => {
    failure = error;
    clearTimeout(deadline);
    const request = pending;
    pending = undefined;
    request?.reject(error);
  };
  // Install handlers immediately: normalization yields before the first request,
  // and worker startup errors must not be lost during that interval.
  worker.onerror = (event) => {
    event.preventDefault();
    const detail =
      event.message || "The worker stopped without an error message";
    fail(
      new Error(
        `OGG encoder failed during ${phase}: ${detail}${phase === "loading" ? ". Reload the application and try again." : ""}`,
      ),
    );
  };
  worker.onmessageerror = () =>
    fail(new Error(`OGG encoder communication failed during ${phase}`));
  worker.onmessage = ({ data }: MessageEvent<Reply>) => {
    if (!pending || data.id !== pending.id) {
      fail(new Error(`Invalid OGG encoder response during ${phase}`));
      return;
    }
    clearTimeout(deadline);
    const request = pending;
    pending = undefined;
    if (data.error) fail(new Error(`OGG ${phase} failed: ${data.error}`));
    if (failure) request.reject(failure);
    else request.resolve(data);
  };
  const aborted = () => {
    fail(new DOMException("Export cancelled", "AbortError"));
    worker.terminate();
  };
  signal?.addEventListener("abort", aborted, { once: true });
  const request = (
    data: Record<string, unknown>,
    transfer: Transferable[] = [],
  ): Promise<Reply> => {
    if (signal?.aborted)
      return Promise.reject(new DOMException("Export cancelled", "AbortError"));
    if (failure) return Promise.reject(failure);
    phase =
      data.type === "init"
        ? "loading"
        : data.type === "finish"
          ? "finalization"
          : "compression";
    return new Promise((resolve, reject) => {
      const id = ++serial;
      pending = { id, resolve, reject };
      deadline = setTimeout(
        () => fail(new Error(`OGG encoder did not respond during ${phase}`)),
        30000,
      );
      try {
        worker.postMessage({ ...data, id }, transfer);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };
  try {
    const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
    let peak = 0;
    if (normalize) {
      for (const channel of channels) {
        for (let offset = 0; offset < channel.length; offset += 262144) {
          for (const sample of channel.subarray(offset, offset + 262144))
            peak = Math.max(peak, Math.abs(sample));
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          if (signal?.aborted)
            throw new DOMException("Export cancelled", "AbortError");
        }
      }
    }
    const gain = normalize && peak > 0 ? Math.min(8, 0.988 / peak) : 1;
    await request({
      type: "init",
      sampleRate: buffer.sampleRate,
      quality: Math.max(-1, Math.min(10, quality)),
    });
    for (let offset = 0; offset < buffer.length; offset += 16384) {
      const block = channels.map((channel) => {
        const samples = channel.slice(offset, offset + 16384);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.max(-1, Math.min(1, samples[i]! * gain));
        return samples;
      });
      await request(
        { type: "pcm", channels: block },
        block.map((channel) => channel.buffer),
      );
      onProgress?.(Math.min(0.99, (offset + 16384) / buffer.length));
    }
    const result = await request({ type: "finish" });
    if (result.type !== "encoded" || !(result.bytes instanceof ArrayBuffer))
      throw new Error("OGG finalization returned no encoded audio");
    const bytes = new Uint8Array(result.bytes);
    if (
      bytes.length < 27 ||
      bytes[0] !== 79 ||
      bytes[1] !== 103 ||
      bytes[2] !== 103 ||
      bytes[3] !== 83
    )
      throw new Error("OGG finalization returned an invalid container");
    const blob = new Blob([result.bytes], { type: "audio/ogg" });
    onProgress?.(1);
    return blob;
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener("abort", aborted);
    worker.terminate();
  }
}
