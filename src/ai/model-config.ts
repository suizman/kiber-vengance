export const CPU_MODEL = "onnx-community/SmolLM2-135M-Instruct-ONNX";
export const CPU_CACHE = "kv-local-ai-onnx-v1";
export type LocalBackend = "auto" | "gpu" | "cpu";
// Exact integer spelling also rules out whitespace/decimal/exponent runs that
// waste the tiny model's output budget. Every accepted tuple is at most 36 bytes.
export const compactMelodyPattern = String.raw`\[\[(?:[0-9]|1[0-4])(?:,(?:[0-9]|1[0-4])){3,7}\],[0-3],[0-3],[01],(?:[0-9]|10)\]`;
