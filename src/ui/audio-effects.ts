import { normalizeEffects, AUDIO_FX_PRESETS } from "../audio/effects-model";
import type { AudioEffects, Project } from "../model";
import { translate as L } from "./i18n";
interface Owner {
  effects?: AudioEffects;
}
interface Context {
  snapshot(): void;
  changed(render?: boolean): void;
  engine: { setProject(project: Project): void };
  project: Project;
}
export function mountAudioEffects(
  host: HTMLElement,
  owner: Owner,
  ctx: Context,
  scope: string,
  peer?: Owner,
) {
  let target = owner;
  const details = document.createElement("details");
  details.className = "audio-fx";
  const summary = document.createElement("summary");
  summary.textContent = `${L("Effects", "Efectos")} · ${scope}`;
  details.append(summary);
  const select = document.createElement("select");
  select.setAttribute("aria-label", L("Effect preset", "Preset de efectos"));
  select.append(new Option(L("Choose preset…", "Elegir preset…"), ""));
  for (const [id, preset] of Object.entries(AUDIO_FX_PRESETS))
    select.append(new Option(L(preset.en, preset.es), id));
  const bypass = document.createElement("button");
  bypass.type = "button";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = L("Reset", "Restablecer");
  const controls = document.createElement("div");
  controls.className = "audio-fx-grid";
  details.append(select, bypass, reset, controls);
  host.append(details);
  const labels: Record<string, [string, string]> = {
    filter: ["Low-pass", "Paso bajo"],
    tone: ["Brightness", "Brillo"],
    compression: ["Compression", "Compresión"],
    saturation: ["Saturation", "Saturación"],
    distortion: ["Distortion", "Distorsión"],
    chorus: ["Chorus", "Chorus"],
    delay: ["Delay", "Eco"],
    reverb: ["Reverb", "Reverb"],
  };
  if (peer) {
    const tabs = document.createElement("div");
    tabs.className = "audio-fx-tabs";
    const clip = document.createElement("button"),
      track = document.createElement("button");
    clip.type = track.type = "button";
    clip.textContent = L("Clip", "Clip");
    track.textContent = L("Track", "Pista");
    clip.setAttribute("aria-pressed", "true");
    track.setAttribute("aria-pressed", "false");
    const choose = (isClip: boolean) => {
      target = isClip ? owner : peer;
      clip.setAttribute("aria-pressed", String(isClip));
      track.setAttribute("aria-pressed", String(!isClip));
      sync();
    };
    clip.onclick = () => choose(true);
    track.onclick = () => choose(false);
    tabs.append(clip, track);
    details.insertBefore(tabs, select);
  }
  const sync = () => {
    const fx = normalizeEffects(target.effects);
    bypass.textContent = fx.bypass
      ? L("Original · bypass", "Original · bypass")
      : L("Processed", "Procesado");
    bypass.setAttribute("aria-pressed", String(fx.bypass));
    controls
      .querySelectorAll<HTMLButtonElement>("[data-fx-toggle]")
      .forEach((button) => {
        const key = button.dataset.fxToggle as keyof AudioEffects;
        button.setAttribute(
          "aria-pressed",
          String(fx[key] !== (key === "filter" ? 1 : 0)),
        );
      });
    controls.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
      input.value = String(fx[input.dataset.fx as keyof AudioEffects]);
      input.nextElementSibling!.textContent = `${Math.round(+input.value * 100)}%`;
    });
  };
  const changed = () => {
    ctx.engine.setProject(ctx.project);
    ctx.changed();
    sync();
  };
  select.onchange = () => {
    const preset = AUDIO_FX_PRESETS[select.value];
    if (!preset) return;
    ctx.snapshot();
    target.effects = { ...preset.settings };
    changed();
    select.value = "";
  };
  reset.onclick = () => {
    ctx.snapshot();
    target.effects = normalizeEffects();
    changed();
  };
  bypass.onclick = () => {
    ctx.snapshot();
    target.effects = {
      ...normalizeEffects(target.effects),
      bypass: !target.effects?.bypass,
    };
    changed();
  };
  for (const [key, label] of Object.entries(labels)) {
    const wrapper = document.createElement("label"),
      title = document.createElement("span"),
      input = document.createElement("input"),
      output = document.createElement("output");
    title.textContent = L(...label);
    input.type = "range";
    input.min = key === "tone" ? "-1" : "0";
    input.max = "1";
    input.step = ".01";
    input.dataset.fx = key;
    input.setAttribute("aria-label", title.textContent!);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = L("On / off", "Activar");
    toggle.dataset.fxToggle = key;
    toggle.setAttribute(
      "aria-label",
      `${title.textContent} · ${L("On / off", "Activar")}`,
    );
    const previous = new WeakMap<Owner, number>();
    toggle.onclick = () => {
      ctx.snapshot();
      const fx = normalizeEffects(target.effects),
        current = fx[key as keyof AudioEffects] as number,
        neutral = key === "filter" ? 1 : 0;
      if (current !== neutral) previous.set(target, current);
      target.effects = {
        ...fx,
        [key]:
          current === neutral
            ? (previous.get(target) ?? (key === "filter" ? 0.5 : 0.35))
            : neutral,
      };
      changed();
    };
    let editing = false;
    input.oninput = () => {
      if (!editing) {
        ctx.snapshot();
        editing = true;
      }
      target.effects = {
        ...normalizeEffects(target.effects),
        [key]: +input.value,
      };
      ctx.engine.setProject(ctx.project);
      output.textContent = `${Math.round(+input.value * 100)}%`;
    };
    input.onchange = () => {
      editing = false;
      changed();
    };
    input.onblur = () => {
      if (editing) {
        editing = false;
        changed();
      }
    };
    wrapper.append(title, input, output, toggle);
    controls.append(wrapper);
  }
  sync();
}
