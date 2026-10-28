import { controlIcon } from "../ui/icons";
import { t as msg, setLanguage, translateDOM, translate } from "../ui/i18n";

import { mountKeyboard, releaseAllKeyboards } from "../ui/components/keyboard";

import { mountDial } from "../ui/components/dial";

import { studioBridge, type StudioView } from "../ui/bridge";

import {
  projectAssets,
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

export function reportError(ctx: RuntimeContext, message: unknown) {
  window.__kvErrors.push(String(message));
  const el = document.getElementById("toast");
  if (el) {
    el.textContent = `ENGINE ERROR: ${String(message)}`;
    el.classList.add("show");
  }
}

export function quickHandleDb(ctx: RuntimeContext) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ctx.QUICK_HANDLE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function showQuickHandle(
  ctx: RuntimeContext,
  _kind: QuickExportKind,
  _handle: any,
) {
  ctx.renderExportTargets();
  ctx.$("#exportBtn").classList.toggle("bound", ctx.quickHandles.size > 0);
}

export async function loadQuickHandles(ctx: RuntimeContext) {
  if (!("indexedDB" in window)) return;
  try {
    const db = await ctx.quickHandleDb(),
      transaction = db.transaction("handles", "readonly"),
      store = transaction.objectStore("handles");
    for (const kind of [
      "wav",
      "midi",
      "project",
      "clip-wav",
      "clip-midi",
      "stems",
      "bundle",
      "performance",
    ] as QuickExportKind[]) {
      const request = store.get(kind);
      request.onsuccess = () => {
        if (request.result) {
          ctx.quickHandles.set(kind, request.result);
          ctx.showQuickHandle(kind, request.result);
        }
      };
    }
  } catch {}
}

export async function rememberQuickHandle(
  ctx: RuntimeContext,
  kind: QuickExportKind,
  handle: any,
) {
  ctx.quickHandles.set(kind, handle);
  ctx.showQuickHandle(kind, handle);
  if (!("indexedDB" in window)) return;
  try {
    const db = await ctx.quickHandleDb(),
      transaction = db.transaction("handles", "readwrite");
    transaction.objectStore("handles").put(handle, kind);
  } catch {}
}

export function applyLanguage(ctx: RuntimeContext, render = false) {
  setLanguage(ctx.language);
  document.documentElement.lang = ctx.language;
  localStorage.setItem(ctx.LANGUAGE_STORAGE, ctx.language);
  ctx.$("#languageSelect").value = ctx.language;
  ctx.$("#menuLanguageSelect").value = ctx.language;
  for (const [selector, en, es] of ctx.staticCopy) {
    const el = ctx.$(selector);
    if (el) el.textContent = ctx.L(en, es);
  }
  for (const [selector, en, es] of ctx.leadingCopy) {
    const el = ctx.$(selector),
      node = [...(el?.childNodes || [])].find(
        (n: any) => n.nodeType === 3 && n.textContent.trim(),
      );
    if (node) node.textContent = `${ctx.L(en, es)} `;
  }
  ctx.$$("#helpDialog .help-grid span").forEach((el, i) => {
    const copy = ctx.shortcutCopy[i];
    if (copy) el.textContent = ctx.L(copy[0], copy[1]);
  });
  ctx.$("#arrangeView h1").textContent = msg("ui_48db542653b3");
  ctx.$("#performView h1").textContent = msg("ui_69c8aaf78db5");
  ctx.$(".generators>span").textContent = msg("ui_569e9e1ec323");
  const styles = ctx.$$("#backingStyle option");
  if (styles.length) {
    styles[0].textContent = msg("ui_bafcb2ef8a78");
    styles[1].textContent = msg("ui_89e1739a2ca4");
    styles[2].textContent = msg("ui_e08a46f50c07");
  }
  ctx.$("#commandSearch").placeholder = msg("ui_776cea6b4696");
  ctx.$("#commandSearch").ariaLabel = msg("ui_5ae3aa24eb15");
  ctx.$("#commandDialog").ariaLabel = msg("ui_7b6b539e73d9");
  ctx.$("#contextHelpClose").ariaLabel = msg("ui_d3f4e289c2ab");
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", msg("ui_a05be5b284d5"));
  if (render) ctx.renderAll();
  if (ctx.pendingDeleteClipId) ctx.updateDeleteClipDialog();
  ctx.installControlHelp();
  syncClipTransportButton(ctx);
  if (ctx.helpMode) ctx.showHelpIntro();
}

export function controlInfo(ctx: RuntimeContext, el: any): [string, string] {
  const data = ctx.controlDescriptions[el.id];
  if (data) return [ctx.L(data[0], data[1]), ctx.L(data[2], data[3])];
  if (el.matches(".knob")) {
    const name =
      el.closest(".knob-control")?.querySelector("label")?.textContent ||
      msg("ui_caaf7a897a38");
    return [name, msg("ui_59a4b5373cf0")];
  }
  if (el.matches("[data-region-scratch]"))
    return [msg("ui_3760d9a91d14"), msg("ui_da5c9ac34359")];
  if (el.matches("[data-fx]"))
    return [
      el.closest(".fx-unit")?.querySelector("span")?.textContent || "FX",
      msg("ui_6a3399fc2554"),
    ];
  if (el.matches("[data-macro]"))
    return [el.dataset.macro.toUpperCase(), msg("ui_181a7d93eb61")];
  if (el.matches("[data-solo]"))
    return [msg("ui_cd16c1024d0d"), msg("ui_c91fbe9e5cbb")];
  if (el.matches("[data-mute]"))
    return [msg("ui_6dbf0ca01f5c"), msg("ui_535d08fa8099")];
  if (el.matches(".track-select"))
    return [msg("ui_a0460e79ee47"), msg("ui_1a444acacebf")];
  if (el.matches(".note-block"))
    return [msg("ui_4488a21e4432"), msg("ui_2ee34c598bae")];
  if (el.matches(".key"))
    return [msg("ui_4a3c670ae187"), msg("ui_63de942cca73")];
  if (el.matches("[data-generate]"))
    return [msg("ui_aaff7061e90a"), msg("ui_b0ee005d6226")];
  const name = (
    el.getAttribute("aria-label") ||
    el.closest("label")?.textContent ||
    el.textContent ||
    el.id ||
    msg("ui_ea1d3df298ca")
  )
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 48);
  if (el.tagName === "SELECT") return [name, msg("ui_a41064e14aed")];
  if (el.type === "range") return [name, msg("ui_23f5c4f36cab")];
  if (el.type === "number") return [name, msg("ui_374b94d345bb")];
  if (el.type === "checkbox") return [name, msg("ui_751feb71343c")];
  return [name, msg("ui_901734b3b46f")];
}

export function installControlHelp(ctx: RuntimeContext) {
  const controls = ctx.$$(
    'button,input,select,canvas,[role="application"],.knob',
  );
  for (const el of controls) {
    const [title, body] = ctx.controlInfo(el);
    el.dataset.helpTitle = title;
    el.dataset.helpBody = body;
    el.setAttribute("aria-description", body);
    if (!el.title && el.tagName !== "INPUT") el.title = body;
  }
}

export function showHelpIntro(ctx: RuntimeContext) {
  ctx.$("#contextHelpTitle").textContent = msg("ui_19f09c8efccc");
  ctx.$("#contextHelpBody").textContent = msg("ui_9ec253c1d7a9");
  ctx.$("#contextHelp").hidden = false;
}

export function toggleHelp(ctx: RuntimeContext, force?: boolean) {
  ctx.helpMode = force ?? !ctx.helpMode;
  document.body.classList.toggle("help-mode", ctx.helpMode);
  ctx.$("#helpBtn").setAttribute("aria-pressed", String(ctx.helpMode));
  if (ctx.helpMode) ctx.showHelpIntro();
  else ctx.$("#contextHelp").hidden = true;
}

export function showControlHelp(ctx: RuntimeContext, el: any) {
  if (!ctx.helpMode || !el?.dataset.helpBody) return;
  ctx.$("#contextHelpTitle").textContent = el.dataset.helpTitle;
  ctx.$("#contextHelpBody").textContent = el.dataset.helpBody;
  ctx.$("#contextHelp").hidden = false;
}

export function showTutorialStep(ctx: RuntimeContext) {
  const steps = ctx.tutorialSteps(),
    step = steps[ctx.tutorialStep]!;
  ctx
    .$$(".tutorial-target")
    .forEach((el) => el.classList.remove("tutorial-target"));
  ctx.activateView(step.view);
  setTimeout(() => {
    const target = ctx.$(step.target);
    target?.classList.add("tutorial-target");
    target?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  }, 30);
  ctx.$("#tutorialStepLabel").textContent = msg("ui_225fae945a02", {
    arg0: ctx.tutorialStep + 1,
    arg1: steps.length,
  });
  ctx.$("#tutorialTitle").textContent = step.title;
  ctx.$("#tutorialBody").textContent = step.body;
  ctx.$("#tutorialBack").textContent = msg("ui_587eac1112fa");
  ctx.$("#tutorialBack").disabled = ctx.tutorialStep === 0;
  ctx.$("#tutorialNext").textContent =
    ctx.tutorialStep === steps.length - 1
      ? msg("ui_2d355f876039")
      : msg("ui_1992d5e8d57e");
  ctx.$("#tutorialExit").textContent = msg("ui_bb1b38004d2e");
  ctx
    .$("#tutorialProgress")
    .style.setProperty(
      "--tutorial-progress",
      `${((ctx.tutorialStep + 1) / steps.length) * 100}%`,
    );
}

export function startTutorial(ctx: RuntimeContext) {
  ctx.toggleHelp(false);
  ctx.tutorialStep = 0;
  document.body.classList.add("tutorial-active");
  if (!ctx.$("#tutorialDialog").open) ctx.$("#tutorialDialog").show();
  ctx.showTutorialStep();
}

export function endTutorial(ctx: RuntimeContext) {
  document.body.classList.remove("tutorial-active");
  ctx
    .$$(".tutorial-target")
    .forEach((el) => el.classList.remove("tutorial-target"));
  ctx.$("#tutorialDialog").close();
  localStorage.setItem("kiber-vengance-tutorial-complete-v1", "true");
}

export function initLearning(ctx: RuntimeContext) {
  const changeLanguage = (value: string) => {
    ctx.language = value === "es" ? "es" : "en";
    ctx.applyLanguage(false);
    ctx.renderKeyboard();
    ctx.renderSamplerKeyboard();
    translateDOM();
    ctx.installControlHelp();
    if (ctx.$("#tutorialDialog").open) ctx.showTutorialStep();
  };
  ctx.$("#languageSelect").onchange = () =>
    changeLanguage(ctx.$("#languageSelect").value);
  ctx.$("#menuLanguageSelect").onchange = () =>
    changeLanguage(ctx.$("#menuLanguageSelect").value);
  ctx.$("#tutorialBtn").onclick = ctx.startTutorial;
  ctx.$("#helpBtn").onclick = () => ctx.toggleHelp();
  ctx.$("#contextHelpClose").onclick = () => ctx.toggleHelp(false);
  ctx.$("#manualBtn").onclick = () => ctx.open("#helpDialog");
  ctx.$("#tutorialExit").onclick = ctx.endTutorial;
  ctx.$("#tutorialBack").onclick = () => {
    ctx.tutorialStep = Math.max(0, ctx.tutorialStep - 1);
    ctx.showTutorialStep();
  };
  ctx.$("#tutorialNext").onclick = () => {
    if (ctx.tutorialStep >= ctx.tutorialSteps().length - 1) ctx.endTutorial();
    else {
      ctx.tutorialStep++;
      ctx.showTutorialStep();
    }
  };
  document.addEventListener("pointerover", (e) =>
    ctx.showControlHelp(
      (e.target as HTMLElement).closest?.("[data-help-body]"),
    ),
  );
  document.addEventListener("focusin", (e) =>
    ctx.showControlHelp(
      (e.target as HTMLElement).closest?.("[data-help-body]"),
    ),
  );
  document.addEventListener("pointerdown", (e) =>
    ctx.showControlHelp(
      (e.target as HTMLElement).closest?.("[data-help-body]"),
    ),
  );
}

export function updateDeleteClipDialog(ctx: RuntimeContext) {
  const target = ctx.project.clips.find(
    (c: any) => c.id === ctx.pendingDeleteClipId,
  );
  if (!target) return;
  const replacement = clipsForTrack(ctx.project, target.track).find(
      (c) => c.id !== target.id,
    ),
    uses = ctx.project.arrangement.filter(
      (s: any) => s.clipIds[target.track] === target.id,
    ).length;
  ctx.$("#deleteClipTitle").textContent = msg("ui_29948347ecd1", {
    arg0: target.name,
  });
  ctx.$("#deleteClipDescription").textContent = ctx.L(
    `${uses ? `${uses} arrangement section${uses === 1 ? "" : "s"} use this clip. ` : "This clip is not used by the arrangement. "}${uses && replacement ? `They will switch to “${replacement.name}”. ` : ""}At least one clip always remains on this track.`,
    `${uses ? `${uses} sección${uses === 1 ? "" : "es"} del arreglo usa${uses === 1 ? "" : "n"} este clip. ` : "Este clip no se utiliza en el arreglo. "}${uses && replacement ? `Se cambiará${uses === 1 ? "" : "n"} a “${replacement.name}”. ` : ""}Siempre se conserva al menos un clip en esta pista.`,
  );
}

export function requestClipDelete(ctx: RuntimeContext, id: string) {
  const target = ctx.project.clips.find((c: any) => c.id === id);
  if (!target) return;
  if (clipsForTrack(ctx.project, target.track).length <= 1) {
    ctx.toast(msg("ui_49594184d6c0"));
    return;
  }
  ctx.pendingDeleteClipId = id;
  ctx.updateDeleteClipDialog();
  ctx.$("#deleteClipDialog").showModal();
}

export function bindNoteDrag(
  ctx: RuntimeContext,
  el: any,
  c: any,
  rows: number[],
  zoom: number,
  rowH: number,
) {
  el.onpointerdown = (e: any) => {
    if (ctx.editorTool === "navigate" || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const id = el.dataset.note;
    const wasSelected = ctx.selectedNotes.has(id);
    const selecting = ctx.editorTool === "select";
    const pointerId = e.pointerId;
    const capture = el.closest(".roll-pane") as HTMLElement;
    capture?.setPointerCapture(pointerId);
    if (e.shiftKey) {
      ctx.selectedNotes.has(id)
        ? ctx.selectedNotes.delete(id)
        : ctx.selectedNotes.add(id);
    } else if (!wasSelected) {
      if (selecting) ctx.selectedNotes.add(id);
      else ctx.selectedNotes = new Set([id]);
    }
    ctx.syncSelectedClasses();
    ctx.renderSelection();
    const originals = new Map(
        c.notes
          .filter((n: any) => ctx.selectedNotes.has(n.id))
          .map((n: any) => [
            n.id,
            { step: n.step, pitch: n.pitch, length: n.length },
          ]),
      ),
      startX = e.clientX,
      startY = e.clientY,
      resizing = e.target.classList.contains("note-resize"),
      before = structuredClone(ctx.project);
    let moved = false;
    const move = (ev: any) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const dx =
          Math.round((ev.clientX - startX) / zoom / ctx.project.editor.snap) *
          ctx.project.editor.snap,
        dy = Math.round((ev.clientY - startY) / rowH);
      if (!moved && !dx && (!dy || resizing)) return;
      if (!moved) {
        ctx.history.push(before);
        moved = true;
      }
      for (const n of c.notes.filter((n: any) => ctx.selectedNotes.has(n.id))) {
        const o: any = originals.get(n.id);
        if (resizing)
          n.length = Math.max(
            ctx.project.editor.snap,
            Math.min(clipLengthSteps(c) - n.step, o.length + dx),
          );
        else {
          n.step = Math.max(
            0,
            Math.min(clipLengthSteps(c) - o.length, o.step + dx),
          );
          if (ctx.selectedTrack !== "drums")
            n.pitch = Math.max(
              TRACK_META[ctx.selectedTrack].low,
              Math.min(TRACK_META[ctx.selectedTrack].high, o.pitch - dy),
            );
        }
      }
      ctx.renderPiano();
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (capture?.hasPointerCapture(pointerId)) capture.releasePointerCapture(pointerId);
      if (!moved && selecting && wasSelected && ev.type !== "pointercancel") {
        ctx.selectedNotes.delete(id);
        ctx.syncSelectedClasses();
        ctx.renderSelection();
      }
      if (moved) ctx.changed();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
}

export function launcherSnapshot(ctx: RuntimeContext, name = "LIVE") {
  const current = {
    name,
    clipIds: { ...ctx.project.activeClipIds },
    repeats: 1,
  };
  const previous = ctx.launcherSnapshots.at(-1);
  if (
    previous &&
    TRACKS.every((track) => previous.clipIds[track] === current.clipIds[track])
  )
    previous.repeats = Math.min(16, previous.repeats + 1);
  else ctx.launcherSnapshots.push(current);
  ctx.$("#launcherCommitBtn").disabled = !ctx.launcherSnapshots.length;
}

export function sceneLength(ctx: RuntimeContext, scene: any) {
  return Math.max(
    ...TRACKS.map((track) =>
      clipLengthSteps(
        ctx.project.clips.find((c: any) => c.id === scene.clipIds[track]) ||
          activeClip(ctx.project, track),
      ),
    ),
  );
}

export function songLength(ctx: RuntimeContext) {
  return playbackEvents(ctx.project, { song: true }).durationSteps;
}

export function setGlobalStart(ctx: RuntimeContext, value: number) {
  ctx.globalStartStep = Math.max(
    0,
    Math.min(Math.max(0, ctx.songLength() - 1), Math.round(value)),
  );
  ctx.$("#globalPosition").value = ctx.globalStartStep;
  ctx.$("#globalPositionValue").textContent = ctx.formatLocator(
    ctx.globalStartStep,
  );
  if (ctx.engine.playing && ctx.engine.songMode) {
    ctx.engine.seek(ctx.globalStartStep, true);
    ctx.transportPosition = ctx.globalStartStep;
    ctx.updatePlayheads();
  }
}

export function setClipStart(ctx: RuntimeContext, value: number, seek = true) {
  const c = ctx.clip(),
    length = clipLengthSteps(c),
    step = Math.max(0, Math.min(length - 1, Math.round(value)));
  ctx.clipStartSteps.set(c.id, step);
  ctx.$("#clipPosition").value = step;
  ctx.$("#clipPositionValue").textContent =
    `${msg("ui_a5d5c1bba91f")} ${Math.floor(step / meterSteps(ctx.project.meter)) + 1} · ${msg("ui_0c9b85f56357")} ${(step % meterSteps(ctx.project.meter)) + 1}`;
  if (seek && ctx.engine.playing && !ctx.engine.songMode) {
    ctx.engine.seek(step, false);
    ctx.currentStep = step;
    ctx.updatePlayheads();
  }
}

export function performanceStep(ctx: RuntimeContext) {
  return Math.max(
    0,
    (Date.now() - ctx.performanceStarted) / 1000 / (60 / ctx.project.tempo / 4),
  );
}

export function openTakeEditor(ctx: RuntimeContext, take: PerformanceTake) {
  ctx.activePerformanceTakeId = take.id;
  ctx.$("#takeEditorTitle").textContent = take.name;
  ctx.$("#takeTrimStart").value = take.trimStart;
  ctx.$("#takeTrimEnd").value = take.trimEnd;
  const renderEvents = () => {
    ctx.$("#takeEventList").innerHTML =
      take.events
        .filter(
          (event) => event.step >= take.trimStart && event.step <= take.trimEnd,
        )
        .map(
          (event) =>
            `<div class="take-event" data-take-event="${event.id}"><code>${event.kind.toUpperCase()}</code><input data-event-step type="number" min="0" max="${take.durationSteps}" step=".25" value="${event.step.toFixed(3)}"><span>${ctx.esc(event.target)}</span><input data-event-value value="${ctx.esc(String(event.value))}" aria-label="Event value"><button data-event-delete>×</button></div>`,
        )
        .join("") || `<p class="launcher-status">${msg("ui_09282d095c82")}</p>`;
    ctx.$$("[data-take-event]").forEach((row) => {
      const event = take.events.find(
        (item) => item.id === row.dataset.takeEvent,
      )!;
      row.querySelector("[data-event-step]").onchange = (input: any) => {
        event.step = Math.max(
          0,
          Math.min(take.durationSteps, +input.target.value),
        );
        take.events.sort((a, b) => a.step - b.step);
        ctx.changed();
        renderEvents();
      };
      row.querySelector("[data-event-value]").onchange = (input: any) => {
        const raw = input.target.value;
        event.value =
          event.value === true || event.value === false
            ? raw === "true"
            : typeof event.value === "number"
              ? Number.isFinite(+raw)
                ? +raw
                : event.value
              : raw;
        ctx.changed();
      };
      row.querySelector("[data-event-delete]").onclick = () => {
        take.events = take.events.filter((item) => item.id !== event.id);
        ctx.changed();
        renderEvents();
      };
    });
  };
  const trim = () => {
    take.trimStart = Math.max(
      0,
      Math.min(take.durationSteps - 0.25, +ctx.$("#takeTrimStart").value || 0),
    );
    take.trimEnd = Math.max(
      take.trimStart + 0.25,
      Math.min(
        take.durationSteps,
        +ctx.$("#takeTrimEnd").value || take.durationSteps,
      ),
    );
    ctx.changed();
    renderEvents();
  };
  ctx.$("#takeTrimStart").onchange = trim;
  ctx.$("#takeTrimEnd").onchange = trim;
  ctx.$("#takeQuantizeBtn").onclick = () => {
    quantizePerformanceTake(take, ctx.project.editor.snap);
    ctx.changed();
    renderEvents();
  };
  renderEvents();
  ctx.open("#takeEditorDialog");
}

export function mixSnapshot(ctx: RuntimeContext) {
  const tracks = Object.fromEntries(
      TRACKS.map((track) => [
        track,
        {
          volume: ctx.project.tracks[track].volume,
          pan: ctx.project.tracks[track].pan,
          preGainDb: ctx.project.tracks[track].preGainDb,
        },
      ]),
    ),
    loudness = Math.sqrt(
      TRACKS.reduce(
        (sum, track) =>
          sum +
          (ctx.project.tracks[track].volume *
            10 ** (ctx.project.tracks[track].preGainDb / 20)) **
            2,
        0,
      ),
    );
  return { tracks, master: ctx.project.master, loudness };
}

export function presetFavorites(ctx: RuntimeContext) {
  try {
    return new Set<string>(
      JSON.parse(localStorage.getItem(ctx.PRESET_FAVORITES) || "[]"),
    );
  } catch {
    return new Set<string>();
  }
}

export function setupLibraries(ctx: RuntimeContext) {
  ctx.$("#presetLibraryBtn").onclick = () => {
    ctx.$("#projectMenu").close();
    ctx.renderPresetLibrary();
    ctx.open("#presetDialog");
  };
  ctx.$("#sampleLibraryBtn").onclick = () => {
    ctx.$("#projectMenu").close();
    ctx.renderSampleSlots();
    ctx.open("#sampleDialog");
  };
  ctx.$("#presetSearch").oninput = ctx.renderPresetLibrary;
  ctx.$("#saveUserPresetBtn").onclick = ctx.saveCurrentPreset;
  ctx.$("#exportPresetBankBtn").onclick = () =>
    ctx.download(
      JSON.stringify(
        {
          format: "kiber-vengance-preset-bank",
          version: 1,
          presets: ctx.userPresets(),
        },
        null,
        2,
      ),
      "kiber-vengance-presets.json",
      "application/json",
    );
  ctx.$("#importPresetBank").onchange = async (event: any) => {
    try {
      const data = JSON.parse(await event.target.files[0].text());
      if (
        data.format !== "kiber-vengance-preset-bank" ||
        !Array.isArray(data.presets)
      )
        throw new Error("Invalid preset bank");
      ctx.saveUserPresets([...ctx.userPresets(), ...data.presets]);
      ctx.renderPresetLibrary();
      ctx.toast(msg("ui_2f959902bb03"));
    } catch (error) {
      ctx.toast(error instanceof Error ? error.message : String(error));
    }
  };
  ctx.$("#compactModeBtn").onclick = () => {
    document.body.classList.toggle("compact-mode");
    window.dispatchEvent(
      new CustomEvent("kv-density", {
        detail: document.body.classList.contains("compact-mode")
          ? "compact"
          : "comfortable",
      }),
    );
    ctx
      .$("#compactModeBtn")
      .setAttribute(
        "aria-pressed",
        String(document.body.classList.contains("compact-mode")),
      );
    ctx.writeUiPrefs();
  };
}

export function setupStudioExtensions(ctx: RuntimeContext) {
  ctx.$("#globalPosition").oninput = () =>
    ctx.setGlobalStart(+ctx.$("#globalPosition").value);
  ctx.$("#clipPosition").oninput = () =>
    ctx.setClipStart(+ctx.$("#clipPosition").value);
  ctx.$("#globalZeroBtn").onclick = () => ctx.setGlobalStart(0);
  ctx.$("#clipZeroBtn").onclick = () => ctx.setClipStart(0);
  ctx.$("#globalStartBtn").onclick = () => {
    if (ctx.engine.playing) ctx.engine.stop();
    ctx.activateView("arrange");
    ctx.togglePlay(true);
  };
  ctx.$("#clipStartBtn").onclick = async () => {
    if (ctx.engine.playing && !ctx.engine.songMode) {
      ctx.pausePlayback();
      return;
    }
    const button = ctx.$("#clipStartBtn");
    button.disabled = true;
    try {
      if (ctx.engine.playing) ctx.engine.stop();
      ctx.activateView("forge");
      await ctx.togglePlay(false);
    } finally {
      button.disabled = false;
      syncClipTransportButton(ctx);
    }
  };
  ctx.$("#performanceRecordBtn").onclick = ctx.togglePerformanceCapture;
  ctx.$("#performanceSaveBtn").onclick = () =>
    ctx.performExport("performance", true);
  ctx.$("#mixCaptureBtn").onclick = ctx.captureMixerReference;
  ctx.$("#mixCompareBtn").onclick = ctx.toggleMixerReference;
  ctx.$("#mixerMaster").onpointerdown = ctx.snapshot;
  ctx.$("#mixerMaster").oninput = () => {
    ctx.project.master = +ctx.$("#mixerMaster").value;
    ctx.recordPerformanceEvent("mixer", "master:volume", ctx.project.master);
    ctx.$("#mixerMasterValue").textContent =
      `${Math.round(ctx.project.master * 100)}%`;
    ctx.$("#masterVolume").value = ctx.project.master;
    ctx.$("#masterValue").textContent = Math.round(ctx.project.master * 100);
    ctx.engine.setProject(ctx.project);
  };
  ctx.$("#mixerMaster").onchange = () => ctx.changed();
  ctx.$("#forgetTargetsBtn").onclick = async () => {
    for (const kind of [...ctx.quickHandles.keys()])
      await ctx.forgetExportTarget(kind);
    ctx.toast(msg("ui_c84ce0da9fc4"));
  };
  ctx
    .$$("[data-export]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          ctx.performExport(button.dataset.export, false)),
    );
  ctx
    .$$("[data-export-as]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          ctx.performExport(button.dataset.exportAs, true)),
    );
}

export function readUiPrefs(ctx: RuntimeContext): {
  focus: boolean;
  collapsed: string[];
  compact: boolean;
} {
  try {
    return {
      focus: false,
      collapsed: [],
      compact: false,
      ...JSON.parse(localStorage.getItem(ctx.UI_STORAGE) || "{}"),
    };
  } catch {
    return { focus: false, collapsed: [], compact: false };
  }
}

export function writeUiPrefs(ctx: RuntimeContext) {
  localStorage.setItem(
    ctx.UI_STORAGE,
    JSON.stringify({
      focus: document.body.classList.contains("focus-mode"),
      collapsed: ctx.$$(".collapsible-rack.collapsed").map((x) => x.id),
      compact: document.body.classList.contains("compact-mode"),
    }),
  );
}

export function setRackCollapsed(
  ctx: RuntimeContext,
  id: string,
  collapsed: boolean,
  persist = true,
) {
  const rack = ctx.$(`#${id}`),
    button = rack?.querySelector(".rack-toggle"),
    names: Record<string, string> = {
      synthRack: msg("ui_721efe1f13de"),
      motionRack: msg("ui_1f72155cdda1"),
      effectsRack: msg("ui_23f4d47c925a"),
      macroRack: "macros",
    };
  if (!rack) return;
  rack.classList.toggle("collapsed", collapsed);
  button?.setAttribute("aria-expanded", String(!collapsed));
  button?.setAttribute(
    "aria-label",
    `${collapsed ? msg("ui_9869e506c38f") : msg("ui_9cf188d3a677")} ${names[id] || msg("ui_7040cb72e5b1")}`,
  );
  if (button) button.textContent = collapsed ? "+" : "−";
  if (persist) ctx.writeUiPrefs();
}

export function toggleFocus(
  ctx: RuntimeContext,
  force?: boolean,
  silent = false,
) {
  const active = force ?? !document.body.classList.contains("focus-mode");
  document.body.classList.toggle("focus-mode", active);
  studioBridge.update({ expanded: active });
  if (active) {
    ctx.soundPanel = false;
    ctx.syncStudioUi();
  }
  ctx.$("#focusBtn").setAttribute("aria-pressed", String(active));
  ctx.writeUiPrefs();
  if (!silent)
    ctx.toast(active ? msg("ui_421d43f4784f") : msg("ui_f423dce4371a"));
}

export function selectTrack(ctx: RuntimeContext, track: TrackId) {
  ctx.selectedTrack = track;
  ctx.selectedNotes.clear();
  ctx.activateView("forge");
  ctx.renderAll();
  ctx.setDefaultScroll();
}

export function matchingCommands(ctx: RuntimeContext, query: string) {
  const needle = query.trim().toLowerCase();
  return ctx.commands.filter(
    (command) =>
      !needle ||
      `${command.label} ${command.labelEs} ${command.group} ${command.groupEs} ${command.keywords}`
        .toLowerCase()
        .includes(needle),
  );
}

export function renderCommands(ctx: RuntimeContext, query = "") {
  const list = ctx.matchingCommands(query);
  ctx.commandIndex = Math.max(0, Math.min(ctx.commandIndex, list.length - 1));
  ctx.$("#commandResults").innerHTML = list.length
    ? list
        .map(
          (command: any, index: number) =>
            `<button class="command-item ${index === ctx.commandIndex ? "active" : ""}" data-command="${ctx.commands.indexOf(command)}" role="option" aria-selected="${index === ctx.commandIndex}"><span><i>${command.icon}</i><b>${ctx.esc(ctx.L(command.label, command.labelEs))}</b></span><kbd>${ctx.L(command.group, command.groupEs)}${command.shortcut ? ` · ${command.shortcut}` : ""}</kbd></button>`,
        )
        .join("")
    : `<div class="command-empty">${msg("ui_f47d23b79773")}</div>`;
  ctx.$$(".command-item").forEach((item) => {
    item.onmouseenter = () => {
      ctx.commandIndex = list.indexOf(ctx.commands[+item.dataset.command]!);
      ctx.renderCommands(ctx.$("#commandSearch").value);
    };
    item.onclick = () => ctx.runCommand(ctx.commands[+item.dataset.command]);
  });
}

export function runCommand(
  ctx: RuntimeContext,
  command: CommandAction | undefined,
) {
  if (!command) return;
  ctx.$("#commandDialog").close();
  command.run();
}

export function openCommands(ctx: RuntimeContext) {
  ctx.commandIndex = 0;
  ctx.$("#commandSearch").value = "";
  ctx.renderCommands();
  ctx.$("#commandDialog").showModal();
  setTimeout(() => ctx.$("#commandSearch").focus(), 0);
}

export function initWorkflowUi(ctx: RuntimeContext) {
  const stored = localStorage.getItem(ctx.UI_STORAGE),
    prefs = ctx.readUiPrefs(),
    defaults =
      !stored && window.matchMedia("(max-width:760px)").matches
        ? ["motionRack", "effectsRack", "macroRack"]
        : [];
  for (const id of new Set([...defaults, ...prefs.collapsed]))
    ctx.setRackCollapsed(id, true, false);
  ctx.toggleFocus(prefs.focus, true);
  document.body.classList.toggle("compact-mode", prefs.compact);
  ctx.$("#compactModeBtn")?.setAttribute("aria-pressed", String(prefs.compact));
  ctx.$("#commandBtn").onclick = ctx.openCommands;
  ctx.$("#focusBtn").onclick = () => ctx.toggleFocus();
  ctx
    .$$(".rack-toggle")
    .forEach(
      (button) =>
        (button.onclick = () =>
          ctx.setRackCollapsed(
            button.dataset.rack,
            !ctx.$(`#${button.dataset.rack}`).classList.contains("collapsed"),
          )),
    );
  ctx.$$(".collapsible-rack").forEach((rack) => {
    const header = rack.firstElementChild as HTMLElement | null;
    header?.addEventListener("click", (event) => {
      if (!rack.classList.contains("collapsed")) return;
      const target = event.target as Element;
      if (target.closest("button, input, select, label")) return;
      ctx.setRackCollapsed(rack.id, false);
    });
  });
  ctx.$("#commandSearch").oninput = () => {
    ctx.commandIndex = 0;
    ctx.renderCommands(ctx.$("#commandSearch").value);
  };
  ctx.$("#commandSearch").onkeydown = (event: KeyboardEvent) => {
    const list = ctx.matchingCommands(ctx.$("#commandSearch").value);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      ctx.commandIndex = Math.min(list.length - 1, ctx.commandIndex + 1);
      ctx.renderCommands(ctx.$("#commandSearch").value);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      ctx.commandIndex = Math.max(0, ctx.commandIndex - 1);
      ctx.renderCommands(ctx.$("#commandSearch").value);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      ctx.runCommand(list[ctx.commandIndex]);
    }
  };
}

export function audioBufferWav(ctx: RuntimeContext, buffer: AudioBuffer) {
  const channels = Math.min(2, buffer.numberOfChannels),
    frames = buffer.length,
    bytes = 44 + frames * channels * 2,
    array = new ArrayBuffer(bytes),
    view = new DataView(array),
    write = (offset: number, text: string) =>
      [...text].forEach((char, index) =>
        view.setUint8(offset + index, char.charCodeAt(0)),
      );
  write(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, frames * channels * 2, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame++)
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, buffer.getChannelData(channel)[frame]!),
      );
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  return new Blob([array], { type: "audio/wav" });
}

export function setupProjectTemplates(ctx: RuntimeContext) {
  if (!ctx.$("#projectTemplate"))
    ctx
      .$("#newBtn")
      .insertAdjacentHTML(
        "beforebegin",
        '<label class="ui-scale-control"><span>PROJECT TEMPLATE</span><select id="projectTemplate"><option value="cinematic">CINEMATIC DEMO</option><option value="minimal">MINIMAL SIGNAL</option><option value="performance">PERFORMANCE RIG</option><option value="audio">AUDIO / RESAMPLE</option></select><button id="applyTemplateBtn">CREATE</button></label>',
      );
  ctx.$("#applyTemplateBtn").onclick = () => {
    const type = ctx.$("#projectTemplate").value,
      next = type === "cinematic" ? createProject() : createEmptyProject();
    if (type === "performance") {
      next.title = "Live Voltage";
      for (const track of TRACKS) activeClip(next, track).bars = 4;
      next.loop = { enabled: true, start: 0, end: 64, punch: false };
    }
    if (type === "audio") {
      next.title = "Hybrid Session";
      next.audioLanes = [
        createAudioLane("RESAMPLE", "#ff3bd4"),
        createAudioLane("VOCALS", "#2ee8ff"),
      ];
    }
    ctx.replaceProject(next);
    ctx.toast(msg("ui_45eb93e37d80"));
  };
}

export function syncClipTransportButton(
  ctx: RuntimeContext,
  running = ctx.engine.playing,
) {
  const button = ctx.$("#clipStartBtn");
  if (!button) return;
  const playing = Boolean(running && !ctx.engine.songMode);
  const label = ctx.L(
    playing ? "Pause active clips" : "Play or resume active clips",
    playing ? "Pausar clips activos" : "Reproducir o reanudar clips activos",
  );
  button.textContent = playing ? ctx.L("Ⅱ PAUSE", "Ⅱ PAUSA") : "▶ CLIP";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-description", label);
  button.dataset.helpTitle = label;
  button.dataset.helpBody = label;
  button.classList.toggle("active", playing);
}

export function syncTransportButtons(
  ctx: RuntimeContext,
  running = ctx.engine.playing,
) {
  studioBridge.update({
    playing: Boolean(running),
    paused: false,
    songMode: Boolean(ctx.engine.songMode),
  });
  controlIcon(
    "playBtn",
    running ? "stop" : "play",
    ctx.L(running ? "Stop" : "Play", running ? "Detener" : "Reproducir"),
  );
  controlIcon("pauseBtn", "pause", ctx.L("Pause", "Pausar"));
  controlIcon(
    "rewindBtn",
    "rewind",
    ctx.L("Return to start", "Volver al inicio"),
  );
  controlIcon(
    "recordBtn",
    "record",
    ctx.L("Arm note recording", "Preparar grabación de notas"),
  );
  ctx.$("#playBtn").classList.toggle("active", running);
  syncClipTransportButton(ctx, running);
  ctx.$("#pauseBtn").disabled = !running;
  ctx.$("#pauseBtn").classList.toggle("active", false);
}

export function wavOptions(ctx: RuntimeContext) {
  const useRegion =
    Boolean(ctx.$("#wavRegion").checked) &&
    ctx.project.loop.end > ctx.project.loop.start;
  return {
    bitDepth: (+ctx.$("#wavDepth").value === 32 ? 32 : 16) as 16 | 32,
    normalize: Boolean(ctx.$("#wavNormalize").checked),
    sampleRate: (+ctx.$("#wavSampleRate").value || 48000) as
      44100 | 48000 | 96000,
    tailSeconds: +ctx.$("#wavTail").value || 0,
    dither: Boolean(ctx.$("#wavDither").checked),
    dry: ctx.$("#wavFx").value === "dry",
    region: useRegion
      ? { start: ctx.project.loop.start, end: ctx.project.loop.end }
      : undefined,
    signal: ctx.exportController?.signal,
    drumSamples: ctx.engine.drumSamples,
    audioAssets: ctx.engine.audioAssets,
  };
}

export async function renderStems(ctx: RuntimeContext) {
  const files: Array<{ name: string; data: Blob }> = [],
    base = ctx.safeName(),
    selected = new Set(
      ctx.$$("[data-stem]:checked").map((input) => input.dataset.stem),
    ),
    jobs =
      (selected.has("master") ? 1 : 0) +
      TRACKS.filter((track) => selected.has(track)).length;
  ctx.exportController = new AbortController();
  ctx.$("#cancelExportBtn").disabled = false;
  let done = 0;
  if (selected.has("master")) {
    ctx.setExportProgress(2, msg("ui_2d45f5b9ff68"));
    files.push({
      name: `${base}-master.wav`,
      data: await renderWav(ctx.project, { song: true, ...ctx.wavOptions() }),
    });
    done++;
  }
  for (const track of TRACKS.filter((track) => selected.has(track))) {
    if (ctx.exportController.signal.aborted)
      throw new DOMException("Export cancelled", "AbortError");
    const isolated = structuredClone(ctx.project);
    TRACKS.forEach((id) => {
      isolated.tracks[id].solo = id === track;
      isolated.tracks[id].mute = false;
    });
    ctx.setExportProgress(
      (done / Math.max(1, jobs)) * 88,
      msg("ui_d89ec6f2ce8f", {
        arg0: done + 1,
        arg1: jobs,
        arg2: TRACK_META[track].label,
      }),
    );
    files.push({
      name: `${base}-${track}.wav`,
      data: await renderWav(isolated, { song: true, ...ctx.wavOptions() }),
    });
    done++;
  }
  if (!files.length) throw new Error(msg("ui_86985f3f6c02"));
  files.push({
    name: "manifest.json",
    data: new Blob(
      [
        JSON.stringify(
          {
            app: "КИБЕР VENGANCE",
            project: ctx.project.title,
            createdAt: new Date().toISOString(),
            sampleRate: +ctx.$("#wavSampleRate").value,
            bitDepth: +ctx.$("#wavDepth").value,
            tracks: [...selected],
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  });
  ctx.setExportProgress(94, msg("ui_3fee92bac100"));
  const zip = await ctx.zipFiles(files);
  ctx.setExportProgress(100);
  ctx.exportController = null;
  ctx.$("#cancelExportBtn").disabled = true;
  return zip;
}

export async function renderProjectBundle(ctx: RuntimeContext) {
  const files: Array<{ name: string; data: Blob }> = [
    {
      name: `${ctx.safeName()}.kiber.json`,
      data: new Blob([JSON.stringify(ctx.project, null, 2)], {
        type: "application/json",
      }),
    },
  ];
  const manifest: Array<{
    id: string;
    name: string;
    type: string;
    path: string;
  }> = [];
  const missing: string[] = [];
  for (const asset of projectAssets(ctx.project)) {
    const blob = await ctx.getAsset(asset.id);
    if (!blob) {
      missing.push(`${asset.name} (${asset.id})`);
      continue;
    }
    const path = `assets/${manifest.length}`;
    files.push({ name: path, data: blob });
    manifest.push({ ...asset, type: blob.type || asset.type, path });
  }
  if (missing.length)
    throw new Error(
      `Missing audio assets: ${missing.join(", ")}. Save project JSON to preserve references.`,
    );
  files.push({
    name: "assets.json",
    data: new Blob([JSON.stringify({ version: 1, assets: manifest })], {
      type: "application/json",
    }),
  });
  files.push({
    name: "PACKAGE-README.txt",
    data: new Blob(
      [
        "КИБЕР VENGANCE v6 project package\nImport this ZIP from Project Core. КИБЕР VENGANCE restores takes, sampler, audio-region and drum-sample assets into local browser storage.\n",
      ],
      { type: "text/plain" },
    ),
  });
  return ctx.zipFiles(files);
}

export function compatibility(ctx: RuntimeContext) {
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    audioContext: Boolean(window.AudioContext || window.webkitAudioContext),
    offlineAudio: Boolean(window.OfflineAudioContext),
    webMidi: Boolean(navigator.requestMIDIAccess),
    fileSystemAccess: Boolean(window.showSaveFilePicker),
    serviceWorker: Boolean(navigator.serviceWorker),
    secureContext: window.isSecureContext,
    platform: navigator.platform || "unknown",
    sampleRate: ctx.engine.ctx?.sampleRate || "not initialized",
    audioState: ctx.engine.ctx?.state || "not initialized",
  };
}

export function showCompatibility(ctx: RuntimeContext) {
  const data = ctx.compatibility();
  ctx.$("#compatReport").innerHTML = Object.entries(data)
    .map(
      ([key, value]) =>
        `<div><span>${ctx.esc(key)}</span><b class="${value === false ? "bad" : "good"}">${ctx.esc(value)}</b></div>`,
    )
    .join("");
  ctx.open("#compatDialog");
  return data;
}

export function setupStudioUi(ctx: RuntimeContext) {
  const bar = document.createElement("div");
  bar.className = "studio-context";
  bar.innerHTML =
    '<strong id="clipContext"></strong><div class="studio-tabs"></div><p id="recordHint"></p><p id="saveWarning" role="alert" hidden></p>';
  ctx.$("#forgeView").prepend(bar);
  const tools = document.createElement("div");
  tools.className = "editor-tools";
  tools.setAttribute("role", "group");
  tools.setAttribute("aria-label", "Editor tools");
  for (const [tool, en, es] of [
    ["draw", "Draw", "Dibujar"],
    ["select", "Select", "Seleccionar"],
    ["navigate", "Navigate", "Navegar"],
  ]) {
    const button = document.createElement("button");
    button.dataset.editorTool = tool;
    button.dataset.en = en;
    button.dataset.es = es;
    button.textContent = ctx.L(en!, es!);
    button.onclick = () => {
      ctx.editorTool = tool as typeof ctx.editorTool;
      ctx.syncStudioUi();
    };
    tools.append(button);
  }
  const newClip = document.createElement("button");
  newClip.dataset.en = "+ New clip";
  newClip.dataset.es = "+ Nuevo clip";
  newClip.textContent = msg("ui_0d852107f892");
  newClip.onclick = () => ctx.$("#newClipBtn").click();
  tools.append(newClip);
  const undo = document.createElement("button");
  undo.dataset.en = "Undo";
  undo.dataset.es = "Deshacer";
  undo.textContent = msg("ui_39fc72124884");
  undo.onclick = () => ctx.$("#undoBtn").click();
  tools.append(undo);
  ctx.$(".piano-shell").before(tools);
  const selection = document.createElement("div");
  selection.className = "selection-actions";
  selection.setAttribute("role", "group");
  selection.setAttribute("aria-label", msg("ui_ca6d8136afdb"));
  for (const [action, en, es] of [
    ["duplicate", "Duplicate notes", "Duplicar notas"],
    ["quantize", "Quantize notes", "Cuantizar notas"],
    ["delete", "Delete notes", "Borrar notas"],
  ]) {
    const button = document.createElement("button");
    button.dataset.selectionAction = action;
    button.dataset.en = en;
    button.dataset.es = es;
    button.textContent = ctx.L(en!, es!);
    button.onclick =
      action === "duplicate"
        ? ctx.duplicateSelectedNotes
        : action === "quantize"
          ? ctx.quantizeSelectedNotes
          : ctx.deleteSelection;
    selection.append(button);
  }
  tools.after(selection);
  ctx.renderSelection();
  const automation = document.createElement("details");
  automation.className = "automation-disclosure";
  const automationLabel = document.createElement("summary");
  automationLabel.dataset.en = "Clip automation";
  automationLabel.dataset.es = "Automatización del clip";
  automationLabel.textContent = ctx.L(
    automationLabel.dataset.en,
    automationLabel.dataset.es,
  );
  automation.append(automationLabel);
  ctx.$(".automation-head").before(automation);
  automation.append(ctx.$(".automation-head"), ctx.$("#automationPane"));
  automation.addEventListener("toggle", () => {
    if (automation.open) {
      ctx.renderAutomation();
      ctx.syncRollScroll();
    }
  });

  const advanced = document.createElement("details");
  advanced.className = "export-advanced";
  const summary = document.createElement("summary");
  summary.dataset.en = "Advanced export options";
  summary.dataset.es = "Opciones avanzadas de exportación";
  summary.textContent = ctx.L(summary.dataset.en, summary.dataset.es);
  advanced.append(summary);
  ctx.$(".export-options").before(advanced);
  advanced.append(ctx.$(".export-options"), ctx.$(".stem-selection"));
  const quick = document.createElement("div");
  quick.className = "export-simple";
  for (const [kind, en, es] of [
    ["bundle", "Save complete project", "Guardar proyecto completo"],
    ["wav", "Export audio", "Exportar audio"],
    ["midi", "Export MIDI", "Exportar MIDI"],
  ]) {
    const button = document.createElement("button");
    button.dataset.en = en;
    button.dataset.es = es;
    button.textContent = ctx.L(en!, es!);
    button.onclick = () => ctx.performExport(kind as QuickExportKind, true);
    quick.append(button);
  }
  advanced.before(quick);
  const other = document.createElement("details");
  other.className = "export-advanced";
  const otherLabel = document.createElement("summary");
  otherLabel.dataset.en = "More formats and linked destinations";
  otherLabel.dataset.es = "Más formatos y destinos vinculados";
  otherLabel.textContent = ctx.L(otherLabel.dataset.en, otherLabel.dataset.es);
  other.append(otherLabel);
  ctx.$(".export-grid").before(other);
  other.append(ctx.$(".export-grid"));
  const music = document.createElement("details");
  music.className = "composition-options";
  const musicLabel = document.createElement("summary");
  musicLabel.dataset.en = "Generate music and harmony";
  musicLabel.dataset.es = "Generar música y armonía";
  musicLabel.textContent = ctx.L(musicLabel.dataset.en, musicLabel.dataset.es);
  music.append(musicLabel);
  ctx.$(".composition-tools").before(music);
  music.append(ctx.$(".harmony"), ctx.$(".generators"));
  const copy: Array<[string, string, string]> = [
    ["#duplicateBtn", "Duplicate clip", "Duplicar clip"],
    ["#mutateBtn", "Create variation", "Crear variación"],
    ["#quantizeBtn", "Quantize clip", "Cuantizar clip"],
    ["#deleteNotesBtn", "Delete notes", "Borrar notas"],
    ["#backingBtn", "Create backing", "Crear base"],
    ["#clearAutomationBtn", "Clear lane", "Borrar curva"],
    ["#exportDialog h2", "Save and export", "Guardar y exportar"],
    [
      "#exportDialog>p",
      "Save a complete project to keep your audio assets. Audio and MIDI exports are for sharing your music.",
      "Guarda el proyecto completo para conservar tus archivos de audio. Exporta audio o MIDI para compartir tu música.",
    ],
  ];
  for (const [selector, en, es] of copy) {
    const node = ctx.$(selector);
    if (node) {
      node.dataset.en = en;
      node.dataset.es = es;
      node.textContent = ctx.L(en, es);
    }
  }
  const translate = () => {
    ctx
      .$$("[data-en][data-es]")
      .forEach(
        (el: any) => (el.textContent = ctx.L(el.dataset.en, el.dataset.es)),
      );
    ctx.syncStudioUi();
  };
  ctx.$("#languageSelect").addEventListener("change", translate);
  ctx.$("#menuLanguageSelect").addEventListener("change", translate);
  ctx.syncStudioUi();
}

export function setupConsistentControls(ctx: RuntimeContext) {
  const labels: Array<[string, string, string]> = [
    ["scratchCaptureBtn", "Capture mix", "Capturar mezcla"],
    ["scratchBrakeBtn", "Brake", "Frenar"],
    ["scratchSpinBtn", "Spinback", "Retroceso"],
    ["scratchStutterBtn", "Stutter", "Repetir"],
    ["audioLaneBtn", "Add audio lane", "Añadir pista de audio"],
    ["automationLaneBtn", "Add automation", "Añadir automatización"],
    ["modulationBtn", "Add modulation", "Añadir modulación"],
    ["scratchReverse", "Reverse", "Reversa"],
    ["scratchRestart", "Back to start", "Volver al inicio"],
  ];
  for (const [id, en, es] of labels) {
    const node = ctx.$("#" + id);
    node.dataset.en = en;
    node.dataset.es = es;
    node.textContent = ctx.L(en, es);
  }
  const refreshState = () => {
    ctx.updateScratchPlayButton();
    ctx.$("#audioRecordBtn").textContent =
      ctx.inputRecorder?.state === "recording"
        ? msg("ui_ee0d9dc8eb5e")
        : msg("ui_5a4f7e54c5ac");
  };
  ctx.$("#languageSelect").addEventListener("change", refreshState);
  ctx.$("#menuLanguageSelect").addEventListener("change", refreshState);
  refreshState();
  const wave = ctx.$("#scratchWaveform");
  wave.tabIndex = 0;
  wave.setAttribute("role", "slider");
  wave.setAttribute("aria-label", msg("ui_ecf5bd269a5d"));
  wave.setAttribute("aria-valuemin", "0");
  wave.setAttribute("aria-valuemax", "100");
  wave.setAttribute("aria-valuenow", "0");
  const seek = (fraction: number) => {
    if (!ctx.scratchBuffer || !ctx.engine.scratchFrames) return;
    const f = Math.max(0, Math.min(1, fraction));
    ctx.scratchStuttering = false;
    ctx.engine.setScratchStutter(0);
    ctx.$("#scratchStutterBtn").setAttribute("aria-pressed", "false");
    const frame = Math.round(f * (ctx.engine.scratchFrames - 1));
    ctx.engine.scratchNode?.port.postMessage({ type: "seek", frame });
    ctx.engine.scratchPosition = frame;
    wave.setAttribute("aria-valuenow", String(Math.round(f * 100)));
    ctx.$("#scratchWavePlayhead").style.left = `${f * 100}%`;
  };
  let pointer: number | null = null;
  const at = (e: PointerEvent) => {
    const r = wave.getBoundingClientRect();
    seek((e.clientX - r.left) / r.width);
  };
  wave.onpointerdown = (e: PointerEvent) => {
    if (!ctx.scratchBuffer || e.button !== 0 || pointer !== null) return;
    e.preventDefault();
    pointer = e.pointerId;
    wave.setPointerCapture(pointer);
    at(e);
  };
  wave.onpointermove = (e: PointerEvent) => {
    if (e.pointerId === pointer) {
      e.preventDefault();
      at(e);
    }
  };
  const end = (e: PointerEvent) => {
    if (pointer !== e.pointerId) return;
    pointer = null;
    if (wave.hasPointerCapture(e.pointerId))
      wave.releasePointerCapture(e.pointerId);
  };
  wave.onpointerup = wave.onpointercancel = wave.onlostpointercapture = end;
  wave.onkeydown = (e: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const fraction =
      (ctx.engine.scratchPosition || 0) /
      Math.max(1, ctx.engine.scratchFrames || 1);
    seek(
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? 1
          : fraction +
            (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 0.1 : 0.01),
    );
  };
  const save = document.createElement("button");
  save.id = "scratchKeep";
  save.dataset.en = "Keep in project";
  save.dataset.es = "Guardar en proyecto";
  save.textContent = ctx.L(save.dataset.en, save.dataset.es);
  ctx.$(".scratch-pro").append(save);
  save.onclick = async () => {
    if (!ctx.scratchBuffer) {
      ctx.toast(msg("ui_bcf160e1ec0b"));
      return;
    }
    save.disabled = true;
    try {
      await ctx.addAudioBlob(
        ctx.audioBufferWav(ctx.scratchBuffer),
        "Scratch.wav",
      );
    } catch (error) {
      ctx.toast(String(error));
    } finally {
      save.disabled = false;
    }
  };
  const hint = document.createElement("p");
  hint.dataset.en =
    "Temporary deck audio · touch or drag the waveform to seek. Keep in project saves a copy in Audio.";
  hint.dataset.es =
    "Audio temporal del plato · toca o arrastra la onda para moverte. Guardar en proyecto conserva una copia en Audio.";
  hint.textContent = ctx.L(hint.dataset.en, hint.dataset.es);
  ctx.$(".scratch-pro p").replaceWith(hint);
  for (const id of [
    "audioLaneBtn",
    "automationLaneBtn",
    "modulationBtn",
    "monoCheckBtn",
  ]) {
    const el = ctx.$("#" + id),
      original = el.onclick;
    el.onclick = (event: Event) => {
      original?.call(el, event);
      ctx.toast(msg("ui_a0e9a7078f38"), true);
    };
  }
  const dialog = document.createElement("dialog");
  dialog.id = "timingDialog";
  document.body.append(dialog);
  const editTiming = (meter: boolean) => {
    dialog.innerHTML = `<form method="dialog"><h2>${meter ? msg("ui_a3d8064fea08") : msg("ui_dd76826c30cf")}</h2><label>${msg("ui_5f4e01e07a8f")}<input name="position" type="number" min="0" step="1" value="0" required></label>${meter ? `<label>${msg("ui_12aafda0ef58")}<input name="beats" type="number" min="1" max="12" value="4" required></label><label>${msg("ui_576e1add5765")}<select name="unit"><option>4</option><option>8</option></select></label>` : `<label>BPM<input name="bpm" type="number" min="30" max="300" value="${ctx.project.tempo}" required></label>`}<div><button type="button" id="cancelTiming">${msg("ui_77dfd2135f4d")}</button><button type="submit">${msg("ui_95f1f6a34d76")}</button></div></form>`;
    ctx.$("#cancelTiming").onclick = () => dialog.close();
    dialog.querySelector("form")!.onsubmit = (e) => {
      e.preventDefault();
      const data = new window.FormData(dialog.querySelector("form")!);
      ctx.snapshot();
      const step = Number(data.get("position"));
      if (meter)
        ctx.project.meterMap.push({
          id: cryptoId(),
          step,
          beats: Number(data.get("beats")),
          unit: Number(data.get("unit")),
        });
      else
        ctx.project.tempoMap.push({
          id: cryptoId(),
          step,
          bpm: Number(data.get("bpm")),
          curve: "jump",
        });
      ctx.changed();
      ctx.renderArrangement();
      ctx.renderTempoMap();
      dialog.close();
      ctx.toast(msg("ui_1532b145a7df"), true);
    };
    dialog.showModal();
  };
  ctx.$("#tempoEventBtn").onclick = () => editTiming(false);
  ctx.$("#meterEventBtn").onclick = () => editTiming(true);
}
