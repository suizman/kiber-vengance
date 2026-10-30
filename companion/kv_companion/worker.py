"""Isolated heavy work. Invoked with the selected engine's Python executable."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import sys

from .store import atomic_json, child_path


def inspect_voice(root: Path, archive_root: Path, voice_id: str, details: dict):
    import yaml
    configs = sorted(archive_root.rglob("dsconfig.yaml"), key=lambda p: len(p.parts))
    main = next((p for p in configs if isinstance(yaml.safe_load(p.read_text(encoding="utf-8-sig")), dict)
                 and yaml.safe_load(p.read_text(encoding="utf-8-sig")).get("acoustic")), None)
    if not main:
        raise ValueError("This archive contains no ONNX DiffSinger acoustic model")
    config = yaml.safe_load(main.read_text(encoding="utf-8-sig"))
    bank = main.parent
    child_path(bank, config["acoustic"]).stat()
    vocab = child_path(bank, config.get("phonemes", "phonemes.txt"))
    from .engines.diffsinger import load_mapping
    phones = load_mapping(vocab)
    vocoder_name = config.get("vocoder", "")
    vocoder = child_path(bank, vocoder_name)
    if not (vocoder / "vocoder.yaml").exists():
        raise ValueError("Import a voice archive containing its matching vocoder (vocoder.yaml and ONNX file)")
    vocoder_config = yaml.safe_load((vocoder / "vocoder.yaml").read_text(encoding="utf-8-sig"))
    child_path(vocoder, vocoder_config.get("model", "model.onnx")).stat()
    destination = root / "models/vocoders" / voice_id
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(vocoder, destination)
    speakers = config.get("speakers") or []
    for speaker in speakers:
        child_path(bank, speaker + ".emb").stat()
    metadata = {
        **details, "id": voice_id, "directory": str(bank.relative_to(archive_root)),
        "vocoder": voice_id,
        "speakers": speakers,
        "languages": [language for language in ["es", "en"] if language == "en" or any(p.startswith(language + "/") for p in phones)],
        "phonemes": list(phones),
        "expression": [name for name in ["breathiness", "tension", "energy", "voicing"]
                       if config.get("use_" + name + "_embed") or config.get("use" + name.title() + "Embed")],
    }
    atomic_json(archive_root / "voice.json", metadata)
    return metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=["render", "inspect", "download-ace"])
    parser.add_argument("request")
    args = parser.parse_args()
    request_file = Path(args.request)
    request = json.loads(request_file.read_text())
    root = Path(request["root"])
    if args.kind == "inspect":
        result = inspect_voice(root, Path(request["archiveRoot"]), request["voiceId"], request["details"])
    elif args.kind == "download-ace":
        from huggingface_hub import snapshot_download
        from .engines.acestep import MODEL_REPO, MODEL_REVISION
        snapshot_download(
            MODEL_REPO, revision=MODEL_REVISION,
            local_dir=str(root / "models/acestep"),
            allow_patterns=["acestep-v15-turbo/*", "vae/*", "Qwen3-Embedding-0.6B/*", "README.md"],
            max_workers=2,
        )
        result = {"model": MODEL_REPO, "revision": MODEL_REVISION}
    else:
        if request["engine"] == "diffsinger":
            from .engines.diffsinger import render
        else:
            from .engines.acestep import render
        result = render(request["payload"], root, Path(request["output"]))
    atomic_json(Path(request["result"]), result)


if __name__ == "__main__":
    main()
