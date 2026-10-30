# Validating КИБЕР VENGANCE

Manual: [English (default)](../docs/wiki/Development.md) / [Español](../docs/wiki/ES-Development.md). Shared screenshots and diagrams use English labels in both editions.

![Validation layers](../docs/wiki/assets/validation.svg)

## Run

Node.js **22.12+**; Python **3.12+** for companion tests.

```sh
npm ci
npx playwright install chromium firefox
npm run check:full
python -m unittest discover -s companion/tests -v
node scripts/publish-wiki.mjs --check
```

| Command | Checks |
| --- | --- |
| `npm run check` | Strict types, static distribution, lint and unit tests |
| `npm run test:e2e` | Chromium/Firefox workflows, audio, persistence, export, accessibility and responsive layouts |
| `python -m unittest discover -s companion/tests -v` | HTTP security, installation, jobs, cancellation and native contracts |
| `node scripts/publish-wiki.mjs --check` | Manual pages, links and images |

Missing browsers are not skipped. Set `CHROMIUM_EXECUTABLE_PATH`, `FIREFOX_EXECUTABLE_PATH`, `FIREFOX_PLAYWRIGHT_MODULE` or `PYTHON_EXECUTABLE` when defaults do not fit your environment.

On headless Linux: `node scripts/with-null-audio.mjs npm run check:full`. HTTP fixtures use a free port and temporary data; worker fixtures block Service Workers.

## Evidence

UI/protocol fixtures are not real inference. Model tests are opt-in because of downloads and memory use. Valid PCM and a null sink do not certify perceived quality, physical speakers, native Safari or GPU performance.

[Real-model scripts, environment variables, architecture and releases](../docs/wiki/Development.md) · [Compatibility limits](../docs/wiki/Compatibility-and-licenses.md).
