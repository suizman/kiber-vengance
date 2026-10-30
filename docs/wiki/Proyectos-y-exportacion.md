# Proyectos y exportación

## Guardar y recuperar

El formato actual es **v6**, con importación compatible v2–v5. El menú Project permite plantillas cinematic/minimal/performance/hybrid-audio, duplicar proyecto, snapshots con nombre, recuperación automática e import/export de JSON o Project Package.

El autosave se guarda en localStorage; las ediciones pendientes se vacían al ocultar/cerrar la página. Los errores de cuota o guardado se muestran en todos los espacios. Un autosave ilegible se preserva antes de intentar recuperación; si no puede preservarse, no se sobrescribe silenciosamente.

Hay tres ciclos independientes:

| Datos | Dónde viven | Copia útil |
| --- | --- | --- |
| Estructura, clips y ajustes | Proyecto JSON / localStorage | JSON o Package |
| Muestras, regiones y audio de tomas | IndexedDB del navegador | **Project Package** |
| Pesos/runtime de modelos opcionales | Caché del navegador o datos del companion | Gestionarlos desde su motor; no van en Package |

Package reúne referencias deduplicadas con IDs, MIME y manifiesto de assets; conserva muestras de batería, Prism Keys, regiones y tomas. Si falta un binario, se puede revincular o recuperar JSON. Crear un Package con binarios ausentes falla de forma visible. Borrar datos del sitio puede eliminar el audio: JSON no es una copia de samples.

## Formatos de salida

| Formato | Uso y opciones |
| --- | --- |
| WAV | Canción/arreglo y audio cargado; PCM 16-bit o float 32-bit, 44.1/48/96 kHz, dither TPDF, normalización, dry/wet, cola y región de loop |
| Stems ZIP | Pistas seleccionadas y manifiesto; instrumentos aislados y lanes de audio individuales |
| MIDI | Notas/expresión y mapa de tempo/compás; rampas discretizadas en intervalos de cuarto de paso. No contiene samples, audio ni patches de síntesis |
| JSON | Modelo editable y procedencia, sin blobs de audio |
| Project Package | Proyecto más todos sus binarios referenciados disponibles |
| Record Take | Audio de la actuación final con decks, normalmente WebM/Opus |

**Export** repite formato/destino enlazado; **Export As** elige otro. Project administra los destinos recordados por formato. Sin File System Access, se usan descargas normales; un navegador compatible puede volver a pedir permiso.

## Duración, cancelación y fuentes

La exportación avisa de fuentes necesarias ausentes; una toma no participante no bloquea el WAV de canción. El reloj compartido aplica mapas de tempo/swing. Las colas de audio pueden extender la duración sin reiniciar el arreglo instrumental.

La cola de stems permite progreso/cancelación entre renders. No se puede interrumpir el DSP interno de un OfflineAudioContext ya iniciado. El WAV de canción no captura scratching en directo: usa Record Take.

[Fiabilidad técnica](../RELIABILITY.md) · [Compatibilidad](Compatibilidad-y-licencias.md).
