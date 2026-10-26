import {
  env,
  pipeline,
  TextStreamer,
  type TextGenerationPipeline,
} from "@huggingface/transformers";
import { StructuredOutputProcessor } from "@huggingface/transformers-structured-output";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import factoryUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import { CPU_MODEL, CPU_CACHE, compactMelodySchema } from "./model-config";
import { expandCompactMelodyPlan } from "./melody";

const scope = globalThis as unknown as {
  postMessage(value: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};
let generator: TextGenerationPipeline | null = null;
env.allowLocalModels = false;
env.cacheKey = CPU_CACHE;
env.useWasmCache = true;
// Standard single-threaded WASM works without COOP/COEP or WebGPU in WebKit/Firefox.
env.backends.onnx.wasm!.numThreads = 1;
env.backends.onnx.wasm!.proxy = false;
env.backends.onnx.wasm!.wasmPaths = {
  wasm: new URL(wasmUrl, import.meta.url).href,
  mjs: new URL(factoryUrl, import.meta.url).href,
};
scope.onmessage = async (event: MessageEvent) => {
  const { kind, prompt, key, scale, bars } = event.data;
  try {
    if (kind === "probe") {
      scope.postMessage({
        kind: "probed",
        supported: typeof WebAssembly !== "undefined",
      });
    } else if (kind === "load") {
      generator = await pipeline("text-generation", CPU_MODEL, {
        device: "wasm",
        dtype: "q8",
        progress_callback: (report) => {
          const fraction =
            "progress" in report ? Number(report.progress) / 100 : 0;
          const file = "file" in report ? report.file : "";
          scope.postMessage({
            kind: "progress",
            progress: fraction,
            text: `CPU / WASM · ${report.status} ${file}`,
          });
        },
      });
      StructuredOutputProcessor.warmup(generator.tokenizer);
      scope.postMessage({ kind: "loaded" });
    } else if (kind === "generate" && generator) {
      const processor = new StructuredOutputProcessor(generator.tokenizer, {
        type: "json_schema",
        json_schema: compactMelodySchema,
      });
      let tokens = 0;
      const output = await generator(
        [
          {
            role: "system",
            content:
              "Return JSON [motif,rhythm,contour,articulation,energy]. motif: 4-8 scale degrees 0-14 (0=tonic,4=fifth,7=octave). rhythm 0=sparse,1=steady,2=driving,3=syncopated. contour 0=repeat,1=rise,2=fall,3=arch. articulation 0=short,1=sustained. energy integer 0-10. Interpret the user's musical idea. /no_think",
          },
          {
            role: "user",
            content: `${prompt}\n${bars} bars, ${key} ${scale}. /no_think`,
          },
        ],
        {
          max_new_tokens: 80,
          do_sample: true,
          temperature: 0.8,
          top_p: 0.85,
          tokenizer_encode_kwargs: { enable_thinking: false },
          logits_processor: processor,
          streamer: new TextStreamer(generator.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: () => {},
            token_callback_function: (generated) => {
              tokens += generated.length;
              scope.postMessage({
                kind: "progress",
                progress: 0,
                text: `CPU / WASM · ${tokens} tokens generated`,
              });
            },
          }),
        },
      );
      const text = output[0]?.generated_text.at(-1)?.content;
      if (typeof text !== "string")
        throw new Error("The CPU model did not return a musical plan.");
      const plan = expandCompactMelodyPlan(text, String(prompt));
      scope.postMessage({ kind: "result", text: JSON.stringify(plan) });
    } else throw new Error("Load the local model first.");
  } catch (error) {
    scope.postMessage({
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
