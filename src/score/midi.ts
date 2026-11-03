import { parseMidi, type MidiEvent } from "midi-file";
import {
  cleanMap,
  newPart,
  type ScoreDocument,
  type ScorePart,
  type ScoreSection,
  type ScoreNote,
} from "./model";
import type { MeterUnit } from "../model";

export function parseMidiScore(bytes: Uint8Array, name: string): ScoreDocument {
  const data = parseMidi(bytes),
    warnings: string[] = [];
  const tracks = data.tracks.map((track, index) => {
    let tick = 0;
    return track.map((event) => ({
      event,
      tick: (tick += event.deltaTime),
      track: index,
    }));
  });
  const groups =
    data.header.format === 2 ? tracks.map((track) => [track]) : [tracks];
  if (!data.header.ticksPerBeat)
    warnings.push(
      "SMPTE MIDI uses absolute time: notes are placed at 120 BPM to retain timing; embedded tempo labels are retained in the source.",
    );
  const factor = data.header.ticksPerBeat
    ? 4 / data.header.ticksPerBeat
    : 8 /
      ((data.header.framesPerSecond === 29
        ? 29.97
        : data.header.framesPerSecond || 30) *
        (data.header.ticksPerFrame || 80));
  const sections: ScoreSection[] = groups.map((group, sectionIndex) => {
    const section: ScoreSection = {
      id: `section-${sectionIndex}`,
      title: data.header.format === 2 ? `${name} · ${sectionIndex + 1}` : name,
      durationSteps: 1,
      parts: [],
      tempos: [{ step: 0, bpm: 120 }],
      meters: [{ step: 0, beats: 4, unit: 4 }],
    };
    const parts = new Map<string, ScorePart>();
    const names = new Map<number, string>();
    const state = new Map<
      string,
      { program: number; bend: number; sustain: boolean; pressure: number }
    >();
    const active = new Map<
      string,
      Array<{ note: ScoreNote; part: ScorePart; released: boolean }>
    >();
    const events = group
      .flat()
      .sort((a, b) => a.tick - b.tick || a.track - b.track);
    const close = (voice: string, tick: number, all: boolean) => {
      for (const [key, notes] of active)
        if (key.startsWith(voice + ":")) {
          const retained = [];
          for (const item of notes) {
            if (all || item.released)
              item.note.length = Math.max(
                factor,
                tick * factor - item.note.step,
              );
            else retained.push(item);
          }
          active.set(key, retained);
        }
    };
    for (const { event, tick, track } of events) {
      const step = tick * factor;
      section.durationSteps = Math.max(section.durationSteps, step);
      if (event.type === "trackName") names.set(track, event.text);
      if (event.type === "setTempo" && data.header.ticksPerBeat)
        section.tempos.push({
          step,
          bpm: 60_000_000 / event.microsecondsPerBeat,
        });
      if (event.type === "timeSignature")
        section.meters.push({
          step,
          beats: event.numerator,
          unit: event.denominator as MeterUnit,
        });
      if (!("channel" in event)) continue;
      const voice = `${track}:${event.channel}`;
      const channel = state.get(voice) || {
        program: 0,
        bend: 0,
        sustain: false,
        pressure: 0.8,
      };
      state.set(voice, channel);
      if (event.type === "programChange") channel.program = event.programNumber;
      if (event.type === "pitchBend") channel.bend = (event.value / 8192) * 2;
      if (event.type === "channelAftertouch")
        channel.pressure = event.amount / 127;
      if (event.type === "controller") {
        if (event.controllerType === 64) {
          channel.sustain = event.value >= 64;
          if (!channel.sustain) close(voice, tick, false);
        }
        if ([120, 123].includes(event.controllerType)) close(voice, tick, true);
      }
      if (event.type === "noteOn" && event.velocity > 0) {
        const id = `${voice}:${channel.program}`;
        let part = parts.get(id);
        if (!part) {
          part = newPart(
            `midi-${id.replaceAll(":", "-")}`,
            names.get(track) || `Track ${track + 1} · CH ${event.channel + 1}`,
            channel.program,
            event.channel === 9,
          );
          parts.set(id, part);
        }
        const note: ScoreNote = {
          id: `${id}-${part.notes.length}`,
          step,
          length: 1,
          pitch: event.noteNumber,
          velocity: event.velocity / 127,
          staff: 1,
          voice: String(event.channel + 1),
          bend: channel.bend,
          sourceId: `track:${track}:tick:${tick}`,
        };
        part.notes.push(note);
        const key = `${voice}:${event.noteNumber}`,
          list = active.get(key) || [];
        list.push({ note, part, released: false });
        active.set(key, list);
      } else if (
        event.type === "noteOff" ||
        (event.type === "noteOn" && event.velocity === 0)
      ) {
        const key = `${voice}:${event.noteNumber}`,
          list = active.get(key) || [],
          item = list.find((item) => !item.released);
        if (item) {
          if (channel.sustain) item.released = true;
          else {
            item.note.length = Math.max(factor, step - item.note.step);
            list.splice(list.indexOf(item), 1);
          }
        }
      }
    }
    for (const notes of active.values())
      for (const { note, released } of notes) {
        note.length = Math.max(factor, section.durationSteps - note.step);
        if (!released)
          warnings.push(
            "MIDI notes without note-off were closed at the end of their sequence.",
          );
      }
    section.parts = [...parts.values()];
    section.tempos = cleanMap(section.tempos);
    section.meters = cleanMap(section.meters);
    return section;
  });
  if (
    tracks.some((track) =>
      track.some(
        ({ event }: { event: MidiEvent }) =>
          event.type === "pitchBend" ||
          (event.type === "controller" &&
            ![64, 120, 123].includes(event.controllerType)),
      ),
    )
  )
    warnings.push(
      "MIDI pitch at note-on and sustain are imported. Continuous controller curves and device-specific messages remain in the original MIDI source.",
    );
  return {
    version: 1,
    title: name,
    format: `MIDI ${data.header.format}`,
    sourceName: name,
    sections,
    warnings,
  };
}
