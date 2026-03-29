"""
B.O.S.S. CORTEX v0.5 — THE SEMANTIC NERVOUS SYSTEM
====================================================
github.com/nztdev/boss-kernel

The Cortex is a guest, not a master.
The Soma (index.html) is sovereign and fully functional offline.
This server sharpens the field — it does not control it.

Endpoints:
  GET  /handshake  — health check
  POST /resonate   — relative vector boosts (mean-subtracted cosine)
  POST /pulse      — intent routing + optional system action
  POST /remember   — ingest text into server-side memory pool
  GET  /stream     — SSE proactive events (file changes, alerts)

Requirements:
  pip install flask flask-cors sentence-transformers torch watchdog

Security:
  - subprocess whitelist uses ABSOLUTE PATHS only, no shell=True
  - User input never reaches Popen arguments
  - CORS restricted to local origins
"""

import os
import time
import queue
import threading
from pathlib import Path

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from sentence_transformers import SentenceTransformer, util
import torch

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost", "http://127.0.0.1",
    "null",             # file:// origin for local HTML
    "http://192.168.1.*",
])

# ── VECTOR BRAIN ───────────────────────────────────────────────────────────────
print("🧠 B.O.S.S. Cortex warming up...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("✓ Embedding model ready.")

memory_pool: list[str] = []
memory_embeddings = None

def rebuild_embeddings():
    global memory_embeddings
    memory_embeddings = model.encode(memory_pool, convert_to_tensor=True) if memory_pool else None


# ── SECURE EXECUTIVE ───────────────────────────────────────────────────────────
# CRITICAL: Use ABSOLUTE PATHS. Bare executable names like "chrome.exe"
# only work if the binary is on PATH, which is not guaranteed on most systems.
# Adjust paths for your OS.

WHITELIST: dict[str, list[str]] = {
    "chrome": [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        # macOS:  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        # Linux:  "/usr/bin/google-chrome",
    ],
    "notepad": [
        r"C:\Windows\System32\notepad.exe",
        # macOS: ["/usr/bin/open", "-a", "TextEdit"],
        # Linux: "/usr/bin/gedit",
    ],
    "spotify": [
        r"C:\Users\%USERNAME%\AppData\Roaming\Spotify\Spotify.exe",
        # macOS: "/Applications/Spotify.app/Contents/MacOS/Spotify",
    ],
}

def secure_execute(app_name: str) -> str:
    """Launch a whitelisted app. Absolute paths only. No shell=True ever."""
    name = app_name.strip().lower()
    if name not in WHITELIST:
        return f"Action blocked: '{name}' not in whitelist."
    cmd = WHITELIST[name]
    try:
        import subprocess
        subprocess.Popen(cmd)  # no shell=True, no user input in args
        return f"Launched: {name}"
    except FileNotFoundError:
        return f"Binary not found for '{name}'. Update WHITELIST with absolute path."
    except Exception as e:
        return f"Launch error: {e}"


# ── PROACTIVE EVENT BUS ────────────────────────────────────────────────────────
_event_queue: queue.Queue = queue.Queue(maxsize=100)

def push_event(node_name: str, message: str, event_type: str = "pulse_event"):
    try:
        _event_queue.put_nowait(f"{event_type}|{node_name}|{message}")
    except queue.Full:
        pass


# ── WATCHDOG ───────────────────────────────────────────────────────────────────
WATCH_PATH  = Path.home() / "Downloads"
URGENT_FLAG = Path("URGENT_ACTION.txt")

def heartbeat_thread():
    """
    Polls for system events every 30s.
    v0.6 target: replace with watchdog.observers.Observer for true
    inotify/FSEvents push (millisecond latency instead of 30s poll).
    """
    last_count = 0
    while True:
        time.sleep(30)
        if URGENT_FLAG.exists():
            push_event("VITALS", "Urgent flag detected")
            try: URGENT_FLAG.unlink()
            except OSError: pass
        try:
            files = list(WATCH_PATH.iterdir())
            if len(files) > last_count:
                newest = max(files, key=lambda f: f.stat().st_mtime)
                push_event("FILE", f"New download: {newest.name}")
            last_count = len(files)
        except PermissionError:
            pass


# ── ROUTES ─────────────────────────────────────────────────────────────────────

@app.route("/handshake", methods=["GET"])
def handshake():
    return jsonify({
        "status":   "online",
        "identity": "BOSS-CORTEX-0.5",
        "engine":   "Liquid-V0.5",
        "model":    "all-MiniLM-L6-v2",
    })


@app.route("/resonate", methods=["POST"])
def resonate():
    """
    Returns RELATIVE vector boosts for each node specialty.

    Subtracts the field mean so the cortex sharpens the interference
    pattern rather than inflating all node scores uniformly.

    Positive boost  = this node is more relevant than field average.
    Negative boost  = this node is less relevant than field average.
    Zero (offline)  = kernel uses local semanticSim only. Still correct.
    """
    data   = request.json or {}
    intent = data.get("intent", "")
    specs  = data.get("specs", [])

    if not intent or not specs:
        return jsonify({"boosts": [], "raw": []})

    intent_emb = model.encode(intent, convert_to_tensor=True)
    spec_embs  = model.encode(specs,  convert_to_tensor=True)
    raw_scores = util.cos_sim(intent_emb, spec_embs)[0].tolist()

    mean   = sum(raw_scores) / len(raw_scores)
    boosts = [round(s - mean, 4) for s in raw_scores]

    return jsonify({"boosts": boosts, "raw": [round(s, 4) for s in raw_scores]})


@app.route("/pulse", methods=["POST"])
def pulse():
    data      = request.json or {}
    intent    = data.get("intent", "")
    node_name = data.get("node", "GENERAL")
    lower     = intent.lower()

    # System action — whitelist only
    for app_name in WHITELIST:
        if f"open {app_name}" in lower or f"launch {app_name}" in lower:
            return jsonify({"response": secure_execute(app_name), "action": app_name})

    # File system awareness
    if "download" in lower or "recent file" in lower:
        try:
            files = sorted(WATCH_PATH.iterdir(), key=lambda f: f.stat().st_mtime, reverse=True)
            names = [f.name for f in files[:5]]
            return jsonify({"response": f"Recent downloads: {', '.join(names)}", "source": "watchdog"})
        except Exception as e:
            return jsonify({"response": f"Scan error: {e}"})

    # Memory search
    if memory_embeddings is not None and memory_pool:
        intent_emb = model.encode(intent, convert_to_tensor=True)
        sims       = util.cos_sim(intent_emb, memory_embeddings)[0]
        best_idx   = int(torch.argmax(sims))
        best_sim   = float(sims[best_idx])
        if best_sim > 0.45:
            return jsonify({
                "response": f"Memory match ({best_sim:.2f}): {memory_pool[best_idx]}",
                "source":   "vault"
            })

    return jsonify({"response": f"Acknowledged via {node_name}.", "source": "cortex"})


@app.route("/remember", methods=["POST"])
def remember():
    data = request.json or {}
    text = data.get("content", "").strip()
    if not text: return jsonify({"status": "empty"})
    if text not in memory_pool:
        memory_pool.append(text)
        rebuild_embeddings()
        return jsonify({"status": "ingested", "pool_size": len(memory_pool)})
    return jsonify({"status": "duplicate"})


@app.route("/stream")
def stream():
    """SSE — pushes proactive events to the Soma. Browser reconnects automatically."""
    def gen():
        yield "data: keepalive|SYSTEM|Cortex SSE online\n\n"
        while True:
            try:
                event = _event_queue.get(timeout=15)
                yield f"data: {event}\n\n"
            except queue.Empty:
                yield ": keepalive\n\n"  # prevent proxy timeout
    return Response(gen(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── BOOT ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    threading.Thread(target=heartbeat_thread, daemon=True).start()
    print(f"🔺 Cortex online — port 5000")
    print(f"   Downloads watch: {WATCH_PATH}")
    print(f"   Whitelist: {list(WHITELIST.keys())}")
    app.run(host="0.0.0.0", port=5000, threaded=True)
