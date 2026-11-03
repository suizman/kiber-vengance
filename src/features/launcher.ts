import { trackState } from "../state/tracks";
import { projectTrackIds, trackMeta } from "../state/tracks";
import { t as msg } from "../ui/i18n";

import { clipsForTrack, captureLauncherScenes } from "../core.js";

import type { TrackId } from "../model.js";

import type { LauncherContext } from "../state/contracts";

export async function launchClip(
  ctx: LauncherContext,
  track: TrackId,
  clipId: string,
) {
  const quantization =
    +ctx.$("#launchQuantize").value || ctx.project.launcher.quantization;
  ctx.project.launcher.quantization = quantization;
  ctx.engine.stopLauncherTrack(track, false);
  if (!ctx.engine.playing) {
    ctx.project.activeClipIds[track] = clipId;
    await ctx.togglePlay(false);
    ctx.engine.onLaunch?.(track, clipId, 0);
  } else {
    try {
      if (await ctx.engine.prepareClipLaunch(track, clipId))
        ctx.engine.queueClip(track, clipId, quantization);
    } catch (error) {
      ctx.toast(error instanceof Error ? error.message : String(error));
      return;
    }
  }
  ctx.recordPerformanceEvent("launcher", track, clipId);
  ctx.renderLauncher();
}

export function renderLauncher(ctx: LauncherContext) {
  const root = ctx.$("#launcherGrid");
  if (!root) return;
  root.innerHTML = projectTrackIds(ctx.project)
    .map((track) => {
      const cfg = trackState(ctx.project, track),
        clips = clipsForTrack(ctx.project, track),
        queued = ctx.engine.launchQueue.get(track)?.clipId;
      return `<section class="launcher-track" style="--track:${cfg.color || trackMeta(ctx.project, track).color}"><header><b>${ctx.esc(trackMeta(ctx.project, track).label)}</b><button data-launch-stop="${track}" aria-label="${msg("ui_16ab95edb344")}">■</button></header>${clips.map((item) => `<button class="launcher-cell ${ctx.project.activeClipIds[track] === item.id && !ctx.engine.launcherStopped.has(track) ? "active" : ""} ${queued === item.id ? "queued" : ""}" data-launch-track="${track}" data-launch-clip="${item.id}"><b>${ctx.esc(item.name)}</b><small>${item.bars} ${msg("ui_1b402ca81c1b")} · ${item.notes.length} NOTES</small></button>`).join("")}</section>`;
    })
    .join("");
  ctx
    .$$("[data-launch-clip]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          ctx.launchClip(
            button.dataset.launchTrack,
            button.dataset.launchClip,
          )),
    );
  ctx.$$("[data-launch-stop]").forEach(
    (button) =>
      (button.onclick = () => {
        const track = button.dataset.launchStop as TrackId;
        ctx.engine.stopLauncherTrack(track, true);
        ctx.engine.launchQueue.delete(track);
        ctx.recordPerformanceEvent("launcher", track, "stop");
        ctx.renderLauncher();
      }),
  );
  ctx.$("#launchQuantize").value = String(ctx.project.launcher.quantization);
}

export function setupLauncher(ctx: LauncherContext) {
  ctx.engine.onLaunch = (track, clipId) => {
    if (ctx.launcherCapturing)
      ctx.launcherSnapshot(`LIVE ${ctx.launcherSnapshots.length + 1}`);
    ctx.$("#launcherStatus").textContent =
      `${trackMeta(ctx.project, track).label} · ${ctx.project.clips.find((item: any) => item.id === clipId)?.name || "CLIP"} · LIVE`;
    ctx.renderLauncher();
    ctx.changed();
  };
  ctx.$("#launchQuantize").onchange = () => {
    ctx.project.launcher.quantization = +ctx.$("#launchQuantize").value;
    ctx.changed();
  };
  ctx.$("#launcherCaptureBtn").onclick = () => {
    ctx.launcherCapturing = !ctx.launcherCapturing;
    if (ctx.launcherCapturing) ctx.launcherSnapshots = [];
    ctx
      .$("#launcherCaptureBtn")
      .setAttribute("aria-pressed", String(ctx.launcherCapturing));
    ctx.$("#launcherCaptureBtn").textContent = ctx.launcherCapturing
      ? "■ STOP CAPTURE"
      : "● CAPTURE";
    if (ctx.launcherCapturing) ctx.launcherSnapshot("LIVE 1");
    else ctx.$("#launcherCommitBtn").disabled = !ctx.launcherSnapshots.length;
  };
  ctx.$("#launcherCommitBtn").onclick = () => {
    if (!ctx.launcherSnapshots.length) return;
    ctx.snapshot();
    captureLauncherScenes(ctx.project, ctx.launcherSnapshots);
    ctx.launcherSnapshots = [];
    ctx.launcherCapturing = false;
    ctx.$("#launcherCaptureBtn").setAttribute("aria-pressed", "false");
    ctx.$("#launcherCaptureBtn").textContent = "● CAPTURE";
    ctx.changed(true);
    ctx.activateView("arrange");
    ctx.toast(msg("ui_8d7dba85c01c"));
  };
}
