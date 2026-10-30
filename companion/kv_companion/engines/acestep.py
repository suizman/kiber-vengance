from __future__ import annotations

import json
import math
from pathlib import Path

SOURCE_REVISION = "ca1e85fe9430179831e6bc6be790c332190a3866"
MODEL_REVISION = "19671f406d603126926c1b7e2adc169acbcade22"
MODEL_REPO = "ACE-Step/Ace-Step1.5"


def validate(payload):
    lyrics, style = payload.get("lyrics", ""), payload.get("style", "")
    if not isinstance(lyrics, str) or not lyrics.strip() or len(lyrics) > 4096:
        raise ValueError("Enter lyrics (maximum 4096 characters)")
    if not isinstance(style, str) or not style.strip() or len(style) > 512:
        raise ValueError("Enter a musical/vocal style (maximum 512 characters)")
    duration = payload.get("duration", 30)
    if not isinstance(duration, (int, float)) or not math.isfinite(duration) or not 10 <= duration <= 120:
        raise ValueError("Duration must be 10–120 seconds")
    bpm = payload.get("bpm", 120)
    if not isinstance(bpm, (int, float)) or not math.isfinite(bpm) or not 30 <= bpm <= 300:
        raise ValueError("BPM must be 30–300")
    if payload.get("language") not in {"es", "en"}:
        raise ValueError("Select Spanish or English")
    seed = payload.get("seed", -1)
    if isinstance(seed, bool) or not isinstance(seed, int) or not -1 <= seed <= 2**31 - 1:
        raise ValueError("Invalid random seed")
    return {"lyrics": lyrics, "style": style, "duration": float(duration), "bpm": int(bpm),
            "language": payload["language"], "seed": seed}


def render(request: dict, root: Path, output: Path):
    """Run inside the selected ACE runtime; process termination is cancellation."""
    import os
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    import torch
    from acestep.handler import AceStepHandler
    from acestep.llm_inference import LLMHandler
    from acestep.inference import GenerationParams, GenerationConfig, generate_music

    data = validate(request)
    requested = request.get("device", "auto")
    if requested == "cpu":
        device = "cpu"
    elif torch.backends.mps.is_available():
        device = "mps"
    elif torch.cuda.is_available():
        device = "cuda"  # ROCm PyTorch deliberately uses the torch.cuda API.
    elif requested == "gpu":
        raise RuntimeError("GPU requested but this runtime cannot use it. Select CPU or repair the GPU runtime.")
    else:
        device = "cpu"
    if device == "cuda":
        torch.ones(4, device=device).add_(1).cpu()
    elif device == "mps":
        torch.ones(4, device=device).add_(1).cpu()
    project = root / "engines/acestep/source"
    checkpoints = root / "models/acestep"
    os.environ["ACESTEP_PROJECT_ROOT"] = str(project)
    os.environ["ACESTEP_CHECKPOINTS_DIR"] = str(checkpoints)
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    print("Loading ACE-Step · " + device, flush=True)
    class LocalModelsHandler(AceStepHandler):
        def _ensure_models_present(self, *, checkpoint_path, config_path, prefer_source, vae_variant=None):
            # Upstream's default precheck also requires the optional 1.7B LM and
            # otherwise starts an unpinned full-repository download. This adapter
            # uses DiT-only generation and installs its complete, pinned manifest
            # explicitly. Missing files must fail here, never fetch during inference.
            manifest = json.loads((Path(__file__).parents[1] / "resources/ace-model.json").read_text())
            for entry in manifest["files"]:
                path = Path(checkpoint_path) / entry["path"]
                if not path.is_file() or path.stat().st_size != entry["size"]:
                    return "Model file missing/incomplete. Reinstall the model from the companion.", False
            return None
    handler = LocalModelsHandler()
    message, ok = handler.initialize_service(
        project_root=str(project), config_path="acestep-v15-turbo",
        device=device, use_flash_attention=False, compile_model=False,
        offload_to_cpu=device != "cpu", offload_dit_to_cpu=False,
    )
    if not ok:
        raise RuntimeError(message)
    params = GenerationParams(
        caption=data["style"], lyrics=data["lyrics"], vocal_language=data["language"],
        duration=data["duration"], bpm=data["bpm"], seed=data["seed"],
        thinking=False, use_cot_metas=False, use_cot_caption=False, use_cot_language=False,
        inference_steps=8, instrumental=False,
    )
    config = GenerationConfig(batch_size=1, audio_format="wav", use_random_seed=data["seed"] == -1)
    print("Generating musical interpretation…", flush=True)
    result = generate_music(handler, LLMHandler(), params, config, save_dir=str(output.parent))
    if not result.success or not result.audios:
        raise RuntimeError(result.error or result.status_message or "ACE-Step did not return audio")
    import shutil
    source = Path(result.audios[0]["path"])
    if source.resolve() != output.resolve():
        shutil.copyfile(source, output)
    return {"engine": "acestep", "model": MODEL_REPO, "revision": MODEL_REVISION,
            "sourceRevision": SOURCE_REVISION, "device": device,
            "outputKind": "musical-proposal", "settings": data}
