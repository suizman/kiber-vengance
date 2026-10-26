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
  instrumentSettings,
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

export function renderTracks(ctx: RuntimeContext) {
  const soloActive = TRACKS.some((id) => ctx.project.tracks[id].solo);
  ctx.$("#tracks").innerHTML = TRACKS.map((id, i) => {
    const m = TRACK_META[id],
      t = ctx.project.tracks[id],
      c = activeClip(ctx.project, id);
    return `<div class="track ${id === ctx.selectedTrack ? "active" : ""} ${t.solo ? "soloed" : ""} ${soloActive && !t.solo ? "solo-muted" : ""}" data-track="${id}" style="--track:${t.color || m.color}"><button class="track-select"><span class="track-head"><span><b class="track-name">${m.label}</b><small>${ctx.esc(c?.name || msg("ui_eb69ca3f3fb0"))}</small></span><b>0${i + 1}</b></span><span class="track-foot"><span class="track-meter"><i style="width:${t.volume * 100}%"></i></span></span></button><span class="track-switches"><button class="solo ${t.solo ? "on" : ""}" data-solo="${id}" aria-label="${msg("ui_cd16c1024d0d")} ${m.label}" aria-pressed="${t.solo}">S</button><button class="mute ${t.mute ? "on" : ""}" data-mute="${id}" aria-label="${msg("ui_6dbf0ca01f5c")} ${m.label}" aria-pressed="${t.mute}">M</button></span></div>`;
  }).join("");
  ctx.$$(".track").forEach(
    (el) =>
      (el.onclick = (e: any) => {
        const solo = e.target.closest("[data-solo]"),
          mute = e.target.closest("[data-mute]");
        if (solo) {
          e.stopPropagation();
          ctx.snapshot();
          const id = solo.dataset.solo as TrackId,
            was = ctx.project.tracks[id].solo;
          TRACKS.forEach((track) => (ctx.project.tracks[track].solo = false));
          ctx.project.tracks[id].solo = !was;
          if (!was) ctx.project.tracks[id].mute = false;
          ctx.recordPerformanceEvent("mixer", id + ":solo", !was);
          ctx.changed(true);
          ctx.toast(
            was
              ? msg("ui_370043e434fe")
              : msg("ui_8c778885e399", { arg0: TRACK_META[id].label }),
          );
          return;
        }
        if (mute) {
          e.stopPropagation();
          ctx.snapshot();
          ctx.project.tracks[mute.dataset.mute].mute =
            !ctx.project.tracks[mute.dataset.mute].mute;
          ctx.recordPerformanceEvent(
            "mixer",
            mute.dataset.mute + ":mute",
            ctx.project.tracks[mute.dataset.mute].mute,
          );
          ctx.changed(true);
          return;
        }
        ctx.selectedTrack = el.dataset.track;
        ctx.selectedNotes.clear();
        ctx.renderAll();
        ctx.setDefaultScroll();
      }),
  );
}

export function renderInspector(ctx: RuntimeContext) {
  const meta = TRACK_META[ctx.selectedTrack],
    cfg = ctx.clip().instrument,
    mixer = ctx.project.tracks[ctx.selectedTrack];
  document.documentElement.style.setProperty("--track", meta.color);
  ctx.$("#trackName").textContent = meta.label;
  ctx.$("#trackType").textContent =
    ctx.selectedTrack === "drums"
      ? msg("ui_0b66072942c6")
      : ctx.selectedTrack === "guitar"
        ? msg("ui_b022c81cc782")
        : msg("ui_b78e09c7fe9b");
  const names = [...new Set([...ctx.presets[ctx.selectedTrack], cfg.preset])];
  ctx.$("#preset").innerHTML = names
    .map(
      (p) =>
        `<option ${p === cfg.preset ? "selected" : ""}>${ctx.esc(p)}</option>`,
    )
    .join("");
  ctx.$("#waveSelect").hidden = ctx.selectedTrack === "drums";
  ctx.$("#osc2WaveSelect").hidden = ctx.selectedTrack === "drums";
  ctx.$("#filterSelect").hidden = ctx.selectedTrack === "drums";
  ctx.$("#waveSelect").value = cfg.wave || "sawtooth";
  ctx.$("#osc2WaveSelect").value = cfg.osc2Wave || "off";
  ctx.$("#filterSelect").value = cfg.filterType || "lowpass";
  const defs: any[] =
      ctx.selectedTrack === "drums"
        ? [
            ["volume", msg("ui_f481cc60f17a"), 0, 1, 0.01],
            ["pan", "PAN", -1, 1, 0.01],
          ]
        : [
            ["volume", msg("ui_f481cc60f17a"), 0, 1, 0.01],
            ["osc2Mix", msg("ui_126c91105eb0"), 0, 1, 0.01],
            ["cutoff", msg("ui_49f37bf2cfd3"), 120, 10000, 1],
            ["resonance", msg("ui_4788370c8385"), 0.1, 16, 0.1],
            ["attack", msg("ui_df86d4b6db63"), 0.005, 1, 0.005],
            ["decay", msg("ui_eb866db5850f"), 0.01, 2, 0.01],
            ["sustain", msg("ui_d76b0d191577"), 0.01, 1, 0.01],
            ["release", msg("ui_f73b278fdaba"), 0.05, 3, 0.01],
            ["glide", msg("ui_6c6fd1c7cf9c"), 0, 0.5, 0.005],
            ["pan", "PAN", -1, 1, 0.01],
            ["unison", msg("ui_53b6408b26c1"), 1, 3, 1],
            ["detune", msg("ui_d57268622512"), 0, 20, 0.5],
          ],
    format = (key: string, v: number) =>
      key === "cutoff"
        ? `${Math.round(v)} Hz`
        : key === "detune"
          ? `${v} ct`
          : key === "unison"
            ? `${v}x`
            : key === "pan"
              ? `${v > 0 ? "+" : ""}${Math.round(v * 100)}`
              : Math.round(v * 100);
  const root = ctx.$("#synthControls");
  for (const [key, label, min, max, step] of defs) {
    let host = root.querySelector(`[data-dial="${key}"]`);
    if (!host) {
      host = document.createElement("div");
      host.dataset.dial = key;
      root.append(host);
    }
    mountDial(host, {
      label,
      value: (key === "volume" || key === "pan" ? mixer : cfg)[key],
      min,
      max,
      step,
      language: ctx.language,
      format: (value) => String(format(key, value)),
      onStart: ctx.snapshot,
      onChange: (value) => {
        (key === "volume" || key === "pan" ? mixer : cfg)[key] = value;
        ctx.engine.setProject(ctx.project);
      },
      onCommit: () => ctx.changed(),
    });
  }
  ctx.$("#preset").onchange = () => {
    ctx.snapshot();
    cfg.preset = ctx.$("#preset").value;
    ctx.applyPreset(ctx.selectedTrack, cfg.preset);
    ctx.changed(true);
  };
  ctx.$("#waveSelect").onchange = () => {
    ctx.snapshot();
    cfg.wave = ctx.$("#waveSelect").value;
    ctx.changed();
  };
  ctx.$("#osc2WaveSelect").onchange = () => {
    ctx.snapshot();
    cfg.osc2Wave = ctx.$("#osc2WaveSelect").value;
    ctx.changed();
  };
  ctx.$("#filterSelect").onchange = () => {
    ctx.snapshot();
    cfg.filterType = ctx.$("#filterSelect").value;
    ctx.changed();
  };
}

export function applyPreset(ctx: RuntimeContext, track: TrackId, name: string) {
  const c = activeClip(ctx.project, track).instrument,
    fx = activeClip(ctx.project, track).character.fx,
    bank: any = {
      lead: {
        "Razor Choir": {
          wave: "sawtooth",
          osc2Wave: "square",
          osc2Mix: 0.2,
          cutoff: 4200,
          resonance: 4,
          attack: 0.015,
          decay: 0.11,
          sustain: 0.72,
          release: 0.22,
          unison: 2,
          detune: 7,
        },
        "Neon Talon": {
          wave: "square",
          osc2Wave: "sawtooth",
          osc2Mix: 0.12,
          cutoff: 5600,
          resonance: 2,
          attack: 0.008,
          decay: 0.06,
          sustain: 0.62,
          release: 0.12,
          unison: 2,
          detune: 9,
        },
        "Solar Vengeance": {
          wave: "sawtooth",
          osc2Wave: "triangle",
          osc2Mix: 0.32,
          cutoff: 7200,
          resonance: 7,
          attack: 0.025,
          decay: 0.18,
          sustain: 0.8,
          release: 0.48,
          unison: 3,
          detune: 12,
        },
      },
      guitar: {
        "Chrome Strings": {
          wave: "triangle",
          osc2Wave: "sawtooth",
          osc2Mix: 0.18,
          cutoff: 5200,
          resonance: 2.4,
          attack: 0.003,
          decay: 0.24,
          sustain: 0.18,
          release: 0.38,
          unison: 1,
          detune: 4,
          fx: { ...fx, distortion: 0.34, saturation: 0.3, chorus: 0.12 },
        },
        "Voltage Chug": {
          wave: "sawtooth",
          osc2Wave: "square",
          osc2Mix: 0.26,
          cutoff: 3600,
          resonance: 3.8,
          attack: 0.002,
          decay: 0.12,
          sustain: 0.1,
          release: 0.22,
          unison: 1,
          detune: 2,
          fx: {
            ...fx,
            distortion: 0.62,
            saturation: 0.48,
            chorus: 0.04,
            reverb: 0.08,
          },
        },
        "Glass Horizon": {
          wave: "triangle",
          osc2Wave: "sine",
          osc2Mix: 0.3,
          cutoff: 6800,
          resonance: 1.5,
          attack: 0.005,
          decay: 0.42,
          sustain: 0.24,
          release: 0.9,
          unison: 2,
          detune: 7,
          fx: {
            ...fx,
            distortion: 0.14,
            saturation: 0.18,
            chorus: 0.38,
            delay: 0.34,
            reverb: 0.42,
          },
        },
      },
      bass: {
        "Foundry Pulse": {
          wave: "square",
          osc2Wave: "sine",
          osc2Mix: 0.28,
          cutoff: 900,
          resonance: 6,
          attack: 0.008,
          decay: 0.08,
          sustain: 0.78,
          release: 0.14,
        },
        "Black Reactor": {
          wave: "sawtooth",
          osc2Wave: "square",
          osc2Mix: 0.18,
          cutoff: 560,
          resonance: 9,
          attack: 0.012,
          decay: 0.16,
          sustain: 0.68,
          release: 0.28,
        },
        "Grind Theory": {
          wave: "square",
          osc2Wave: "sawtooth",
          osc2Mix: 0.4,
          cutoff: 1450,
          resonance: 3,
          attack: 0.005,
          decay: 0.05,
          sustain: 0.9,
          release: 0.09,
        },
      },
      pad: {
        Afterlight: {
          wave: "triangle",
          osc2Wave: "sawtooth",
          osc2Mix: 0.18,
          cutoff: 2400,
          attack: 0.45,
          decay: 0.65,
          sustain: 0.8,
          release: 1.8,
        },
        "Frozen Cathedral": {
          wave: "sine",
          osc2Wave: "triangle",
          osc2Mix: 0.45,
          cutoff: 1800,
          attack: 0.8,
          decay: 1.1,
          sustain: 0.72,
          release: 2.6,
        },
        "Signal Ghost": {
          wave: "sawtooth",
          osc2Wave: "sine",
          osc2Mix: 0.3,
          cutoff: 3300,
          attack: 0.25,
          decay: 0.5,
          sustain: 0.58,
          release: 2.2,
        },
      },
      drums: {
        "Titan Frame": {
          volume: 0.8,
          pan: 0,
          fx: { ...fx, distortion: 0.2, delay: 0.08, reverb: 0.16 },
        },
        "Riot Assembly": {
          volume: 0.88,
          pan: 0,
          fx: { ...fx, distortion: 0.48, delay: 0.04, reverb: 0.1 },
        },
        "Chrome Bones": {
          volume: 0.72,
          pan: -0.05,
          fx: { ...fx, distortion: 0.12, delay: 0.2, reverb: 0.34 },
        },
      },
    },
    patch = bank[track][name] || {},
    { fx: fxPatch, ...instrument } = patch;
  Object.assign(c, instrumentSettings(track, { ...c, ...instrument }));
  if (fxPatch) Object.assign(fx, fxPatch);
  c.preset = name;
}

export function renderArp(ctx: RuntimeContext) {
  const { arp, lfo } = ctx.clip().character as any,
    $panel = ctx.$(".arp-rack");
  $panel.classList.toggle("disabled", ctx.selectedTrack === "drums");
  ctx.$("#arpEnabled").checked = arp.enabled;
  ctx.$("#arpMode").value = arp.mode;
  ctx.$("#arpOctaves").value = arp.octaves;
  ctx.$("#arpRate").value = arp.rate;
  ctx.$("#lfoEnabled").checked = lfo.enabled;
  ctx.$("#lfoTarget").value = lfo.target;
  ctx.$("#lfoRate").value = lfo.rate;
  ctx.$("#lfoDepth").value = lfo.depth;
  ctx.$("#arpEnabled").onchange = () => {
    ctx.snapshot();
    arp.enabled = ctx.$("#arpEnabled").checked;
    ctx.changed();
  };
  for (const [id, key, number] of [
    ["#arpMode", "mode"],
    ["#arpOctaves", "octaves", true],
    ["#arpRate", "rate", true],
  ] as any[])
    ctx.$(id).onchange = () => {
      ctx.snapshot();
      arp[key] = number ? +ctx.$(id).value : ctx.$(id).value;
      ctx.changed();
    };
  ctx.$("#lfoEnabled").onchange = () => {
    ctx.snapshot();
    lfo.enabled = ctx.$("#lfoEnabled").checked;
    ctx.changed();
  };
  ctx.$("#lfoTarget").onchange = () => {
    ctx.snapshot();
    lfo.target = ctx.$("#lfoTarget").value;
    ctx.changed();
  };
  for (const [id, key] of [
    ["#lfoRate", "rate"],
    ["#lfoDepth", "depth"],
  ] as any[]) {
    ctx.$(id).onpointerdown = ctx.snapshot;
    ctx.$(id).oninput = () => {
      lfo[key] = +ctx.$(id).value;
      ctx.engine.setProject(ctx.project);
    };
    ctx.$(id).onchange = () => ctx.changed();
  }
}

export function renderFx(ctx: RuntimeContext) {
  const fx = ctx.clip().character.fx,
    defs = [
      ["saturation", msg("ui_33d2f0e12f33")],
      ["distortion", msg("ui_fb10936fdc8d")],
      ["chorus", "CHORUS"],
      ["delay", msg("ui_9b4c7ae55432")],
      ["reverb", "REVERB"],
      ["tone", msg("ui_64cf59efb177")],
    ];
  ctx.$("#fxBypass").setAttribute("aria-pressed", fx.bypass);
  ctx.$("#fxBypass").classList.toggle("active", fx.bypass);
  ctx.$("#fxBypass").onclick = () => {
    ctx.snapshot();
    fx.bypass = !fx.bypass;
    ctx.changed();
    ctx.renderFx();
    ctx.installControlHelp();
  };
  ctx.$("#fxControls").innerHTML = defs
    .map((entry: any) => {
      const [key, label] = entry;
      return `<label class="fx-unit"><span>${label}</span><input type="range" data-fx="${key}" min="0" max="1" step=".01" value="${fx[key]}"><output>${Math.round(fx[key] * 100)}</output></label>`;
    })
    .join("");
  ctx.$$("#fxControls input").forEach((i) => {
    i.onpointerdown = ctx.snapshot;
    i.oninput = () => {
      fx[i.dataset.fx] = +i.value;
      i.nextElementSibling.textContent = Math.round(i.value * 100);
      ctx.engine.setProject(ctx.project);
    };
    i.onchange = () => ctx.changed();
  });
}

export function macroMarkup(ctx: RuntimeContext, container: any) {
  const macros = ctx.clip().character.macros,
    names: Record<string, string> = {
      energy: msg("ui_b3eb6065b291"),
      darkness: msg("ui_78df318c1153"),
      tension: msg("ui_6f56dc8387d8"),
      aggression: msg("ui_1ded99254ce1"),
      space: msg("ui_6a395052c9eb"),
      complexity: msg("ui_cfdcc4a81b80"),
    };
  container.innerHTML = (Object.entries(macros) as Array<[string, number]>)
    .map(
      ([k, v]) =>
        `<div class="macro"><label><span>${names[k] || k.toUpperCase()}</span><output>${Math.round(v * 100)}</output></label><input data-macro="${k}" aria-label="${names[k] || k.toUpperCase()}" type="range" min="0" max="1" step=".01" value="${v}"></div>`,
    )
    .join("");
  container.querySelectorAll("input").forEach((i: any) => {
    i.onpointerdown = ctx.snapshot;
    i.oninput = () => {
      macros[i.dataset.macro] = +i.value;
      i.closest(".macro").querySelector("output").textContent = Math.round(
        i.value * 100,
      );
      ctx.engine.setProject(ctx.project);
      ctx.recordPerformanceEvent(
        "macro",
        `${ctx.clip().id}:${i.dataset.macro}`,
        +i.value,
      );
      ctx.updateOrb();
    };
    i.onchange = () => ctx.changed();
  });
}

export function renderClipControls(ctx: RuntimeContext) {
  const c = ctx.clip(),
    trackClips = clipsForTrack(ctx.project, ctx.selectedTrack);
  ctx.$("#clipSelect").innerHTML = trackClips
    .map(
      (x) =>
        `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${ctx.esc(x.name)} · ${x.bars} bars</option>`,
    )
    .join("");
  ctx.$("#deleteClipBtn").disabled = trackClips.length <= 1;
  ctx.$("#barsSelect").value = c.bars;
  ctx.$("#gridSelect").value = ctx.project.editor.snap;
  ctx.$("#zoomRange").value = ctx.project.editor.zoom;
  ctx.$("#clipSelect").onchange = () => {
    ctx.project.activeClipIds[ctx.selectedTrack] = ctx.$("#clipSelect").value;
    ctx.selectedNotes.clear();
    ctx.changed(true);
    ctx.setDefaultScroll();
  };
  ctx.$("#barsSelect").onchange = () => {
    ctx.snapshot();
    resizeClip(c, +ctx.$("#barsSelect").value);
    ctx.selectedNotes.clear();
    ctx.changed(true);
  };
  ctx.$("#gridSelect").onchange = () => {
    ctx.project.editor.snap = +ctx.$("#gridSelect").value;
    ctx.changed();
    ctx.renderPiano();
  };
  ctx.$("#zoomRange").oninput = () => {
    ctx.project.editor.zoom = +ctx.$("#zoomRange").value;
    ctx.renderPiano();
    ctx.renderAutomation();
  };
  ctx.$("#zoomRange").onchange = () => ctx.changed();
  ctx.$("#renameClipBtn").onclick = async () => {
    const name = await requestText(msg("ui_4c7e8e317991"), c.name);
    if (name?.trim()) {
      ctx.snapshot();
      c.name = name.trim();
      ctx.changed(true);
      ctx.toast(translate("Clip renamed", "Clip renombrado"), true);
    }
  };
  ctx.$("#deleteClipBtn").onclick = () => ctx.requestClipDelete(c.id);
}

export function renderHarmony(ctx: RuntimeContext) {
  ctx.$("#keySelect").innerHTML = KEYS.map(
    (k) => `<option ${k === ctx.project.key ? "selected" : ""}>${k}</option>`,
  ).join("");
  ctx.$("#scaleSelect").innerHTML = Object.keys(SCALES)
    .map(
      (s) =>
        `<option value="${s}" ${s === ctx.project.scale ? "selected" : ""}>${s.replace(/([A-Z])/g, " $1").toUpperCase()}</option>`,
    )
    .join("");
  ctx.$("#keySelect").onchange = () => {
    ctx.snapshot();
    ctx.project.key = ctx.$("#keySelect").value;
    ctx.changed(true);
  };
  ctx.$("#scaleSelect").onchange = () => {
    ctx.snapshot();
    ctx.project.scale = ctx.$("#scaleSelect").value;
    ctx.changed(true);
  };
  ctx.$$("[data-generate]").forEach((b) => {
    const type = b.dataset.generate;
    b.disabled =
      (ctx.selectedTrack === "drums" && type !== "drums") ||
      (ctx.selectedTrack !== "drums" && type === "drums");
    b.onclick = () => {
      ctx.snapshot();
      generateClip(
        ctx.project,
        ctx.clip(),
        type,
        ctx.clip().character.macros.complexity,
      );
      ctx.selectedNotes.clear();
      ctx.changed(true);
      ctx.toast(msg("ui_da6f4ae6c4e2"), true);
    };
  });
  ctx.$("#quantizeBtn").onclick = () => {
    ctx.snapshot();
    quantizeClip(ctx.clip(), ctx.project.editor.snap);
    ctx.changed(true);
    ctx.toast(msg("ui_3e0de03899f6"), true);
  };
}

export function updateOrb(ctx: RuntimeContext) {
  const macros = ctx.clip().character.macros,
    o = ctx.$("#performanceOrb");
  o.style.transform = `scale(${0.9 + macros.energy * 0.12})`;
  o.style.filter = `saturate(${0.7 + macros.tension}) brightness(${0.8 + macros.space * 0.35})`;
}

export function formatLocator(ctx: RuntimeContext, step: number) {
  const bar = meterSteps(ctx.project.meter),
    seconds = (step * 60) / ctx.project.tempo / 4;
  return `${msg("ui_a5d5c1bba91f")} ${Math.floor(step / bar) + 1} · ${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function userPresets(ctx: RuntimeContext): UserPreset[] {
  try {
    return JSON.parse(localStorage.getItem(ctx.USER_PRESETS) || "[]");
  } catch {
    return [];
  }
}

export function saveUserPresets(ctx: RuntimeContext, items: UserPreset[]) {
  localStorage.setItem(ctx.USER_PRESETS, JSON.stringify(items));
}

export function renderPresetLibrary(ctx: RuntimeContext) {
  const query = String(ctx.$("#presetSearch").value || "").toLowerCase(),
    favorites = ctx.presetFavorites(),
    builtins = TRACKS.flatMap((track) =>
      ctx.presets[track].map((name) => ({
        id: `builtin:${track}:${name}`,
        name,
        track,
        tags: ["factory", track],
      })),
    ),
    users = ctx.userPresets(),
    items = [...builtins, ...users].filter((item) =>
      `${item.name} ${item.track} ${item.tags.join(" ")}`
        .toLowerCase()
        .includes(query),
    );
  ctx.$("#presetLibrary").innerHTML = items
    .map(
      (item) =>
        `<article class="preset-card" data-preset-id="${ctx.esc(item.id)}"><span><b>${ctx.esc(item.name)}</b><small>${item.track.toUpperCase()} · ${item.tags.map((tag) => tag.toUpperCase()).join(" · ")}</small></span><button class="favorite" data-preset-favorite aria-pressed="${favorites.has(item.id)}">${favorites.has(item.id) ? "★" : "☆"}</button><button data-preset-load>LOAD</button>${item.id.startsWith("builtin:") ? "" : "<button data-preset-delete>×</button>"}</article>`,
    )
    .join("");
  ctx.$$("[data-preset-id]").forEach((card) => {
    const item = items.find(
      (candidate) => candidate.id === card.dataset.presetId,
    )!;
    card.querySelector("[data-preset-load]").onclick = () => {
      ctx.snapshot();
      ctx.selectedTrack = item.track;
      if (item.id.startsWith("builtin:"))
        ctx.applyPreset(item.track, item.name);
      else {
        activeClip(ctx.project, item.track).instrument = instrumentSettings(
          item.track,
          (item as UserPreset).instrument,
        );
        activeClip(ctx.project, item.track).character = structuredClone(
          (item as UserPreset).character,
        );
      }
      ctx.changed(true);
      ctx.$("#presetDialog").close();
      ctx.toast(msg("ui_21b2de1d3e5c"));
    };
    card.querySelector("[data-preset-favorite]").onclick = () => {
      const next = ctx.presetFavorites();
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      localStorage.setItem(ctx.PRESET_FAVORITES, JSON.stringify([...next]));
      ctx.renderPresetLibrary();
    };
    const remove = card.querySelector("[data-preset-delete]");
    if (remove)
      remove.onclick = () => {
        ctx.saveUserPresets(
          ctx.userPresets().filter((candidate) => candidate.id !== item.id),
        );
        ctx.renderPresetLibrary();
      };
  });
}

export async function saveCurrentPreset(ctx: RuntimeContext) {
  const result = await requestFields({
    title: msg("ui_eb39e1d78db8"),
    fields: [
      {
        name: "name",
        label: msg("ui_eb39e1d78db8"),
        value: `${TRACK_META[ctx.selectedTrack].label} CUSTOM`,
      },
      {
        name: "tags",
        label: msg("ui_f8a4793ff7ad"),
        value: "custom, cinematic",
        required: false,
      },
    ],
  });
  if (!result) return;
  const items = ctx.userPresets();
  items.push({
    id: crypto.randomUUID(),
    name: result.name!,
    track: ctx.selectedTrack,
    tags: result
      .tags!.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    instrument: structuredClone(ctx.clip().instrument),
    character: structuredClone(ctx.clip().character),
  });
  ctx.saveUserPresets(items);
  ctx.renderPresetLibrary();
  ctx.toast(translate("Preset saved", "Preset guardado"));
}

export async function loadLocalSample(ctx: RuntimeContext, asset: SampleAsset) {
  const blob = await ctx.getAsset(asset.id);
  if (!blob) {
    ctx.toast(`${DRUM_NAMES[asset.slot]} · ${msg("ui_bfe4c8a80f66")}`);
    return;
  }
  await ctx.engine.setDrumSample(asset.slot, await blob.arrayBuffer(), asset);
}

export async function loadLocalSamples(ctx: RuntimeContext) {
  for (const slot of ctx.engine.drumSamples.keys())
    if (!ctx.project.samples.some((asset: SampleAsset) => asset.slot === slot))
      ctx.engine.clearDrumSample(slot);
  for (const asset of ctx.project.samples)
    try {
      await ctx.loadLocalSample(asset);
    } catch {}
}

export function renderSampleSlots(ctx: RuntimeContext) {
  ctx.$("#sampleSlots").innerHTML = DRUM_NAMES.map((name, slot) => {
    const asset = ctx.project.samples.find(
      (item: SampleAsset) => item.slot === slot,
    );
    return `<article class="sample-slot" data-sample-slot="${slot}"><b>${name}</b><label class="file-button">${asset ? ctx.esc(asset.name) : "LOAD WAV/MP3"}<input data-sample-file type="file" accept="audio/*"></label><label>START<input data-sample-setting="trimStart" type="range" min="0" max=".95" step=".01" value="${asset?.trimStart ?? 0}"></label><label>END<input data-sample-setting="trimEnd" type="range" min=".05" max="1" step=".01" value="${asset?.trimEnd ?? 1}"></label><label>TUNE<input data-sample-setting="tune" type="number" min="-24" max="24" step="1" value="${asset?.tune ?? 0}"></label><label>ATTACK<input data-sample-setting="attack" type="number" min="0" max="1" step=".001" value="${asset?.attack ?? 0.002}"></label><label>RELEASE<input data-sample-setting="release" type="number" min=".005" max="3" step=".005" value="${asset?.release ?? 0.08}"></label><label>REVERSE<input data-sample-setting="reverse" type="checkbox" ${asset?.reverse ? "checked" : ""}></label><button data-sample-remove ${asset ? "" : "disabled"}>×</button></article>`;
  }).join("");
  ctx.$$("[data-sample-slot]").forEach((row) => {
    const slot = +row.dataset.sampleSlot,
      file = row.querySelector("[data-sample-file]");
    file.onchange = async () => {
      const blob = file.files?.[0];
      if (!blob) return;
      const asset: SampleAsset = {
        id: `sample-${crypto.randomUUID()}`,
        name: blob.name,
        slot,
        size: blob.size,
        type: blob.type || "audio/wav",
        trimStart: 0,
        trimEnd: 1,
        tune: 0,
        attack: 0.002,
        release: 0.08,
        reverse: false,
      };
      await ctx.putAsset(asset.id, blob);
      await ctx.loadLocalSample(asset);
      ctx.snapshot();
      ctx.project.samples = ctx.project.samples.filter(
        (item: SampleAsset) => item.slot !== slot,
      );
      ctx.project.samples.push(asset);
      ctx.changed();
      ctx.renderSampleSlots();
      ctx.toast(`${DRUM_NAMES[slot]} · ${msg("ui_11b10f65a93b")}`, true);
    };
    row.querySelectorAll("[data-sample-setting]").forEach(
      (input: any) =>
        (input.onchange = async () => {
          const asset = ctx.project.samples.find(
            (item: SampleAsset) => item.slot === slot,
          );
          if (!asset) return;
          ctx.snapshot();
          const key = input.dataset.sampleSetting;
          asset[key] = input.type === "checkbox" ? input.checked : +input.value;
          if (asset.trimEnd <= asset.trimStart)
            asset.trimEnd = Math.min(1, asset.trimStart + 0.05);
          await ctx.loadLocalSample(asset);
          ctx.changed();
          ctx.renderSampleSlots();
        }),
    );
    row.querySelector("[data-sample-remove]").onclick = async () => {
      const asset = ctx.project.samples.find(
        (item: SampleAsset) => item.slot === slot,
      );
      if (!asset) return;
      // Keep asset bytes available to Undo and existing recovery snapshots.
      ctx.snapshot();
      ctx.project.samples = ctx.project.samples.filter(
        (item: SampleAsset) => item.id !== asset.id,
      );
      ctx.engine.clearDrumSample(slot);
      ctx.changed();
      ctx.renderSampleSlots();
      ctx.toast(translate("Sample removed", "Muestra retirada"), true);
    };
  });
}

export function setupSampleSlicing(ctx: RuntimeContext) {
  const decorate = () =>
    ctx.$$("[data-sample-slot]").forEach((row) => {
      const slot = +row.dataset.sampleSlot,
        asset = ctx.project.samples.find(
          (item: SampleAsset) => item.slot === slot,
        );
      if (!asset || row.querySelector("[data-slice-sample]")) return;
      const button = document.createElement("button");
      button.dataset.sliceSample = "";
      button.textContent = asset.slices?.length
        ? `${asset.slices.length} SLICES`
        : "AUTO SLICE";
      button.onclick = async () => {
        const blob = await ctx.getAsset(asset.id);
        if (!blob) return;
        await ctx.engine.init();
        const count = await requestNumber(msg("ui_e47eb6a3d68a"), 8, 2, 16);
        if (count === null) return;
        const buffer = await ctx.engine.ctx.decodeAudioData(
            await blob.arrayBuffer(),
          ),
          points = detectTransientSlices(buffer.getChannelData(0), count),
          pairs = points
            .slice(0, -1)
            .map((start, index) => ({ start, end: points[index + 1]! })),
          empty = DRUM_NAMES.map((_, index) => index).filter(
            (index) =>
              !ctx.project.samples.some(
                (sample: SampleAsset) => sample.slot === index,
              ) || index === slot,
          );
        ctx.snapshot();
        asset.slices = pairs.map((pair, index) => ({
          id: cryptoId(),
          name: `${asset.name} ${index + 1}`,
          start: pair.start,
          end: pair.end,
          rootNote: 36 + index,
        }));
        for (
          let index = 0;
          index < Math.min(pairs.length, empty.length);
          index++
        ) {
          const target = empty[index]!,
            pair = pairs[index]!,
            id = index === 0 ? asset.id : `sample-${cryptoId()}`;
          if (index > 0) await ctx.putAsset(id, blob);
          const sliced: SampleAsset = {
            ...structuredClone(asset),
            id,
            slot: target,
            name: `${asset.name} · ${index + 1}`,
            trimStart: pair.start,
            trimEnd: pair.end,
            slices: [],
          };
          ctx.project.samples = ctx.project.samples.filter(
            (sample: SampleAsset) => sample.slot !== target,
          );
          ctx.project.samples.push(sliced);
        }
        ctx.changed();
        await ctx.loadLocalSamples();
        ctx.renderSampleSlots();
        ctx.toast(`${pairs.length} ${msg("ui_68bc1de7533d")}`);
      };
      row.append(button);
    });
  new window.MutationObserver(decorate).observe(ctx.$("#sampleSlots"), {
    childList: true,
  });
  decorate();
}
