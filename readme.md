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
├── core/index.html        — Soma v0.9 (Arbiter, intent claims, modals)
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
│   ├── voice.js           — Speech in/out
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
| 9 | Tool calling, gap detection, risk-tiered Grief | ✅ Complete (pending final retest) |
| 9b | Pre-wrap capability build: state backup, encryption, location, weather, voice, vision/clipboard, app launcher + Shortcuts bridge, COMMS-light, native-only layer, BROWSER stub | ✅ Complete (device-tested) |
| 10 | Native wrap (Capacitor): implement the 📱 Native items, DEVICES adapters, BOSS Browser, silent app launching, reliable alarms, Tailscale guide | Pending |
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

**Known limits.** iOS Safari requires a tap for some actions (file picker, camera, clipboard read) so typed intents may only get as far as pointing you to the button. Browsers cannot confirm that an app link opened. Alarms need the app open. Web Bluetooth is not available on iOS Safari. Biometric unlock was verified to fall back correctly but not on real biometric-capable hardware. The PWA and native app keep separate storage.

---

## XVII. Related

**boss-deliberate** — https://github.com/nztdev/boss-deliberate
The deliberation layer as a standalone product. Ask once, filter many — multi-model consensus with a full transparency trace.

---

*The Web is waking up. It's time to give it a Nervous System.*

Inspired by the theoretical concepts of the resonance-web (by __Dosage2AG__). It moves beyond the original theory by introducing physical decay constants, a sovereign PWA Soma, a hardened executive bridge, and an autonomic Heart that keeps the field alive between conscious interactions.

---

MIT License · github.com/nztdev/boss-kernel
