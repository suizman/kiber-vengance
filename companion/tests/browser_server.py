"""HTTP protocol fixture for studio UI tests. Never used for inference evidence."""
import json
import math
from pathlib import Path
import signal
import struct
import sys
import tempfile
import threading
import time
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from kv_companion.server import CompanionServer
from kv_companion.store import atomic_json

directory = tempfile.TemporaryDirectory()
root = Path(directory.name)
for engine in ["diffsinger", "acestep"]:
    runtime = root / "runtimes" / (engine + "-cpu")
    executable = runtime / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    executable.parent.mkdir(parents=True)
    executable.write_text("HTTP fixture: never executed")
    atomic_json(runtime / "installed.json", {"engine": engine, "profile": "cpu", "probe": {"fixture": True}})
atomic_json(root / "models/acestep/installed.json", {"model": "Protocol fixture", "revision": "fixture"})
atomic_json(root / "models/voices/fixture/voice.json", {"id": "fixture", "name": "Protocol fixture voice", "speakers": [], "languages": ["es", "en"], "expression": [], "license": "Test fixture only", "licenseUrl": "", "attribution": "Protocol fixture, not model inference", "commercial": False, "phonemes": ["SP", "es/a", "es/l"]})
server = CompanionServer(root, 0)


def execute(job):
    if job.kind != "generate":
        return {"fixture": True}
    for _ in range(8):
        job.update("Protocol fixture processing")
        time.sleep(.04)
    payload = job.payload
    with wave.open(str(root / "outputs" / (job.id + ".wav")), "wb") as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(24000)
        output.writeframes(b"".join(struct.pack("<h", round(4000 * math.sin(i * .05))) for i in range(24000)))
    return {"engine": payload["engine"], "model": "Protocol fixture", "revision": "fixture",
            "device": "CPUExecutionProvider", "outputKind": "score-vocal" if payload["engine"] == "diffsinger" else "musical-proposal",
            "settings": payload["settings"], "audioId": job.id, "seconds": 1,
            "elapsedSeconds": .32, "sha256": "fixture", "attribution": "Protocol fixture, not model inference"}


server.jobs.execute = execute
print(json.dumps({"code": server.pairing.code, "port": server.server_port, "ownerUrl": f"http://127.0.0.1:{server.server_port}/#{server.pairing.dashboard_token}"}), flush=True)
def stop(*_):
    threading.Thread(target=server.shutdown, daemon=True).start()
signal.signal(signal.SIGTERM, stop)
try:
    server.serve_forever(poll_interval=.1)
finally:
    server.server_close(); directory.cleanup()
