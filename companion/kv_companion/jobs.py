from __future__ import annotations

import json
import os
from pathlib import Path
import signal
import subprocess
import threading
import time
import uuid


class Cancelled(Exception):
    pass


class Job:
    def __init__(self, kind: str, payload: dict):
        self.id = uuid.uuid4().hex
        self.kind, self.payload = kind, payload
        self.status, self.message = "queued", "Waiting"
        self.progress = 0.0
        self.created_at = time.time()
        self.result = None
        self.error = None
        self.event = threading.Event()
        self.process = None
        self.lock = threading.Lock()

    def check(self):
        if self.event.is_set():
            raise Cancelled("Cancelled")

    def update(self, message: str, progress: float | None = None):
        self.check()
        with self.lock:
            self.message = str(message)[-600:]
            if progress is not None:
                self.progress = max(0, min(1, progress))

    def public(self):
        with self.lock:
            return {"id": self.id, "kind": self.kind, "status": self.status,
                    "message": self.message, "progress": self.progress,
                    "createdAt": self.created_at, "result": self.result, "error": self.error}

    def run_process(self, args: list[str], *, cwd: Path | None = None, env=None):
        self.check()
        with self.lock:
            self.check()
            self.process = subprocess.Popen(
                args, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace",
                start_new_session=os.name != "nt",
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
            )
            process = self.process
        try:
            tail = []
            for line in process.stdout:
                self.check()
                tail = (tail + [line.strip()])[-8:]
                self.update(line.strip())
            code = process.wait()
            self.check()
            if code:
                raise RuntimeError("Process failed: " + "\n".join(tail)[-1500:])
        finally:
            if process.poll() is None:
                self._terminate(process)
            if process.stdout:
                process.stdout.close()
            with self.lock:
                self.process = None

    @staticmethod
    def _terminate(process):
        if process.poll() is not None:
            return
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        process.wait(timeout=10)

    def cancel(self):
        self.event.set()
        with self.lock:
            if self.process:
                self._terminate(self.process)
            if self.status == "queued":
                self.status = "cancelled"


class Jobs:
    def __init__(self, root: Path, execute):
        self.root = root
        self.execute = execute
        self.items: dict[str, Job] = {}
        history = root / "jobs"
        if history.exists():
            for path in sorted(history.glob("*.json"), key=lambda p: p.stat().st_mtime)[-100:]:
                try:
                    if path.stat().st_size > 2 * 1024**2:
                        continue
                    saved = json.loads(path.read_text())
                    if not __import__("re").fullmatch(r"[a-f0-9]{32}", saved.get("id", "")):
                        continue
                    job = Job(saved["kind"], {})
                    job.id = saved["id"]
                    for name in ["status", "message", "progress", "result", "error"]:
                        if name in saved:
                            setattr(job, name, saved[name])
                    job.created_at = saved.get("createdAt", time.time())
                    if job.status in {"running", "queued"}:
                        job.status, job.error, job.message = "failed", "Interrupted when the companion stopped. Submit again to retry.", "Interrupted"
                    self.items[job.id] = job
                except (OSError, ValueError, KeyError, TypeError):
                    # Preserve the original history file; it must not prevent startup.
                    continue
        self.condition = threading.Condition()
        self.closed = False
        self.thread = threading.Thread(target=self._work, daemon=True)
        self.thread.start()

    def submit(self, kind: str, payload: dict) -> Job:
        with self.condition:
            if sum(j.status in {"queued", "running"} for j in self.items.values()) >= 8:
                raise ValueError("Job queue is full")
            job = Job(kind, payload)
            self.items[job.id] = job
            from .store import atomic_json
            atomic_json(self.root / "jobs" / f"{job.id}.json", job.public())
            self.condition.notify_all()
            return job

    def _work(self):
        while True:
            with self.condition:
                self.condition.wait_for(lambda: self.closed or any(j.status == "queued" for j in self.items.values()))
                if self.closed:
                    return
                job = next(j for j in self.items.values() if j.status == "queued")
                job.status = "running"
                from .store import atomic_json
                atomic_json(self.root / "jobs" / f"{job.id}.json", job.public())
            try:
                job.check()
                job.result = self.execute(job)
                job.check()
                job.status, job.progress, job.message = "succeeded", 1, "Ready"
            except Cancelled:
                job.status, job.message = "cancelled", "Cancelled"
            except Exception as error:
                job.status, job.error, job.message = "failed", str(error)[-2000:], "Failed"
            finally:
                directory = self.root / "jobs"
                directory.mkdir(parents=True, exist_ok=True)
                from .store import atomic_json
                atomic_json(directory / f"{job.id}.json", job.public())

    def close(self):
        with self.condition:
            self.closed = True
            for job in self.items.values():
                if job.status in {"running", "queued"}:
                    job.cancel()
            self.condition.notify_all()
        if threading.current_thread() is not self.thread:
            self.thread.join(timeout=10)
