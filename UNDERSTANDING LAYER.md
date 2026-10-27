# B.O.S.S. — The Understanding Layer
## Design note · post-v1.0 direction

**Status:** proposal — **nothing in this note is built, and nothing in it changes how the kernel behaves today.**
**Written:** 2026-10-22, after builds 0.14.1–0.14.4 and three tester rounds.
**Reads with:** README §XVII (the biological pattern), §XVI-b (amendments), `docs/ARCHITECTURE.md`.

---

## 1. In one paragraph

BOSS understands a request today by counting how many of its *words* match each node's vocabulary, plus
hand-written rules (the claims). That works well for the wording we planned for and poorly for wording we
didn't. The fix is **not** to replace this, and **not** to put a language model in charge. It is to add a small
**understanding layer** — a *thalamus*, in the biological pattern — that judges what a request *means*, proposes
which part of BOSS should handle it, and lets the kernel decide. It is consulted only where today's routing
gives up. It learns about each user through a personal memory of confirmed phrases, not by retraining.
It is introduced in **shadow mode** (watching, never acting) and promoted only when real measurements justify it.

---

## 2. Why — what the testing actually showed

Three tester rounds found two *different* kinds of failure:

| Kind | Example | Fix |
|---|---|---|
| **Mechanism bugs** — dynamic state distorting scores | Warm nodes out-scored better matches (fixed 0.14.4). Bonds grow without limit and push unrelated nodes up: after one mis-route CORE scored 1.0–1.85 on unrelated phrases ("Set a time for 5 minutes" → CORE). | Fixed in the kernel in build 0.14.5 (bond gating — README §XVI-b). A model on top would have inherited the bug. |
| **The long tail of language** — wording nobody wrote a rule for | "put on some tunes", "give Anna a call", "how much juice is left on my phone", "compose an email to the landlord" | This note. |

On 73 fresh paraphrases written for this purpose, the current routing handled **46 (63%)** directly.
Hand-written rules grow with *capabilities × phrasings*, and every new rule can interact with old ones.
That is the scaling concern. It is real, but it is not yet a wall — the measurement in §10 is how we find out.

---

## 3. Principles (unchanged by this proposal)

1. **The model proposes; the kernel disposes.** Nothing in this layer can execute anything. Side-effect
   actions still go through the Arbiter and the confirmation step.
2. **Offline-first.** The baseline understanding layer must run on the device with no network.
3. **Deterministic where it matters.** Claims, parsers (durations, times, names, numbers) and safety checks stay
   as rules. The layer decides *where* a request goes, not *what the numbers in it are*.
4. **Per-user learning is data, not weights.** Personalisation is a memory the user can read, reset and export —
   never an invisible change to a model.
5. **Privacy.** Phrases and the personal memory stay on the device. Only a deliberate export leaves it.
6. **No runtime code generation** (permanently out of scope).
7. **Don't break what works.** Everything that passes today's corpora must pass after any change.

---

## 4. The biological pattern

Nervous systems do not use one intelligence for everything. They are **layered**: cheap, fast, reliable layers
first; costly, slow, flexible layers only when the cheaper ones are not sure. BOSS already follows this shape.
The missing layer is *perception by meaning*.

| Biology | Role in a body | BOSS part | Status |
|---|---|---|---|
| **Reflexes / innate immunity** | Fixed, fast, identical in every body; no learning needed | Claims (`INTENT_CLAIMS`), parsers, the Dialogue layer | ✅ Built |
| **Thalamus / sensory cortex** | Takes raw input and relays it to the right place **by meaning**; gates attention | **The Understanding Layer** — embedding similarity over the capability manifest | ⬜ **Proposed** (this note) |
| **Hippocampus / adaptive immunity** | Remembers *this* individual's experience; repeated experience consolidates into lasting knowledge | Personal phrase memory; the Learning module (partial today) | 🟨 Partial |
| **Synapses (Hebbian learning)** | Connections strengthen with use — and are *rebalanced* so they cannot run away (homeostatic scaling) | Bonds and warmth | 🟨 Built, but bonds lack the rebalancing (see §2) |
| **Prefrontal cortex** | Slow, costly, flexible reasoning | CORTEX + the deliberation layer (remote API now; local mode later) | ✅ Built |
| **Self / non-self discrimination** | Refuses what would harm the body | The Arbiter, risk tiers, confirmation for side-effect actions | ✅ Built |
| **The genome** | What every body is born with | The shipped model + capability manifest — identical on every BOSS | ⬜ Proposed |
| **A lifetime** | What this body learns | The personal memory — different on every BOSS | ⬜ Proposed |

**The escalation rule** (this is the biology doing real design work): *act at the cheapest layer that is
confident; escalate only when it isn't.* Reflex → perception → memory → deliberation. Energy, latency and cost
all go up as you go down the list, so the expensive layers see the fewest requests.

**The honest limit of the analogy:** it is a design guide, not evidence. Every claim in this note that a layer
*works* rests on measurement (§10), not on the metaphor.

---

## 5. Where it sits in the flow

```
 user request
      │
      ▼
 Dialogue layer ───── small talk, thanks, follow-ups, "can't see that", conversions      (reflex, built)
      │ not handled
      ▼
 Claims (INTENT_CLAIMS) ── deterministic rules                                            (reflex, built)
      │ no claim
      ▼
 Field scoring: match(words) · warmth · resonance · bonds · vectorBoost                  (built)
      │
      ├── clear winner ───────────────────────────────────────────────► execute
      │
      ├── conflict / no-signal / arbiter tie-break
      │         │
      │         ▼
      │   ┌────────────────────────────────────────────┐
      │   │  UNDERSTANDING LAYER  (proposed)           │   proposes  {node, confidence}
      │   │  1. personal memory (confirmed phrases)    │
      │   │  2. embedding similarity vs manifest       │
      │   └────────────────────────────────────────────┘
      │         │ confident & kernel-valid → route      │ not confident
      │         ▼                                       ▼
      │      execute                          Arbiter question  /  deliberation (CORTEX)
      ▼
 Arbiter (dissonance check · confirmation for side-effect nodes)                         (built)
```

Key points:

- **Only the "gives up" branches change.** A request that scores a clear winner, or is claimed by a rule,
  never reaches the new layer. That is what keeps today's behaviour intact.
- **Embeddings already exist in BOSS — on PC.** The optional Python cortex bridge uses the same
  `all-MiniLM-L6-v2` model and feeds `vectorBoost` into scoring (`+ vectorBoost × 2`, mean-subtracted).
  **A phone has no cortex, so on a phone `vectorBoost` is always 0.** This proposal brings that capability
  *into the app itself* so it works on every device, and additionally uses it as a fallback tier. It is an
  extension of an existing mechanism, not a foreign one.
- Whether the in-app model should *also* feed `vectorBoost` (changing scores, hence the locked thresholds) is a
  separate, later, measured question. **It is not part of the first step.**

---

## 6. The contract

One function is the seam between the kernel and any implementation of "understanding":

```
understand(request, context) → proposals[]

request   the user's phrase, as typed or spoken
context   { lastNode, lastIntent, activeTimers, pendingQuestion, tone, … }   (what the Dialogue layer already tracks)

proposal  {
  node        'CHRONOS' | 'MEMORY' | …            which part should handle it
  action      optional preset id from the Registry
  confidence  0..1                                 how sure
  margin      0..1                                 gap to the runner-up
  source      'memory' | 'embedding' | 'rules' | 'model'    who proposed it (for logging and trust)
  note        optional short reason, for the log
}
```

Rules the kernel applies to every proposal, whatever its source:

1. A proposal is **only a candidate**. The kernel checks it is a real node, currently enabled, and allowed to act.
2. Anything with a side effect (call, text, email, file, launch) **still goes through the Arbiter and its
   confirmation step.**
3. Below the confidence/margin floor, the proposal is ignored and the existing path (Arbiter question or
   CORTEX) runs as it does today.
4. The details inside a request (durations, times, names) are extracted by the existing parsers, **not** by the
   understanding layer.

Implementations are interchangeable behind the contract:

| # | Implementation | When |
|---|---|---|
| 1 | Today's word-overlap + rules (wrapped, unchanged) | Now |
| 2 | **Embedding similarity + personal memory** | First new implementation |
| 3 | Small trained classifier / slot tagger | Only if #2 plateaus (§9) |
| 4 | Optional heavier judge (e.g. OpenJev-style cross-encoder) for Arbiter conflicts on PC / native | Conditional, later |
| 5 | Small generative model with constrained output | Conditional, later |

Because the kernel only sees `proposals[]`, swapping #2 for #3 or #5 never touches the kernel.

---

## 7. The capability manifest (the "genome")

Every option above needs the same raw material: **what each node can do, with example phrases.** BOSS already
holds most of it:

- the *What can BOSS do?* examples (`actions/onboarding.js`, ~33 phrases), and
- the Registry's 42 presets (labels, intents, tags) — together 126 reference phrases.

The experiment in §10 used **only** these. Proposed manifest entry (extends a Registry preset — additive, so
nothing existing changes):

```json
{
  "id": "chronos_timer",
  "node": "CHRONOS",
  "label": "Timer",
  "examples": ["set a timer for 15 minutes", "start a countdown", "egg timer", "ping me in half an hour"],
  "needs": ["duration"],
  "risk": "low"
}
```

Rules for growing it:

- Adding a capability means adding a manifest entry **with examples** — data, not code.
- Every example is one the capability genuinely handles. Examples never come from the test corpora.
- The manifest ships with the app (the *genome*) and is versioned with the build.

---

## 8. Personal memory (the "hippocampus")

The layer can learn *this user's* language without retraining anything:

- **Store:** confirmed pairs — *phrase (and optional context) → node/action* — saved when the user taps the
  right answer to a "which did you mean?" question, or accepts a proposal, or corrects a wrong one with ✋.
- **Match:** a new phrase is compared against the personal examples *before* the shipped manifest, so
  "when I say 'set another' I mean repeat my last timer" wins over the generic guess.
- **Consolidation:** a phrase confirmed several times is promoted from "tentative" to "trusted"; a
  contradicted one is demoted and eventually dropped. (This is the homeostatic rebalancing the bonds lack.)
- **Transparency:** Settings → Learning lists every personal example, with delete and *forget everything*.
  It is included in Backup/export and never leaves the device otherwise.
- **Safety:** personal memory can change *where* a request is routed, never what is allowed — side-effect
  actions still confirm.

Context-dependent phrases ("And dogs?", "Set another") are resolved by the Dialogue layer with the context
the contract passes in; embeddings alone cannot do this (see §10).

---

## 9. Shadow mode, then promotion

**Shadow mode** — the new layer runs on every request that reaches a "gives up" branch, **records what it would
have proposed, and changes nothing the user sees.**

Log record (stored with the existing local gap log; exported only with the feedback report, `masked` as today):

```
{ t, phrase(masked like reports), current: {outcome, node, via}, proposal: {node, confidence, margin, source},
  agree: true|false, userOutcome: 'accepted' | 'corrected' | 'none' }
```

**Promotion criteria** (all measured on real tester rounds, never on the tuning set):

1. In shadow data, when the layer's proposal is above the floor, it is the right node **≥ 90%** of the time
   (judged by the user's own corrections and confirmations).
2. It would have turned **≥ 25%** of current "gives up" cases into direct, correct answers.
3. Zero regressions on all four corpora.
4. Model size and start-up on a real iPhone and a real PC are acceptable (§11).

Only then does tier A (fallback on conflict / no-signal) go live. Each later step (arbiter tie-breaks, personal
memory, any scoring role) repeats the same shadow → measure → promote cycle.

**Trigger for the heavier options (#3–#5):** after the mechanism bugs are fixed, if real failures per 100
requests stop falling over two tester rounds while the layer's own error stays above ~15%, the lightweight
approach has plateaued and a trained or generative component earns its place. Until then it does not.

---

## 10. Evidence so far

Reproduce: `tests/experiments/embeddings/embed_experiment.py` (setup in its header). Reference phrases came only
from data BOSS already ships (126 phrases); none from the corpora.

| | 73 fresh paraphrases | 455 existing corpus phrases |
|---|---|---|
| Today's routing | 46 correct (63%) | 455 (100% — rules were tuned on them) |
| Embeddings alone (nearest reference) | 56 / 73 (77%) | 255 / 305 node phrases (84%) |
| **Today's routing + embeddings only where it gives up (tier A)** | **53 (73%)** — 7 fixed, 0 broken | 454 — 1 differing ("is it going to be a good week") |
| Tier A + arbiter tie-breaks (B) | 54 (74%) — 8 fixed, 0 broken | 454 |

Examples fixed: *put on some tunes, turn it up a bit, give Anna a call, compose an email to the landlord,
where are my downloads, what's my current position, lock my private notes, save everything to a backup file.*
Speed: ~5.5 ms per phrase on a desktop CPU (phone not measured).

What this says:

- Embeddings alone are *not* better than the tuned rules (84% vs 100%) → **do not replace anything.**
- Consulted only where the rules give up, they add coverage without disturbing what works.
- Several remaining misses were *right* but under the confidence floor; a larger manifest and the personal memory
  are the expected remedy. The floor was **not** tuned on this set, to avoid fitting it.

What this does **not** say:

- The 73 paraphrases were written by one person (the assistant) after seeing the failures — a fair stress test,
  not a neutral benchmark. **Your tester rounds are the independent check.**
- Even combined, ~1 in 4 of this deliberately tricky set is still wrong.
- Embeddings cannot resolve context ("And dogs?") or extract details ("5 minutes") — other layers own those.
- The model is English-centric; behaviour on other languages is untested.
- Nothing here was run on a phone.

---

## 11. Options considered

| Option | New wording | Offline on phone | Predictable / testable | Per-user learning | Effort / risk |
|---|---|---|---|---|---|
| A. Keep rules, keep adding | Poor — one rule per gap | ✅ | ✅✅ | Limited | Rules and their interactions grow |
| **B. Embedding similarity** | Good for paraphrase | ✅ ~25–90 MB, fast | ✅ it is data | ✅ add confirmed phrases | Low–medium |
| C. Small trained classifier + slot tagger | Good within its training | ✅ similar size | ✅ | Needs retraining | Medium–high; needs data pipeline |
| D. Small generative model (0.5–3B) | Best, incl. context | ⚠ 0.4–2 GB, seconds per answer | ⚠ weakest | Via prompt/memory | High; phone support uncertain |
| E. Remote model as router | Best | ❌ | ⚠ | Via prompt | Cheap, but latency, cost, privacy; breaks offline-first |

Sizes and speeds are from memory and approximate — verify before relying on them.

**OpenJev (Qwen3.5-based cross-encoder "judge").** Scores each of a closed set of options for a situation; the
surrounding software picks the highest. Source: a Medium write-up (author's claims; model card, licence and
benchmarks **not verified**). Fits BOSS's shape (closed action list; model proposes, kernel disposes) and would
suit **Arbiter conflicts on PC / native**. Not a phone baseline: smallest checkpoint is 0.8B parameters, and it
needs one pass per option. The article itself reports weak safety classification (0.60 on shell-command safety)
and a drop from 0.83 to 0.47 under prompt injection — which is exactly why the kernel keeps the last word.
Trained for entailment, not intent routing → would need testing on our corpora.

**Platform models** (Apple on-device model for a native iPhone app; Chrome's built-in model on PC): attractive
for the native phase because there is no download — availability and limits **to be verified** when relevant.

---

## 12. Risks and how they are contained

| Risk | Containment |
|---|---|
| Model size / start-up on phones | Spike on a real iPhone first (§13 phase 2); int8-quantised model (~25 MB, untested here); lazy-load after first paint; shadow mode needs only the model, not the UI |
| False confidence → wrong action | Confidence + margin floors; kernel validation; side-effect actions always confirm; start with shadow mode |
| Threshold calibration drift | Thresholds live with the layer, not the locked scoring constants; re-measured every tester round |
| Reference-set bias | Examples from the manifest only; corpora and tester phrases stay held out |
| Personal memory poisoning (wrong confirmations) | Consolidation/demotion; visible list; one-tap forget |
| Language coverage | Check multilingual models before any non-English promise |
| Complexity creeping into the kernel | One contract (`understand()`); kernel sees only proposals |

---

## 13. Phased plan (each phase has a gate)

| Phase | What | Gate to continue |
|---|---|---|
| 0 | ✅ Build 0.14.5 — bond gating, intent-based timers and the small fixes (README §XVI-b) | Corpora 100%; delivered |
| 1 | Test pass → v1.0 | Your test pass clean enough |
| 2 | **Manifest** (data only) + `understand()` contract wrapping today's routing. No behaviour change. | All corpora unchanged |
| 3 | **In-browser model spike** — load MiniLM (WASM) in the PWA; measure size, start-up, battery, latency on a real iPhone and PC | Acceptable on a real iPhone |
| 4 | **Shadow mode** in a build; tester rounds collect agreement data | §9 promotion criteria |
| 5 | Promote **tier A** (fallback on conflict/no-signal) | Zero regressions; criteria met |
| 6 | **Personal memory** (confirmed phrases, Settings list, forget) | Shadow-tested |
| 7 | *Conditional:* trained classifier / PC judge / local generative mode | §9 plateau trigger |

---

## 14. Non-goals

- Replacing the claims, parsers, Arbiter or field scoring.
- Letting any model execute actions or bypass confirmation.
- Generating code at runtime.
- Training on the test corpora or tester reports.
- Sending phrases off the device for understanding (the deliberation layer's existing, deliberate calls
  remain as they are).

---

## 15. Decisions already made / still open

**Agreed in discussion (2026-10-20 → 22):**
- The layer is an *operator/relay* — it understands and proposes; the kernel decides.
- Conversation *for intent capture* (clarifying, filling in missing details) belongs to it; open conversation
  belongs to CORTEX / deliberation.
- A local model is a **backend mode of the deliberation layer**, not a separate component.
- Per-user learning is a memory the user can see and reset.

**Open (need the owner's call before the relevant phase):**
1. ~~Bond gating~~ — approved and applied in 0.14.5.
2. ~~Timer behaviour~~ — decided: it follows the user's intent (add / replace / cancel), see README §XVI-b.
3. ~~Languages~~ — decided: **English first, kept modular** (§16).
4. Whether the in-app embedding model should later also feed `vectorBoost` (a scoring amendment — would need approval and measurement, as with the warmth cap).

---

## 16. Language support — English first, kept modular

**Decision (2026-10-22):** BOSS ships in English first. Nothing in the design may make a second language hard to add later.

**What is language-specific today** (all English, mostly inline):

| Where | What |
|---|---|
| `actions/dialogue.js` | reply banks, small-talk patterns, follow-up patterns, number/duration words |
| `index.html` `INTENT_CLAIMS` | claim patterns ("timer", "weather", "where am i", …) |
| `actions/chronos.js`, `comms.js`, `launch.js` | time/duration/number words, verbs ("call", "text", "email") |
| Registry + node vocabularies | preset labels/tags, the words `match` counts |
| `actions/onboarding.js` | the example phrases (and so the manifest) |
| The embedding model | MiniLM is English-centric |

**What is language-neutral** (and must stay that way): scoring, warmth/bonds, the Arbiter, the Heart, node and event
machinery, the `understand()` contract, personal memory, confirmation rules.

**The rule going forward:** language-specific *data* is kept separate from language-neutral *logic*, as a **locale pack**:

```
locale pack (id: 'en')
  patterns      claim regexes, follow-up and small-talk patterns
  banks         reply wording per tone
  numbers       number words, units, "half an hour", clock words
  verbs         call / text / email / remind …
  examples      the capability-manifest example phrases   ← §7 stores these keyed by language from day one
  pleasantries  thanks / please / hello tokens the Dialogue layer strips
```

**What we do now (cheap, no risk to what works):**
- The capability manifest (§7) stores `examples` as `{ "en": [...] }` from the start — a second language is a new key, not a new format.
- New language-specific wording is added to the existing tables rather than hard-coded deeper in the logic.
- The embedding model is chosen behind a one-line setting, so a multilingual model can replace it. A multilingual small model must be verified for size and quality before any promise is made.

**What we deliberately do not do now:** a big refactor that moves every English string into `locales/en.js`. It would touch
everything that works today and pays off only when a second language is actually wanted. When that happens, the work is:
extract the English locale pack (mechanical, guarded by all four corpora), then a contributor adds a second pack and
a translated corpus; **a language is "supported" when its pack passes its own corpus at the same bar as English.**

**Per-user learning is language-agnostic** — the personal memory stores whatever phrases the user confirms, in any language.

---

## Scope update — 2026-10-27 (supersedes earlier "after v1.0" statements in §8, §13 and §15)

The base Understanding Layer **and** personal learning memory (the "hippocampus": confirmed phrases and context, user-visible, resettable, included in Backup/export, private, with consolidation and demotion) are now **in the v1.0 scope**. Build order: 0.14.9 safety floor → 0.15.0 genesis layer in shadow mode → 0.15.1 fallback tier + abstention (thresholds from real shadow data) → ≈0.15.2 personal memory → final TESTING pass → v1.0. The native app still adds reach, not brains; later layer versions remain undecided.