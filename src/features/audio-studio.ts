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

export function renderAutomation(ctx: RuntimeContext) {
  const c = ctx.clip(),
    steps = clipLengthSteps(c),
    zoom = ctx.project.editor.zoom,
    param = ctx.project.editor.automationParam,
    lane: any = (c.automation as any)[param];
  ctx.$("#automationParam").value = param;
  const el = ctx.$("#automationLane");
  el.style.width = `${steps * zoom}px`;
  el.innerHTML =
    Array.from({ length: steps }, (_, s) => {
      const value = automationValue(c, param, s, 0.5),
        point = lane[s] != null;
      return `<i class="automation-step ${point ? "point" : ""}" style="left:${s * zoom}px;width:${zoom}px;--value:${value}" data-step="${s}"></i>`;
    }).join("") +
    `<div class="automation-playhead" style="left:${Math.max(0, ctx.currentStep % steps) * zoom}px"></div>`;
  const draw = (e: any) => {
    const rect = el.getBoundingClientRect(),
      step = Math.max(
        0,
        Math.min(
          steps - 1,
          Math.round((e.clientX - rect.left) / zoom / ctx.project.editor.snap) *
            ctx.project.editor.snap,
        ),
      ),
      value = Math.max(
        0,
        Math.min(1, 1 - (e.clientY - rect.top) / rect.height),
      );
    lane[step] = value;
    ctx.renderAutomation();
    ctx.engine.setProject(ctx.project);
  };
  el.onpointerdown = (e: any) => {
    ctx.snapshot();
    draw(e);
    const move = (ev: any) => draw(ev),
      up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        ctx.changed();
      };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  ctx.$("#automationPane").scrollLeft = ctx.$("#rollPane").scrollLeft;
}

export async function addAudioBlob(
  ctx: RuntimeContext,
  blob: Blob,
  name = "",
  lane?: AudioLane,
) {
  await ctx.engine.init();
  const resolvedName =
      name || (blob as Blob & { name?: string }).name || "Recorded signal.wav",
    id = `audio-${cryptoId()}`,
    duration = await ctx.engine.setAudioAsset(id, await blob.arrayBuffer());
  await ctx.putAsset(id, blob);
  ctx.snapshot();
  const targetLane: AudioLane =
      lane ||
      ctx.project.audioLanes[0] ||
      (ctx.project.audioLanes[0] = createAudioLane()),
    steps = Math.max(
      1,
      Math.round((duration / (60 / ctx.project.tempo / 4)) * 4) / 4,
    ),
    end = Math.max(
      0,
      ...targetLane.regions.map(
        (region: AudioRegion) => region.startStep + region.lengthSteps,
      ),
    );
  targetLane.regions.push(
    createAudioRegion(id, resolvedName, end, steps, duration),
  );
  ctx.changed();
  ctx.renderAudioStudio();
  ctx.toast(msg("ui_d16fb4810603"), true);
}

export function renderAudioStudio(ctx: RuntimeContext) {
  const root = ctx.$("#audioLanes");
  if (!root) return;
  root.innerHTML = ctx.project.audioLanes.length
    ? ctx.project.audioLanes
        .map(
          (lane: AudioLane) =>
            `<article class="audio-lane" data-audio-lane="${lane.id}" style="--lane:${lane.color}"><header class="audio-lane-head"><input data-lane-name type="text" value="${ctx.esc(lane.name)}" aria-label="Lane name"><button data-lane-solo class="${lane.solo ? "on" : ""}" aria-pressed="${lane.solo}">S</button><button data-lane-mute class="${lane.mute ? "on" : ""}" aria-pressed="${lane.mute}">M</button><label>VOL<input data-lane-value="volume" type="range" min="0" max="1.5" step=".01" value="${lane.volume}"><output>${Math.round(lane.volume * 100)}</output></label><label>PAN<input data-lane-value="pan" type="range" min="-1" max="1" step=".01" value="${lane.pan}"><output>${Math.round(lane.pan * 100)}</output></label><button data-lane-delete>DELETE LANE</button></header><div class="audio-track">${lane.regions.map((region: AudioRegion) => `<article class="audio-region" data-audio-region="${region.id}" style="--length:${region.lengthSteps}"><header><b>${ctx.esc(region.name)}</b><span class="audio-region-actions"><button data-region-scratch title="${msg("ui_b8d4449690b8")}">${msg("ui_ae1e5c33dddc")}</button><button data-region-delete title="${msg("ui_d2341bd7e5a2")}">×</button></span></header><div class="mini-wave"></div><div class="audio-region-controls"><label>START<input data-region-key="startStep" type="number" min="0" step=".25" value="${region.startStep}"></label><label>LENGTH<input data-region-key="lengthSteps" type="number" min=".25" step=".25" value="${region.lengthSteps}"></label><label>OFFSET<input data-region-key="offsetSeconds" type="number" min="0" step=".01" value="${region.offsetSeconds.toFixed(2)}"></label><label>GAIN<input data-region-key="gainDb" type="number" min="-60" max="18" step=".5" value="${region.gainDb}"></label><label>FADE IN<input data-region-key="fadeInSteps" type="number" min="0" step=".25" value="${region.fadeInSteps}"></label><label>FADE OUT<input data-region-key="fadeOutSteps" type="number" min="0" step=".25" value="${region.fadeOutSteps}"></label><label>PITCH<input data-region-key="pitch" type="number" min="-24" max="24" step="1" value="${region.pitch}"></label><label>BPM<input data-region-key="sourceBpm" type="number" min="20" max="300" step=".1" value="${region.sourceBpm}"></label><label class="wide">WARP<select data-region-key="warp"><option value="0" ${!region.warp ? "selected" : ""}>OFF</option><option value="1" ${region.warp ? "selected" : ""}>TEMPO LOCK</option></select></label><label class="wide">MODE<select data-region-key="warpMode"><option value="repitch" ${region.warpMode === "repitch" ? "selected" : ""}>REPITCH</option><option value="stretch" ${region.warpMode === "stretch" ? "selected" : ""}>STRETCH PREVIEW</option></select></label></div></article>`).join("") || '<div class="audio-empty">DROP OR IMPORT AUDIO TO THIS LANE</div>'}</div></article>`,
        )
        .join("")
    : '<div class="audio-empty">IMPORT AUDIO OR CREATE A LANE TO START THE HYBRID ARRANGEMENT</div>';
  ctx.$$("[data-audio-lane]").forEach((row) => {
    const lane = ctx.project.audioLanes.find(
      (item: AudioLane) => item.id === row.dataset.audioLane,
    )!;
    row.querySelector("[data-lane-name]").onchange = (event: any) => {
      ctx.snapshot();
      lane.name = event.target.value || lane.name;
      ctx.changed();
    };
    row.querySelector("[data-lane-solo]").onclick = () => {
      ctx.snapshot();
      lane.solo = !lane.solo;
      ctx.changed();
      ctx.renderAudioStudio();
    };
    row.querySelector("[data-lane-mute]").onclick = () => {
      ctx.snapshot();
      lane.mute = !lane.mute;
      ctx.changed();
      ctx.renderAudioStudio();
    };
    row
      .querySelectorAll("[data-lane-value]")
      .forEach((input: HTMLInputElement) => {
        let editing = false;
        input.oninput = () => {
          if (!editing) {
            ctx.snapshot();
            editing = true;
          }
          (lane as any)[input.dataset.laneValue!] = +input.value;
          input.closest("label")!.querySelector("output")!.textContent = String(
            Math.round(+input.value * 100),
          );
          ctx.engine.setProject(ctx.project);
        };
        input.onchange = () => {
          editing = false;
          ctx.changed();
        };
      });
    row.querySelector("[data-lane-delete]").onclick = async () => {
      if (
        !(await requestConfirmation(
          translate("Delete audio lane", "Borrar pista de audio"),
          msg("ui_71c68ac6982e"),
        ))
      )
        return;
      ctx.snapshot();
      ctx.project.audioLanes = ctx.project.audioLanes.filter(
        (item: AudioLane) => item.id !== lane.id,
      );
      ctx.changed();
      ctx.renderAudioStudio();
      ctx.toast(
        translate("Audio lane deleted", "Pista de audio borrada"),
        true,
      );
    };
    row.querySelectorAll("[data-audio-region]").forEach((card: any) => {
      const region = lane.regions.find(
        (item: AudioRegion) => item.id === card.dataset.audioRegion,
      )!;
      card.querySelectorAll("[data-region-key]").forEach(
        (input: any) =>
          (input.onchange = () => {
            ctx.snapshot();
            const key = input.dataset.regionKey;
            (region as any)[key] =
              key === "warp"
                ? input.value === "1"
                : key === "warpMode"
                  ? input.value
                  : +input.value;
            if (region.offsetSeconds >= region.durationSeconds)
              region.offsetSeconds = Math.max(0, region.durationSeconds - 0.01);
            ctx.changed();
            ctx.renderAudioStudio();
          }),
      );
      card.querySelector("[data-region-scratch]").onclick = (event: Event) =>
        ctx.loadAudioRegionIntoScratch(
          lane,
          region,
          event.currentTarget as HTMLButtonElement,
        );
      card.querySelector("[data-region-delete]").onclick = async () => {
        ctx.snapshot();
        lane.regions = lane.regions.filter(
          (item: AudioRegion) => item.id !== region.id,
        );
        // Audio bytes remain available to Undo and saved recovery versions.
        ctx.changed();
        ctx.renderAudioStudio();
        ctx.toast(
          translate("Audio region deleted", "Región de audio borrada"),
          true,
        );
      };
    });
  });
  ctx.renderGlobalAutomation();
  ctx.installControlHelp();
}

export function renderGlobalAutomation(ctx: RuntimeContext) {
  const root = ctx.$("#globalAutomation");
  if (!root) return;
  root.innerHTML =
    [
      ...(ctx.project.automationLanes || []).map(
        (lane: AutomationLane) =>
          `<article class="automation-card" data-global-auto="${lane.id}"><b>${ctx.esc(lane.name)}</b><button data-auto-delete>×</button><small>${lane.target} · ${lane.points.length} POINTS · ${lane.writeMode.toUpperCase()}</small><button data-auto-point>＋ POINT</button></article>`,
      ),
      ...(ctx.project.modulationRoutes || []).map(
        (route: ModulationRoute) =>
          `<article class="modulation-card" data-mod-route="${route.id}"><b>${route.source.toUpperCase()} → ${ctx.esc(route.target)}</b><button data-mod-delete>×</button><small>AMOUNT ${Math.round(route.amount * 100)}% · ${route.rate.toFixed(2)} Hz</small><input data-mod-amount type="range" min="-1" max="1" step=".01" value="${route.amount}"></article>`,
      ),
    ].join("") || "<small>NO GLOBAL AUTOMATION OR MODULATION ROUTES</small>";
  ctx.$$("[data-global-auto]").forEach((card) => {
    const lane = ctx.project.automationLanes.find(
      (item: AutomationLane) => item.id === card.dataset.globalAuto,
    )!;
    card.querySelector("[data-auto-delete]").onclick = () => {
      ctx.snapshot();
      ctx.project.automationLanes = ctx.project.automationLanes.filter(
        (item: AutomationLane) => item.id !== lane.id,
      );
      ctx.changed();
      ctx.renderGlobalAutomation();
      ctx.toast(
        translate("Automation deleted", "Automatización borrada"),
        true,
      );
    };
    card.querySelector("[data-auto-point]").onclick = async () => {
      const result = await requestFields({
        title: translate(
          "Add automation point",
          "Añadir punto de automatización",
        ),
        fields: [
          {
            name: "step",
            label: msg("ui_dc416e1088e4"),
            type: "number",
            value: 0,
            min: 0,
            step: 0.25,
          },
          {
            name: "value",
            label: msg("ui_fb6ba8f57833"),
            type: "number",
            value: 0.5,
            min: 0,
            max: 1,
            step: 0.01,
          },
        ],
      });
      if (!result) return;
      const step = Number(result.step),
        value = Number(result.value);
      ctx.snapshot();
      lane.points.push({
        id: cryptoId(),
        step: Math.max(0, step),
        value: Math.max(0, Math.min(1, value)),
        curve: "smooth",
      });
      ctx.changed();
      ctx.renderGlobalAutomation();
    };
  });
  ctx.$$("[data-mod-route]").forEach((card) => {
    const route = ctx.project.modulationRoutes.find(
      (item: ModulationRoute) => item.id === card.dataset.modRoute,
    )!;
    card.querySelector("[data-mod-delete]").onclick = () => {
      ctx.snapshot();
      ctx.project.modulationRoutes = ctx.project.modulationRoutes.filter(
        (item: ModulationRoute) => item.id !== route.id,
      );
      ctx.changed();
      ctx.renderGlobalAutomation();
      ctx.toast(translate("Modulation deleted", "Modulación borrada"), true);
    };
    let editing = false;
    card.querySelector("[data-mod-amount]").oninput = (event: any) => {
      if (!editing) {
        ctx.snapshot();
        editing = true;
      }
      route.amount = +event.target.value;
      ctx.engine.setProject(ctx.project);
    };
    card.querySelector("[data-mod-amount]").onchange = () => {
      editing = false;
      ctx.changed();
      ctx.renderGlobalAutomation();
    };
  });
}

export function setupV6Studio(ctx: RuntimeContext) {
  const scale = localStorage.getItem("kiber-vengance-ui-scale-v1") || "1";
  document.documentElement.style.setProperty("--ui-scale", scale);
  ctx.$("#uiScale").value = scale;
  ctx.$("#uiScale").onchange = () => {
    localStorage.setItem("kiber-vengance-ui-scale-v1", ctx.$("#uiScale").value);
    document.documentElement.style.setProperty(
      "--ui-scale",
      ctx.$("#uiScale").value,
    );
  };
  ctx.$("#audioLaneBtn").onclick = () => {
    ctx.snapshot();
    ctx.project.audioLanes.push(
      createAudioLane(
        `AUDIO ${ctx.project.audioLanes.length + 1}`,
        ["#2ee8ff", "#ff3bd4", "#a7ff5b", "#ff9f43"][
          ctx.project.audioLanes.length % 4
        ],
      ),
    );
    ctx.changed();
    ctx.renderAudioStudio();
  };
  ctx.$("#audioImport").onchange = async (event: any) => {
    for (const file of Array.from(event.target.files || []) as File[])
      await ctx.addAudioBlob(file);
    event.target.value = "";
  };
  ctx.$("#audioRecordBtn").onclick = async () => {
    const button = ctx.$("#audioRecordBtn");
    if (ctx.inputRecorder?.state === "recording") {
      ctx.inputRecorder.stop();
      button.classList.remove("active");
      button.textContent = msg("ui_5a4f7e54c5ac");
      return;
    }
    try {
      ctx.inputStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      ctx.inputChunks = [];
      ctx.inputRecorder = new MediaRecorder(ctx.inputStream);
      ctx.inputRecorder.ondataavailable = (event) => {
        if (event.data.size) ctx.inputChunks.push(event.data);
      };
      ctx.inputRecorder.onstop = async () => {
        ctx.inputStream?.getTracks().forEach((track) => track.stop());
        await ctx.addAudioBlob(
          new Blob(ctx.inputChunks, {
            type: ctx.inputRecorder?.mimeType || "audio/webm",
          }),
          `Input ${new Date().toLocaleTimeString()}.webm`,
        );
      };
      ctx.inputRecorder.start(250);
      button.classList.add("active");
      button.textContent = msg("ui_ee0d9dc8eb5e");
    } catch (error) {
      ctx.toast(
        `${msg("ui_9ed236059e64")}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  ctx.$("#audioScratchBtn").onclick = async () => {
    if (!ctx.scratchBuffer) {
      ctx.toast(msg("ui_a2ebb6e932e4"));
      return;
    }
    await ctx.addAudioBlob(
      ctx.audioBufferWav(ctx.scratchBuffer),
      "Scratch resample.wav",
    );
  };
  ctx.$("#automationLaneBtn").onclick = () => {
    ctx.snapshot();
    const target = ctx.$("#automationTarget").value,
      lane = createAutomationLane(
        target,
        target.replace(/[._]/g, " ").toUpperCase(),
      );
    lane.writeMode = ctx.$("#automationWriteMode").value;
    lane.points = [
      { id: cryptoId(), step: 0, value: 0.5, curve: "smooth" },
      { id: cryptoId(), step: 64, value: 0.8, curve: "smooth" },
    ];
    ctx.project.automationLanes.push(lane);
    ctx.changed();
    ctx.renderGlobalAutomation();
  };
  ctx.$("#modulationBtn").onclick = () => {
    ctx.snapshot();
    ctx.project.modulationRoutes.push({
      id: cryptoId(),
      source: "lfo-1",
      target: ctx.$("#automationTarget").value,
      amount: 0.25,
      bipolar: true,
      rate: 0.5,
    });
    ctx.changed();
    ctx.renderGlobalAutomation();
  };
  ctx.$("#monoCheckBtn").onclick = () => {
    ctx.snapshot();
    ctx.project.masterSettings.monoCheck =
      !ctx.project.masterSettings.monoCheck;
    ctx.changed();
    ctx.renderMixer();
    ctx.renderMixGroups();
  };
  for (const id of ["masterTargetLufs", "masterCeiling"])
    ctx.$(`#${id}`).onchange = () => {
      ctx.snapshot();
      ctx.project.masterSettings[
        id === "masterTargetLufs" ? "targetLufs" : "ceilingDb"
      ] = +ctx.$(`#${id}`).value;
      ctx.changed();
      ctx.engine.setProject(ctx.project);
      ctx.renderMixGroups();
    };
  const tools = ctx.$(".generators");
  if (tools && !ctx.$("#transformNotes"))
    tools.insertAdjacentHTML(
      "beforeend",
      '<span id="transformNotes"><button data-transform="retrograde">REVERSE</button><button data-transform="invert">INVERT</button><button data-transform="double">×2</button><button data-transform="half">÷2</button><button data-transform="humanize">HUMANIZE</button></span>',
    );
  ctx.$$("[data-transform]").forEach(
    (button) =>
      (button.onclick = () => {
        ctx.snapshot();
        transformNotes(ctx.clip(), button.dataset.transform, 0.65);
        ctx.changed();
        ctx.renderPiano();
        ctx.toast(`TRANSFORM · ${button.dataset.transform.toUpperCase()}`);
      }),
  );
  const toolbar = ctx.$(".arrange-toolbar");
  if (toolbar && !ctx.$("#tempoEventBtn"))
    toolbar.insertAdjacentHTML(
      "beforeend",
      '<button id="tempoEventBtn">＋ TEMPO</button><button id="meterEventBtn">＋ METER</button>',
    );
  // Validated tempo/meter dialogs are bound by setupConsistentControls.
  ctx.loadAudioAssets();
}

export function setupV6Copy(ctx: RuntimeContext) {
  const sync = () => {
    const projectCopy = ctx.$(".export-choice:nth-child(3) span"),
      bundleCopy = ctx.$(".export-choice:nth-child(6) span");
    if (projectCopy) projectCopy.textContent = msg("ui_cfa0104e9374");
    if (bundleCopy) bundleCopy.textContent = msg("ui_f478c5ccc0c8");
  };
  sync();
  ctx.$("#languageSelect").addEventListener("change", sync);
  ctx.$("#menuLanguageSelect").addEventListener("change", sync);
}

export function setupV6Safety(ctx: RuntimeContext) {
  const syncScale = () =>
    ctx
      .$("#app")
      .classList.toggle(
        "ui-scaled",
        Math.abs(+ctx.$("#uiScale").value - 1) > 0.001,
      );
  syncScale();
  ctx.$("#uiScale").addEventListener("change", syncScale);
  ctx.$("#audioLanes").addEventListener(
    "change",
    (event: Event) => {
      const input = event.target as HTMLInputElement | HTMLSelectElement;
      if (!input.matches("[data-region-key]")) return;
      event.stopImmediatePropagation();
      const card = input.closest("[data-audio-region]") as HTMLElement,
        row = input.closest("[data-audio-lane]") as HTMLElement,
        lane = ctx.project.audioLanes.find(
          (item: AudioLane) => item.id === row.dataset.audioLane,
        ),
        region = lane?.regions.find(
          (item: AudioRegion) => item.id === card.dataset.audioRegion,
        );
      if (!region) return;
      const key = input.dataset.regionKey!;
      (region as any)[key] =
        key === "warp"
          ? input.value === "1"
          : key === "warpMode"
            ? input.value
            : +input.value;
      if (region.offsetSeconds >= region.durationSeconds)
        region.offsetSeconds = Math.max(0, region.durationSeconds - 0.01);
      ctx.changed();
      setTimeout(ctx.renderAudioStudio, 0);
    },
    true,
  );
}
