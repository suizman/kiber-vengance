import type { ScoreDocument, ScoreNote, ScoreSection } from "./model";
const esc = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
const ticks = (steps: number) => Math.round(steps * 240);
function pitchXml(pitch: number, percussion: boolean) {
  const rounded = Math.round(pitch),
    octave = Math.floor(rounded / 12) - 1,
    names = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"],
    semitone = ((rounded % 12) + 12) % 12;
  if (percussion)
    return `<unpitched><display-step>${names[semitone]}</display-step><display-octave>${octave}</display-octave></unpitched>`;
  return `<pitch><step>${names[semitone]}</step>${[1, 3, 6, 8, 10].includes(semitone) ? "<alter>1</alter>" : ""}<octave>${octave}</octave></pitch>`;
}
function measures(section: ScoreSection) {
  const bars: Array<{
    start: number;
    end: number;
    beats: number;
    unit: number;
  }> = [];
  let start = 0;
  while (start < section.durationSteps - 1e-6) {
    const meter = section.meters.findLast(
      (item) => item.step <= start + 1e-6,
    ) || { beats: 4, unit: 4 };
    const next =
      section.meters.find((item) => item.step > start + 1e-6)?.step ?? Infinity;
    const end = Math.min(
      section.durationSteps,
      start + (meter.beats * 16) / meter.unit,
      next,
    );
    if (end <= start || bars.length > 100_000)
      throw new Error("Invalid score meter map");
    bars.push({ start, end, beats: meter.beats, unit: meter.unit });
    start = end;
  }
  return bars;
}
/** Portable corrected concert-pitch score. Repeats are expanded; source engraving is retained separately. */
export function scoreMusicXml(
  document: ScoreDocument,
  sectionIndex = 0,
): string {
  const section = document.sections[sectionIndex];
  if (!section) throw new Error("Score section unavailable");
  const bars = measures(section);
  const list = section.parts
    .map((part, index) => {
      const instruments = part.percussion
        ? [...new Set(part.notes.map((note) => note.pitch))]
        : [null];
      return `<score-part id="P${index}"><part-name>${esc(part.name)}</part-name>${instruments
        .map((pitch) => {
          const id = `I${index}${pitch === null ? "" : `-${pitch}`}`;
          return `<score-instrument id="${id}"><instrument-name>${esc(part.name)}</instrument-name></score-instrument><midi-instrument id="${id}"><midi-channel>${part.percussion ? 10 : (index % 9) + 1}</midi-channel><midi-program>${part.program + 1}</midi-program>${pitch === null ? "" : `<midi-unpitched>${pitch + 1}</midi-unpitched>`}</midi-instrument>`;
        })
        .join("")}</score-part>`;
    })
    .join("");
  const parts = section.parts
    .map((part, partIndex) => {
      const ordered = [...part.notes].sort(
        (a, b) => a.step - b.step || a.pitch - b.pitch,
      );
      const voices = new Map(
        [...new Set(ordered.map((note) => `${note.staff}:${note.voice}`))].map(
          (voice, index) => [voice, index + 1],
        ),
      );
      let nextNote = 0,
        active: ScoreNote[] = [];
      return `<part id="P${partIndex}">${bars
        .map((bar, barIndex) => {
          const byVoice = new Map<string, ScoreNote[]>();
          active = active.filter(
            (note) => note.step + note.length > bar.start + 1e-6,
          );
          while (
            nextNote < ordered.length &&
            ordered[nextNote]!.step < bar.end - 1e-6
          )
            active.push(ordered[nextNote++]!);
          for (const note of active) {
            const key = `${note.staff}:${note.voice}`,
              notes = byVoice.get(key) || [];
            notes.push(note);
            byVoice.set(key, notes);
          }
          let content = `<attributes><divisions>960</divisions><time><beats>${bar.beats}</beats><beat-type>${bar.unit}</beat-type></time><staves>${part.staves}</staves>${Array.from({ length: part.staves }, (_, index) => `<clef number="${index + 1}"><sign>${index ? "F" : "G"}</sign><line>${index ? 4 : 2}</line></clef>`).join("")}</attributes>`;
          for (const tempo of section.tempos.filter(
            (item) => item.step >= bar.start && item.step < bar.end,
          ))
            content += `<direction><direction-type><words>${tempo.bpm} BPM</words></direction-type><offset>${ticks(tempo.step - bar.start)}</offset><sound tempo="${tempo.bpm}"/></direction>`;
          let priorCursor = 0;
          for (const [voiceKey, notes] of byVoice) {
            if (priorCursor)
              content += `<backup><duration>${priorCursor}</duration></backup>`;
            let cursor = 0,
              previousStart = -1;
            for (const note of notes.sort(
              (a, b) => a.step - b.step || a.pitch - b.pitch,
            )) {
              const start = ticks(Math.max(bar.start, note.step) - bar.start),
                end = ticks(
                  Math.min(bar.end, note.step + note.length) - bar.start,
                ),
                chord = start === previousStart;
              if (!chord && start > cursor)
                content += `<forward><duration>${start - cursor}</duration></forward>`;
              if (!chord && start < cursor)
                content += `<backup><duration>${cursor - start}</duration></backup>`;
              const ties = `${note.step < bar.start - 1e-6 ? '<tie type="stop"/>' : ""}${note.step + note.length > bar.end + 1e-6 ? '<tie type="start"/>' : ""}`;
              content += `<note>${chord ? "<chord/>" : ""}${pitchXml(note.pitch, part.percussion)}${part.percussion ? `<instrument id="I${partIndex}-${note.pitch}"/>` : ""}<duration>${Math.max(1, end - start)}</duration>${ties}<voice>${voices.get(voiceKey)}</voice><staff>${note.staff}</staff>${note.lyric ? `<lyric><text>${esc(note.lyric)}</text></lyric>` : ""}</note>`;
              if (!chord) cursor = end;
              previousStart = start;
            }
            priorCursor = cursor;
          }
          if (!byVoice.size)
            content += `<note><rest measure="yes"/><duration>${ticks(bar.end - bar.start)}</duration></note>`;
          return `<measure number="${barIndex + 1}" implicit="${ticks(bar.end - bar.start) < ticks((bar.beats * 16) / bar.unit) ? "yes" : "no"}">${content}</measure>`;
        })
        .join("")}</part>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${esc(section.title)}</work-title></work><part-list>${list}</part-list>${parts}</score-partwise>`;
}
