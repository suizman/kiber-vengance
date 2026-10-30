# Compatibilidad, privacidad y licencias

[English](Compatibility-and-licenses.md) | [Español](ES-Compatibility-and-licenses.md)

## Qué necesita conexión o permiso

La aplicación es estática y procesa música localmente: no requiere cuenta del estudio ni envía proyectos/prompts/audio a un servicio de inferencia. La primera carga, catálogos por URL y descargas explícitas de modelos sí contactan sus servidores. El repositorio, su manual y los instaladores publicados son públicos; consultarlos o descargarlos no requiere iniciar sesión en GitHub.

La PWA puede instalarse y funcionar offline después de la primera carga. Los modelos opcionales tienen sus propias cachés; no se descargan como parte del arranque normal. Audio, proyectos y modelos se pueden perder por separado al limpiar almacenamiento.

| Área | Límite práctico |
| --- | --- |
| Web Audio | Necesita un gesto inicial; salida/micrófono físicos se verifican aparte |
| Web MIDI / micrófono | Dependen de APIs, permisos y dispositivo |
| Importación MP3/OGG/WebM | Depende de codecs de decodeAudioData; los no soportados muestran error |
| Export a archivo enlazado | File System Access no existe en todos los navegadores; descarga como alternativa |
| Cue separado | Requiere selección/routing de salida; puede estar desactivado |
| IA local | Automatic prueba GPU y recurre a CPU; GPU no se deduce solo de la página |
| Safari/Orion | El WebKit automatizado no certifica esos navegadores físicos. Puede fallar el arranque de un worker frío offline; cargar el modelo antes de desconectar |
| Voz hablada y canto | Funciones de escritorio; aceleración según runtime/proveedor y hardware real |
| Warp / FX / LUFS | Warp cambia pitch, live/offline no es bit idéntico y LUFS-M es aproximado |

**Compatibility report**, en Project, muestra/copia capacidades, estado y sample rate sin telemetría. Las pruebas Chromium/Firefox, fixtures, inferencia real, escucha humana y hardware son evidencias distintas.

## Licencias

El software es **GPL-3.0-or-later**. Las composiciones incluidas en `projects/`, como **The Arrival**, están excluidas: **CC BY-NC-ND 4.0**, sin permiso automático para remixes, stems, sincronización o uso comercial. Esto no reclama derechos sobre composiciones creadas independientemente por usuarios ni concede derechos sobre la marca КИБЕР VENGANCE.

Los modelos/bancos/vocoders tienen licencias independientes. Kaiz incluye un vocoder CC-BY-NC 4.0 y no se presenta como autorizado para música comercial. Revisa condiciones antes de descargar/importar. Los paquetes nativos no incluyen pesos de modelos.

[Licencia del software](../../LICENSE) · [Composiciones incluidas](../../projects/LICENSE.md) · [Componentes del companion](../../companion/THIRD_PARTY.md).
