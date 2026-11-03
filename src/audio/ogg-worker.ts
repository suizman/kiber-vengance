import { createEncoder } from "wasm-media-encoders";
import oggWasm from "wasm-media-encoders/wasm/ogg?url";

let encoder: Awaited<ReturnType<typeof createEncoder<"audio/ogg">>>;
const chunks: Uint8Array<ArrayBuffer>[] = [];
const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (value: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      const response = await fetch(oggWasm);
      if (!response.ok) throw new Error("OGG encoder could not be loaded");
      encoder = await createEncoder("audio/ogg", await response.arrayBuffer());
      encoder.configure({
        channels: 2,
        sampleRate: data.sampleRate,
        vbrQuality: data.quality,
      });
    } else if (data.type === "pcm") {
      const bytes = encoder.encode(data.channels);
      if (bytes.length) chunks.push(bytes.slice());
    } else if (data.type === "finish") {
      chunks.push(encoder.finalize().slice());
      // Transfer owned bytes. The downloadable Blob belongs to the window,
      // rather than relying on a worker Blob surviving worker termination.
      const bytes = new Uint8Array(
        chunks.reduce((size, chunk) => size + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      chunks.length = 0;
      scope.postMessage({ id: data.id, type: "encoded", bytes: bytes.buffer }, [
        bytes.buffer,
      ]);
      return;
    } else {
      throw new Error("Unknown OGG encoder request");
    }
    scope.postMessage({ id: data.id, type: "ready" });
  } catch (error) {
    scope.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
