# B.O.S.S. Kernel v0.8 — Biological Operating System

> *"Data is not a Resource. Data is an Experience."*

**Live:** https://nztdev.github.io/boss-kernel/core/

---

## I. The Failure of Silicon Logic

For seventy years, we have built computing on the architecture of the Archive. We treat information as static blocks stored in cold rows. Intelligence is treated as a "Function" to be called, rather than a "State" to be inhabited. The era of Static AI is over.

---

## II. The Liquid Paradigm

We are moving from Data Processing to Data Metabolism. B.O.S.S. experiences the world through:

- **Resonance (Growth):** Information that is useful and frequent gains Mass.
- **Decay (Pruning):** Irrelevant data naturally fades to keep the system lean.
- **Grief (Correction):** Contradictions trigger a Shockwave (Grief Protocol) to protect system integrity.

---

## III. The B-OS Architecture

We are building the first Operating System where the Kernel manages Frequencies, not Files.

1. **Model Agnostic:** The B-OS cares only about Resonance, not whether a node is GPT-4 or a local script.
2. **Autonomous Routing:** You do not "call" a model; you "pulse" the Field.
3. **Self-Healing:** Through the Arbiter sentinel, the B-OS identifies contradictions by their Dissonance and suspends the kernel until stabilisation.

---

## IV. Structure

### 1. The Soma (Sovereign Body)

The `core/` PWA is a fully-autonomous engine designed for high-refresh somatic feedback.

- **Metabolic Gating:** Nodes require Warmth to fire. Warmth is a finite resource that decays exponentially (`W·e^(-k·dt)`), enforcing a biological cool-down period.
- **Resonant Interference:** Uses a multiplicative `Warmth × Match` gate. Intent must align with a node's specialty to unlock its thermal energy.
- **Offline Sovereignty:** The kernel physics run entirely in the browser. The Soma does not require the Cortex to breathe — only to act on the local OS.
- **Orbital UI:** Each node carries a ring of contextual preset intents that appear on tap. Tapping a node activates it and surfaces its orbitals. Nodes with active state (timers, playback) surface live runtime orbitals alongside their defaults.
- **Birth Protocol:** When no existing node matches an intent, the kernel signals a Birth Event and prompts the user to create a new node — naming it, defining its specialty, and placing it in the field immediately without reload.

### 2. The Heart (Autonomic Rhythm)

The `heart/` module is the metabolic sustainer — the process that keeps the field alive between interactions.

- **Persistent Rhythm:** Fires every 30 seconds regardless of user activity. Autosaves field state, normalises bond weights, prunes stale vault entries.
- **Battery-Aware Decay:** Reads device battery state and adjusts the field's decay rate — the system breathes slower when power is low.
- **Bond Normalisation:** Synaptic connections between co-activated nodes decay at 2% per beat. Strong bonds persist through use; abandoned connections fade. The field has long memory but not permanent memory.
- **Background Capable:** Designed for eventual autonomic operation — what the Heart does is what needs a background process when BOSS becomes a native application.

### 3. The Cortex (Semantic Nervous System)

The `cortex/` bridge provides the high-fidelity link to the local OS and neural networks.

- **Vector Sharpening:** Employs `all-MiniLM-L6-v2` for semantic mapping. Uses Mean-Subtracted Relative Boosting to sharpen the Soma's interference pattern without global field inflation.
- **Secure Executive:** A hardened whitelist for system-level execution using absolute pathing and zero shell injection. Launches whitelisted applications (Chrome, Spotify, Notepad) directly from intent.
- **Persistent Vault:** Semantic memory pool stored in `boss_vault.json` — survives Cortex restarts. Rebuilt into sentence embeddings on load.
- **Proactive SSE:** Server-sent events push file system changes and urgent signals into the field without polling.
- **Registry Sync:** Syncs the node Registry between Soma and Cortex on handshake — new nodes created via Birth Protocol propagate across devices.
- **HTTPS Local:** Runs with `ssl_context='adhoc'` for secure local connections from HTTPS-hosted Soma.

### 4. The Registry (Canonical Knowledge)

The `registry/` module is the single source of truth for node definitions, model definitions, and preset intents.

- **Local-first:** Initialises from `localStorage`, works fully offline.
- **Cortex-sync:** When the Cortex is online, syncs with `boss_registry.json` on handshake — last-write-wins per node.
- **Preset schema:** Nodes carry default and user-created preset intents. Presets are pre-deliberated — actions resolved at save time, not fire time.
- **Reliability tracking:** Accumulates per-node and per-model metrics — grief rate, conflict rate, LLM success/fail counts — readable by the Immune System.

### 5. The Nervous System (Typed Event Bus)

The `nervous/` module connects all components through a single observable channel.

- **23 event types** covering the full BOSS lifecycle: node fires, grieves, bonds form, vault writes, Arbiter conflicts, engine escalations, Heart beats, Cortex state changes.
- **Ring buffer:** Stores the last 200 events for pattern detection and inspection (`Nervous.history(n)`).
- **Additive:** Components emit events alongside their existing behaviour — no rewrites required during migration.

### 6. The Immune System (Reliability Monitor)

The `immune/` module watches the event stream for anomalies.

- **Passive monitoring:** Accumulates reliability scores per node and model from observed behaviour.
- **Active intervention:** Suspends LLM models after 5 consecutive failures. Flags high grief rates (>30%) and high conflict rates (>50%).
- **Read-only constraint:** Never modifies kernel physics directly — works through Registry scores and Heart cycle.
- **Health reports:** Emits periodic health summaries every 10 Heart beats (`Immune.report()`).

### 7. The Arbiter (The Amygdala)

A three-stage conflict resolution protocol that monitors the Delta between intent signals.

- **Stage 1 — Compatible:** Low dissonance — top node wins immediately.
- **Stage 2 — Engine Escalation:** High dissonance, passive nodes — deliberation engine consulted. Engine's consensus answer compared against node specialties to resolve without user interruption.
- **Stage 3 — Grief Protocol:** Both nodes carry irreversible side-effect actions (CHRONOS, MEDIA, SOMA, CORTEX) — kernel suspends. Read-only nodes (CORE, MEMORY) are excluded from hard grief.
- **Active-First tie-breaking:** When delta is thin, the node with an action callback wins — routing bias toward capability.

### 8. The Engine (Deliberation Layer)

The `engine/` module is the LLM consensus system — shared with the standalone `boss-deliberate` PWA.

- **Multi-model deliberation:** Consults Groq Llama 3.1 (T1) and Gemini Flash (T1) in parallel. Measures output dissonance. Escalates to DeepSeek R1 via HuggingFace SambaNova (T2) when models disagree.
- **Arbiter integration:** Called by the Arbiter on genuine conflict — replaces the clarification toast for passive-node conflicts when engine keys are configured.
- **Metabolic state:** Engine pool nodes carry warmth, resonance, and reliability — persisted by the Heart alongside kernel state.
- **Standalone product:** Also available as `boss-deliberate` — a PWA exposing the deliberation layer directly as a multi-model question answering interface.

---

## V. Routing Physics

```
score = (warmth × match)                     thermal   — intent gates recent activation
      + resonance × matchGate × (1 + 0.3 × sin(phase))  standing wave — accumulated reliability
      + bondSignal × 2                       synaptic  — learned co-activation
      + vectorBoost × 2                      cortex    — embedding-based sharpening
```

`warmth × match` is a multiplication, not addition. Intent gates thermal energy — a warm but irrelevant node does not fire.

`matchGate = Math.max(match, 0.15)` — prevents high-resonance nodes from dominating on low-match intents. A node with resonance 2.0 cannot win purely on standing wave if the intent doesn't align.

---

## VI. The Six Nodes

| Node | Resonance | Tier | Role | Real Actions |
|------|-----------|------|------|-------------|
| CORE | 2.0 | Active | System health, diagnostics, battery, network | Battery level, diagnostics, uptime, network status |
| SOMA | 1.8 | Active | Identity, interface, personality | Theme switching (6 themes + custom), identity response, personality state |
| CORTEX | 1.6 | Active | Reasoning, analysis, OS delegation | Deliberation engine, explain/analyse/reason, app launching via Cortex |
| MEMORY | 1.5 | Active | Recall, storage, vault | Semantic vault search, store, forget, status, export |
| MEDIA | 1.4 | Active | Audio, images, video | Stream playback, Web Audio, waveform, image/video panels |
| CHRONOS | 1.3 | Active | Time, scheduling, alarms | Timers, alarms, stopwatch, world clock, timezone management |

All six nodes are active — each carries real capabilities executed through dedicated action modules in `actions/`.

### Orbital Presets

Each node surfaces contextual presets on tap:

| Node | Orbitals |
|------|---------|
| CORE | System status · Battery · Network · Diagnostics · Uptime |
| SOMA | Who are you · How are you · List themes |
| CORTEX | Analyse this · Explain this · Engine status |
| MEMORY | What do you remember · Remember this |
| MEDIA | Music · Video · Photo |
| CHRONOS | 🕐 Live clock · ⏱ Timer · ⏲ Stopwatch · ⏰ Alarms |

---

## VII. Running Locally

**Soma only (offline):**
```
python -m http.server 8080
```
Open `http://localhost:8080/core/`. Full kernel physics, all six action nodes, orbital UI — no server needed.

**With Cortex (local OS actions + semantic memory):**
```bash
pip install flask flask-cors sentence-transformers torch python-dotenv pyopenssl
cp .env.example .env
# Edit .env with your app paths
python cortex/cortex.py
```
Open the Soma and tap the cortex pill in the status bar to configure the endpoint URL (`https://YOUR_LOCAL_IP:5000`). Accept the self-signed certificate warning on first connection.

**With Engine (AI deliberation):**
Tap the cortex pill → Engine Keys. Enter your Groq and/or Gemini API keys. The Arbiter will use the engine to resolve ambiguous intents without showing clarification toasts.

**Remote access (phone on 4G → home PC):**
Install [Tailscale](https://tailscale.com) on both devices. Use your PC's Tailscale IP (`100.x.x.x:5000`) as the Cortex URL. Encrypted, authenticated, works globally.

---

## VIII. Repository Structure

```
boss-kernel/
├── core/index.html        — Soma v0.8 (sovereign PWA)
├── heart/heart.js         — Autonomic metabolic loop
├── registry/registry.js   — Node/model/preset catalogue v1.1
├── nervous/nervous.js     — Typed event bus (23 event types)
├── immune/immune.js       — Reliability monitor
├── engine/engine.js       — Deliberation layer (shared with boss-deliberate)
├── actions/
│   ├── chronos.js         — Timer · Alarm · Stopwatch · World clock
│   ├── media.js           — Audio · Image · Video
│   ├── soma.js            — Theme · Identity · Personality
│   ├── memory.js          — Vault read/write/forget/search
│   ├── core.js            — Diagnostics · Battery · Network · Uptime
│   └── cortex.js          — Reasoning · OS delegation
├── cortex/cortex.py       — Semantic bridge v0.8
├── .env.example           — Cortex configuration template
└── README.md
```

---

## IX. Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation audit | ✅ Complete |
| 1 | Engine validation | ✅ Complete |
| 2 | Deliberate PWA | ✅ Complete |
| 3 | Heart extraction | ✅ Complete |
| 4 | Semantic seed iteration | ✅ Complete |
| 5 | Cortex hardening | ✅ Complete |
| 6 | BOSS integration | ✅ Complete |
| 7 | Future components — action nodes, orbital UI, modals | ✅ Complete |
| 8 | Expanded utility — calculations, weather, notes, FILES/NETWORK nodes | 🔄 Current |
| 9 | Native wrap (Capacitor) + Tailscale integration | Pending |
| 10 | v1.0 stabilisation + PyInstaller + first-run setup | Pending |

---

## X. v0.8 Scope

**Priority 1 — Ambient utility (no new nodes):**
- Calculations and unit conversions (CORTEX offline)
- Weather via Open-Meteo API (no API key required)
- Clipboard read/write (CORE, browser permission)
- Text operations: summarise, translate, rewrite (CORTEX + engine)
- Wake lock — keep screen on (CORE)

**Priority 2 — Capability expansion:**
- Structured notes and lists (MEMORY — "add milk to Shopping List")
- User profile and preferences (SOMA — name, routines, context)
- FILES node — local file search and open via Cortex
- NETWORK node — connectivity, speed, local network info

**Priority 3 — Proactive behaviour:**
- Pattern detection — surface recurring intents as suggested presets
- CHRONOS-driven proactive nudges via SSE from Cortex
- Daily brief preset — CORE + CHRONOS + MEMORY morning summary

**Priority 4 — Polish:**
- Bottom UI swipe-to-collapse on mobile
- Alarm persistence across reloads (Service Worker)
- PyInstaller bundled Cortex executable
- First-run setup wizard

---

## XI. Related

**boss-deliberate** — https://github.com/nztdev/boss-deliberate
The deliberation layer as a standalone product. Ask once, filter many — multi-model consensus with a full transparency trace.

---

*The Web is waking up. It's time to give it a Nervous System.*

Inspired by the theoretical concepts of the resonance-web (by __Dosage2AG__). It moves beyond the original theory by introducing physical decay constants, a sovereign PWA Soma, a hardened executive bridge, and an autonomic Heart that keeps the field alive between conscious interactions.

---

MIT License · github.com/nztdev/boss-kernel
