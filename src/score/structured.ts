import { Settings, importer, midi } from "@coderline/alphatab/core";
import {
  cleanMap,
  newPart,
  type ScoreDocument,
  type ScoreNote,
  type ScoreSection,
} from "./model";
import type { MeterUnit } from "../model";

export function parseStructured(
  bytes: Uint8Array,
  name: string,
): ScoreDocument {
  const settings = new Settings();
  settings.importer.mergePartGroupsInMusicXml = false;
  settings.importer.maxDecodingBufferSize = 32 * 1024 * 1024;
  const score = importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
  const file = new midi.MidiFile();
  const handler = new midi.AlphaSynthMidiFileHandler(file, true);
  const performed: Array<{
    track: number;
    step: number;
    length: number;
    pitch: number;
    velocity: number;
    used: boolean;
  }> = [];
  const original = handler.addNote.bind(handler);
  handler.addNote = (track, start, length, pitch, velocity, channel) => {
    performed.push({
      track,
      step: start / 240,
      length: length / 240,
      pitch,
      velocity: velocity / 127,
      used: false,
    });
    original(track, start, length, pitch, velocity, channel);
  };
  const generator = new midi.MidiFileGenerator(score, settings, handler);
  generator.applyTranspositionPitches = true;
  generator.generate();
  const parts = score.tracks.map((track, index) => ({
    ...newPart(
      `part-${index}`,
      track.name || `Part ${index + 1}`,
      track.playbackInfo.program,
      track.staves.some((staff) => staff.isPercussion),
    ),
    staves: track.staves.length,
  }));
  const section: ScoreSection = {
    id: "section-0",
    title: score.title || name,
    parts,
    durationSteps: 0,
    tempos: [],
    meters: [],
  };
  const warnings: string[] = [];
  const attacks = new Map<string, ScoreNote>();
  const buckets = new Map<string, typeof performed>();
  for (const event of performed) {
    const key = `${event.track}:${event.pitch}`,
      list = buckets.get(key) || [];
    list.push(event);
    buckets.set(key, list);
  }
  for (const [
    occurrenceIndex,
    occurrence,
  ] of generator.tickLookup.masterBars.entries()) {
    if (occurrenceIndex > 100_000)
      throw new Error("Repeat expansion exceeds the safe limit");
    const index = occurrence.masterBar.index;
    section.durationSteps = Math.max(
      section.durationSteps,
      occurrence.end / 240,
    );
    section.meters.push({
      step: occurrence.start / 240,
      beats: occurrence.masterBar.timeSignatureNumerator,
      unit: occurrence.masterBar.timeSignatureDenominator as MeterUnit,
    });
    for (const change of occurrence.tempoChanges)
      section.tempos.push({ step: change.tick / 240, bpm: change.tempo });
    for (const [partIndex, track] of score.tracks.entries())
      for (const [staffIndex, staff] of track.staves.entries()) {
        const bar = staff.bars[index];
        if (!bar) continue;
        for (const voice of bar.voices)
          for (const beat of voice.beats)
            for (const note of beat.notes) {
              const step = (occurrence.start + beat.playbackStart) / 240;
              const length = Math.max(1 / 240, beat.playbackDuration / 240);
              const key = `${partIndex}:${staffIndex}:${voice.index}:${note.realValue}`;
              const prior = attacks.get(key);
              if (
                note.isTieDestination &&
                prior &&
                prior.step < step &&
                prior.step + prior.length >= step - 0.05
              ) {
                prior.length = Math.max(
                  prior.length,
                  step + length - prior.step,
                );
                continue;
              }
              if (note.isTieDestination)
                warnings.push(
                  "A tie without a contiguous origin was preserved as a separate note. Review the repeat boundary.",
                );
              const bucket = buckets.get(`${partIndex}:${note.realValue}`);
              while (bucket?.[0]?.used) bucket.shift();
              const played = bucket?.find(
                (event) => !event.used && Math.abs(event.step - step) < 2,
              );
              if (played) played.used = true;
              const item: ScoreNote = {
                id: `${partIndex}-${staffIndex}-${voice.index}-${occurrenceIndex}-${note.id}`,
                step: Math.max(0, played?.step ?? step),
                length: played?.length || length,
                pitch: note.realValue,
                velocity: played?.velocity ?? 0.78,
                staff: staffIndex + 1,
                voice: String(voice.index + 1),
                sourceId: `bar:${index + 1}:note:${note.id}`,
              };
              parts[partIndex]!.notes.push(item);
              attacks.set(key, item);
            }
      }
  }
  // Generated ornament attacks have no one-to-one notation note; preserve them with provenance.
  for (const [index, event] of performed.entries())
    if (!event.used && parts[event.track]) {
      if (
        parts[event.track]!.notes.some(
          (note) =>
            note.pitch === event.pitch &&
            event.step >= note.step - 0.01 &&
            event.step < note.step + note.length,
        )
      )
        continue;
      parts[event.track]!.notes.push({
        id: `performance-${index}`,
        step: Math.max(0, event.step),
        length: Math.max(1 / 240, event.length),
        pitch: event.pitch,
        velocity: event.velocity,
        staff: 1,
        voice: "performance",
        sourceId: "generated-articulation",
      });
    }
  section.tempos = cleanMap(
    section.tempos.length
      ? section.tempos
      : [{ step: 0, bpm: score.tempo || 120 }],
  );
  section.meters = cleanMap(section.meters);
  return {
    version: 1,
    title: score.title || name,
    format: /\.gp/i.test(name) ? "Guitar Pro" : "MusicXML",
    sections: [section],
    sourceName: name,
    warnings,
  };
}
