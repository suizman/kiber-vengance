from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys


def command(args: list[str]) -> str:
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=8, check=False).stdout.strip()[:6000]
    except (OSError, subprocess.TimeoutExpired):
        return ""


def hardware(root):
    ram = 0
    if sys.platform == "darwin":
        try:
            ram = int(command(["sysctl", "-n", "hw.memsize"]))
        except ValueError:
            pass
        gpu = command(["system_profiler", "SPDisplaysDataType", "-json"])
    elif sys.platform == "win32":
        gpu = command(["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"])
        try:
            ram = int(command(["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"]))
        except ValueError:
            pass
    else:
        gpu = command(["lspci"])
        try:
            ram = os.sysconf("SC_PHYS_PAGES") * os.sysconf("SC_PAGE_SIZE")
        except (ValueError, OSError):
            pass
    apple = sys.platform == "darwin" and platform.machine().lower() in {"arm64", "aarch64"}
    amd = "radeon" in gpu.lower() or "advanced micro devices" in gpu.lower()
    nvidia = "nvidia" in gpu.lower()
    profiles = ["cpu"]
    if apple:
        profiles.append("apple")
    if amd:
        profiles.append("rocm")
    if nvidia and sys.platform != "darwin":
        profiles.append("cuda")
    if sys.platform == "win32":
        profiles.append("directml")
    return {
        "os": sys.platform, "architecture": platform.machine(),
        "distribution": platform.freedesktop_os_release().get("ID", "") if sys.platform == "linux" else "",
        "memoryGB": round(ram / 1024**3, 1), "freeDiskGB": round(shutil.disk_usage(root).free / 1024**3, 1),
        "gpuDetected": "Apple Silicon" if apple else "AMD Radeon" if amd else "NVIDIA" if nvidia else "Not detected",
        "profiles": profiles,
        "recommended": "apple" if apple else "rocm" if amd else "cuda" if nvidia else "cpu",
        "note": "GPU availability is verified in the installed runtime before generation; detection alone is not a benchmark.",
    }
