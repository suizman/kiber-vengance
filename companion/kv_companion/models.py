from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import sys
import time
import uuid
import wave

from .downloads import download, digest, extract_zip
from .engines import acestep, diffsinger
from .hardware import hardware
from .install import install_runtime, environment, executable, runtime_status, child_environment
from .store import atomic_json, read_json

VOICE_CATALOG = [{
    "id": "kaiz", "name": "Kaiz · PRINTmov", "version": "2.2.3",
    "url": "https://www.printmov.com/singer-repo/kaiz.zip",
    "sha256": "cb932f7f4f0464352df546d1a75178dc34781b232e600f88b67bec4cf04a1e19",
    "bytes": 453730517, "licenseUrl": "https://www.printmov.com/kaiz",
    "license": "Creator voicebank terms; bundled vocoder CC-BY-NC 4.0. Not verified for commercial releases.",
    "attribution": "Kaiz / PRINTmov; pc_tgm_hifigan by tigermeat. See included readme and vocoder license.",
    "commercial": False,
}]


class Engines:
    def __init__(self, root: Path):
        self.root = root
        for name in ["models/voices", "models/vocoders", "runtimes", "outputs", "uploads", "cache", "jobs"]:
            (root / name).mkdir(parents=True, exist_ok=True)
        self.hardware = hardware(root)

    def status(self):
        voices = []
        for path in sorted((self.root / "models/voices").glob("*/voice.json")):
            voice = read_json(path)
            # Phoneme inventories can be large; request one selected bank explicitly.
            voices.append({k: v for k, v in voice.items() if k not in {"phonemes", "directory"}})
        ace = read_json(self.root / "models/acestep/installed.json")
        hardware_state = {**self.hardware, "freeDiskGB": round(shutil.disk_usage(self.root).free / 1024**3, 1)}
        return {"hardware": hardware_state, "runtimes": runtime_status(self.root), "voices": voices,
                "acestep": ace, "voiceCatalog": VOICE_CATALOG,
                "engines": [
                    {"id": "diffsinger", "name": "DiffSinger", "outputKind": "score-vocal", "license": "Apache-2.0 engine; voice/vocoder licenses are separate"},
                    {"id": "acestep", "name": "ACE-Step 1.5", "outputKind": "musical-proposal", "license": "MIT", "modelBytes": 6336680772},
                ]}

    def _worker(self, job, engine: str, profile: str, kind: str, request: dict):
        python = executable(environment(self.root, engine, profile))
        if not python.exists() or not (python.parent.parent / "installed.json").exists():
            raise ValueError("Install this engine runtime first")
        directory = self.root / "jobs" / job.id
        directory.mkdir(parents=True, exist_ok=True)
        result = directory / "result.json"
        request_file = directory / "request.json"
        atomic_json(request_file, {**request, "root": str(self.root), "result": str(result)})
        env = child_environment()
        package_root = str(Path(__file__).resolve().parents[1])
        source = str(self.root / "engines/acestep/source")
        env["PYTHONPATH"] = os.pathsep.join([package_root] + ([source] if engine == "acestep" else []))
        env["HF_HOME"] = str(self.root / "cache/huggingface")
        env["OMP_NUM_THREADS"] = "8"
        job.run_process([str(python), "-m", "kv_companion.worker", kind, str(request_file)], env=env, cwd=directory)
        job.check()
        return read_json(result)

    def _profile(self, payload, engine):
        profile = payload.get("profile", "cpu")
        environment(self.root, engine, profile)  # validates IDs, never a client-provided path
        return profile

    def execute(self, job):
        data = job.payload
        if job.kind in {"install-runtime", "repair-runtime"}:
            engine = data.get("engine")
            profile = self._profile(data, engine)
            install_runtime(self.root, engine, profile, job, repair=job.kind == "repair-runtime")
            return {"engine": engine, "profile": profile}
        if job.kind == "install-acestep":
            if data.get("licenseAccepted") is not True:
                raise ValueError("Read and accept the model license before downloading")
            profile = self._profile(data, "acestep")
            install_runtime(self.root, "acestep", profile, job)
            manifest = read_json(Path(__file__).parent / "resources/ace-model.json")
            base = self.root / "models/acestep"
            needed = sum(f["size"] for f in manifest["files"] if not (base / f["path"]).exists())
            if shutil.disk_usage(self.root).free < needed + 1024**3:
                raise ValueError("Not enough free disk space for ACE-Step")
            for index, entry in enumerate(manifest["files"]):
                job.update(f"ACE-Step model file {index + 1}/{len(manifest['files'])}", index / len(manifest["files"]))
                download(f"https://huggingface.co/{manifest['repo']}/resolve/{manifest['revision']}/{entry['path']}",
                         base / entry["path"], job, entry["sha256"])
            atomic_json(base / "installed.json", {"model": manifest["repo"], "revision": manifest["revision"], "verifiedFiles": len(manifest["files"])})
            return read_json(base / "installed.json")
        if job.kind in {"install-voice", "import-voice"}:
            if data.get("licenseAccepted") is not True:
                raise ValueError("Review and accept the voice and vocoder terms before installation")
            profile = self._profile(data, "diffsinger")
            install_runtime(self.root, "diffsinger", profile, job)
            if job.kind == "install-voice":
                entry = next((v for v in VOICE_CATALOG if v["id"] == data.get("voice")), None)
                if not entry:
                    raise ValueError("Unknown catalog voice")
                archive = self.root / "cache" / f"voice-{entry['id']}.zip"
                download(entry["url"], archive, job, entry["sha256"])
                voice_id, details = entry["id"], {k: entry[k] for k in ["name", "sha256", "licenseUrl", "license", "attribution", "commercial"]}
            else:
                upload_id = data.get("upload", "")
                if not re.fullmatch(r"[a-f0-9]{32}", upload_id):
                    raise ValueError("Invalid uploaded voice archive")
                archive = self.root / "uploads" / f"{upload_id}.zip"
                if not archive.is_file():
                    raise ValueError("Uploaded voice archive not found")
                voice_id = "import-" + upload_id[:16]
                name = data.get("name", "Imported voice")
                if not isinstance(name, str) or not 1 <= len(name) <= 100:
                    raise ValueError("Invalid voice name")
                details = {"name": name, "sha256": digest(archive), "licenseUrl": "", "license": "User-supplied voice; consult the included terms", "attribution": "See the voicebank's included terms", "commercial": None}
            staged = self.root / "models/voices" / (voice_id + "-pending")
            if staged.exists():
                shutil.rmtree(staged)
            extract_zip(archive, staged, job)
            self._worker(job, "diffsinger", profile, "inspect", {"archiveRoot": str(staged), "voiceId": voice_id, "details": details})
            job.check()
            destination = staged.with_name(voice_id)
            if destination.exists():
                shutil.rmtree(destination)
            staged.rename(destination)
            return {"voice": voice_id}
        if job.kind == "remove-model":
            model = data.get("model")
            if model == "acestep":
                path = self.root / "models/acestep"
                if path.exists():
                    shutil.rmtree(path)
            elif isinstance(model, str) and re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", model):
                for folder in ["voices", "vocoders"]:
                    path = self.root / "models" / folder / model
                    if path.exists():
                        shutil.rmtree(path)
            else:
                raise ValueError("Unknown model")
            return {"removed": model}
        if job.kind == "generate":
            engine = data.get("engine")
            if engine not in {"diffsinger", "acestep"}:
                raise ValueError("Unknown vocal engine")
            payload = data.get("settings")
            if not isinstance(payload, dict):
                raise ValueError("Invalid generation settings")
            if payload.get("device") not in {"auto", "cpu", "gpu"}:
                raise ValueError("Select Automatic, CPU or GPU")
            (diffsinger.validate if engine == "diffsinger" else acestep.validate)(payload)
            profile = self._profile(data, engine)
            if payload.get("device") == "cpu" and profile not in {"cpu", "apple"}:
                # GPU wheels can still run CPU. The provenance records the actual device.
                pass
            if engine == "acestep" and not (self.root / "models/acestep/installed.json").exists():
                raise ValueError("Download the ACE-Step model first")
            output = self.root / "outputs" / f"{job.id}.wav"
            start = time.monotonic()
            metadata = self._worker(job, engine, profile, "render", {"engine": engine, "payload": payload, "output": str(output)})
            with wave.open(str(output), "rb") as stream:
                seconds = stream.getnframes() / stream.getframerate()
            if not 0 < seconds <= 130:
                raise ValueError("Engine returned audio with an invalid duration")
            result = {**metadata, "audioId": job.id, "seconds": seconds,
                      "elapsedSeconds": round(time.monotonic() - start, 2), "sha256": digest(output)}
            atomic_json(output.with_suffix(".json"), result)
            return result
        if job.kind == "diagnose":
            engine = data.get("engine")
            profile = self._profile(data, engine)
            install_runtime(self.root, engine, profile, job)
            return {"hardware": hardware(self.root), "runtime": read_json(environment(self.root, engine, profile) / "installed.json")}
        raise ValueError("Unknown job operation")
