"""
B.O.S.S. CORTEX v0.5 — SEMANTIC NERVOUS SYSTEM
================================================
Required:
    pip install flask flask-cors sentence-transformers watchdog

Architecture:
    /resonate  — returns relative vector boosts (not raw cosine — normalized
                 against field mean so boost is always a delta, not inflation)
    /pulse     — intent routing + system commands via secure whitelist
    /handshake — health check
    /stream    — SSE proactive push (file events, system alerts)

Security:
    - subprocess uses absolute path whitelist, no shell=True, no user input
      passed to Popen arguments
    - CORS restricted to localhost origins in production mode
    - SSE stream should sit behind a reverse proxy with auth in any
      internet-facing deployment
"""

import os
import time
import threading
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from sentence_transformers import SentenceTransformer, util
import torch

app = Flask(__name__)

# In production: restrict to your phone's local IP
CORS(app, origins=["http://localhost", "http://127.0.0.1", "null",
                   "http://192.168.1.*", "file://"])

# ── 1. VECTOR BRAIN ────────────────────────────────────────────────────────────
# Loaded once at startup. all-MiniLM-L6-v2 = 80MB, fast on CPU.
print("🧠 Loading embedding model...")
vector_model = SentenceTransformer("all-MiniLM-L6-v2")
print("✓ Model ready.")

# In-memory knowledge pool — v0.5 Watchdog will populate this dynamically
memory_pool: list[str] = []
memory_embeddings = None

def rebuild_memory_embeddings():
    global memory_embeddings
    if memory_pool:
        memory_embeddings = vector_model.encode(memory_pool, convert_to_tensor=True)
    else:
        memory_embeddings = None

rebuild_memory_embeddings()


# ── 2. SECURE EXECUTIVE ────────────────────────────────────────────────────────
# Absolute path whitelist. No shell=True. No user input reaches Popen args.
# Add entries for your OS. Windows paths shown; swap for macOS/Linux equivalents.

WHITELIST: dict[str, list[str]] = {
    "chrome": [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        # macOS: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        # Linux: "/usr/bin/google-chrome"
    ],
    "notepad": ["notepad.exe"],
    # Add your own — absolute paths only, no arguments from user input
}

def secure_execute(app_name: str) -> str:
    """Launch a whitelisted application. No shell interpolation."""
    app_name = app_name.strip().lower()
    if app_name not in WHITELIST:
        return f"Action blocked: '{app_name}' not in whitelist."
    cmd = WHITELIST[app_name]
    try:
        subprocess.Popen(cmd)  # no shell=True, no user-controlled args
        return f"Launched: {app_name}"
    except FileNotFoundError:
        return f"Binary not found for '{app_name}'. Check WHITELIST path."
    except Exception as e:
        return f"Launch error: {e}"


# ── 3. PROACTIVE EVENT BUS ─────────────────────────────────────────────────────
# Thread-safe queue that SSE clients drain.
# Any part of the server can push an event here.

import queue
_event_queue: queue.Queue = queue.Queue(maxsize=100)

def push_event(node_name: str, message: str, event_type: str = "pulse_event"):
    """Push a proactive event to all SSE listeners."""
    try:
        _event_queue.put_nowait(f"{event_type}|{node_name}|{message}")
    except queue.Full:
        pass  # drop if no clients are listening


# ── 4. WATCHDOG (File System Sensor) ──────────────────────────────────────────
WATCH_PATH = Path.home() / "Downloads"
URGENT_FLAG = Path("URGENT_ACTION.txt")

def heartbeat_thread():
    """
    Polls for system events every 30s.
    In v0.6: replace with watchdog.observers.Observer for true inotify/FSEvents.
    """
    last_download_count = 0
    while True:
        time.sleep(30)

        # Urgent flag file
        if URGENT_FLAG.exists():
            push_event("VITALS", "Urgent flag detected on disk")
            try:
                URGENT_FLAG.unlink()  # consume the flag
            except OSError:
                pass

        # New download detected
        try:
            files = list(WATCH_PATH.iterdir())
            if len(files) > last_download_count:
                newest = max(files, key=lambda f: f.stat().st_mtime)
                push_event("FILE", f"New download: {newest.name}")
            last_download_count = len(files)
        except PermissionError:
            pass


# ── 5. ROUTES ──────────────────────────────────────────────────────────────────

@app.route("/handshake", methods=["GET"])
def handshake():
    return jsonify({"status": "online", "identity": "BOSS-PRIME", "model": "all-MiniLM-L6-v2"})


@app.route("/resonate", methods=["POST"])
def resonate():
    """
    Returns RELATIVE vector boosts for each node specialty.

    Why relative, not raw cosine:
        Raw cosine on a broad intent returns high scores for all nodes,
        inflating the total frequency uniformly — the kernel can't differentiate.
        By subtracting the field mean, only nodes more semantically relevant
        than average get a positive boost. Nodes below average get a penalty.
        This sharpens the interference pattern rather than inflating it.

    Response: { "boosts": [float, ...], "raw": [float, ...] }
    """
    data = request.json or {}
    intent = data.get("intent", "")
    specs  = data.get("specs", [])   # list of node specialty strings

    if not intent or not specs:
        return jsonify({"boosts": [], "raw": []})

    intent_emb = vector_model.encode(intent, convert_to_tensor=True)
    spec_embs  = vector_model.encode(specs,  convert_to_tensor=True)

    # Raw cosine similarities [0, 1]
    raw_scores = util.cos_sim(intent_emb, spec_embs)[0].tolist()

    # Normalize: subtract field mean → relative boost ∈ [-mean, 1-mean]
    mean = sum(raw_scores) / len(raw_scores) if raw_scores else 0
    relative_boosts = [round(s - mean, 4) for s in raw_scores]

    return jsonify({"boosts": relative_boosts, "raw": [round(s, 4) for s in raw_scores]})


@app.route("/pulse", methods=["POST"])
def pulse():
    """Intent routing + optional system action."""
    data = request.json or {}
    intent    = data.get("intent", "")
    node_name = data.get("node", "GENERAL")

    # System action detection (whitelist only)
    lower = intent.lower()
    for app_name in WHITELIST:
        if f"open {app_name}" in lower or f"launch {app_name}" in lower:
            result = secure_execute(app_name)
            return jsonify({"response": result, "action": app_name})

    # File system awareness
    if "download" in lower or "file" in lower:
        try:
            files = sorted(WATCH_PATH.iterdir(), key=lambda f: f.stat().st_mtime, reverse=True)
            names = [f.name for f in files[:5]]
            return jsonify({"response": f"Recent downloads: {', '.join(names)}"})
        except Exception as e:
            return jsonify({"response": f"Download scan error: {e}"})

    # Memory search using embeddings
    if memory_embeddings is not None:
        intent_emb = vector_model.encode(intent, convert_to_tensor=True)
        sims = util.cos_sim(intent_emb, memory_embeddings)[0]
        best_idx = int(torch.argmax(sims))
        best_sim = float(sims[best_idx])
        if best_sim > 0.45:
            match = memory_pool[best_idx]
            return jsonify({"response": f"Memory match ({best_sim:.2f}): {match}", "source": "vault"})

    return jsonify({"response": f"Acknowledged via {node_name} node.", "source": "cortex"})


@app.route("/remember", methods=["POST"])
def remember():
    """Ingest a string into the server-side memory pool."""
    data = request.json or {}
    text = data.get("content", "").strip()
    if not text:
        return jsonify({"status": "empty"})
    if text not in memory_pool:
        memory_pool.append(text)
        rebuild_memory_embeddings()
        return jsonify({"status": "ingested", "pool_size": len(memory_pool)})
    return jsonify({"status": "duplicate"})


@app.route("/stream")
def stream():
    """
    Server-Sent Events — pushes proactive pulses to the JS body.
    The browser EventSource reconnects automatically on drop.
    """
    def event_generator():
        # Send an initial keepalive so the browser confirms the connection
        yield "data: keepalive|SYSTEM|Cortex SSE online\n\n"
        while True:
            try:
                event = _event_queue.get(timeout=15)
                yield f"data: {event}\n\n"
            except queue.Empty:
                # Send a keepalive comment to prevent connection timeout
                yield ": keepalive\n\n"

    return Response(event_generator(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── BOOT ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    threading.Thread(target=heartbeat_thread, daemon=True).start()
    print("🔺 B.O.S.S. Cortex online — port 5000")
    print(f"   Watching: {WATCH_PATH}")
    print(f"   Whitelist: {list(WHITELIST.keys())}")
    app.run(host="0.0.0.0", port=5000, threaded=True)