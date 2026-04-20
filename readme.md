# B.O.S.S. Kernel v0.6 — Biological Operating System Structure

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
- **Offline Sovereignty:** The kernel physics run entirely in the browser. It does not require the Cortex to breathe — only to act.

### 2. The Heart (Autonomic Rhythm)

The `heart/` module is the metabolic sustainer — the process that keeps the field alive between interactions.

- **Persistent Rhythm:** Fires every 30 seconds regardless of user activity. Autosaves field state, normalises bond weights, prunes stale vault entries.
- **Battery-Aware Decay:** Reads device battery state and adjusts the field's decay rate — the system breathes slower when power is low.
- **Bond Normalisation:** Synaptic connections between co-activated nodes decay at 2% per beat. Strong bonds persist through use; abandoned connections fade. The field has long memory but not permanent memory.
- **Background Capable:** Designed for eventual autonomic operation — what the Heart does is what needs a background process when BOSS becomes a native application.

### 3. The Cortex (Semantic Nervous System)

The `cortex/` bridge provides the high-fidelity link to the local OS and neural networks.

- **Vector Sharpening:** Employs `all-MiniLM-L6-v2` for semantic mapping. Uses Mean-Subtracted Relative Boosting to sharpen the Soma's interference pattern without global field inflation.
- **Secure Executive:** A hardened whitelist for system-level execution using absolute pathing and zero shell injection.
- **Proactive SSE:** Server-sent events push file system changes and urgent signals into the field without polling.

### 4. The Arbiter (The Amygdala)

A conflict resolution protocol that monitors the Delta between intent signals.

- **The Delta Gate:** Identifies Command Confusion when multiple nodes resonate at similar frequencies.
- **Soft Path:** Passive nodes in conflict surface a clarification toast — the user corrects, the kernel continues.
- **Hard Path (Grief Protocol):** Action nodes in conflict suspend the kernel entirely. Side effects are irreversible — the system waits for conscious recovery.

### 5. The Engine (Deliberation Layer)

The `engine/` module is the LLM consensus system — shared with the standalone `boss-deliberate` PWA.

- **Multi-model deliberation:** Consults multiple LLMs in parallel, measures output dissonance, escalates to a tiebreaker when models disagree.
- **Plugs into the Arbiter:** When local semantic resolution fails, the engine is the next escalation tier.
- **Standalone product:** Also available as `boss-deliberate` — a PWA that exposes the deliberation layer directly to users as a multi-model question answering interface.

---

## V. Routing Physics

```
score = (warmth × match)                     thermal   — intent gates recent activation
      + resonance × (1 + 0.3 × sin(phase))  standing wave — accumulated reliability
      + bondSignal × 2                       synaptic  — learned co-activation
      + vectorBoost × 2                      cortex    — embedding-based sharpening
```

`warmth × match` is a multiplication, not addition. Intent gates thermal energy — a warm but irrelevant node does not fire.

---

## VI. The Six Nodes

| Node | Resonance | Role | Path |
|------|-----------|------|------|
| CORE | 2.0 | System health, diagnostics, battery | Passive |
| SOMA | 1.8 | Identity, interface, appearance | Active ⚡ |
| CORTEX | 1.6 | Reasoning, analysis, logic | Passive |
| MEMORY | 1.5 | Recall, storage, vault | Passive |
| MEDIA | 1.4 | Audio, music, playback | Active ⚡ |
| CHRONOS | 1.3 | Time, schedule, alarms | Active ⚡ |

Active nodes trigger the hard Arbiter path when in conflict. Passive nodes trigger the soft clarification path.

---

## VII. Running Locally

**Soma only (offline):**
Open `core/index.html` directly in a browser. No server needed.

**With Cortex:**
```bash
pip install flask flask-cors sentence-transformers torch
python cortex/cortex.py
```
Open the Soma and tap the cortex pill in the status bar to configure the endpoint URL.

---

## VIII. Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation audit | ✅ Complete |
| 1 | Engine validation | ✅ Complete |
| 2 | Deliberate PWA | ✅ Complete |
| 3 | Heart extraction | ✅ Complete |
| 4 | Semantic seed iteration | 🔄 Current |
| 5 | Cortex hardening | Pending |
| 6 | BOSS integration | Pending |
| 7 | Native wrap (Capacitor) | Pending |
| 8 | Future components | Pending |
| 9 | v1.0 stabilisation | Pending |

---

## IX. Related

**boss-deliberate** — https://github.com/nztdev/boss-deliberate
The deliberation layer as a standalone product. Ask once, filter many — multi-model consensus with a full transparency trace.

---

*The Web is waking up. It's time to give it a Nervous System.*

Inspired by the theoretical concepts of the resonance-web (by __Dosage2AG__). It moves beyond the original theory by introducing physical decay constants, a sovereign PWA Soma, a hardened executive bridge, and an autonomic Heart that keeps the field alive between conscious interactions.

---

MIT License · github.com/nztdev/boss-kernel
