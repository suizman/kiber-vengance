# КИБЕР VENGANCE

**Electro-rock, industrial, synthwave and cinematic composition in your browser.**

[Open the studio](https://studio.suizman.org) · [Complete manual](docs/wiki/Home.md) · [Releases](https://github.com/suizman/kiber-vengance/releases/latest)

![Compose on desktop](docs/wiki/assets/compose.png)

## Four workspaces for a complete song

| Workspace | What you can do |
| --- | --- |
| **Compose** | Piano roll, five instruments, per-clip sounds, generators, local AI, presets, FX and macros |
| **Arrange** | Sections, tempo/meter, non-destructive audio, recording, sampler, automation and MIDI Learn |
| **Live** | Keyboard/MIDI, clip launcher, two Scratch Decks, Cue and performance recording |
| **Mix** | dB levels, Solo/Mute, groups, sends, sidechain, Master, meters, mono and A/B |

Autosave, recovery and snapshots; v6 projects with v2–v5 imports; JSON, **Project Package with audio**, WAV, MIDI and stems. Optional speech and singing on desktop. [All features and their limits](docs/wiki/Home.md).

## Get started

Open the studio, press Play or a piano key to activate audio, select a track and edit its clip. Combine clips in Arrange, balance Mix and save a Project Package. AI and the companion are optional.

To run from source, install Node.js **22.12+**:

```sh
npm ci
npm run dev
# http://127.0.0.1:4173
```

[Development and tests](docs/wiki/Development.md) · [Quick start](docs/wiki/Getting-started.md) · [Shortcuts](docs/wiki/Shortcuts-and-settings.md).

## Local audio and optional models

The studio processes music locally. Model downloads are explicit; projects, audio assets and models have separate storage lifecycles. **JSON does not contain your samples: use Project Package.**

The [desktop companion](companion/README.md) adds DiffSinger and ACE-Step. Installers cover Intel/Apple Silicon Macs, Windows x64 and Linux AppImage; models download separately. [Voice compatibility and licensing](docs/wiki/Speech-and-singing.md).

## Documentation and licensing

The [versioned manual](docs/wiki/Home.md) is organized as GitHub Wiki pages. This repository copy provides working navigation while the native wiki is being enabled. [Technical evidence](docs/DESKTOP_VOCALS.md), the [product plan](PRODUCT_PLAN.md) and [project memory](PROJECT_MEMORY.md) retain decisions and verified results.

Software: [GPL-3.0-or-later](LICENSE). Included compositions: [CC BY-NC-ND 4.0](projects/LICENSE.md), independently of music created by users. The official identity is **КИБЕР VENGANCE**; historical slugs remain for compatibility.
