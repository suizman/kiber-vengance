// Independent implementation of the MIT ONNX model card's public tensor protocol.
import * as ort from "onnxruntime-web/webgpu";
import { PreTrainedTokenizer } from "@huggingface/transformers";
import factoryUrl from "onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url";
import gpuFactoryUrl from "onnxruntime-web/ort-wasm-simd-threaded.jspi.mjs?url";
import gpuFallbackUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
const scope = globalThis as unknown as {
  postMessage(value: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};
const MODEL = "onnx-community/chatterbox-multilingual-ONNX",
  REV = "452d3f434aa592098f1eedac9099f33642ab2da5";
const DECODER = "danyalmalik/Chatterbox-ONNX-WebGPU",
  DEC_REV = "54eb255c95ea64ea502f5efddb8a9869de30687f";
const VOICE = "danyalmalik/Chatterbox-Multilingual-ONNX-WebGPU",
  VOICE_REV = "b37cca40a5510b9525ca429a6f0af90f9557655e";
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = {
  wasm: "",
  mjs: new URL(factoryUrl, import.meta.url).href,
};

let embed: ort.InferenceSession,
  lm: ort.InferenceSession,
  decoder: ort.InferenceSession,
  tokenizer: PreTrainedTokenizer,
  voice: Float32Array;
async function file(model: string, revision: string, path: string) {
  const url = `https://huggingface.co/${model}/resolve/${revision}/${path}`,
    cache = await caches.open("kv-expressive-model-v1");
  let response = await cache.match(url);
  if (!response) {
    scope.postMessage({ kind: "progress", text: `Downloading ${path}` });
    response = await fetch(url);
    if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
    try {
      await cache.put(url, response.clone());
    } catch {
      scope.postMessage({
        kind: "progress",
        text: "Model cache unavailable; continuing online",
      });
    }
  }
  return new Uint8Array(await response.arrayBuffer());
}
const i64 = (data: number[] | bigint[], dims: number[]) =>
  new ort.Tensor("int64", BigInt64Array.from(data.map(BigInt)), dims);
async function session(
  model: string,
  rev: string,
  path: string,
  device: string,
  external?: string,
) {
  const graph = await file(model, rev, path),
    data = external ? await file(model, rev, external) : null;
  const options: ort.InferenceSession.SessionOptions = {
    executionProviders: [device],
    graphOptimizationLevel: "all",
  };
  if (data)
    options.externalData = [{ path: external!.split("/").at(-1)!, data }];
  return ort.InferenceSession.create(graph, options);
}
scope.onmessage = async ({ data }) => {
  try {
    if (data.kind === "load") {
      const device = data.device === "webgpu" ? "webgpu" : "wasm";
      const jspi=typeof (WebAssembly as typeof WebAssembly & {Suspending?:unknown}).Suspending === 'function';
      const variant=device==='wasm'?'jsep':jspi?'jspi':'asyncify';
      const runtime = `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.${variant}.wasm`;
      const cache = await caches.open("kv-expressive-model-v1");
      let response = await cache.match(runtime);
      if (!response) {
        response = await fetch(runtime);
        if (!response.ok) throw Error(`Runtime HTTP ${response.status}`);
        try {
          await cache.put(runtime, response.clone());
        } catch {
          scope.postMessage({
            kind: "progress",
            text: "Runtime cache unavailable; continuing online",
          });
        }
      }
      ort.env.wasm.wasmPaths = {
        wasm: URL.createObjectURL(
          new Blob([await response.arrayBuffer()], {
            type: "application/wasm",
          }),
        ),
        mjs: new URL(device==='wasm'?factoryUrl:jspi?gpuFactoryUrl:gpuFallbackUrl, import.meta.url).href,
      };
      embed = await session(
        MODEL,
        REV,
        "onnx/embed_tokens.onnx",
        device,
        "onnx/embed_tokens.onnx_data",
      );
      lm = await session(
        MODEL,
        REV,
        "onnx/language_model_q4.onnx",
        device,
        "onnx/language_model_q4.onnx_data",
      );
      decoder = await session(
        DECODER,
        DEC_REV,
        "onnx/conditional_decoder.onnx",
        device,
      );
      voice = new Float32Array(
        (await file(VOICE, VOICE_REV, "voices/default.bin")).buffer,
      );
      tokenizer = new PreTrainedTokenizer(
        JSON.parse(
          new TextDecoder().decode(await file(MODEL, REV, "tokenizer.json")),
        ),
        JSON.parse(
          new TextDecoder().decode(
            await file(MODEL, REV, "tokenizer_config.json"),
          ),
        ),
      );
      scope.postMessage({ kind: "loaded" });
    } else if (data.kind === "generate") {
      if (!lm || !tokenizer) throw Error("Load expressive model first");
      if (
        !["es", "en"].includes(data.language) ||
        typeof data.text !== "string" ||
        !data.text.trim() ||
        data.text.length > 500
      )
        throw Error("Invalid speech input");
      const intensity = Number.isFinite(data.intensity)
        ? Math.max(0.1, Math.min(1, data.intensity))
        : 0.5;
      const chunks = data.text.normalize("NFC").match(/[^.!?\n]+[.!?]?/g) || [];
      const pieces: Float32Array[] = [];
      for (let phrase = 0; phrase < chunks.length; phrase++) {
        const text = chunks[phrase]!.trim();
        if (!text) continue;
        const encoded = tokenizer(`[${data.language}]${text}`, {
          add_special_tokens: false,
        });
        const textIds = Array.from(encoded.input_ids.data as BigInt64Array);
        let ids = i64(
          [6563n, 255n, ...textIds, 0n, 6561n, 6561n],
          [1, textIds.length + 5],
        );
        let pos = i64(
          Array.from(ids.data as BigInt64Array, (n, i) =>
            n >= 6561n ? 0 : i - 1,
          ),
          [1, ids.dims[1]!],
        );
        const n = voice[0]!,
          p = voice[1]!,
          f = voice[2]!;
        let at = 3;
        const condition = new ort.Tensor(
          "float32",
          voice.slice(at, (at += n * 1024)),
          [1, n, 1024],
        );
        const prompt = Array.from(voice.slice(at, (at += p)));
        const speaker = new ort.Tensor(
          "float32",
          voice.slice(at, (at += 192)),
          [1, 192],
        );
        const features = new ort.Tensor(
          "float32",
          voice.slice(at, at + f * 80),
          [1, f, 80],
        );
        let past: Record<string, ort.Tensor> = {};
        for (let layer = 0; layer < 30; layer++)
          for (const kv of ["key", "value"])
            past[`past_key_values.${layer}.${kv}`] = new ort.Tensor(
              "float32",
              new Float32Array(),
              [1, 16, 0, 64],
            );
        const generated: number[] = [];
        let length = 0,
          ended = false;
        for (let step = 0; step < 256; step++) {
          const embeds = await embed.run({
            input_ids: ids,
            position_ids: pos,
            exaggeration: new ort.Tensor(
              "float32",
              new Float32Array([intensity]),
              [1],
            ),
          });
          let embeddings = embeds[embed.outputNames[0]!]!;
          if (step === 0) {
            const combined = new Float32Array(
              condition.data.length + embeddings.data.length,
            );
            combined.set(condition.data as Float32Array);
            combined.set(
              embeddings.data as Float32Array,
              condition.data.length,
            );
            embeddings = new ort.Tensor("float32", combined, [
              1,
              n + embeddings.dims[1]!,
              1024,
            ]);
            length = embeddings.dims[1]!;
          } else length++;
          const result = await lm.run({
            inputs_embeds: embeddings,
            attention_mask: i64(Array(length).fill(1), [1, length]),
            ...past,
          });
          const logits = result[lm.outputNames[0]!]!,
            scores = logits.data as Float32Array,
            vocab = logits.dims.at(-1)!,
            offset = scores.length - vocab,
            seen = new Set(generated);
          let token = 0,
            best = -Infinity;
          for (let j = 0; j < vocab; j++) {
            let value = scores[offset + j]!;
            if (seen.has(j)) value = value < 0 ? value * 1.2 : value / 1.2;
            if (value > best) {
              best = value;
              token = j;
            }
          }
          for (const tensor of Object.values(past)) tensor.dispose();
          past = {};
          for (let layer = 0; layer < 30; layer++)
            for (const kv of ["key", "value"]) {
              const name = `present.${layer}.${kv}`,
                index = 1 + layer * 2 + (kv === "value" ? 1 : 0);
              past[`past_key_values.${layer}.${kv}`] =
                result[name] ?? result[lm.outputNames[index]!]!;
            }
          logits.dispose();
          for (const tensor of Object.values(embeds)) tensor.dispose();
          if (step === 0) embeddings.dispose();
          ids.dispose();
          pos.dispose();
          if (token === 6562) {
            ended = true;
            break;
          }
          generated.push(token);
          ids = i64([token], [1, 1]);
          pos = i64([step + 1], [1, 1]);
          if (step % 8 === 0)
            scope.postMessage({
              kind: "progress",
              text: `Speech ${phrase + 1}/${chunks.length} · ${step + 1} tokens`,
            });
        }
        for (const tensor of Object.values(past)) tensor.dispose();
        if (!ended)
          throw Error(
            "Phrase exceeds expressive generation limit. Split it into shorter phrases.",
          );
        if (!generated.length) throw Error("No speech tokens generated");
        const decoded = await decoder.run({
          speech_tokens: i64(
            [...prompt, ...generated],
            [1, prompt.length + generated.length],
          ),
          speaker_embeddings: speaker,
          speaker_features: features,
        });
        const pcm = new Float32Array(
          decoded[decoder.outputNames[0]!]!.data as Float32Array,
        );
        if (!pcm.length || !pcm.every(Number.isFinite))
          throw Error("Invalid expressive waveform");
        pieces.push(pcm, new Float32Array(4800));
        for (const tensor of Object.values(decoded)) tensor.dispose();
        condition.dispose();
        speaker.dispose();
        features.dispose();
      }
      const pcm = new Float32Array(
        pieces.reduce((sum, piece) => sum + piece.length, 0),
      );
      let at = 0;
      for (const piece of pieces) {
        pcm.set(piece, at);
        at += piece.length;
      }
      scope.postMessage({
        kind: "audio",
        pcm,
        sampleRate: 24000,
        phonemes: "",
        revision: REV,
      });
    }
  } catch (error) {
    scope.postMessage({ kind: "error", message: String(error) });
  }
};
