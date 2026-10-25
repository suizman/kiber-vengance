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

export function renderMixer(ctx: RuntimeContext) {
  const root = ctx.$("#mixerChannels");
  if (!root) return;
  root.innerHTML = TRACKS.map((track, index) => {
    const cfg = ctx.project.tracks[track],
      character = activeClip(ctx.project, track).character,
      meta = TRACK_META[track],
      db = gainToDb(cfg.volume);
    return `<article class="mixer-channel ${cfg.mute ? "muted" : ""}" data-mix-track="${track}" style="--track:${cfg.color || meta.color}"><header><span>0${index + 1}</span><b>${meta.label}</b><input data-track-color type="color" value="${cfg.color || meta.color}" aria-label="${meta.label} color"></header><div class="mix-meter-pair"><canvas width="14" height="150" aria-label="${meta.label} left meter"></canvas><canvas width="14" height="150" aria-label="${meta.label} right meter"></canvas></div><label class="mix-fader"><span>FADER</span><input data-mix="faderDb" type="range" min="-60" max="6" step=".1" value="${db}" orient="vertical"><output>${db <= -60 ? "−∞" : `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`}</output></label><label data-precision><span>PRE GAIN</span><input data-mix="preGainDb" type="range" min="-24" max="12" step=".5" value="${cfg.preGainDb}"><output>${cfg.preGainDb > 0 ? "+" : ""}${cfg.preGainDb.toFixed(1)} dB</output></label><label data-precision><span>PAN</span><input data-mix="pan" type="range" min="-1" max="1" step=".01" value="${cfg.pan}"><output>${Math.round(cfg.pan * 100)}</output></label><label data-precision><span>DELAY</span><input data-mix="delay" type="range" min="0" max="1" step=".01" value="${character.fx.delay}"><output>${Math.round(character.fx.delay * 100)}</output></label><label data-precision><span>REVERB</span><input data-mix="reverb" type="range" min="0" max="1" step=".01" value="${character.fx.reverb}"><output>${Math.round(character.fx.reverb * 100)}</output></label><label data-precision><span>SENDS</span><select data-send-mode><option value="post" ${cfg.sendMode === "post" ? "selected" : ""}>POST</option><option value="pre" ${cfg.sendMode === "pre" ? "selected" : ""}>PRE</option></select><output class="mix-peak">${db.toFixed(1)} dB</output></label><div><button data-mix-solo aria-pressed="${cfg.solo}" class="${cfg.solo ? "on" : ""}">S</button><button data-mix-mute aria-pressed="${cfg.mute}" class="${cfg.mute ? "on" : ""}">M</button></div></article>`;
  }).join("");
  ctx.$$("[data-mix-track]").forEach((channel) => {
    const track = channel.dataset.mixTrack as TrackId,
      cfg = ctx.project.tracks[track],
      character = activeClip(ctx.project, track).character;
    channel.querySelectorAll("[data-mix]").forEach((input: any) => {
      input.onpointerdown = ctx.snapshot;
      input.oninput = () => {
        const key = input.dataset.mix,
          value = +input.value;
        if (key === "delay" || key === "reverb") character.fx[key] = value;
        else if (key === "faderDb")
          cfg.volume = value <= -60 ? 0 : 10 ** (value / 20);
        else (cfg as any)[key] = value;
        const output = input.closest("label").querySelector("output");
        if (output)
          output.textContent =
            key === "preGainDb" || key === "faderDb"
              ? value <= -60
                ? "−∞"
                : (value > 0 ? "+" : "") + value.toFixed(1) + " dB"
              : String(Math.round(value * 100));
        ctx.engine.setProject(ctx.project);
        ctx.recordPerformanceEvent("mixer", `${track}:${key}`, value);
      };
      input.onchange = () => ctx.changed();
    });
    channel.querySelector("[data-send-mode]").onchange = (event: any) => {
      cfg.sendMode = event.target.value;
      ctx.recordPerformanceEvent("mixer", `${track}:sendMode`, cfg.sendMode);
      ctx.changed();
    };
    channel.querySelector("[data-track-color]").oninput = (event: any) => {
      cfg.color = event.target.value;
      channel.style.setProperty("--track", cfg.color);
    };
    channel.querySelector("[data-track-color]").onchange = () =>
      ctx.changed(true);
    channel.querySelector("[data-mix-solo]").onclick = () =>
      ctx.$(`[data-solo="${track}"]`)?.click();
    channel.querySelector("[data-mix-mute]").onclick = () =>
      ctx.$(`[data-mute="${track}"]`)?.click();
  });
  ctx.$("#mixerMaster").value = ctx.project.master;
  ctx.$("#mixerMasterValue").textContent =
    `${Math.round(ctx.project.master * 100)}%`;
  ctx
    .$("#masterBypassBtn")
    .setAttribute("aria-pressed", String(ctx.project.masterSettings.bypass));
  ctx.$("#masterBypassBtn").textContent = ctx.project.masterSettings.bypass
    ? "FX BYPASSED"
    : "MASTER FX";
}

export function animateMixer(ctx: RuntimeContext) {
  if (ctx.activeView !== "mix" || document.hidden) return;
  let loudnessEnergy = 0;
  for (const channel of ctx.$$("[data-mix-track]")) {
    const track = channel.dataset.mixTrack as TrackId,
      meter = ctx.engine.trackMeter(track),
      canvases = channel.querySelectorAll("canvas"),
      levels = [meter.left, meter.right];
    loudnessEnergy += meter.rms * meter.rms;
    ctx.mixerPeaks[track] = Math.max(
      meter.peak,
      (ctx.mixerPeaks[track] || 0) * 0.965,
    );
    canvases.forEach((canvas: any, index: number) => {
      const level = levels[index] || 0,
        drawing = canvas.getContext("2d"),
        height = canvas.height;
      drawing.clearRect(0, 0, canvas.width, height);
      const gradient = drawing.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, "#2ee8ff");
      gradient.addColorStop(0.72, "#a7ff5b");
      gradient.addColorStop(1, "#ff4e72");
      drawing.fillStyle = gradient;
      drawing.fillRect(
        2,
        height * (1 - level),
        canvas.width - 4,
        height * level,
      );
      drawing.fillStyle = "#ffcf67";
      drawing.fillRect(
        1,
        height * (1 - (ctx.mixerPeaks[track] || 0)),
        canvas.width - 2,
        2,
      );
    });
    const peak = channel.querySelector(".mix-peak");
    if (peak)
      peak.textContent =
        ctx.mixerPeaks[track]! <= 0.001
          ? "−∞ dB"
          : `${(20 * Math.log10(ctx.mixerPeaks[track]!)).toFixed(1)} dB`;
  }
  const loudness = Math.sqrt(loudnessEnergy / TRACKS.length);
  ctx.$("#mixerLoudness").textContent =
    loudness > 0.0001
      ? `${(20 * Math.log10(loudness) - 9).toFixed(1)} LUFS-M APPROX`
      : "−∞ LUFS-M APPROX";
  ctx.engine.draw(ctx.$("#mixerMasterMeter"));
  requestAnimationFrame(ctx.animateMixer);
}

export function captureMixerReference(ctx: RuntimeContext) {
  ctx.mixerReference = ctx.mixSnapshot();
  ctx.mixerComparing = false;
  ctx.$("#mixCompareBtn").disabled = false;
  ctx.$("#mixCompareBtn").setAttribute("aria-pressed", "false");
  ctx.toast(msg("ui_67222dc469ed"));
}

export function toggleMixerReference(ctx: RuntimeContext) {
  if (!ctx.mixerReference) return;
  if (!ctx.mixerReference.current)
    ctx.mixerReference.current = ctx.mixSnapshot();
  ctx.mixerComparing = !ctx.mixerComparing;
  const source = ctx.mixerComparing
      ? ctx.mixerReference
      : ctx.mixerReference.current,
    target = ctx.mixerComparing
      ? ctx.mixerReference.current
      : ctx.mixerReference,
    compensation = Math.max(
      0.5,
      Math.min(2, (target.loudness || 1) / (source.loudness || 1)),
    );
  for (const track of TRACKS)
    Object.assign(ctx.project.tracks[track], source.tracks[track]);
  ctx.project.master = Math.max(0, Math.min(1, source.master * compensation));
  ctx.engine.setProject(ctx.project);
  ctx.renderMixer();
  ctx.renderTracks();
  ctx
    .$("#mixCompareBtn")
    .setAttribute("aria-pressed", String(ctx.mixerComparing));
  ctx.$("#mixCompareBtn").textContent = ctx.mixerComparing
    ? msg("ui_dfbb48381c2f")
    : msg("ui_3f8fc90c3680");
}

export function setupPrecisionControls(ctx: RuntimeContext) {
  ctx.$("#masterBypassBtn").onclick = () => {
    ctx.snapshot();
    ctx.project.masterSettings.bypass = !ctx.project.masterSettings.bypass;
    ctx.engine.setProject(ctx.project);
    ctx.recordPerformanceEvent(
      "mixer",
      "master:bypass",
      ctx.project.masterSettings.bypass,
    );
    ctx.changed();
    ctx.renderMixer();
  };
  ctx.$("#cancelExportBtn").onclick = () => ctx.exportController?.abort();
}

export function renderMixGroups(ctx: RuntimeContext) {
  const root = ctx.$("#mixGroups");
  if (!root) return;
  root.innerHTML = (ctx.project.mixerGroups || [])
    .map(
      (group: any) =>
        `<article class="mix-group" data-mix-group="${group.id}" style="--group:${group.color}"><b>${ctx.esc(group.name)}</b><label>BUS LEVEL<input data-group-volume type="range" min="0" max="1.5" step=".01" value="${group.volume}"></label><label>SIDECHAIN<input data-group-duck type="range" min="0" max=".9" step=".01" value="${group.sidechainAmount}"></label></article>`,
    )
    .join("");
  ctx.$$("[data-mix-group]").forEach((card) => {
    const group = ctx.project.mixerGroups.find(
      (item: any) => item.id === card.dataset.mixGroup,
    )!;
    card.querySelector("[data-group-volume]").oninput = (event: any) => {
      group.volume = +event.target.value;
      ctx.engine.setProject(ctx.project);
    };
    card.querySelector("[data-group-duck]").oninput = (event: any) =>
      (group.sidechainAmount = +event.target.value);
    card
      .querySelectorAll("input")
      .forEach((input: any) => (input.onchange = () => ctx.changed()));
  });
  ctx.$$("[data-mix-track]").forEach((channel) => {
    const track = channel.dataset.mixTrack as TrackId,
      select = document.createElement("select");
    select.dataset.trackGroup = "";
    select.innerHTML =
      '<option value="">MASTER</option>' +
      ctx.project.mixerGroups
        .map(
          (group: any) =>
            `<option value="${group.id}" ${ctx.project.tracks[track].groupId === group.id ? "selected" : ""}>${ctx.esc(group.name)}</option>`,
        )
        .join("");
    const label = document.createElement("label");
    label.dataset.precision = "";
    label.innerHTML = "<span>GROUP</span>";
    label.append(select);
    channel.insertBefore(label, channel.lastElementChild);
    select.onchange = () => {
      ctx.project.tracks[track].groupId = select.value || null;
      ctx.changed();
    };
  });
  ctx.$("#masterTargetLufs").value = ctx.project.masterSettings.targetLufs;
  ctx.$("#masterTargetValue").textContent =
    `${ctx.project.masterSettings.targetLufs}`;
  ctx.$("#masterCeiling").value = ctx.project.masterSettings.ceilingDb;
  ctx.$("#masterCeilingValue").textContent =
    ctx.project.masterSettings.ceilingDb.toFixed(1);
  ctx
    .$("#monoCheckBtn")
    .setAttribute("aria-pressed", String(ctx.project.masterSettings.monoCheck));
}
