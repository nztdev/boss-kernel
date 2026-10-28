# B.O.S.S. — Personal learning memory (the "hippocampus") · proposal for build 0.16.0
*Status: BUILT in 0.16.0 with these decisions: teach command yes; a lesson carries a node and/or a timer length (via the target request); aging manual by default, auto-removal optional and off; name “What BOSS has learned about how you talk”. Original proposal text follows. (was: PROPOSAL — nothing built. Needs the decisions in §9. Extends `actions/learning.js` and `docs/UNDERSTANDING-LAYER.md` §8.*

## 1. What it is, in plain words
BOSS learns **your** way of saying things, from what you explicitly tell it, and applies it next time. Example: you say *"set another"*, BOSS asks, you pick "another timer like the last one" — after it has happened a few times BOSS just does it. It lives only on your device, you can see every item, delete any, or forget everything, and it travels with your Backup.

## 2. What exists today (and what's missing)
`learning.js` already learns two *numbers* from explicit answers: pair preferences ("MEMORY vs CHRONOS → CHRONOS") and a personal "ask-me-less/more" margin. It cannot learn **phrases** ("when I say *brew time* I mean a 4-minute timer"), nothing is listed per item, and nothing ages out. This proposal adds a phrase-level memory beside it; the existing module stays as is.

## 3. What gets remembered
One small record per lesson, text kept **on device only**:
`{ phrase (normalised), target (node + optional action/duration), confirmations, contradictions, firstSeen, lastSeen, state: tentative | trusted }`
Typical targets: a node ("brew time" → CHRONOS), or a node plus a simple parameter ("my usual" → timer 4 min). Never: passwords, vault/notes contents, contact data, anything from a `remember …` request, or any private-flagged request. Records are capped (default 200, oldest/least-used dropped first).

## 4. Where lessons come from (explicit signals only — nothing inferred from silence)
1. You answer a **"which did you mean?"** question (today's signal).
2. You tap **✋ Not what I meant** and say what you expected (today's signal).
3. You accept a proposal from the Understanding Layer ("Did you mean …?") — *new in 0.16.0, only if the layer is on*.
4. You say it outright: **"when I say X, I mean Y"** — *new*; the clearest, most intuitive way to teach.

## 5. How it is used
Order of consultation per request, cheapest and most trusted first:
1. **Exact personal match** (normalised phrase equals a *trusted* record) → route there. Works with **no model download**, offline, free.
2. **Near personal match** (embedding similarity ≥ high bar) → only if the Understanding Layer is on; a *tentative* near match is offered as a question, never acted on.
3. Everything else is unchanged (claims → field → Arbiter → fallback).
It can change **where** a request goes, never **what is allowed**: side-effect actions still confirm; elevated-risk nodes are never auto-routed by memory.

## 6. Consolidation and forgetting (the missing "homeostasis")
- *Tentative* → *trusted* after 3 confirmations with no contradiction.
- One contradiction → back to tentative; 3 contradictions → deleted.
- Not used for 90 days → demoted; for 180 days → deleted (configurable constants, default shown).
- Nothing is ever promoted by BOSS's own guess — only by your answers.

## 7. Visibility, control, privacy
- Settings gets a **"What BOSS has learned about how you talk"** list: each phrase → what it does, confirmations, state, [Delete]; plus **Forget everything** and an on/off switch (off = exact default behaviour, as with Learning today). *(Fits the Settings restructure, checklist F8.)*
- Included in Backup/export (new key `BOSS_PERSONAL_MEMORY`, schema documented with the backup freeze, C2).
- Never in a tester report except **counts**; phrases are never sent anywhere.
- Native app: reads the same Backup file (no rewiring, gate D).

## 8. Tests and gates
- New corpus `tests/phrases_memory.tsv` run through scripted lessons: learn → trusted → applied; contradiction demotes; forget clears; off restores defaults; side-effect actions still ask; private/`remember` text never stored.
- All existing corpora, recency and bond measurements unchanged (memory is empty by default).
- Device test (TESTING G26): teach 3 phrases, watch them become trusted, delete one, forget all, export → wipe → import restores them.
- Size of work: one new module (~250 lines), a Settings section, Backup entry, Dialogue/firePulse hook, docs. One build.

## 9. Decisions needed from you
1. **Scope of "teach":** include the *"when I say X, I mean Y"* command in 0.16.0 (recommended), or only learn from the existing question/✋ signals?
2. **Parameters:** may a lesson carry a simple parameter (a timer length, a theme), or only a destination node? (Recommended: node + timer duration only for now.)
3. **Aging defaults:** 90-day demotion / 180-day deletion and a 200-record cap — fine, or other numbers?
4. **Wording in the product:** "What BOSS has learned about how you talk" — or a different name?

## 10. Risks
- *Wrong lessons stick:* mitigated by 3 confirmations, one-contradiction demotion, visible list, one-tap delete.
- *Privacy worry:* mitigated by on-device storage, no content categories, no reports, explicit forget.
- *Complexity creep:* it is data plus a lookup in front of today's routing — scoring formulas stay locked.