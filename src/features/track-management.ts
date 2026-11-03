import {
  activeClip,
  addInstrumentTrack,
  instrumentSettings,
  trackDefaults,
  TRACKS,
} from "../core";
import { projectTrackIds, trackState, builtinKind } from "../state/tracks";
import type { InstrumentKind, Project } from "../model";
import { requestFields } from "../ui/dialogs";
import { translate as L } from "../ui/i18n";
import { gmManifest } from "../audio/gm-bank";
export async function editInstrumentTrack(
  project: Project,
  selected: string,
  adding: boolean,
) {
  const current = trackState(project, selected),
    clip = activeClip(project, selected),
    bank = await gmManifest().catch(() => null);
  const fields = await requestFields({
    title: adding
      ? L("Add instrument track", "Añadir pista de instrumento")
      : L("Edit instrument track", "Editar pista de instrumento"),
    description: L(
      "Each track has its own clips and mixer. Changing its sound keeps every note. Built-in tracks remain available for older projects.",
      "Cada pista tiene sus propios clips y mezclador. Cambiar el sonido conserva las notas. Las pistas originales se mantienen por compatibilidad.",
    ),
    fields: [
      {
        name: "name",
        label: L("Name", "Nombre"),
        value: adding
          ? L("New instrument", "Nuevo instrumento")
          : current.name || selected,
        maxLength: 120,
      },
      {
        name: "kind",
        label: L("Sound for active clip", "Sonido del clip activo"),
        type: "select",
        value: adding ? "gm" : clip.instrument.kind,
        options: [
          {
            value: "gm",
            label: L("Acoustic / General MIDI", "Acústico / General MIDI"),
          },
          ...TRACKS.map((kind) => ({ value: kind, label: kind })),
        ],
      },
      {
        name: "program",
        label: L("Acoustic instrument", "Instrumento acústico"),
        type: "select",
        value: clip.instrument.program || 0,
        options: bank?.programs.map((item) => ({
          value: String(item.number),
          label: `${item.number + 1}. ${item.name}`,
        })) || [{ value: "0", label: "Piano" }],
      },
      {
        name: "percussion",
        label: L("GM percussion", "Percusión GM"),
        type: "select",
        value: clip.instrument.percussion ? "yes" : "no",
        options: [
          { value: "no", label: L("Melodic", "Melódico") },
          { value: "yes", label: L("Percussion", "Percusión") },
        ],
      },
      ...(!adding
        ? [
            {
              name: "position",
              label: L("Position", "Posición"),
              type: "number" as const,
              value: projectTrackIds(project).indexOf(selected) + 1,
              min: 1,
              max: projectTrackIds(project).length,
            },
            {
              name: "action",
              label: L("Action", "Acción"),
              type: "select" as const,
              value: "save",
              options: [
                { value: "save", label: L("Save changes", "Guardar cambios") },
                ...(!(TRACKS as readonly string[]).includes(selected)
                  ? [
                      {
                        value: "delete",
                        label: L(
                          "Delete track and its clips (Undo available)",
                          "Eliminar pista y clips (se puede deshacer)",
                        ),
                      },
                    ]
                  : []),
              ],
            },
          ]
        : []),
    ],
  });
  if (!fields) return null;
  const next = structuredClone(project);
  if (fields.action === "delete") {
    delete next.tracks[selected];
    delete next.activeClipIds[selected];
    next.trackOrder = next.trackOrder.filter((id) => id !== selected);
    next.clips = next.clips.filter((clip) => clip.track !== selected);
    for (const scene of next.arrangement) delete scene.clipIds[selected];
    for (const source of next.scoreSources || [])
      source.partTracks = source.partTracks.filter((id) => id !== selected);
    return { project: next, selectedTrack: next.trackOrder[0]! };
  }
  const kind = fields.kind as InstrumentKind,
    program = Number(fields.program),
    percussion = fields.percussion === "yes";
  const id = adding
    ? addInstrumentTrack(next, fields.name!, kind, program, percussion)
    : selected;
  const state = trackState(next, id),
    instrument = activeClip(next, id).instrument;
  state.name = fields.name!;
  state.kind = kind;
  state.program = program;
  state.percussion = percussion;
  if (instrument.kind !== kind)
    activeClip(next, id).instrument = instrumentSettings(id, {
      ...trackDefaults()[builtinKind(kind)],
      kind,
      program,
      percussion,
    });
  Object.assign(activeClip(next, id).instrument, { kind, program, percussion });
  if (!adding) {
    next.trackOrder = projectTrackIds(next).filter((track) => track !== id);
    next.trackOrder.splice(Math.max(0, Number(fields.position) - 1), 0, id);
  }
  return { project: next, selectedTrack: id };
}
