"""Independent implementation of OpenVPI's published ONNX tensor interface.

No voice model is included in the application. Each installed bank retains its
own terms, phoneme inventory, speaker embeddings and acoustic configuration.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import re
import unicodedata

from ..store import child_path


def spanish_phones(text: str) -> list[str]:
    text = unicodedata.normalize("NFC", text.lower())
    text = text.replace("ü", "w").replace("ñ", "N")
    text = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-zNv]", "", text)
    result = []
    at = 0
    while at < len(text):
        char = text[at]
        pair = text[at:at + 2]
        nxt = text[at + 1:at + 2]
        if pair in {"ch", "rr", "ll"}:
            result.append({"ch": "ch", "rr": "rr", "ll": "y"}[pair]); at += 2; continue
        if char == "q" and nxt == "u":
            result.append("k"); at += 2; continue
        if char == "g" and nxt == "u" and text[at + 2:at + 3] in {"e", "i"}:
            result.append("g"); at += 2; continue
        mapped = {"c": "s" if nxt in {"e", "i"} else "k", "g": "x" if nxt in {"e", "i"} else "g",
                  "j": "x", "h": "", "N": "gn", "b": "b", "v": "b", "z": "s",
                  "x": "ks", "r": "rr" if at == 0 else "r", "y": "i" if at == len(text) - 1 else "y"}.get(char, char)
        result.extend(list(mapped) if mapped == "ks" else [mapped] if mapped else [])
        at += 1
    if not result:
        raise ValueError(f"Cannot phonemize {text!r}; enter explicit phonemes")
    return result


def validate(payload):
    if payload.get("language") not in {"es", "en"}:
        raise ValueError("Select Spanish or English")
    notes = payload.get("notes")
    if not isinstance(notes, list) or not 1 <= len(notes) <= 256:
        raise ValueError("Select a monophonic clip containing 1–256 notes")
    previous = 0.0
    normalized = []
    for index, note in enumerate(notes):
        values = [note.get(key) for key in ["start", "duration", "pitch"]]
        if not all(isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n) for n in values):
            raise ValueError("Invalid note timing or pitch")
        start, duration, pitch = values
        if start < previous - 0.0001 or duration < .03 or not 24 <= pitch <= 108 or start + duration > 120:
            raise ValueError("Notes must be monophonic, ordered, 30 ms or longer, and within 120 seconds")
        lyric = note.get("lyric", "")
        if not isinstance(lyric, str) or not lyric.strip() or len(lyric) > 80:
            raise ValueError(f"Enter a syllable/word for note {index + 1}")
        if lyric == "+" and (not normalized or normalized[-1]["lyric"] == "_"):
            raise ValueError("A melisma (+) must follow a sung syllable")
        phones = note.get("phonemes", "")
        if not isinstance(phones, str) or len(phones) > 200:
            raise ValueError("Invalid phoneme override")
        normalized.append({"start": float(start), "duration": float(duration), "pitch": float(pitch),
                           "lyric": lyric.strip(), "phonemes": phones,
                           "velocity": max(.05, min(1, float(note.get("velocity", .8))))})
        previous = start + duration
    vibrato = payload.get("vibrato", .18)
    if not isinstance(vibrato, (int, float)) or not math.isfinite(vibrato) or not 0 <= vibrato <= 1:
        raise ValueError("Vibrato must be between 0 and 1 semitone")
    portamento = payload.get("portamentoMs", 35)
    if not isinstance(portamento, (int, float)) or not math.isfinite(portamento) or not 0 <= portamento <= 120:
        raise ValueError("Pitch transitions must be 0–120 ms")
    return {"notes": normalized, "language": payload["language"], "vibrato": vibrato, "portamentoMs": portamento}


def load_mapping(path: Path):
    if path.suffix == ".json":
        return json.loads(path.read_text(encoding="utf-8-sig"))
    return {text: index for index, text in enumerate(path.read_text(encoding="utf-8-sig").splitlines())}


def resolve_phone(phone: str, language: str, inventory: dict):
    variants = [f"{language}/{phone}", phone, f"{language}/{phone.lower()}", phone.lower()]
    for value in variants:
        if value in inventory:
            return value
    raise ValueError(f"Voice does not contain phoneme {phone!r}. Edit the note's phonemes using this bank's inventory.")


def phonemize(note, language, inventory, dictionary):
    if note["phonemes"].strip():
        phones = note["phonemes"].split()
    elif note["lyric"].lower() in dictionary:
        phones = dictionary[note["lyric"].lower()]
    elif language == "es":
        phones = spanish_phones(note["lyric"])
    else:
        import cmudict
        found = cmudict.dict().get(note["lyric"].lower())
        if not found:
            raise ValueError(f"English word {note['lyric']!r} is missing. Enter explicit phonemes.")
        phones = [re.sub(r"\d", "", phone) for phone in found[0]]
    return [resolve_phone(p, language, inventory) for p in phones]


def score_inputs(data, inventory, rate: int, hop: int, dictionary=None):
    import numpy as np
    dictionary = dictionary or {}
    frame_seconds = hop / rate
    head = round(.1 / frame_seconds)
    total = head + round((data["notes"][-1]["start"] + data["notes"][-1]["duration"]) / frame_seconds) + round(.2 / frame_seconds)
    f0 = np.zeros(total, dtype=np.float32)
    dynamics = np.zeros(total, dtype=np.float32)
    silence = "SP" if "SP" in inventory else "AP" if "AP" in inventory else None
    if not silence:
        raise ValueError("Voice requires a SP or AP silence phoneme")
    phones, durations = [silence], [head]
    cursor, last_vowel = head, None
    for note in data["notes"]:
        start = head + round(note["start"] / frame_seconds)
        end = head + round((note["start"] + note["duration"]) / frame_seconds)
        if start > cursor:
            phones.append(silence); durations.append(start - cursor)
        frames = max(1, end - start)
        if note["lyric"] == "_":
            group = [silence]
        elif note["lyric"] == "+":
            if last_vowel is None:
                raise ValueError("A melisma needs a preceding vowel")
            group = [last_vowel]
        else:
            group = phonemize(note, data["language"], inventory, dictionary)
            vowels = [p for p in group if p.split("/")[-1].lower() in {"a", "e", "i", "o", "u", "aa", "ae", "ah", "ao", "aw", "ay", "eh", "er", "ey", "ih", "iy", "ow", "oy", "uh", "uw"}]
            last_vowel = vowels[-1] if vowels else group[-1]
        if len(group) > frames:
            raise ValueError("A syllable contains more phonemes than its duration can represent")
        # Keep consonants short and spend the remaining note on its vowel.
        allot = [max(1, min(round(.045 / frame_seconds), frames // len(group))) for _ in group]
        vowel_index = max((i for i, p in enumerate(group) if p == last_vowel), default=len(group) - 1)
        allot[vowel_index] += frames - sum(allot)
        phones.extend(group); durations.extend(allot)
        if note["lyric"] != "_":
            seconds = np.arange(frames, dtype=np.float32) * frame_seconds
            envelope = np.minimum(1, np.maximum(0, (seconds - .15) / .15))
            pitches = note["pitch"] + data["vibrato"] * envelope * np.sin(2 * np.pi * 5.2 * seconds)
            transition = min(round(data.get("portamentoMs", 35) / 1000 / frame_seconds), frames // 2)
            if transition and start > 0 and f0[start - 1] > 0:
                previous_pitch = 69 + 12 * np.log2(f0[start - 1] / 440)
                pitches[:transition] = np.linspace(previous_pitch, pitches[transition - 1], transition)
            f0[start:end] = 440 * 2 ** ((pitches - 69) / 12)
            dynamics[start:end] = note["velocity"]
        cursor = end
    phones.append(silence); durations.append(total - cursor)
    return phones, durations, f0, dynamics, head


def providers(device: str, available: list[str]):
    accelerators = [p for p in ["CoreMLExecutionProvider", "DmlExecutionProvider", "MIGraphXExecutionProvider", "ROCMExecutionProvider", "CUDAExecutionProvider"] if p in available]
    if device == "gpu" and not accelerators:
        raise RuntimeError("This DiffSinger runtime has no usable GPU provider. Install the matching GPU runtime or select CPU.")
    return ([accelerators[0]] if device != "cpu" and accelerators else []) + ["CPUExecutionProvider"]


def vocoder_providers(selected: list[str], force_on_cpu: bool = False):
    # CoreML's sequence resizing fails on dynamic-length HiFi-GAN vocoders.
    # Keep the acoustic provider independent and report both actual devices.
    if force_on_cpu or "CoreMLExecutionProvider" in selected:
        return ["CPUExecutionProvider"]
    return selected


def render(request: dict, root: Path, output: Path):
    import numpy as np
    import onnxruntime as ort
    import yaml
    import wave

    data = validate(request)
    voice_id = request.get("voice", "")
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", voice_id):
        raise ValueError("Select an installed voice")
    bank_root = root / "models/voices" / voice_id
    metadata = json.loads((bank_root / "voice.json").read_text())
    bank = child_path(bank_root, metadata["directory"])
    config = yaml.safe_load((bank / "dsconfig.yaml").read_text(encoding="utf-8-sig"))
    vocoder_dir = root / "models/vocoders" / metadata["vocoder"]
    vocoder_config = yaml.safe_load((vocoder_dir / "vocoder.yaml").read_text(encoding="utf-8-sig"))
    for key in ["sample_rate", "hop_size", "num_mel_bins", "mel_scale"]:
        defaults = {"sample_rate": 44100, "hop_size": 512, "num_mel_bins": 128, "mel_scale": "slaney"}
        if config.get(key, defaults[key]) != vocoder_config.get(key, defaults[key]):
            raise ValueError(f"Voice and vocoder have different {key}")
    rate, hop = config.get("sample_rate", 44100), config.get("hop_size", 512)
    inventory = load_mapping(child_path(bank, config.get("phonemes", "phonemes.txt")))
    dictionary = {}
    dictionary_path = bank / f"dsdict-{data['language']}.yaml"
    if dictionary_path.exists():
        dictionary_data = yaml.safe_load(dictionary_path.read_text(encoding="utf-8-sig")) or {}
        dictionary = {entry["grapheme"].lower(): entry["phonemes"] for entry in dictionary_data.get("entries", [])}
    phones, durations, f0, dynamics, head = score_inputs(data, inventory, rate, hop, dictionary)
    selected = providers(request.get("device", "auto"), ort.get_available_providers())
    options = ort.SessionOptions()
    options.intra_op_num_threads = min(8, __import__("os").cpu_count() or 1)
    if "DmlExecutionProvider" in selected:
        options.enable_mem_pattern = False
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    print("Loading DiffSinger · " + selected[0], flush=True)
    acoustic = ort.InferenceSession(str(child_path(bank, config["acoustic"])), sess_options=options, providers=selected)
    actual_acoustic = acoustic.get_providers()[0]
    if request.get("device") == "gpu" and actual_acoustic == "CPUExecutionProvider":
        raise RuntimeError("GPU initialization fell back to CPU. Repair the selected GPU runtime or select CPU explicitly.")
    total = len(f0)
    values = {
        "tokens": np.array([[inventory[p] for p in phones]], dtype=np.int64),
        "durations": np.array([durations], dtype=np.int64),
        "f0": f0[None, :], "steps": np.array([32], dtype=np.int64),
        "speedup": np.array([25], dtype=np.int64),
        "gender": np.zeros((1, total), dtype=np.float32),
        "velocity": np.ones((1, total), dtype=np.float32),
        "energy": np.full((1, total), -20, dtype=np.float32),
        "breathiness": np.full((1, total), -35, dtype=np.float32),
        "voicing": np.full((1, total), -15, dtype=np.float32),
        "tension": np.zeros((1, total), dtype=np.float32),
    }
    if config.get("languages"):
        languages = load_mapping(child_path(bank, config["languages"]))
        values["languages"] = np.array([[languages.get(p.split("/")[0], 0) if "/" in p else 0 for p in phones]], dtype=np.int64)
    speakers = config.get("speakers") or []
    if speakers:
        speaker = request.get("speaker") or speakers[0]
        if speaker not in speakers:
            raise ValueError("Unknown voice color")
        embedding = np.fromfile(child_path(bank, speaker + ".emb"), dtype="<f4")
        if len(embedding) != config.get("hiddenSize", 256):
            raise ValueError("Voice embedding has the wrong dimensions")
        values["spk_embed"] = np.tile(embedding, (1, total, 1))
    expression = request.get("expression", {})
    for name, low, high in [("breathiness", -96, 0), ("tension", -10, 10), ("energy", -96, 0), ("voicing", -96, 0)]:
        if name in expression:
            value = expression[name]
            if not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
                raise ValueError("Invalid expression value")
            values[name] = np.full((1, total), value, dtype=np.float32)
    inputs = {}
    for node in acoustic.get_inputs():
        if node.name == "depth":
            values["depth"] = np.array([config.get("max_depth", 1.0 if "float" in node.type else 1000)], dtype=np.float32 if "float" in node.type else np.int64)
        if node.name not in values:
            raise ValueError(f"Unsupported DiffSinger input {node.name}; this model needs another adapter version")
        inputs[node.name] = values[node.name]
    print("Rendering sung notes…", flush=True)
    mel = acoustic.run(None, inputs)[0]
    del acoustic
    if config.get("mel_base", "10") != vocoder_config.get("mel_base", "10"):
        mel *= math.log(10) if vocoder_config.get("mel_base") == "e" else 1 / math.log(10)
    vocoder_selected = vocoder_providers(selected, vocoder_config.get("force_on_cpu", False))
    print("Loading vocoder · " + vocoder_selected[0], flush=True)
    vocoder = ort.InferenceSession(str(child_path(vocoder_dir, vocoder_config.get("model", "model.onnx"))), sess_options=options, providers=vocoder_selected)
    actual_vocoder = vocoder.get_providers()[0]
    samples = vocoder.run(None, {"mel": mel, "f0": f0[None, :]})[0].reshape(-1)
    samples = samples[head * hop:]
    gain = np.repeat(dynamics[head:], hop)
    samples = samples[:len(gain)] * gain[:len(samples)]
    if not len(samples) or not np.isfinite(samples).all() or np.sqrt(np.mean(samples**2)) < .00001:
        raise RuntimeError("DiffSinger returned invalid or silent audio")
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(output), "wb") as stream:
        stream.setnchannels(1); stream.setsampwidth(2); stream.setframerate(rate); stream.writeframes(pcm.tobytes())
    return {"engine": "diffsinger", "model": metadata["name"], "revision": metadata["sha256"],
            "device": actual_acoustic if actual_acoustic == actual_vocoder else actual_acoustic + " / vocoder " + actual_vocoder, "outputKind": "score-vocal", "settings": {**data, "expression": expression, "speaker": request.get("speaker", "")},
            "attribution": metadata.get("attribution", ""), "licenseUrl": metadata.get("licenseUrl", "")}
