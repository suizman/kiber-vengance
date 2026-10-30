# Directo

[English](Live-performance.md) | [Español](ES-Live-performance.md)

## Clip launcher

**Live → Clip launcher** ofrece una matriz de cinco pistas. Lanza clips cuantizados a beat o compás, detén pistas por separado y usa las notas MIDI **36–63** para las celdas visibles. **Capture** registra la secuencia de lanzamientos y **Commit to Arrange** la convierte en secciones editables.

## Dos Scratch Decks

**Live → Performance deck** contiene Deck A y B independientes, cada uno con su AudioWorklet. Carga audio local, graba entrada o captura 1, 2, 4 u 8 compases de la mezcla activa. Los clips cortos se repiten hasta completar esa captura.

Cada deck tiene onda/playhead, búsqueda, reproducción, lectura bidireccional, velocidad, BPM de origen, Sync, filtro, stutter, brake y spinback. Usa ratón, touch, rueda/trackpad o teclado sobre el plato; soltarlo recupera el motor suavemente.

El crossfader de potencia constante mezcla A/B. **Program/Deck** equilibra la canción con los platos. Sync adapta velocidad y pitch al tempo del proyecto; no conserva el tono original.

**Cue A/B** puede usar una salida de auriculares independiente cuando el navegador ofrece selección/routing de salida. En caso contrario está desactivado. La simulación de Cue en pruebas no certifica una separación física de auriculares.

## Grabar una actuación

**Record Take** captura el master audible, incluidos los dos decks, y guarda audio más registro de eventos. Las tomas permiten trim, cuantización, retiming, cambio/borrado de eventos y replay. Editar eventos no vuelve a sintetizar la onda ya capturada.

La captura suele usar **WebM/Opus**, según MediaRecorder. Cue y previews quedan fuera de la toma. Guarda la toma o inclúyela en Project Package.

Los buffers de deck son temporales: recargar los elimina salvo que los hayas conservado como regiones. Exportar WAV de canción renderiza el arreglo; no sustituye Record Take para una sesión de scratching.

[Mezcla](ES-Mixing.md) · [Proyectos y exportación](ES-Projects-and-export.md).
