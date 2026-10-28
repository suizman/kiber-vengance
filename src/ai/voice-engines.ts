export const VOICE_ENGINES = {
  kokoro: {
    model: "onnx-community/Kokoro-82M-v1.0-ONNX",
    revision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231",
    languages: ["en", "es"],
    capabilities: { fragments: true, intensity: false, instructions: false },
  },
  chatterbox: {
    model: "onnx-community/chatterbox-multilingual-ONNX",
    revision: "452d3f434aa592098f1eedac9099f33642ab2da5",
    languages: ["en", "es"],
    capabilities: { fragments: false, intensity: true, instructions: false },
  },
} as const;
export type VoiceEngine = keyof typeof VOICE_ENGINES;
