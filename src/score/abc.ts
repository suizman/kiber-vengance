import abcjs from "abcjs";
import type { MeterUnit } from "../model";
import {
  cleanMap,
  newPart,
  type ScoreDocument,
  type ScoreSection,
} from "./model";
// abcjs also emits meter/bar events which are missing from its published TS union.
interface SequenceItem {
  el_type: string;
  duration?: number;
  qpm?: number;
  num?: number;
  den?: string;
  trackName?: string;
  program?: number;
}
export function parseAbcScore(text: string, name: string): ScoreDocument {
  const tunes = abcjs.parseOnly(text),
    warnings: string[] = [];
  const sections: ScoreSection[] = tunes.map((tune, tuneIndex) => {
    const sequence = abcjs.synth.sequence(tune, {}) as SequenceItem[][];
    const flat = tune.setUpAudio({ chordsOff: true });
    const section: ScoreSection = {
      id: `tune-${tuneIndex}`,
      title: tune.metaText.title || `${name} ${tuneIndex + 1}`,
      parts: [],
      durationSteps: 1,
      tempos: [],
      meters: [],
    };
    for (const [voiceIndex, events] of sequence.entries()) {
      let scoreTime = 0,
        flatTime = 0,
        tempo = flat.tempo;
      const segments = [{ scoreTime, flatTime, tempo }];
      for (const event of events) {
        if (event.el_type === "tempo" && event.qpm) {
          tempo = event.qpm;
          segments.push({ scoreTime, flatTime, tempo });
          section.tempos.push({ step: scoreTime * 16, bpm: tempo });
        }
        if (event.el_type === "meter")
          section.meters.push({
            step: scoreTime * 16,
            beats: event.num || 4,
            unit: Number(event.den || 4) as MeterUnit,
          });
        if (event.el_type === "note") {
          const duration = event.duration || 0;
          scoreTime += duration;
          flatTime += (duration * flat.tempo) / tempo;
        }
      }
      const fromFlat = (time: number) => {
        const segment =
          segments.findLast((item) => item.flatTime <= time + 1e-8) ||
          segments[0]!;
        return (
          (segment.scoreTime +
            ((time - segment.flatTime) * segment.tempo) / flat.tempo) *
          16
        );
      };
      const part = newPart(
        `voice-${voiceIndex}`,
        events.find((event) => event.el_type === "name")?.trackName ||
          `Voice ${voiceIndex + 1}`,
        events.find((event) => event.el_type === "instrument")?.program || 0,
      );
      for (const event of flat.tracks[voiceIndex] || [])
        if (event.cmd === "note") {
          const start = fromFlat(event.start),
            end = fromFlat(event.start + event.duration);
          part.notes.push({
            id: `${voiceIndex}-${part.notes.length}`,
            step: Math.max(0, start),
            length: Math.max(1e-6, end - start),
            pitch: event.pitch,
            velocity: Math.max(0, Math.min(1, event.volume / 127)),
            staff: 1,
            voice: String(voiceIndex + 1),
            sourceId: `chars:${event.startChar}-${event.endChar}`,
          });
        }
      section.durationSteps = Math.max(
        section.durationSteps,
        scoreTime * 16,
        ...part.notes.map((note) => note.step + note.length),
      );
      section.parts.push(part);
    }
    const tempos = new Map<number, number>();
    for (const event of section.tempos) {
      if (tempos.has(event.step) && tempos.get(event.step) !== event.bpm)
        warnings.push(
          "ABC voices specify conflicting tempos. The last voice's tempo is selected; review the tempo map before inserting.",
        );
      tempos.set(event.step, event.bpm);
    }
    section.tempos = cleanMap(
      section.tempos.length ? section.tempos : [{ step: 0, bpm: flat.tempo }],
    );
    section.meters = cleanMap(
      section.meters.length ? section.meters : [{ step: 0, beats: 4, unit: 4 }],
    );
    for (const warning of tune.warnings || [])
      warnings.push(String(warning).replace(/<[^>]*>/g, ""));
    return section;
  });
  return {
    version: 1,
    title: sections[0]?.title || name,
    sourceName: name,
    format: "ABC",
    sections,
    warnings,
  };
}
