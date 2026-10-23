# Plan de producto y registro de versiones

## Visión

КИБЕР VENGANCE convierte la idea “cinematic machinery” en un instrumento: grafito, marfil, ámbar térmico y rojo de presión; geometría mecánica, movimiento reservado al estado musical y un vocabulario propio —Forge, Signal, Impact, Mutation— sin copiar una banda, videojuego o DAW existente.

El flujo progresa de lo inmediato a lo profundo: la demo suena al pulsar Play; los clips y presets permiten experimentar; Forge expone edición y síntesis; Arrange construye la canción; Perform concentra controles expresivos; Export produce archivos utilizables.

## Hitos entregados

1. Fundamentos: motor Web Audio, cinco pistas, transporte, scheduler, persistencia, demo e identidad visual.
2. Composición: clips independientes, piano roll de varias octavas y compases, edición expresiva, automatización, arreglo, grabación y versiones.
3. Profundidad: dual oscillator, ADSR, tres filtros, unison/detune/glide/pan, LFO, arpegiador, siete voces de batería, generadores armónicos, presets y seis macros.
4. Pulido: buses FX persistentes, exportación completa WAV/MIDI, recuperación de errores, responsive, accesibilidad, tipado de contrato, pruebas multi-navegador y documentación.
5. Remaster UX: paleta de comandos, modo Focus, racks persistentes y plegables, atajos de acciones, acceso móvil completo y lenguaje visual industrial de mayor contraste.
6. Spectral Deck: identidad vectorial propia, sistema visual cyberpunk multicolor, interfaz bilingüe EN/ES, tutorial interactivo y ayuda contextual completa.
7. Guitar & Backing: guitarra sintetizada mediante cuerda pulsada, presets y FX propios; generador de bases por secciones que conserva el material de guitarra y lead.
8. Clip Character: arpegiador, LFO, efectos y macros independientes por clip, migración v4 y exportación coherente.
9. Fast Mix & Export: Solo/Mute de pista activa sin colisiones QWERTY, paleta actualizada y accesos rápidos WAV/MIDI/JSON responsive.
10. Scratch Deck: captura masterizada de 1–8 compases, plato bidireccional mediante AudioWorklet, forma de onda, crossfader, filtro, sync, brake, spinback, stutter y control táctil/ratón/teclado responsive.
11. Studio Workflow: localizadores de clip/canción, timeline navegable, mesa de mezcla con medidores y A/B, grabación del master en directo, Export/Export As, gestión de destinos, WAV 16/32-bit, normalización y stems ZIP.
12. Performance Studio v5: Clip Launcher cuantizado y capturable, edición avanzada del arreglo, mezcla de precisión, tomas con eventos editables, Preset Vault, samples locales, Project Package y exportación profesional configurable.
13. Signal Core Identity: nombre oficial `КИБЕР VENGANCE`, wordmark cirílico/latino, monograma К/V original, icono PWA renovado y animación de señal accesible con reducción de movimiento.

## Decisiones técnicas

- Web Audio nativo mantiene latencia baja y elimina descargas, CORS y licencias de samples.
- Scheduling anticipado desacopla el reloj musical de la animación; una prueba con reloj controlado simula diez minutos de reproducción.
- Los buses FX son persistentes y de tamaño constante. Osciladores, fuentes de ruido y moduladores de cada voz se detienen y desconectan explícitamente.
- `OfflineAudioContext` comparte el modelo de eventos de la reproducción y renderiza el arreglo entero, no una captura en tiempo real.
- Todo el runtime (`core`, `audio`, `app` y modelo) nace de TypeScript estricto y se compila a módulos ES estáticos en `dist/`.
- La grabación libre conserva offset y duración sub-step. Web MIDI registra y reproduce pressure, CC74/timbre y pitch bend por canal, y actualiza voces sostenidas en vivo.
- El modelo v5 separa los metadatos serializables de tomas y samples de sus blobs binarios en IndexedDB. Project Package los reúne en un ZIP portátil sin introducir servidor ni servicios remotos.
- Los faders actúan sobre buses persistentes y no sobre la velocity de cada nota: volumen, pre-gain, panorama, solo/mute y sends pre/post responden también mientras una voz está sostenida.
- El producto es instalable como PWA y ofrece un informe de compatibilidad/diagnóstico exportable sin enviar datos fuera del dispositivo.
- La publicación es un directorio `dist/` estático. Selenium/Firefox, Playwright/Chromium y axe-core son solo dependencias de desarrollo.

## Criterios finales

- [x] Composición completa de cinco pistas mediante clips independientes de 1–8 compases.
- [x] Piano roll multioctava, drum sequencer, zoom y resoluciones 1/64–1/4.
- [x] Velocity, duración, selección múltiple, drag/resize, teclado, copy/paste, undo/redo y cuantización.
- [x] Selección múltiple mediante marco de ratón, con suma mediante Mayús.
- [x] Borrado seguro de clips con confirmación, protección del último clip, reasignación del arreglo y undo/redo.
- [x] Tonalidad, cinco escalas, ayuda visual, acordes, riffs, bajos, beats y variación controlada.
- [x] Song arranger con asignación de cinco clips, repeticiones, nombres, duplicación, borrado y reordenación.
- [x] Automatización interpolada de cutoff, volumen y panorama.
- [x] Dual oscillator polifónico, ADSR, filtros LP/HP/BP, LFO, arpegiador, unison, detune, glide y estéreo.
- [x] Batería electrónica con kick, snare, closed/open hat, tom, percusión y crash.
- [x] Guitarra de cuerda pulsada con transitorio de púa, armónicos, cuerpo resonante, presets y exportación completa.
- [x] Generador de bases de 2–6 secciones y tres estilos, con bajo, pad y batería adaptados a tonalidad, escala e intensidad.
- [x] Distorsión y saturación independientes, tone EQ, chorus, delay, reverb, compresión y limitador.
- [x] Solo exclusivo y mute por pista, con conmutación inmediata de buses y render WAV coherente.
- [x] Metrónomo, count-in, grabación QWERTY/táctil/MIDI, 4/4, 3/4, 6/8 y swing.
- [x] Seis macros: energy, darkness, tension, aggression, space y complexity.
- [x] Carácter independiente por clip: arpegiador, LFO, cadena de efectos y seis macros, con migración v2/v3 y render WAV por clip.
- [x] Autosave, proyecto vacío/demo, duplicado, snapshots, restauración e import/export JSON.
- [x] WAV y MIDI de arreglo completo o clips activos.
- [x] Manejo visible de errores, estados de render y migración v2/v3/v4→v5 sin alterar el material musical.
- [x] Build estático/PWA, runtime TypeScript estricto, 25 pruebas unitarias y 8 flujos de navegador: Firefox con audio/WAV/MPE sostenido y Chromium responsive/a11y/PWA/Scratch Deck/exportación persistente/Launcher/Arrange/mezcla/librerías.
- [x] Verificación visual de escritorio y móvil sin solapamiento ni scroll horizontal global.
- [x] Inglés por defecto, español persistente, tutorial guiado y descripciones contextuales accesibles para todos los controles.
- [x] Atajos sin colisión: `Shift+S` Solo, `Shift+M` Mute y `Shift+V` Mutation; escritura aislada en diálogos y campos.
- [x] Exportación desde la cabecera con repetición del último formato/destino y panel avanzado conservado.
- [x] Destinos persistentes por formato: `Export` reutiliza el archivo, `Export As` elige siempre otro y Project Core permite inspeccionarlos u olvidarlos, con descarga compatible como alternativa.
- [x] Scratch Deck fluido y bidireccional en Perform con búfer temporal no destructivo, interacción táctil/ratón/teclado, waveform, crossfader de potencia constante y efectos de interpretación.
- [x] Posición de inicio independiente para clips y canción completa, con seek exacto, lectura musical y navegación desde el timeline de Arrange.
- [x] Mesa Mix de cinco canales con medición real, volumen, panorama, sends, Solo/Mute, master y comparación A/B.
- [x] Grabación en tiempo real del master, incluido Scratch Deck, con guardado explícito de la toma.
- [x] Export/Export As con atajos, destinos administrables, WAV 16/32-bit, normalización y ZIP de master más cinco stems.
- [x] Clip Launcher de cinco pistas con cola beat/bar, stop por pista, control MIDI, captura de escenas y commit al arreglo.
- [x] Arrange avanzado con selección múltiple, copy/paste/duplicate/delete, fills, zoom, marcadores, cursor exacto, región de loop y punch-in.
- [x] Mezcla de precisión con pre-gain, faders en dB, medidores estéreo RMS/peak, peak hold, LUFS momentáneo aproximado, sends pre/post, colores, master bypass y A/B compensado.
- [x] Tomas persistentes con audio en IndexedDB y eventos v5 editables: trim, cuantización, retiming, valores, borrado y reproducción.
- [x] Preset Vault con búsqueda, tags, favoritos, presets de usuario e import/export de bancos JSON.
- [x] Siete slots de samples locales con trim, afinación, envolvente y reverse, coherentes en reproducción y render offline.
- [x] Exportación profesional con 44.1/48/96 kHz, dither TPDF, cola FX, dry/wet, región de loop, stems seleccionables, progreso/cancelación y Project Package.

## Dependencias externas inevitables y exclusiones deliberadas

La aplicación no tiene dependencias de ejecución ni servicios remotos. Depende únicamente de APIs estándar del navegador: Web Audio para sonido/render offline, Web MIDI cuando el navegador y el permiso lo permiten, `localStorage` para persistencia, IndexedDB/File System Access para recordar destinos de exportación compatibles y Service Worker/manifest para instalación. Las dependencias npm son exclusivamente herramientas de desarrollo: TypeScript, ESLint, Playwright, Selenium, geckodriver y axe-core.

La guitarra incluida es un modelo de cuerda pulsada deliberadamente sintético, diseñado para el lenguaje electro-rock del producto; no pretende reemplazar una librería acústica multisample. Samples comerciales, plugins externos, cuentas, backend, nube y colaboración remota exigirían licencias, infraestructura y una política de privacidad ajenas a un instrumento local. Se dejan fuera deliberadamente. El motor musical general usa scheduling sobre nodos nativos; el Scratch Deck sí utiliza un `AudioWorklet` dedicado porque su lectura bidireccional y continua necesita procesamiento fuera del hilo de interfaz.

## Límites externos verificables

- Safari/iOS requiere validación física en hardware Apple; el informe de compatibilidad permite adjuntar los datos del dispositivo, pero Linux no puede sustituir esa prueba.
- Web MIDI no está presente en todos los navegadores y siempre queda sujeto a permiso del usuario. QWERTY, ratón y táctil siguen funcionando sin él.
- File System Access no está presente en todos los navegadores. Sin él, Export/Export As usan descargas normales; con él, el navegador puede volver a pedir permiso de escritura entre sesiones.
- La grabación de interpretación depende de MediaRecorder y utiliza el contenedor de audio que ofrece el navegador, normalmente WebM/Opus. La exportación determinista de composición y stems continúa usando WAV.
- MediaRecorder entrega una forma de onda ya comprimida. Editar los eventos de una toma modifica su reproducción de controles sobre el audio exacto capturado, pero no vuelve a sintetizar retroactivamente esa grabación.
- Los blobs de samples y tomas viven en IndexedDB y pueden desaparecer al limpiar los datos del sitio. JSON conserva sus metadatos; para trasladar un proyecto con samples se debe usar Project Package.
- `OfflineAudioContext` no ofrece cancelación a mitad de una operación ya iniciada. El panel puede abortar antes o después de cada render y entre stems, evitando escrituras posteriores, pero no interrumpir el DSP interno de un stem en curso.
- La tipografía usa fallbacks del sistema para mantener el funcionamiento offline; puede variar ligeramente entre plataformas.
