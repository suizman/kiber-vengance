from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile


def data_directory() -> Path:
    if os.environ.get("KV_COMPANION_DATA"):
        return Path(os.environ["KV_COMPANION_DATA"]).expanduser().resolve()
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/KiberVengance"
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local")) / "KiberVengance"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "kiber-vengance"


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def read_json(path: Path, default: object = None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def child_path(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or "\\" in relative or "\x00" in relative:
        raise ValueError("Invalid relative path")
    path = (root / relative).resolve()
    if path == root.resolve() or not path.is_relative_to(root.resolve()):
        raise ValueError("Path escapes its model directory")
    return path
