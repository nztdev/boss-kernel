# B.O.S.S. Kernel v0.9 — Biological Operating System

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

## VI. The Eight Nodes

| Node | Resonance | Tier | Role | Real Actions |
|------|-----------|------|------|-------------|
| CORE | 1.5 | Active | System health, diagnostics, battery, network | Battery level, diagnostics, uptime, network status, local/public IP, speed test |
| SOMA | 1.5 | Active | Identity, interface, personality | Theme switching (6 themes + custom), identity response, personality state, user profile |
| CORTEX | 1.5 | Active | Reasoning, analysis, computation, OS delegation | Deliberation engine (explain/analyse/reason), Text Tools (summarise/translate/rewrite), offline calculator, unit/currency/date conversion, app launching via Cortex |
| MEMORY | 1.5 | Active | Recall, storage, structured notes | Semantic vault search, store, forget, structured lists |
| MEDIA | 1.5 | Active | Audio, images, video | Stream playback with live progress, Web Audio waveform, mini-player, image/video viewers |
| FILES | 1.5 | Active | File access and viewing | Recent files, native file picker (with iOS/Safari fallback), URL-based viewer, fullscreen toggle, Cortex-delegated Office/OS-app opening |
| CHRONOS | 1.5 | Active | Time, scheduling, alarms | Timers, alarms, stopwatch, world clock, timezone management, live clock orbital |
| DEVICES | 0 | Stub | Smart home / Bluetooth / Matter control | **Native app only** — inert in the browser PWA, reserved for Capacitor build |

Seven nodes are active with real capabilities executed through dedicated action modules in `actions/`. DEVICES is a structural placeholder — excluded entirely from intent routing and the Arbiter, rendered with a muted dashed outline, and only interactive via an informational tap.

### Orbital Presets

Each active node surfaces contextual presets on tap. Presets open dedicated modals positioned near the node rather than requiring typed intents for common actions:

| Node | Orbitals |
|------|---------|
| CORE | System status · Battery · Network (modal: status, public/local IP, speed test) · Diagnostics · Uptime |
| SOMA | Who are you · How are you · Themes (modal: swatches + custom colour) · Profile (modal: name, routines, preferences) |
| CORTEX | Text Tools (modal: summarise/translate/rewrite/analyse/explain) · Calculate (modal: numeric pad + prompt calculation) · Engine status |
| MEMORY | Vault (modal: search/add/delete) · Notes (modal: structured checklists) |
| MEDIA | Music (URL prompt → player modal with live progress/waveform) · Video (URL prompt → embed) · Photo (URL prompt → viewer) |
| FILES | Recent · Open (native/browser file picker) · URL |
| CHRONOS | 🕐 Live clock (→ timezone modal) · ⏱ Timer · ⏲ Stopwatch · ⏰ Alarms |
| DEVICES | *(inert — tap shows native-app-only info)* |

Tapping a node directly activates its orbitals without needing a typed intent. The node animates — scaling up and drifting toward canvas centre — while other nodes are gently pushed outward, giving the active node visual priority.

---

## VII. Running Locally

**Soma only (offline):**
```
python -m http.server 8080
```
Open `http://localhost:8080/core/`. Full kernel physics, all seven active nodes (plus the DEVICES stub), orbital UI — no server needed.

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
├── core/index.html        — Soma v0.9 (tool-calling Arbiter, blocking clarification)
├── heart/heart.js         — Autonomic metabolic loop
├── registry/registry.js   — Node/model/preset catalogue v1.1 (8 nodes, 27+ presets)
├── nervous/nervous.js     — Typed event bus (23 event types)
├── immune/immune.js       — Reliability monitor
├── engine/engine.js       — Deliberation layer (shared with boss-deliberate)
├── actions/
│   ├── chronos.js         — Timer · Alarm · Stopwatch · World clock · Timezone
│   ├── media.js           — Audio · Image · Video · Progress tracking
│   ├── soma.js            — Theme · Identity · Personality · Profile
│   ├── memory.js          — Vault read/write/forget/search · Notes
│   ├── core.js             — Diagnostics · Battery · Network · Uptime
│   ├── cortex.js          — Reasoning · Calculator · Text Tools · OS delegation
│   └── files.js           — File access across Cortex, browser, and native paths
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
| 7 | Action nodes, orbital UI, modal suite | ✅ Complete |
| 8 | Expanded utility — Calculator, Text Tools, MEMORY notes, FILES node, DEVICES stub, engine context grounding | ✅ Complete |
| 9 | Tool calling — Registry → schema export, function calling in `engine.js`, Arbiter escalation via structured decisions | Pending |
| 10 | Native wrap (Capacitor) + DEVICES node (Bluetooth/Matter) + Tailscale integration guide | Pending |
| 11 | v1.0 stabilisation + PyInstaller + first-run setup wizard | Pending |

---

## X. v0.8 — Delivered

**Ambient utility (offline-first, CORTEX):**
- Full numeric calculator with sandboxed expression evaluation
- Offline unit conversion — weight, length, temperature, volume, speed, data (25+ pairs, alias-aware)
- Offline date arithmetic — "days until Christmas", date-to-date ranges
- Currency conversion — live rate fetched once per session at boot, cached with source labelling (live / cached / approximate), Cortex-relayed fallback for exotic pairs, all without requiring engine keys
- Text Tools — summarise, translate (12 languages), rewrite (5 tones), analyse, explain — all via the deliberation engine when configured

**Capability expansion:**
- MEMORY — Vault modal (search/add/delete) and structured Notes (checklist-style lists with persistence)
- SOMA — user Profile (name, routines, preferences), read by SOMA's own identity/personality responses and injected into every CORTEX engine call for personalised answers
- FILES node — recent files, native `showOpenFilePicker` with an `<input type="file">` fallback for Safari/iOS, URL-based viewing, embedded viewer panel (image/video/PDF/text) with a fullscreen toggle, Office-format detection with Cortex-delegated open-in-app
- DEVICES node — added as an explicit, structurally inert placeholder for native-only Bluetooth/Matter/smart-home control. Excluded from all routing and Arbiter logic; visually distinct; exists to make the roadmap tangible and to give the engine-context and gap-flagging work (Section below) something concrete to reference

**Engine grounding:**
- `BOSS_CAPABILITY_CONTEXT` — generated at boot directly from the Registry, prepended to every CORTEX reasoning call so engine responses are aware of BOSS's actual nodes and capabilities rather than answering generically
- Verified in practice: asking the engine "what are the main nodes?" now returns an accurate, BOSS-specific answer

**Model maintenance:**
- Migrated the Groq T1 model from the deprecated `llama-3.1-8b-instant` to `openai/gpt-oss-20b` ahead of the August 2026 shutdown, across both `boss-kernel` and the standalone `boss-deliberate` PWA

**UX polish:**
- Bottom UI swipe-to-collapse (swipe down to hide the console, swipe up or tap the handle to restore) — gives mobile the full canvas when wanted
- Full structured test pass across all seven active nodes, chat intents and orbital taps, desktop and mobile — all defects found were fixed in-session (routing collisions from overlapping specialty strings, MEDIA progress bar false-positive stream detection, CHRONOS grief on read-only time queries, modal auto-open on chat-triggered actions)

**Deliberately descoped from the original v0.8 plan:**
- **Clipboard** as a standalone CORE feature — dropped; the OS-native clipboard already covers this, and BOSS only needs clipboard *read* as an input to other operations (e.g. "summarise what I copied"), which can be added inline to Text Tools later rather than as its own capability
- **Weather** — not built this cycle; remains a good, low-effort future addition (Open-Meteo, no API key)
- **NETWORK as a separate node** — folded into CORE instead, since its capabilities (connectivity, local/public IP, speed test) overlapped heavily with CORE's existing diagnostics and didn't justify a standalone node
- **Wake lock** — narrowed from a general CORE toggle to something worth tying specifically to the CHRONOS Timer modal (keep-screen-on while a countdown is visible); not yet implemented, carried forward

---

## XI. v0.9 — Delivered So Far

**Tool-calling Arbiter escalation.** `decideNode()` in `engine.js` replaces the old prose-similarity guess with a direct, forced function call (`select_node`) — the model picks one of the two conflicting nodes outright rather than answering the intent in prose that's then fuzzy-matched against specialty strings. Supported on both Groq (OpenAI-compatible tool calling) and Gemini (native function declarations), with the original prose-based method kept as an explicit fallback if tool calling is unavailable or fails. Verified in testing across both providers with correct, deterministic decisions (`temperature: 0`).

**Resonance flattening.** All seven active nodes were normalised to `resonance: 1.5`. Two of them (CORE at 2.0, then briefly the reassigned outlier) had been structural default-winners for any low-match intent purely from their static starting resonance — since `warmth` starts near zero for every node at boot, early-session routing was governed almost entirely by which node had the tallest baseline value, not by actual relevance. Flattening removes that bias; the small per-fire resonance growth (`+0.01`) is now the genuine "accumulated reliability" signal the architecture describes, rather than being drowned out by a fixed Registry number.

**Amendment — risk-tiered Grief Protocol.** The original Arbiter lock specified that any conflict between two action (side-effect) nodes hard-stops the kernel, regardless of how decisive the score gap is. In practice this meant a clearly unambiguous intent (e.g. a 4x score margin) could still trigger a full-kernel suspension purely because the two nodes' *general* specialties were thematically distant — dissonance measures domain distance between specialty strings, not genuine ambiguity in what the user meant. This has been amended, deliberately and explicitly rather than silently:

- Every node now carries a `riskTier` — `'standard'` (all seven current active nodes) or `'elevated'` (reserved for future high-stakes capabilities, e.g. DEVICES controlling locks or security systems)
- **Elevated-tier conflicts** keep the original unconditional hard stop, regardless of engine availability — the safety margin stays maximal exactly where real-world consequences are highest
- **Standard-tier conflicts** no longer hard-grieve. If the engine is configured, `decideNode()` resolves the conflict directly and fires immediately. If the engine is unavailable or fails, execution is **blocked** — a clarification toast requires the user to explicitly choose before either node fires, scoped to that one intent only, with no full-kernel suspension and no manual "Recover" step

This preserves the property Grief Protocol exists for — no silent irreversible action on genuine ambiguity — while removing suspension for cases that were never actually ambiguous, just structurally flagged as dissonant. As BOSS's node count grows (more nodes means more possible dissonant pairings), this scales considerably better than the original all-or-nothing hard stop.

---

## XII. v0.9 Direction — Tool Calling (Remaining)

- Export the Registry's existing `capabilities` and `presets` data as a general-purpose tool schema (`{name, description, parameters}` per action) — the data already exists, this is a serialisation step, not new architecture. What's built so far (`decideNode()`) is scoped narrowly to binary Arbiter decisions; this generalises it to arbitrary multi-parameter tool calls
- Extend tool calling to general CORTEX-routed intents as a long-tail fallback beyond local regex — when no local pattern matches, the engine picks the right tool directly rather than the intent falling through to "no recognised action"
- **Gap detection** — when a request matches no existing tool, CORTEX responds honestly and logs the gap, feeding a real backlog for what BOSS should build next. On native (Phase 10), this same signal drives DEVICES' adapter-matching logic
- Explicitly out of scope, on any platform: letting the engine generate and self-execute arbitrary new code. New real capabilities continue to ship through normal development and review, not runtime code generation

---

## XIII. Related

**boss-deliberate** — https://github.com/nztdev/boss-deliberate
The deliberation layer as a standalone product. Ask once, filter many — multi-model consensus with a full transparency trace.

---

*The Web is waking up. It's time to give it a Nervous System.*

Inspired by the theoretical concepts of the resonance-web (by __Dosage2AG__). It moves beyond the original theory by introducing physical decay constants, a sovereign PWA Soma, a hardened executive bridge, and an autonomic Heart that keeps the field alive between conscious interactions.

---

MIT License · github.com/nztdev/boss-kernel
