from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request


def install_launcher(root: Path):
    if sys.platform != "linux":
        return {"message": "The native installer registers the launcher on this platform."}
    source = Path(os.environ.get("APPIMAGE", ""))
    if not source.is_file() or source.suffix != ".AppImage":
        raise ValueError("Open the packaged AppImage to install its desktop launcher")
    applications = root / "application"
    applications.mkdir(parents=True, exist_ok=True)
    target = applications / "KiberVengance-Companion.AppImage"
    if source.resolve() != target.resolve():
        pending = target.with_suffix(".pending")
        shutil.copyfile(source, pending)
        pending.chmod(0o755)
        pending.replace(target)
    data = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share"))
    desktop_dir = data / "applications"
    desktop_dir.mkdir(parents=True, exist_ok=True)
    name = "kiber-vengance-companion.desktop"
    escaped = str(target).replace("\\", "\\\\").replace('"', '\\"').replace("%", "%%")
    if "\n" in escaped:
        raise ValueError("Unsupported application path")
    (desktop_dir / name).write_text(
        '[Desktop Entry]\nType=Application\nName=КИБЕР VENGANCE Companion\n'
        f'Exec="{escaped}" --appimage-extract-and-run %u\n'
        'Icon=audio-input-microphone\nCategories=AudioVideo;Audio;Music;\nTerminal=false\n'
        'MimeType=x-scheme-handler/kibervengance;\n', encoding="utf-8",
    )
    if shutil.which("update-desktop-database"):
        subprocess.run(["update-desktop-database", str(desktop_dir)], capture_output=True, timeout=10)
    registered = False
    if shutil.which("xdg-mime"):
        registered = subprocess.run(["xdg-mime", "default", name, "x-scheme-handler/kibervengance"], capture_output=True, timeout=10).returncode == 0
    return {"message": "Desktop launcher installed. Models and audio are retained.", "urlHandlerRegistered": registered}


def check_update(version: str):
    request = urllib.request.Request("https://studio.suizman.org/desktop-companion.json", headers={"User-Agent": "KiberVenganceCompanion/" + version})
    with urllib.request.urlopen(request, timeout=15) as response:
        content = response.read(1024 * 1024 + 1)
    if len(content) > 1024 * 1024:
        raise ValueError("Update manifest too large")
    manifest = json.loads(content)
    latest = manifest.get("version", "")
    if not __import__("re").fullmatch(r"\d+\.\d+\.\d+", latest):
        raise ValueError("Invalid update version")
    return {"version": latest, "newer": tuple(map(int, latest.split("."))) > tuple(map(int, version.split("."))),
            "url": "https://studio.suizman.org/"}
