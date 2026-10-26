import { waveformPeaks } from "../audio/waveform-cache";
import { t as msg, setLanguage, translateDOM, translate } from "../ui/i18n";

import { mountKeyboard, releaseAllKeyboards, revealKeyboardKey } from "../ui/components/keyboard";

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

export function samplerSettings(ctx: RuntimeContext): SamplerInstrument {
  return ctx.project.sampler || (ctx.project.sampler = samplerDefaults());
}

export function setupSamplerOctaveControls(ctx: RuntimeContext) {
  if (ctx.$("#samplerOctaveValue")) return;
  ctx
    .$("#samplerArm")
    .insertAdjacentHTML(
      "afterend",
      '<span class="sampler-octave"><button id="samplerOctaveDown" aria-label="Sampler octave down">− OCT</button><output id="samplerOctaveValue">C4–C5</output><button id="samplerOctaveUp" aria-label="Sampler octave up">OCT ＋</button></span>',
    );
  ctx
    .$(".sampler-keyboard-shell")
    .insertAdjacentHTML(
      "beforeend",
      '<output id="samplerLiveStatus" class="sampler-live-status" aria-live="polite">READY</output>',
    );
  ctx.$(".sampler-hint").textContent =
    "A W S E D F T G Y H U J K · Z/X octave · velocity-sensitive MIDI · Record Take captures the performance.";
  const decorate = () => {
    if (!ctx.$("#samplerKeyboard")) return;
    ctx.$("#samplerOctaveValue").textContent =
      `${ctx.samplerNoteName(ctx.samplerQwertyBase)}–${ctx.samplerNoteName(ctx.samplerQwertyBase + 12)}`;
    ctx.$("#samplerOctaveDown").disabled = ctx.samplerQwertyBase <= 48;
    ctx.$("#samplerOctaveUp").disabled = ctx.samplerQwertyBase >= 60;
  };
  const shift = (amount: number) => {
    for (const key of Object.keys(ctx.samplerQwertyMap))
      ctx.endSamplerPerformance(`sampler-qwerty-${key}`);
    ctx.samplerQwertyBase = Math.max(
      48,
      Math.min(60, ctx.samplerQwertyBase + amount),
    );
    ctx.renderSamplerKeyboard();
    decorate();
    ctx.$("#samplerLiveStatus").textContent =
      `QWERTY · ${ctx.samplerNoteName(ctx.samplerQwertyBase)}–${ctx.samplerNoteName(ctx.samplerQwertyBase + 12)}`;
  };
  ctx.$("#samplerOctaveDown").onclick = () => shift(-12);
  ctx.$("#samplerOctaveUp").onclick = () => shift(12);
  document.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (
        !ctx.samplerArmed ||
        ctx.activeView !== "audio" ||
        document.querySelector("dialog[open]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          (event.target as HTMLElement)?.tagName,
        )
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "x") {
        if (!event.repeat) shift(key === "z" ? -12 : 12);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const offset = ctx.samplerQwertyMap[key];
      if (offset == null) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const source = `sampler-qwerty-${key}`;
      if (!event.repeat && !ctx.samplerHeld.has(source)) {
        const pitch = ctx.samplerQwertyBase + offset;
        ctx.startSamplerPerformance(
          source,
          pitch,
          0.86,
          ctx.$(`[data-sampler-pitch="${pitch}"]`),
        );
      }
    },
    true,
  );
  document.addEventListener(
    "keyup",
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (ctx.samplerQwertyMap[key] == null) return;
      const source = `sampler-qwerty-${key}`;
      if (!ctx.samplerHeld.has(source)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      ctx.endSamplerPerformance(source);
    },
    true,
  );
  decorate();
}

export function samplerNoteName(ctx: RuntimeContext, pitch: number) {
  return `${ctx.pitchNames[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

export function drawSamplerWaveform(ctx: RuntimeContext) {
  const canvas = ctx.$("#samplerWaveform") as HTMLCanvasElement | null,
    buffer = ctx.engine.samplerBuffer;
  if (!canvas) return;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#070b16";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (!buffer) {
    context.fillStyle = "#52607b";
    context.font = "800 12px sans-serif";
    context.textAlign = "center";
    context.fillText(
      msg("ui_2390abf21368"),
      canvas.width / 2,
      canvas.height / 2 + 4,
    );
    return;
  }
  const peaks = waveformPeaks(buffer, canvas.width),
    middle = canvas.height / 2,
    gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "#2ee8ff");
  gradient.addColorStop(0.5, "#ff3bd4");
  gradient.addColorStop(1, "#a7ff5b");
  context.strokeStyle = gradient;
  context.lineWidth = 1.5;
  context.beginPath();
  for (let x = 0; x < canvas.width; x++) {
    const peak = peaks[x]!;
    const height = Math.max(1, peak * (canvas.height - 8));
    context.moveTo(x, middle - height / 2);
    context.lineTo(x, middle + height / 2);
  }
  context.stroke();
  const settings = ctx.samplerSettings();
  context.fillStyle = "#050914aa";
  context.fillRect(0, 0, settings.trimStart * canvas.width, canvas.height);
  context.fillRect(
    settings.trimEnd * canvas.width,
    0,
    (1 - settings.trimEnd) * canvas.width,
    canvas.height,
  );
}

export function startSamplerPerformance(
  ctx: RuntimeContext,
  source: string,
  pitch: number,
  velocity = 0.85,
  element?: HTMLElement | null,
) {
  if (!ctx.samplerSettings().assetId) {
    ctx.toast(msg("ui_01a0a439375a"));
    return;
  }
  element ??= ctx.$(`#samplerKeyboard [data-sampler-pitch="${pitch}"]`);
  element?.classList.add("active", "hit");
  element?.setAttribute("aria-pressed", "true");
  if (element) {
    revealKeyboardKey(element);
    ctx.samplerHeld.set(source, element);
    setTimeout(() => element.classList.remove("hit"), 260);
  }
  ctx.$("#samplerLab")?.classList.add("playing");
  if (ctx.$("#samplerLiveStatus"))
    ctx.$("#samplerLiveStatus").textContent =
      `LIVE · ${ctx.samplerNoteName(pitch)} · ${Math.round(velocity * 127)}`;
  ctx.engine.startSampler(source, pitch, velocity, ctx.samplerSettings());
}

export function endSamplerPerformance(
  ctx: RuntimeContext,
  source: string,
  element?: HTMLElement | null,
) {
  const key = element || ctx.samplerHeld.get(source);
  ctx.samplerHeld.delete(source);
  const held = [...ctx.samplerHeld.values()].some((other) => other === key);
  key?.classList.toggle("active", held);
  key?.setAttribute("aria-pressed", String(held));
  ctx.engine.stopSampler(source);
  if (!ctx.samplerHeld.size) {
    ctx.$("#samplerLab")?.classList.remove("playing");
    if (ctx.$("#samplerLiveStatus"))
      ctx.$("#samplerLiveStatus").textContent = "READY";
  }
}

export function renderSamplerKeyboard(ctx: RuntimeContext) {
  if (!ctx.$("#samplerKeyboard")) return;
  const settings = ctx.samplerSettings();
  mountKeyboard(ctx.$("#samplerKeyboard"), {
    notes: Array.from({ length: 25 }, (_, i) => ({
      pitch: 48 + i,
      root: 48 + i === settings.rootNote,
      shortcut:
        Object.entries(ctx.samplerQwertyMap).find(
          ([, offset]) => ctx.samplerQwertyBase + offset === 48 + i,
        )?.[0] || "",
    })),
    language: ctx.language,
    label: msg("ui_543b7ba0c375"),
    sourcePrefix: "sampler",
    sampler: true,
    onStart: ctx.startSamplerPerformance,
    onEnd: ctx.endSamplerPerformance,
  });
  ctx.$("#samplerName").textContent = settings.assetId
    ? settings.name
    : msg("ui_d9f09da63689");
  ctx.$("#samplerMeta").textContent = settings.assetId
    ? `${settings.duration.toFixed(2)} s · ${ctx.samplerNoteName(settings.rootNote)} ROOT · ${settings.mode.toUpperCase()}`
    : msg("ui_8953db9317b9");
  ctx.$("#samplerArm").disabled = !settings.assetId;
  ctx.$("#samplerArm").setAttribute("aria-pressed", String(ctx.samplerArmed));
  ctx.$("#samplerArm").classList.toggle("active", ctx.samplerArmed);
  ctx.$("#samplerRemove").disabled = !settings.assetId;
  for (const [id, key] of [
    ["#samplerRoot", "rootNote"],
    ["#samplerMode", "mode"],
    ["#samplerTune", "tune"],
    ["#samplerGain", "gain"],
    ["#samplerAttack", "attack"],
    ["#samplerRelease", "release"],
    ["#samplerFilter", "filter"],
    ["#samplerTrimStart", "trimStart"],
    ["#samplerTrimEnd", "trimEnd"],
    ["#samplerPolyphony", "polyphony"],
  ] as Array<[string, keyof SamplerInstrument]>)
    ctx.$(id).value = String(settings[key]);
  ctx.$("#samplerReverse").checked = settings.reverse;
  ctx.$("#samplerRootValue").textContent = ctx.samplerNoteName(
    settings.rootNote,
  );
  ctx.$("#samplerTuneValue").textContent =
    `${settings.tune > 0 ? "+" : ""}${settings.tune} st`;
  ctx.$("#samplerGainValue").textContent =
    `${Math.round(settings.gain * 100)}%`;
  ctx.$("#samplerAttackValue").textContent =
    `${Math.round(settings.attack * 1000)} ms`;
  ctx.$("#samplerReleaseValue").textContent =
    `${Math.round(settings.release * 1000)} ms`;
  ctx.$("#samplerFilterValue").textContent =
    `${Math.round(settings.filter * 100)}%`;
  ctx.drawSamplerWaveform();
}

export async function loadSamplerAsset(ctx: RuntimeContext) {
  const settings = ctx.samplerSettings();
  if (!settings.assetId) {
    ctx.loadedSamplerAssetId = null;
    ctx.engine.clearSamplerSample();
    ctx.renderSamplerKeyboard();
    return;
  }
  try {
    const blob = await ctx.getAsset(settings.assetId);
    if (!blob) throw new Error("missing");
    settings.duration = await ctx.engine.setSamplerSample(
      await blob.arrayBuffer(),
      settings.reverse,
    );
    ctx.loadedSamplerAssetId = settings.assetId;
  } catch {
    ctx.loadedSamplerAssetId = null;
    ctx.engine.clearSamplerSample();
  }
  ctx.renderSamplerKeyboard();
}

export function setupSamplerKeyboard(ctx: RuntimeContext) {
  if (ctx.$("#samplerLab")) return;
  ctx
    .$(".audio-ruler")
    .insertAdjacentHTML(
      "beforebegin",
      '<section id="samplerLab" class="sampler-lab"><header><div><span class="eyebrow">CHROMATIC SAMPLE ENGINE</span><h2>PRISM KEYS</h2><p id="samplerName">NO SAMPLE LOADED</p><small id="samplerMeta">WAV · MP3 · OGG · WEBM</small></div><div class="sampler-actions"><label class="file-button">＋ LOAD SAMPLE<input id="samplerImport" type="file" accept="audio/*"></label><button id="samplerArm" aria-pressed="false" disabled>⌨ ARM QWERTY / MIDI</button><button id="samplerRemove" disabled>REMOVE</button></div></header><canvas id="samplerWaveform" width="1100" height="82" aria-label="Sampler waveform"></canvas><div class="sampler-controls"><label>ROOT <input id="samplerRoot" data-sampler-setting="rootNote" type="range" min="36" max="84" step="1"><output id="samplerRootValue"></output></label><label>MODE <select id="samplerMode" data-sampler-setting="mode"><option value="gate">GATE</option><option value="one-shot">ONE SHOT</option><option value="loop">LOOP</option></select></label><label>TUNE <input id="samplerTune" data-sampler-setting="tune" type="range" min="-24" max="24" step="1"><output id="samplerTuneValue"></output></label><label>LEVEL <input id="samplerGain" data-sampler-setting="gain" type="range" min="0" max="1.5" step=".01"><output id="samplerGainValue"></output></label><label>ATTACK <input id="samplerAttack" data-sampler-setting="attack" type="range" min=".001" max="2" step=".001"><output id="samplerAttackValue"></output></label><label>RELEASE <input id="samplerRelease" data-sampler-setting="release" type="range" min=".01" max="4" step=".01"><output id="samplerReleaseValue"></output></label><label>FILTER <input id="samplerFilter" data-sampler-setting="filter" type="range" min="0" max="1" step=".01"><output id="samplerFilterValue"></output></label><label>START <input id="samplerTrimStart" data-sampler-setting="trimStart" type="range" min="0" max=".99" step=".001"></label><label>END <input id="samplerTrimEnd" data-sampler-setting="trimEnd" type="range" min=".01" max="1" step=".001"></label><label>VOICES <input id="samplerPolyphony" data-sampler-setting="polyphony" type="number" min="1" max="24" step="1"></label><label class="switch"><input id="samplerReverse" data-sampler-setting="reverse" type="checkbox"><span>REVERSE</span></label></div><div class="sampler-keyboard-shell"><div id="samplerKeyboard" class="sampler-keyboard" role="application" aria-label="Chromatic sampler keyboard"></div></div><p class="sampler-hint">A S D F G H J K · velocity-sensitive MIDI · use Record Take to capture the live sampler performance.</p></section>',
    );
  ctx.$("#samplerImport").onchange = async (event: any) => {
    const file = event.target.files?.[0] as File | undefined;
    if (!file) return;
    try {
      const previous = ctx.samplerSettings().assetId,
        id = `sampler-${cryptoId()}`,
        duration = await ctx.engine.setSamplerSample(
          await file.arrayBuffer(),
          false,
        );
      await ctx.putAsset(id, file);
      if (previous) await ctx.deleteAsset(previous);
      ctx.project.sampler = {
        ...samplerDefaults(),
        assetId: id,
        name: file.name,
        size: file.size,
        type: file.type,
        duration,
      };
      ctx.samplerArmed = true;
      ctx.changed();
      ctx.renderSamplerKeyboard();
      ctx.toast(msg("ui_8d47b5f1d29d"));
    } catch (error) {
      ctx.toast(
        `${msg("ui_0ce4de75d7b5")}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    event.target.value = "";
  };
  ctx.$("#samplerArm").onclick = () => {
    ctx.samplerArmed = !ctx.samplerArmed;
    ctx.renderSamplerKeyboard();
    ctx.toast(
      ctx.samplerArmed ? msg("ui_5705fc89dda6") : msg("ui_c3f69d5ce27a"),
    );
  };
  ctx.$("#samplerRemove").onclick = async () => {
    const settings = ctx.samplerSettings();
    if (settings.assetId) await ctx.deleteAsset(settings.assetId);
    ctx.project.sampler = samplerDefaults();
    ctx.samplerArmed = false;
    ctx.engine.clearSamplerSample();
    ctx.changed();
    ctx.renderSamplerKeyboard();
  };
  ctx.$$("[data-sampler-setting]").forEach(
    (input: any) =>
      (input.onchange = async () => {
        const settings = ctx.samplerSettings(),
          key = input.dataset.samplerSetting as keyof SamplerInstrument;
        (settings as any)[key] =
          input.type === "checkbox"
            ? input.checked
            : input.tagName === "SELECT"
              ? input.value
              : +input.value;
        if (settings.trimEnd <= settings.trimStart)
          settings.trimEnd = Math.min(1, settings.trimStart + 0.01);
        settings.polyphony = Math.max(
          1,
          Math.min(24, Math.round(settings.polyphony)),
        );
        ctx.changed();
        if (key === "reverse") await ctx.loadSamplerAsset();
        else ctx.renderSamplerKeyboard();
      }),
  );
  ctx.loadSamplerAsset();
}
