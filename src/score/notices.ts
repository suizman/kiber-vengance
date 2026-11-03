import { getLanguage } from "../ui/i18n";
const spanish: Record<string, string> = {
  "This image is larger than 24 megapixels. Resize it before importing.":
    "La imagen supera los 24 megapíxeles. Reduce su tamaño antes de importarla.",
  "Cannot read image dimensions. Export this page as a smaller PNG or JPEG.":
    "No se pueden leer las dimensiones. Exporta esta página como PNG o JPEG más pequeño.",
  "ABC voices specify conflicting tempos. The last voice's tempo is selected; review the tempo map before inserting.":
    "Las voces ABC indican tempos diferentes. Se usa el de la última voz; revisa el mapa de tempo antes de insertar.",
  "SMPTE MIDI uses absolute time: notes are placed at 120 BPM to retain timing; embedded tempo labels are retained in the source.":
    "El MIDI SMPTE usa tiempo absoluto: las notas se colocan a 120 BPM para conservar los tiempos. Los tempos originales permanecen en el archivo fuente.",
  "MIDI notes without note-off were closed at the end of their sequence.":
    "Las notas MIDI sin final se han cerrado al terminar su secuencia.",
  "MIDI pitch at note-on and sustain are imported. Continuous controller curves and device-specific messages remain in the original MIDI source.":
    "Se importan la altura inicial y el pedal de sostenido. Las curvas continuas de control y los mensajes específicos del dispositivo se conservan en el MIDI original.",
  "A tie without a contiguous origin was preserved as a separate note. Review the repeat boundary.":
    "Una ligadura sin origen contiguo se ha conservado como nota independiente. Revisa el límite de la repetición.",
  "GM percussion outside pitches 35–81 uses the nearest available drum. Review its instrument mapping.":
    "La percusión GM fuera de las alturas 35–81 usa el sonido de batería más próximo. Revisa la asignación de instrumentos.",
  "No playable notes found in this file":
    "No se han encontrado notas reproducibles en este archivo.",
  "No score sections found": "No se han encontrado secciones de partitura.",
  "The crop must have a positive width and height":
    "El recorte debe tener anchura y altura mayores que cero.",
  "Invalid tempo or meter map; review this score before inserting.":
    "El mapa de tempo o compás no es válido. Revisa la partitura antes de insertarla.",
  "Invalid instrument or staff count":
    "El instrumento o número de pentagramas no es válido.",
  "This score exceeds the safe part or duration limit. Export it in sections.":
    "La partitura supera el límite de partes o duración. Expórtala dividida en secciones.",
  "This score contains more than 100,000 notes. Export it in sections.":
    "La partitura contiene más de 100.000 notas. Expórtala dividida en secciones.",
  "Score parsing exceeded 60 seconds. Split the score and retry.":
    "La lectura ha superado los 60 segundos. Divide la partitura y vuelve a intentarlo.",
  "Recognition timed out. Crop this page to a smaller region and retry.":
    "El reconocimiento ha agotado el tiempo. Recorta una región más pequeña y vuelve a intentarlo.",
  "Model integrity check failed. Damaged cached pieces were removed; retry the download.":
    "El modelo no ha superado la verificación. Se han eliminado los fragmentos dañados; vuelve a descargarlo.",
};
export function scoreNotice(text: string) {
  if (getLanguage() !== "es") return text;
  if (spanish[text]) return spanish[text];
  if (text.startsWith("Invalid note in "))
    return `Nota no válida en ${text.slice(16).split(";")[0]}. No se ha insertado la partitura.`;
  return text; // Parser-provided diagnostic details retain their original wording.
}
