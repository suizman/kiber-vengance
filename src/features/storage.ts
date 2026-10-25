import {
  requestFields,
  requestText,
  requestNumber,
  requestConfirmation,
} from "../ui/dialogs";
import { t as msg, setLanguage, translateDOM, translate } from "../ui/i18n";

import { mountKeyboard, releaseAllKeyboards } from "../ui/components/keyboard";

import { mountDial } from "../ui/components/dial";

import { studioBridge, type StudioView } from "../ui/bridge";

import {
  createProject,
  createEmptyProject,
  migrateProject,
  activeClip,
  clipsForTrack,
  createClip,
  clipLengthSteps,
  meterSteps,
  setProjectMeter,
  makeNote,
  duplicateClip,
  deleteClip,
  varyClip,
  resizeClip,
  quantizeClip,
  automationValue,
  generateClip,
  generateBacking,
  encodeMidi,
  playbackEvents,
  History,
  TRACKS,
  TRACK_META,
  DRUM_NAMES,
  SCALES,
  KEYS,
  addArrangementScene,
  duplicateArrangementScene,
  moveArrangementScene,
  removeArrangementScene,
  distributeArrangementPatterns,
  isInScale,
  createPerformanceTake,
  quantizePerformanceTake,
  captureLauncherScenes,
  duplicateArrangementSelection,
  removeArrangementSelection,
  dbToGain,
  gainToDb,
  createAudioLane,
  createAudioRegion,
  audioRegionRate,
  createAutomationLane,
  detectTransientSlices,
  transformNotes,
  cryptoId,
  samplerDefaults,
} from "../core.js";

import { AudioEngine, renderWav } from "../audio.js";

import type {
  AudioLane,
  AudioRegion,
  AutomationLane,
  MidiMapping,
  ModulationRoute,
  NoteEvent,
  NoteExpression,
  PerformanceEvent,
  PerformanceTake,
  Project,
  SampleAsset,
  SamplerInstrument,
  TrackId,
  TrackState,
} from "../model.js";

import type { RuntimeContext } from "../app";

type Language = "en" | "es";

type QuickExportKind =
  | "wav"
  | "midi"
  | "project"
  | "clip-wav"
  | "clip-midi"
  | "stems"
  | "bundle"
  | "performance";

type QuickTarget = {
  handle: any | null;
  fallback: boolean;
  cancelled: boolean;
  name: string;
  type: string;
};

type UserPreset = {
  id: string;
  name: string;
  track: TrackId;
  tags: string[];
  instrument: TrackState;
  character: any;
};

type CommandAction = {
  label: string;
  labelEs: string;
  group: string;
  groupEs: string;
  shortcut: string;
  icon: string;
  keywords: string;
  run: () => void;
};

export function download(
  ctx: RuntimeContext,
  data: any,
  name: string,
  type = "application/octet-stream",
) {
  const blob = data instanceof Blob ? data : new Blob([data], { type }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function assetDb(ctx: RuntimeContext) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ctx.ASSET_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("assets");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putAsset(ctx: RuntimeContext, id: string, blob: Blob) {
  const db = await ctx.assetDb();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction("assets", "readwrite")
      .objectStore("assets")
      .put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAsset(ctx: RuntimeContext, id: string) {
  const db = await ctx.assetDb();
  return new Promise<Blob | null>((resolve, reject) => {
    const request = db
      .transaction("assets", "readonly")
      .objectStore("assets")
      .get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAsset(ctx: RuntimeContext, id: string) {
  const db = await ctx.assetDb();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction("assets", "readwrite")
      .objectStore("assets")
      .delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function renderExportTargets(ctx: RuntimeContext) {
  const target = ctx.$("#exportTargets");
  if (!target) return;
  const labels: Record<QuickExportKind, string> = {
      wav: "Song WAV",
      midi: "Song MIDI",
      project: "Project JSON",
      "clip-wav": "Clip WAV",
      "clip-midi": "Clip MIDI",
      stems: "Stems ZIP",
      bundle: "Project package",
      performance: "Performance take",
    },
    kinds = Object.keys(labels) as QuickExportKind[];
  target.innerHTML = kinds
    .map((kind) => {
      const handle = ctx.quickHandles.get(kind);
      return `<div><span><b>${labels[kind]}</b><small>${handle ? ctx.esc(handle.name || msg("ui_167883e454d0")) : msg("ui_7432483a63bd")}</small></span>${handle ? `<button data-forget-target="${kind}">${msg("ui_7b025f3e0bf2")}</button>` : ""}</div>`;
    })
    .join("");
  ctx
    .$$("[data-forget-target]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          ctx.forgetExportTarget(button.dataset.forgetTarget)),
    );
}

export async function forgetExportTarget(
  ctx: RuntimeContext,
  kind: QuickExportKind,
) {
  ctx.quickHandles.delete(kind);
  try {
    const db = await ctx.quickHandleDb(),
      transaction = db.transaction("handles", "readwrite");
    transaction.objectStore("handles").delete(kind);
  } catch {}
  ctx.renderExportTargets();
  ctx.$("#exportBtn").classList.toggle("bound", ctx.quickHandles.size > 0);
}

export async function prepareQuickExport(
  ctx: RuntimeContext,
  kind: QuickExportKind,
  name: string,
  type: string,
  extension: string,
  description: string,
  forcePicker = false,
): Promise<QuickTarget> {
  if (!window.showSaveFilePicker)
    return { handle: null, fallback: true, cancelled: false, name, type };
  try {
    let handle = !forcePicker ? ctx.quickHandles.get(kind) : null;
    if (handle) {
      let permission =
        (await handle.queryPermission?.({ mode: "readwrite" })) || "prompt";
      if (permission !== "granted")
        permission =
          (await handle.requestPermission?.({ mode: "readwrite" })) || "denied";
      if (permission !== "granted") handle = null;
    }
    if (!handle) {
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description, accept: { [type]: [extension] } }],
        excludeAcceptAllOption: false,
      });
      await ctx.rememberQuickHandle(kind, handle);
    }
    return {
      handle,
      fallback: false,
      cancelled: false,
      name: handle.name || name,
      type,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      return { handle: null, fallback: false, cancelled: true, name, type };
    throw error;
  }
}

export async function writeQuickExport(
  ctx: RuntimeContext,
  target: QuickTarget,
  data: any,
) {
  if (target.cancelled) return false;
  if (target.fallback) {
    ctx.download(data, target.name, target.type);
    return true;
  }
  const writable = await target.handle.createWritable();
  await writable.write(
    data instanceof Blob ? data : new Blob([data], { type: target.type }),
  );
  await writable.close();
  return true;
}

export async function quickExportProject(
  ctx: RuntimeContext,
  forcePicker = false,
) {
  await ctx.performExport("project", forcePicker);
}

export function safeName(ctx: RuntimeContext) {
  return (
    ctx.project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "kiber-vengance"
  );
}

export function renderVersions(ctx: RuntimeContext) {
  const list = ctx.loadVersions();
  ctx.$("#versionsList").innerHTML = list.length
    ? list
        .map(
          (v: any, i: number) =>
            `<div><span><b>${ctx.esc(v.label)}</b><small>${new Date(v.date).toLocaleString(ctx.language)}</small></span><button data-restore="${i}">${msg("ui_6a8135bcdb58")}</button><button data-delete-version="${i}">×</button></div>`,
        )
        .join("")
    : `<p>${msg("ui_8d5375527bca")}</p>`;
  ctx.$$("[data-restore]").forEach(
    (b: any) =>
      (b.onclick = () => {
        ctx.snapshot();
        ctx.project = migrateProject(list[+b.dataset.restore].project);
        ctx.engine.project = ctx.project;
        ctx.selectedNotes.clear();
        ctx.changed(true);
        ctx.$("#projectMenu").close();
        ctx.toast(msg("ui_658b1fcb8d36"), true);
      }),
  );
  ctx.$$("[data-delete-version]").forEach(
    (b: any) =>
      (b.onclick = () => {
        list.splice(+b.dataset.deleteVersion, 1);
        localStorage.setItem(ctx.VERSIONS, JSON.stringify(list));
        ctx.renderVersions();
      }),
  );
}

export function loadVersions(ctx: RuntimeContext) {
  try {
    return JSON.parse(localStorage.getItem(ctx.VERSIONS) || "[]") || [];
  } catch {
    return [];
  }
}

export async function saveVersion(ctx: RuntimeContext) {
  const label = await requestText(
    msg("ui_023da0f86b7b"),
    `${ctx.project.title} · ${new Date().toLocaleTimeString(ctx.language)}`,
  );
  if (!label) return;
  const list = ctx.loadVersions();
  list.unshift({
    id: crypto.randomUUID(),
    label,
    date: Date.now(),
    project: structuredClone(ctx.project),
  });
  localStorage.setItem(ctx.VERSIONS, JSON.stringify(list.slice(0, 20)));
  ctx.renderVersions();
  ctx.toast(msg("ui_ea697be09cd5"));
}

export async function loadAudioAssets(ctx: RuntimeContext) {
  const ids = new Set<string>();
  for (const lane of ctx.project.audioLanes || [])
    for (const region of lane.regions) ids.add(region.assetId);
  for (const id of ids)
    try {
      const blob = await ctx.getAsset(id);
      if (blob) await ctx.engine.setAudioAsset(id, await blob.arrayBuffer());
    } catch {}
  ctx.renderAudioStudio();
}

export function setExportProgress(
  ctx: RuntimeContext,
  value: number,
  status?: string,
) {
  ctx.$("#exportProgress").value = Math.max(0, Math.min(100, value));
  if (status) ctx.$("#renderStatus").textContent = status;
}

export async function exportWav(
  ctx: RuntimeContext,
  song: boolean,
  target?: QuickTarget,
) {
  const st = ctx.$("#renderStatus"),
    buttons = ctx.$$("#exportDialog button");
  ctx.exportController = new AbortController();
  buttons.forEach((button) => {
    if (button.id !== "cancelExportBtn") button.disabled = true;
  });
  ctx.$("#cancelExportBtn").disabled = false;
  ctx.setExportProgress(
    12,
    ctx.L(
      song ? "RENDERING FULL ARRANGEMENT…" : "RENDERING ACTIVE CLIPS…",
      song ? "RENDERIZANDO ARREGLO COMPLETO…" : "RENDERIZANDO CLIPS ACTIVOS…",
    ),
  );
  try {
    const wav = await renderWav(ctx.project, { song, ...ctx.wavOptions() }),
      name = `${ctx.safeName()}${song ? "-song" : "-clips"}.wav`;
    ctx.setExportProgress(90, msg("ui_70e8b5b54433"));
    if (target) await ctx.writeQuickExport(target, wav);
    else ctx.download(wav, name);
    ctx.setExportProgress(100, msg("ui_a55ceacc1e3a"));
    ctx.toast(
      target && !target.fallback
        ? msg("ui_7e750b10745a", { arg0: target.name })
        : msg("ui_e206fda6141f"),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      st.textContent = msg("ui_9db4a4651420");
      return;
    }
    throw error;
  } finally {
    ctx.exportController = null;
    buttons.forEach((button) => (button.disabled = false));
    ctx.$("#cancelExportBtn").disabled = true;
  }
}

export function crc32(ctx: RuntimeContext, bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function zipFiles(
  ctx: RuntimeContext,
  files: Array<{ name: string; data: Blob }>,
) {
  const encoder = new TextEncoder(),
    parts: BlobPart[] = [],
    central: BlobPart[] = [],
    offsets: number[] = [];
  let offset = 0;
  const u16 = (value: number) =>
      new Uint8Array([value & 255, (value >>> 8) & 255]),
    u32 = (value: number) =>
      new Uint8Array([
        value & 255,
        (value >>> 8) & 255,
        (value >>> 16) & 255,
        (value >>> 24) & 255,
      ]);
  for (const file of files) {
    const name = encoder.encode(file.name),
      data = new Uint8Array(await file.data.arrayBuffer()),
      crc = ctx.crc32(data),
      header = new Blob([
        u32(0x04034b50),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        name,
      ]);
    offsets.push(offset);
    parts.push(header, data);
    offset += header.size + data.length;
  }
  let centralSize = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!,
      name = encoder.encode(file.name),
      data = new Uint8Array(await file.data.arrayBuffer()),
      entry = new Blob([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(ctx.crc32(data)),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offsets[i]!),
        name,
      ]);
    central.push(entry);
    centralSize += entry.size;
  }
  return new Blob(
    [
      ...parts,
      ...central,
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(files.length),
      u16(files.length),
      u32(centralSize),
      u32(offset),
      u16(0),
    ],
    { type: "application/zip" },
  );
}

export async function readStoreZip(ctx: RuntimeContext, blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()),
    view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    decoder = new TextDecoder(),
    files = new Map<string, Blob>();
  let offset = 0;
  while (
    offset + 30 <= bytes.length &&
    view.getUint32(offset, true) === 0x04034b50
  ) {
    const method = view.getUint16(offset + 8, true),
      size = view.getUint32(offset + 18, true),
      nameLength = view.getUint16(offset + 26, true),
      extraLength = view.getUint16(offset + 28, true);
    if (method !== 0)
      throw new Error(
        "Only uncompressed КИБЕР VENGANCE packages are supported",
      );
    const nameStart = offset + 30,
      dataStart = nameStart + nameLength + extraLength,
      name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    files.set(name, new Blob([bytes.slice(dataStart, dataStart + size)]));
    offset = dataStart + size;
  }
  return files;
}

export async function importProjectFile(ctx: RuntimeContext, file: File) {
  if (file.name.toLowerCase().endsWith(".zip")) {
    const files = await ctx.readStoreZip(file),
      entry = [...files.entries()].find(([name]) =>
        name.endsWith(".kiber.json"),
      );
    if (!entry)
      throw new Error("Project package does not contain a .kiber.json file");
    const next = migrateProject(JSON.parse(await entry[1].text()));
    for (const asset of next.samples) {
      const sample = [...files.entries()].find(([name]) =>
        name.startsWith(`samples/${asset.slot}-`),
      );
      if (sample)
        await ctx.putAsset(
          asset.id,
          new Blob([await sample[1].arrayBuffer()], { type: asset.type }),
        );
    }
    if (next.sampler.assetId) {
      const packed = [...files.entries()].find(([name]) =>
        name.startsWith(`sampler/${next.sampler.assetId}-`),
      );
      if (packed) {
        const blob = new Blob([await packed[1].arrayBuffer()], {
          type: next.sampler.type || "audio/wav",
        });
        await ctx.putAsset(next.sampler.assetId, blob);
        try {
          await ctx.engine.setSamplerSample(
            await blob.arrayBuffer(),
            next.sampler.reverse,
          );
        } catch {}
      }
    }
    const audioIds = new Set<string>();
    for (const lane of next.audioLanes)
      for (const region of lane.regions) audioIds.add(region.assetId);
    for (const id of audioIds) {
      const entry = [...files.entries()].find(([name]) =>
        name.startsWith(`audio/${id}-`),
      );
      if (!entry) continue;
      const blob = new Blob([await entry[1].arrayBuffer()], {
        type: "audio/wav",
      });
      await ctx.putAsset(id, blob);
      try {
        await ctx.engine.setAudioAsset(id, await blob.arrayBuffer());
      } catch {}
    }
    return next;
  }
  return migrateProject(JSON.parse(await file.text()));
}

export function exportName(ctx: RuntimeContext, kind: QuickExportKind) {
  const suffix: Record<QuickExportKind, string> = {
    wav: "-song.wav",
    midi: "-song.mid",
    project: ".kiber.json",
    "clip-wav": "-clips.wav",
    "clip-midi": "-clips.mid",
    stems: "-stems.zip",
    bundle: "-project-package.zip",
    performance: "-performance.webm",
  };
  return `${ctx.safeName()}${suffix[kind]}`;
}

export async function performExport(
  ctx: RuntimeContext,
  kind: QuickExportKind,
  forcePicker = false,
) {
  if (
    kind === "performance" &&
    !ctx.performanceTake &&
    ctx.activePerformanceTakeId
  ) {
    const take = ctx.project.performanceTakes.find(
      (item: PerformanceTake) => item.id === ctx.activePerformanceTakeId,
    );
    if (take) ctx.performanceTake = await ctx.loadPerformanceAudio(take);
  }
  if (kind === "performance" && !ctx.performanceTake) {
    ctx.toast(msg("ui_8631a6aeb0e3"));
    return;
  }
  const meta = ctx.exportMeta[kind],
    target = await ctx.prepareQuickExport(
      kind,
      ctx.exportName(kind),
      meta.type,
      meta.extension,
      meta.description,
      forcePicker,
    );
  if (target.cancelled) return;
  try {
    let data: Blob | string | Uint8Array;
    if (kind === "wav" || kind === "clip-wav") {
      localStorage.setItem(ctx.LAST_EXPORT, kind);
      await ctx.exportWav(kind === "wav", target);
      ctx.renderExportTargets();
      return;
    } else if (kind === "midi" || kind === "clip-midi")
      data = encodeMidi(ctx.project, { song: kind === "midi" });
    else if (kind === "project") data = JSON.stringify(ctx.project, null, 2);
    else if (kind === "stems") data = await ctx.renderStems();
    else if (kind === "bundle") data = await ctx.renderProjectBundle();
    else data = ctx.performanceTake!;
    await ctx.writeQuickExport(target, data);
    localStorage.setItem(ctx.LAST_EXPORT, kind);
    ctx.setExportProgress(100, msg("ui_3345522d325d"));
    ctx.toast(
      target.fallback
        ? msg("ui_baf96d1b4d9a")
        : msg("ui_cfa7c02f4ddd", { arg0: target.name }),
    );
    ctx.renderExportTargets();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      ctx.$("#renderStatus").textContent = msg("ui_9db4a4651420");
    else
      ctx.$("#renderStatus").textContent =
        `${msg("ui_a68d7ce61660")}: ${error instanceof Error ? error.message : String(error)}`;
    ctx.toast(ctx.$("#renderStatus").textContent);
  } finally {
    ctx.exportController = null;
    ctx.$("#cancelExportBtn").disabled = true;
  }
}

export async function quickExportWav(ctx: RuntimeContext, forcePicker = false) {
  await ctx.performExport("wav", forcePicker);
}

export async function quickExportMidi(
  ctx: RuntimeContext,
  forcePicker = false,
) {
  await ctx.performExport("midi", forcePicker);
}

export function repeatLastExport(ctx: RuntimeContext) {
  const kind = (localStorage.getItem(ctx.LAST_EXPORT) ||
    "wav") as QuickExportKind;
  ctx.performExport(kind, false);
}
