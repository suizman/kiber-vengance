import {
  KEYS,
  SCALES,
  characterDefaults,
  instrumentSettings,
  createClip,
  cryptoId,
} from "../core";
import type {
  Clip,
  ClipCharacter,
  InstrumentState,
  TrackId,
  Project,
  NoteEvent,
} from "../model";
import type { MelodyPlan, MelodyTarget } from "./melody";

export const OFFICIAL_PRESET_URL =
  "https://raw.githubusercontent.com/suizman/kiber-vengance/master/public/presets/catalog-v1.json";
export const STYLES = [
  ["prompt", "From prompt", "Del prompt", ""],
  [
    "synthwave",
    "Synthwave",
    "Synthwave",
    "retro synthwave, melodic hooks, neon atmosphere",
  ],
  [
    "darksynth",
    "Darksynth",
    "Darksynth",
    "dark synthwave, tense aggressive electronic motif",
  ],
  [
    "industrial",
    "Industrial",
    "Industrial",
    "mechanical industrial pulse, repetitive angular motif",
  ],
  [
    "cinematic",
    "Cinematic",
    "Cinemático",
    "cinematic melodic theme, expressive dramatic arc",
  ],
  [
    "electro-rock",
    "Electro-rock",
    "Electro-rock",
    "electronic rock riff with strong accents",
  ],
  [
    "ambient",
    "Ambient",
    "Ambient",
    "spacious ambient melody, gentle restrained movement",
  ],
  [
    "techno",
    "Techno",
    "Techno",
    "hypnotic techno motif, precise rhythmic repetition",
  ],
  [
    "house",
    "House",
    "House",
    "uplifting house motif with rhythmic offbeat movement",
  ],
  [
    "drum-and-bass",
    "Drum & bass",
    "Drum & bass",
    "fast drum and bass melodic motif, energetic syncopation",
  ],
] as const;
export type StyleId = (typeof STYLES)[number][0];
export type RhythmChoice = MelodyPlan["rhythm"] | "auto";
export interface MelodyRecipe {
  kind: "melody";
  id: string;
  name: string;
  tags: string[];
  style: StyleId;
  rhythm: RhythmChoice;
  tempo: number;
  bars: number;
  key: string;
  scale: string;
  prompt: string;
}
export interface SoundPreset {
  kind: "sound";
  id: string;
  name: string;
  tags: string[];
  track: TrackId;
  instrument: InstrumentState;
  character: ClipCharacter;
}
export type CatalogPreset = MelodyRecipe | SoundPreset;
export interface MelodyApplyOptions {
  sound?: SoundPreset | undefined;
  tempo?: number | undefined;
}
export function buildPresetClip(
  project: Project,
  target: MelodyTarget,
  name: string,
  bars: number,
  notes: NoteEvent[],
  options: MelodyApplyOptions = {},
): Clip {
  const source = project.clips.find(
    (clip) => clip.id === target.clipId && clip.track === target.track,
  );
  if (
    project.id !== target.projectId ||
    !source ||
    source.stepsPerBar !== target.stepsPerBar
  )
    throw new Error("The project changed. Open the generator again.");
  if (options.tempo !== undefined) number(options.tempo, 50, 220);
  if (![1, 2, 4, 8].includes(bars)) throw new Error("Invalid clip bars.");
  const sound = options.sound ? validateSoundPreset(options.sound) : null;
  if (sound && sound.track !== target.track)
    throw new Error("Choose a sound preset for the selected track.");
  const clip = createClip(target.track, name, bars, target.stepsPerBar);
  clip.instrument = structuredClone(sound?.instrument ?? source.instrument);
  clip.character = structuredClone(sound?.character ?? source.character);
  clip.notes = structuredClone(notes);
  return clip;
}
export function commitPresetClip(
  project: Project,
  clip: Clip,
  tempo?: number,
): void {
  if (tempo !== undefined) {
    number(tempo, 50, 220);
    project.tempo = tempo;
    const base = project.tempoMap.find((event) => event.step === 0);
    if (base) base.bpm = tempo;
    else
      project.tempoMap.unshift({
        id: cryptoId(),
        step: 0,
        bpm: tempo,
        curve: "jump",
      });
  }
  project.clips.push(clip);
  project.activeClipIds[clip.track] = clip.id;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a preset object.");
  return value as Record<string, unknown>;
};
const text = (value: unknown, max = 80): string => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Invalid preset text.");
  return value.trim();
};
function number(value: unknown, min: number, max: number) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error("Preset parameter outside its supported range.");
  return value;
}
export function validateSoundPreset(value: unknown): SoundPreset {
  const data = object(value),
    track = data.track as TrackId;
  if (!["lead", "guitar", "bass", "pad", "drums"].includes(track))
    throw new Error("Invalid preset track.");
  const name = text(data.name),
    raw = object(data.instrument);
  const instrument = instrumentSettings(track);
  const ranges: Record<string, [number, number]> = {
    osc2Mix: [0, 1],
    cutoff: [20, 22000],
    resonance: [0, 40],
    attack: [0, 10],
    decay: [0, 10],
    sustain: [0, 1],
    release: [0, 20],
    glide: [0, 2],
    unison: [1, 8],
    detune: [0, 100],
  };
  for (const [key, [min, max]] of Object.entries(ranges))
    if (raw[key] !== undefined)
      (instrument as Record<string, unknown>)[key] = number(raw[key], min, max);
  if (instrument.unison !== undefined && !Number.isInteger(instrument.unison))
    throw new Error("Invalid unison voices.");
  for (const field of ["wave", "osc2Wave"] as const)
    if (raw[field] !== undefined) {
      if (
        ![
          "sine",
          "square",
          "sawtooth",
          "triangle",
          "pulse",
          "metal",
          ...(field === "osc2Wave" ? ["off"] : []),
        ].includes(String(raw[field]))
      )
        throw new Error("Unsupported oscillator waveform.");
      if (field === "wave")
        instrument.wave = raw[field] as NonNullable<InstrumentState["wave"]>;
      else
        instrument.osc2Wave = raw[field] as NonNullable<
          InstrumentState["osc2Wave"]
        >;
    }
  if (raw.filterType !== undefined) {
    if (!["lowpass", "highpass", "bandpass"].includes(String(raw.filterType)))
      throw new Error("Unsupported filter type.");
    instrument.filterType = raw.filterType as NonNullable<
      InstrumentState["filterType"]
    >;
  }
  if (raw.preset !== undefined) instrument.preset = text(raw.preset);
  const character = characterDefaults(track);
  if (data.character !== undefined) {
    const source = object(data.character);
    for (const key of Object.keys(character.macros))
      if (object(source.macros ?? {})[key] !== undefined)
        character.macros[key] = number(object(source.macros)[key], 0, 1);
    const fx = object(source.fx ?? {});
    for (const key of [
      "distortion",
      "saturation",
      "chorus",
      "delay",
      "reverb",
      "tone",
    ])
      if (fx[key] !== undefined) character.fx[key] = number(fx[key], 0, 1);
    if (fx.bypass !== undefined) {
      if (typeof fx.bypass !== "boolean") throw new Error("Invalid FX bypass.");
      character.fx.bypass = fx.bypass;
    }
    const arp = object(source.arp ?? {}),
      lfo = object(source.lfo ?? {});
    for (const [rawPart, destination] of [
      [arp, character.arp],
      [lfo, character.lfo],
    ] as const)
      if (rawPart.enabled !== undefined) {
        if (typeof rawPart.enabled !== "boolean")
          throw new Error("Invalid modulation state.");
        destination.enabled = rawPart.enabled;
      }
    if (arp.mode !== undefined) {
      if (!["up", "down", "updown", "random"].includes(String(arp.mode)))
        throw new Error("Invalid arpeggiator mode.");
      character.arp.mode = arp.mode as typeof character.arp.mode;
    }
    if (arp.octaves !== undefined) {
      character.arp.octaves = number(arp.octaves, 1, 3);
      if (!Number.isInteger(character.arp.octaves))
        throw new Error("Invalid arpeggiator octaves.");
    }
    if (arp.rate !== undefined) {
      if (![1, 2, 4].includes(Number(arp.rate)))
        throw new Error("Invalid arpeggiator rate.");
      character.arp.rate = number(arp.rate, 1, 4);
    }
    if (lfo.target !== undefined) {
      if (!["cutoff", "pitch", "pan"].includes(String(lfo.target)))
        throw new Error("Invalid LFO target.");
      character.lfo.target = lfo.target as typeof character.lfo.target;
    }
    if (lfo.rate !== undefined) character.lfo.rate = number(lfo.rate, 0.05, 12);
    if (lfo.depth !== undefined) character.lfo.depth = number(lfo.depth, 0, 1);
  }
  return {
    kind: "sound",
    id: text(data.id ?? `import:${track}:${name}`, 120),
    name,
    track,
    tags: tags(data.tags),
    instrument,
    character,
  };
}
function tags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 16)
    throw new Error("Invalid preset tags.");
  return value.map((tag) => text(tag, 40));
}
export function parsePresetCatalog(input: unknown): CatalogPreset[] {
  const bank = object(input);
  if (
    !["kiber-vengance-catalog", "kiber-vengance-preset-bank"].includes(
      String(bank.format),
    ) ||
    bank.version !== 1 ||
    !Array.isArray(bank.presets) ||
    bank.presets.length > 256
  )
    throw new Error(
      "Use a compatible КИБЕР VENGANCE JSON catalog or preset bank.",
    );
  const ids = new Set<string>();
  return bank.presets.map((value) => {
    const data = object(value);
    let preset: CatalogPreset;
    if (data.kind === "melody") {
      if (
        !STYLES.some((style) => style[0] === data.style) ||
        !["auto", "sparse", "steady", "driving", "syncopated"].includes(
          String(data.rhythm),
        ) ||
        ![1, 2, 4, 8].includes(Number(data.bars)) ||
        !KEYS.includes(data.key as (typeof KEYS)[number]) ||
        !Object.hasOwn(SCALES, String(data.scale))
      )
        throw new Error("Invalid melody preset settings.");
      preset = {
        kind: "melody",
        id: text(data.id, 120),
        name: text(data.name),
        tags: tags(data.tags),
        style: data.style as StyleId,
        rhythm: data.rhythm as RhythmChoice,
        tempo: number(data.tempo, 50, 220),
        bars: number(data.bars, 1, 8),
        key: String(data.key),
        scale: String(data.scale),
        prompt: text(data.prompt, 600),
      };
    } else if (
      data.kind === "sound" ||
      (bank.format === "kiber-vengance-preset-bank" && data.kind === undefined)
    )
      preset = validateSoundPreset(data);
    else throw new Error("Unsupported preset type.");
    if (ids.has(preset.id)) throw new Error("Duplicate preset identifier.");
    ids.add(preset.id);
    return preset;
  });
}
export function enrichMelodyPrompt(
  prompt: string,
  style: StyleId,
  rhythm: RhythmChoice,
  tempo: number,
): string {
  const description = STYLES.find((item) => item[0] === style)?.[3] || "";
  return `${prompt.trim()}${description ? `\nStyle: ${description}.` : ""}\nTempo: ${tempo} BPM.${rhythm !== "auto" ? ` Rhythm: ${rhythm}.` : ""}`;
}
export function enforceMelodyChoices(
  plan: MelodyPlan,
  rhythm: RhythmChoice,
): MelodyPlan {
  return { ...plan, ...(rhythm !== "auto" ? { rhythm } : {}) };
}
export async function fetchPresetCatalog(
  url: string,
  signal?: AbortSignal,
): Promise<{ presets: CatalogPreset[]; official: boolean }> {
  const location = new URL(url);
  if (location.protocol !== "https:")
    throw new Error("Use an HTTPS link to a JSON catalog.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(location.href, {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        `Catalog HTTP ${response.status}. Use included presets or a compatible JSON file.`,
      );
    if (new URL(response.url).protocol !== "https:")
      throw new Error("Catalog redirected to an unsupported source.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty catalog response.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1024 * 1024) {
        await reader.cancel();
        throw new Error("Catalog exceeds 1 MB.");
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return {
      presets: parsePresetCatalog(JSON.parse(new TextDecoder().decode(bytes))),
      official:
        location.href === OFFICIAL_PRESET_URL &&
        response.url === OFFICIAL_PRESET_URL,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
