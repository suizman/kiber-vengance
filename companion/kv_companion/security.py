from __future__ import annotations

import secrets
import threading
import time
from urllib.parse import urlsplit

from .store import atomic_json, read_json

STUDIO_ORIGINS = {
    "https://studio.suizman.org",
    "https://kiber-vengance.starrylemur35.chatgpt.site",
    "http://127.0.0.1:4173", "http://localhost:4173",
    "http://127.0.0.1:4256",  # isolated production integration test
}


class Pairing:
    def __init__(self, root, port: int):
        self.path = root / "clients.json"
        self.clients = read_json(self.path, {})
        self.port = port
        self.dashboard_token = secrets.token_urlsafe(32)
        self.lock = threading.Lock()
        self.rotate()

    def rotate(self):
        self.code = f"{secrets.randbelow(1_000_000):06d}"
        self.expires = time.monotonic() + 600
        self.attempts = 0

    def allowed_host(self, host: str) -> bool:
        return host in {f"127.0.0.1:{self.port}", f"localhost:{self.port}"}

    def allowed_origin(self, origin: str | None) -> bool:
        return origin is None or origin in STUDIO_ORIGINS or origin in {
            f"http://127.0.0.1:{self.port}", f"http://localhost:{self.port}"
        }

    def pair(self, code: str, origin: str):
        with self.lock:
            if origin not in STUDIO_ORIGINS:
                raise PermissionError("Open the configured studio to connect")
            self.attempts += 1
            if self.attempts > 10 or time.monotonic() > self.expires:
                raise PermissionError("Pairing code expired. Generate a new code in the companion.")
            if not secrets.compare_digest(str(code), self.code):
                raise PermissionError("Incorrect pairing code")
            token = secrets.token_urlsafe(32)
            self.clients[token] = {"origin": origin, "createdAt": time.time()}
            atomic_json(self.path, self.clients)
            self.rotate()
            return token

    def authorized(self, header: str, origin: str | None) -> bool:
        token = header.removeprefix("Bearer ")
        if not token or header == token:
            return False
        if secrets.compare_digest(token, self.dashboard_token):
            return origin in {None, f"http://127.0.0.1:{self.port}", f"http://localhost:{self.port}"}
        client = self.clients.get(token)
        return bool(client and client["origin"] == origin)

    def revoke(self):
        with self.lock:
            self.clients = {}
            atomic_json(self.path, self.clients)


def loopback_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise ValueError("Only local HTTP engine addresses are allowed")
    if parsed.username or parsed.password or parsed.fragment or parsed.query or parsed.path not in {"", "/"}:
        raise ValueError("Invalid local engine address")
    if not parsed.port:
        raise ValueError("A local port is required")
    return value.rstrip("/")
