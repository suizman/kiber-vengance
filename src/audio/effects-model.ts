import type { AudioEffects } from "../model";
export const EFFECT_DEFAULTS: AudioEffects = {
  bypass: false,
  filter: 1,
  tone: 0,
  compression: 0,
  saturation: 0,
  distortion: 0,
  chorus: 0,
  delay: 0,
  reverb: 0,
};
export function normalizeEffects(
  value: Partial<AudioEffects> | null = {},
): AudioEffects {
  const result = { ...EFFECT_DEFAULTS };
  for (const key of Object.keys(result) as (keyof AudioEffects)[]) {
    if (key === "bypass") result.bypass = value?.bypass === true;
    else {
      const v = value?.[key];
      result[key] =
        typeof v === "number" && Number.isFinite(v)
          ? Math.max(key === "tone" ? -1 : 0, Math.min(1, v))
          : EFFECT_DEFAULTS[key];
    }
  }
  return result;
}
export const AUDIO_FX_PRESETS: Record<
  string,
  { en: string; es: string; settings: AudioEffects }
> = {
  clean: { en: "Clean", es: "Limpio", settings: { ...EFFECT_DEFAULTS } },
  presence: {
    en: "Voice presence",
    es: "Voz presente",
    settings: { ...EFFECT_DEFAULTS, tone: 0.15, compression: 0.45 },
  },
  radio: {
    en: "Radio",
    es: "Radio",
    settings: {
      ...EFFECT_DEFAULTS,
      filter: 0.42,
      tone: -0.35,
      compression: 0.5,
      saturation: 0.18,
    },
  },
  megaphone: {
    en: "Megaphone",
    es: "Megáfono",
    settings: { ...EFFECT_DEFAULTS, filter: 0.32, tone: 0.7, distortion: 0.55 },
  },
  cyberpunk: {
    en: "Cyberpunk",
    es: "Cyberpunk",
    settings: {
      ...EFFECT_DEFAULTS,
      saturation: 0.4,
      distortion: 0.2,
      chorus: 0.32,
      delay: 0.23,
    },
  },
  ambience: {
    en: "Ambience",
    es: "Ambiente",
    settings: { ...EFFECT_DEFAULTS, chorus: 0.12, delay: 0.2, reverb: 0.5 },
  },
};
