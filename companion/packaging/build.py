"""Reproducible portable-runtime packages; model weights are never bundled."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import shutil
import subprocess
import sys
import tarfile
import urllib.parse
import urllib.request
import zipfile

COMPANION = Path(__file__).resolve().parents[1]
REPOSITORY = COMPANION.parent
VERSION = "1.0.5"


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def fetch(entry, cache):
    name = urllib.parse.unquote(entry["url"].rsplit("/", 1)[1])
    path = cache / name
    if not path.exists() or sha(path) != entry["sha256"]:
        cache.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix(".part")
        with urllib.request.urlopen(entry["url"], timeout=60) as source, partial.open("wb") as destination:
            shutil.copyfileobj(source, destination, 1024 * 1024)
        if sha(partial) != entry["sha256"]:
            partial.unlink()
            raise RuntimeError("Artifact checksum mismatch: " + name)
        partial.replace(path)
    return path


def unpack(archive, destination):
    destination.mkdir(parents=True, exist_ok=True)
    if archive.suffix == ".zip":
        with zipfile.ZipFile(archive) as source:
            for info in source.infolist():
                target = (destination / info.filename).resolve()
                if not target.is_relative_to(destination.resolve()):
                    raise ValueError("Archive path escape")
            source.extractall(destination)
    else:
        with tarfile.open(archive) as source:
            source.extractall(destination, filter="data")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=["linux-x64", "macos-arm64", "macos-x64", "windows-x64"])
    parser.add_argument("--stage-only", action="store_true")
    args = parser.parse_args()
    selected = args.platform or {"linux": "linux-x64", "darwin": "macos-arm64" if platform.machine().lower() in {"arm64", "aarch64"} else "macos-x64", "win32": "windows-x64"}[sys.platform]
    lock = json.loads((COMPANION / "packaging/artifacts.json").read_text())
    cache = COMPANION / "build/downloads"
    stage = COMPANION / "build" / selected
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    entries = lock["platforms"][selected]
    unpack(fetch(entries["python"], cache), stage)
    uv_dir = COMPANION / "build" / (selected + "-uv")
    if uv_dir.exists():
        shutil.rmtree(uv_dir)
    unpack(fetch(entries["uv"], cache), uv_dir)
    lib = stage / "lib"
    package = lib / "kv_companion"
    shutil.copytree(COMPANION / "kv_companion", package, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (lib / "bin").mkdir(parents=True)
    uv_name = "uv.exe" if selected == "windows-x64" else "uv"
    uv = next(uv_dir.rglob(uv_name))
    shutil.copy2(uv, lib / "bin" / uv_name)
    (lib / "bin" / uv_name).chmod(0o755)
    shutil.copy2(REPOSITORY / "LICENSE", stage / "LICENSE.txt")
    shutil.copy2(COMPANION / "THIRD_PARTY.md", stage / "THIRD_PARTY.md")
    shutil.copy2(COMPANION / "README.md", stage / "README.md")
    source = subprocess.check_output(["git", "log", "-1", "--format=%H", "--", "companion"], cwd=REPOSITORY, text=True).strip() or "uncommitted"
    (stage / "build.json").write_text(json.dumps({"version": VERSION, "platform": selected, "sourceCommit": source, "runtime": entries}, indent=2))
    # Keep the source corresponding to the distributed GPL companion alongside it.
    with tarfile.open(stage / "companion-source.tar.gz", "w:gz") as archive:
        python_sources = [path for directory in ["kv_companion", "packaging", "tests"] for path in (COMPANION / directory).rglob("*.py") if "__pycache__" not in path.parts]
        for path in [*python_sources, COMPANION / "pyproject.toml", COMPANION / "README.md", COMPANION / "THIRD_PARTY.md", REPOSITORY / "LICENSE"]:
            archive.add(path, arcname=str(path.relative_to(REPOSITORY)), recursive=False)
        for directory in [COMPANION / "kv_companion/web", COMPANION / "kv_companion/resources", COMPANION / "packaging"]:
            for path in directory.rglob("*"):
                if path.is_file() and path.suffix != ".py":
                    archive.add(path, arcname=str(path.relative_to(REPOSITORY)), recursive=False)
    if args.stage_only:
        print(stage)
        return
    out = COMPANION / "out"
    out.mkdir(exist_ok=True)
    artifacts = []
    if selected == "linux-x64":
        if sys.platform != "linux":
            raise RuntimeError("Build AppImage on Linux")
        appdir = COMPANION / "build/KiberVengance.AppDir"
        if appdir.exists():
            shutil.rmtree(appdir)
        shutil.move(stage, appdir)
        (appdir / "AppRun").write_text('#!/bin/sh\nAPPDIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\nexport PYTHONHOME="$APPDIR/python"\nexport PYTHONPATH="$APPDIR/lib"\nexport PYTHONNOUSERSITE=1\nexec "$APPDIR/python/bin/python3" -m kv_companion "$@"\n')
        (appdir / "AppRun").chmod(0o755)
        (appdir / "kiber-vengance-companion.desktop").write_text('[Desktop Entry]\nType=Application\nName=КИБЕР VENGANCE Companion\nExec=AppRun %u\nIcon=kiber-vengance-companion\nCategories=AudioVideo;Audio;Music;\nTerminal=false\nMimeType=x-scheme-handler/kibervengance;\nX-AppImage-Version=' + VERSION + '\n')
        shutil.copy2(REPOSITORY / "public/icon.svg", appdir / "kiber-vengance-companion.svg")
        shutil.copy2(COMPANION / "packaging/icon.png", appdir / "kiber-vengance-companion.png")
        shutil.copy2(COMPANION / "packaging/icon.png", appdir / ".DirIcon")
        # Portable runtime archives can contain owner-only directory permissions.
        # Packaged application resources contain no user data and must be readable
        # when SquashFS mounts them under a different uid.
        for path in [appdir, *appdir.rglob("*")]:
            if not path.is_symlink():
                path.chmod(path.stat().st_mode | 0o444 | (0o111 if path.is_dir() else 0))
        tool = fetch(lock["appimagetool"], cache)
        tool.chmod(0o755)
        output = out / f"KiberVengance-Companion-{VERSION}-x86_64.AppImage"
        env = {**os.environ, "ARCH": "x86_64", "APPIMAGE_EXTRACT_AND_RUN": "1"}
        runtime = fetch(lock["appimageRuntime"], cache)
        subprocess.run([str(tool), "--runtime-file", str(runtime), str(appdir), str(output)], env=env, check=True)
        subprocess.run([str(output), "--appimage-extract-and-run", "--self-test"], env=env, check=True)
        artifacts.append(output)
    elif selected in {"macos-arm64", "macos-x64"}:
        architecture = "arm64" if selected == "macos-arm64" else "x86_64"
        if sys.platform != "darwin" or platform.machine() != architecture:
            raise RuntimeError(f"Build {selected} on a native {architecture} macOS runner")
        app = COMPANION / "build/Kiber Vengance Companion.app"
        if app.exists():
            shutil.rmtree(app)
        resources = app / "Contents/Resources"
        resources.parent.mkdir(parents=True)
        shutil.move(stage, resources)
        binary = app / "Contents/MacOS/KiberVengance"
        binary.parent.mkdir()
        subprocess.run(["clang", "-arch", architecture, "-mmacosx-version-min=13.0", "-fobjc-arc", "-framework", "AppKit", str(COMPANION / "packaging/launcher.m"), "-o", str(binary)], check=True)
        with (app / "Contents/Info.plist").open("wb") as stream:
            plistlib.dump({"CFBundleExecutable": "KiberVengance", "CFBundleIdentifier": "org.suizman.kiber-vengance.companion", "CFBundleName": "КИБЕР VENGANCE Companion", "CFBundleVersion": VERSION, "CFBundleShortVersionString": VERSION, "CFBundlePackageType": "APPL", "LSMinimumSystemVersion": "13.0", "LSUIElement": True, "CFBundleURLTypes": [{"CFBundleURLName": "KiberVengance", "CFBundleURLSchemes": ["kibervengance"]}]}, stream)
        subprocess.run([str(resources / "python/bin/python3"), "-m", "kv_companion", "--self-test"], env={**os.environ, "PYTHONPATH": str(resources / "lib")}, check=True)
        subprocess.run(["codesign", "--force", "--deep", "--sign", "-", str(app)], check=True)
        output = out / f"KiberVengance-Companion-{VERSION}-{architecture}.dmg"
        payload = COMPANION / "build/dmg-payload"
        if payload.exists():
            shutil.rmtree(payload)
        payload.mkdir()
        shutil.copytree(app, payload / app.name, symlinks=True)
        (payload / "Applications").symlink_to("/Applications", target_is_directory=True)
        subprocess.run(["hdiutil", "create", "-volname", "Kiber Vengance Companion", "-srcfolder", str(payload), "-ov", "-format", "UDZO", str(output)], check=True)
        mounted = COMPANION / "build/dmg-smoke"
        mounted.mkdir(exist_ok=True)
        subprocess.run(["hdiutil", "attach", "-nobrowse", "-readonly", "-mountpoint", str(mounted), str(output)], check=True)
        try:
            installed = mounted / app.name / "Contents/Resources"
            subprocess.run([str(installed / "python/bin/python3"), "-m", "kv_companion", "--self-test"], env={**os.environ, "PYTHONPATH": str(installed / "lib")}, check=True)
            subprocess.run(["codesign", "--verify", "--deep", str(mounted / app.name)], check=True)
        finally:
            subprocess.run(["hdiutil", "detach", str(mounted)], check=True)
        artifacts.append(output)
    else:
        if sys.platform != "win32":
            raise RuntimeError("Build the Windows installer on Windows")
        compiler = Path(os.environ["WINDIR"]) / "Microsoft.NET/Framework64/v4.0.30319/csc.exe"
        subprocess.run([str(compiler), "/nologo", "/target:winexe", "/out:" + str(stage / "KiberVengance.exe"), str(COMPANION / "packaging/Launcher.cs")], check=True)
        subprocess.run([str(stage / "python/python.exe"), "-m", "kv_companion", "--self-test"], env={**os.environ, "PYTHONPATH": str(lib)}, check=True)
        installer = shutil.which("iscc") or str(Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Inno Setup 6/ISCC.exe")
        subprocess.run([installer, str(COMPANION / "packaging/windows.iss")], check=True)
        output = out / f"KiberVengance-Companion-{VERSION}-x64-setup.exe"
        installed = COMPANION / "build/installed-smoke"
        subprocess.run([str(output), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/DIR=" + str(installed)], check=True)
        try:
            subprocess.run([str(installed / "python/python.exe"), "-m", "kv_companion", "--self-test"], env={**os.environ, "PYTHONPATH": str(installed / "lib")}, check=True)
        finally:
            subprocess.run([str(installed / "unins000.exe"), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], check=True)
        artifacts.append(output)
    for artifact in artifacts:
        checksum = sha(artifact)
        artifact.with_name(artifact.name + ".sha256").write_text(checksum + "  " + artifact.name + "\n")
        print(json.dumps({"artifact": str(artifact), "sha256": checksum, "bytes": artifact.stat().st_size, "sourceCommit": source}))


if __name__ == "__main__":
    main()
