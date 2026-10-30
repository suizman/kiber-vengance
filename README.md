# КИБЕР VENGANCE

**Composición electro-rock, industrial, synthwave y cinematográfica, en tu navegador.**

[Abrir el estudio](https://studio.suizman.org) · [Manual completo](docs/wiki/Home.md) · [Releases](https://github.com/suizman/kiber-vengance/releases/latest)

![Compose en escritorio](docs/wiki/assets/compose.png)

## Cuatro espacios para crear un tema

| Espacio | Qué puedes hacer |
| --- | --- |
| **Compose** | Piano roll, cinco instrumentos, sonidos por clip, generadores, IA local, presets, FX y macros |
| **Arrange** | Secciones, tempo/compás, audio no destructivo, grabación, slicing, sampler, automatización y MIDI Learn |
| **Live** | Teclado/MIDI, clip launcher, dos Scratch Decks, Cue y grabación de actuaciones |
| **Mix** | Niveles en dB, Solo/Mute, grupos, sends, sidechain, Master, medidores, mono y A/B |

Autosave, recuperación y snapshots; proyectos v6 con importación v2–v5; JSON, **Project Package con audio**, WAV, MIDI y stems. Voz hablada y canto opcionales en escritorio. [Todas las funciones y sus límites](docs/wiki/Home.md).

## Empieza

Abre el estudio, pulsa Play o una tecla para activar el audio, elige una pista y edita su clip. Combina clips en Arrange, ajusta Mix y guarda un Project Package. No necesitas IA ni companion para componer.

Para ejecutar el código: Node.js **22.12+**.

```sh
npm ci
npm run dev
# http://127.0.0.1:4173
```

[Desarrollo y pruebas](docs/wiki/Desarrollo.md) · [Guía rápida](docs/wiki/Primeros-pasos.md) · [Atajos](docs/wiki/Atajos-y-ajustes.md).

## Audio local y modelos opcionales

El estudio procesa música localmente. Las descargas de modelos son explícitas; los proyectos, sus binarios y los modelos tienen almacenamiento separado. **JSON no contiene tus samples: usa Project Package.**

El [companion de escritorio](companion/README.md) añade DiffSinger y ACE-Step. Incluye instaladores Mac Intel/Apple Silicon, Windows x64 y Linux AppImage; los modelos se descargan aparte. [Compatibilidad y licencias de voces](docs/wiki/Voz-y-canto.md).

## Documentación y licencia

El [manual versionado](docs/wiki/Home.md) está organizado como páginas listas para la wiki de GitHub. Mientras se habilita la wiki nativa, esta copia ofrece toda la navegación. [Evidencia técnica](docs/DESKTOP_VOCALS.md), [plan](PRODUCT_PLAN.md) y [memoria del proyecto](PROJECT_MEMORY.md) retienen decisiones y resultados verificables.

Software: [GPL-3.0-or-later](LICENSE). Composiciones incluidas: [CC BY-NC-ND 4.0](projects/LICENSE.md), con condiciones independientes de los proyectos creados por usuarios. La marca oficial es **КИБЕР VENGANCE**; los slugs históricos se conservan por compatibilidad.
