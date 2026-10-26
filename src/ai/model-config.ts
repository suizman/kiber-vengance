export const CPU_MODEL = "onnx-community/SmolLM2-135M-Instruct-ONNX";
export const CPU_CACHE = "kv-local-ai-onnx-v1";
export type LocalBackend = "auto" | "gpu" | "cpu";
export const compactMelodySchema = {
  type: "array",
  minItems: 5,
  maxItems: 5,
  items: false,
  prefixItems: [
    {
      type: "array",
      items: { type: "integer", minimum: 0, maximum: 14 },
      minItems: 4,
      maxItems: 8,
    },
    { type: "integer", minimum: 0, maximum: 3 },
    { type: "integer", minimum: 0, maximum: 3 },
    { type: "integer", minimum: 0, maximum: 1 },
    { type: "integer", minimum: 0, maximum: 10 },
  ],
};
