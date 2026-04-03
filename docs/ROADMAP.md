# B.O.S.S. — Complete Development Roadmap
## Biological Operating System · Holistic Plan to v1.0

**Document status:** Living reference. Update after each phase completion.
**Sequencing principle:** Completeness over speed. Each phase produces a
stable foundation for the next. No component is marked done until it is
tested, documented, and its interfaces are locked.

---

## Repository structure (target)

```
boss-kernel/                     ← monorepo, GitHub public
├── core/                        ← Soma (index.html, sw.js, manifest.json)
├── cortex/                      ← Cortex (cortex.py, requirements.txt)
├── engine/                      ← Deliberation engine (engine.js)
├── heart/                       ← Heart module (heart.js, heart.py)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PHILOSOPHY.md
│   ├── COMPONENT_MAP.svg
│   └── BOSS_CONTEXT.md          ← Antigravity/agent session brief (updated each phase)
├── .gitignore
├── LICENSE                      ← MIT
└── README.md                    ← Manifesto + quick start

boss-deliberation/               ← separate repo, standalone PWA
├── engine/                      ← symlink or copy of engine.js
├── app/                         ← PWA interface
├── docs/
└── README.md
```

---

## Phase overview

```
Phase 0  — Foundation audit and lock             [current state → stable base]
Phase 1  — Engine module validation              [engine.js → tested]
Phase 2  — Deliberation Layer PWA                [standalone product → testable]
Phase 3  — Heart extraction and formalisation    [metabolic loop → its own module]
Phase 4  — Semantic seed iteration (Soma)        [BOSS kernel routing → reliable]
Phase 5  — Cortex hardening                      [Python backend → production-ready]
Phase 6  — BOSS integration                      [all components wired together]
Phase 7  — PWA → native wrap                    [both products → installable apps]
Phase 8  — Future components (design + stub)     [Nervous System, Immune, Sensory, Registry]
Phase 9  — v1.0 stabilisation and release        [documentation, testing, GitHub release]
```

---

## Phase 0 — Foundation audit and lock
**Objective:** Ensure everything built so far is coherent, consistent,
and committed before new work is layered on top.
**Owner:** Claude + you
**Antigravity role:** None yet

### 0.1 — Code audit
- [ ] Verify `core/index.html` contains v0.6 hexagonal seed with pruned specialties
- [ ] Verify `core/index.html` GRIEF_PENALTY = 0.4 (not 0.1 testing value)
- [ ] Verify `core/index.html` Arbiter has two-stage gate + Active-First tier-breaker
- [ ] Verify `core/index.html` Cortex URL is configurable (not hardcoded Codespaces URL)
- [ ] Verify `core/index.html` score() uses warmth × match (not warmth + match)
- [ ] Verify `core/sw.js` excludes :5000 calls from cache
- [ ] Verify `cortex/cortex.py` WHITELIST uses absolute paths (not bare exe names)
- [ ] Verify `cortex/cortex.py` has import os (was missing)
- [ ] Verify `engine/engine.js` is committed as new file

### 0.2 — Documentation sync
- [ ] Update `docs/ARCHITECTURE.md` to reflect v0.6 hexagonal node structure
- [ ] Update `docs/ARCHITECTURE.md` scoring formula to include bond signal (was missing)
- [ ] Update `docs/ARCHITECTURE.md` three-tier threshold section (Limp/Dialogue/Ignite)
- [ ] Commit component map SVGs to `docs/`
- [ ] Create `docs/BOSS_CONTEXT.md` — the Antigravity session brief (template below)

### 0.3 — Architectural locks committed to README
Document these permanently so contributors cannot break them:
```
ARCHITECTURAL LOCKS (non-negotiable, review any PR that touches these):
1. score(): warmth × match — multiplication not addition
2. Decay: elapsed-time exponential, not per-frame multiplication
3. vectorBoost: mean-subtracted relative score, not raw cosine
4. Arbiter: two-stage (delta gate → dissonance check), not single condition
5. Cortex: oracle not decision-maker (returns boosts, kernel decides)
6. Heart: must function without Soma open (background process capable)
7. engine.js: no DOM dependencies, importable anywhere
```

### 0.4 — GitHub hygiene
- [ ] Verify .gitignore excludes: `__pycache__/`, `*.pyc`, `venv/`, `.env`,
      `models/`, `*.json` local state files, `BOSS_KERNEL_BACKUP.json`
- [ ] Verify LICENSE is MIT
- [ ] README includes quick-start for Soma-only (open index.html) and
      full-cortex (python cortex.py + open index.html)

**Phase 0 exit criterion:** Every item above is checked. The codebase
is exactly what it claims to be. No silent regressions.

---

## Phase 1 — Engine module validation
**Objective:** Confirm engine.js routes correctly, escalates correctly,
and the specialty strings produce sensible model selection.
**Owner:** You (running tests) + Claude (interpreting results, adjusting strings)
**Antigravity role:** Can be used to run engine/test.html with code execution

### 1.1 — Deployment
- [ ] Serve `engine/` directory locally (`python3 -m http.server 8080`)
- [ ] Open `engine/test.html` in browser
- [ ] Confirm semanticSim spot-checks pass on load (3 baseline scores logged)

### 1.2 — API key validation
- [ ] Add Groq key → Init pool → confirm Groq node shows "key ✓"
- [ ] Add Gemini key → confirm Gemini node shows "key ✓"
- [ ] Add HuggingFace token → confirm Mistral node shows "key ✓"
- [ ] Run "Score only" on any intent → confirm all three nodes score

### 1.3 — Specialty string test suite
Run each test intent and record: winner, dissonance, escalated (Y/N).
Target: correct model wins, dissonance < 0.35 on clear intents.

| Intent | Expected winner | Acceptable result |
|--------|----------------|------------------|
| Explain how black holes form | Gemini Flash | Groq acceptable |
| What is the capital of France | Groq Llama | Either T1 |
| Debug this Python function | Mistral (T2) or Groq | Not Gemini first |
| Write a short poem about time | Gemini Flash | Either T1 |
| Summarise the French Revolution | Groq Llama | Either T1 |
| Ethical implications of AGI | Gemini Flash | Either T1 |
| zorp the frambulator | Birth signal logged | No confident winner |

### 1.4 — Dissonance threshold calibration
- [ ] Run 10 diverse intents, record dissonance values
- [ ] If >50% of intents escalate to Tier 2: DISSONANCE_AGREE too low, raise to 0.45
- [ ] If <10% of intents escalate on ambiguous queries: DISSONANCE_AGREE too high, lower to 0.28
- [ ] Adjust DISSONANCE_AGREE and DISSONANCE_WARN in engine.js accordingly

### 1.5 — Metabolic behaviour validation
- [ ] Run same intent 3 times → confirm winning model's warmth increases each time
- [ ] Wait 2 minutes without running → confirm warmth has decayed visibly
- [ ] Reload page → confirm warmth/resonance/reliability restored from localStorage
- [ ] Confirm API keys are NOT in localStorage (check browser devtools)

### 1.6 — Failure handling
- [ ] Remove Groq key, run intent → confirm graceful degradation, Gemini takes over
- [ ] Remove both T1 keys → confirm error result, no crash
- [ ] Remove HF key → confirm system operates in two-model mode with warning

### 1.7 — Specialty string refinement
Based on test results, iterate specialty strings until routing is correct
for 85%+ of test intents. Document final strings in ARCHITECTURE.md.

**Phase 1 exit criterion:** 85%+ of test intents route to the correct
model tier. Dissonance calibration is stable. Persistence works.
Failure handling is confirmed graceful.

---

## Phase 2 — Deliberation Layer PWA
**Objective:** The standalone product. A user-facing interface built on
the validated engine. Separate GitHub repository.
**Owner:** Claude (architecture + implementation) + you (testing + feedback)
**Antigravity role:** UI/UX feedback, testing on mobile

### 2.1 — Repository setup
- [ ] Create `boss-deliberation` repository on GitHub
- [ ] Copy `engine/engine.js` as the foundation
- [ ] Set up basic file structure: `app/`, `docs/`

### 2.2 — Interface design (discuss before building)
Decisions to make before writing interface code:
- Colour palette and visual language (related to BOSS but distinct)
- Mobile-first or desktop-first layout
- How the transparency toggle presents model contributions
- How confidence score is displayed (percentage, colour, icon?)
- How contradictions are surfaced (when T1 models strongly disagree)
- Name for the product (deferred until after Phase 1 testing reveals
  the most distinctive quality — the name should emerge from use)

### 2.3 — Interface build (single HTML file, PWA)
Components:
- [ ] Intent input + submit
- [ ] Response display area with synthesised output
- [ ] Confidence indicator
- [ ] Transparency panel (toggle): shows each model's contribution,
      latency, individual response preview, dissonance measurement
- [ ] Model pool configuration: API key entry per model, active/inactive toggle
- [ ] Session log: recent intents and winners (localStorage)
- [ ] Cortex URL configuration (optional, for BOSS integration later)

### 2.4 — PWA capability
- [ ] manifest.json with correct icons, theme colour, display: standalone
- [ ] sw.js: cache shell offline, network-first for API calls
- [ ] Test "Add to Home Screen" on iOS and Android

### 2.5 — Closed circle testing
- [ ] Deploy to GitHub Pages (static, no server required)
- [ ] Share with 3–5 trusted testers
- [ ] Collect: which intents produce surprising model selections,
      which dissonance scores feel wrong, latency perceptions,
      UI clarity on the transparency toggle
- [ ] Iterate specialty strings based on real usage patterns

### 2.6 — PWA stabilisation
- [ ] Error states handled visibly (not silent failures)
- [ ] Rate limiting: debounce input, prevent rapid-fire API calls
- [ ] Offline state: graceful message when all models unreachable
- [ ] Input validation: empty intent, extremely long intent

**Phase 2 exit criterion:** The PWA works reliably on mobile and
desktop. Closed-circle testers can use it without instruction.
The transparency toggle correctly shows all model contributions.
Ready for native wrapping (deferred to Phase 7).

---

## Phase 3 — Heart extraction and formalisation
**Objective:** Consolidate the scattered metabolic functions into a
dedicated Heart module. Make the rhythm explicit and testable.
**Owner:** Claude (implementation) + you (review)
**Antigravity role:** Can run extraction and verify no regressions

### 3.1 — Audit scattered Heart functions
Identify every line currently doing Heart work:
- `setInterval` in `core/index.html`
- `saveKernel()` calls scattered throughout `firePulse()`
- `heartbeat_thread` in `cortex/cortex.py`
- `autoSave` timer in `index.html`

### 3.2 — heart.js (client-side)
```javascript
// heart/heart.js
// Responsibilities:
//   - Metabolic decay loop (elapsed-time, display-rate independent)
//   - Bond normalisation (gentle downward pressure prevents accumulation)
//   - Vault maintenance (prune entries above cap)
//   - Periodic save to localStorage
//   - HeartBeat event emission (for Nervous System, Phase 8)
//   - Resurrection floor (prevents nodes dying permanently from grief)
```
- [ ] Extract and centralise all metabolic functions
- [ ] Remove scattered setInterval calls from index.html
- [ ] Import heart.js into index.html, call Heart.start(field)
- [ ] Verify decay behaviour is unchanged after extraction

### 3.3 — heart.py (server-side)
```python
# heart/heart.py
# Responsibilities:
#   - Downloads watchdog (replace polling with watchdog library)
#   - System event detection (URGENT_ACTION.txt flag)
#   - SSE event push via _event_queue
#   - Proactive pulse scheduling
```
- [ ] Extract heartbeat_thread from cortex.py into heart.py
- [ ] Replace 30s polling with watchdog.observers.Observer
      (inotify on Linux, FSEvents on macOS, ReadDirectoryChanges on Windows)
- [ ] cortex.py imports and starts Heart, no longer contains metabolic logic

### 3.4 — Validation
- [ ] Confirm decay still works identically after extraction
- [ ] Confirm SSE events still fire correctly
- [ ] Confirm localStorage saves still happen on schedule
- [ ] Confirm watchdog fires on new Downloads file (faster than 30s poll)

**Phase 3 exit criterion:** Heart functions are consolidated in dedicated
files. No metabolic logic remains scattered. Behaviour is identical to
pre-extraction. Watchdog fires in under 2 seconds on file creation.

---

## Phase 4 — Semantic seed iteration (Soma / BOSS Kernel)
**Objective:** BOSS kernel routes correctly on 90%+ of test intents
without triggering false grief or incorrect clarification toasts.
**Owner:** You (running tests on Antigravity) + Claude (seed adjustments)
**Antigravity role:** Primary — run test suite, report results

### 4.1 — Test environment setup
- [ ] Load v0.6 index.html with full test suite from the test document
      (25 test cases across 6 groups)
- [ ] Confirm console logging is active (all clog calls visible)
- [ ] Set confThreshold = 1.5 (default, not modified)

### 4.2 — Group 1: Previous grief cases (target: all IGNITE)
Run each test, record: winner node, whether Arbiter fired, result type.
- [ ] "play some heavy bass" → MEDIA
- [ ] "analyse audio frequency" → MEDIA (Active-First over CORTEX)
- [ ] "system health interface" → CORE (record which wins)
- [ ] "who am I" → SOMA
- [ ] "who am I in the records" → SOMA or MEMORY (TOAST acceptable)

### 4.3 — Group 2: Soft conflicts (target: IGNITE or acceptable TOAST)
- [ ] "is the battery history normal" → CORE
- [ ] "recall last entry from 3 hours ago" → MEMORY
- [ ] "analyse the origin of Jesus" → CORTEX
- [ ] "what happened at 5 PM" → CHRONOS

### 4.4 — Group 3: Clean single-node (target: all IGNITE instantly)
All ten tests from the suite. Any GRIEF here is a critical failure.

### 4.5 — Group 4: Active-First validation
- [ ] "analyse the music" → MEDIA wins over CORTEX
- [ ] "check the schedule health" → CHRONOS or CORE (record delta)
- [ ] "logic of sound" → MEDIA or TOAST if delta > 0.2
- [ ] "identity timer" → TOAST (genuinely ambiguous)

### 4.6 — Group 5: Birth Protocol (target: BIRTH SIGNAL logged)
- [ ] "zorp the frambulator" → birth signal in console
- [ ] "xkcd" → birth signal
- [ ] "check my emails" → observe whether MEMORY or CORTEX picks it up

### 4.7 — Group 6: Threshold validation
- [ ] Temporarily set confThreshold = 3.0 in console
- [ ] Run "uh" → max match should be < 0.15
- [ ] Run "play" → MEDIA should IGNITE cleanly above 0.5

### 4.8 — Iteration
For each failure: identify the conflicting keyword, remove it from
the wrong node's specialty, add a distinctive synonym to the correct
node. Rerun the affected tests. Repeat until Group 1 and Group 3
pass 100%, Group 2 passes with acceptable TOAST.

### 4.9 — Document final specialty strings
Commit final seed strings to ARCHITECTURE.md with the keyword
ownership map (each significant word belongs to exactly one node).

**Phase 4 exit criterion:** Groups 1, 3, 4 pass 100% as IGNITE.
Group 2 produces only IGNITE or acceptable TOAST (no GRIEF).
Group 5 logs birth signal correctly. Final seeds committed.

---

## Phase 5 — Cortex hardening
**Objective:** The Python cortex is production-grade: handles errors
gracefully, logs usefully, is configurable without editing source,
and is deployable beyond localhost.
**Owner:** Claude (implementation) + you (review)
**Antigravity role:** Can test endpoint behaviour

### 5.1 — Configuration via environment variables
Replace hardcoded values with env vars:
```python
BOSS_PORT    = int(os.getenv('BOSS_PORT', '5000'))
BOSS_MODEL   = os.getenv('BOSS_MODEL', 'all-MiniLM-L6-v2')
BOSS_WATCH   = os.getenv('BOSS_WATCH', str(Path.home() / 'Downloads'))
BOSS_ORIGINS = os.getenv('BOSS_ORIGINS', 'http://localhost,null').split(',')
```
- [ ] All configurable values use os.getenv with sensible defaults
- [ ] Document all env vars in a `cortex/.env.example` file

### 5.2 — Error handling and logging
- [ ] All endpoints return structured JSON on error:
      `{ "error": "description", "code": "ERROR_CODE" }`
- [ ] Replace print() with Python logging module
      (configurable level: DEBUG / INFO / WARNING)
- [ ] 404 and 405 handlers return JSON (not Flask HTML error pages)
- [ ] Model load failure is caught and returns useful error

### 5.3 — /analyze endpoint (new — LLM deliberation for ambiguous intents)
This is the endpoint Gemini proposed for v1.0 — the cortex queries an
external LLM when local similarity is insufficient.
```python
@app.route('/analyze', methods=['POST'])
def analyze():
    # Input: { intent, node_specs: [{name, specialty}], confidence_scores }
    # Called when: Arbiter fires + confidence < 0.5
    # Calls: external LLM API (configurable: Groq, Gemini, Anthropic)
    # Returns: { suggested_node, confidence, reasoning }
    # Note: this is an advisory signal — kernel still decides
```
- [ ] Implement /analyze with configurable LLM backend
- [ ] Wire Soma to call /analyze when Arbiter fires and delta < 0.6
- [ ] Soma uses returned suggestion as an additional scoring signal,
      not a direct override

### 5.4 — Deployment documentation
- [ ] Document local deployment (python cortex.py)
- [ ] Document Codespaces deployment (current working method)
- [ ] Document VPS deployment (nginx reverse proxy + gunicorn)
- [ ] Document CORS configuration for each deployment type
- [ ] Security note: never expose cortex to public internet without auth

### 5.5 — Rate limiting
- [ ] Add Flask-Limiter to /resonate and /analyze endpoints
      (prevent accidental hammering from Soma reconnects)
- [ ] Configurable via env var: `BOSS_RATE_LIMIT=60/minute`

**Phase 5 exit criterion:** All endpoints return structured JSON.
/analyze is implemented and wired to Soma. Deployment docs exist
for three deployment targets. Rate limiting is active.

---

## Phase 6 — BOSS integration
**Objective:** All components work together as a unified system.
Soma → Heart → Field → Arbiter → Cortex → Deliberation Engine.
**Owner:** Claude (integration architecture) + you (integration testing)
**Antigravity role:** End-to-end integration testing

### 6.1 — Engine integration into Soma
The Deliberation Engine (engine.js) is imported by Soma and used
when the Arbiter surfaces a conflict with confidence < 0.5.
- [ ] Import engine.js as ES module in index.html
- [ ] Wire runArbiter() to call deliberate() when appropriate:
      soft conflict + passive nodes → engine deliberates → result
      feeds back as a weighted scoring signal, not a direct override
- [ ] Confirm kernel physics are not bypassed by engine integration

### 6.2 — Synaptic persistence upgrade
- [ ] Implement BOSS_INTENT_MAP in localStorage:
      user Dialogue choices saved as { intentWord: nodeId }
- [ ] On pulse, check BOSS_INTENT_MAP before scoring:
      known preference → boost that node's score by 0.4
- [ ] Dialogue choices update BOSS_INTENT_MAP
- [ ] Separate from bond weights (different signal, same storage)

### 6.3 — Threshold system formalisation
Implement the three-tier threshold cleanly:
```javascript
// In firePulse(), after scoring:
const maxMatch = Math.max(...scored.map(s => s.match));
if (maxMatch < 0.15) → birth signal (already implemented)
if (maxMatch < 0.50) → limp mode (kernel dims, no ignition)
if (maxMatch < 0.80) → dialogue mode (Arbiter gates)
if (maxMatch >= 0.80) → ignite directly (skip Arbiter entirely)
```
- [ ] Implement cleanly, test all four paths
- [ ] Limp mode: dim canvas visually, show "intent unclear" message
- [ ] High-confidence path: skip Arbiter for clean, fast UX

### 6.4 — CHRONOS action implementation
Give CHRONOS a real action callback:
- [ ] Timer/countdown: "set a 10-minute focus timer" → visual ring
- [ ] Alarm: "remind me in 5 minutes" → setTimeout + Notification API
- [ ] Permission request for Notifications if not granted

### 6.5 — SOMA action implementation
Give SOMA real theme-switching capability:
- [ ] "go dark" / "go light" → CSS variable overrides
- [ ] "change accent to [colour]" → dynamic --glow variable update
- [ ] Theme state persisted to localStorage

### 6.6 — End-to-end integration test
Run the full test suite with Cortex online:
- [ ] All Phase 4 tests still pass with Cortex connected
- [ ] /analyze endpoint is called on ambiguous intents (check logs)
- [ ] Engine deliberation fires correctly when Arbiter conflicts
- [ ] Heart module maintains metabolic state correctly throughout
- [ ] SSE events from Cortex correctly ignite target nodes

**Phase 6 exit criterion:** Full system operates correctly with all
components connected. All Phase 4 tests pass. Engine integration
does not regress kernel routing. Themes switch. Timers work.

---

## Phase 7 — PWA to native wrap
**Objective:** Both products (BOSS and Deliberation Layer PWA) are
installable as native apps on iOS and Android.
**Owner:** Claude (Capacitor setup) + you (device testing)
**Antigravity role:** Can generate Capacitor configuration

### 7.1 — Deliberation Layer PWA → native (first, simpler)
- [ ] Install Capacitor: `npm install @capacitor/core @capacitor/cli`
- [ ] Initialise: `npx cap init`
- [ ] Add platforms: `npx cap add ios`, `npx cap add android`
- [ ] Configure `capacitor.config.json` with app ID and name
- [ ] Test on Android (easier to sideload without App Store)
- [ ] Add native haptics via `@capacitor/haptics` for pulse feedback
- [ ] Test on iOS (requires Apple Developer account for device testing)

### 7.2 — BOSS Kernel → native
Same process, with additional native capabilities:
- [ ] `@capacitor/local-notifications` for CHRONOS alarms
- [ ] `@capacitor/haptics` for somatic feedback
- [ ] Background mode configuration for Heart process
- [ ] File system access for Action Bridge (local file operations)

### 7.3 — Distribution documentation
- [ ] Document how to build and sideload on Android (APK)
- [ ] Document how to build for iOS (requires Xcode + Apple Developer)
- [ ] For the Deliberation Layer: document GitHub Pages as the
      primary distribution channel (PWA, no install required)

**Phase 7 exit criterion:** Both products install and run correctly
on an Android device. iOS builds without errors. Native haptics
work. CHRONOS notifications fire on mobile.

---

## Phase 8 — Future components (design + stub)
**Objective:** Design the four v2+ components precisely enough that
they can be implemented without architectural retrofitting.
Create stub files and document interfaces.
**Owner:** Claude (architecture design)
**Antigravity role:** Design review

### 8.1 — Nervous System
**What it is:** The typed event bus connecting all components.
Currently components communicate through localStorage and HTTP.
The Nervous System formalises this into a message-passing protocol.

**Design:**
```javascript
// nervous-system.js
// Events:
//   NODE_FIRED         { nodeId, intent, score, timestamp }
//   NODE_GRIEVED       { nodeId, resonance, reason }
//   FIELD_LIMP         { reason }
//   HEART_BEAT         { timestamp, totalWarmth, meanResonance }
//   VAULT_UPDATED      { count, lastEntry }
//   DELIBERATION_DONE  { intent, winner, confidence, dissonance }
//   BIRTH_SIGNAL       { intent, maxMatch }
//   SSE_EVENT          { nodeName, message }
```
- [ ] Document all event types and payloads
- [ ] Create stub `nervous-system.js` with EventTarget base
- [ ] Document migration path from current localStorage coupling

### 8.2 — Immune System
**What it is:** Long-term reliability tracking per node and per model.
Currently grief is session-local. The Immune System maintains
cross-session health records.

**Design:**
```javascript
// immune.js
// Per node: { nodeId, griefCount, ignitCount, reliabilityScore, lastUpdated }
// Per model: same structure
// Reliability score: starts at 1.0, decays slowly on grief,
//   recovers slowly on ignition, floors at 0.1
// Used by: scoring formula (reliability multiplier already in engine.js)
```
- [ ] Document data structure
- [ ] Create stub `immune.js`
- [ ] Define how Immune feeds into scoring (already stubbed in engine.js)

### 8.3 — Sensory Layer
**What it is:** Input processing beyond text. Voice, camera, GPS,
accelerometer. Converts raw sensor data into structured intent.

**Design:**
- Voice: Web Speech API → text → pulse (browser-native, no server)
- Camera: not in scope for v1.0 but interface defined
- GPS: location context appended to intent metadata
- Accelerometer: shake gesture → pulse (mobile)

- [ ] Document intent metadata structure (intent + context + source)
- [ ] Create stub `sensory.js` with Web Speech API voice input
- [ ] Define how Sensory events enter the pulse pipeline

### 8.4 — Registry
**What it is:** A shareable catalogue of node and model definitions.
Enables the community to publish and install pre-tuned nodes.

**Design:**
```json
{
  "node": {
    "name": "MEDIC",
    "specialty": "medical health symptom diagnosis wellness treatment",
    "tier": "functional",
    "resonance": 1.5,
    "author": "username",
    "version": "1.0.0",
    "tested_against": ["who am I", "health check"]
  }
}
```
- [ ] Document node definition schema (JSON)
- [ ] Document model definition schema (JSON)
- [ ] Define import/export format for Registry entries
- [ ] Create stub `registry.js` with local import/export
- [ ] Plan: community Registry as a GitHub-hosted JSON file
      (simple, no backend required, PR-based contributions)

**Phase 8 exit criterion:** All four components have documented
interfaces, stub files, and clear migration paths from current
implementation. No code is broken. Future contributors have a
precise specification to build against.

---

## Phase 9 — v1.0 stabilisation and release
**Objective:** Everything is tested, documented, and ready for
public release on GitHub and closed-circle user testing of the PWA.
**Owner:** You + Claude (final review)
**Antigravity role:** Final integration testing

### 9.1 — Final test pass
- [ ] Run full Phase 4 test suite one final time
- [ ] Run engine specialty string tests one final time
- [ ] End-to-end integration test with all components
- [ ] Test on fresh machine (no prior localStorage state)
- [ ] Test with Cortex offline (confirm Soma works standalone)
- [ ] Test with no API keys (confirm graceful degradation)

### 9.2 — Documentation completeness
- [ ] README.md: manifesto + architecture overview + quick start (3 paths)
- [ ] ARCHITECTURE.md: complete, reflects v1.0 state
- [ ] PHILOSOPHY.md: updated with Heart, Deliberation Layer, component map
- [ ] BOSS_CONTEXT.md: final version for future contributors and agents
- [ ] Each component directory has its own README explaining its role
- [ ] All architectural locks documented in root README

### 9.3 — GitHub release
- [ ] Tag v1.0 on boss-kernel repository
- [ ] Tag v1.0 on boss-deliberation repository
- [ ] Write release notes: what was built, what works, what's coming
- [ ] Component map diagram committed and linked from README

### 9.4 — Closed circle distribution
- [ ] Deliberation Layer PWA live on GitHub Pages
- [ ] Share with 3–5 trusted testers, collect feedback
- [ ] BOSS Kernel: document the "technical user" setup path clearly

**Phase 9 exit criterion:** v1.0 is tagged. Both repos are public.
The deliberation PWA is live on GitHub Pages. The README is
something a new developer can follow without prior context.

---

## Division of labour

| Task type | Tool |
|-----------|------|
| Architecture decisions, locked conventions | Claude (this conversation) |
| Engine implementation, kernel physics, Arbiter | Claude |
| Cortex implementation, Heart module | Claude |
| UI/UX proposals, feature expansion ideas | Gemini |
| Semantic seed iteration, test execution | Antigravity (Claude Sonnet 4.6 thinking) |
| Engine specialty string testing | Antigravity (Claude Sonnet 4.6 thinking) |
| Quick spot-code that doesn't touch physics | Gemini (review by Claude) |
| Native app wrapping, Capacitor config | Antigravity or Claude |
| Final architectural review | Claude |

---

## Antigravity session brief (BOSS_CONTEXT.md template)

Copy this file at the start of each Antigravity session and
update the "current phase" and "current task" sections.

```markdown
# B.O.S.S. — Agent Session Brief
**Repo:** github.com/Dosage2AG/boss-kernel
**Current phase:** [FILL IN]
**Current task:** [FILL IN]

## Architectural locks (never modify)
1. score(): warmth × match — multiplication not addition
2. Decay: exp(-rate * elapsed_seconds) — not per-frame
3. vectorBoost: mean-subtracted relative score
4. Arbiter: two-stage gate (delta → dissonance check)
5. engine.js: no DOM dependencies
6. GRIEF_PENALTY = 0.4 (not 0.1)

## Component summary
- Soma: core/index.html — hexagonal seed, 6 nodes, PWA
- Cortex: cortex/cortex.py — embeddings, /resonate, /analyze, SSE
- Engine: engine/engine.js — LLM pool, deliberation, shared module
- Heart: heart/heart.js + heart/heart.py — metabolic loop [Phase 3]

## Active node specialties (v0.6 pruned)
CORE:    health battery power hardware reboot uptime diagnostics integrity status system
SOMA:    identity self who appearance theme interface color look feel ui somatic body
CORTEX:  logic reason analyse evaluate intelligence decide process think infer meaning
MEMORY:  recall retrieve store archive records data vault note save find past logs
MEDIA:   audio music play sound frequency volume track song speaker playback listen
CHRONOS: time schedule clock calendar timer alarm duration routine when last history

## Regression patterns to watch for
- score() becoming warmth + match (additive) — must stay multiplicative
- GRIEF_PENALTY dropping to 0.1 (testing value) — must stay 0.4
- Arbiter losing second stage (dissonance check) — both stages required
- Cortex URL being hardcoded — must use localStorage BOSS_CORTEX_URL
- engine.js gaining DOM dependencies — must stay UI-agnostic

## Current state of [component being worked on]
[Fill in before each session]

## Specific task for this session
[Fill in before each session]

## Do not change
[List any files/functions that must not be modified in this session]
```

---

## Immediate next step

**Phase 0** → audit the codebase against the checklist above.
Then **Phase 1** → engine specialty string testing.

The engine testing can begin now: `engine/engine.js` and
`engine/test.html` are built and ready. Serve locally,
add API keys, run the preset suite, record results.
