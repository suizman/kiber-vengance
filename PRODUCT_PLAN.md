# Plan de producto y registro de versiones

## Visión

Kiber Vengance convierte la idea “cinematic machinery” en un instrumento: grafito, marfil, ámbar térmico y rojo de presión; geometría mecánica, movimiento reservado al estado musical y un vocabulario propio —Forge, Signal, Impact, Mutation— sin copiar una banda, videojuego o DAW existente.

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

## Decisiones técnicas

- Web Audio nativo mantiene latencia baja y elimina descargas, CORS y licencias de samples.
- Scheduling anticipado desacopla el reloj musical de la animación; una prueba con reloj controlado simula diez minutos de reproducción.
- Los buses FX son persistentes y de tamaño constante. Osciladores, fuentes de ruido y moduladores de cada voz se detienen y desconectan explícitamente.
- `OfflineAudioContext` comparte el modelo de eventos de la reproducción y renderiza el arreglo entero, no una captura en tiempo real.
- Todo el runtime (`core`, `audio`, `app` y modelo) nace de TypeScript estricto y se compila a módulos ES estáticos en `dist/`.
- La grabación libre conserva offset y duración sub-step. Web MIDI registra y reproduce pressure, CC74/timbre y pitch bend por canal, y actualiza voces sostenidas en vivo.
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
- [x] Manejo visible de errores, estados de render y migración v2/v3→v4.
- [x] Build estático/PWA, runtime TypeScript estricto, 20 pruebas unitarias y 4 flujos de navegador: Firefox con audio/WAV/MPE sostenido y Chromium responsive/a11y/PWA.
- [x] Verificación visual de escritorio y móvil sin solapamiento ni scroll horizontal global.
- [x] Inglés por defecto, español persistente, tutorial guiado y descripciones contextuales accesibles para todos los controles.
- [x] Atajos sin colisión: `Shift+S` Solo, `Shift+M` Mute y `Shift+V` Mutation; escritura aislada en diálogos y campos.
- [x] Exportación rápida desde la cabecera para canción WAV/MIDI y proyecto JSON, con opciones avanzadas conservadas.

## Dependencias externas inevitables y exclusiones deliberadas

La aplicación no tiene dependencias de ejecución ni servicios remotos. Depende únicamente de APIs estándar del navegador: Web Audio para sonido/render offline, Web MIDI cuando el navegador y el permiso lo permiten, `localStorage` para persistencia y Service Worker/manifest para instalación. Las dependencias npm son exclusivamente herramientas de desarrollo: TypeScript, ESLint, Playwright, Selenium, geckodriver y axe-core.

La guitarra incluida es un modelo de cuerda pulsada deliberadamente sintético, diseñado para el lenguaje electro-rock del producto; no pretende reemplazar una librería acústica multisample. Samples comerciales, plugins externos, cuentas, backend, nube y colaboración remota exigirían licencias, infraestructura y una política de privacidad ajenas a un instrumento local. Se dejan fuera deliberadamente. AudioWorklet personalizado tampoco aporta una ventaja medible al motor actual: el scheduling usa el reloj de audio y el DSP se ejecuta en nodos nativos.

## Límites externos verificables

- Safari/iOS requiere validación física en hardware Apple; el informe de compatibilidad permite adjuntar los datos del dispositivo, pero Linux no puede sustituir esa prueba.
- Web MIDI no está presente en todos los navegadores y siempre queda sujeto a permiso del usuario. QWERTY, ratón y táctil siguen funcionando sin él.
- La tipografía usa fallbacks del sistema para mantener el funcionamiento offline; puede variar ligeramente entre plataformas.
