import {
  env,
  AutoTokenizer,
  StyleTextToSpeech2Model,
  Tensor,
} from "@huggingface/transformers";
import initializeEspeak from "@echogarden/espeak-ng-emscripten";
import phonemeDataUrl from "@echogarden/espeak-ng-emscripten/espeak-ng.data?url";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import factoryUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const scope = globalThis as unknown as {
  postMessage(value: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};
env.allowLocalModels = false;
env.cacheKey = "kv-local-voice-model-v1";
env.useWasmCache = true;
env.backends.onnx.wasm!.numThreads = 1;
env.backends.onnx.wasm!.proxy = false;
env.backends.onnx.wasm!.wasmPaths = {
  wasm: new URL(wasmUrl, import.meta.url).href,
  mjs: new URL(factoryUrl, import.meta.url).href,
};
let model: StyleTextToSpeech2Model | null = null;
let tokenizer: Awaited<
  ReturnType<typeof AutoTokenizer.from_pretrained>
> | null = null;
let phonemizer: {
  set_voice(name: string, language: string): number;
  synthesize_ipa(text: string): { code: number; ipa: string };
} | null = null;
async function loadPhonemizer() {
  const url = new URL(phonemeDataUrl, import.meta.url).href;
  const cache = await caches.open("kv-local-voice-phonemes-v1");
  let response = await cache.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw new Error(`Phoneme data HTTP ${response.status}`);
    await cache.put(url, response.clone());
  }
  const data = await response.arrayBuffer();
  const runtime = await initializeEspeak({ getPreloadedPackage: () => data });
  phonemizer = new runtime.eSpeakNGWorker();
}
const voices = new Set(["af_heart", "am_michael", "ef_dora", "em_alex"]);
async function voiceData(id: string) {
  const url = `https://huggingface.co/${MODEL}/resolve/main/voices/${id}.bin`;
  const cache = await caches.open("kv-local-voice-vectors-v1");
  let response = await cache.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok)
      throw new Error(`Voice download: HTTP ${response.status}`);
    await cache.put(url, response.clone());
  }
  return new Float32Array(await response.arrayBuffer());
}
scope.onmessage = async ({ data }) => {
  try {
    if (data.kind === "load") {
      model = await StyleTextToSpeech2Model.from_pretrained(MODEL, {
        device: "wasm",
        dtype: data.dtype === "fp32" ? "fp32" : "q8",
        progress_callback: (report) =>
          scope.postMessage({
            kind: "progress",
            text: `${report.status} ${"file" in report ? report.file : ""}`,
          }),
      });
      tokenizer = await AutoTokenizer.from_pretrained(MODEL);
      await loadPhonemizer();
      // Download selected voice explicitly as part of Load, so cached use is predictable.
      await voiceData(data.voice);
      scope.postMessage({ kind: "loaded" });
    } else if (data.kind === "generate") {
      if (!model || !tokenizer) throw new Error("Load the voice model first");
      const { text, language, voice, speed } = data;
      if (!voices.has(voice) || (language === "es") !== voice.startsWith("e"))
        throw new Error("Voice/language mismatch");
      if (
        typeof text !== "string" ||
        !text.trim() ||
        text.length > 500 ||
        !Number.isFinite(speed) ||
        speed < 0.6 ||
        speed > 1.5
      )
        throw new Error("Invalid speech parameters");
      if (
        !phonemizer ||
        phonemizer.set_voice("", language === "es" ? "es" : "en-us") !== 0
      )
        throw new Error("Phoneme language unavailable");
      const trace = phonemizer.synthesize_ipa(text.normalize("NFC"));
      if (trace.code !== 0) throw new Error("Phonemization failed");
      let phones = trace.ipa
        .replace(/[_\n\r]+/g, " ")
        .replace(/ʲ/g, "j")
        .trim();
      // English-specific IPA adaptations must never rewrite Spanish /r/ or /x/.
      if (language === "en")
        phones = phones
          .replace(/r/g, "ɹ")
          .replace(/x/g, "k")
          .replace(/ɬ/g, "l");
      const { input_ids } = tokenizer(phones, { truncation: false });
      const count = input_ids.dims.at(-1)! - 2;
      if (count < 1 || count > 500)
        throw new Error("Phrase too long: split it into shorter sentences");
      const vectors = await voiceData(voice),
        style = vectors.slice(count * 256, (count + 1) * 256);
      if (style.length !== 256) throw new Error("Invalid voice vector");
      const result = await model({
        input_ids,
        style: new Tensor("float32", style, [1, 256]),
        speed: new Tensor("float32", [speed], [1]),
      });
      const pcm = new Float32Array(result.waveform.data as Float32Array);
      if (!pcm.length || !pcm.every(Number.isFinite))
        throw new Error("Invalid generated audio");
      scope.postMessage({
        kind: "audio",
        pcm,
        sampleRate: 24000,
        phonemes: phones,
      });
    }
  } catch (error) {
    scope.postMessage({ kind: "error", message: String(error) });
  }
};
