# B.O.S.S. — Agent Session Brief (BOSS_CONTEXT.md)
**Repo:** https://github.com/nztdev/boss-kernel
**Live:** https://nztdev.github.io/boss-kernel/core/
**Current phase:** Phase 4 — Semantic seed iteration
**Current task:** Run 25-intent routing test suite. Record results. Propose seed adjustments. Do not commit anything.

> Read this file fully before starting.
> This is an OBSERVATION and REPORTING task — do not modify any files.
> Use the live kernel at the URL above to run each test.
> Record exactly what the kernel logs for each intent.
> Bring all results and proposed adjustments back to Claude for review.

---

## What B.O.S.S. is

B.O.S.S. (Biological Operating System) is a resonant routing kernel.
Users send intent pulses into a field of autonomous nodes. The node with
the highest resonance frequency fires. The system is metabolic — nodes
decay when unused and learn from co-activation patterns.

---

## Current component state

| Component | Location | Status |
|-----------|----------|--------|
| Soma | `core/index.html` | Active — browser interface, canvas, field physics |
| Heart | `heart/heart.js` + `heart/heart.py` | Active — metabolic loop, autosave, bond normalisation, vault maintenance |
| Cortex | `cortex/cortex.py` | Active — Python server, embeddings, SSE |
| Engine | `engine/engine.js` | Active — shared LLM deliberation module |

---

## Architectural locks — never modify these

```
1. score(): warmth × match — MULTIPLICATION not addition
2. Decay: Math.exp(-rate * elapsed_seconds) — not per-frame
3. vectorBoost: mean-subtracted RELATIVE score
4. Arbiter: TWO-STAGE gate (delta < threshold → dissonance check)
5. Active-First tier-breaker: ACTIVE_NODES = Set(['MEDIA','SOMA','CHRONOS'])
6. GRIEF_PENALTY = 0.4
7. Cortex URL: localStorage.getItem('BOSS_CORTEX_URL') — never hardcoded
8. Save interval: exactly 30000ms — localStorage key: 'BOSS_KERNEL'
9. Heart beat runs: normaliseBonds → maintainVault → save (in that order)
10. No DOM references in heart.js
```

---

## Current node seeds (the strings being tested)

These specialty strings are what the semantic scoring runs against.
They are the only tunable parameter in the routing physics.

```
CORE    (res:2.0) — health battery power status diagnostics system reboot uptime integrity vitals
SOMA    (res:1.8) — identity self id interface look feel appearance theme color ui somatic
CORTEX  (res:1.6) — ai logic intelligence think reason analyse evaluate process decide infer
MEMORY  (res:1.5) — recall retrieve stored information data records vault database archive remember
MEDIA   (res:1.4) — music sound audio playback play volume frequency track song speaker sensory
CHRONOS (res:1.3) — time schedule clock calendar timer alarm duration routine when last history
```

Active nodes (have action callbacks, trigger hard Arbiter path):
MEDIA, SOMA, CHRONOS

Passive nodes (no action callbacks, trigger soft Arbiter / clarification toast):
CORE, CORTEX, MEMORY

---

## Heart constants (for context — do not modify)

```javascript
BOND_MAX:         2.0    // bond ceiling
BOND_PRUNE:       0.02   // bond floor — below this, bond is deleted
BOND_DECAY_RATE:  0.98   // per beat — bonds lose 2% every 30s
VAULT_MAX_AGE_MS: 604800000  // 7 days
VAULT_MAX_SIZE:   200
```

---

## Phase 4 task — semantic seed testing

### How to run each test

1. Open https://nztdev.github.io/boss-kernel/core/ in Chrome
2. Open DevTools → Console (to see full scoring detail if needed)
3. For each intent: type it into the pulse input and press PULSE
4. Read the console log — it shows scores for top 3 nodes and the winner
5. Record: winner, top 3 scores, whether Arbiter fired, whether it was correct

### What correct routing looks like

The console logs this format after each pulse:
```
⚡ "[intent]"
   NODE1=2.45 | NODE2=1.87 | NODE3=1.23
📡 WINNER | freq=2.45 Δ=0.58
```

A **PASS** is when the expected node wins.
A **FAIL** is when a different node wins, or the Arbiter fires unexpectedly.
A **PARTIAL** is when the right node wins but the margin is dangerously thin (Δ < 0.3).

### Important: reset between test groups

After every 6 tests, open DevTools → Application → Storage → Clear site data
and reload. This prevents warmth accumulation from one test biasing the next.
Warmth from recent activations inflates subsequent scores for that node.

---

## The 25-test suite

Run tests in order within each group. Clear state between groups.

---

### Group A — Clean unambiguous routing (no Arbiter expected)
*Expected: winner is clear, Δ > 0.5, no Arbiter fires*

| # | Intent | Expected winner | Notes |
|---|--------|----------------|-------|
| A1 | `play some music` | MEDIA | Core media intent |
| A2 | `check battery level` | CORE | Core system intent |
| A3 | `who are you` | SOMA | Identity intent |
| A4 | `what time is it` | CHRONOS | Core time intent |
| A5 | `remember the meeting is at 3pm` | MEMORY | Vault write command |
| A6 | `analyse this problem logically` | CORTEX | Core reasoning intent |

---

### Group B — Semantic proximity (Arbiter may fire, correct node must win)
*Expected: Arbiter fires, correct node wins via dissonance check or Active-First*

| # | Intent | Expected winner | Why it's hard |
|---|--------|----------------|---------------|
| B1 | `play my morning routine` | CHRONOS or MEDIA | "play" → MEDIA, "routine" → CHRONOS — Active-First should resolve |
| B2 | `check my schedule` | CHRONOS | "check" → CORE, "schedule" → CHRONOS |
| B3 | `how does my system look` | CORE or SOMA | "system" → CORE, "look" → SOMA |
| B4 | `remember when I last played music` | MEMORY | "remember" + "last" + "music" — MEMORY should win over MEDIA |
| B5 | `think about what music to play` | CORTEX or MEDIA | "think" → CORTEX, "music play" → MEDIA |

---

### Group C — Cross-domain stress (routing must not break)
*Expected: a reasonable node wins, no crash, Arbiter handles gracefully*

| # | Intent | Expected winner | Notes |
|---|--------|----------------|-------|
| C1 | `what is the frequency of my heartbeat` | CORE or MEDIA | "frequency" in MEDIA seed, "health" in CORE |
| C2 | `store the audio settings` | MEMORY or MEDIA | "store" → MEMORY, "audio" → MEDIA |
| C3 | `set an alarm for when the song ends` | CHRONOS | Temporal intent dominates |
| C4 | `how long have I been using this` | CHRONOS | Duration/history intent |
| C5 | `show me the interface theme` | SOMA | Appearance intent |

---

### Group D — Edge cases (system robustness)
*Expected: kernel doesn't crash, logs a result, Birth Protocol fires on D4/D5*

| # | Intent | Expected winner | Notes |
|---|--------|----------------|-------|
| D1 | `x` | Any | Single character — should still route |
| D2 | `play play play play play` | MEDIA | Repetition — MEDIA should win clearly |
| D3 | `SYSTEM CHECK STATUS NOW` | CORE | Caps — normalisation should handle it |
| D4 | `quantum entanglement probability` | Birth signal | No node should match — BIRTH SIGNAL expected in log |
| D5 | `zorp the frambulator` | Birth signal | Nonsense — BIRTH SIGNAL expected in log |

---

### Group E — Bond signal test (run AFTER groups A-D without clearing state)
*Do NOT clear state before this group — bond signal is what's being tested*

First, prime the bonds by running these two intents in sequence:
- `play music` (fires MEDIA)
- `set a timer` (fires CHRONOS)

Run this sequence 3 times to build bond signal between MEDIA and CHRONOS.

Then test:

| # | Intent | Expected winner | What's being tested |
|---|--------|----------------|---------------------|
| E1 | `stop the track` | MEDIA | Bond signal: CHRONOS→MEDIA should boost MEDIA |
| E2 | `how long has it been playing` | CHRONOS | Bond signal: MEDIA→CHRONOS should boost CHRONOS |
| E3 | `analyse the rhythm` | CORTEX | Bond signal should NOT override semantic match |

E3 is the critical one — if bond signal causes MEDIA or CHRONOS to win over CORTEX on a clear reasoning intent, the bond weight is too strong relative to semantic match.

---

## What to record for each test

For each of the 25 tests record:

```
Test:     [ID and intent]
Winner:   [node name]
Scores:   [top 3 node=score]
Delta:    [gap between 1st and 2nd]
Arbiter:  [fired Y/N, outcome if Y]
Result:   [PASS / FAIL / PARTIAL]
Notes:    [anything unexpected in the log]
```

---

## What to report back

1. Full results table (all 25 tests)
2. List of FAIL and PARTIAL results with the actual vs expected winner
3. For each FAIL: which seed words are causing the wrong node to win
4. Proposed seed adjustments — specific words to add or remove from specific nodes
5. Bond signal assessment from Group E — is bond weight too strong, too weak, or correct?
6. Any unexpected Arbiter behaviour

Do not modify any files. Do not commit anything.
Bring everything back to Claude for review before any seeds are changed.
