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

export function renderArrangement(ctx: RuntimeContext) {
  const options = (track: TrackId, id: string) =>
      clipsForTrack(ctx.project, track)
        .map(
          (c) =>
            `<option value="${c.id}" ${c.id === id ? "selected" : ""}>${ctx.esc(c.name)} · ${c.bars}b</option>`,
        )
        .join(""),
    { durationSteps } = playbackEvents(ctx.project, { song: true }),
    seconds = (durationSteps * 60) / ctx.project.tempo / 4;
  ctx.$("#songStats").textContent =
    ctx.language === "es"
      ? `${ctx.project.arrangement.length} SECCIONES · ${Math.ceil(durationSteps / meterSteps(ctx.project.meter))} COMPASES · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`
      : `${ctx.project.arrangement.length} SECTIONS · ${Math.ceil(durationSteps / meterSteps(ctx.project.meter))} BARS · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
  let timelineCursor = 0;
  ctx.$("#arrangeTimeline").innerHTML =
    ctx.project.arrangement
      .map((scene: any, index: number) => {
        const length = ctx.sceneLength(scene) * scene.repeats,
          start = timelineCursor;
        timelineCursor += length;
        return `<button data-timeline-start="${start}" data-timeline-scene="${index}" data-timeline-length="${length}" style="--scene-width:${Math.max(1, (length / durationSteps) * 100)}%"><b>${String(index + 1).padStart(2, "0")} · ${ctx.esc(scene.name)}</b><span>${Math.ceil(length / meterSteps(ctx.project.meter))} ${msg("ui_1b402ca81c1b")}</span></button>`;
      })
      .join("") +
    `<i class="arrange-playhead" style="left:${durationSteps ? (ctx.transportPosition / durationSteps) * 100 : 0}%"></i>`;
  ctx.$$("[data-timeline-start]").forEach(
    (button) =>
      (button.onclick = (event: MouseEvent) => {
        const rect = button.getBoundingClientRect(),
          offset = Math.floor(
            ((event.clientX - rect.left) / Math.max(1, rect.width)) *
              +button.dataset.timelineLength,
          );
        ctx.setGlobalStart(+button.dataset.timelineStart + offset);
        ctx.focusScene(+button.dataset.timelineScene);
      }),
  );
  ctx.$("#arrangement").innerHTML = ctx.project.arrangement
    .map(
      (s: any, i: number) =>
        `<article class="scene ${ctx.selectedScenes.has(i) ? "selected" : ""} ${ctx.currentScene === i && ctx.engine.playing ? "playing" : ""}" data-scene="${i}" tabindex="0"><div class="scene-top"><span class="drag-handle" draggable="true">⠿</span><input data-scene-name aria-label="${msg("ui_f2c6b564bd81")} ${i + 1}" value="${ctx.esc(s.name)}"><button data-action="remove" aria-label="${msg("ui_e7eaff78b315")} ${i + 1}" ${ctx.project.arrangement.length === 1 ? "disabled" : ""}>×</button></div><div class="scene-clips">${TRACKS.map((t) => `<label style="--track:${TRACK_META[t].color}"><span>${TRACK_META[t].label}</span><select data-scene-track="${t}">${options(t, s.clipIds[t])}</select></label>`).join("")}</div><div class="scene-bottom"><label class="scene-repeats"><span>${msg("ui_830d819ef9a5")}</span><input data-repeats type="number" min="1" max="16" value="${s.repeats}"></label><div class="scene-actions"><button data-action="left" aria-label="${msg("ui_f1e7f81f8b87")}" ${i === 0 ? "disabled" : ""}>←</button><button data-action="duplicate" aria-label="${msg("ui_2dc7e40019d0")}">⧉</button><button data-action="right" aria-label="${msg("ui_0d1132856d9d")}" ${i === ctx.project.arrangement.length - 1 ? "disabled" : ""}>→</button></div><em>${String(i + 1).padStart(2, "0")}</em></div></article>`,
    )
    .join("");
  ctx.$$(".scene").forEach((card) => {
    const i = +card.dataset.scene,
      s = ctx.project.arrangement[i];
    card.querySelector("[data-scene-name]").onchange = (e: any) => {
      ctx.snapshot();
      s.name = e.target.value.trim() || `SECTION ${i + 1}`;
      ctx.changed();
    };
    card.querySelector("[data-repeats]").onchange = (e: any) => {
      ctx.snapshot();
      s.repeats = Math.max(1, Math.min(16, +e.target.value || 1));
      ctx.changed(true);
    };
    card.querySelectorAll("[data-scene-track]").forEach(
      (sel: any) =>
        (sel.onchange = () => {
          ctx.snapshot();
          s.clipIds[sel.dataset.sceneTrack] = sel.value;
          ctx.project.activeClipIds[sel.dataset.sceneTrack] = sel.value;
          ctx.changed(true);
        }),
    );
    card.querySelectorAll("[data-action]").forEach(
      (b: any) =>
        (b.onclick = () => {
          const a = b.dataset.action;
          if (a === "remove" && ctx.project.arrangement.length > 1) {
            ctx.snapshot();
            removeArrangementScene(ctx.project, i);
            ctx.changed(true);
          }
          if (a === "duplicate") {
            ctx.snapshot();
            duplicateArrangementScene(ctx.project, i);
            ctx.changed(true);
            ctx.focusScene(i + 1);
          }
          if (a === "left") {
            ctx.snapshot();
            moveArrangementScene(ctx.project, i, i - 1);
            ctx.changed(true);
            ctx.focusScene(i - 1);
          }
          if (a === "right") {
            ctx.snapshot();
            moveArrangementScene(ctx.project, i, i + 1);
            ctx.changed(true);
            ctx.focusScene(i + 1);
          }
        }),
    );
    const h = card.querySelector(".drag-handle");
    h.ondragstart = (e: any) => {
      ctx.draggedScene = i;
      e.dataTransfer.setData("text/plain", i);
      card.classList.add("dragging");
    };
    h.ondragend = () => {
      ctx.draggedScene = -1;
      card.classList.remove("dragging");
    };
    card.ondragover = (e: any) => {
      e.preventDefault();
      card.classList.add("drop-target");
    };
    card.ondragleave = () => card.classList.remove("drop-target");
    card.ondrop = (e: any) => {
      e.preventDefault();
      ctx.snapshot();
      moveArrangementScene(ctx.project, ctx.draggedScene, i);
      ctx.draggedScene = -1;
      ctx.changed(true);
      ctx.focusScene(i);
    };
  });
  ctx.$$(".scene").forEach((card) =>
    card.addEventListener("click", (event: MouseEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input,select,button,.drag-handle",
        )
      )
        return;
      const index = +card.dataset.scene;
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        if (ctx.selectedScenes.has(index)) ctx.selectedScenes.delete(index);
        else ctx.selectedScenes.add(index);
      } else {
        ctx.selectedScenes.clear();
        ctx.selectedScenes.add(index);
      }
      ctx.renderArrangement();
    }),
  );
  ctx.$("#arrangeTimeline").style.width =
    `${Math.max(100, ctx.project.editor.arrangeZoom * 100)}%`;
  ctx.$("#arrangeZoom").value = ctx.project.editor.arrangeZoom;
  ctx.$("#arrangeLoopEnabled").checked = ctx.project.loop.enabled;
  ctx.$("#arrangePunchEnabled").checked = ctx.project.loop.punch;
  ctx.$("#arrangeLoopStart").value = ctx.project.loop.start;
  ctx.$("#arrangeLoopEnd").value = ctx.project.loop.end;
  ctx.$("#arrangeMarkers").innerHTML = ctx.project.markers
    .map(
      (marker: any) =>
        `<button class="arrange-marker" style="--marker:${marker.color}" data-marker="${marker.id}">${ctx.esc(marker.name)} · ${ctx.formatLocator(marker.step)} ×</button>`,
    )
    .join("");
  ctx.$$("[data-marker]").forEach(
    (button) =>
      (button.onclick = async () => {
        const marker = ctx.project.markers.find(
          (item: any) => item.id === button.dataset.marker,
        );
        if (!marker) return;
        if (
          await requestConfirmation(
            translate("Delete marker", "Borrar marcador"),
            msg("ui_560f57718a41", { arg0: marker.name }),
          )
        ) {
          ctx.snapshot();
          ctx.project.markers = ctx.project.markers.filter(
            (item: any) => item.id !== marker.id,
          );
          ctx.changed(true);
        }
      }),
  );
}

export function focusScene(ctx: RuntimeContext, i: number) {
  setTimeout(
    () =>
      document.querySelector(`.scene[data-scene="${i}"]`)?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      }),
    0,
  );
}

export function setupArrangeTools(ctx: RuntimeContext) {
  ctx.$("#arrangeSelectAllBtn").onclick = () => {
    ctx.selectedScenes = new Set(
      ctx.project.arrangement.map((_scene: any, index: number) => index),
    );
    ctx.renderArrangement();
  };
  ctx.$("#arrangeDuplicateBtn").onclick = () => {
    if (!ctx.selectedScenes.size) return;
    ctx.snapshot();
    const copies = duplicateArrangementSelection(ctx.project, [
      ...ctx.selectedScenes,
    ]);
    ctx.selectedScenes = new Set(
      copies.map(
        (_copy, index) =>
          ctx.project.arrangement.length - copies.length + index,
      ),
    );
    ctx.changed(true);
  };
  ctx.$("#arrangeCopyBtn").onclick = () => {
    ctx.sceneClipboard = [...ctx.selectedScenes]
      .sort((a, b) => a - b)
      .map((index) => structuredClone(ctx.project.arrangement[index]));
    ctx.toast(`${ctx.sceneClipboard.length} ${msg("ui_08268a1a4957")}`);
  };
  ctx.$("#arrangePasteBtn").onclick = () => {
    if (!ctx.sceneClipboard.length) return;
    ctx.snapshot();
    const at = ctx.selectedScenes.size
        ? Math.max(...ctx.selectedScenes) + 1
        : ctx.project.arrangement.length,
      copies = ctx.sceneClipboard.map((scene) => ({
        ...structuredClone(scene),
        id: crypto.randomUUID(),
        name: `${scene.name} COPY`,
      }));
    ctx.project.arrangement.splice(at, 0, ...copies);
    ctx.selectedScenes = new Set(copies.map((_copy, index) => at + index));
    ctx.changed(true);
  };
  ctx.$("#arrangeDeleteBtn").onclick = () => {
    if (!ctx.selectedScenes.size) return;
    ctx.snapshot();
    if (!removeArrangementSelection(ctx.project, [...ctx.selectedScenes])) {
      ctx.toast(msg("ui_db511cc92b7a"));
      return;
    }
    ctx.selectedScenes.clear();
    ctx.changed(true);
    ctx.toast(translate("Sections deleted", "Secciones borradas"), true);
  };
  ctx.$("#arrangeFillBtn").onclick = () => {
    ctx.snapshot();
    const at = ctx.selectedScenes.size
        ? Math.max(...ctx.selectedScenes) + 1
        : ctx.project.arrangement.length,
      source =
        ctx.project.arrangement[Math.max(0, at - 1)] ||
        ctx.project.arrangement[0],
      drum = createClip(
        "drums",
        "IMPACT FILL",
        1,
        meterSteps(ctx.project.meter),
      );
    generateClip(ctx.project, drum, "drums", 1);
    drum.notes.push(makeNote(Math.max(0, drum.stepsPerBar - 2), 6, 1, 1));
    ctx.project.clips.push(drum);
    ctx.project.arrangement.splice(at, 0, {
      id: crypto.randomUUID(),
      name: "IMPACT FILL",
      clipIds: { ...source.clipIds, drums: drum.id },
      repeats: 1,
    });
    ctx.selectedScenes = new Set([at]);
    ctx.changed(true);
  };
  ctx.$("#arrangeMarkerBtn").onclick = async () => {
    const name = await requestText(
      msg("ui_eb8e9b8f57d4"),
      `MARK ${ctx.project.markers.length + 1}`,
    );
    if (!name?.trim()) return;
    ctx.snapshot();
    ctx.project.markers.push({
      id: crypto.randomUUID(),
      name: name.trim(),
      step: ctx.globalStartStep,
      color: ["#2ee8ff", "#ff3bd4", "#a7ff5b", "#ff9f43"][
        ctx.project.markers.length % 4
      ],
    });
    ctx.project.markers.sort((a: any, b: any) => a.step - b.step);
    ctx.changed(true);
  };
  ctx.$("#arrangeZoom").oninput = () => {
    ctx.project.editor.arrangeZoom = +ctx.$("#arrangeZoom").value;
    ctx.renderArrangement();
  };
  ctx.$("#arrangeZoom").onchange = () => ctx.changed();
  ctx.$("#arrangeLoopEnabled").onchange = () => {
    ctx.snapshot();
    ctx.project.loop.enabled = ctx.$("#arrangeLoopEnabled").checked;
    ctx.changed();
  };
  ctx.$("#arrangePunchEnabled").onchange = () => {
    ctx.snapshot();
    ctx.project.loop.punch = ctx.$("#arrangePunchEnabled").checked;
    ctx.changed();
  };
  const loopChange = () => {
    ctx.snapshot();
    ctx.project.loop.start = Math.max(
      0,
      +ctx.$("#arrangeLoopStart").value || 0,
    );
    ctx.project.loop.end = Math.max(
      ctx.project.loop.start + 1,
      +ctx.$("#arrangeLoopEnd").value || 1,
    );
    ctx.changed();
  };
  ctx.$("#arrangeLoopStart").onchange = loopChange;
  ctx.$("#arrangeLoopEnd").onchange = loopChange;
}

export function renderTempoMap(ctx: RuntimeContext) {
  const root = ctx.$("#arrangeMarkers");
  if (!root) return;
  for (const event of ctx.project.tempoMap || []) {
    const badge = document.createElement("button");
    badge.className = "arrange-marker";
    badge.style.setProperty("--marker", "#2ee8ff");
    badge.textContent = `${event.step} · ${event.bpm} BPM`;
    badge.title = "Tempo map";
    root.append(badge);
  }
  for (const event of (ctx.project.meterMap || []).slice(1)) {
    const badge = document.createElement("button");
    badge.className = "arrange-marker";
    badge.style.setProperty("--marker", "#8b7cff");
    badge.textContent = `${event.step} · ${event.beats}/${event.unit}`;
    root.append(badge);
  }
}
