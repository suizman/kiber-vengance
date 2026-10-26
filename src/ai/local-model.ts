import { CPU_CACHE, type LocalBackend } from "./model-config";
import cpuWorkerUrl from "./cpu-worker.ts?worker&url";
import gpuWorkerUrl from "./inference-worker.ts?worker&url";
export type { LocalBackend } from "./model-config";

export const LOCAL_MODELS = [
  "Qwen3-0.6B-q4f16_1-MLC",
  "Qwen3-0.6B-q4f32_1-MLC",
] as const;
let worker: Worker | null = null;
let pending: {
  resolve(value: string): void;
  reject(error: Error): void;
} | null = null;
let progress: ((fraction: number, text: string) => void) | null = null;
let ready = false;
export const isLocalModelReady = () => ready;
let generation = 0;
let backend: "gpu" | "cpu" = "gpu";
const WORKER_CACHE = "kv-local-ai-workers-v1";
let workerBlob: string | null = null;
let bootController: AbortController | null = null;
function destroyWorker() {
  worker?.terminate();
  worker = null;
  if (workerBlob) URL.revokeObjectURL(workerBlob);
  workerBlob = null;
}
let deadline: ReturnType<typeof setTimeout> | undefined;
export function stopLocalModel() {
  generation++;
  clearTimeout(deadline);
  bootController?.abort();
  bootController = null;
  destroyWorker();
  ready = false;
  pending?.reject(new Error("Cancelled"));
  pending = null;
  progress = null;
}
function request(message: unknown, timeout = 120000): Promise<string> {
  if (!worker || pending)
    return Promise.reject(new Error("Local model is unavailable or busy."));
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    deadline = setTimeout(() => {
      const current = pending;
      pending = null;
      stopLocalModel();
      current?.reject(
        new Error("Local model timed out. Free memory and try again."),
      );
    }, timeout);
    worker!.postMessage(message);
  });
}
async function openWorker(kind: "gpu" | "cpu" = "gpu") {
  backend = kind;
  const token = generation;
  // Keep the actual bundled runtime in its own cache: WebKit does not reliably
  // route module-worker startup through the page's Service Worker when offline.
  const url = new URL(
    kind === "cpu" ? cpuWorkerUrl : gpuWorkerUrl,
    location.href,
  );
  let cache: Cache | undefined;
  try {
    cache = await caches.open(WORKER_CACHE);
  } catch {
    /* Online loading remains possible. */
  }
  const controller = new AbortController();
  bootController = controller;
  let response = await cache?.match(url.href);
  if (!response) {
    response = await fetch(url, { signal: controller.signal });
    if (!response.ok)
      throw new Error(`Cannot load ${kind} runtime: HTTP ${response.status}`);
    try {
      await cache?.put(url.href, response.clone());
    } catch {
      /* Cache quota cannot prevent online use. */
    }
  }
  const source = await response.text();
  if (generation !== token || controller.signal.aborted)
    throw new Error("Cancelled");
  bootController = null;
  // Vite development modules retain imports and need the development server.
  // Production workers are bundled; restore their real base URL for WASM URLs.
  const developmentModule = /^\s*import\s*(?:[\w*{]|["'])/m.test(source);
  const workerUrl = developmentModule
    ? url.href
    : (workerBlob = URL.createObjectURL(
        new Blob([`import.meta.url = ${JSON.stringify(url.href)};\n`, source], {
          type: "text/javascript",
        }),
      ));
  worker = new Worker(workerUrl, { type: "module" });
  const activeWorker = worker;
  worker.onmessage = (event) => {
    if (worker !== activeWorker) return;
    const data = event.data;
    if (data.kind === "progress") {
      progress?.(data.progress, data.text);
      return;
    }
    clearTimeout(deadline);
    const current = pending;
    pending = null;
    if (data.kind === "error") current?.reject(new Error(data.message));
    else {
      if (data.kind === "loaded") ready = true;
      current?.resolve(
        data.kind === "probed" ? String(data.supported) : data.text || "",
      );
    }
  };
  worker.onerror = (event) => {
    if (worker !== activeWorker) return;
    const location = event.filename
      ? ` (${event.filename.split("/").pop()}:${event.lineno})`
      : "";
    const explanation = !navigator.onLine
      ? "browser blocked offline worker startup; reconnect to load the model, then generate offline while it remains loaded"
      : backend === "cpu"
        ? "could not start; check browser compatibility and script/content blocking"
        : "could not start; select CPU compatibility mode";
    const error = new Error(
      `${backend.toUpperCase()} worker: ${event.message || explanation}${location}`,
    );
    const current = pending;
    pending = null;
    clearTimeout(deadline);
    destroyWorker();
    ready = false;
    current?.reject(error);
  };
}
export async function loadLocalModel(
  onProgress: (fraction: number, text: string) => void,
  mode: LocalBackend = "auto",
) {
  stopLocalModel();
  const attempt = generation;
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> };
    }
  ).gpu;
  if (!gpu && mode === "gpu")
    throw new Error(
      "WebGPU is unavailable. Select CPU compatibility mode to run locally without it.",
    );
  const adapter =
    mode === "cpu" ? null : await gpu?.requestAdapter().catch(() => null);
  if (generation !== attempt) throw new Error("Cancelled");
  if (!adapter && mode === "gpu")
    throw new Error(
      "No compatible WebGPU adapter. Select CPU compatibility mode.",
    );
  let selected: "gpu" | "cpu" = adapter ? "gpu" : "cpu";
  await openWorker(selected);
  if (selected === "gpu") {
    try {
      const supported = await request({ kind: "probe" }, 15000);
      if (generation !== attempt) throw new Error("Cancelled");
      if (supported !== "true")
        throw new Error(
          "WebGPU is not available inside this browser's worker.",
        );
    } catch (error) {
      if (mode !== "auto" || generation !== attempt) throw error;
      destroyWorker();
      selected = "cpu";
      await openWorker(selected);
    }
  }
  const model = adapter?.features.has("shader-f16")
    ? LOCAL_MODELS[0]
    : LOCAL_MODELS[1];
  progress = onProgress;
  onProgress(
    0,
    selected === "cpu" ? "CPU / WASM · compatibility mode" : "GPU / WebGPU",
  );
  try {
    await request({ kind: "load", model }, 300000);
  } catch (error) {
    if (mode !== "auto" || selected !== "gpu" || generation !== attempt)
      throw error;
    destroyWorker();
    ready = false;
    selected = "cpu";
    await openWorker(selected);
    onProgress(
      0,
      "GPU unavailable · switching to CPU / WASM compatibility mode",
    );
    await request({ kind: "load" }, 300000);
  }
  return selected;
}
export async function generateLocalPlan(
  prompt: string,
  key: string,
  scale: string,
  bars: number,
  onProgress?: (fraction: number, text: string) => void,
) {
  if (!ready) throw new Error("Load the local model first.");
  progress = onProgress ?? null;
  return request(
    { kind: "generate", prompt, key, scale, bars },
    backend === "cpu" ? 300000 : 120000,
  );
}
export async function deleteLocalModelCache() {
  stopLocalModel();
  await caches.delete(CPU_CACHE);
  await caches.delete(WORKER_CACHE);
  // Cache API cleanup needs neither GPU support nor parsing the GPU runtime.
  for (const name of await caches.keys()) {
    if (!["webllm/model", "webllm/config", "webllm/wasm"].includes(name))
      continue;
    const cache = await caches.open(name);
    for (const item of await cache.keys()) {
      if (
        LOCAL_MODELS.some((model) =>
          item.url.includes(model.replace("-MLC", "")),
        )
      )
        await cache.delete(item);
    }
  }
}
