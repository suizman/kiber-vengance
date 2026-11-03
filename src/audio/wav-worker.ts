import { encodeWavPcm, type WavPcm } from "./wav-codec";
self.onmessage = ({ data }: MessageEvent<WavPcm>) => {
  try {
    const buffer = encodeWavPcm(data);
    self.postMessage({ buffer }, { transfer: [buffer] });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
