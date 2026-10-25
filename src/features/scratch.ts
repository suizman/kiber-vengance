import { waveformPeaks } from "../audio/waveform-cache";
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
  instrument: import("../model.js").InstrumentState;
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

export function setScratchControls(ctx: RuntimeContext, enabled: boolean) {
  for (const id of [
    "scratchPlayBtn",
    "scratchSyncBtn",
    "scratchBrakeBtn",
    "scratchSpinBtn",
    "scratchStutterBtn",
    "scratchFilter",
    "scratchMix",
    "scratchRate",
    "scratchReverse",
    "scratchRestart",
  ])
    ctx.$(`#${id}`).disabled = !enabled;
  const platter = ctx.$("#scratchPlatter");
  platter.classList.toggle("disabled", !enabled);
  platter.setAttribute("aria-disabled", String(!enabled));
  ctx.$(".scratch-deck").classList.toggle("ready", enabled);
}

export function updateScratchPlayButton(ctx: RuntimeContext) {
  const button = ctx.$("#scratchPlayBtn");
  button.textContent = ctx.engine.scratchPlaying
    ? msg("ui_781961bc81c2")
    : msg("ui_5d12bd53552c");
  button.classList.toggle("active", Boolean(ctx.engine.scratchPlaying));
}

export function drawScratchWaveform(ctx: RuntimeContext, buffer: AudioBuffer) {
  const canvas = ctx.$("#scratchWaveform") as HTMLCanvasElement,
    drawing = canvas.getContext("2d")!,
    width = canvas.width,
    height = canvas.height,
    peaks = waveformPeaks(buffer, width);
  drawing.clearRect(0, 0, width, height);
  const gradient = drawing.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "#2ee8ff");
  gradient.addColorStop(0.52, "#8b7cff");
  gradient.addColorStop(1, "#ff3bd4");
  drawing.strokeStyle = gradient;
  drawing.lineWidth = 1.5;
  drawing.beginPath();
  for (let x = 0; x < width; x++) {
    const peak = peaks[x]!;
    const size = Math.max(1, peak * (height * 0.45));
    drawing.moveTo(x, height / 2 - size);
    drawing.lineTo(x, height / 2 + size);
  }
  drawing.stroke();
  drawing.fillStyle = "#ffffff12";
  drawing.fillRect(0, height / 2, width, 1);
}

export async function armScratchBuffer(
  ctx: RuntimeContext,
  buffer: AudioBuffer,
  label: string,
) {
  ctx.scratchBuffer = buffer;
  ctx.scratchAngle = 0;
  if (ctx.$("#scratchRate")) {
    ctx.$("#scratchRate").value = "1";
    ctx.$("#scratchRateValue").textContent = "1.00×";
    ctx.$("#scratchReverse").setAttribute("aria-pressed", "false");
  }
  ctx.scratchStuttering = false;
  ctx.$("#scratchStutterBtn").setAttribute("aria-pressed", "false");
  ctx.drawScratchWaveform(buffer);
  await ctx.engine.loadScratchBuffer(buffer);
  ctx.engine.setScratchFilter(+ctx.$("#scratchFilter").value);
  ctx.engine.setScratchMix(+ctx.$("#scratchMix").value);
  ctx.setScratchControls(true);
  ctx.updateScratchPlayButton();
  ctx.$("#scratchStatus").textContent = msg("ui_a38c300dea37", { arg0: label });
  ctx.toast(msg("ui_d081121455bb"));
}

export async function importScratchFile(ctx: RuntimeContext, file: File) {
  const input = ctx.$("#scratchImport") as HTMLInputElement;
  input.disabled = true;
  ctx.$("#scratchStatus").textContent = msg("ui_ce7d4508e4be");
  try {
    await ctx.engine.init();
    const buffer = await ctx.engine.ctx.decodeAudioData(
      await file.arrayBuffer(),
    );
    await ctx.armScratchBuffer(buffer, file.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.$("#scratchStatus").textContent =
      `${msg("ui_ae12ff4e68cc")}: ${message}`;
    ctx.toast(msg("ui_22478818bab8"));
  } finally {
    input.disabled = false;
    input.value = "";
  }
}

export async function audioRegionScratchBuffer(
  ctx: RuntimeContext,
  lane: AudioLane,
  region: AudioRegion,
) {
  await ctx.engine.init();
  let source = ctx.engine.audioAssets.get(region.assetId);
  if (!source) {
    const blob = await ctx.getAsset(region.assetId);
    if (!blob) throw new Error(msg("ui_40df748ba040"));
    await ctx.engine.setAudioAsset(region.assetId, await blob.arrayBuffer());
    source = ctx.engine.audioAssets.get(region.assetId);
  }
  if (!source) throw new Error(msg("ui_918d9af82a8b"));
  const rate = audioRegionRate(region, ctx.project.tempo),
    start = Math.max(
      0,
      Math.min(source.duration - 0.001, region.offsetSeconds),
    ),
    requested = (region.lengthSteps * 60) / ctx.project.tempo / 4,
    duration = Math.max(
      0.001,
      Math.min(requested, (source.duration - start) / rate),
    ),
    sampleRate = ctx.engine.ctx.sampleRate,
    frames = Math.max(1, Math.round(duration * sampleRate)),
    buffer = ctx.engine.ctx.createBuffer(2, frames, sampleRate),
    gain = lane.volume * dbToGain(region.gainDb),
    fadeIn = Math.min(
      duration * 0.45,
      (region.fadeInSteps * 60) / ctx.project.tempo / 4,
    ),
    fadeOut = Math.min(
      duration * 0.45,
      (region.fadeOutSteps * 60) / ctx.project.tempo / 4,
    ),
    sourceSpan = duration * rate;
  for (let channel = 0; channel < 2; channel++) {
    const from = source.getChannelData(
        Math.min(channel, source.numberOfChannels - 1),
      ),
      to = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) {
      const time = i / sampleRate,
        sourceTime = region.reverse
          ? start + sourceSpan - time * rate
          : start + time * rate,
        position = Math.max(
          0,
          Math.min(from.length - 1.001, sourceTime * source.sampleRate),
        ),
        index = Math.floor(position),
        next = Math.min(from.length - 1, index + 1),
        mix = position - index,
        envelope =
          (fadeIn && time < fadeIn ? time / fadeIn : 1) *
          (fadeOut && time > duration - fadeOut
            ? (duration - time) / fadeOut
            : 1);
      to[i] =
        (from[index]! * (1 - mix) + from[next]! * mix) *
        gain *
        Math.max(0, Math.min(1, envelope));
    }
  }
  return buffer;
}

export async function loadAudioRegionIntoScratch(
  ctx: RuntimeContext,
  lane: AudioLane,
  region: AudioRegion,
  button: HTMLButtonElement,
) {
  button.disabled = true;
  button.textContent = msg("ui_6baa7861e2c9");
  try {
    const buffer = await ctx.audioRegionScratchBuffer(lane, region);
    await ctx.armScratchBuffer(buffer, region.name);
    ctx.activateView("perform");
  } catch (error) {
    ctx.toast(
      `${msg("ui_d39d8ece3ba7")}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    button.disabled = false;
    button.textContent = msg("ui_ae1e5c33dddc");
  }
}

export async function captureScratchMix(ctx: RuntimeContext) {
  const button = ctx.$("#scratchCaptureBtn");
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add("busy");
  button.textContent = msg("ui_7f060544bf06");
  ctx.$("#scratchStatus").textContent = msg("ui_160f2d508bb1");
  try {
    const bars = Math.max(1, +ctx.$("#scratchBars").value),
      wav = await renderWav(ctx.project, { song: false });
    await ctx.engine.init();
    const decoded = await ctx.engine.ctx.decodeAudioData(
        await wav.arrayBuffer(),
      ),
      rate = ctx.engine.ctx.sampleRate,
      targetSeconds =
        (bars * meterSteps(ctx.project.meter) * 60) / ctx.project.tempo / 4,
      targetFrames = Math.max(1, Math.round(targetSeconds * rate)),
      sourceSteps = Math.max(
        ...TRACKS.map((track) =>
          clipLengthSteps(activeClip(ctx.project, track)),
        ),
      ),
      sourceSeconds = (sourceSteps * 60) / ctx.project.tempo / 4,
      sourceFrames = Math.max(
        1,
        Math.min(
          decoded.length,
          Math.round(sourceSeconds * decoded.sampleRate),
        ),
      ),
      buffer = ctx.engine.ctx.createBuffer(2, targetFrames, rate);
    for (let channel = 0; channel < 2; channel++) {
      const source = decoded.getChannelData(
          Math.min(channel, decoded.numberOfChannels - 1),
        ),
        target = buffer.getChannelData(channel);
      for (let i = 0; i < target.length; i++) {
        const sourcePosition = ((i * decoded.sampleRate) / rate) % sourceFrames,
          index = Math.floor(sourcePosition),
          next = (index + 1) % sourceFrames,
          mix = sourcePosition - index;
        target[i] = source[index]! * (1 - mix) + source[next]! * mix;
      }
    }
    await ctx.armScratchBuffer(
      buffer,
      ctx.L(
        `${bars} BAR${bars === 1 ? "" : "S"}`,
        `${bars} COMPÁS${bars === 1 ? "" : "ES"}`,
      ),
    );
  } catch (error) {
    ctx.$("#scratchStatus").textContent =
      `${msg("ui_b06311a17afd")}: ${error instanceof Error ? error.message : String(error)}`;
    ctx.toast(msg("ui_a451ff2102ee"));
  } finally {
    button.disabled = false;
    button.classList.remove("busy");
    button.textContent = msg("ui_b7bf5b3d2c65");
  }
}

export function animateScratchDeck(
  ctx: RuntimeContext,
  now = performance.now(),
) {
  cancelAnimationFrame(ctx.scratchAnimation);
  if (document.hidden || ctx.activeView !== "perform") {
    ctx.scratchLastFrame = now;
    return;
  }
  const dt = Math.min(0.05, (now - ctx.scratchLastFrame) / 1000);
  ctx.scratchLastFrame = now;
  if (
    ctx.scratchBuffer &&
    ctx.engine.scratchPlaying &&
    !ctx.$(".scratch-deck").classList.contains("scratching")
  )
    ctx.scratchAngle += Number(ctx.engine.scratchSpeed || 0) * 200 * dt;
  ctx
    .$("#scratchPlatter")
    .style.setProperty("--rotation", `${ctx.scratchAngle}deg`);
  ctx.$("#scratchSpeed").textContent =
    `${Number(ctx.engine.scratchSpeed || 0) >= 0 ? "+" : ""}${Number(ctx.engine.scratchSpeed || 0).toFixed(2)}×`;
  if (ctx.scratchBuffer && ctx.engine.scratchFrames)
    ctx.$("#scratchWavePlayhead").style.left =
      `${Math.max(0, Math.min(100, ((ctx.engine.scratchPosition || 0) / ctx.engine.scratchFrames) * 100))}%`;
  ctx.scratchAnimation = requestAnimationFrame(ctx.animateScratchDeck);
}

export function scratchMotorRate(ctx: RuntimeContext) {
  return (
    (+ctx.$("#scratchRate").value || 1) *
    (ctx.$("#scratchReverse").getAttribute("aria-pressed") === "true" ? -1 : 1)
  );
}

export function setupScratchPro(ctx: RuntimeContext) {
  const mic = document.createElement("button");
  mic.id = "scratchMic";
  mic.textContent = msg("ui_b1f9b55a5905");
  ctx.$(".scratch-capture").append(mic);
  ctx
    .$(".scratch-controls")
    .insertAdjacentHTML(
      "beforeend",
      `<div class="scratch-pro"><label>${msg("ui_a4944bacdf8b")}<select id="scratchDivision" aria-label="${msg("ui_a4944bacdf8b")}"><option value="1">1/1</option><option value="2">1/2</option><option value="4">1/4</option><option value="8" selected>1/8</option><option value="16">1/16</option><option value="32">1/32</option><option value="64">1/64</option></select></label><label>${msg("ui_4cf7877b88ad")} <output id="scratchRateValue">1.00×</output><input id="scratchRate" type="range" min=".5" max="1.5" step=".01" value="1"></label><button id="scratchReverse" aria-pressed="false">${msg("ui_57f993376879")}</button><button id="scratchRestart">${msg("ui_cf2357a4d86f")}</button><p>${msg("ui_68803320027e")}</p></div>`,
    );
  ctx.$("#scratchDivision").onchange = () => {
    if (ctx.scratchStuttering)
      ctx.engine.setScratchStutter(
        Math.round(
          ((((ctx.engine.scratchSampleRate || 44100) * 60) /
            ctx.project.tempo) *
            4) /
            +ctx.$("#scratchDivision").value,
        ),
      );
  };
  ctx.$("#scratchRate").oninput = () => {
    ctx.$("#scratchRateValue").textContent =
      `${(+ctx.$("#scratchRate").value).toFixed(2)}×`;
    ctx.engine.setScratchSpeed(ctx.scratchMotorRate());
  };
  ctx.$("#scratchReverse").onclick = () => {
    const b = ctx.$("#scratchReverse");
    b.setAttribute(
      "aria-pressed",
      String(b.getAttribute("aria-pressed") !== "true"),
    );
    ctx.engine.setScratchSpeed(ctx.scratchMotorRate());
  };
  ctx.$("#scratchRestart").onclick = () => {
    ctx.scratchStuttering = false;
    ctx.$("#scratchStutterBtn").setAttribute("aria-pressed", "false");
    ctx.engine.setScratchStutter(0);
    ctx.engine.scratchNode?.port.postMessage({ type: "seek", frame: 0 });
    ctx.engine.setScratchSpeed(ctx.scratchMotorRate());
    ctx.engine.setScratchPlaying(true);
    ctx.updateScratchPlayButton();
  };
  let recorder: MediaRecorder | null = null,
    stream: MediaStream | null = null,
    timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    clearTimeout(timer);
  };
  window.addEventListener("pagehide", stop);
  mic.onclick = async () => {
    if (recorder?.state === "recording") {
      stop();
      return;
    }
    mic.disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(stream);
      const current = recorder;
      current.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      current.onstop = async () => {
        stop();
        mic.disabled = true;
        try {
          await ctx.engine.init();
          const buffer = await ctx.engine.ctx.decodeAudioData(
            await new Blob(chunks, { type: current.mimeType }).arrayBuffer(),
          );
          await ctx.armScratchBuffer(buffer, msg("ui_242805378404"));
          ctx.engine.setScratchPlaying(false);
          ctx.updateScratchPlayButton();
        } catch (error) {
          ctx.toast(String(error));
        } finally {
          recorder = null;
          mic.disabled = false;
          mic.textContent = msg("ui_b1f9b55a5905");
          mic.setAttribute("aria-pressed", "false");
        }
      };
      current.start();
      mic.textContent = msg("ui_737cc35207e0");
      mic.setAttribute("aria-pressed", "true");
      timer = setTimeout(stop, 60000);
    } catch (error) {
      stop();
      recorder = null;
      ctx.toast(`${msg("ui_4e254cadfc1f")}: ${String(error)}`);
    } finally {
      mic.disabled = false;
    }
  };
}

export function setupScratchDeck(ctx: RuntimeContext) {
  ctx.setupScratchPro();
  ctx.setScratchControls(false);
  ctx.engine.onScratchPosition = (state: any) => {
    ctx.engine.scratchPosition = state.frame;
    ctx.engine.scratchSpeed = state.speed;
    ctx.engine.scratchPlaying = state.playing;
  };
  ctx.$("#scratchCaptureBtn").onclick = ctx.captureScratchMix;
  ctx.$("#scratchImport").onchange = (event: any) => {
    const file = event.target.files?.[0] as File | undefined;
    if (file) ctx.importScratchFile(file);
  };
  ctx.$("#scratchPlayBtn").onclick = () => {
    ctx.engine.setScratchPlaying(!ctx.engine.scratchPlaying);
    ctx.updateScratchPlayButton();
  };
  ctx.$("#scratchSyncBtn").onclick = () =>
    ctx.engine.syncScratch(
      ((((ctx.engine.scratchSampleRate || 44100) * 60) / ctx.project.tempo) *
        4) /
        ctx.project.meter.unit,
    );
  ctx.$("#scratchBrakeBtn").onclick = () => {
    ctx.engine.setScratchSpeed(0, 1.15);
    ctx.toast(msg("ui_1e40ff031540"));
  };
  ctx.$("#scratchSpinBtn").onclick = () => {
    ctx.engine.setScratchPlaying(true);
    ctx.engine.setScratchSpeed(-3.6, 0.035);
    ctx.engine.setScratchSpeed(0, 1.6);
    ctx.updateScratchPlayButton();
  };
  ctx.$("#scratchStutterBtn").onclick = () => {
    ctx.scratchStuttering = !ctx.scratchStuttering;
    const frames = ctx.scratchStuttering
      ? Math.round(
          ((((ctx.engine.scratchSampleRate || 44100) * 60) /
            ctx.project.tempo) *
            4) /
            +ctx.$("#scratchDivision").value,
        )
      : 0;
    ctx.engine.setScratchStutter(frames);
    ctx
      .$("#scratchStutterBtn")
      .setAttribute("aria-pressed", String(ctx.scratchStuttering));
  };
  ctx.$("#scratchFilter").oninput = () => {
    const value = +ctx.$("#scratchFilter").value;
    ctx.engine.setScratchFilter(value);
    ctx.$("#scratchFilterValue").textContent =
      value > 0.96 ? "OPEN" : `${Math.round(value * 100)}%`;
  };
  ctx.$("#scratchMix").oninput = () => {
    const value = +ctx.$("#scratchMix").value;
    ctx.engine.setScratchMix(value);
    ctx.$("#scratchMixValue").textContent =
      `${msg("ui_989352a73644")} ${Math.round(value * 100)}%`;
  };
  const platter = ctx.$("#scratchPlatter");
  let previousAngle = 0,
    previousTime = 0,
    dragging = false,
    rotation = 0;
  const angle = (event: PointerEvent) => {
    const rect = platter.getBoundingClientRect();
    return Math.atan2(
      event.clientY - (rect.top + rect.height / 2),
      event.clientX - (rect.left + rect.width / 2),
    );
  };
  platter.onpointerdown = (event: PointerEvent) => {
    if (!ctx.scratchBuffer) return;
    event.preventDefault();
    dragging = true;
    previousAngle = angle(event);
    previousTime = performance.now();
    rotation = ctx.scratchAngle;
    try {
      platter.setPointerCapture(event.pointerId);
    } catch {}
    ctx.$(".scratch-deck").classList.add("scratching");
    ctx.engine.setScratchPlaying(true);
    ctx.engine.setScratchSpeed(0, 0);
    ctx.updateScratchPlayButton();
  };
  platter.onpointermove = (event: PointerEvent) => {
    if (!dragging) return;
    event.preventDefault();
    const current = angle(event),
      time = performance.now();
    let delta = current - previousAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    rotation += (delta * 180) / Math.PI;
    ctx.scratchAngle = rotation;
    const elapsed = Math.max(0.008, (time - previousTime) / 1000),
      speed = Math.max(
        -6,
        Math.min(6, delta / (Math.PI * 2) / elapsed / (33.333 / 60)),
      );
    ctx.engine.setScratchSpeed(speed, 0);
    previousAngle = current;
    previousTime = time;
  };
  const release = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try {
      platter.releasePointerCapture(event.pointerId);
    } catch {}
    ctx.$(".scratch-deck").classList.remove("scratching");
    ctx.engine.setScratchSpeed(ctx.scratchMotorRate(), 0.14);
  };
  platter.onpointerup = release;
  platter.onpointercancel = release;
  platter.onwheel = (event: WheelEvent) => {
    if (!ctx.scratchBuffer) return;
    event.preventDefault();
    ctx.engine.setScratchPlaying(true);
    ctx.engine.setScratchSpeed(
      Math.max(-4, Math.min(4, -event.deltaY * 0.018)),
      0.01,
    );
    clearTimeout(ctx.engine.scratchReturnTimer);
    ctx.engine.scratchReturnTimer = setTimeout(
      () => ctx.engine.setScratchSpeed(ctx.scratchMotorRate(), 0.12),
      90,
    );
  };
  platter.onkeydown = (event: KeyboardEvent) => {
    if (!ctx.scratchBuffer) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      ctx.engine.setScratchPlaying(true);
      ctx.engine.setScratchSpeed(event.key === "ArrowLeft" ? -1.8 : 1.8, 0.01);
    } else if (event.key === "Enter") {
      event.preventDefault();
      ctx.$("#scratchPlayBtn").click();
    }
  };
  platter.onkeyup = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ctx.engine.setScratchSpeed(ctx.scratchMotorRate(), 0.1);
  };
  ctx.animateScratchDeck();
}
