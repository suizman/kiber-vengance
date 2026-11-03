import {
  activeClip,
  addInstrumentTrack,
  createClip,
  sceneLengthSteps,
} from "../core";
import type { Project, TrackId } from "../model";
import { validateScore, type ScoreDocument } from "./model";

/** All sections/parts are inserted atomically by the caller, after review and asset storage. */
export function insertScore(
  project: Project,
  document: ScoreDocument,
  source: NonNullable<Project["scoreSources"]>[number],
): TrackId[] {
  validateScore(document);
  if (
    !project.clips.some((clip) => clip.notes.length) &&
    !project.audioLanes.some((lane) => lane.regions.length)
  )
    project.arrangement = [];
  let offset = project.arrangement.reduce(
    (sum, scene) => sum + sceneLengthSteps(project, scene) * scene.repeats,
    0,
  );
  const ids: TrackId[] = [];
  const identities = new Map<string, TrackId>();
  for (const section of document.sections) {
    const clipIds: Record<TrackId, string> = {};
    for (const part of section.parts) {
      const identity = `${part.id}:${part.name}:${part.kind}:${part.program}:${part.percussion}`;
      const existing = identities.get(identity);
      const id =
        existing ||
        addInstrumentTrack(
          project,
          part.name,
          part.kind,
          part.program,
          part.percussion,
        );
      const clip = existing
        ? createClip(id, part.name, 1)
        : activeClip(project, id);
      if (existing) {
        const previous = activeClip(project, id);
        clip.instrument = structuredClone(previous.instrument);
        clip.character = structuredClone(previous.character);
        project.clips.push(clip);
        project.activeClipIds[id] = clip.id;
      } else {
        identities.set(identity, id);
        ids.push(id);
        for (const scene of project.arrangement) delete scene.clipIds[id];
      }
      clip.name = `${section.title} · ${part.name}`;
      clip.stepsPerBar = section.meters[0]
        ? (section.meters[0].beats * 16) / section.meters[0].unit
        : 16;
      clip.bars = Math.max(
        1,
        Math.ceil(section.durationSteps / clip.stepsPerBar),
      );
      clip.durationSteps = section.durationSteps;
      clip.notes = part.notes.map((note) => ({
        id: crypto.randomUUID(),
        step: note.step,
        length: note.length,
        pitch: note.pitch,
        velocity: note.velocity,
        offset: 0,
        expression: {
          pressure: note.velocity,
          timbre: 0.5,
          bend: note.bend || 0,
        },
        notation: {
          staff: note.staff,
          voice: note.voice,
          ...(note.lyric ? { lyric: note.lyric } : {}),
          ...(note.sourceId ? { sourceId: note.sourceId } : {}),
        },
      }));
      clipIds[id] = clip.id;
    }
    if (offset === 0) {
      project.tempoMap = [];
      project.meterMap = [];
      project.tempo = section.tempos[0]?.bpm || 120;
      project.meter = {
        beats: section.meters[0]?.beats || 4,
        unit: section.meters[0]?.unit || 4,
      };
    }
    project.tempoMap.push(
      ...section.tempos.map((tempo) => ({
        ...tempo,
        step: tempo.step + offset,
        id: crypto.randomUUID(),
        curve: "jump" as const,
      })),
    );
    project.meterMap.push(
      ...section.meters.map((meter) => ({
        ...meter,
        step: meter.step + offset,
        id: crypto.randomUUID(),
      })),
    );
    project.arrangement.push({
      id: crypto.randomUUID(),
      name: section.title,
      clipIds,
      repeats: 1,
    });
    offset += section.durationSteps;
  }
  (project.scoreSources ||= []).push({ ...source, partTracks: ids });
  return ids;
}
