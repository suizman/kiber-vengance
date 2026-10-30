# Arreglo y audio

[English](Arrangement-and-audio.md) | [Español](ES-Arrangement-and-audio.md)

## Construir la canción

En **Arrange → Arrangement**, cada sección asigna un clip por pista y un número de repeticiones. Añade, renombra, reordena con botones o arrastre, selecciona varias, copia, pega, duplica, borra o crea fills. **Load to Compose** abre juntos sus cinco clips.

El timeline ofrece zoom, marcadores, salto exacto, loop y límites de punch-in. Los mapas de tempo y compás se conservan en el proyecto; reproducción y WAV usan el reloj musical compartido. Cambiar el compás remapea posiciones para conservar la forma musical.

## Regiones no destructivas

En **Audio & sampler**, importa varios archivos, graba micrófono o añade lanes. El permiso y la entrada física dependen del navegador. Cada región conserva posición, longitud, offset de fuente, ganancia, fades, reverse, pitch, BPM de origen y warp por velocidad.

Edita **Clip/Track effects** sin reemplazar la fuente: filtro, brillo, compresión, saturación, distorsión, chorus, delay y reverb, con bypass individual, reset y comparación **Original/Processed**. Hay presets de tratamiento, como Voice presence, Radio, Megaphone y Cyberpunk.

**Load Deck** envía una región editada al Deck A. **Resample Deck** convierte su búfer temporal en una región persistente. Las regiones suenan junto al arreglo y pueden prolongar su cola; Pause reanuda desde el offset correspondiente.

El warp actual cambia la velocidad de lectura y también el pitch: no es time stretch con conservación independiente del tono.

## Prism Keys

Carga un archivo y úsalo como instrumento cromático de **25 teclas**. Ajusta root, trim, tune, nivel, filtro, attack/release, reverse, polifonía y modo **gate / one-shot / loop**. Ratón, multitouch, QWERTY y MIDI tienen feedback por nota. Usa Z/X o los botones de octava cuando el sampler esté armado.

La muestra se conserva con el proyecto mediante IndexedDB/Package. Usa **Record Take** para capturar una interpretación del sampler.

## Automatización y MIDI Learn

Automation Lab guarda curvas globales para master/pistas y rutas de modulación LFO. **MIDI Learn** vincula CC entrantes a esos destinos. La edición disponible es **Read**; proyectos antiguos conservan metadata Touch/Latch/Write, pero no hay grabación de automatización en esos modos.

[Mezcla](ES-Mixing.md) · [Guardar audio](ES-Projects-and-export.md).
