import { parseScore } from "./parse";
self.onmessage = ({
  data,
}: MessageEvent<{ id: number; bytes: ArrayBuffer; name: string }>) => {
  try {
    self.postMessage({
      id: data.id,
      result: parseScore(new Uint8Array(data.bytes), data.name),
    });
  } catch (error) {
    self.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
