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

export async function launchClip(
  ctx: RuntimeContext,
  track: TrackId,
  clipId: string,
) {
  const quantization =
    +ctx.$("#launchQuantize").value || ctx.project.launcher.quantization;
  ctx.project.launcher.quantization = quantization;
  ctx.engine.stopLauncherTrack(track, false);
  if (!ctx.engine.playing) {
    ctx.project.activeClipIds[track] = clipId;
    await ctx.togglePlay(false);
    ctx.engine.onLaunch?.(track, clipId, 0);
  } else ctx.engine.queueClip(track, clipId, quantization);
  ctx.recordPerformanceEvent("launcher", track, clipId);
  ctx.renderLauncher();
}

export function renderLauncher(ctx: RuntimeContext) {
  const root = ctx.$("#launcherGrid");
  if (!root) return;
  root.innerHTML = TRACKS.map((track) => {
    const cfg = ctx.project.tracks[track],
      clips = clipsForTrack(ctx.project, track),
      queued = ctx.engine.launchQueue.get(track)?.clipId;
    return `<section class="launcher-track" style="--track:${cfg.color || TRACK_META[track].color}"><header><b>${TRACK_META[track].label}</b><button data-launch-stop="${track}" aria-label="${msg("ui_16ab95edb344")}">■</button></header>${clips.map((item) => `<button class="launcher-cell ${ctx.project.activeClipIds[track] === item.id && !ctx.engine.launcherStopped.has(track) ? "active" : ""} ${queued === item.id ? "queued" : ""}" data-launch-track="${track}" data-launch-clip="${item.id}"><b>${ctx.esc(item.name)}</b><small>${item.bars} ${msg("ui_1b402ca81c1b")} · ${item.notes.length} NOTES</small></button>`).join("")}</section>`;
  }).join("");
  ctx
    .$$("[data-launch-clip]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          ctx.launchClip(
            button.dataset.launchTrack,
            button.dataset.launchClip,
          )),
    );
  ctx.$$("[data-launch-stop]").forEach(
    (button) =>
      (button.onclick = () => {
        const track = button.dataset.launchStop as TrackId;
        ctx.engine.stopLauncherTrack(track, true);
        ctx.engine.launchQueue.delete(track);
        ctx.recordPerformanceEvent("launcher", track, "stop");
        ctx.renderLauncher();
      }),
  );
  ctx.$("#launchQuantize").value = String(ctx.project.launcher.quantization);
}

export function setupLauncher(ctx: RuntimeContext) {
  ctx.engine.onLaunch = (track, clipId) => {
    if (ctx.launcherCapturing)
      ctx.launcherSnapshot(`LIVE ${ctx.launcherSnapshots.length + 1}`);
    ctx.$("#launcherStatus").textContent =
      `${TRACK_META[track].label} · ${ctx.project.clips.find((item: any) => item.id === clipId)?.name || "CLIP"} · LIVE`;
    ctx.renderLauncher();
    ctx.changed();
  };
  ctx.$("#launchQuantize").onchange = () => {
    ctx.project.launcher.quantization = +ctx.$("#launchQuantize").value;
    ctx.changed();
  };
  ctx.$("#launcherCaptureBtn").onclick = () => {
    ctx.launcherCapturing = !ctx.launcherCapturing;
    if (ctx.launcherCapturing) ctx.launcherSnapshots = [];
    ctx
      .$("#launcherCaptureBtn")
      .setAttribute("aria-pressed", String(ctx.launcherCapturing));
    ctx.$("#launcherCaptureBtn").textContent = ctx.launcherCapturing
      ? "■ STOP CAPTURE"
      : "● CAPTURE";
    if (ctx.launcherCapturing) ctx.launcherSnapshot("LIVE 1");
    else ctx.$("#launcherCommitBtn").disabled = !ctx.launcherSnapshots.length;
  };
  ctx.$("#launcherCommitBtn").onclick = () => {
    if (!ctx.launcherSnapshots.length) return;
    ctx.snapshot();
    captureLauncherScenes(ctx.project, ctx.launcherSnapshots);
    ctx.launcherSnapshots = [];
    ctx.launcherCapturing = false;
    ctx.$("#launcherCaptureBtn").setAttribute("aria-pressed", "false");
    ctx.$("#launcherCaptureBtn").textContent = "● CAPTURE";
    ctx.changed(true);
    ctx.activateView("arrange");
    ctx.toast(msg("ui_8d7dba85c01c"));
  };
}
