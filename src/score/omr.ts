import { acquireInference } from "../ai/inference-lock";
import cpuModuleUrl from "../../node_modules/onnxruntime-web/dist/ort.wasm.min.mjs?url";
import cpuFactoryUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import cpuWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import moduleUrl from "../../node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs?url";
import factoryUrl from "onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url";
export const OMR_CACHE = "kv-omr-homr-fbe8be58-v1";
export const mobileReader = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export interface OmrProgress {
  stage: "download" | "segment" | "staff" | "retry";
  name?: string;
  loaded?: number;
  total?: number;
  staff?: number;
}
export async function recognizePage(
  image: Blob,
  signal: AbortSignal,
  onProgress: (progress: OmrProgress) => void,
  options: { gpu?: boolean; systems?: string } = {},
): Promise<{ xml: string; warnings: string[] }> {
  signal.throwIfAborted();
  const bytes = await image.arrayBuffer();
  signal.throwIfAborted();
  const release = acquireInference("score");
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("./omr/omr-worker.js", document.baseURI),
        { type: "module" },
      );
      const warnings: string[] = [],
        downloads = new Map<string, number>();
      const finish = () => {
        worker.terminate();
        signal.removeEventListener("abort", cancel);
        clearTimeout(deadline);
      };
      const cancel = () => {
        finish();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const deadline = setTimeout(() => {
        finish();
        reject(
          new Error(
            "Recognition timed out. Crop this page to a smaller region and retry.",
          ),
        );
      }, 15 * 60_000);
      signal.addEventListener("abort", cancel, { once: true });
      worker.onerror = (event) => {
        finish();
        reject(new Error(event.message || "Local recognition stopped"));
      };
      worker.onmessage = ({
        data,
      }: MessageEvent<
        { type: string; xml?: string; msg?: string } & Partial<OmrProgress>
      >) => {
        if (data.type === "ready")
          worker.postMessage(
            {
              type: "recognise",
              id: 1,
              image: bytes,
              ...(options.systems ? { systems: options.systems } : {}),
            },
            [bytes],
          );
        if (data.type === "progress" && data.stage) {
          if (data.stage === "download" && data.name) {
            downloads.set(data.name, data.loaded || 0);
            onProgress({
              stage: "download",
              loaded: [...downloads.values()].reduce(
                (sum, value) => sum + value,
                0,
              ),
              total: 157482318,
            });
          } else onProgress(data as OmrProgress);
        }
        if (data.type === "warning" && data.msg) warnings.push(data.msg);
        if (data.type === "error") {
          finish();
          reject(new Error(data.msg || "Recognition failed"));
        }
        if (data.type === "result" && data.xml) {
          finish();
          resolve({ xml: data.xml, warnings });
        }
      };
      const gpu = !mobileReader() && options.gpu === true;
      worker.postMessage({
        type: "init",
        exact: false,
        noGpu: !gpu,
        splitWasm: gpu,
        runtimeUrls: {
          module: new URL(gpu ? moduleUrl : cpuModuleUrl, import.meta.url).href,
          factory: new URL(gpu ? factoryUrl : cpuFactoryUrl, import.meta.url)
            .href,
          wasm: new URL(gpu ? wasmUrl : cpuWasmUrl, import.meta.url).href,
        },
      });
    });
  } finally {
    release();
  }
}
