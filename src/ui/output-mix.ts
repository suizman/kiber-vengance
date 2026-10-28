import type { RuntimeContext } from "../app";
import { normalizeOutputMix } from "../core";
import { mountLevel } from "./level-control";
import { translate as L } from "./i18n";
export function setupOutputMix(ctx: RuntimeContext) {
  const host = document.createElement("section");
  host.className = "output-mix";
  host.setAttribute("aria-label", L("Output levels", "Niveles de salida"));
  document.querySelector(".master-strip")!.before(host);
  const levels: ReturnType<typeof mountLevel>[] = [];
  const top = document.createElement("div");
  top.id = "finalMasterControl";
  host.append(top);
  const set = (
    key: keyof ReturnType<typeof normalizeOutputMix>,
    value: number,
  ) => {
    ctx.project.outputMix = {
      ...normalizeOutputMix(ctx.project.outputMix),
      [key]: value,
    };
    ctx.engine.setProject(ctx.project);
  };
  levels.push(
    mountLevel(top, {
      label: "Master",
      get: () => normalizeOutputMix(ctx.project.outputMix).master,
      set: (v) => set("master", v),
      start: ctx.snapshot,
      commit: () => ctx.changed(),
    }),
  );
  const mute = document.createElement("button");
  mute.id = "outputMute";
  mute.textContent = L("Silence output", "Silenciar salida");
  mute.onclick = () => {
    ctx.snapshot();
    ctx.project.outputMix = {
      ...normalizeOutputMix(ctx.project.outputMix),
      muted: !normalizeOutputMix(ctx.project.outputMix).muted,
    };
    ctx.engine.setProject(ctx.project);
    ctx.changed();
    mute.setAttribute(
      "aria-pressed",
      String(normalizeOutputMix(ctx.project.outputMix).muted),
    );
  };
  host.append(mute);
  const meters = document.createElement("div");
  meters.className = "audio-lane-meters";
  for (const side of ["left", "right"]) {
    const meter = document.createElement("meter");
    meter.min = 0;
    meter.max = 1;
    meter.dataset.side = side;
    meter.setAttribute("aria-label", `Master ${side} peak`);
    meters.append(meter);
  }
  const peak = document.createElement("output");
  meters.append(peak);
  host.append(meters);
  const details = document.createElement("details"),
    summary = document.createElement("summary");
  summary.textContent = L(
    "Program, decks, Cue and preview",
    "Program, platos, Cue y preescucha",
  );
  details.append(summary);
  host.append(details);
  for (const [key, label] of [
    ["program", "Program"],
    ["deckA", L("Deck A", "Plato A")],
    ["deckB", L("Deck B", "Plato B")],
    ["cue", "Cue"],
    ["preview", L("Preview", "Preescucha")],
  ] as const) {
    const row = document.createElement("div");
    row.dataset.outputLevel = key;
    details.append(row);
    levels.push(
      mountLevel(row, {
        label,
        get: () =>
          key === "program"
            ? ctx.project.master
            : normalizeOutputMix(ctx.project.outputMix)[key],
        set: (v) => {
          if (key === "program") {
            ctx.project.master = v;
            ctx.engine.setProject(ctx.project);
          } else set(key, v);
        },
        start: ctx.snapshot,
        commit: () => ctx.changed(),
      }),
    );
  }
  // Persistent transport access without expanding the full mixer on mobile.
  const quick = document.createElement("details");
  quick.className = "compact-master";
  const title = document.createElement("summary");
  title.textContent = "Master";
  quick.append(title);
  const topLevel = document.createElement("div");
  topLevel.className = "master-popover";
  quick.append(topLevel);
  const oldTop = document.querySelector<HTMLElement>(".master-control");
  if (oldTop) {
    oldTop.hidden = true;
    oldTop.after(quick);
  }
  levels.push(
    mountLevel(topLevel, {
      label: "Master",
      get: () => normalizeOutputMix(ctx.project.outputMix).master,
      set: (v) => set("master", v),
      start: ctx.snapshot,
      commit: () => ctx.changed(),
    }),
  );
  document.addEventListener(
    "play",
    (event) => {
      const element = event.target;
      if (element instanceof HTMLMediaElement && !element.srcObject) {
        void ctx.engine.routePreview(element).catch((error) => {
          element.pause();
          ctx.toast(String(error));
        });
      }
    },
    true,
  );
  let previous = "",
    held = 0;
  const sync = () => {
    if (document.hidden) return;
    if (ctx.activeView === "mix") {
      const reading = ctx.engine.outputMeter?.read();
      if (reading) {
        for (const side of ["left", "right"] as const)
          meters.querySelector<HTMLMeterElement>(`[data-side=${side}]`)!.value =
            reading[side];
        held = Math.max(reading.peak, held * 0.95);
        peak.textContent =
          held > 0 ? `${(20 * Math.log10(held)).toFixed(1)} dBFS` : "−∞ dBFS";
        peak.classList.toggle("clipping", reading.peak >= 1);
      }
    }
    const state = JSON.stringify([ctx.project.master, ctx.project.outputMix]);
    if (previous !== state) {
      previous = state;
      levels.forEach((update) => update());
      mute.setAttribute(
        "aria-pressed",
        String(normalizeOutputMix(ctx.project.outputMix).muted),
      );
    }
  };
  const timer = setInterval(sync, 150);
  window.addEventListener("pagehide", () => clearInterval(timer), {
    once: true,
  });
  sync();
}
