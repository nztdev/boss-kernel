"""
B.O.S.S. Heart — heart/heart.py
Server-side metabolic loop. Background monitoring and SSE event push.
Extracted from cortex/cortex.py during Phase 3.

Interface:
    Heart.start(event_queue)   — start background daemon thread
    Heart.stop()               — stop thread (for testing)
"""

import threading
import time
from pathlib import Path

class Heart:
    _thread = None
    _stop_event = None
    _event_queue = None
    
    # Paths must remain identical to original
    WATCH_PATH  = Path.home() / "Downloads"
    URGENT_FLAG = Path("URGENT_ACTION.txt")

    @classmethod
    def start(cls, event_queue):
        """Starts the background heartbeat thread."""
        cls._event_queue = event_queue
        cls._stop_event = threading.Event()
        cls._thread = threading.Thread(target=cls._run, daemon=True)
        cls._thread.start()

    @classmethod
    def stop(cls):
        """Stops the background heartbeat thread."""
        if cls._stop_event:
            cls._stop_event.set()
        if cls._thread:
            cls._thread.join(timeout=1)

    @classmethod
    def _run(cls):
        """
        Polls for system events every 30s.
        Original logic from cortex.py heartbeat_thread.
        """
        last_count = 0
        while not cls._stop_event.is_set():
            # Urgent flag check
            if cls.URGENT_FLAG.exists():
                cls._push_event("VITALS", "Urgent flag detected")
                try: 
                    cls.URGENT_FLAG.unlink()
                except OSError: 
                    pass
            
            # Watch path check (Downloads)
            try:
                if cls.WATCH_PATH.exists():
                    files = list(cls.WATCH_PATH.iterdir())
                    if len(files) > last_count:
                        newest = max(files, key=lambda f: f.stat().st_mtime)
                        cls._push_event("FILE", f"New download: {newest.name}")
                    last_count = len(files)
            except PermissionError:
                pass
            
            # Fixed polling interval: 30s
            cls._stop_event.wait(30)

    @classmethod
    def _push_event(cls, node_name, message, event_type="pulse_event"):
        """Pushes an event to the shared event queue."""
        if cls._event_queue:
            try:
                # Format: type|node|message
                cls._event_queue.put_nowait(f"{event_type}|{node_name}|{message}")
            except Exception: # Handle full queue
                pass
