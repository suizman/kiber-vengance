import type { InstrumentState, Project } from "../model";

interface BankEntry {
  number: number;
  name: string;
  path: string;
  sha256: string;
  sampleBytes: number;
}
interface BankManifest {
  programs: BankEntry[];
  drums: BankEntry[];
}
interface Sample {
  path: string;
  sha256: string;
  bytes: number;
}
interface Zone {
  originalPitch: number;
  coarseTune: number;
  fineTune: number;
  keyRangeLow: number;
  keyRangeHigh: number;
  sampleRate: number;
  loopStart: number;
  loopEnd: number;
  delay?: number;
  ahdsr?: boolean | Array<{ duration: number; volume: number }>;
  sample: Sample;
}
interface Program {
  zones: Zone[];
  name: string;
}
interface CachedBuffer {
  buffer: AudioBuffer;
  bytes: number;
  pins: number;
  used: number;
}
export interface SampleVoice {
  ended: Promise<void>;
  stop(time?: number, immediate?: boolean): void;
  bend(semitones: number, time: number): void;
}
const BASE = "./soundfonts/fluidr3-gm-1/";
const MANIFEST_SHA =
  "c4f3d9c2c4fb642de4edd16aa8274a9dd5457357ea62c4e5e2a2d607a288728f";
const CACHE = "kv-instruments-fluidr3-gm-1";
const buffers = new Map<string, CachedBuffer>();
const programs = new Map<string, Program>();
const pendingBuffers = new Map<string, Promise<AudioBuffer>>();
const pendingPrograms = new Map<string, Promise<Program>>();
let manifest: Promise<BankManifest> | undefined;
let decodingContext: OfflineAudioContext | undefined;

function budget() {
  const mobile =
    /Android|iPhone|iPad/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return (mobile ? 64 : 192) * 1024 * 1024;
}
function evict() {
  let bytes = [...buffers.values()].reduce((sum, item) => sum + item.bytes, 0);
  for (const [key, item] of [...buffers].sort(
    (a, b) => a[1].used - b[1].used,
  )) {
    if (bytes <= budget()) break;
    if (!item.pins) {
      buffers.delete(key);
      bytes -= item.bytes;
    }
  }
}
async function checked(
  path: string,
  hash: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  signal?.throwIfAborted();
  const url = new URL(BASE + path, document.baseURI).href;
  let cache: Cache | undefined;
  try {
    cache = await caches.open(CACHE);
  } catch {
    /* Persistent cache is optional in private browsing. */
  }
  let response = await cache?.match(url);
  if (!response) {
    response = await fetch(url, signal ? { signal } : {});
    if (!response.ok)
      throw new Error(`Instrument download failed (${response.status})`);
  }
  const bytes = await response.arrayBuffer();
  const actual = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  if (actual !== hash) {
    await cache?.delete(url);
    throw new Error("Instrument data checksum mismatch. Retry the download.");
  }
  try {
    await cache?.put(url, new Response(bytes));
  } catch {
    /* Playback remains available without persistent caching. */
  }
  return bytes;
}
export function gmManifest(): Promise<BankManifest> {
  return (manifest ||= checked("manifest.json", MANIFEST_SHA)
    .then(
      (bytes) => JSON.parse(new TextDecoder().decode(bytes)) as BankManifest,
    )
    .catch((error) => {
      manifest = undefined;
      throw error;
    }));
}
const keyFor = (instrument: InstrumentState, pitch: number) =>
  instrument.percussion
    ? `drum:${Math.max(35, Math.min(81, Math.round(pitch)))}`
    : `program:${instrument.program || 0}`;
async function program(
  instrument: InstrumentState,
  pitch: number,
  signal?: AbortSignal,
): Promise<Program> {
  const key = keyFor(instrument, pitch);
  if (programs.has(key)) return programs.get(key)!;
  if (pendingPrograms.has(key)) return pendingPrograms.get(key)!;
  const request = (async () => {
    const bank = await gmManifest();
    const entry = (instrument.percussion ? bank.drums : bank.programs).find(
      (item) => item.number === Number(key.split(":")[1]),
    );
    if (!entry) throw new Error("Unknown General MIDI instrument");
    const data = JSON.parse(
      new TextDecoder().decode(await checked(entry.path, entry.sha256, signal)),
    ) as Program;
    if (!Array.isArray(data.zones) || !data.zones.length)
      throw new Error("Instrument has no sample zones");
    programs.set(key, data);
    return data;
  })();
  pendingPrograms.set(key, request);
  try {
    return await request;
  } finally {
    pendingPrograms.delete(key);
  }
}
function zoneFor(data: Program, pitch: number): Zone {
  return (
    data.zones.findLast(
      (zone) => pitch >= zone.keyRangeLow && pitch <= zone.keyRangeHigh,
    ) ||
    data.zones.reduce((nearest, zone) => {
      const distance = (value: Zone) =>
        Math.min(
          Math.abs(pitch - value.keyRangeLow),
          Math.abs(pitch - value.keyRangeHigh),
        );
      return distance(zone) < distance(nearest) ? zone : nearest;
    })
  );
}
async function bufferFor(
  zone: Zone,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  const hash = zone.sample.sha256;
  const existing = buffers.get(hash);
  if (existing) {
    existing.used = performance.now();
    return existing.buffer;
  }
  if (pendingBuffers.has(hash)) return pendingBuffers.get(hash)!;
  const request = (async () => {
    const bytes = await checked(zone.sample.path, hash, signal);
    signal?.throwIfAborted();
    decodingContext ||= new OfflineAudioContext(1, 1, 44100);
    const buffer = await decodingContext.decodeAudioData(bytes);
    evict();
    if (
      [...buffers.values()]
        .filter((item) => item.pins)
        .reduce((sum, item) => sum + item.bytes, 0) +
        buffer.length * buffer.numberOfChannels * 4 >
      budget()
    )
      throw new Error(
        "The acoustic instruments exceed this device's memory budget. Assign some parts to a studio synthesizer and retry; all notes are retained.",
      );
    buffers.set(hash, {
      buffer,
      bytes: buffer.length * buffer.numberOfChannels * 4,
      pins: 0,
      used: performance.now(),
    });
    return buffer;
  })();
  pendingBuffers.set(hash, request);
  try {
    return await request;
  } finally {
    pendingBuffers.delete(hash);
  }
}
export async function prepareGmNotes(
  instrument: InstrumentState,
  pitches: number[],
  signal?: AbortSignal,
): Promise<void> {
  if (instrument.kind !== "gm") return;
  const loaded = new Set<string>();
  for (const pitch of new Set(pitches.map(Math.round))) {
    signal?.throwIfAborted();
    const zone = zoneFor(await program(instrument, pitch, signal), pitch);
    if (!loaded.has(zone.sample.sha256)) {
      await bufferFor(zone, signal);
      loaded.add(zone.sample.sha256);
    }
  }
}
export async function prepareGmProject(
  project: Project,
  song: boolean,
  signal?: AbortSignal,
): Promise<() => void> {
  const clips = song
    ? project.clips.filter((clip) =>
        project.arrangement.some(
          (scene) => scene.clipIds[clip.track] === clip.id,
        ),
      )
    : project.clips.filter(
        (clip) => project.activeClipIds[clip.track] === clip.id,
      );
  const pinned = new Set<CachedBuffer>();
  const release = () => {
    for (const item of pinned) item.pins = Math.max(0, item.pins - 1);
    pinned.clear();
    evict();
  };
  try {
    for (const clip of clips)
      if (clip.instrument.kind === "gm")
        for (const pitch of new Set(
          clip.notes.map((note) => note.pitch + (note.expression?.bend || 0)),
        )) {
          const zone = zoneFor(
            await program(clip.instrument, pitch, signal),
            pitch,
          );
          await bufferFor(zone, signal);
          const item = buffers.get(zone.sample.sha256)!;
          if (!pinned.has(item)) {
            item.pins++;
            pinned.add(item);
          }
        }
    return release;
  } catch (error) {
    release();
    throw error;
  }
}

/** Same sample, tuning, envelope and loop behavior in live and offline contexts. */
export function playGmNote(
  context: BaseAudioContext,
  destination: AudioNode,
  instrument: InstrumentState,
  pitch: number,
  when: number,
  duration: number,
  velocity: number,
  pan = 0,
): SampleVoice {
  const data = programs.get(keyFor(instrument, pitch));
  if (!data) throw new Error("Prepare this instrument before playing");
  const zone = zoneFor(data, pitch),
    cached = buffers.get(zone.sample.sha256);
  if (!cached)
    throw new Error(
      "Instrument sample is unavailable. Prepare the instrument again.",
    );
  cached.pins++;
  cached.used = performance.now();
  const source = context.createBufferSource(),
    gain = context.createGain(),
    stereo = context.createStereoPanner();
  const rate =
    2 **
    ((100 * pitch -
      zone.originalPitch +
      100 * (zone.coarseTune || 0) +
      (zone.fineTune || 0)) /
      1200);
  source.buffer = cached.buffer;
  source.playbackRate.setValueAtTime(rate, when);
  source.loop =
    !instrument.percussion &&
    zone.loopStart > 0 &&
    zone.loopEnd > zone.loopStart &&
    zone.loopEnd / zone.sampleRate <= cached.buffer.duration + 0.01;
  if (source.loop) {
    source.loopStart = zone.loopStart / zone.sampleRate;
    source.loopEnd = zone.loopEnd / zone.sampleRate;
  }
  const held = !Number.isFinite(duration),
    release = instrument.percussion ? 0.015 : 0.12;
  const noteDuration = instrument.percussion
    ? cached.buffer.duration / rate
    : held
      ? 86400
      : Math.max(0.01, duration);
  const end = source.loop
    ? noteDuration
    : Math.min(noteDuration, cached.buffer.duration / rate);
  const peak = Math.max(0.00001, Math.min(1, velocity) * 0.28);
  const envelope = Array.isArray(zone.ahdsr)
    ? zone.ahdsr
    : zone.ahdsr
      ? [
          { duration: 0, volume: 1 },
          { duration: 0.5, volume: 1 },
          { duration: 1.5, volume: 0.5 },
          { duration: 3, volume: 0 },
        ]
      : [{ duration: 0, volume: 1 }];
  gain.gain.setValueAtTime(
    Math.max(0.00001, peak * (envelope[0]?.volume ?? 1)),
    when,
  );
  let elapsed = 0,
    lastVolume = envelope[0]?.volume ?? 1;
  for (const point of envelope.slice(1)) {
    const span = Math.max(0, point.duration),
      finish = elapsed + span;
    if (finish > end) {
      const fraction = span ? (end - elapsed) / span : 1;
      gain.gain.linearRampToValueAtTime(
        Math.max(
          0.00001,
          peak * (lastVolume + (point.volume - lastVolume) * fraction),
        ),
        when + end,
      );
      break;
    }
    gain.gain.linearRampToValueAtTime(
      Math.max(0.00001, peak * point.volume),
      when + finish,
    );
    elapsed = finish;
    lastVolume = point.volume;
  }
  stereo.pan.value = Math.max(-1, Math.min(1, pan));
  source.connect(gain).connect(stereo).connect(destination);
  let resolveEnded: () => void = () => {};
  const ended = new Promise<void>((resolve) => {
    resolveEnded = resolve;
  });
  source.onended = () => {
    resolveEnded();
    source.disconnect();
    gain.disconnect();
    stereo.disconnect();
    cached.pins = Math.max(0, cached.pins - 1);
    evict();
  };
  source.start(when, zone.delay || 0);
  if (!held || !source.loop) {
    gain.gain.setTargetAtTime(0.00001, when + end, release / 4);
    source.stop(when + end + release);
  }
  return {
    ended,
    stop(time = context.currentTime, immediate = false) {
      const tail = immediate ? 0.008 : release;
      gain.gain.cancelScheduledValues(time);
      gain.gain.setTargetAtTime(0.00001, time, tail / 4);
      try {
        source.stop(time + tail);
      } catch {
        /* Already ended. */
      }
    },
    bend(semitones, time) {
      source.playbackRate.setTargetAtTime(
        rate * 2 ** (semitones / 12),
        time,
        0.008,
      );
    },
  };
}
export function gmCacheStats() {
  return {
    samples: buffers.size,
    bytes: [...buffers.values()].reduce((sum, item) => sum + item.bytes, 0),
  };
}
