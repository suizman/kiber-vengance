import { formatDb, levelDb } from "../ui/level-control";
import { mountLevel } from "../ui/level-control";
import { mountAudioEffects } from "../ui/audio-effects";
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
    const faderHost = document.createElement("div");
    channel.querySelector(".mix-fader")!.replaceWith(faderHost);
    mountLevel(faderHost, {
      label: ctx.L("Volume", "Volumen"),
      get: () => cfg.volume,
      set: (v) => {
        cfg.volume = v;
        ctx.engine.setProject(ctx.project);
        ctx.recordPerformanceEvent("mixer", `${track}:faderDb`, levelDb(v));
      },
      start: ctx.snapshot,
      commit: () => ctx.changed(),
    });
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
  for (const lane of ctx.project.audioLanes) {
    const channel = document.createElement("article");
    channel.className = "audio-mixer-channel";
    channel.dataset.audioMix = lane.id;
    channel.style.setProperty("--lane", lane.color);
    const header = document.createElement("header"),
      title = document.createElement("b");
    title.textContent = lane.name;
    header.append(title);
    for (const [key, label] of [
      ["solo", "S"],
      ["mute", "M"],
    ] as const) {
      const button = document.createElement("button");
      button.textContent = label;
      button.setAttribute("aria-label", `${lane.name} ${key}`);
      button.setAttribute("aria-pressed", String(lane[key]));
      button.onclick = () => {
        ctx.snapshot();
        lane[key] = !lane[key];
        ctx.engine.setProject(ctx.project);
        ctx.changed();
        renderMixer(ctx);
      };
      header.append(button);
    }
    channel.append(header);
    const meters = document.createElement("div");
    meters.className = "audio-lane-meters";
    for (const side of ["left", "right"]) {
      const meter = document.createElement("meter");
      meter.min = 0;
      meter.max = 1;
      meter.dataset.side = side;
      meter.setAttribute("aria-label", `${lane.name} ${side} peak`);
      meters.append(meter);
    }
    const peak = document.createElement("output");
    peak.className = "audio-lane-peak";
    meters.append(peak);
    channel.append(meters);
    const level = document.createElement("div");
    channel.append(level);
    mountLevel(level, {
      label: ctx.L("Volume", "Volumen"),
      get: () => lane.volume,
      set: (v) => {
        lane.volume = v;
        ctx.engine.setProject(ctx.project);
      },
      start: ctx.snapshot,
      commit: () => ctx.changed(),
    });
    for (const [key, label, min, max] of [
      ["preGainDb", ctx.L("Pre gain", "Ganancia previa"), -24, 12],
      ["pan", ctx.L("Pan", "Panorama"), -1, 1],
    ] as const) {
      const wrapper = document.createElement("label"),
        input = document.createElement("input"),
        output = document.createElement("output");
      wrapper.textContent = label;
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = key === "pan" ? ".01" : ".1";
      input.value = String(lane[key] ?? 0);
      output.textContent = input.value;
      let editing = false;
      input.oninput = () => {
        if (!editing) {
          ctx.snapshot();
          editing = true;
        }
        lane[key] = +input.value;
        output.textContent = input.value;
        ctx.engine.setProject(ctx.project);
      };
      input.onchange = () => {
        editing = false;
        ctx.changed();
      };
      wrapper.append(input, output);
      channel.append(wrapper);
    }
    const label = document.createElement("label"),
      group = document.createElement("select");
    label.textContent = ctx.L("Group", "Grupo");
    group.append(new Option(ctx.L("None", "Ninguno"), ""));
    for (const g of ctx.project.mixerGroups)
      group.append(new Option(g.name, g.id));
    group.value = lane.groupId ?? "";
    group.onchange = () => {
      ctx.snapshot();
      lane.groupId = group.value || null;
      ctx.engine.setProject(ctx.project);
      ctx.changed();
    };
    label.append(group);
    channel.append(label);
    mountAudioEffects(channel, lane, ctx, ctx.L("Track", "Pista"));
    root.append(channel);
  }
  ctx.$("#mixerMaster").value = ctx.project.master;
  ctx.$("#mixerMasterValue").textContent = formatDb(
    levelDb(ctx.project.master),
  );
  ctx
    .$("#masterBypassBtn")
    .setAttribute("aria-pressed", String(ctx.project.masterSettings.bypass));
  ctx.$("#masterBypassBtn").textContent = ctx.project.masterSettings.bypass
    ? "FX BYPASSED"
    : "MASTER FX";
}

export function animateMixer(ctx: RuntimeContext) {
  if (ctx.activeView !== "mix" || document.hidden) return;
  for (const card of ctx.$$(".audio-mixer-channel")) {
    const reading = ctx.engine.audioLaneMeter(card.dataset.audioMix!);
    for (const side of ["left", "right"] as const) {
      const meter = card.querySelector(`meter[data-side=${side}]`);
      if (meter) meter.value = reading[side];
    }
    const held = Math.max(reading.peak, +(card.dataset.peak || 0) * 0.98);
    card.dataset.peak = String(held);
    const output = card.querySelector(".audio-lane-peak");
    if (output) output.textContent = formatDb(levelDb(held));
    card.classList.toggle("clipping", reading.peak >= 1);
  }
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
    const levelHost = document.createElement("div");
    card
      .querySelector("[data-group-volume]")!
      .closest("label")!
      .replaceWith(levelHost);
    mountLevel(levelHost, {
      label: ctx.L("Group volume", "Volumen de grupo"),
      get: () => group.volume,
      set: (v) => {
        group.volume = v;
        ctx.engine.setProject(ctx.project);
      },
      start: ctx.snapshot,
      commit: () => ctx.changed(),
    });
    card.querySelector("[data-group-duck]").oninput = (event: any) =>
      (group.sidechainAmount = +event.target.value);
    card
      .querySelectorAll("[data-group-duck]")
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
