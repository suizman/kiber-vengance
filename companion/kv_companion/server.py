from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import socket
import threading
import time
from urllib.parse import urlsplit
import uuid

from . import VERSION, PROTOCOL
from .jobs import Jobs
from .models import Engines
from .security import Pairing
from .store import read_json


class CompanionServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, root: Path, port: int = 19738):
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        super().__init__(("127.0.0.1", port), Handler)
        self.root = root
        self.pairing = Pairing(root, self.server_port)
        self.engines = Engines(root)
        self.jobs = Jobs(root, self.engines.execute)

    def server_close(self):
        if hasattr(self, "jobs"):
            self.jobs.close()
        super().server_close()


class Handler(BaseHTTPRequestHandler):
    server: CompanionServer
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        # Never log pairing codes, authorization headers, lyrics or file URLs.
        pass

    def setup(self):
        super().setup()
        self.connection.settimeout(60)

    def _headers(self, status: int, content_type: str, length: int):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        origin = self.headers.get("Origin")
        if origin and self.server.pairing.allowed_origin(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        if content_type.startswith("text/html"):
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self.end_headers()

    def json(self, value, status=200):
        raw = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self._headers(status, "application/json; charset=utf-8", len(raw))
        self.wfile.write(raw)

    def guard(self):
        if not self.server.pairing.allowed_host(self.headers.get("Host", "")):
            raise PermissionError("Invalid local Host header")
        if not self.server.pairing.allowed_origin(self.headers.get("Origin")):
            raise PermissionError("This website is not authorized to contact the companion")

    def auth(self, owner=False):
        self.guard()
        header = self.headers.get("Authorization", "")
        if not self.server.pairing.authorized(header, self.headers.get("Origin")):
            raise PermissionError("Connect the studio using the code shown in the companion")
        if owner and header != "Bearer " + self.server.pairing.dashboard_token:
            raise PermissionError("Open the local companion window for this action")

    def body(self):
        if self.headers.get_content_type() != "application/json":
            raise ValueError("JSON request required")
        size = int(self.headers.get("Content-Length", "0"))
        if not 0 < size <= 2 * 1024**2:
            raise ValueError("Invalid request size")
        value = json.loads(self.rfile.read(size))
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object")
        return value

    def do_OPTIONS(self):
        try:
            self.guard()
            self._headers(204, "application/json", 0)
        except PermissionError as error:
            self.json({"error": str(error)}, 403)

    def do_GET(self):
        self.dispatch(False)

    def do_POST(self):
        self.dispatch(True)

    def dispatch(self, post: bool):
        try:
            self.guard()
            url = urlsplit(self.path)
            if url.query or url.fragment:
                raise ValueError("Unexpected query parameters")
            path = url.path
            if not post and path in {"/", "/app.js", "/style.css"}:
                name = {"/": "index.html", "/app.js": "app.js", "/style.css": "style.css"}[path]
                content_type = {"/": "text/html", "/app.js": "text/javascript", "/style.css": "text/css"}[path]
                raw = (Path(__file__).parent / "web" / name).read_bytes()
                self._headers(200, content_type + "; charset=utf-8", len(raw))
                self.wfile.write(raw)
                return
            if not post and path == "/api/health":
                self.json({"app": "kiber-vengance-companion", "version": VERSION, "protocol": PROTOCOL})
                return
            if post and path == "/api/pair":
                data = self.body()
                token = self.server.pairing.pair(data.get("code", ""), self.headers.get("Origin", ""))
                self.json({"token": token, "protocol": PROTOCOL, "version": VERSION})
                return
            self.auth()
            if not post and path == "/api/status":
                self.json({**self.server.engines.status(), "version": VERSION, "protocol": PROTOCOL,
                           "jobs": self.server.jobs.public()})
            elif not post and path == "/api/pairing":
                self.auth(owner=True)
                self.json({"code": self.server.pairing.code, "expiresIn": max(0, round(self.server.pairing.expires - time.monotonic()))})
            elif not post and re.fullmatch(r"/api/voices/[a-zA-Z0-9_-]{1,80}", path):
                result = read_json(self.server.root / "models/voices" / path.rsplit("/", 1)[1] / "voice.json")
                if not result:
                    self.json({"error": "Voice not found"}, 404)
                else:
                    self.json({k: v for k, v in result.items() if k != "directory"})
            elif not post and re.fullmatch(r"/api/jobs/[a-f0-9]{32}", path):
                item = self.server.jobs.items.get(path.rsplit("/", 1)[1])
                if item:
                    self.json(item.public())
                else:
                    result = read_json(self.server.root / "jobs" / (path.rsplit("/", 1)[1] + ".json"))
                    self.json(result or {"error": "Job not found"}, 200 if result else 404)
            elif not post and re.fullmatch(r"/api/audio/[a-f0-9]{32}", path):
                audio = self.server.root / "outputs" / (path.rsplit("/", 1)[1] + ".wav")
                if not audio.is_file():
                    self.json({"error": "Audio not found"}, 404)
                    return
                self._headers(200, "audio/wav", audio.stat().st_size)
                with audio.open("rb") as stream:
                    while chunk := stream.read(1024 * 1024):
                        self.wfile.write(chunk)
            elif post and path == "/api/jobs":
                data = self.body()
                if data.get("kind") not in {"install-runtime", "repair-runtime", "install-acestep", "install-voice", "import-voice", "remove-model", "generate", "diagnose"}:
                    raise ValueError("Unknown job kind")
                if not isinstance(data.get("payload"), dict):
                    raise ValueError("Invalid job payload")
                job = self.server.jobs.submit(data["kind"], data["payload"])
                self.json(job.public(), 202)
            elif post and re.fullmatch(r"/api/jobs/[a-f0-9]{32}/cancel", path):
                self.body()
                job = self.server.jobs.items.get(path.split("/")[3])
                if not job:
                    raise ValueError("Job not found")
                self.server.jobs.cancel(job)
                self.json(job.public())
            elif post and path == "/api/upload":
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 3 * 1024**3:
                    raise ValueError("Voice archive must be 1 byte–3 GB")
                if self.headers.get_content_type() != "application/zip":
                    raise ValueError("Select a ZIP voicebank")
                if __import__("shutil").disk_usage(self.server.root).free < size + 1024**3:
                    raise ValueError("Not enough free disk space")
                upload_id = uuid.uuid4().hex
                target = self.server.root / "uploads" / (upload_id + ".zip")
                partial = target.with_suffix(".part")
                try:
                    with partial.open("wb") as stream:
                        remaining = size
                        while remaining:
                            chunk = self.rfile.read(min(1024 * 1024, remaining))
                            if not chunk:
                                raise ValueError("Upload interrupted")
                            stream.write(chunk)
                            remaining -= len(chunk)
                    partial.rename(target)
                finally:
                    partial.unlink(missing_ok=True)
                self.json({"upload": upload_id}, 201)
            elif post and path in {"/api/pairing/rotate", "/api/revoke", "/api/shutdown"}:
                self.auth(owner=True)
                self.body()
                if path == "/api/pairing/rotate":
                    self.server.pairing.rotate()
                elif path == "/api/revoke":
                    self.server.pairing.revoke()
                else:
                    threading.Thread(target=self.server.shutdown, daemon=True).start()
                self.json({"ok": True})
            elif post and path in {"/api/integrate", "/api/updates"}:
                self.auth(owner=True)
                self.body()
                from .integration import install_launcher, check_update
                self.json(install_launcher(self.server.root) if path == "/api/integrate" else check_update(VERSION))
            else:
                self.json({"error": "Endpoint not found"}, 404)
        except PermissionError as error:
            self.json({"error": str(error)}, 403)
        except (ValueError, json.JSONDecodeError) as error:
            self.close_connection = True
            self.json({"error": str(error)}, 400)
        except (BrokenPipeError, ConnectionResetError, socket.timeout):
            self.close_connection = True
        except Exception:
            self.close_connection = True
            self.json({"error": "Companion operation failed. Check the job details or restart the assistant."}, 500)
