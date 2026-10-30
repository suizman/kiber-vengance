from __future__ import annotations

import json
import os
import platform
from pathlib import Path
import shutil
import subprocess
import sys
import tomllib

from .downloads import download, extract_source
from .engines.acestep import SOURCE_REVISION
from .store import atomic_json, read_json


def executable(environment: Path) -> Path:
    return environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def environment(root: Path, engine: str, profile: str) -> Path:
    if engine not in {"diffsinger", "acestep"} or profile not in {"cpu", "apple", "directml", "rocm", "cuda"}:
        raise ValueError("Unknown engine/runtime profile")
    if engine == "diffsinger" and profile == "apple":
        profile = "cpu"  # The macOS ONNX wheel includes CoreML and CPU providers.
    return root / "runtimes" / f"{engine}-{profile}"


def child_environment():
    env = os.environ.copy()
    env.pop("PYTHONHOME", None)
    env.pop("PYTHONPATH", None)
    env["PYTHONNOUSERSITE"] = "1"
    env["PYTHONUNBUFFERED"] = "1"
    return env


def runtime_status(root: Path):
    result = []
    for path in sorted((root / "runtimes").glob("*")) if (root / "runtimes").exists() else []:
        metadata = read_json(path / "installed.json")
        if metadata and executable(path).exists():
            result.append(metadata)
    return result


def uv_executable():
    bundled = Path(__file__).resolve().parents[1] / "bin" / ("uv.exe" if os.name == "nt" else "uv")
    found = bundled if bundled.exists() else shutil.which("uv")
    if not found:
        raise RuntimeError("Dependency manager missing. Reinstall the companion package.")
    return str(found)


def stable_python(root: Path, job):
    """AppImage mount paths change on every launch; venv bases must not."""
    bundle = Path(__file__).resolve().parents[2]
    metadata = read_json(bundle / "build.json")
    if not metadata:
        return sys.executable  # source development uses the installed interpreter
    version = sys.version.split()[0]
    destination = root / "python" / (version + "-" + metadata["platform"])
    python = destination / ("python.exe" if os.name == "nt" else "bin/python3")
    if python.exists():
        return str(python)
    source = bundle / "python"
    staged = destination.with_name(destination.name + "-pending")
    if staged.exists():
        shutil.rmtree(staged)
    job.update("Preparing persistent Python runtime")
    staged.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, staged, symlinks=True)
    job.check()
    staged.rename(destination)
    return str(python)


def install_runtime(root: Path, engine: str, profile: str, job, repair=False):
    intel_mac = sys.platform == "darwin" and platform.machine().lower() == "x86_64"
    if intel_mac and engine == "acestep":
        raise ValueError("ACE-Step requires a newer PyTorch than macOS Intel supports. Use DiffSinger CPU on this Mac.")
    if intel_mac and profile != "cpu":
        raise ValueError("macOS Intel supports the CPU runtime profile only")
    if engine == "diffsinger" and profile not in {"cpu", "apple", "directml", "cuda", "rocm"}:
        raise ValueError("Unsupported DiffSinger profile")
    if profile == "apple" and sys.platform != "darwin":
        raise ValueError("Apple acceleration requires macOS")
    if profile == "directml" and (sys.platform != "win32" or engine != "diffsinger"):
        raise ValueError("DirectML is a DiffSinger Windows runtime")
    if profile == "rocm" and sys.platform not in {"win32", "linux"}:
        raise ValueError("ROCm requires Linux or Windows")
    destination = environment(root, engine, profile)
    if read_json(destination / "installed.json") and executable(destination).exists() and not repair:
        return
    (destination / "installed.json").unlink(missing_ok=True)
    destination.mkdir(parents=True, exist_ok=True)
    uv = uv_executable()
    env = child_environment()
    env["UV_PYTHON_INSTALL_DIR"] = str(root / "python")
    env["UV_CACHE_DIR"] = str(root / "cache/uv")
    job.update(f"Preparing {engine} · {profile} runtime")
    job.run_process([uv, "venv", "--allow-existing", "--python", stable_python(root, job), str(destination)], env=env)
    python = str(executable(destination))
    pip = [uv, "pip", "install", "--python", python] + (["--reinstall", "--no-cache"] if repair else [])
    if engine == "diffsinger":
        ort = "onnxruntime-directml==1.24.4" if profile == "directml" else "onnxruntime-gpu==1.24.4" if profile == "cuda" else "onnxruntime-migraphx==1.27.1" if profile == "rocm" else "onnxruntime==1.23.2" if intel_mac else "onnxruntime==1.24.4"
        job.run_process(pip + ["numpy==2.3.5", "PyYAML==6.0.3", "cmudict==1.1.3", ort], env=env)
    else:
        install_ace_source(root, job)
        # Install framework first from one selected vendor index; upstream's
        # CUDA-only pyproject requirements are deliberately not resolved here.
        if profile == "rocm" and sys.platform == "win32":
            base = "https://repo.radeon.com/rocm/windows/rocm-rel-7.2/"
            sdk = [base + name for name in [
                "rocm_sdk_core-7.2.0.dev0-py3-none-win_amd64.whl",
                "rocm_sdk_devel-7.2.0.dev0-py3-none-win_amd64.whl",
                "rocm_sdk_libraries_custom-7.2.0.dev0-py3-none-win_amd64.whl",
                "rocm-7.2.0.dev0.tar.gz",
            ]]
            job.run_process(pip + sdk, env=env)
            wheels = [base + f"{name}-{version}+rocmsdk20260116-cp312-cp312-win_amd64.whl" for name, version in [("torch", "2.9.1"), ("torchaudio", "2.9.1"), ("torchvision", "0.24.1")]]
            job.run_process(pip + wheels, env=env)
        elif profile == "apple":
            job.run_process(pip + ["torch==2.9.1", "torchaudio==2.9.1", "torchvision==0.24.1", "mlx==0.29.3", "mlx-lm==0.28.3"], env=env)
        else:
            index = {"cpu": "cpu", "rocm": "rocm6.4", "cuda": "cu128"}.get(profile)
            if not index:
                raise ValueError("Unsupported ACE acceleration profile")
            job.run_process(pip + ["torch==2.9.1", "torchaudio==2.9.1", "torchvision==0.24.1", "--index-url", "https://download.pytorch.org/whl/" + index], env=env)
        source = root / "engines/acestep/source"
        versions = subprocess.run(
            [python, "-c", "import importlib.metadata as m,json;print(json.dumps({n:m.version(n) for n in ['torch','torchaudio','torchvision']}))"],
            env=env, capture_output=True, text=True, check=True, timeout=30,
        )
        constraints = destination / "framework-constraints.txt"
        constraints.write_text("\n".join(f"{name}=={version}" for name, version in json.loads(versions.stdout).items()))
        upstream = tomllib.loads((source / "pyproject.toml").read_text())["project"]["dependencies"]
        excluded = {"torch", "torchaudio", "torchvision", "torchcodec", "torchao", "nano-vllm", "mlx", "mlx-lm"}
        import re
        dependencies = [requirement for requirement in upstream if re.split(r"[<>=!~;\[]", requirement)[0].strip() not in excluded]
        job.run_process(pip + ["--constraint", str(constraints)] + dependencies, env=env)
        job.run_process(pip + ["--no-deps", str(source)], env=env)
    probe_runtime(root, engine, profile, job)


def probe_runtime(root, engine, profile, job):
    destination = environment(root, engine, profile)
    probe = "import json;" + (
        "import onnxruntime as o;print(json.dumps({'providers':o.get_available_providers()}))"
        if engine == "diffsinger" else
        "import torch as t;print(json.dumps({'cuda':t.cuda.is_available(),'hip':t.version.hip,'mps':t.backends.mps.is_available()}))"
    )
    job.update("Checking installed runtime")
    result = subprocess.run([str(executable(destination)), "-c", probe], env=child_environment(), capture_output=True, text=True, timeout=90)
    if result.returncode:
        raise RuntimeError("Runtime probe failed: " + result.stderr[-1500:])
    details = json.loads(result.stdout.strip().splitlines()[-1])
    atomic_json(destination / "installed.json", {"engine": engine, "profile": profile, "probe": details})


def install_ace_source(root: Path, job):
    source = root / "engines/acestep/source"
    if read_json(source / "kv-source.json", {}).get("revision") == SOURCE_REVISION:
        return
    archive = root / "cache" / f"acestep-{SOURCE_REVISION}.tar.gz"
    download(f"https://codeload.github.com/ace-step/ACE-Step-1.5/tar.gz/{SOURCE_REVISION}", archive, job, maximum=512 * 1024**2)
    staged = source.with_name("source-pending")
    if staged.exists():
        shutil.rmtree(staged)
    extract_source(archive, staged, job)
    atomic_json(staged / "kv-source.json", {"revision": SOURCE_REVISION})
    if source.exists():
        shutil.rmtree(source)
    staged.rename(source)
