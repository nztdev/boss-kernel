"""
B.O.S.S. CORTEX v0.6 — THE SEMANTIC NERVOUS SYSTEM
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

Configuration (environment variables or .env file):
  BOSS_PORT          — server port (default: 5000)
  BOSS_CHROME        — absolute path to Chrome executable
  BOSS_NOTEPAD       — absolute path to text editor executable
  BOSS_SPOTIFY       — absolute path to Spotify executable
  BOSS_RATE_LIMIT    — max requests/min on /resonate (default: 60)

Requirements:
  pip install flask flask-cors sentence-transformers torch python-dotenv

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
from collections import deque

# Load .env file if present — silently ignored if python-dotenv not installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from heart.heart import Heart

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
_model_ready = False
model = None

def _load_model():
    global model, _model_ready
    try:
        model = SentenceTransformer("all-MiniLM-L6-v2")
        _model_ready = True
        print("✓ Embedding model ready.")
    except Exception as e:
        print(f"✗ Embedding model failed to load: {e}")

# Load model in background thread — Cortex accepts requests immediately,
# /resonate and /pulse return not_ready until model finishes loading.
threading.Thread(target=_load_model, daemon=True).start()

memory_pool: list[str] = []
memory_embeddings = None

def rebuild_embeddings():
    global memory_embeddings
    memory_embeddings = model.encode(memory_pool, convert_to_tensor=True) if memory_pool else None


# ── RATE LIMITER ───────────────────────────────────────────────────────────────
# Token bucket per remote address. No external dependency.
# BOSS_RATE_LIMIT env var sets max requests per minute (default 60).
_rate_limit    = int(os.environ.get("BOSS_RATE_LIMIT", "60"))
_rate_window   = 60  # seconds
_rate_buckets: dict[str, deque] = {}
_rate_lock     = threading.Lock()

def _is_rate_limited(client_ip: str) -> bool:
    """Returns True if client has exceeded the rate limit."""
    now = time.monotonic()
    with _rate_lock:
        if client_ip not in _rate_buckets:
            _rate_buckets[client_ip] = deque()
        bucket = _rate_buckets[client_ip]
        # Remove timestamps outside the window
        while bucket and now - bucket[0] > _rate_window:
            bucket.popleft()
        if len(bucket) >= _rate_limit:
            return True
        bucket.append(now)
        return False


# ── ERROR HELPERS ──────────────────────────────────────────────────────────────
def err(message: str, code: str, status: int = 400):
    """Return a consistent JSON error response."""
    return jsonify({"error": message, "code": code}), status

def not_ready():
    return err("Embedding model is still loading — retry in a moment.",
               "not_ready", 503)


# ── SECURE EXECUTIVE ───────────────────────────────────────────────────────────
# Paths loaded from environment variables.
# Set these in a .env file (see .env.example) — never hardcode paths in source.
# Falls back to common default paths if env var not set.

def _resolve_whitelist() -> dict[str, list[str]]:
    """Build WHITELIST from environment variables with platform-aware fallbacks."""
    home = Path.home()
    return {
        "chrome": [p for p in [
            os.environ.get("BOSS_CHROME"),
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/usr/bin/google-chrome",
        ] if p],
        "notepad": [p for p in [
            os.environ.get("BOSS_NOTEPAD"),
            r"C:\Windows\System32\notepad.exe",
            "/usr/bin/open",
            "/usr/bin/gedit",
        ] if p],
        "spotify": [p for p in [
            os.environ.get("BOSS_SPOTIFY"),
            str(home / "AppData" / "Roaming" / "Spotify" / "Spotify.exe"),
            "/Applications/Spotify.app/Contents/MacOS/Spotify",
            "/usr/bin/spotify",
        ] if p],
    }

WHITELIST = _resolve_whitelist()

def secure_execute(app_name: str) -> str:
    """Launch a whitelisted app. Tries each path in order until one works."""
    name = app_name.strip().lower()
    if name not in WHITELIST:
        return f"Action blocked: '{name}' not in whitelist."
    import subprocess
    for path in WHITELIST[name]:
        try:
            subprocess.Popen([path])  # no shell=True, no user input in args
            return f"Launched: {name} ({path})"
        except FileNotFoundError:
            continue
        except Exception as e:
            return f"Launch error: {e}"
    return (f"Binary not found for '{name}'. "
            f"Set BOSS_{name.upper()} in .env with the absolute path.")


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

# Heart functionality in heart/heart.py


# ── ROUTES ─────────────────────────────────────────────────────────────────────

@app.route("/handshake", methods=["GET"])
def handshake():
    return jsonify({
        "status":   "online",
        "identity": "BOSS-CORTEX-0.6",
        "engine":   "Liquid-V0.6",
        "model":    "all-MiniLM-L6-v2",
        "model_ready": _model_ready,
        "rate_limit": _rate_limit,
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
    # Rate limit check
    client_ip = request.remote_addr or "unknown"
    if _is_rate_limited(client_ip):
        return err(f"Rate limit exceeded ({_rate_limit} req/min). Slow down.",
                   "rate_limited", 429)

    # Model readiness guard
    if not _model_ready:
        return not_ready()

    try:
        data   = request.json or {}
        intent = data.get("intent", "")
        specs  = data.get("specs", [])

        if not intent or not specs:
            return jsonify({"boosts": [], "raw": []})

        if not isinstance(specs, list) or not all(isinstance(s, str) for s in specs):
            return err("'specs' must be a list of strings.", "invalid_input")

        intent_emb = model.encode(intent, convert_to_tensor=True)
        spec_embs  = model.encode(specs,  convert_to_tensor=True)
        raw_scores = util.cos_sim(intent_emb, spec_embs)[0].tolist()

        mean   = sum(raw_scores) / len(raw_scores)
        boosts = [round(s - mean, 4) for s in raw_scores]

        return jsonify({"boosts": boosts, "raw": [round(s, 4) for s in raw_scores]})

    except Exception as e:
        return err(f"Resonate failed: {str(e)}", "resonate_error", 500)


@app.route("/pulse", methods=["POST"])
def pulse():
    if not _model_ready:
        return not_ready()

    try:
        data      = request.json or {}
        intent    = data.get("intent", "")
        node_name = data.get("node", "GENERAL")

        if not intent:
            return err("'intent' is required.", "missing_intent")

        lower = intent.lower()

        # System action — whitelist only
        for app_name in WHITELIST:
            if f"open {app_name}" in lower or f"launch {app_name}" in lower:
                result = secure_execute(app_name)
                return jsonify({"response": result, "action": app_name, "source": "whitelist"})

        # File system awareness
        if "download" in lower or "recent file" in lower:
            try:
                files = sorted(WATCH_PATH.iterdir(),
                               key=lambda f: f.stat().st_mtime, reverse=True)
                names = [f.name for f in files[:5]]
                return jsonify({
                    "response": f"Recent downloads: {', '.join(names)}",
                    "source":   "watchdog"
                })
            except PermissionError:
                return err("Downloads folder access denied.", "permission_denied", 403)
            except Exception as e:
                return err(f"Watchdog scan failed: {str(e)}", "watchdog_error", 500)

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

        return jsonify({
            "response": f"Acknowledged via {node_name}.",
            "source":   "cortex"
        })

    except Exception as e:
        return err(f"Pulse failed: {str(e)}", "pulse_error", 500)


@app.route("/remember", methods=["POST"])
def remember():
    try:
        data = request.json or {}
        text = data.get("content", "").strip()
        if not text:
            return jsonify({"status": "empty"})
        if text not in memory_pool:
            memory_pool.append(text)
            rebuild_embeddings()
            return jsonify({"status": "ingested", "pool_size": len(memory_pool)})
        return jsonify({"status": "duplicate"})
    except Exception as e:
        return err(f"Remember failed: {str(e)}", "remember_error", 500)


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
    port = int(os.environ.get("BOSS_PORT", "5000"))
    Heart.start(_event_queue)
    print(f"🔺 Cortex online — port {port}")
    print(f"   Downloads watch: {WATCH_PATH}")
    print(f"   Whitelist: {list(WHITELIST.keys())}")
    print(f"   Rate limit: {_rate_limit} req/min on /resonate")
    print(f"   Model loading in background...")
    app.run(host="0.0.0.0", port=port, threaded=True)
