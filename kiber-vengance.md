Quiero que diseñes y construyas una aplicación profesional de creación musical enfocada en electro-rock, música épica, industrial, synthwave, electrónica frenética y estilos híbridos cinematográficos.

El grupo musical y todo el proyecto se llaman oficialmente **КИБЕР VENGANCE**. Usa este nombre de forma consistente en la aplicación, la identidad visual, los metadatos, los proyectos de demostración y la documentación. `КИБЕР` se escribe con caracteres cirílicos y `VENGANCE` con caracteres latinos. Los slugs, nombres de fichero y claves históricas `kiber-vengance` se conservan únicamente por compatibilidad técnica.

No quiero un MVP, una prueba de concepto ni una interfaz superficial. Quiero una aplicación completa, coherente, estable, visualmente atractiva y realmente divertida de usar. Debe sentirse como un instrumento musical creativo, no como un simple conjunto de controles de audio.

Trabaja primero en modo Plan. Antes de modificar archivos:

1. Inspecciona por completo el repositorio, su arquitectura, dependencias, scripts y estado actual.
2. Determina el enfoque técnico más adecuado. Probablemente será una web app, pero puedes elegir otra arquitectura si existe una razón clara y demostrable.
3. Define una visión de producto concreta y una experiencia de usuario completa.
4. Divide el desarrollo en versiones iterativas, pero todas deben conducir a un producto final serio, no a un MVP.
5. Identifica riesgos técnicos —audio en tiempo real, latencia, rendimiento, scheduling, compatibilidad, persistencia y exportación— y decide cómo resolverlos.
6. Presenta un plan detallado con arquitectura, fases, criterios de aceptación, estrategia de pruebas y decisiones técnicas.
7. Hazme únicamente las preguntas que realmente cambien el producto de forma sustancial. Para las decisiones menores, usa tu mejor criterio y continúa.

Después de aprobar o cerrar el plan, implementa la aplicación completa y ve iterándola. No te limites a entregar recomendaciones: escribe el código, ejecútalo, pruébalo, corrige los problemas y pule el resultado.

## Identidad de КИБЕР VENGANCE

КИБЕР VENGANCE es tanto el nombre del grupo como el nombre del proyecto y de la aplicación. La experiencia debe transmitir movimiento, energía, tensión, contundencia, precisión mecánica y una escala cinematográfica.

Define una identidad propia para КИБЕР VENGANCE que incluya:

- Dirección visual y personalidad de marca.
- Logotipo o wordmark original cuando sea apropiado.
- Paleta, tipografía, iconografía y lenguaje de movimiento coherentes.
- Una voz de producto reconocible en textos, presets, demos y onboarding.
- Nombres memorables y coherentes para presets y proyectos de demostración.

Evita copiar la identidad de grupos, videojuegos, películas, DAWs o marcas existentes. La marca debe ser original y el diseño debe reforzar el carácter del grupo sin perjudicar la claridad de la herramienta.

## Visión del producto

La aplicación debe permitir crear rápidamente temas que puedan sonar:

- Épicos y cinematográficos.
- Frenéticos, agresivos y llenos de energía.
- Electro-rock e industrial.
- Synthwave, darksynth y cyberpunk.
- Atmosféricos, oscuros o emocionales.
- Híbridos, mezclando sintetizadores, baterías electrónicas y elementos de rock.

Debe funcionar tanto para experimentar de forma inmediata como para componer una pieza estructurada.

## Experiencia principal

Diseña un flujo en el que el usuario pueda:

- Empezar a producir sonido en pocos segundos.
- Tocar instrumentos con el teclado del ordenador, ratón, pantalla táctil y MIDI cuando sea viable.
- Crear y editar secuencias.
- Combinar sintetizadores, bajo, batería y capas atmosféricas.
- Construir progresiones, riffs, arpegios, ritmos y automatizaciones.
- Organizar patrones dentro de una canción.
- Modificar el carácter musical en tiempo real.
- Guardar, cargar, duplicar y versionar proyectos.
- Exportar el resultado de una manera útil.

La complejidad debe aparecer progresivamente. Los controles esenciales deben ser inmediatos y los avanzados deben estar disponibles sin convertir la interfaz en un panel caótico.

## Capacidades musicales esperadas

Evalúa, diseña e implementa de forma coherente:

### Motor de audio

- Síntesis polifónica con osciladores combinables.
- Formas de onda clásicas y, si la arquitectura lo permite, wavetable o formas adicionales.
- Envolventes ADSR.
- Filtros con cutoff, resonancia y distintos modos.
- LFO y matriz de modulación.
- Unison, detune, glide y control estéreo.
- Gestión correcta de voces y prevención de clipping.
- Scheduling musical preciso y estable.
- Cadena de efectos con distorsión, saturación, chorus, delay, reverb, compresión y ecualización.
- Analizadores visuales útiles, como forma de onda, espectro o nivel.
- Master bus con control de ganancia y limitación razonable.

### Instrumentos y capas

- Lead para melodías agresivas o épicas.
- Bajo capaz de cubrir sonidos electrónicos e industriales.
- Pads y texturas atmosféricas.
- Arpegiador.
- Drum machine con kick, snare, hats, toms, crashes y percusión.
- Elementos de rock o híbridos cuando puedan implementarse con suficiente calidad.
- Presets musicales bien diseñados para distintos estados de ánimo y géneros.

Evita simular instrumentos realistas de forma mediocre. Si una capacidad requiere samples o tecnología externa, toma una decisión arquitectónica explícita y usa una alternativa de calidad.

### Composición

- Piano roll o editor de notas realmente utilizable.
- Step sequencer para batería y patrones.
- Cuantización y distintas resoluciones rítmicas.
- Tempo, compás, swing y longitud de patrón.
- Velocity, duración de nota y parámetros expresivos.
- Copiar, pegar, duplicar, borrar, deshacer y rehacer.
- Selección múltiple y edición mediante teclado.
- Escalas, tonalidades y ayudas armónicas opcionales.
- Generadores musicales controlables para acordes, riffs, bajos, baterías o arpegios.
- Variaciones con intensidad regulable, evitando resultados aleatorios sin intención.
- Song arranger con escenas o secciones como intro, buildup, drop, verso, estribillo, breakdown y outro.
- Automatización de parámetros importantes.

### Interpretación y control

- Teclado musical en pantalla.
- Mapeo cómodo del teclado del ordenador.
- Soporte MIDI si la plataforma elegida lo permite.
- Grabación en tiempo real con metrónomo y count-in.
- Controles macro como energía, oscuridad, tensión, agresividad, espacio y complejidad.
- Cambios en tiempo real sin cortes ni artefactos innecesarios.

### Proyectos y exportación

- Guardado automático y recuperación ante fallos.
- Proyectos guardados localmente y arquitectura preparada para almacenamiento remoto futuro.
- Importación y exportación del formato interno del proyecto.
- Exportación de audio mediante la opción más sólida que permita la plataforma.
- Exportación MIDI si es técnicamente viable.
- Proyectos de demostración de КИБЕР VENGANCE que enseñen las capacidades de la app.

## Diseño y experiencia visual

Quiero un diseño moderno, distintivo y funcional, con una identidad asociada a КИБЕР VENGANCE, al electro-rock y a la producción cinematográfica, pero sin caer en clichés de “neón por todas partes”.

Debe incluir:

- Jerarquía visual clara.
- Excelente uso de espacio, tipografía, color y contraste.
- Diseño responsive razonable, priorizando escritorio para la producción musical.
- Estados hover, focus, active, disabled, loading y error bien resueltos.
- Accesibilidad de teclado y contraste.
- Tooltips y ayuda contextual donde aporten valor.
- Feedback visual inmediato al tocar, grabar, secuenciar o automatizar.
- Animaciones sutiles y funcionales.
- Componentes consistentes y reutilizables.
- Una experiencia cuidada tanto con proyectos vacíos como con proyectos complejos.

No hagas una interfaz genérica de dashboard, una colección de tarjetas ni una copia visual pobre de un DAW conocido. Construye una identidad propia.

## Arquitectura y calidad

Selecciona el stack basándote en las necesidades del producto, no por costumbre. Para una web app, considera tecnologías adecuadas para audio de baja latencia, como Web Audio API, AudioWorklet y una abstracción de audio solamente cuando aporte valor real.

La solución debe tener:

- Separación clara entre motor de audio, modelo musical, scheduling, estado, persistencia e interfaz.
- Estado predecible y serializable.
- Tipado estricto.
- Componentes reutilizables.
- Manejo correcto del ciclo de vida del contexto de audio.
- Rendimiento estable durante reproducción y edición.
- Compatibilidad con los navegadores objetivo.
- Ningún secreto ni credencial dentro del cliente.
- Dependencias justificadas y mantenibles.
- Datos de demo y presets incluidos de forma limpia.
- Migración o versionado del formato de proyecto.
- Manejo visible y recuperable de errores.

No escondas problemas con mocks, botones decorativos o funciones que aparenten estar implementadas. Todo control visible debe funcionar. Si alguna característica no puede completarse con calidad, elimínala de la interfaz o implementa una alternativa honesta.

## Estrategia de versiones

Trabaja mediante versiones internas claramente diferenciadas:

### Versión 1 — Fundamentos sólidos

Construye la arquitectura, el motor de audio, transporte, instrumentos esenciales, secuenciador, persistencia básica y sistema visual de КИБЕР VENGANCE.

### Versión 2 — Flujo de composición

Añade edición avanzada, arreglos, automatización, presets, macros, grabación y mejoras importantes de usabilidad.

### Versión 3 — Profundidad y personalidad

Añade herramientas generativas controlables, presets de alta calidad, escenas, variaciones musicales, visualización avanzada y una identidad audiovisual más fuerte.

### Versión 4 — Pulido de producto

Realiza una revisión completa de UX, accesibilidad, rendimiento, compatibilidad, errores, proyectos demo, onboarding, exportación y detalles visuales.

Estas versiones son hitos de implementación, no entregas incompletas. Avanza entre ellas de forma autónoma, verificando cada una antes de continuar.

Después de cada versión:

1. Ejecuta la aplicación.
2. Comprueba el flujo completo como usuario.
3. Ejecuta las pruebas y herramientas de calidad.
4. Busca errores funcionales, visuales y de rendimiento.
5. Corrige los problemas encontrados.
6. Compara el resultado con los criterios de aceptación.
7. Resume brevemente qué mejoró y qué debe abordarse en la siguiente iteración.

## Pruebas y validación

Incluye las pruebas que correspondan al stack:

- Pruebas unitarias del modelo musical y la lógica de secuenciación.
- Pruebas del scheduling y transporte con reloj controlado cuando sea posible.
- Pruebas de serialización y migración de proyectos.
- Pruebas de componentes y flujos críticos.
- Pruebas end-to-end del recorrido principal.
- Comprobaciones de accesibilidad.
- Verificación responsive.
- Typecheck, lint y build de producción.
- Pruebas manuales del audio en los navegadores objetivo.
- Comprobación de que no haya errores ni advertencias evitables en consola.
- Evaluación de rendimiento con proyectos de complejidad realista.

No declares completada una función solo porque compila. Debe poder utilizarse dentro del flujo real de la aplicación.

## Criterios de aceptación finales

Considera terminado el trabajo únicamente cuando:

- La aplicación pueda crear una composición completa con varias pistas.
- El audio sea estable, musical y responda correctamente.
- El usuario pueda editar, reproducir, guardar, recuperar y exportar un proyecto.
- Haya presets y proyectos demo convincentes de КИБЕР VENGANCE.
- Los controles visibles sean funcionales.
- Los flujos principales estén probados.
- El diseño se sienta cohesionado, profesional y propio de КИБЕР VENGANCE.
- La aplicación tenga buen rendimiento con un proyecto representativo.
- El build de producción termine correctamente.
- No existan errores críticos conocidos.
- La documentación explique instalación, ejecución, arquitectura, controles, atajos y limitaciones reales.

## Forma de trabajar

- Sé ambicioso, pero toma decisiones realistas.
- Prioriza profundidad, cohesión y calidad musical sobre una lista inflada de funciones.
- Mantén una lista viva de criterios de aceptación y deuda técnica.
- Inspecciona el resultado visual y funcional durante el desarrollo.
- Si encuentras una decisión equivocada, refactoriza en lugar de acumular parches.
- Conserva lo que ya funcione correctamente en el repositorio.
- No sustituyas trabajo real por pseudocódigo.
- No detengas el desarrollo después de la primera versión funcional.
- Continúa iterando hasta alcanzar el nivel de producto descrito.
- Documenta cualquier limitación inevitable con honestidad.

Comienza inspeccionando el repositorio y elaborando el plan completo. En el plan, incluye también qué características dejarías fuera deliberadamente para proteger la calidad del producto y por qué.

---

## Diseño vigente y estado construido

Esta sección actualiza el encargo original con el diseño real alcanzado. El registro operativo completo está en `PROJECT_MEMORY.md` y el seguimiento de criterios se mantiene en `PRODUCT_PLAN.md`.

### Concepto de experiencia

КИБЕР VENGANCE se articula como un **cockpit de composición cyberpunk**: rápido para tocar y generar ideas, profundo para editar clips y audio, y suficientemente estructurado para terminar una canción. La complejidad se organiza en seis espacios:

1. **Forge** — diseño del instrumento y del clip: piano roll, automatización, síntesis, movimiento, efectos, macros y ayudas armónicas.
2. **Launch** — interpretación no lineal: matriz de clips, lanzamiento cuantizado, stop por pista y captura de escenas.
3. **Audio** — producción híbrida: importación, grabación, resampling, sampler cromático Prism Keys, regiones no destructivas, fades, pitch, warp por velocidad, automatización, modulación y MIDI Learn.
4. **Arrange** — construcción de la canción: secciones, selección y edición múltiple, fills, marcadores, mapas de tempo/compás, loop, punch-in y navegación exacta.
5. **Mix** — acabado técnico: ganancia, faders, panorama, routing, sidechain, medición estéreo, LUFS/ceiling, mono y comparación A/B.
6. **Perform** — interpretación inmediata: teclado, MIDI, macros expresivos, Scratch Deck y grabación de tomas.

Perform añade además un **Scratch Deck** diseñado como instrumento táctil: captura
una mezcla masterizada de los clips activos, importa audio local decodificable por
el navegador o recibe una región editada desde Audio Studio, y permite recorrerla en
ambas direcciones mediante un AudioWorklet, con crossfader, filtro, sincronía,
freno, spinback, stutter y feedback de forma de onda. La captura de deck es
temporal y no destructiva. Record Take conserva el audio en IndexedDB y guarda
en el proyecto v6 un registro editable de eventos de interpretación. `Resample Deck`
convierte explícitamente el búfer temporal en una región persistente de Audio Studio.

Focus reduce el ruido visual, los racks plegables conservan preferencias y `Ctrl/Cmd+K` permite ejecutar acciones sin abandonar el teclado.

### Sistema visual definitivo

- Emblema vectorial К/V “Signal Core”: hexágono mecánico abierto, geometría fusionada y una incisión de señal de audio; wordmark híbrido `КИБЕР VENGANCE`.
- Animación contenida de señal, pulso y ensamblaje en la interfaz, con versión estática para el icono instalable y respeto de `prefers-reduced-motion`.
- Fondo azul-negro profundo con superficies escalonadas y color funcional: cian para señal/acción, magenta para energía, violeta para profundidad, lima para generación/estado válido y rojo para grabación o acciones destructivas.
- Tipografía condensada para identidad y titulares, sans técnica para parámetros y microcopy.
- Bordes luminosos contenidos, geometría recortada, indicadores de presión y movimiento únicamente cuando comunican estado.
- Jerarquía compacta de estudio: transporte y exportación arriba, pistas a la izquierda, contexto musical en el centro y estado global al pie.
- Responsive centrado en móvil táctil: diales con −/+, pistas horizontales, paneles plegables, escala de interfaz 80–120% y scroll local para controles densos. Los breakpoints se auditan también a 1366×768, no solo en pantallas grandes.

### Modelo musical construido

- Proyecto serializable v6 con cinco pistas generadas —lead, guitarra, bass, pad y drums— y un número abierto de pistas de audio.
- Cada pista puede contener múltiples clips de 1–8 compases. Cada sección del arreglo referencia un clip distinto por pista.
- Cada clip posee notas, automatización y carácter independiente: arpegiador, LFO, cinco efectos más tone/EQ y seis macros.
- El arreglo completo, los loops de clips de distinta longitud y las repeticiones alimentan el mismo modelo de eventos usado por reproducción, WAV y MIDI.
- Solo es exclusivo y Mute es independiente. Ambos afectan a reproducción y render exportado.
- El proyecto añade colores, pre-gain, grupos y modo de envío por pista; marcadores, tempo/meter maps, loop/punch, zoom, launcher, tomas, automatización global, modulación y MIDI mappings.
- Las regiones de audio conservan start/length/offset/gain/fades/pitch/source BPM/warp. Prism Keys conserva su asset, root, trim, tune, envolvente, filtro, modo y polifonía; los samples, audio de regiones y tomas se guardan fuera del JSON en IndexedDB. Project Package reúne JSON y assets disponibles.

### Flujo de creación construido

1. Seleccionar una pista o usar `1`–`5`.
2. Tocar con QWERTY, pantalla táctil o MIDI, o generar acordes, riffs, bajo, batería y bases.
3. Editar en el piano roll con drag/resize, selección rectangular, velocity, duración, cuantización y automatización.
4. Dar carácter por clip con síntesis, arpegiador, LFO, efectos y macros.
5. Improvisar en Launch con cola cuantizada y convertir la interpretación en nuevas secciones del arreglo.
6. Importar o grabar audio, tocar cualquier muestra cromáticamente con Prism Keys —feedback luminoso, QWERTY `A W S E D F T G Y H U J K`, octavas `Z/X`, touch y MIDI—, remezclar el plato, cortar transitorios en pads y editar regiones no destructivas en Audio Studio.
7. Construir y editar secciones en Arrange, generar una base que preserve guitarra y lead, colocar marcadores, tempo/compás y definir loop/punch.
8. Mezclar canales y lanes con pre-gain, grupos, sidechain, faders dB, panorama, sends, medidores, mastering/mono y comparación A/B.
9. Interpretar y grabar con metrónomo, count-in, swing, timing cuantizado/libre y Scratch Deck; editar después los eventos de la toma.
10. Elegir el punto de inicio del clip o de la canción con localizadores musicales y navegar a una posición exacta desde la línea temporal.
11. Pausar en el cursor y continuar desde la misma posición, incluso dentro de una región de audio importada.
12. Exportar canción, región o clips a WAV/MIDI, generar stems seleccionados, guardar JSON o crear un Project Package. La cabecera separa claramente Export de Export As.

### Persistencia y significado de exportar

- Los cambios se guardan automáticamente en `localStorage` tras una breve espera.
- Los snapshots nombrados y puntos automáticos de recuperación permiten restaurar estados locales; las plantillas cubren demo, minimal, performance y sesión híbrida.
- JSON es el formato portátil para estructura y edición. Project Package es la copia transportable recomendada cuando existen samples o regiones de audio locales.
- `Export` actualiza el último archivo vinculado; `Export As` permite elegir explícitamente formato y destino. `Ctrl/Cmd+E` y `Ctrl/Cmd+Shift+E` reproducen esa distinción.
- En navegadores compatibles, cada tipo de exportación conserva su handle localmente. Project Core muestra esos destinos y permite olvidarlos.
- Si File System Access no está disponible, se descarga una instantánea nueva. El navegador también puede volver a pedir permiso de escritura entre sesiones.
- WAV puede generarse en PCM de 16 bits o float de 32 bits a 44.1/48/96 kHz, con normalización, dither TPDF, cola FX, salida dry y región de loop opcionales. Stems crea un ZIP sin compresión con los canales seleccionados y un manifiesto.

### Atajos sin colisión musical

- `Shift+S`: Solo de la pista activa; `S` sigue tocando una nota.
- `Shift+M`: Mute de la pista activa.
- `Shift+V`: Mutation del clip activo, reasignado para liberar Mute.
- `Shift+L`: Clip Launcher; `Shift+X`: Mix Console.
- `Ctrl/Cmd+E`: repetir la última exportación; `Ctrl/Cmd+Shift+E`: Export As.
- Los diálogos y campos de texto aíslan la escritura del teclado musical.

### Arquitectura final

- TypeScript estricto compilado a módulos ES estáticos.
- `model` define contratos; `core` concentra lógica musical pura; `audio` contiene Web Audio y render offline; `app` coordina UI y persistencia.
- Scheduling anticipado basado en el reloj de audio, buses FX persistentes y liberación explícita de voces evitan cortes y crecimiento del grafo.
- Aplicación estática instalable como PWA, sin secretos, telemetría ni dependencias de ejecución.
- Migraciones v2/v3/v4/v5→v6 preservan proyectos, trasladan el antiguo carácter de pista a cada clip y añaden audio/routing/automation con valores seguros.

### Calidad y estado de aceptación

La puerta de calidad actual es `npm run check:full`: TypeScript, build, ESLint, pruebas unitarias y recorridos reales en Chromium/Firefox. La cobertura incluye escritorio, móvil y 1366×768, accesibilidad, PWA, Audio Studio, edición de regiones, automatización, routing/mastering, Export/Export As, Launcher, Arrange, librerías, performance y Scratch Deck.

Las limitaciones externas permanecen explícitas: Web MIDI, micrófono y File System Access dependen del navegador/permiso; MediaRecorder decide el contenedor; el warp actual se basa en playback-rate y cambia pitch y tempo juntos; los blobs locales requieren Project Package; Safari/iOS requieren hardware Apple; y `OfflineAudioContext` no interrumpe DSP ya iniciado. La persistencia es local y no existe backend, nube, colaboración remota ni plugins nativos.

## Studio interface refactor (2026-10-25)

The approved four-workspace interface is implemented using Vite, a Preact shell and shared keyboards/dials/dialogs. Ten feature controllers preserve the music workflows and project schema v6. Signal KV is the selected SVG identity. Common typography, focus/disabled states, inspector, bilingual catalog and pointer lifecycles replace the previous navigation/control patches. Hidden panels render on demand; inactive animations stop and waveform envelopes are cached. Native edit prompts are replaced by validated cancelable dialogs. See `docs/REFACTOR.md` for feature parity, implementation decisions, performance evidence and real-device limits. Earlier descriptions of Forge/Audio/Perform as top-level tabs describe the previous interface.
