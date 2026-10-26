import { requestConfirmation } from "../ui/dialogs";
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

const heldPerformanceKeys = new Map<string, HTMLElement[]>();

export function pitches(ctx: RuntimeContext) {
  if (ctx.selectedTrack === "drums")
    return DRUM_NAMES.map((_, i) => DRUM_NAMES.length - 1 - i);
  const m = TRACK_META[ctx.selectedTrack],
    out = [];
  for (let p = m.high; p >= m.low; p--) out.push(p);
  return out;
}

export function renderPiano(ctx: RuntimeContext) {
  const c = ctx.clip(),
    rows = ctx.pitches(),
    zoom = ctx.project.editor.zoom,
    rowH = 22,
    steps = clipLengthSteps(c),
    pane = ctx.$("#rollPane"),
    old = ctx.rollScroll[ctx.selectedTrack] || {
      left: pane?.scrollLeft || 0,
      top: pane?.scrollTop || 0,
    };
  ctx.$("#pianoLabelRows").innerHTML = rows
    .map(
      (p: number) =>
        `<div class="pitch-label ${ctx.selectedTrack !== "drums" && isInScale(p, ctx.project.key, ctx.project.scale) ? "in-scale" : ""}">${ctx.selectedTrack === "drums" ? (DRUM_NAMES[p] ?? "DRUM") : (ctx.pitchNames[p % 12] ?? "N") + Math.floor(p / 12 - 1)}</div>`,
    )
    .join("");
  ctx.$("#pianoLabelRows").style.height = `${rows.length * rowH}px`;
  const barSteps = c.stepsPerBar || meterSteps(ctx.project.meter),
    beatSteps = ctx.project.meter.unit === 8 ? 2 : 4;
  ctx.$("#rollRuler").innerHTML =
    `<div class="ruler-content" style="width:${steps * zoom}px">${Array.from({ length: steps }, (_, s) => `<span style="left:${s * zoom}px;width:${zoom}px">${s % barSteps === 0 ? `BAR ${s / barSteps + 1}` : s % beatSteps === 0 ? (Math.floor(s / beatSteps) % ctx.project.meter.beats) + 1 : ""}</span>`).join("")}</div>`;
  const seq = ctx.$("#sequencer");
  seq.style.width = `${steps * zoom}px`;
  seq.style.height = `${rows.length * rowH}px`;
  seq.style.setProperty("--step", `${zoom}px`);
  seq.style.setProperty("--beat", `${zoom * beatSteps}px`);
  seq.style.setProperty("--bar", `${zoom * barSteps}px`);
  seq.style.setProperty("--row", `${rowH}px`);
  seq.innerHTML =
    c.notes
      .map((n) => {
        const row =
          ctx.selectedTrack === "drums"
            ? DRUM_NAMES.length - 1 - n.pitch
            : TRACK_META[ctx.selectedTrack].high - n.pitch;
        if (row < 0 || row >= rows.length) return "";
        return `<button class="note-block ${ctx.selectedNotes.has(n.id) ? "selected" : ""}" data-note="${n.id}" style="left:${(n.step + (n.offset || 0)) * zoom + 1}px;top:${row * rowH + 2}px;width:${Math.max(5, n.length * zoom - 2)}px;height:${rowH - 4}px;--vel:${n.velocity}" title="${ctx.selectedTrack === "drums" ? DRUM_NAMES[n.pitch] : ctx.pitchNames[n.pitch % 12]} · ${n.length.toFixed(3)} steps · offset ${(n.offset || 0).toFixed(3)} · velocity ${Math.round(n.velocity * 127)}"><span class="note-resize"></span></button>`;
      })
      .join("") +
    `<div class="roll-playhead" style="left:${Math.max(0, ctx.currentStep % steps) * zoom}px"></div>`;
  seq.onclick = (e: any) => {
    if (ctx.suppressSequencerClick) {
      ctx.suppressSequencerClick = false;
      return;
    }
    if (ctx.editorTool !== "draw" || e.target !== seq) return;
    const rect = seq.getBoundingClientRect(),
      step = Math.max(
        0,
        Math.min(
          steps - ctx.project.editor.snap,
          Math.floor((e.clientX - rect.left) / zoom / ctx.project.editor.snap) *
            ctx.project.editor.snap,
        ),
      ),
      row = Math.floor((e.clientY - rect.top) / rowH),
      pitch = rows[row];
    if (pitch == null) return;
    ctx.snapshot();
    const n = makeNote(
      step,
      pitch,
      ctx.selectedTrack === "drums" ? 1 : Math.max(ctx.project.editor.snap, 1),
      e.shiftKey ? 1 : 0.8,
    );
    c.notes.push(n);
    ctx.selectedNotes = e.shiftKey
      ? new Set([...ctx.selectedNotes, n.id])
      : new Set([n.id]);
    ctx.changed();
    ctx.engine.preview(ctx.selectedTrack, pitch, n.velocity);
    ctx.renderPiano();
    ctx.renderSelection();
  };
  ctx.bindMarqueeSelection(seq);
  ctx
    .$$(".note-block")
    .forEach((el) => ctx.bindNoteDrag(el, c, rows, zoom, rowH));
  pane.scrollLeft = Math.min(
    old.left,
    Math.max(0, steps * zoom - pane.clientWidth),
  );
  pane.scrollTop = Math.min(
    old.top,
    Math.max(0, rows.length * rowH - pane.clientHeight),
  );
  ctx.syncRollScroll();
  pane.onscroll = () => {
    ctx.rollScroll[ctx.selectedTrack] = {
      left: pane.scrollLeft,
      top: pane.scrollTop,
    };
    ctx.syncRollScroll();
  };
  ctx.renderSelection();
}

export function bindMarqueeSelection(ctx: RuntimeContext, seq: any) {
  seq.onpointerdown = (e: any) => {
    if (
      ctx.editorTool === "navigate" ||
      e.target !== seq ||
      (e.button != null && e.button !== 0) ||
      e.pointerType === "touch"
    )
      return;
    const rect = seq.getBoundingClientRect(),
      clamp = (value: number, max: number) => Math.max(0, Math.min(max, value)),
      startX = clamp(e.clientX - rect.left, seq.clientWidth),
      startY = clamp(e.clientY - rect.top, seq.clientHeight),
      base = e.shiftKey ? new Set(ctx.selectedNotes) : new Set<string>(),
      box = document.createElement("div");
    box.className = "selection-marquee";
    seq.append(box);
    let moved = false;
    const move = (ev: any) => {
        const x = clamp(ev.clientX - rect.left, seq.clientWidth),
          y = clamp(ev.clientY - rect.top, seq.clientHeight),
          left = Math.min(startX, x),
          top = Math.min(startY, y),
          right = Math.max(startX, x),
          bottom = Math.max(startY, y);
        if (!moved && Math.hypot(x - startX, y - startY) < 4) return;
        moved = true;
        ev.preventDefault();
        Object.assign(box.style, {
          left: `${left}px`,
          top: `${top}px`,
          width: `${right - left}px`,
          height: `${bottom - top}px`,
        });
        const next = new Set(base);
        seq.querySelectorAll(".note-block").forEach((note: any) => {
          const noteRight = note.offsetLeft + note.offsetWidth,
            noteBottom = note.offsetTop + note.offsetHeight;
          if (
            note.offsetLeft <= right &&
            noteRight >= left &&
            note.offsetTop <= bottom &&
            noteBottom >= top
          )
            next.add(note.dataset.note);
        });
        ctx.selectedNotes = next;
        ctx.syncSelectedClasses();
        ctx.renderSelection();
      },
      up = () => {
        box.remove();
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (moved) {
          ctx.suppressSequencerClick = true;
          ctx.renderSelection();
        }
      };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
}

export function syncSelectedClasses(ctx: RuntimeContext) {
  ctx
    .$$(".note-block")
    .forEach((n) =>
      n.classList.toggle("selected", ctx.selectedNotes.has(n.dataset.note)),
    );
}

export function syncRollScroll(ctx: RuntimeContext) {
  const pane = ctx.$("#rollPane"),
    content = ctx.$("#rollRuler .ruler-content");
  if (content) content.style.transform = `translateX(${-pane.scrollLeft}px)`;
  ctx.$("#pianoLabelRows").style.transform = `translateY(${-pane.scrollTop}px)`;
  ctx.$("#automationPane").scrollLeft = pane.scrollLeft;
}

export function setDefaultScroll(ctx: RuntimeContext) {
  setTimeout(() => {
    const pane = ctx.$("#rollPane");
    if (!pane || ctx.selectedTrack === "drums") return;
    const row =
      (TRACK_META[ctx.selectedTrack].high -
        TRACK_META[ctx.selectedTrack].base) *
      22;
    pane.scrollTop = Math.max(0, row - pane.clientHeight / 2);
    ctx.rollScroll[ctx.selectedTrack] = { left: 0, top: pane.scrollTop };
    ctx.syncRollScroll();
  }, 0);
}

export function renderSelection(ctx: RuntimeContext) {
  const notes = ctx.clip().notes.filter((n) => ctx.selectedNotes.has(n.id));
  ctx.$("#selectionCount").textContent =
    ctx.language === "es"
      ? `${notes.length} NOTA${notes.length === 1 ? "" : "S"}`
      : `${notes.length} NOTE${notes.length === 1 ? "" : "S"}`;
  ctx.$("#noteLength").disabled = !notes.length;
  ctx.$("#noteVelocity").disabled = !notes.length;
  ctx.$("#deleteNotesBtn").disabled = !notes.length;
  ctx
    .$$("[data-selection-action]")
    .forEach((button: any) => (button.disabled = !notes.length));
  if (notes.length) {
    ctx.$("#noteLength").value = notes[0]!.length;
    ctx.$("#noteVelocity").value =
      notes.reduce((a, n) => a + n.velocity, 0) / notes.length;
  }
}

export function editSelection(ctx: RuntimeContext, key: any, value: any) {
  const notes = ctx.clip().notes.filter((n) => ctx.selectedNotes.has(n.id));
  if (!notes.length) return;
  ctx.snapshot();
  for (const n of notes)
    (n as any)[key] =
      key === "velocity"
        ? Math.max(0.01, Math.min(1, +value))
        : Math.max(
            ctx.project.editor.snap,
            Math.min(clipLengthSteps(ctx.clip()) - n.step, +value),
          );
  ctx.changed();
  ctx.renderPiano();
}

export function deleteSelection(ctx: RuntimeContext) {
  if (!ctx.selectedNotes.size) return;
  ctx.snapshot();
  ctx.clip().notes = ctx
    .clip()
    .notes.filter((n) => !ctx.selectedNotes.has(n.id));
  ctx.selectedNotes.clear();
  ctx.changed();
  ctx.renderPiano();
  ctx.renderSelection();
  ctx.toast(msg("ui_44d1eda524dc"), true);
}

export function releaseKeyPointer(ctx: RuntimeContext, pointerId: number) {
  const held = ctx.heldKeyPointers.get(pointerId);
  if (!held) return;
  ctx.heldKeyPointers.delete(pointerId);
  ctx.endPerformance(held.source, held.key);
}

export function releaseKeyPointers(ctx: RuntimeContext) {
  for (const id of [...ctx.heldKeyPointers.keys()]) ctx.releaseKeyPointer(id);
}

export function renderKeyboard(ctx: RuntimeContext) {
  const base = TRACK_META[ctx.selectedTrack].base + ctx.instrumentOctave * 12,
    isDrums = ctx.selectedTrack === "drums";
  const notes = Array.from({ length: isDrums ? 7 : 25 }, (_, i) => ({
    pitch: isDrums ? i : base + i,
    label: isDrums ? DRUM_NAMES[i]! : ctx.pitchNames[(base + i) % 12]!,
    shortcut: isDrums ? "asdfghj"[i] || "" : ctx.keyMap[i] || "",
    root: !isDrums && i === 0,
  }));
  for (const id of ["keyboard", "performanceKeyboard"])
    mountKeyboard(ctx.$("#" + id), {
      notes,
      language: ctx.language,
      label: TRACK_META[ctx.selectedTrack].label,
      sourcePrefix: `${id}-${ctx.selectedTrack}`,
      kind: isDrums ? "pads" : "piano",
      onStart: ctx.startPerformance,
      onEnd: ctx.endPerformance,
      ...(!isDrums
        ? {
            octave: `C${Math.floor(base / 12) - 1}`,
            onOctave: (offset: number) => {
              ctx.instrumentOctave = Math.max(
                -2,
                Math.min(2, ctx.instrumentOctave + offset),
              );
              ctx.renderKeyboard();
            },
          }
        : {}),
    });
}

export function startPerformance(
  ctx: RuntimeContext,
  source: string,
  pitch: number,
  velocity = 0.8,
  el: any = null,
  expression: Partial<NoteExpression> = {},
  channel: number | null = null,
) {
  if (ctx.samplerArmed && ctx.activeView === "audio") {
    const keyboardOffset = ctx.samplerQwertyMap[source],
      samplerPitch =
        keyboardOffset != null ? ctx.samplerQwertyBase + keyboardOffset : pitch,
      samplerKey = ctx.$(
        `[data-sampler-pitch="${samplerPitch}"]`,
      ) as HTMLElement | null;
    ctx.startSamplerPerformance(source, samplerPitch, velocity, samplerKey);
    return;
  }
  const keys = ctx.keyMap.includes(source) && source.length === 1
    ? ctx.$$(`#keyboard .key[data-pitch="${pitch}"], #performanceKeyboard .key[data-pitch="${pitch}"]`)
    : el ? [el] : [];
  heldPerformanceKeys.set(source, keys);
  for (const key of keys) {
    key.classList.add("active");
    key.setAttribute("aria-pressed", "true");
  }
  ctx.engine.startLive(
    source,
    ctx.selectedTrack,
    pitch,
    velocity,
    expression,
    channel,
  );
  if (
    ctx.recordArmed &&
    ctx.engine.playing &&
    (!ctx.project.loop.punch ||
      (ctx.transportPosition >= ctx.project.loop.start &&
        ctx.transportPosition < ctx.project.loop.end))
  ) {
    const free = ctx.project.editor.recordMode === "free",
      raw = ctx.engine.recordPosition(ctx.selectedTrack, { quantized: false });
    if (raw == null) return;
    const c = ctx.clip(),
      unwrapped =
        Math.round(raw / ctx.project.editor.snap) * ctx.project.editor.snap,
      step = free
        ? unwrapped % clipLengthSteps(c)
        : ctx.engine.recordPosition(ctx.selectedTrack),
      offset = free ? raw - unwrapped : 0;
    ctx.snapshot();
    const n = makeNote(
      step ?? 0,
      pitch,
      free ? 0.05 : ctx.project.editor.snap,
      velocity,
      offset,
      expression,
    );
    c.notes.push(n);
    ctx.recording.set(source, {
      note: n,
      startRaw: raw,
      start: step ?? 0,
      clipId: c.id,
      channel,
    });
    ctx.selectedNotes = new Set([n.id]);
    ctx.renderPiano();
  }
}

export function endPerformance(
  ctx: RuntimeContext,
  source: string,
  el: any = null,
) {
  if (ctx.engine.samplerVoices.has(source)) {
    ctx.endSamplerPerformance(source);
    return;
  }
  const keys = heldPerformanceKeys.get(source) || (el ? [el] : []);
  heldPerformanceKeys.delete(source);
  for (const key of keys) {
    const held = [...heldPerformanceKeys.values()].some((other) => other.includes(key));
    key.classList.toggle("active", held);
    key.setAttribute("aria-pressed", String(held));
  }
  ctx.engine.stopLive(source);
  const rec = ctx.recording.get(source);
  if (!rec) return;
  const c = ctx.project.clips.find((x: any) => x.id === rec.clipId);
  if (!c) {
    ctx.recording.delete(source);
    return;
  }
  const free = ctx.project.editor.recordMode === "free",
    end = ctx.engine.recordPosition(c.track, { quantized: !free });
  if (end != null) {
    let length = end - (free ? rec.startRaw : rec.start);
    if (length <= 0) length += clipLengthSteps(c);
    rec.note.length = Math.max(free ? 0.01 : ctx.project.editor.snap, length);
    ctx.changed();
    ctx.renderPiano();
  }
  ctx.recording.delete(source);
}

export function updatePlayheads(ctx: RuntimeContext) {
  const c = ctx.clip(),
    steps = clipLengthSteps(c),
    local =
      ctx.currentStep < 0
        ? ctx.clipStartSteps.get(c.id) || 0
        : ctx.currentStep % steps;
  const p = ctx.$(".roll-playhead"),
    a = ctx.$(".automation-playhead");
  if (p) p.style.left = `${local * ctx.project.editor.zoom}px`;
  if (a) a.style.left = `${local * ctx.project.editor.zoom}px`;
  ctx
    .$$(".scene")
    .forEach((s, i) =>
      s.classList.toggle(
        "playing",
        ctx.engine.playing && ctx.engine.songMode && i === ctx.currentScene,
      ),
    );
  const global = ctx.$(".arrange-playhead"),
    duration = ctx.songLength();
  if (global)
    global.style.left = `${duration ? (ctx.transportPosition / duration) * 100 : 0}%`;
}

export function updatePosition(ctx: RuntimeContext) {
  if (ctx.currentStep < 0) {
    ctx.$("#positionReadout").textContent = "BAR 1 · STEP 1";
    return;
  }
  const bar = ctx.clip().stepsPerBar || meterSteps(ctx.project.meter),
    step = ctx.engine.songMode
      ? ctx.currentStep
      : ctx.currentStep % clipLengthSteps(ctx.clip());
  ctx.$("#positionReadout").textContent =
    `BAR ${Math.floor(step / bar) + 1} · STEP ${(step % bar) + 1}`;
}

export function renderLocators(ctx: RuntimeContext) {
  const length = ctx.songLength(),
    clipLength = clipLengthSteps(ctx.clip());
  ctx.globalStartStep = Math.min(ctx.globalStartStep, Math.max(0, length - 1));
  ctx.$("#globalPosition").max = Math.max(1, length - 1);
  ctx.$("#globalPosition").value = ctx.globalStartStep;
  ctx.$("#globalPositionValue").textContent = ctx.formatLocator(
    ctx.globalStartStep,
  );
  const local = Math.min(
    ctx.clipStartSteps.get(ctx.clip().id) || 0,
    Math.max(0, clipLength - 1),
  );
  ctx.clipStartSteps.set(ctx.clip().id, local);
  ctx.$("#clipPosition").max = Math.max(1, clipLength - 1);
  ctx.$("#clipPosition").value = local;
  ctx.setClipStart(local, false);
}

export function syncLocatorsFromPlayback(ctx: RuntimeContext) {
  if (!ctx.engine.playing) return;
  if (ctx.engine.songMode) {
    ctx.$("#globalPosition").value = ctx.transportPosition;
    ctx.$("#globalPositionValue").textContent = ctx.formatLocator(
      ctx.transportPosition,
    );
  } else {
    const step = Math.max(0, ctx.currentStep) % clipLengthSteps(ctx.clip());
    ctx.$("#clipPosition").value = step;
    ctx.$("#clipPositionValue").textContent =
      `${msg("ui_a5d5c1bba91f")} ${Math.floor(step / meterSteps(ctx.project.meter)) + 1} · ${msg("ui_0c9b85f56357")} ${(step % meterSteps(ctx.project.meter)) + 1}`;
  }
}

export function recordPerformanceEvent(
  ctx: RuntimeContext,
  kind: PerformanceEvent["kind"],
  target: string,
  value: number | string | boolean,
) {
  if (!ctx.performanceEvents) return;
  const step = ctx.performanceStep(),
    key = `${kind}:${target}`,
    last = ctx.performanceEventThrottle.get(key) ?? -1;
  if (step - last < 0.12) return;
  ctx.performanceEventThrottle.set(key, step);
  ctx.performanceEvents.push({
    id: crypto.randomUUID(),
    step,
    kind,
    target,
    value,
  });
}

export async function loadPerformanceAudio(
  ctx: RuntimeContext,
  take: PerformanceTake,
) {
  if (!take.audioAssetId) return null;
  return ctx.getAsset(take.audioAssetId);
}

export function applyPerformanceEvent(
  ctx: RuntimeContext,
  event: PerformanceEvent,
) {
  if (event.kind === "macro") {
    const [clipId, key] = event.target.split(":"),
      target = ctx.project.clips.find((item: any) => item.id === clipId);
    if (target && key) target.character.macros[key] = +event.value;
  } else if (event.kind === "mixer") {
    if (event.target === "master:volume") {
      ctx.project.master = +event.value;
      ctx.engine.setProject(ctx.project);
      return;
    }
    if (event.target === "master:bypass") {
      ctx.project.masterSettings.bypass = Boolean(event.value);
      ctx.engine.setProject(ctx.project);
      return;
    }
    const [track, key] = event.target.split(":") as [TrackId, string],
      cfg = ctx.project.tracks[track];
    if (!cfg || !key) return;
    if (key === "solo") {
      TRACKS.forEach((id) => (ctx.project.tracks[id].solo = false));
      cfg.solo = Boolean(event.value);
    } else if (key === "faderDb")
      cfg.volume = +event.value <= -60 ? 0 : 10 ** (+event.value / 20);
    else if (key === "delay" || key === "reverb")
      activeClip(ctx.project, track).character.fx[key] = +event.value;
    else (cfg as any)[key] = event.value;
  } else if (event.kind === "scratch") {
    const deck = event.target.startsWith("B:") ? "B" : "A";
    const target = deck === "B" ? event.target.slice(2) : event.target;
    if (target === "speed")
      ctx.engine.setScratchSpeed(+event.value, 0.01, deck);
    if (target === "mix") ctx.engine.setScratchMix(+event.value);
    if (target === "crossfade") ctx.engine.setScratchCrossfade(+event.value);
    if (target === "filter") ctx.engine.setScratchFilter(+event.value, deck);
    if (target === "stutter")
      ctx.engine.setScratchStutter(
        event.value
          ? Math.round(
              ((((ctx.engine[
                deck === "B" ? "scratchSampleRateB" : "scratchSampleRate"
              ] || 44100) *
                60) /
                ctx.project.tempo) *
                4) /
                +ctx.$(deck === "B" ? "#deckBDivision" : "#scratchDivision")
                  .value,
            )
          : 0,
        deck,
      );
    if (target === "playing")
      ctx.engine.setScratchPlaying(Boolean(event.value), deck);
  } else if (event.kind === "launcher") {
    const track = event.target as TrackId;
    if (event.value === "stop") ctx.engine.stopLauncherTrack(track, true);
    else if (typeof event.value === "string")
      ctx.engine.queueClip(track, event.value, 1);
  }
  ctx.engine.setProject(ctx.project);
}

export async function playPerformanceTake(
  ctx: RuntimeContext,
  take: PerformanceTake,
) {
  const blob = await ctx.loadPerformanceAudio(take);
  if (!blob) {
    ctx.toast(msg("ui_a06dd991793a"));
    return;
  }
  const audio = new Audio(URL.createObjectURL(blob)),
    secondsPerTakeStep = 60 / ctx.project.tempo / 4,
    timers: number[] = [];
  audio.currentTime = Math.max(0, take.trimStart * secondsPerTakeStep);
  for (const event of take.events.filter(
    (item) => item.step >= take.trimStart && item.step <= take.trimEnd,
  ))
    timers.push(
      window.setTimeout(
        () => {
          ctx.applyPerformanceEvent(event);
          if (ctx.activeView === "perform") ctx.renderPerformanceTakes();
          if (ctx.activeView === "mix") ctx.renderMixer();
        },
        Math.max(0, (event.step - take.trimStart) * secondsPerTakeStep * 1000),
      ),
    );
  await audio.play();
  window.setTimeout(
    () => {
      audio.pause();
      timers.forEach((timer) => clearTimeout(timer));
      URL.revokeObjectURL(audio.src);
    },
    Math.max(100, (take.trimEnd - take.trimStart) * secondsPerTakeStep * 1000),
  );
}

export function renderPerformanceTakes(ctx: RuntimeContext) {
  const root = ctx.$("#performanceTakes");
  if (!root) return;
  root.innerHTML = ctx.project.performanceTakes.length
    ? ctx.project.performanceTakes
        .map(
          (take: PerformanceTake) =>
            `<article class="performance-take ${take.id === ctx.activePerformanceTakeId ? "active" : ""}" data-take="${take.id}"><span><b>${ctx.esc(take.name)}</b><small>${take.events.length} EVENTS · ${take.trimStart.toFixed(1)}–${take.trimEnd.toFixed(1)} STEPS</small></span><button data-take-play>▶</button><button data-take-edit>EDIT</button><button data-take-export>EXPORT</button><button data-take-delete>×</button></article>`,
        )
        .join("")
    : `<p class="launcher-status">${msg("ui_9bad9d4858ee")}</p>`;
  ctx.$$("[data-take]").forEach((card) => {
    const take = ctx.project.performanceTakes.find(
      (item: PerformanceTake) => item.id === card.dataset.take,
    )!;
    card.querySelector("[data-take-play]").onclick = () =>
      ctx.playPerformanceTake(take);
    card.querySelector("[data-take-edit]").onclick = () =>
      ctx.openTakeEditor(take);
    card.querySelector("[data-take-export]").onclick = async () => {
      ctx.activePerformanceTakeId = take.id;
      ctx.performanceTake = await ctx.loadPerformanceAudio(take);
      ctx.performExport("performance", true);
    };
    card.querySelector("[data-take-delete]").onclick = async () => {
      if (
        !(await requestConfirmation(
          ctx.L("Delete take", "Borrar toma"),
          msg("ui_21157fbef633", { arg0: take.name }),
        ))
      )
        return;
      ctx.snapshot();
      ctx.project.performanceTakes = ctx.project.performanceTakes.filter(
        (item: PerformanceTake) => item.id !== take.id,
      );
      // Keep audio bytes referenced by Undo and recovery snapshots.
      ctx.changed();
      ctx.renderPerformanceTakes();
    };
  });
}

export async function togglePerformanceCapture(ctx: RuntimeContext) {
  const button = ctx.$("#performanceRecordBtn");
  if (ctx.engine.performanceRecorder?.state === "recording") {
    try {
      ctx.performanceTake = await ctx.engine.stopPerformanceCapture();
      if (ctx.performanceTimer) clearInterval(ctx.performanceTimer);
      ctx.performanceTimer = null;
      const durationSteps = Math.max(1, ctx.performanceStep()),
        take = createPerformanceTake(
          `${msg("ui_4c0bbd484491")} ${ctx.project.performanceTakes.length + 1}`,
          durationSteps,
          ctx.performanceEvents || [],
        ),
        assetId = `take-${take.id}`;
      take.audioAssetId = assetId;
      take.mimeType = ctx.performanceTake.type;
      await ctx.putAsset(assetId, ctx.performanceTake);
      ctx.project.performanceTakes.push(take);
      ctx.activePerformanceTakeId = take.id;
      ctx.performanceEvents = null;
      ctx.changed();
      ctx.renderPerformanceTakes();
      button.textContent = msg("ui_3bc55e6e0085");
      button.classList.remove("active");
      ctx.$("#performanceSaveBtn").disabled = false;
      ctx.toast(msg("ui_f82845cc73ab"));
    } catch (error) {
      ctx.toast(error instanceof Error ? error.message : String(error));
    }
    return;
  }
  try {
    ctx.performanceTake = null;
    ctx.performanceEvents = [];
    ctx.performanceEventThrottle.clear();
    ctx.$("#performanceSaveBtn").disabled = true;
    await ctx.engine.startPerformanceCapture();
    ctx.performanceStarted = Date.now();
    button.textContent = msg("ui_bd8e060270db");
    button.classList.add("active");
    ctx.performanceTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - ctx.performanceStarted) / 1000);
      ctx.$("#performanceRecordTime").textContent =
        `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
    }, 250);
    ctx.toast(msg("ui_d965c1f62bff"));
  } catch (error) {
    ctx.performanceEvents = null;
    ctx.toast(
      `${msg("ui_5c53befbb146")}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function applyMidiMapping(
  ctx: RuntimeContext,
  mapping: MidiMapping,
  normalized: number,
) {
  const value = mapping.min + (mapping.max - mapping.min) * normalized;
  if (mapping.target === "master.volume")
    ctx.project.master = Math.max(0, Math.min(1, value));
  else {
    const match = /^track\.([^.]+)\.(volume|pan|cutoff)$/.exec(mapping.target);
    if (match && TRACKS.includes(match[1] as TrackId)) {
      const track = match[1] as TrackId;
      if (match[2] === "cutoff")
        activeClip(ctx.project, track).instrument.cutoff = 120 + value * 11880;
      else if (match[2] === "pan")
        ctx.project.tracks[track].pan = value * 2 - 1;
      else ctx.project.tracks[track].volume = value;
    }
  }
  ctx.engine.setProject(ctx.project);
  ctx.renderMixer();
  ctx.renderMixGroups();
}

export function setupMidiLearnUi(ctx: RuntimeContext) {
  if (!ctx.$("#midiLearnBtn"))
    ctx
      .$("#globalAutomation")
      .insertAdjacentHTML(
        "beforebegin",
        '<button id="midiLearnBtn">MIDI LEARN</button>',
      );
  ctx.$("#midiLearnBtn").onclick = () => {
    ctx.midiLearnTarget = ctx.$("#automationTarget").value;
    ctx.$("#midiLearnBtn").textContent = "MOVE A MIDI CC…";
    ctx.toast(msg("ui_76a56cdf4bd3"));
  };
}

export function pausePlayback(ctx: RuntimeContext) {
  if (!ctx.engine.playing) return;
  const songMode = ctx.engine.songMode,
    position = songMode
      ? ctx.transportPosition
      : Math.max(0, ctx.currentStep) % clipLengthSteps(ctx.clip());
  ctx.engine.stop();
  if (songMode) {
    ctx.setGlobalStart(position);
    ctx.transportPosition = position;
  } else {
    ctx.setClipStart(position);
    ctx.currentStep = position;
  }
  ctx.syncTransportButtons(false);
  ctx.$("#pauseBtn").classList.add("active");
  studioBridge.update({ playing: false, paused: true });
  ctx.$("#audioState").textContent = msg("ui_cd5d07c90b5c");
  ctx.updatePlayheads();
  ctx.updatePosition();
}

export async function togglePlay(ctx: RuntimeContext, forceSong?: boolean) {
  if (ctx.engine.playing) {
    ctx.engine.stop();
    ctx.syncTransportButtons(false);
  } else {
    ctx.engine.songMode =
      forceSong ?? ["audio", "arrange", "mix"].includes(ctx.activeView);
    const startStep = ctx.engine.songMode
      ? ctx.globalStartStep
      : ctx.clipStartSteps.get(ctx.clip().id) || 0;
    await ctx.engine.start(ctx.project, {
      countInBars: ctx.recordArmed ? +ctx.$("#countIn").value : 0,
      startStep,
    });
    ctx.syncTransportButtons(true);
    ctx.$("#audioState").textContent = ctx.engine.countingIn
      ? "COUNT IN"
      : "RUNNING";
    ctx.animateMeter();
    if (ctx.activeView === "mix") ctx.animateMixer();
  }
}

export function animateMeter(ctx: RuntimeContext) {
  cancelAnimationFrame(ctx.animation);
  const loop = () => {
    if (ctx.engine.playing) {
      ctx.engine.draw(ctx.$("#meter"));
      ctx.animation = requestAnimationFrame(loop);
    }
  };
  loop();
}

export async function initMidi(ctx: RuntimeContext) {
  if (!navigator.requestMIDIAccess) return;
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false }),
      states = new Map<number, NoteExpression>(),
      state = (channel: number) => {
        if (!states.has(channel))
          states.set(channel, { bend: 0, timbre: 0.5, pressure: 0.8 });
        return states.get(channel)!;
      },
      updateHeld = (
        channel: number,
        key: keyof NoteExpression,
        value: number,
      ) => {
        ctx.engine.updateLiveChannel(channel, { [key]: value });
        for (const rec of ctx.recording.values())
          if (rec.channel === channel) rec.note.expression[key] = value;
      },
      bind = (input: MIDIInput) =>
        (input.onmidimessage = ({ data }: MIDIMessageEvent) => {
          const [status = 0, data1 = 0, data2 = 0] = Array.from(data || []),
            command = status & 0xf0,
            channel = status & 0x0f,
            s = state(channel),
            key = `midi-${channel}-${data1}`,
            pitch =
              ctx.selectedTrack === "drums"
                ? ((
                    {
                      36: 0,
                      38: 1,
                      42: 2,
                      46: 3,
                      45: 4,
                      39: 5,
                      49: 6,
                    } as Record<number, number>
                  )[data1] ?? Math.max(0, Math.min(6, data1 % 7)))
                : data1;
          if (command === 0xe0) {
            s.bend = ((((data2 << 7) | data1) - 8192) / 8192) * 2;
            updateHeld(channel, "bend", s.bend);
            return;
          }
          if (command === 0xd0) {
            s.pressure = data1 / 127;
            updateHeld(channel, "pressure", s.pressure);
            return;
          }
          if (command === 0xa0) {
            ctx.engine.updateLive(key, { pressure: data2 / 127 });
            const rec = ctx.recording.get(key);
            if (rec) rec.note.expression.pressure = data2 / 127;
            return;
          }
          if (command === 0xb0) {
            if (ctx.midiLearnTarget) {
              ctx.project.midiMappings = ctx.project.midiMappings.filter(
                (mapping: MidiMapping) =>
                  mapping.target !== ctx.midiLearnTarget,
              );
              ctx.project.midiMappings.push({
                id: cryptoId(),
                channel,
                controller: data1,
                target: ctx.midiLearnTarget,
                min: 0,
                max: 1,
              });
              ctx.midiLearnTarget = null;
              ctx.$("#midiLearnBtn").textContent = "MIDI LEARN";
              ctx.changed();
              ctx.toast(msg("ui_5a332cd9014c"));
            }
            for (const mapping of ctx.project.midiMappings.filter(
              (item: MidiMapping) =>
                item.channel === channel && item.controller === data1,
            ))
              ctx.applyMidiMapping(mapping, data2 / 127);
            if (data1 === 74) {
              s.timbre = data2 / 127;
              updateHeld(channel, "timbre", s.timbre);
            }
            return;
          }
          if (command === 0x90 && data2) {
            if (ctx.activeView === "launch" && data1 >= 36 && data1 < 64) {
              const cells = ctx.$$("[data-launch-clip]"),
                cell = cells[data1 - 36];
              if (cell)
                ctx.launchClip(
                  cell.dataset.launchTrack,
                  cell.dataset.launchClip,
                );
            } else
              ctx.startPerformance(
                key,
                pitch,
                data2 / 127,
                null,
                { ...s, pressure: data2 / 127 },
                channel,
              );
          }
          if (command === 0x80 || (command === 0x90 && !data2))
            ctx.endPerformance(key);
        });
    for (const input of access.inputs.values()) bind(input);
    access.onstatechange = (e) => {
      if (e.port?.type === "input" && e.port.state === "connected")
        bind(e.port as MIDIInput);
    };
  } catch {
    // Optional MIDI may be denied; the instrument remains fully usable.
  }
}

export function duplicateSelectedNotes(ctx: RuntimeContext) {
  const c = ctx.clip(),
    notes = c.notes.filter((n) => ctx.selectedNotes.has(n.id));
  if (!notes.length) return;
  const first = Math.min(...notes.map((n) => n.step + n.offset)),
    last = Math.max(...notes.map((n) => n.step + n.offset + n.length));
  const shift = Math.max(
    ctx.project.editor.snap,
    Math.ceil((last - first) / ctx.project.editor.snap) *
      ctx.project.editor.snap,
  );
  if (last + shift > clipLengthSteps(c)) {
    ctx.toast(msg("ui_576ec1141b92"));
    return;
  }
  ctx.snapshot();
  const copies = notes.map((n) => ({
    ...structuredClone(n),
    id: cryptoId(),
    step: n.step + shift,
  }));
  c.notes.push(...copies);
  ctx.selectedNotes = new Set(copies.map((n) => n.id));
  ctx.changed();
  ctx.renderPiano();
  ctx.toast(msg("ui_34cc5684d551"), true);
}

export function quantizeSelectedNotes(ctx: RuntimeContext) {
  const c = ctx.clip(),
    notes = c.notes.filter((n) => ctx.selectedNotes.has(n.id));
  if (!notes.length) return;
  ctx.snapshot();
  for (const n of notes) {
    n.step = Math.max(
      0,
      Math.min(
        clipLengthSteps(c) - ctx.project.editor.snap,
        Math.round((n.step + n.offset) / ctx.project.editor.snap) *
          ctx.project.editor.snap,
      ),
    );
    n.offset = 0;
    n.length = Math.min(
      clipLengthSteps(c) - n.step,
      Math.max(
        ctx.project.editor.snap,
        Math.round(n.length / ctx.project.editor.snap) *
          ctx.project.editor.snap,
      ),
    );
  }
  ctx.changed();
  ctx.renderPiano();
  ctx.toast(msg("ui_cd2976d7b847"), true);
}
