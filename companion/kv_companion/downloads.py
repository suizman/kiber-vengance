from __future__ import annotations

import hashlib
import os
from pathlib import Path
import shutil
import stat
import tarfile
import urllib.request
import zipfile

from .store import child_path


def download(url: str, target: Path, job, sha256: str | None = None, maximum: int = 12 * 1024**3):
    if not url.startswith("https://"):
        raise ValueError("Model downloads require HTTPS")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and sha256 and digest(target) == sha256:
        return
    partial = target.with_name(target.name + ".part")
    position = partial.stat().st_size if partial.exists() else 0
    request = urllib.request.Request(url, headers={"User-Agent": "KiberVenganceCompanion/1.0", **({"Range": f"bytes={position}-"} if position else {})})
    job.check()
    with urllib.request.urlopen(request, timeout=60) as response:
        resumed = position > 0 and response.status == 206
        if resumed and not response.headers.get("Content-Range", "").startswith(f"bytes {position}-"):
            raise ValueError("Server returned an invalid download range")
        if not resumed:
            position = 0
        total = int(response.headers.get("Content-Length", 0)) + position
        if total > maximum:
            raise ValueError("Download exceeds the model size limit")
        with partial.open("ab" if resumed else "wb") as stream:
            while chunk := response.read(1024 * 1024):
                job.check()
                position += len(chunk)
                if position > maximum:
                    raise ValueError("Download exceeds the model size limit")
                stream.write(chunk)
                job.update(f"Downloading {target.name} · {position / 1024**2:.0f}" + (f" / {total / 1024**2:.0f}" if total else "") + " MB")
    if total and position != total:
        raise ValueError("Download was interrupted; retry to resume")
    if sha256 and digest(partial) != sha256:
        partial.unlink(missing_ok=True)
        raise ValueError("Download checksum mismatch")
    os.replace(partial, target)


def digest(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def extract_zip(archive: Path, destination: Path, job):
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as source:
        files = source.infolist()
        if len(files) > 20000 or sum(f.file_size for f in files) > 12 * 1024**3:
            raise ValueError("Voice archive is too large")
        for info in files:
            job.check()
            target = child_path(destination, info.filename.rstrip("/"))
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise ValueError("Symlinks are not allowed in voice archives")
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open(info) as inp, target.open("wb") as out:
                shutil.copyfileobj(inp, out, 1024 * 1024)


def extract_source(archive: Path, destination: Path, job):
    """Pinned upstream source archives; reject links and traversal before extracting."""
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive) as source:
        members = source.getmembers()
        if len(members) > 25000 or sum(m.size for m in members) > 1024**3:
            raise ValueError("Source archive too large")
        for member in members:
            job.check()
            parts = Path(member.name).parts[1:]
            if not parts:
                continue
            target = child_path(destination, "/".join(parts))
            if not member.isdir() and not member.isfile():
                raise ValueError("Source archive contains a special file")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as inp, target.open("wb") as out:
                    shutil.copyfileobj(inp, out, 1024 * 1024)
