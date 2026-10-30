# Desarrollo, pruebas y publicación

## Ejecutar el estudio

Node.js **22.12+** y npm. El navegador sirve la aplicación estática; no necesita Node en producción.

```sh
npm ci
npm run dev
# http://127.0.0.1:4173
```

| Ruta | Responsabilidad |
| --- | --- |
| `src/core.ts`, `src/model.ts` | Modelo v6, migraciones, eventos musicales e historial |
| `src/audio.ts`, `src/audio/`, `src/scratch-worklet.ts` | Scheduler, síntesis, DSP, routing, WAV y decks |
| `src/features/`, `src/ui/`, `src/app.ts` | Controladores, shell Preact, teclados, diálogos y puente |
| `src/ai/` | Compositor y motores opcionales aislados |
| `companion/` | Servidor loopback, seguridad, jobs, instalación y motores nativos |
| `public/`, `index.html` | Entradas estáticas; `dist/` es generado y versionado |
| `docs/wiki/` | Fuente versionada del manual; `docs/*.md` retiene evidencia técnica |

[Arquitectura detallada](../REFACTOR.md) · [Diseño](../DESIGN.md) · [Formato de catálogos](../PRESET_CATALOG.md) · [I18N](../I18N.md).

## Comprobaciones

![Capas de validación](assets/validation.svg)

```sh
npx playwright install chromium firefox
npm run check:full
# Python 3.12+, para el companion
python -m unittest discover -s companion/tests -v
node scripts/publish-wiki.mjs --check
```

`npm run check` hace tipado, build, lint y unitarias; `check:full` añade todos los flujos de navegador y no omite motores ausentes. Usa `CHROMIUM_EXECUTABLE_PATH` / `FIREFOX_EXECUTABLE_PATH` si necesitas binarios propios. `FIREFOX_PLAYWRIGHT_MODULE` selecciona un launcher compatible con Firefox antiguo. `PYTHON_EXECUTABLE` evita depender de un comando `python` inexistente.

En Linux sin salida de audio: `node scripts/with-null-audio.mjs npm run check:full`; usa PulseAudio y un null sink, sin certificar altavoces físicos. `PULSEAUDIO_EXECUTABLE_PATH` admite una instalación externa.

Los fixtures del companion usan un puerto libre, datos temporales y Service Workers bloqueados. Simulan protocolo/PCM, no modelos. Los flujos comprueban composición, historial, persistencia/binarios, audio/mixer/decks, exportación, accesibilidad, responsive, cancelación y límites de carga opcional.

## Inferencia y medidas optativas

| Script | Requisitos y resultado |
| --- | --- |
| `scripts/test-local-ai.mjs` | Modelos reales; CPU/GPU y navegador seleccionables con `AI_TEST_BACKEND`, `AI_TEST_BROWSER`, `AI_TEST_PLAYWRIGHT_MODULE`, `AI_TEST_PORT` |
| `scripts/test-local-voice.mjs` | Kokoro real; `VOICE_PRECISION=fp32` para la comparación; muestras en el directorio temporal del sistema |
| `scripts/test-expressive-voice.mjs` | Chatterbox real; descarga y memoria elevadas |
| `scripts/verify-desktop-vocals.mjs` | Ambos motores instalados; `KV_VOCALS_REAL_DATA` apunta a datos de aceptación desechables |
| `scripts/measure-ui.mjs` | Medidas locales de carga/DOM/assets; no métricas de campo |
| `scripts/prepare-composer-listening.mjs` | Pares WAV de compilador con clave aparte; no equivale a estudio de preferencia ni a salidas reales de IA |

`VOICE_MODEL_MIRROR` puede suministrar bytes originales de modelos/runtime; no sustituye la inferencia. Variantes `AI_TEST_UNSAFE_WEBGPU` son configuración de laboratorio, no soporte garantizado. Escucha, MIDI/micrófono/auriculares físicos, Safari/Orion y memoria/GPU reales siguen siendo comprobaciones independientes.

## Companion y releases

Desarrollo: `PYTHONPATH=companion python -m kv_companion`. Packaging nativo con `python companion/packaging/build.py --platform macos-x64`, `macos-arm64`, `windows-x64` o `linux-x64`, en el runner de su arquitectura. Python, uv y herramientas están fijados por hash; modelos y drivers no se empaquetan.

Un push a master con cambios del companion produce artefactos. Una etiqueta `desktop-vocals-vX.Y.Z` que coincida con la versión activa compilación de los cuatro paquetes; el workflow de publicación verifica fuente/versión/checksums, adjunta a un borrador y publica cuando está completo. No reemplaza un asset existente distinto. Certificados de editor/notarización requieren los del propietario.

## Manual y wiki

Edita las páginas de `docs/wiki/`. Los enlaces `.md` funcionan en el repositorio; el publicador adapta páginas/enlaces e incluye los assets para GitHub Wiki. Valida con `--check`; `--render /ruta/absoluta` prepara una copia sin red.

Para publicar, GitHub debe tener **Settings → General → Features → Wikis** activado y una primera página Home creada. En repositorios privados, GitHub exige un plan que incluya wikis privadas. Ejecuta `node scripts/publish-wiki.mjs --publish`: usa el remoto SSH de la wiki, conserva páginas ajenas y no cambia visibilidad/configuración. Si GitHub no está preparado, el manual del repositorio sigue funcionando. [Documentación oficial de wikis](https://docs.github.com/en/communities/documenting-your-project-with-wikis).

## Sites

GitHub y ChatGPT Sites tienen historias distintas. Conserva `.openai/hosting.json`, audiencia y dominio; sincroniza los archivos verificados en un checkout aislado y publica mediante la habilidad Sites. No mezcles historias ni publiques un dist sin validar. Un push GitHub no despliega automáticamente el Site.

[Continuidad](../../PROJECT_MEMORY.md) · [Plan](../../PRODUCT_PLAN.md) · [Encargo](../../kiber-vengance.md).
