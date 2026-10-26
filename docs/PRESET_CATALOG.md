# Melody and sound presets

Open **AI melody → Melody & sound presets**. The included collection contains original КИБЕР VENGANCE recipes and native sound patches. Recipes prepare the generator; they still need a genuine local model to produce notes. Sound patches can be saved to Preset Vault and used without AI.

Choose a matching sound for the current target track, generate, listen, then add a new clip. Only **Apply this BPM** changes the project's base tempo; later tempo-map events remain unchanged. Clip insertion, sound and optional tempo change share one Undo action.

## Files and URLs

Import a UTF-8 JSON file, or provide an HTTPS URL that permits CORS. Maximum file/download size is 1 MB and maximum entries per catalog is 256. URL requests omit credentials, time out after 12 seconds and are cancellable. Imports are session-only unless a sound is explicitly saved to Vault. Existing native `kiber-vengance-preset-bank` version 1 banks are supported; mixer fields are never imported into a sound patch.

The authoritative example is [catalog-v1.json](../public/presets/catalog-v1.json). A minimal mixed catalog:

```json
{
  "format": "kiber-vengance-catalog",
  "version": 1,
  "presets": [
    {
      "kind": "melody", "id": "my-hook", "name": "My Hook",
      "tags": ["synthwave"], "style": "synthwave", "rhythm": "steady",
      "tempo": 110, "bars": 4, "key": "D", "scale": "minor",
      "prompt": "A short rising melodic hook with a repeating answer."
    },
    {
      "kind": "sound", "id": "my-lead", "name": "My Lead",
      "tags": ["lead"], "track": "lead",
      "instrument": {"wave": "sawtooth", "cutoff": 5200, "unison": 2},
      "character": {"fx": {"delay": 0.2, "reverb": 0.15}}
    }
  ]
}
```

Melody styles: `prompt`, `synthwave`, `darksynth`, `industrial`, `cinematic`, `electro-rock`, `ambient`, `techno`, `house`, `drum-and-bass`. Rhythms: `auto`, `sparse`, `steady`, `driving`, `syncopated`. Bars: 1, 2, 4 or 8. Scales: `minor`, `major`, `dorian`, `phrygian`, `harmonicMinor`. Keys use the application's sharp notation. IDs must be unique within a catalog.

Instrument/character fields use the application's native model. Missing values receive track defaults. Unknown instrument fields, including mixer state, are discarded. Unsupported waveforms, invalid values and other synthesizers' patch formats are rejected. Native Vault exports can round-trip through this importer.

## Official online collection and other sources

The configured canonical collection URL is `https://raw.githubusercontent.com/suizman/kiber-vengance/master/public/presets/catalog-v1.json`. The source and JSON were pushed in commit `7cb7667`, but anonymous requests still returned HTTP 404, including a revision-qualified query to avoid a previously cached failure. Public hosting/access remains unresolved; do not assume pushing a file makes it anonymously readable. The application reports that failure and retains its bundled collection. Publishing the app also ships the JSON at `/presets/catalog-v1.json`; this change has not been deployed to the site.

Online official refresh validates the same format. An arbitrary imported catalog cannot label itself official or replace included IDs. Third-party URLs remain externally sourced even if their JSON says otherwise.

The source directory links to [Vital](https://vital.audio/), [Surge XT](https://surge-synthesizer.github.io/) and [Serum 2](https://xferrecords.com/products/serum-2), with external searches restricted to their official domains. These products use their own synthesis engines. Their patches require those engines and cannot be imported into КИБЕР VENGANCE. Discovery links do not imply a format converter, license to redistribute third-party patches, or an integrated web-search API.

All included recipes and patches were authored for this project and ship under its GPL-3.0-or-later license. No third-party patch files are bundled.
