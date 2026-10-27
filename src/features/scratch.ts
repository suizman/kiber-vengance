import { setupDualDeck } from "./dual-deck";
import { audioRegionRate, dbToGain } from "../core";
import { t as msg } from "../ui/i18n";
import type { AudioLane, AudioRegion } from "../model";
import type { RuntimeContext } from "../app";

let primaryController: ReturnType<typeof setupDualDeck>;
export function updateScratchPlayButton(_ctx: RuntimeContext) {
  primaryController?.refresh();
}
export async function armScratchBuffer(
  _ctx: RuntimeContext,
  buffer: AudioBuffer,
  label: string,
) {
  await primaryController.arm(buffer, label);
}
export async function importScratchFile(_ctx: RuntimeContext, file: File) {
  await primaryController.importFile(file);
}
export async function audioRegionScratchBuffer(
  ctx: RuntimeContext,
  lane: AudioLane,
  region: AudioRegion,
) {
  await ctx.engine.init();
  let source = ctx.engine.audioAssets.get(region.assetId);
  if (!source) {
    const blob = await ctx.getAsset(region.assetId);
    if (!blob) throw new Error(msg("ui_40df748ba040"));
    await ctx.engine.setAudioAsset(region.assetId, await blob.arrayBuffer());
    source = ctx.engine.audioAssets.get(region.assetId);
  }
  if (!source) throw new Error(msg("ui_918d9af82a8b"));
  const rate = audioRegionRate(region, ctx.project.tempo),
    start = Math.max(
      0,
      Math.min(source.duration - 0.001, region.offsetSeconds),
    ),
    requested = (region.lengthSteps * 60) / ctx.project.tempo / 4,
    duration = Math.max(
      0.001,
      Math.min(requested, (source.duration - start) / rate),
    ),
    sampleRate = ctx.engine.ctx.sampleRate,
    frames = Math.max(1, Math.round(duration * sampleRate)),
    buffer = ctx.engine.ctx.createBuffer(2, frames, sampleRate),
    gain = lane.volume * dbToGain(region.gainDb),
    fadeIn = Math.min(
      duration * 0.45,
      (region.fadeInSteps * 60) / ctx.project.tempo / 4,
    ),
    fadeOut = Math.min(
      duration * 0.45,
      (region.fadeOutSteps * 60) / ctx.project.tempo / 4,
    ),
    sourceSpan = duration * rate;
  for (let channel = 0; channel < 2; channel++) {
    const from = source.getChannelData(
        Math.min(channel, source.numberOfChannels - 1),
      ),
      to = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) {
      const time = i / sampleRate,
        sourceTime = region.reverse
          ? start + sourceSpan - time * rate
          : start + time * rate,
        position = Math.max(
          0,
          Math.min(from.length - 1.001, sourceTime * source.sampleRate),
        ),
        index = Math.floor(position),
        next = Math.min(from.length - 1, index + 1),
        mix = position - index,
        envelope =
          (fadeIn && time < fadeIn ? time / fadeIn : 1) *
          (fadeOut && time > duration - fadeOut
            ? (duration - time) / fadeOut
            : 1);
      to[i] =
        (from[index]! * (1 - mix) + from[next]! * mix) *
        gain *
        Math.max(0, Math.min(1, envelope));
    }
  }
  return buffer;
}

export async function loadAudioRegionIntoScratch(
  ctx: RuntimeContext,
  lane: AudioLane,
  region: AudioRegion,
  button: HTMLButtonElement,
) {
  button.disabled = true;
  button.textContent = msg("ui_6baa7861e2c9");
  try {
    const buffer = await ctx.audioRegionScratchBuffer(lane, region);
    await ctx.armScratchBuffer(buffer, region.name);
    ctx.activateView("perform");
  } catch (error) {
    ctx.toast(
      `${msg("ui_d39d8ece3ba7")}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    button.disabled = false;
    button.textContent = msg("ui_ae1e5c33dddc");
  }
}

export async function captureScratchMix(_ctx: RuntimeContext) {
  await primaryController.captureMix();
}
export function animateScratchDeck(
  _ctx: RuntimeContext,
  _now = performance.now(),
) {
  primaryController?.refresh();
}
export function setupScratchDeck(ctx: RuntimeContext) {
  primaryController = setupDualDeck(ctx);
}
