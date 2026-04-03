# B.O.S.S. — Agent Session Brief (BOSS_CONTEXT.md)
**Repo:** https://github.com/nztdev/boss-kernel
**Current phase:** Phase 0 — Foundation audit and lock
**Current task:** See session brief below

> This file travels with every Antigravity session.
> Read it before touching any code. Update the phase
> and task sections at the start of each new session.

---

## What B.O.S.S. is

B.O.S.S. (Biological Operating System) is a resonant routing kernel.
Instead of calling AI models directly, users send an **intent pulse**
into a field of autonomous nodes. The node with the highest resonance
frequency fires. The system is model-agnostic, self-organising, and
metabolic — nodes decay when unused and learn from co-activation.

The system has three primary components and one shared engine module:

| Component | Location | Role |
|-----------|----------|------|
| Soma | `core/index.html` | Browser interface, canvas, field physics, PWA |
| Cortex | `cortex/cortex.py` | Python server, embeddings, SSE, system actions |
| Engine | `engine/engine.js` | Shared LLM deliberation module, model-agnostic |
| Heart | not yet extracted | Metabolic loop (Phase 3 work item) |

There is also a standalone product in a separate repo (`boss-deliberation`)
built on the engine module — not present in this repo.

---

## Architectural locks
**These must never be modified without explicit approval.
Any PR or generated code that violates these is a regression.**

```
1. score(): warmth × match — MULTIPLICATION, not addition
   thermal = this.warmth * match   ← correct
   thermal = this.warmth + match   ← WRONG, regression

2. Decay: elapsed-time exponential, display-rate independent
   this.warmth *= Math.exp(-decayRate * dt)   ← correct
   this.warmth *= 0.995                        ← WRONG, frame-rate dependent

3. vectorBoost: mean-subtracted RELATIVE score, not raw cosine
   boosts = [s - mean for s in raw_scores]   ← correct (Python)
   boosts = raw_scores                        ← WRONG, inflates all nodes equally

4. Arbiter: TWO-STAGE gate
   Stage 1: delta < confThreshold (proximity check)
   Stage 2: 1 - sim(top.specialty, second.specialty) > DISSONANCE_CUT
   Both stages required. One stage alone is a regression.

5. Active-First tier-breaker in runArbiter():
   If one node is in ACTIVE_NODES and the other is not,
   and delta < 0.2, the Active node wins without dissonance check.

6. GRIEF_PENALTY = 0.4 (not 0.1)
   0.1 was a temporary testing value. Production value is 0.4.

7. Cortex URL: configurable at runtime, never hardcoded
   localStorage.getItem('BOSS_CORTEX_URL')   ← correct
   const CORTEX_ENDPOINT = "https://..."     ← WRONG, breaks all forks

8. engine.js: no DOM dependencies
   Must import and run in any JS environment.
   No document, window, or localStorage references inside engine.js.

9. Subprocess: no shell=True, absolute paths only
   subprocess.Popen(WHITELIST[name])         ← correct
   subprocess.Popen(["chrome.exe"], shell=True) ← WRONG, security risk
```

---

## Component details

### Soma (core/index.html)

**Six hexagonal nodes** (v0.6 seed):

| Node | Color | Specialty (pruned — each keyword belongs to ONE node only) | Has action |
|------|-------|-------------------------------------------------------------|-----------|
| CORE | #00ffcc | health battery power hardware reboot uptime diagnostics integrity status system | No |
| SOMA | #ff66aa | identity self who appearance theme interface color look feel ui somatic body | Yes |
| CORTEX | #cc00ff | logic reason analyse evaluate intelligence decide process think infer meaning | No |
| MEMORY | #66aaff | recall retrieve store archive records data vault note save find past logs | No |
| MEDIA | #00F0FF | audio music play sound frequency volume track song speaker playback listen | Yes |
| CHRONOS | #ffaa00 | time schedule clock calendar timer alarm duration routine when last history | Yes |

**Active node tier** (for Active-First tie-breaker):
```javascript
const ACTIVE_NODES = new Set(['MEDIA', 'SOMA', 'CHRONOS']);
```

**Three-tier threshold** (in firePulse(), after scoring):
- `maxMatch < 0.15` → birth signal logged (unknown intent)
- `maxMatch < 0.50` → limp mode (no ignition, kernel dims)
- `maxMatch < 0.80` → dialogue mode (Arbiter gates)
- `maxMatch >= 0.80` → ignite directly (skip Arbiter)

**Scoring formula:**
```
freq = (warmth × semanticMatch)           thermal, intent-gated
     + resonance × (1 + 0.3·sin(2πr))    standing wave
     + bondSignal × 2                     synaptic gradient (4-hop lookback, 0.6 decay)
     + vectorBoost × 2.0                  relative cortex signal (0 when offline)
```

**Key constants:**
```javascript
const BASE_DECAY     = 0.05;
const BOND_DECAY_K   = 0.6;
const BOND_LOOKBACK  = 4;
const GRIEF_PENALTY  = 0.4;    // NOT 0.1
const DISSONANCE_CUT = 0.55;
const VECTOR_WEIGHT  = 2.0;
const BIRTH_THRESHOLD = 0.15;
let   confThreshold  = 1.5;
```

**Cortex URL (must be runtime-configurable):**
```javascript
function pcUrl() {
  const stored = localStorage.getItem('BOSS_CORTEX_URL') || '';
  if (!stored) return null;
  if (/^\d{1,3}\.\d{1,3}/.test(stored)) return `http://${stored}:5000`;
  return stored.replace(/\/$/, '');
}
```

**Service worker** (`core/sw.js`):
- Cache-first for shell assets
- Network-first (never cached) for any URL containing `:5000`

---

### Cortex (cortex/cortex.py)

**Endpoints:**
- `GET /handshake` — health check, returns identity and model name
- `POST /resonate` — returns mean-subtracted relative vector boosts
- `POST /pulse` — intent routing, memory search, secure execute
- `POST /remember` — ingest text into server-side memory pool
- `GET /stream` — SSE proactive events, keepalive every 15s

**Subprocess whitelist** — absolute paths only, no shell=True:
```python
WHITELIST: dict[str, list[str]] = {
    "chrome": [r"C:\Program Files\Google\Chrome\Application\chrome.exe"],
    "notepad": [r"C:\Windows\System32\notepad.exe"],
}
```

**Required imports at top level:**
```python
import os        # was missing in an earlier version — must be present
import time
import queue
import threading
from pathlib import Path
```

---

### Engine (engine/engine.js)

Shared deliberation module. Imported by both the BOSS integration
layer and the standalone PWA. No DOM dependencies.

**Three-model default pool (zero budget):**
- Tier 1A: Groq (llama-3.1-8b-instant) — fastest, free
- Tier 1B: Gemini Flash (gemini-1.5-flash-latest) — free, capable
- Tier 2: Mistral via HuggingFace (Mistral-7B-Instruct-v0.3) — free, tiebreaker

**Pipeline:** score pool → call T1A + T1B in parallel → measure output
dissonance → early exit if agree (< 0.35) → escalate to T2 if conflict
(> 0.60) → T2 tiebreaks → synthesise → return DelibeResult.

**LLM specialty strings (subject to iteration in Phase 1):**
```
Groq:    fast factual retrieval summarisation clear explanation general knowledge question answer
Gemini:  reasoning analysis multimodal context synthesis creative writing nuanced understanding
Mistral: code generation technical explanation structured output logical reasoning european languages
```

---

## Regression patterns to watch for

These are the specific mistakes that have occurred in past sessions.
Flag immediately if any generated code contains these patterns:

| Pattern | Why it's wrong |
|---------|---------------|
| `thermal = warmth + match` | Additive — intent no longer gates energy |
| `warmth *= 0.995` or `warmth *= (1 - DECAY)` per frame | Frame-rate dependent cooling |
| `const CORTEX_ENDPOINT = "https://..."` hardcoded | Breaks all forks, expires on Codespaces |
| `GRIEF_PENALTY = 0.1` | Testing value, not production |
| Single-stage Arbiter (delta only, no dissonance check) | False grief on close-but-compatible nodes |
| `subprocess.Popen([name], shell=True)` | Command injection risk |
| `boosts = raw_scores` (not mean-subtracted) | Inflates all nodes uniformly |
| `shell=True` anywhere in cortex.py | Security regression |
| DOM references in engine.js | Breaks non-browser import |

---

## Repository structure (current)

```
boss-kernel/
├── core/
│   ├── index.html      ← Soma (v0.6 hexagonal kernel)
│   ├── sw.js           ← Service worker
│   └── manifest.json   ← PWA manifest
├── cortex/
│   ├── cortex.py       ← Python cortex server
│   └── requirements.txt
├── engine/
│   ├── engine.js       ← Shared deliberation engine
│   └── test.html       ← Engine test harness
├── docs/
│   ├── BOSS_CONTEXT.md ← This file
│   ├── ROADMAP.md      ← Full development roadmap
│   ├── ARCHITECTURE.md ← Technical deep-dive (needs v0.6 update)
│   └── PHILOSOPHY.md   ← Conceptual lineage
├── .gitignore
├── LICENSE             ← MIT
├── philosophy.md       ← (legacy, to be merged into docs/)
└── readme.md           ← (needs v0.6 update)
```

---

## Development roadmap (summary)

Full detail in `docs/ROADMAP.md`. Current position: **Phase 0**.

```
Phase 0  — Foundation audit and lock          ← CURRENT
Phase 1  — Engine module validation
Phase 2  — Deliberation Layer PWA
Phase 3  — Heart extraction
Phase 4  — Semantic seed iteration (Soma)
Phase 5  — Cortex hardening
Phase 6  — BOSS integration
Phase 7  — PWA → native wrap
Phase 8  — Future components (design + stub)
Phase 9  — v1.0 stabilisation and release
```

---

## Phase 0 session task (current)

**Objective:** Audit the repository against the Phase 0.1 checklist.
Do not modify any files. Report only.

**Instructions:**
Clone `https://github.com/nztdev/boss-kernel` and inspect the files.
For each item below report: **PASS**, **FAIL**, or **NOT FOUND**.
If FAIL: quote the exact failing line(s) and state what the correct
value should be, referencing this context document.

**Checklist:**

```
CORE/INDEX.HTML
 1. GRIEF_PENALTY = 0.4 (not 0.1 or any other value)
 2. score() uses warmth * match (multiplication, not addition or any other operator)
 3. Decay uses Math.exp(-rate * dt) where dt is elapsed seconds (not per-frame multiply)
 4. Arbiter has two-stage gate: Stage 1 delta check AND Stage 2 dissonance check
 5. ACTIVE_NODES set is defined and contains MEDIA, SOMA, CHRONOS
 6. Active-First tier-breaker is present in runArbiter()
 7. Cortex URL is read from localStorage.getItem('BOSS_CORTEX_URL') — not hardcoded
 8. Hexagonal seed has exactly 6 nodes: CORE, SOMA, CORTEX, MEMORY, MEDIA, CHRONOS
 9. CHRONOS has an entry in ACTION_MAP with a callback function
10. MEDIA has an entry in ACTION_MAP with a callback function
11. SOMA has an entry in ACTION_MAP with a callback function
12. Birth signal threshold check is present (maxMatch < BIRTH_THRESHOLD)
13. Three-tier threshold logic is present (limp / dialogue / ignite paths)

CORE/SW.JS
14. Network-first (not cached) for requests containing ':5000'
15. Cache-first for shell assets (index.html, manifest.json, sw.js)

CORTEX/CORTEX.PY
16. 'import os' is present at top level
17. WHITELIST uses absolute paths (not bare exe names like 'chrome.exe')
18. No shell=True in any subprocess call anywhere in the file
19. /resonate endpoint performs mean-subtraction on cosine scores
20. SSE /stream endpoint sends keepalive comment every 15 seconds

ENGINE/ENGINE.JS
21. File exists at engine/engine.js
22. No document, window, or localStorage references inside engine.js
23. deliberate() function is exported
24. buildDefaultPool() function is exported

DOCS/
25. docs/ROADMAP.md exists

.GITIGNORE
26. __pycache__/ is excluded
27. *.pyc is excluded
28. venv/ is excluded
29. .env is excluded
30. models/ is excluded

LICENCE
31. LICENSE file is MIT
```

**After reporting:** Do not fix anything. Bring the filled checklist
back to Claude (claude.ai conversation) for review and fix generation.
```

---

## How to update this file

At the start of each new phase, update:
1. **Current phase** and **current task** at the top
2. The **Phase X session task** section at the bottom
3. Any component details that changed during the previous phase

Commit the updated file before starting the Antigravity session.
The file should always reflect the *current* state of the project,
not the target state.
