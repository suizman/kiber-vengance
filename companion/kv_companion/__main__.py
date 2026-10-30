from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import threading
import webbrowser

from . import VERSION
from .server import CompanionServer
from .store import data_directory
from .store import atomic_json, read_json


def main():
    parser = argparse.ArgumentParser(description="КИБЕР VENGANCE · Local vocal companion")
    parser.add_argument("--port", type=int, default=19738)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--data-dir", type=Path)
    parser.add_argument("url", nargs="?")
    args = parser.parse_args()
    if args.url and args.url != "kibervengance://open" and args.url != "kibervengance://open/":
        parser.error("Unknown companion URL")
    if args.self_test:
        import tempfile
        from .engines.diffsinger import validate, spanish_phones
        with tempfile.TemporaryDirectory() as folder:
            server = CompanionServer(Path(folder), 0)
            assert server.server_address[0] == "127.0.0.1"
            assert spanish_phones("hola") == ["o", "l", "a"]
            assert validate({"language": "es", "notes": [{"start": 0, "duration": 1, "pitch": 60, "lyric": "la"}]})
            server.server_close()
        print(json.dumps({"ok": True, "version": VERSION, "python": sys.version.split()[0], "platform": sys.platform}))
        return
    if not 1024 <= args.port <= 65535:
        parser.error("Port must be 1024–65535")
    try:
        root = (args.data_dir or data_directory()).resolve()
        server = CompanionServer(root, args.port)
    except OSError:
        # Launching twice reopens the existing management page without exposing credentials.
        if not args.no_browser:
            info = read_json((args.data_dir or data_directory()) / "running.json", {})
            webbrowser.open(f"http://127.0.0.1:{args.port}/#" + info.get("dashboardToken", ""))
        print("The local companion is already running, or the selected port is unavailable.")
        return
    atomic_json(root / "running.json", {"dashboardToken": server.pairing.dashboard_token, "port": server.server_port, "pid": os.getpid()})
    if not args.no_browser:
        url = f"http://127.0.0.1:{server.server_port}/#" + server.pairing.dashboard_token
        threading.Timer(.25, lambda: webbrowser.open(url)).start()
    print(f"КИБЕР VENGANCE companion {VERSION} · http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
