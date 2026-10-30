# Validación de КИБЕР VENGANCE

![Capas de validación](../docs/wiki/assets/validation.svg)

## Ejecutar

Node.js **22.12+**; Python **3.12+** para pruebas del companion.

```sh
npm ci
npx playwright install chromium firefox
npm run check:full
python -m unittest discover -s companion/tests -v
node scripts/publish-wiki.mjs --check
```

| Comando | Comprueba |
| --- | --- |
| `npm run check` | Tipado estricto, distribución estática, lint y unitarias |
| `npm run test:e2e` | Flujos Chromium/Firefox, audio, persistencia, exportación, accesibilidad y responsive |
| `python -m unittest discover -s companion/tests -v` | Seguridad HTTP, instalación, jobs, cancelación y contratos nativos |
| `node scripts/publish-wiki.mjs --check` | Páginas, enlaces e imágenes del manual |

No se omiten navegadores ausentes. Configura `CHROMIUM_EXECUTABLE_PATH`, `FIREFOX_EXECUTABLE_PATH`, `FIREFOX_PLAYWRIGHT_MODULE` o `PYTHON_EXECUTABLE` si no usas los valores predeterminados.

En Linux sin dispositivo de audio: `node scripts/with-null-audio.mjs npm run check:full`. Los fixtures HTTP usan puerto libre y datos temporales, y los de workers bloquean Service Workers.

## Evidencia

Los fixtures de UI/protocolo no son inferencia real. Las pruebas de modelos son optativas por sus descargas/memoria. Ni PCM válido ni un null sink certifican calidad percibida, altavoces, Safari físico o rendimiento de GPU.

[Scripts reales, variables, arquitectura y releases](../docs/wiki/Desarrollo.md) · [Límites de compatibilidad](../docs/wiki/Compatibilidad-y-licencias.md).
