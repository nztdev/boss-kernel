# B.O.S.S. — Agent Session Brief (BOSS_CONTEXT.md)
**Repo:** https://github.com/nztdev/boss-kernel
**Current phase:** Phase 3 — Heart extraction
**Current task:** Extract scattered metabolic functions into heart/heart.js and heart/heart.py

> Read this file fully before touching any code.
> This is a REFACTOR — behaviour must stay identical, only code location changes.
> If any logic changes during extraction, that is a regression. Stop and report it.
> Produce all output files. Do not commit anything. Report results to Claude for review.

---

## What B.O.S.S. is

B.O.S.S. (Biological Operating System) is a resonant routing kernel.
Users send intent pulses into a field of autonomous nodes. The node with
the highest resonance frequency fires. The system is metabolic — nodes
decay when unused and learn from co-activation patterns.

Components:

| Component | Location | Status |
|-----------|----------|--------|
| Soma | `core/index.html` | Active — browser interface, canvas, field physics |
| Cortex | `cortex/cortex.py` | Active — Python server, embeddings, SSE |
| Engine | `engine/engine.js` | Active — shared LLM deliberation module |
| Heart | `heart/heart.js` + `heart/heart.py` | Phase 3 — being extracted NOW |

---

## Architectural locks — NEVER modify these

```
1. score(): warmth × match — MULTIPLICATION, not addition
   thermal = this.warmth * match   ← correct
   thermal = this.warmth + match   ← WRONG

2. Decay: elapsed-time exponential, display-rate independent
   this.warmth *= Math.exp(-decayRate * dt)   ← correct
   dt = (now - this.lastT) / 1000             ← dt must be in seconds
   this.warmth *= 0.995 per frame             ← WRONG, frame-rate dependent

3. Decay rate uses systemVitals.decayRate, not a hardcoded constant
   systemVitals.decayRate is set by initBiometrics() based on battery level

4. vectorBoost: mean-subtracted RELATIVE score (Python cortex only)
   boosts = [s - mean for s in raw_scores]   ← correct

5. Arbiter: TWO-STAGE gate (delta check + dissonance check)
   Both stages must remain in runArbiter() — do not simplify

6. GRIEF_PENALTY = 0.4 — do not change

7. ACTIVE_NODES = new Set(['MEDIA', 'SOMA', 'CHRONOS']) — do not change

8. Cortex URL: localStorage.getItem('BOSS_CORTEX_URL') — never hardcoded

9. Save interval: 30000ms (30 seconds) — do not change

10. Heart must be capable of running without Soma open (background-capable)
    No DOM references allowed in heart.js except the minimum needed for
    the autosave call (which writes to localStorage, not the DOM)
```

---

## Phase 3 task — Heart extraction

### What the Heart is

The Heart is the metabolic rhythm of BOSS — the always-on process that
keeps the field alive between user interactions. Currently its functions
are scattered across index.html and cortex.py. This extraction consolidates
them into two dedicated modules without changing any behaviour.

### What gets extracted from core/index.html → heart/heart.js

Identify and extract these specific functions and calls:

**1. `initBiometrics()`**
The battery monitoring function. Sets `systemVitals.battery`,
`systemVitals.isLowPower`, and `systemVitals.decayRate`.
Currently called once at boot. Move to heart.js.

**2. `saveKernel()`**
Serialises nodes, chain, and timestamp to localStorage under 'BOSS_KERNEL'.
Currently called from firePulse(), recover(), drag handlers, and setInterval.
Move to heart.js.

**3. `loadKernel()`**
Deserialises kernel state from localStorage.
Currently called once at boot before seed().
Move to heart.js.

**4. The autosave setInterval**
Currently at the bottom of the script:
`setInterval(() => { if (nodes.length) saveKernel(); }, 30000);`
Move to heart.js as `Heart.start()`.

**What stays in index.html:**
- The `nodes`, `chain`, `limpMode` state variables (Heart receives these by reference)
- The `Node` class and its `update()` method including the decay formula
  (decay is part of the Field physics, not the Heart)
- The rendering loop
- `firePulse()`, `runArbiter()`, all UI logic
- `systemVitals` object declaration (Heart updates it, Soma reads it)

**The interface after extraction:**
index.html imports heart.js and calls:
```javascript
import { Heart } from './heart/heart.js';
// At boot:
Heart.init(nodes, chain, systemVitals);  // pass state by reference
await Heart.initBiometrics();
const restored = Heart.loadKernel();     // returns { nodes, chain } or null
Heart.start();                           // begins the 30s autosave interval
// In firePulse() and other places that currently call saveKernel():
Heart.save();                            // replaces saveKernel()
```

### What gets extracted from cortex/cortex.py → heart/heart.py

Identify and extract:

**1. `heartbeat_thread` function**
The background thread that monitors for URGENT_ACTION.txt and
pushes SSE events via `_event_queue`.

**2. The `threading.Thread` launch call**
Currently starts heartbeat_thread as a daemon thread at startup.

**What stays in cortex.py:**
- All Flask routes (/handshake, /resonate, /pulse, /remember, /stream)
- The `_event_queue` queue object (Heart pushes to it, /stream reads from it)
- The sentence-transformers model loading
- The WHITELIST and subprocess execution logic

**The interface after extraction:**
cortex.py imports heart.py and calls:
```python
from heart.heart import Heart
Heart.start(_event_queue)   # Heart pushes events to the shared queue
```

heart.py receives the queue and starts its own daemon thread internally.

---

## Output specification

Produce these four files. Do not modify any other files.

### 1. heart/heart.js (new file — overwrite the stub)

```javascript
/**
 * B.O.S.S. Heart — heart/heart.js
 * Metabolic rhythm module. Manages persistence, biometrics, and autosave.
 * Extracted from core/index.html during Phase 3.
 *
 * Interface:
 *   Heart.init(nodes, chain, systemVitals)  — call once at boot
 *   Heart.initBiometrics()                  — async, sets battery state
 *   Heart.loadKernel()                      — returns saved state or null
 *   Heart.save()                            — serialise current state
 *   Heart.start()                           — begin 30s autosave interval
 *   Heart.stop()                            — clear interval (for testing)
 */
```

Then the extracted functions, adapted to use the references passed via init().
The save interval must be exactly 30000ms.
localStorage key for kernel state must remain 'BOSS_KERNEL'.
No DOM references except localStorage.

### 2. heart/heart.py (new file — overwrite the stub)

```python
"""
B.O.S.S. Heart — heart/heart.py
Server-side metabolic loop. Background monitoring and SSE event push.
Extracted from cortex/cortex.py during Phase 3.

Interface:
    Heart.start(event_queue)   — start background daemon thread
    Heart.stop()               — stop thread (for testing)
"""
```

Then the extracted heartbeat_thread logic.
The URGENT_ACTION.txt path must remain identical to the original.
The polling interval must remain identical to the original.
The event format pushed to the queue must remain identical.

### 3. core/index.html (modified)

The four items listed above are removed from the script block.
Replaced with an import of Heart and the interface calls listed above.
Everything else in index.html is byte-for-byte identical.
All architectural locks must still pass.

### 4. cortex/cortex.py (modified)

The heartbeat_thread function and its Thread launch are removed.
Replaced with the import and Heart.start() call listed above.
Everything else in cortex.py is byte-for-byte identical.

---

## Verification checklist

After producing all four files, verify each item:

```
heart.js:
[ ] initBiometrics() present and identical to original
[ ] saveKernel() logic identical — same localStorage key 'BOSS_KERNEL'
[ ] loadKernel() logic identical
[ ] setInterval uses exactly 30000ms
[ ] No DOM references (no document.getElementById, no window.*, no canvas)
[ ] localStorage access is present (this is NOT a DOM dependency)
[ ] Exported as named exports (export const Heart = {...})

heart.py:
[ ] heartbeat_thread logic identical to original
[ ] Queue push format identical
[ ] URGENT_ACTION.txt path identical
[ ] Polling interval identical
[ ] Starts as daemon thread

index.html:
[ ] initBiometrics() call replaced with Heart.initBiometrics()
[ ] saveKernel() call replaced with Heart.save() in all locations
[ ] loadKernel() call replaced with Heart.loadKernel()
[ ] setInterval at bottom replaced with Heart.start()
[ ] Heart imported at top of script block
[ ] systemVitals object still declared in index.html
[ ] Node.update() decay formula unchanged
[ ] All architectural locks still present

cortex.py:
[ ] heartbeat_thread function removed
[ ] threading.Thread launch removed
[ ] Heart import added
[ ] Heart.start(_event_queue) called
[ ] _event_queue still declared in cortex.py
[ ] All Flask routes unchanged
```

Report the verification results alongside the four files.
If any item fails verification, note it explicitly.
Do not commit. Bring all four files and the verification report to Claude.

---

## Regression patterns to watch for

| Pattern | Why wrong |
|---------|-----------|
| Decay formula changed | Must stay Math.exp(-decayRate * dt) with dt in seconds |
| Save interval changed from 30000 | Fixed metabolic rhythm |
| localStorage key changed from 'BOSS_KERNEL' | Breaks existing saved state |
| heartbeat_thread logic changed | SSE events would break |
| heart.js references document or window | Breaks background/non-browser use |
| Node.update() moved to heart.js | Decay is Field physics, not Heart |
| systemVitals moved to heart.js | Soma reads it directly, must stay in index.html |
| Any Flask route modified | Out of scope for this phase |
