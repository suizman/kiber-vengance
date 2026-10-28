import { VOICE_ENGINES } from "./voice-engines";
import { chatterboxUnavailable } from "./voice-safety";
import expressiveWorkerUrl from "./chatterbox-worker.ts?worker&url";
import workerUrl from "./voice-worker.ts?worker&url";
import { acquireInference } from "./inference-lock";
export interface SpeechSettings {
  engine?: "kokoro" | "chatterbox";
  device?: "wasm" | "webgpu";
  intensity?: number;
  pauseMs?: number;
  segments?: { text: string; speed: number; pauseMs: number }[];
  text: string;
  language: "en" | "es";
  voice: string;
  speed: number;
  dtype: "q8" | "fp32";
}
export interface SpeechResult {
  revision?: string;
  pcm: Float32Array;
  sampleRate: number;
  phonemes: string;
  settings: SpeechSettings;
  model: string;
}
let worker: Worker | null = null,
  blobUrl: string | null = null;
let cancel: (() => void) | null = null;
let loaded = "";
let boot: AbortController | null = null;
let epoch = 0;
export function freeVoice() {
  epoch++;
  boot?.abort();
  boot = null;
  worker?.terminate();
  worker = null;
  loaded = "";
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = null;
  cancel?.();
  cancel = null;
}
async function request(
  message: unknown,
  progress: (text: string) => void,
  timeout: number,
): Promise<any> {
  if (!worker || cancel) throw new Error("Voice worker unavailable or busy");
  const release = acquireInference("voice");
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        freeVoice();
        reject(new Error("Voice inference timed out"));
      }, timeout);
      cancel = () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      };
      worker!.onerror = (event) => {
        clearTimeout(timer);
        cancel = null;
        reject(new Error(event.message || "Voice worker failed"));
      };
      worker!.onmessage = ({ data }) => {
        if (data.kind === "progress") {
          progress(data.text);
          return;
        }
        clearTimeout(timer);
        cancel = null;
        if (data.kind === "error") reject(new Error(data.message));
        else resolve(data);
      };
      worker!.postMessage(message);
    });
  } finally {
    release();
  }
}
export async function loadVoice(
  settings: SpeechSettings,
  progress: (text: string) => void,
) {
  if (settings.engine === "chatterbox" && chatterboxUnavailable(navigator))
    throw new Error(
      "Chatterbox is unavailable on mobile/tablets and low-memory devices to prevent page restarts. Use Kokoro q8.",
    );
  freeVoice();
  const token = epoch,
    controller = new AbortController();
  boot = controller;
  try {
    const url = new URL(
        settings.engine === "chatterbox" ? expressiveWorkerUrl : workerUrl,
        location.href,
      ).href,
      cache = await caches.open("kv-local-voice-runtime-v1");
    let response = await cache.match(url);
    if (!response) {
      response = await fetch(url, { signal: controller.signal });
      if (!response.ok)
        throw new Error(`Voice runtime HTTP ${response.status}`);
      await cache.put(url, response.clone());
    }
    const source = await response.text();
    if (token !== epoch) throw new DOMException("Cancelled", "AbortError");
    const developmentModule = /^\s*import\s*(?:[\w*{]|["'])/m.test(source);
    if (!developmentModule)
      blobUrl = URL.createObjectURL(
        new Blob([source.replaceAll("import.meta.url", JSON.stringify(url))], {
          type: "text/javascript",
        }),
      );
    worker = new Worker(developmentModule ? url : blobUrl!, { type: "module" });
    await request(
      {
        kind: "load",
        dtype: settings.dtype,
        voice: settings.voice,
        device: settings.device ?? "wasm",
      },
      progress,
      settings.engine === "chatterbox" ? 600000 : 300000,
    );
    loaded = `${settings.engine ?? "kokoro"}:${settings.dtype}:${settings.device ?? "wasm"}`;
  } catch (error) {
    freeVoice();
    throw error;
  }
}
export async function generateSpeech(
  settings: SpeechSettings,
  progress: (text: string) => void,
): Promise<SpeechResult> {
  if (
    loaded !==
    `${settings.engine ?? "kokoro"}:${settings.dtype}:${settings.device ?? "wasm"}`
  )
    throw new Error("Load this precision first");
  const result = await request(
    { kind: "generate", ...settings },
    progress,
    settings.engine === "chatterbox" ? 900000 : 300000,
  );
  return {
    ...result,
    settings: { ...settings },
    model: VOICE_ENGINES[settings.engine ?? "kokoro"].model,
    revision: VOICE_ENGINES[settings.engine ?? "kokoro"].revision,
  };
}
export async function deleteVoiceCache() {
  freeVoice();
  for (const name of [
    "kv-expressive-model-v1",
    "kv-expressive-tokenizer-v1",
    "kv-local-voice-model-v1",
    "kv-local-voice-vectors-v1",
    "kv-local-voice-runtime-v1",
    "kv-local-voice-phonemes-v1",
  ])
    await caches.delete(name);
  // The PWA also caches same-origin fetches. Remove voice-only duplicates,
  // keeping the shared ONNX WASM and every musical project asset intact.
  for (const name of await caches.keys()) {
    if (!name.startsWith("kv-studio-")) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys())
      if (
        /\/(chatterbox-worker-|voice-worker-|espeak-ng-)/.test(
          new URL(request.url).pathname,
        )
      )
        await cache.delete(request);
  }
}
export function speechWav(result: SpeechResult): Blob {
  const data = new ArrayBuffer(44 + result.pcm.length * 2),
    view = new DataView(data);
  const string = (at: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  string(0, "RIFF");
  view.setUint32(4, data.byteLength - 8, true);
  string(8, "WAVE");
  string(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, result.sampleRate, true);
  view.setUint32(28, result.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  string(36, "data");
  view.setUint32(40, result.pcm.length * 2, true);
  result.pcm.forEach((sample, i) =>
    view.setInt16(
      44 + i * 2,
      Math.round(
        Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767),
      ),
      true,
    ),
  );
  return new Blob([data], { type: "audio/wav" });
}
