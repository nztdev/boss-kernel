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
- **Stage 3 — Grief Protocol:** Both nodes carry irreversible side-effect actions (CHRONOS, MEDIA, SOMA, CORTEX, COMMS) — standard-risk conflicts are resolved by the engine or a blocking clarification; elevated-risk conflicts suspend the kernel (see §XI amendment). Read-only nodes (CORE, MEMORY) are excluded from hard grief.
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

## VI. The Ten Nodes

Eight nodes are active; two (DEVICES, BROWSER) are inert **native-only stubs**.

| Node | Resonance | Tier | Role | Real Actions (browser PWA) |
|------|-----------|------|------|-------------|
| CORE | 1.5 | Active | System health, diagnostics, device facts, state backup | Battery, diagnostics, uptime, network status, local/public IP, speed test, **location ("where am I")**, **full state export / import**, gap log |
| SOMA | 1.5 | Active | Identity, interface, personality, voice | Themes (6 + custom), identity response, profile, **voice in (dictation) and voice out (spoken replies)** |
| CORTEX | 1.5 | Active | Reasoning, computation, vision, **app launching** | Deliberation engine, Text Tools, calculator, unit/currency/date conversion, **Look (camera / photo → describe, read text, translate, ask)**, **clipboard → Text Tools**, **open apps by URL scheme, iOS Shortcuts bridge**, PC delegation via the Python Cortex server |
| MEMORY | 1.5 | Active | Recall, storage, notes, **security** | Semantic vault, structured notes, **opt-in encryption (passphrase, optional biometric), auto-lock** |
| MEDIA | 1.5 | Active | Audio, images, video | Stream playback with live progress, waveform, mini-player, image/video viewers |
| FILES | 1.5 | Active | File access and viewing | Recent files, device file picker (iOS/Safari fallback), URL viewer, fullscreen, PC-file opening via Cortex |
| COMMS (label: **Phone**) | 1.5 | Active-lite | Reaching people | **Call / Text / Email hand-off** to the device's own apps via `tel:` / `sms:` / `mailto:` — you confirm and press send. No contacts lookup, no direct sending (native) |
| CHRONOS | 1.5 | Active | Time, scheduling, weather | Timers, alarms (**only while BOSS is open**), stopwatch, world clock, timezones, **weather (Open-Meteo)** |
| DEVICES | 0 | Stub | External devices | **Native only**: Bluetooth accessories, Matter / smart home, wearables and health data (heart rate, steps, sleep) |
| BROWSER | 0 | Stub | BOSS Browser | **Native only**: a sandboxed browser BOSS can read and operate for you |

Active nodes execute through dedicated modules in `actions/`. The stubs are excluded from intent routing and the Arbiter, drawn muted with a dashed outline, and only answer a tap with an info card listing what is planned.

**Naming rule — purpose over transport.** A capability lives with the node whose *purpose* it serves, not the radio or protocol it uses. Calling and messaging are COMMS (the node is labelled "Phone" in the UI); Bluetooth is a transport, so a Bluetooth speaker belongs to DEVICES and a Bluetooth phone call to COMMS. Health and wearables fold into DEVICES rather than getting their own node; weather lives in CHRONOS and location in CORE rather than a separate "WORLD" node.

### Orbital Presets

Each active node surfaces contextual presets on tap. Presets open dedicated modals positioned near the node rather than requiring typed intents for common actions:

| Node | Orbitals |
|------|---------|
| CORE | System status · Battery · Network · Location · Backup · Gaps · **📱 Native (4)** |
| SOMA | Who are you · How are you · Themes · Profile · Voice (modal: input/output, voice, speed) |
| CORTEX | Text Tools · Calculate · Engine status · Look (modal: photo / choose / paste → describe, read text, translate, ask) |
| MEMORY | Vault · Notes · Security (modal: enable/disable encryption, passphrase, biometric, auto-lock) |
| MEDIA | Music · Video · Photo |
| FILES | Recent · Open · URL |
| COMMS | 📞 Call · 💬 Text · ✉ Email (one **Phone** panel with three tabs) · **📱 Native (3)** |
| CHRONOS | 🕐 Live clock · ⏱ Timer · ⏲ Stopwatch · ⏰ Alarms · 🌤 Weather · **📱 Native (1)** |
| DEVICES, BROWSER | *(inert — tap shows native-app-only info and a "Planned:" list)* |

**Native pill.** Capabilities that cannot work in a browser are registered as presets with `nativeOnly: true`. They never appear as individual pills (CORE's ring would be unreadable) — each node shows one greyed **📱 Native (n)** pill that opens a list with the reason for each item and a *high-risk* tag where relevant. See §XIV.

Tapping a node directly activates its orbitals without needing a typed intent. The node animates — scaling up and drifting toward canvas centre — while other nodes are gently pushed outward, giving the active node visual priority.

---

## VII. Running Locally

**Soma only (offline):**
```
python -m http.server 8080
```
Open `http://localhost:8080/core/`. Full kernel physics, all eight active nodes (plus the DEVICES and BROWSER stubs), orbital UI — no server needed.

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
├── core/index.html        — Soma v0.9 (Arbiter, intent claims, modals, ⚙ Settings hub)
├── core/sw.js             — Service worker: network-first, offline cache, versioned (BUILD)
├── core/manifest.json     — PWA manifest (installable on iPhone and Android)
├── core/bosslogo.jpg      — Logo (iPhone home-screen icon, favicon)
├── core/bosslogo-192.png / bosslogo-512.png / bosslogo-maskable-512.png — PNG icons Android requires to offer "Install"
├── heart/heart.js         — Autonomic metabolic loop (vault maintenance is encryption-aware)
├── registry/registry.js   — Node/model/preset catalogue (10 nodes, 42 presets)
├── nervous/nervous.js     — Typed event bus
├── immune/immune.js       — Reliability monitor
├── engine/engine.js       — Deliberation layer (shared with boss-deliberate) + vision call
├── actions/
│   ├── chronos.js         — Timer · Alarm · Stopwatch · World clock · Timezone
│   ├── weather.js         — Open-Meteo forecast (used by CHRONOS)
│   ├── media.js           — Audio · Image · Video · Progress tracking
│   ├── soma.js            — Theme · Identity · Personality · Profile · Voice commands
│   ├── voice.js           — Speech in/out (+ best-effort audio routing)
│   ├── ui.js              — UI settings, style tokens, update / reset / erase, permissions
│   ├── memory.js          — Vault · Notes · Security commands
│   ├── secure.js          — SecureStore: opt-in encryption for Vault + Notes
│   ├── core.js            — Diagnostics · Battery · Network · Uptime · Backup · Location
│   ├── location.js        — Device location helper (memory-only)
│   ├── backup.js          — BackupManager: state export / import
│   ├── cortex.js          — Reasoning · Calculator · Text Tools · Look · Launcher · OS delegation
│   ├── vision.js          — Image preparation + vision modes
│   ├── clipboard.js       — Clipboard read / write
│   ├── launch.js          — App launcher table · Shortcuts bridge · shared openScheme()
│   ├── comms.js           — Phone: tel: / sms: / mailto: parsing and hand-off
│   ├── onboarding.js      — Front door: intro cards · Home screen · "What can BOSS do?" (self-rendering)
│   ├── feedback.js        — Request log · "not what I meant" flags · tester report · pluggable transports
│   ├── feedback-ui.js     — Miss chip + tester-report sheet (self-rendering)
│   ├── learning.js        — On-device adaptation: learned pair preferences + personal Arbiter margin
│   ├── waveform.js        — Speaking/listening animation (strip above input · ring around SOMA · off)
│   ├── dialogue.js        — Conversation layer: small talk in 5 personalities, follow-ups, "for how long?", distress reply (not a node)
│   ├── boot.js            — Launch animation: logo drops onto a 3D grid, light pulses flow outward, then the field boots
│   └── files.js           — File access across Cortex, browser, and native paths
├── TESTING.md             — Tester guide: guided test pass + results sheet
├── tests/                 — Routing regression suite (not shipped to users)
│   ├── phrases.tsv        — ~165 core requests, each with the node it should reach (EXPECTED<TAB>phrase)
│   ├── phrases_more.tsv   — ~90 casual / edge-case requests, same format
│   ├── phrases_chat.tsv   — ~130 chit-chat phrases (EXPECTED = CHAT) plus trap phrases that must still reach their action
│   ├── phrases_reports.tsv — phrases taken from real tester reports (kept as regression tests; add new ones from each report)
│   ├── measure_bonds.py   — same idea for bond strength: gives nodes realistic bonds and counts wrong routings / needless questions
│   ├── measure_recency.py — measures how often a recently used ("warm") node misroutes phrases; run before/after any scoring change
│   ├── experiments/embeddings/ — offline experiment for the Understanding Layer (embed_experiment.py, fresh_paraphrases.tsv); changes nothing in BOSS
│   └── run_corpus.py      — Runner: loads core/index.html in headless Chromium, calls BOSS_route() per phrase
├── docs/UNDERSTANDING-LAYER.md — design note: the proposed understanding layer (post-v1.0), contract, manifest, shadow mode, evidence
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
| 9 | Tool calling, gap detection, risk-tiered Grief | ✅ Complete (pending final retest) |
| 9b | Pre-wrap capability build: state backup, encryption, location, weather, voice, vision/clipboard, app launcher + Shortcuts bridge, COMMS-light, native-only layer, BROWSER stub | ✅ Complete (device-tested) |
| 10 | Native wrap (Capacitor): implement the 📱 Native items, DEVICES adapters, BOSS Browser, silent app launching, reliable alarms, Tailscale guide | Pending |
| 11 | v1.0 stabilisation + PyInstaller + first-run setup wizard | Pending |
| 12 | Understanding Layer (post-v1.0): capability manifest, in-app embeddings, shadow mode, personal memory — see §XVII and `docs/UNDERSTANDING-LAYER.md` | Design note written; not started |

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

## XII. v0.9 — Delivered (Tool Calling & Gap Detection)

- **Registry → tool schema:** `Registry.exportToolSchema()` serialises capabilities and presets; `selectTool()` in `engine.js` lets the engine pick a preset (or `no_match`) when local regex finds nothing.
- **Kernel-level gap-fill:** any non-CORTEX winner that returns `false` triggers `selectTool` → `firePreset`; with no engine, the gap is logged.
- **Gap detection:** unmet requests are logged locally (`BOSS_GAPS`), viewable in the CORE `🕳 Gaps` modal with manual Export/Clear. No automatic telemetry.
- **ACTION_MAP contract:** every wrapper must `return await Module.handle(...)`; `true` = handled, `false` = needs follow-up. A picker the user cancels counts as handled.
- **FILES vs CORTEX:** bare "open a file/document" routes to FILES (device picker). CORTEX treats it as an OS action only when the intent names the PC/computer/desktop. App launching ("open Chrome") and downloads stay with CORTEX. Typed intent on iOS may be blocked by Safari's user-activation rule; the console then points the user to tap the FILES node.
- Out of scope on any platform: engine-generated, self-executed code.

---

## XII-b. Phase 10 Scoping Notes (Not Started)

- **BOSS Browser:** registered now as an inert stub. Native-only (WKWebView / Android WebView) — PWAs cannot embed most sites in iframes. Handoffs: CORTEX summarise, MEMORY remember, MEDIA/FILES viewer. Needs a dominant non-modal UI surface.
- **App launching:** the PWA version is **delivered** (`actions/launch.js`: a launcher table of URL schemes, user-added apps, iOS Shortcuts). The native version replaces schemes with Android package names / Intents and silent launching; desktop launching stays with the Cortex server. Callers do not change — only the table gains entries.
- **COMMS native tier:** contacts, direct SMS, call control (greyed 📱 Native items today).
- **CHRONOS native tier:** OS-scheduled local notifications so alarms ring while the app is closed.
- **Storage:** the installed PWA and the native app have *separate* storage. Moving to the native app is done with the Backup file (§XIII), not automatically.

---

## XIII. v0.9 — Pre-wrap Capability Build (Delivered)

Everything below runs in the browser PWA, works offline-first where the platform allows, and was tested on a real iPhone and desktop Chrome.

**State backup (CORE).** `BackupManager` exports a versioned `boss-state` JSON file and imports it back. Modules register the storage keys they own (a manifest allow-list), so adding a module never touches the backup code. Each file carries a SHA-256 checksum. Engine API keys are **opt-in** and, when included, encrypted with a passphrase; restoring without the passphrase offers to restore everything *except* the keys. Never exported: the node registry, currency cache, engine pool state, Cortex URL, blob URLs (file history keeps names only) and the device-bound biometric wrap. This file is also the migration path to the native app, whose storage is separate from the PWA's.

**Encryption (MEMORY → Security).** Opt-in, off by default. A random AES-GCM data key encrypts Vault and Notes; that key is wrapped by a passphrase-derived key (PBKDF2, 250k iterations) and — only on devices whose browser supports the WebAuthn PRF extension — optionally also by a biometric-derived key. Devices without biometrics (including desktop Chrome and iPhone Safari in testing) fall back to passphrase only, with a clear message. **There is no recovery:** forget the passphrase and the encrypted data is gone; this is stated at enable time. Auto-lock after 1 / 5 / 15 minutes idle or never, and when the tab has been hidden for over a minute. Enable and disable are ordered so a crash mid-way cannot lose data.

**Location (CORE) and Weather (CHRONOS).** "Where am I" uses the device location, held **in memory only** — never saved, never in backups. A place name is looked up best-effort (BigDataCloud); it may fail without affecting anything else. Weather uses Open-Meteo (no key; CC BY 4.0, attribution printed with each result), accepts "weather in Madrid" or "here", uses °F/mph for en-US and metric elsewhere, and retries once on a transient server error.

**Voice (SOMA).** Voice out speaks BOSS's replies (action / vector / memory console lines, cleaned for speech) with the browser's speech synthesis; the default voice is Zarvox when the device has it. Voice in uses the browser's speech recognition, which on most browsers sends audio to the browser vendor's service — **not offline**; a notice says so once. A dictated phrase is auto-sent.

**Vision and clipboard (CORTEX → Look).** Take or choose a photo, or paste an image, then Describe / Read text / Translate / Ask. The image is downscaled to ≤1280 px and re-encoded in the browser, which strips EXIF and GPS data, then sent to Gemini only (the one configured provider that accepts images). Nothing is stored. Clipboard text goes into Text Tools ("summarise my clipboard"); on iOS the panel's Paste buttons are the reliable path because Safari wants a tap.

**App launcher and Shortcuts bridge (CORTEX).** "Open Spotify", "open WhatsApp", "list apps", "add app Bank bank://…". On a phone the scheme is attempted and a **tap-to-open chip** is always shown — a PWA cannot know whether anything opened, and on iOS a tap is the reliable gesture. On desktop, apps without a scheme fall back to their website, opened in a new tab so BOSS stays open. iOS: "run shortcut NAME" calls `shortcuts://run-shortcut`. Only app-style schemes are accepted for user-added apps (`javascript:`, `data:`, `file:` and similar are refused). "…on my PC" still goes to the Python Cortex server.

**Phone (COMMS).** Call / Text / Email through `tel:`, `sms:`, `mailto:` from either a typed intent ("call +34 600 123 456", "text +34600123456 saying hi", "email a@b.com subject Hi saying …") or the Phone panel. BOSS opens the device's own app; **you confirm the call and press send** — a browser cannot do either itself. Names ("call mom") are answered honestly: looking people up needs the native app.

**Settings hub and updates (⚙ in the top bar).** Owned by SOMA, deliberately *not* a node — settings are not a capability and must not compete in routing. Contains: text size (S / M / L / XL — every font size is written as `calc(Npx * var(--ts))`; the top bar and canvas node labels stay fixed so they always fit), reduce motion (defaults to the system preference), a **style** selector backed by a small registry of CSS-variable sets (`registerStyle` in `actions/ui.js`; only "BOSS default" exists today — this is the hook for fully customisable styles later), shortcuts to Themes / Profile / Voice / Security / Backup / Engine keys / Gaps, a **permissions** panel (location, microphone, camera, notifications — state plus an "Allow…" button, with iPhone steps if something is blocked), and **About** (build, worker, installed-app or tab, live node / pulse / arbiter counts — moved here from the top bar on phones to make room for ⚙). Three separate maintenance actions, so one cannot be mistaken for another: **Update BOSS** re-downloads the app files and reloads (data untouched); **Reset settings** restores appearance and voice defaults (data untouched); **Erase everything** wipes all local data and requires typing ERASE, with a backup shortcut shown first.

**Service worker fix.** The previous worker served `index.html` cache-first under a cache name that never changed, so an installed home-screen BOSS could run an old copy indefinitely, and the kernel's JS modules were not cached at all. It is now network-first (always the latest when online, the last good copy offline), pre-caches the shell and every module, uses a versioned cache name, and shows a **"BOSS updated — tap to reload"** banner when a new version takes over. **Release rule:** bump `BUILD` in both `core/sw.js` and `actions/ui.js` on every release. Installs still running the old worker need one manual refresh (clear site data, or reinstall) the first time; after that, updates arrive by themselves.

**Native-only layer and stubs.** See §XIV-C. BROWSER joins DEVICES as a stub; DEVICES' scope now covers external devices, wearables and health data.

---

## XIV. Amendments to the Architecture (Documented, Not Silent)

### A. Deterministic intent claims (new in v0.9)

The routing physics in §V are **unchanged**. What was added is a short list of *claims* checked before Birth Protocol and the Arbiter: if an intent's phrasing is unambiguous, the claiming node wins outright, scoring is skipped, and the console says `◎ claimed by NODE (reason)`.

| Reason | Node | Examples |
|--------|------|----------|
| vision | CORTEX | "take a photo", "describe this image", "read the text in this picture" |
| clipboard | CORTEX | "summarise my clipboard" (not when a PC word is present) |
| launcher | CORTEX | "open Spotify", "run shortcut X", "list apps", "add app …" |
| phone | COMMS | "call +34…", "text 555… saying hi", "email a@b.com", "send an email" |
| text-tools | CORTEX | "open text tools" |
| text-mode | CORTEX | "summarise this text", "translate text" |
| settings | SOMA | "settings", "update boss", "text size", "reduce motion", "clear cache" |

**Why:** words like *photo*, *text*, *open* and *phone* appear in several nodes' vocabularies, so clear requests produced near-ties and the Arbiter asked the user to resolve something that was never ambiguous. **Limits:** a claim is used only when the phrasing is unambiguous. App names that overlap another node's domain (music, photos, files, notes…) are *not* claimed and still go through scoring and the Arbiter.

**Decision recorded:** the Arbiter itself was deliberately left unchanged — no "decisive margin" bypass. A genuine conflict (e.g. "show photo" with MEDIA far ahead of CORTEX) still raises a blocking clarification when no engine is configured. That is what conflict handling is for; learning from past resolutions is a possible future direction, not built.

**Vocabulary hygiene:** adding a word to a node's specialty can create new near-ties elsewhere (adding "text" and "send" to COMMS caught "summarise this text"). Specialty edits are checked numerically with a scoring harness before shipping, and ambiguous words are left out in favour of claims.

### B. Deterministic hand-offs

When specialty overlap makes a near-tie unavoidable, the node that wins hands off: CORTEX → FILES for bare device-file requests; FILES / MEDIA / SOMA → Look for vision phrases; CORTEX → the Text Tools panel for text-tool phrases. The handoff is code, not scoring.

### C. Native-only presets

A preset may carry `nativeOnly: true`, `_risk` (`low` | `high`), `_triggers` (plain phrases) and `_nativeReason`.

- **Never offered to the engine:** `exportToolSchema()` skips them, so the engine cannot "call" something that cannot run.
- **Honest answer, not a gap:** a typed request whose phrase matches ("turn on the flashlight", "record my screen", "turn off Bluetooth") is answered `needs the BOSS native app — <reason>` before any routing, and logged to the gap list tagged *known native-only* so real gaps and known-native requests can be told apart.
- **High-risk marking:** items that change device state or capture the screen (direct SMS, direct calls, Bluetooth / Wi-Fi / airplane toggles, screen recording) are flagged now and must use the **elevated** risk tier — the unconditional hard stop — when implemented.
- **Current items:** COMMS — Contacts, Send SMS directly, Place call directly · CORE — Flashlight, Record screen, Bluetooth on/off, Wi-Fi / airplane · CHRONOS — Reliable alarms.

### D. Registry and risk facts

COMMS is `riskTier: 'standard'` and a side-effect node (it can open a dialler), so it takes part in standard-risk conflict handling like CHRONOS / MEDIA / SOMA / CORTEX. Registry now holds 10 nodes and 42 presets; 34 of them are offered to the engine.

---

## XV. Capability Map — PWA · Native App · OS

✅ works · 🟡 partial · ❌ not possible · 🔮 direction, not scoped

| Capability | PWA (today) | Native app (Capacitor) | OS-level (BOSS as the shell) |
|---|---|---|---|
| Kernel, routing, Arbiter, Heart, offline use | ✅ | ✅ | ✅ |
| Install to home screen | ✅ | ✅ (store app) | — |
| Themes, profile, voice out | ✅ | ✅ | ✅ |
| Voice in | 🟡 browser speech service, not offline | ✅ on-device recognition | 🔮 always-on wake word |
| Vault / Notes | ✅ | ✅ | ✅ |
| Encryption of Vault / Notes | ✅ passphrase; biometric only where WebAuthn PRF exists | ✅ OS keychain + biometric | ✅ |
| State backup / import | ✅ file | ✅ file (import from PWA) | 🔮 system-level backup |
| Location | ✅ foreground, memory-only | ✅ + background / geofence | ✅ |
| Weather | ✅ Open-Meteo | ✅ | ✅ |
| Timers & alarms | 🟡 **ring only while BOSS is open** | ✅ OS-scheduled notifications | ✅ system alarms |
| Vision (photo → describe / OCR / translate) | ✅ Gemini, EXIF stripped | ✅ + live camera, on-device OCR 🔮 | ✅ |
| Clipboard | 🟡 buttons; typed needs a tap on iOS | ✅ | ✅ |
| Files | ✅ picker, viewer | ✅ file-system access, share sheet | ✅ |
| Open apps | 🟡 URL schemes + tap chip; iOS Shortcuts | ✅ silent launch by package / Intent | ✅ |
| Phone / SMS / Email | 🟡 hand-off to device apps; you confirm | ✅ contacts, direct SMS, call control | 🔮 default phone / SMS handler |
| Flashlight, screen recording | ❌ | ✅ (screen recording: high-risk) | ✅ |
| Bluetooth / Wi-Fi / airplane toggles | ❌ | ✅ (high-risk) | ✅ |
| Bluetooth devices, Matter, wearables, health | ❌ (Web Bluetooth absent on iOS Safari) | ✅ DEVICES node | ✅ |
| BOSS Browser (read / operate sites for you) | ❌ | ✅ embedded web view | ✅ |
| Background execution | ❌ | 🟡 limited by the OS | ✅ |
| PC actions | 🟡 via Python Cortex server (Tailscale for remote) | 🟡 same | ✅ native |
| AI engine (keys stay on device) | ✅ | ✅ | ✅ |
| Engine-generated, self-executed code | ❌ permanently out of scope | ❌ | ❌ |

---

## XVI. What Leaves the Device — and Known Limits

There is no telemetry. The only network traffic BOSS itself initiates:

| Feature | Sent to | What |
|---|---|---|
| Engine questions | The provider you configured (Groq / Gemini / HuggingFace) | The question and profile context, using **your** key |
| Look (vision) | Gemini | The prepared photo and your question |
| Weather | Open-Meteo | Coordinates or place name |
| "Where am I" place name | BigDataCloud | Coordinates (best-effort; failure is harmless) |
| Voice in | Your browser vendor's speech service | Audio |
| Currency | Rate provider | A rates request at boot (falls back to a built-in table) |

Backups, the gap log and everything else stay on the device unless you export and share a file yourself.

**Known limits.** iOS Safari requires a tap for some actions (file picker, camera, clipboard read) so typed intents may only get as far as pointing you to the button. Browsers cannot confirm that an app link opened. Alarms need the app open. Web Bluetooth is not available on iOS Safari. Biometric unlock was verified to fall back correctly but not on real biometric-capable hardware. On iPhone, spoken replies after dictation may come out of the phone speaker instead of Bluetooth headphones: dictation switches the audio session to record mode, and a web page can only ask Safari to switch back (best-effort, see `voice.js`). Full control needs the native app. The PWA and native app keep separate storage.

---

## XVI-b. Front Door, Tester Feedback & the Phrase Corpus (builds 0.10.0 – 0.11.0)

**Front door** (`actions/onboarding.js`, self-rendering): a 3-card skippable intro on first run (`BOSS_ONBOARDED`), then a **Home** screen (input, tappable example requests, *What can BOSS do?*, Settings, Quick intro, Send feedback, *Enter the field*). Home shows on launch unless switched off (Settings → *Show home screen on launch*, `BOSS_HOME`); the 🏠 pill returns to it. Typed `help`, `what can you do`, `show me around`, `home` are answered by this layer before scoring (no node, no gap logged). Copy and example lists are data at the top of the module.

**Speaking animation (`actions/waveform.js`, build 0.12.0, motion fix 0.13.0).** A visual cue while BOSS speaks (cyan) or listens (amber, calmer): a **strip** above the input box (hidden when idle; tap to collapse to a thin line), a **ring** radiating from the SOMA node, or **off** (Settings → *Speaking animation*, `BOSS_WAVE`). It is **synthetic by design**: `speechSynthesis` exposes no audio, so the animation is driven by `Voice.onSpeak('start' | 'end' | 'boundary')` events plus smooth motion — it means "BOSS is speaking", not "this is the sound". The level source is isolated in `_level()` so a real analyser can replace it if BOSS ever plays audio it controls. Under reduce-motion it moves slowly and gently ("breathing") rather than freezing, so it never looks broken; it only runs animation frames while active.

**Boot animation (`actions/boot.js`, build 0.13.0).** On launch the BOSS logo, as a 3D badge, illuminates alone in the dark, tumbles over and lands face-up as a thin hexagonal tile on one cell of a hexagonal grid wrapped around a large sphere (a geodesic mesh, drawn in 3D and turning slowly); the grid lines start almost black and light pulses run along them from the badge, branching unevenly (random per-edge delays, two waves) and leaving each line a little lighter; the status words sit in one row that always fits the screen, then the field takes over (~4.7 s, tap or press a key to skip). It plays **once per session** (first open or reopening the app) and **again after an update** (Update BOSS / the "BOSS updated" banner clear the session flag); a plain reload within the same session skips it. Settings → *Boot animation on launch* (`BOSS_BOOT`) turns it off. Reduce-motion (system setting or Settings → Reduce motion) plays a calmer version: a short soft drop and slower pulses. The overlay `#boot` sits right after `<body>` so the field never flashes first, with a 9 s safety removal; the intro/Home screen starts after it finishes.

**Tester feedback** (`actions/feedback.js` + `actions/feedback-ui.js`, modular): every pulse is logged locally (node, route reason — claim/score/arbiter/clarification/clarified — and outcome). A **✋ Not what I meant** chip appears for 30 s after each pulse (optional expected node + note). Settings → *Send feedback* builds a `boss-feedback/1` JSON report with a preview, per-section toggles and masking (numbers, emails, links; remember/note text reduced to the verb). Nothing is sent automatically. **Delivery is a pluggable transport** — built in: *Share…* (system sheet, file attached) and *Save file*; a backend later is one `Feedback.registerTransport({id:'http', …})` call. Never included: vault, notes, keys, clipboard, location, files, contacts.

**Phrase corpus** (`tests/phrases.tsv`, `tests/phrases_more.tsv`, `tests/run_corpus.py`): ~250 realistic requests with the node each should reach. `window.BOSS_route(intent)` is a side-effect-free routing preview the runner uses (`pip install playwright`, serve the repo root, `python3 tests/run_corpus.py`; add `--stress` to re-run every phrase with each node "warm" — recency is part of the scoring, so a node just used gets a head start). Every tester miss that names an expected node can be exported as corpus lines (`Feedback.toCorpusTsv`). Run it after any vocabulary or claim change.

**Amendments documented in this build (claims, not physics):**

| Claim | Routes to | Why |
|---|---|---|
| clipboard-media | MEDIA | "play the video from my clipboard" took the text-tools clipboard claim; the claim is now verb-aware and substitutes the clipboard link |
| voice / identity / reset settings | SOMA | unmistakable phrases scored as noise |
| weather, clock, "remind me in N…", "wake me up at…" | CHRONOS | shared words with MEMORY / noise |
| notes, vault, memories, "remember/note/forget …" | MEMORY | |
| where am I / backup | CORE | |
| general-knowledge questions ("who wrote…", "how do I…") | CORTEX | "who" collided with SOMA |
| **no-signal fallback** | CORTEX | when the top score is at the n-gram noise floor (< 0.245) and the request is conversational, route to the generalist instead of a coin flip. Statements with no signal still reach the Birth Protocol unchanged |

Also: COMMS parses polite/long forms ("can you send an email for me", "make a phone call", "dial 112"); native-only matching normalises verb variants ("switch on the bluetooth"); CORTEX says plainly that open questions need an AI engine key when none is set; MEDIA gained *louder / quieter / softer*.

**Amendment — decisive margin (build 0.11.0).** `confThreshold` (1.5) was larger than any achievable score (≈ 1.0), so *every* request entered the Arbiter, and with no engine key and two side-effect nodes even clear wins (`play music`: MEDIA 0.93 vs CORTEX 0.23) ended in a blocking "which did you mean?". The Arbiter now runs only when the top two nodes are within a **decisive margin** (default **0.35**, `Learning.BASE_MARGIN`); a larger lead wins outright (logged `via: margin`). Real near-ties are handled exactly as before (Active-First, dissonance, engine, clarification, hard grief for elevated risk). Scoring is untouched. Result on the corpus: requests blocked by a clarification fell from 32 to 0 of 256, with 0 wrong routes.

**Learning (`actions/learning.js`, on-device, switchable).** BOSS adapts only from explicit signals — your answers to "which did you mean?" and your "✋ Not what I meant" flags:
- **Pair preferences:** after ≥ 3 answers with a ≥ 75 % majority for the same pair, BOSS applies your choice and stops asking (logged `🎓 Learned preference`). One contrary answer weakens it, so preferences can reverse. Pairs with an elevated-risk node are never auto-resolved.
- **Personal margin:** starts at 0.35; each answer that keeps BOSS's first pick tightens it by 0.01 (fewer prompts), each override widens it by 0.02, a flagged margin-bypass by 0.03. Bounded to **0.20 – 0.55**.
- Stored in `BOSS_LEARNED` (included in Backup); Settings → *Learning* shows the current margin and learned pairs, can switch learning off (restores default behaviour exactly) or forget everything. Only counts reach the tester report. Not built: learning from successful actions or silence, cross-device sharing, anything that changes node vocabulary.

**Conversation layer (`actions/dialogue.js`, build 0.14.0).** BOSS now handles small talk and follow-ups **before** field routing, as a layer rather than a node: it holds no warmth, bonds or resonance, so chatting cannot bias where the next request goes (this also means it does not depend on the pending recency-cap amendment). Order for every request: (1) **safety** — a few unmistakable distress phrases get a fixed, kind reply pointing to real support (local emergency number, 988 in the US, findahelpline.com elsewhere), identical in every tone, offline; (2) **pending question** — after "set a timer" BOSS asks "for how long?" and the next message fills the slot (60 s window; same for alarms); (3) **pleasantries** — "thanks, set a timer for 5 minutes" / "hey, play music" / "play music please" are peeled off, the request routes normally, and BOSS acknowledges afterwards; (4) **follow-ups** — "and in London?" (after a clock/weather request), "make it 10" (after a timer), "again", "cancel that", "another one" (after a joke) are rewritten into full requests using the last action (10-minute window) and then routed normally, so every existing safeguard still applies; (5) **small talk** — greetings, thanks, goodbyes, how-are-you, compliments, "ok/yes/no", sorry, never mind, "let's chat", bored/tired/low moods (with tap-to-run suggestion chips), local jokes; (6) otherwise `pass` — routing is unchanged. **Personalities** (Settings → *Personality*, `BOSS_TONE`): warm (default) · concise · playful · formal · dry — hand-written reply banks with name/time-of-day slots and a shuffle bag (no back-to-back repeats). Offline small talk is a finite script by design; unmatched open conversation is not faked — it falls through to CORTEX, which says plainly that an engine is needed. With an engine connected, the chosen tone plus the last six turns are prepended to CORTEX's question prompt (`Dialogue.promptContext()`), so open chat sounds the same. Mood/distress messages are logged in the tester report as `[private]`. Interactions with existing behaviour: "tell me a joke" is now answered locally (it used to go to CORTEX); "how are you" is answered in the chosen tone (SOMA's field-mood reply is still reachable via "status"/"how's the field"); "who are you" is untouched. Tests: `tests/phrases_chat.tsv` (130 phrases, includes traps such as "thanks, set a timer"); the older corpora changed only where chat deliberately took over three phrases. A local, privacy-first model as an engine source (Ollama today; an in-browser model later; on-device models in the native app) is a separate, planned step. **Build 0.14.2 additions (from the first tester reports):** (a) *news and feelings* — "I got a promotion", "I had a great day", "I'm so happy", "I hope tomorrow goes better", and bad news ("I lost my job", a bereavement) get a fitting reply in the chosen tone instead of a "which did you mean?" question; bad news is logged `[private]` and offers calm music / a breather timer and points to people they trust; (b) *honest limits* — questions about data that lives in the phone's own apps ("how many unread messages", "do I have meetings this afternoon", "what missed calls do I have") now say plainly that the browser version can't see it and what BOSS can do instead; these, and open-ended opinion questions when no engine is connected ("what do you think about turtles"), are recorded as gaps so the team sees them; (c) *offline unit conversion* — "how many ounces in a cup", "convert 5 km to miles", "what is 100 f in c" (length, weight, volume, time, temperature; US measures for cups/pints/gallons); (d) a bare video/audio link offers a ▶ Play chip; (e) "Not what I meant" now also applies to chat replies. Related fixes in the same build: timers and alarms are CHRONOS's by a deterministic claim (a warm CORTEX or MEMORY no longer wins "set a timer for 5 minutes"; the stress run shows 0 wrong timer routings with any node warm), number words work in alarms ("alarm at nine thirty" = 09:30; it briefly read as 39:00 during testing), lower-case voice text such as "text sarah i'm running late" is understood, the ✋ **Not what I meant** chip is tappable again (the full-screen canvas was swallowing taps), and the Settings/report "worker" version now reports correctly. **Build 0.14.3** (second tester round): "alarm at 9.30" was silently set for 09:00 and now reads as 09:30 (also "alarm 8:05", "alarm 7pm", "alarm for 6:45 am"; decimals such as "1.25 hours" are untouched), and conversions understand fractions ("a quarter cup", "half a tablespoon", "1/2 litre", "2 and a half km"). Measured, not yet fixed: a recently used ("warm") node makes open-ended questions misroute or trigger a needless "which did you mean?" (see the recency amendment under review).

**Amendment (build 0.14.4) — recency ceiling and match-based no-signal.** Two small changes to scoring, approved after measurement (`tests/measure_recency.py`; 455 phrases, each node made warm in turn). *Problem:* the thermal term is `warmth × match`, and warmth can reach 10, so a node used a few seconds ago could out-score nodes whose words matched the request better, and it also lifted the total above NOISE_FLOOR on phrases nothing recognised — so "tell me a quick random fact" went straight to CORTEX on a fresh start but became a pointless "which did you mean?" mid-session. *Changes:* (1) **`WARM_CAP = 0.3`** — in `score()` the thermal term uses `min(warmth, WARM_CAP) × match`. The lock "warmth × match" is unchanged and the warmth value itself (glow, decay, bonds) is untouched; only its ceiling in scoring is new, so recent use can nudge a result but not decide it. (2) **match-based no-signal** — `noSignalClaim` now sends a plain-language question/request to CORTEX whenever *no node's words resemble it* (every match < BIRTH_THRESHOLD), instead of testing the total score (which includes warmth); phrases that any node genuinely matches are unaffected. *Measured (warmth = one recent use):* wrong routings 60/3,136 → 12/3,185; needless clarifications 42% → 0%; all 455 phrases still correct on a fresh start. *Known residuals:* a warm CORTEX can still take a few real requests ("how is the battery", "status", "open a file") before the Arbiter resolves them (in a live test "battery level" was resolved correctly by the Arbiter), and a warm SOMA can take two open-ended phrases. The cap value is a single number: 0.2 measured slightly better but nearly switches recency off; 0.3 was chosen to keep it a real, modest influence. Re-measure with real tester phrases before changing it.

**Amendment (build 0.14.5) — bond rebalancing, and timers that follow your intent.** *Problem:* `bondSignal × 2` was added to a node's score whether or not its words matched the request at all; bonds grow +0.1 per node-to-node transition, never decay and have no ceiling (runaway Hebbian strengthening with no homeostasis). In the 0.14.4 iPhone report, one mis-route to CORE grew its score to 1.0–1.85 on unrelated phrases, which then mis-routed "Set a time for 5 minutes", "And dogs?" and "I have a football match later today". *Change:* in `score()` the bond term is scaled by `min(1, match / BOND_FULL_MATCH)` with `BOND_FULL_MATCH = 0.5` — a bond counts in full only when the node's words genuinely fit, and proportionally less below that. The lock (`bondSignal × 2`) and the bond mechanics themselves (formation, lookback, decay constant) are unchanged; only what a bond is allowed to *carry* is. *Measured* (`tests/measure_bonds.py`: every node given two partners at bond strength 0.4, every "last node" used, 455 phrases): wrong routings 504 → 172 of 9,555 and needless "which did you mean?" 812 → 0; at the 470-phrase corpus on 0.14.5, wrong 175/9,870 and needless questions 0 (bond strength 0 → 0 wrong). A residual ~1.8% remains with strong bonds and is the next thing to watch in tester reports. *Timers (CHRONOS + dialogue, no scoring change):* a plain "set a timer for N" **adds**; "change the timer to N", "…instead", "replace…" and the follow-up "make it N" **replace** the latest; "cancel timer" with one running cancels it, with several **asks which** (Latest / All / each); "cancel all / the latest / the 5 minute timer" and "cancel the alarm" act on exactly that (timers and alarms are no longer cancelled together); "set another timer" asks how long and offers the last length. *Also in 0.14.5:* a places question ("best fish soup near me") is no longer read as "where am I" (new `places` claim → CORTEX); "send an email to <name> saying …" is handled by COMMS; "and dogs?" after an opinion question repeats the honest no-engine answer; a plan ("I have a football match later today") gets a friendly reply with Note it / Set a timer; "half an hour" is now 30 minutes (it was read as one hour).

**Build 0.14.6 — feedback-report privacy fix.** The optional console section of a feedback report masked phone-number-like digits with a pattern that also ate part of the timestamp and missed coordinates: a PC report exported after "where am i" still carried the longitude, accuracy and city. New `redactLog()` (actions/feedback.js): the timestamp is kept intact; any line carrying a location or weather *result* (📍 / 🌤 / coordinates / accuracy) is replaced by a placeholder; coordinate pairs are masked everywhere. Request text masking (emails, numbers, links, `remember …`) is unchanged.

**Build 0.14.7 — one friendly line instead of the CORTEX menu.** When a request reaches CORTEX, nothing local recognises it and no AI engine is connected, BOSS used to print "no recognised action" followed by a four-line command menu (Analyse / Explain / Reason / Status) and pop the orbital. It now says in one line, in the user's chosen tone, that the question needs an AI engine (Settings → Engine keys) and what BOSS can do offline, with *What can you do?* / *Tell me a joke* chips. The gap is still logged exactly as before (so reports and the gap log are unchanged); with an engine connected nothing changes. New hook: `window.BOSS_noEngine` (index.html) ← `Dialogue.noEngine()` (new `noengine` bank, five tones).

## XVII. Direction After v1.0 — The Intelligence Structure

*Status: design direction, not built. Full design: `docs/UNDERSTANDING-LAYER.md`.*

**The question.** BOSS recognises requests by counting shared *words* between a phrase and each node's
vocabulary, plus hand-written rules. That is excellent for wording we planned for and weak for wording we
didn't. Three tester rounds showed two different problems — **mechanism bugs** (dynamic state distorting
scores) and the **long tail of language** — and only the second needs new intelligence.

**The answer, in BOSS's own terms: a layered nervous system.** Bodies do not use one intelligence for
everything; they use cheap, fast, reliable layers first and escalate only when those are unsure. BOSS already
has most of the layers. What it lacks is *perception by meaning*.

| Biology | Role in a body | In BOSS | Status |
|---|---|---|---|
| **Reflexes / innate immunity** | Fixed, fast, identical in every body | Claims (`INTENT_CLAIMS`), parsers, the Dialogue layer | ✅ Built |
| **Thalamus / sensory cortex** | Relays raw input to the right place **by meaning**; gates attention | **Understanding Layer** — embedding similarity over a capability manifest | ⬜ Proposed |
| **Hippocampus / adaptive immunity** | Remembers *this* individual; repetition consolidates into lasting knowledge | Personal phrase memory (user-visible, resettable); the Learning module | 🟨 Partial |
| **Synapses (Hebbian learning)** | Strengthen with use — *and are rebalanced so they cannot run away* (homeostatic scaling) | Bonds and warmth | 🟨 Bonds lack rebalancing (below) |
| **Prefrontal cortex** | Slow, costly, flexible reasoning | CORTEX + deliberation layer (remote API now; a local model is just another backend mode) | ✅ Built |
| **Self / non-self discrimination** | Refuses what would harm the body | Arbiter, risk tiers, confirmation for side-effect actions | ✅ Built |
| **Genome vs lifetime** | What every body is born with vs what this one learns | Shipped model + capability manifest (identical everywhere) vs personal memory (different on every BOSS) | ⬜ Proposed |

**Escalation rule:** act at the cheapest layer that is confident; escalate only when it isn't —
*reflex → perception → memory → deliberation.* The costly layers therefore see the fewest requests.
The metaphor is a design guide, not evidence: every claim that a layer *works* rests on measurement.

**The Understanding Layer is an operator, not a governor.** It reads a request, proposes which part of BOSS
should handle it, and the kernel decides — exactly as today. It is consulted **only where routing currently
gives up** (conflict, no signal, Arbiter tie-break), so nothing that works today is touched. Per-user learning
is a *visible memory of confirmed phrases*, not hidden retraining. It enters in **shadow mode** (records what
it would have proposed, changes nothing) and is promoted only on real tester data.

**Embeddings already exist in BOSS — on PC.** The optional Python cortex feeds `vectorBoost` from the same
`all-MiniLM-L6-v2` model. A phone has no cortex, so there `vectorBoost` is always 0. The proposal brings that
capability into the app itself so it works everywhere; it extends an existing mechanism.

**Evidence so far** (`tests/experiments/embeddings/`; reference phrases only from data BOSS already ships):
on 73 fresh paraphrases today's routing is directly correct on 46 (63%); consulting embeddings *only where it
gives up* raises that to 53–54 (73–74%) with **0 broken**, and 454 of 455 existing corpus phrases are
unchanged. Embeddings alone (84% on the tuned corpora) do **not** beat the tuned rules, so nothing is replaced.
Caveat: the fresh set was written by one person after seeing the failures — your tester rounds are the
independent check.

**Applied in build 0.14.5 — bond rebalancing.** `bondSignal × 2` was added to a node's score whether or not its words matched the request; bonds grow +0.1 per node-to-node transition, never decay and have no ceiling. In the 0.14.4 iPhone report one mis-route to CORE grew its score to 1.0–1.85 on unrelated phrases, which then mis-routed other requests. This is runaway Hebbian potentiation without homeostasis. The bond term is now scaled by `min(1, match/0.5)`, so a bond nudges a close call but can no longer carry a node that does not fit. Measured with realistic bonds of 0.4: wrong routings 504 → 172 of 9,555, needless "which did you mean?" 812 → 0. Details: §XVI-b, amendment 0.14.5.

**Language.** English first, kept modular: language-specific wording lives in data (a *locale pack*) separate from language-neutral logic, and the capability manifest stores examples per language from day one. A language counts as supported when its pack passes its own corpus at the same bar as English. See design note §16.

**Roadmap for this direction** (each step gated; see the design note §13): 0.14.5 bond fix (done) → test pass and v1.0 →
capability manifest and the `understand()` contract (no behaviour change) → in-browser model spike on a real
iPhone → shadow mode → promote the fallback tier → personal memory → *conditionally* a trained classifier, a PC
"judge" model (e.g. OpenJev-style) for Arbiter conflicts, or a local generative mode — only if measurements show
the lightweight approach has plateaued.

---

## XVIII. Related

**boss-deliberate** — https://github.com/nztdev/boss-deliberate
The deliberation layer as a standalone product. Ask once, filter many — multi-model consensus with a full transparency trace.

---

*The Web is waking up. It's time to give it a Nervous System.*

Inspired by the theoretical concepts of the resonance-web (by __Dosage2AG__). It moves beyond the original theory by introducing physical decay constants, a sovereign PWA Soma, a hardened executive bridge, and an autonomic Heart that keeps the field alive between conscious interactions.

---

MIT License · github.com/nztdev/boss-kernel
