from __future__ import annotations

import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from kv_companion.security import Pairing, loopback_url
from kv_companion.server import CompanionServer
from kv_companion.jobs import Job, Jobs, Cancelled
from kv_companion.store import atomic_json, child_path
from kv_companion.downloads import download, extract_zip
from kv_companion.engines.diffsinger import validate, spanish_phones, providers, resolve_phone
from kv_companion.engines.acestep import validate as validate_ace
from kv_companion.install import environment, child_environment


class PairingTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.pairing = Pairing(Path(self.directory.name), 19738)

    def test_code_is_single_use_and_token_is_bound_to_the_studio_origin(self):
        code = self.pairing.code
        token = self.pairing.pair(code, "https://studio.suizman.org")
        self.assertTrue(self.pairing.authorized("Bearer " + token, "https://studio.suizman.org"))
        self.assertFalse(self.pairing.authorized("Bearer " + token, None))
        self.assertFalse(self.pairing.authorized("Bearer " + token, "https://attacker.example"))
        self.assertNotEqual(code, self.pairing.code)
        with self.assertRaises(PermissionError):
            self.pairing.pair(code, "https://studio.suizman.org")
        self.pairing.revoke()
        self.assertFalse(self.pairing.authorized("Bearer " + token, "https://studio.suizman.org"))

    def test_pairing_rejects_unknown_origin_expiry_and_excess_attempts(self):
        with self.assertRaises(PermissionError):
            self.pairing.pair(self.pairing.code, "https://attacker.example")
        self.pairing.expires = 0
        with self.assertRaises(PermissionError):
            self.pairing.pair(self.pairing.code, "https://studio.suizman.org")
        self.pairing.rotate(); self.pairing.attempts = 10
        with self.assertRaises(PermissionError):
            self.pairing.pair(self.pairing.code, "https://studio.suizman.org")

    def test_host_and_loopback_validation_prevent_remote_engine_addresses(self):
        self.assertTrue(self.pairing.allowed_host("127.0.0.1:19738"))
        self.assertFalse(self.pairing.allowed_host("attacker.example:19738"))
        self.assertEqual(loopback_url("http://127.0.0.1:8001/"), "http://127.0.0.1:8001")
        for url in ["https://example.org", "http://127.0.0.1.attacker.example:80", "http://user@localhost:80", "http://localhost:80/path"]:
            with self.assertRaises(ValueError): loopback_url(url)


class LoopbackTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.server = CompanionServer(Path(self.directory.name), 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=3)
        self.directory.cleanup()

    def request(self, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        raw = json.dumps(body).encode() if body is not None else None
        connection.request("POST" if body is not None else "GET", path, raw, {**({"Content-Type": "application/json"} if raw else {}), **(headers or {})})
        response = connection.getresponse(); data = response.read(); status = response.status; response_headers = dict(response.getheaders()); connection.close()
        return status, json.loads(data), response_headers

    def test_real_http_server_requires_pairing_and_rejects_rebinding(self):
        status, health, _ = self.request("/api/health")
        self.assertEqual(status, 200); self.assertEqual(health["protocol"], 1)
        self.assertEqual(self.request("/api/status")[0], 403)
        self.assertEqual(self.request("/api/health", headers={"Host": "attacker.example"})[0], 403)
        self.assertEqual(self.request("/api/health", headers={"Origin": "https://attacker.example"})[0], 403)
        origin = "https://studio.suizman.org"
        status, paired, headers = self.request("/api/pair", {"code": self.server.pairing.code}, {"Origin": origin})
        self.assertEqual(status, 200); self.assertEqual(headers["Access-Control-Allow-Origin"], origin)
        self.assertEqual(headers["Access-Control-Allow-Private-Network"], "true")
        auth = {"Authorization": "Bearer " + paired["token"], "Origin": origin}
        self.assertEqual(self.request("/api/pairing", headers=auth)[0], 403)
        self.assertEqual(self.request("/api/jobs", {"kind": "shell", "payload": {}}, auth)[0], 400)
        self.assertEqual(self.request("/api/audio/../../etc/passwd", headers=auth)[0], 404)
        self.assertEqual(self.request("/api/jobs", {"kind": "generate", "payload": {}}, auth)[0], 202)


class JobsTests(unittest.TestCase):
    def test_completed_audio_history_survives_a_companion_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            jobs = Jobs(root, lambda job: {"audioId": job.id, "seconds": 2})
            job = jobs.submit("generate", {})
            limit = time.monotonic() + 3
            while job.status != "succeeded" and time.monotonic() < limit: time.sleep(.01)
            jobs.close()
            restored = Jobs(root, lambda job: self.fail("Completed history must never generate again"))
            try:
                self.assertEqual(restored.items[job.id].result["audioId"], job.id)
                self.assertEqual(restored.items[job.id].status, "succeeded")
            finally: restored.close()

    def test_heavy_jobs_are_serial_and_cancelled_queue_entries_do_not_execute(self):
        with tempfile.TemporaryDirectory() as directory:
            running, release = threading.Event(), threading.Event(); executed = []
            def execute(job):
                executed.append(job.id)
                if job.payload.get("block"):
                    running.set(); release.wait(3)
                return {"ok": True}
            jobs = Jobs(Path(directory), execute)
            try:
                first = jobs.submit("test", {"block": True}); self.assertTrue(running.wait(2))
                second = jobs.submit("test", {}); second.cancel()
                third = jobs.submit("test", {}); self.assertEqual(executed, [first.id]); release.set()
                limit = time.monotonic() + 3
                while third.status != "succeeded" and time.monotonic() < limit: time.sleep(.01)
                self.assertEqual(executed, [first.id, third.id]); self.assertEqual(second.status, "cancelled")
                self.assertTrue((Path(directory) / "jobs" / (third.id + ".json")).exists())
            finally: release.set(); jobs.close()

    def test_cancel_terminates_an_owned_engine_process(self):
        job = Job("test", {}); errors = []
        def run():
            try: job.run_process([sys.executable, "-u", "-c", "import time;print('started',flush=True);time.sleep(30)"])
            except Cancelled: errors.append("cancelled")
        thread = threading.Thread(target=run); thread.start()
        limit = time.monotonic() + 5
        while job.message != "started" and time.monotonic() < limit: time.sleep(.01)
        self.assertEqual(job.message, "started"); job.cancel(); thread.join(timeout=5)
        self.assertFalse(thread.is_alive()); self.assertEqual(errors, ["cancelled"])


class ModelContractTests(unittest.TestCase):
    def test_score_rejects_polyphony_invalid_lyrics_and_nonfinite_times(self):
        note = {"start": 0, "duration": 1, "pitch": 60, "lyric": "la"}
        self.assertEqual(validate({"language": "es", "notes": [note]})["notes"][0]["pitch"], 60)
        for notes in [[{**note, "start": float("nan")}], [note, {**note, "start": .5}], [{**note, "lyric": "+"}], [{**note, "duration": .001}]]:
            with self.assertRaises(ValueError): validate({"language": "es", "notes": notes})

    def test_phonemes_preserve_spanish_and_explicit_gpu_does_not_silently_fallback(self):
        self.assertEqual(spanish_phones("Hola"), ["o", "l", "a"])
        self.assertIn("gn", spanish_phones("niño")); self.assertIn("rr", spanish_phones("rojo"))
        self.assertEqual(resolve_phone("a", "es", {"a": 1, "es/a": 2}), "es/a")
        with self.assertRaises(ValueError): resolve_phone("unknown", "es", {"a": 1})
        self.assertEqual(providers("cpu", ["CoreMLExecutionProvider", "CPUExecutionProvider"]), ["CPUExecutionProvider"])
        with self.assertRaises(RuntimeError): providers("gpu", ["CPUExecutionProvider"])
        self.assertEqual(providers("auto", ["CPUExecutionProvider"]), ["CPUExecutionProvider"])

    def test_second_ace_generation_accepts_pinned_source_code_sync_but_not_missing_weights(self):
        from kv_companion.engines.acestep import local_models_ready
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = {"files": [{"path": "model.safetensors", "size": 3}, {"path": "configuration.py", "size": 3}]}
            (root / "model.safetensors").write_bytes(b"abc")
            (root / "configuration.py").write_text("new adapter synced by pinned upstream source")
            self.assertTrue(local_models_ready(root, manifest))
            (root / "model.safetensors").write_bytes(b"ab")
            self.assertFalse(local_models_ready(root, manifest))
            (root / "model.safetensors").unlink()
            self.assertFalse(local_models_ready(root, manifest))

    def test_music_proposal_validates_actual_upstream_limits(self):
        data = {"lyrics": "Hola mundo", "style": "industrial rock", "language": "es", "duration": 10, "bpm": 120}
        self.assertEqual(validate_ace(data)["duration"], 10)
        for updates in [{"duration": 2}, {"seed": "invalid"}, {"bpm": float("inf")}, {"lyrics": ""}]:
            with self.assertRaises(ValueError): validate_ace({**data, **updates})

    def test_runtime_profile_and_environment_are_not_client_supplied_commands(self):
        with self.assertRaises(ValueError): environment(Path("/models"), "../outside", "cpu")
        with self.assertRaises(ValueError): environment(Path("/models"), "diffsinger", "../outside")
        with patch.dict(os.environ, {"PYTHONHOME": "/temporary/appimage", "PYTHONPATH": "/external"}):
            env = child_environment(); self.assertNotIn("PYTHONHOME", env); self.assertNotIn("PYTHONPATH", env)


class DownloadTests(unittest.TestCase):
    def test_interrupted_download_resumes_and_checksum_mismatch_is_not_installed(self):
        class Response(io.BytesIO):
            status = 206
            headers = {"Content-Length": "3", "Content-Range": "bytes 3-5/6"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "weights.bin"; path.with_suffix(".bin.part").write_bytes(b"abc")
            expected = hashlib.sha256(b"abcdef").hexdigest(); job = Job("test", {})
            with patch("urllib.request.urlopen", return_value=Response(b"def")) as request:
                download("https://model.test/weights", path, job, expected)
                self.assertEqual(request.call_args[0][0].headers["Range"], "bytes=3-")
            self.assertEqual(path.read_bytes(), b"abcdef")
            path.unlink()
            with patch("urllib.request.urlopen", return_value=Response(b"bad")):
                with self.assertRaises(ValueError): download("https://model.test/weights", path, job, expected)
            self.assertFalse(path.exists())

    def test_voice_archive_rejects_traversal_and_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); archive = root / "voice.zip"
            with zipfile.ZipFile(archive, "w") as z: z.writestr("../../outside", "bad")
            with self.assertRaises(ValueError): extract_zip(archive, root / "voice", Job("test", {}))
            with zipfile.ZipFile(archive, "w") as z:
                info = zipfile.ZipInfo("link"); info.external_attr = 0o120777 << 16; z.writestr(info, "outside")
            with self.assertRaises(ValueError): extract_zip(archive, root / "voice2", Job("test", {}))
            self.assertFalse((root / "outside").exists())


if __name__ == "__main__":
    unittest.main()
