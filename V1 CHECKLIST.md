# B.O.S.S. — v1.0 Exit Checklist (the free, open-source version)

**Purpose:** turn "are we done?" into a yes/no. v1.0 is declared when every **required** gate below is ✅ — not before, and not because it feels close.
**Status date:** 2026-10-26 · build under test: 0.14.9 (A4 fix delivered; awaiting tester confirmation) · last two tester reports: PC (clean), iPhone (normal flows clean; stress set failed — see Gate A).
**Legend:** ✅ met · 🟡 partly met · ⬜ not started / not verified · **Required** = blocks v1.0 · *Nice* = can ship in v1.x.

---

## What "v1.0 — complete" means

The free GitHub version is **complete** when a stranger can install the PWA on a phone or PC, use it offline for everyday tasks, trust that it
tells the truth about what it can and cannot do, keep and move their data safely, and report a problem without leaking anything private —
and when nothing in the design will have to be torn up to add the native app or a second language.

It is **not** required to be: smart (the Understanding Layer beyond its design note), chatty offline (a local model), or powerful on the OS
(everything in README §XV marked 📱 Native). Those come after (see the last section).

---

## Gate A — Routing quality and honesty  *(Required)*

| # | Criterion | How it is measured | Status |
|---|---|---|---|
| A1 | All four corpora pass at 100% on the release build | `tests/run_corpus.py` on each `.tsv` | ✅ 470/470 on 0.14.8 |
| A2 | Recency and bond stress stay within bounds | `tests/measure_recency.py` (wrong ≤ 1%, needless "which did you mean?" = 0); `tests/measure_bonds.py` (wrong ≤ 2% at bond 0.4, needless questions = 0) | ✅ recency 13/3,290 (0.4%) · bonds 175/9,870 (1.8%), 0 needless |
| A3 | Two consecutive tester rounds (≥ 1 iPhone **and** ≥ 1 PC, ≥ 35 requests each, covering TESTING G1–G22) with **zero silent wrong actions** — a request answered by an unrelated action and reported as handled | Tester reports (`boss-feedback/1`) | 🟡 PC 0.14.8 clean; iPhone 0.14.8 normal flows clean, **stress set not** (A4) |
| A4 | **Out-of-scope requests are answered honestly.** For a request BOSS cannot do in the web version it must say so (can't do / needs the native app / needs an AI engine / needs the PC Cortex) — never run an unrelated action, never print another node's command menu, never ask for a duration it doesn't need | The "ambitious requests" set below, to be added as a regression corpus | 🟡 **Fix shipped in 0.14.9** — 10/10 honest in the local UI run; `tests/phrases_oos.tsv` 21/21; awaiting iPhone confirmation (TESTING G23) |
| A5 | No unexplained "which did you mean?" on plain, unambiguous requests | Reports: `clarifications` ≈ 0 for ordinary phrases | ✅ 0 in the last five reports |
| A6 | Timers, alarms and follow-ups behave by intent (add / replace / cancel / "set another") | TESTING G17–G19 on both devices | ✅ both devices, 0.14.7–0.14.8 |

**The ambitious-requests set (iPhone, 0.14.8) — what actually happened.** Ten requests beyond the web version's reach. None was answered honestly:

| Request (abridged) | What BOSS did | Failure type |
|---|---|---|
| Search my offline notes for "confirmation numbers" | CORE → "Network 🟢 online" (the word *offline* hit the network pattern) | **Silent wrong action** (reported handled) |
| Lock the front door and arm the security system | CORE → full system status report (the word *system*) | **Silent wrong action** |
| Cast my screen to the TV and route audio to Bluetooth speakers | MEDIA → "idle" | **Silent wrong action** |
| Draft a polite email response… based on my calendar availability | CHRONOS → "no time expression — choose a duration" | Wrong prompt |
| Preheat the oven to 400° and flash the lights when ready | CHRONOS → "choose a duration" | Wrong prompt |
| Turn on Do Not Disturb and lower brightness to 10% | MEDIA command menu | Menu dump (random node) |
| Back up my photo gallery to the external hard drive | MEDIA command menu (Arbiter "OPPOSED" but no question asked) | Menu dump |
| Summarise the action items from the 40-minute audio recording | MEDIA command menu | Menu dump |
| Translate the audio from this video stream into Spanish subtitles | MEDIA command menu | Menu dump |
| Wake my office desktop and pull up the budget spreadsheet | MEDIA command menu (no node matched at all: max match 0.096) | Menu dump |

*Why it matters:* the three silent wrong actions are the worst outcome — the user is told something happened that did not. The menu dumps and wrong prompts are
confusing but not deceptive. All ten are "capability awareness" failures: BOSS knows what it can do but not what it **cannot**.

*Proposed fix (needs approval, build 0.14.9):* (1) extend the native-only/unsupported catalogue (smart-home and security, Do Not Disturb/brightness, cast/mirror,
external drives, wake-on-LAN, audio/video transcription) so these get an honest, specific answer; (2) stop greedy handlers acting on stray words
(CORE's *online/system*, CHRONOS asking for a duration when the request has no time words); (3) when a node cannot act and no engine is connected,
one friendly "I couldn't match that to anything I can do" line instead of that node's menu; (4) "search/find in my notes" → MEMORY.
These feed directly into the capability manifest in `docs/UNDERSTANDING-LAYER.md` §7, which should record what BOSS **cannot** do as well as what it can.

---

## Gate B — Platform reliability  *(Required)*

| # | Criterion | Status |
|---|---|---|
| B1 | A **full** TESTING pass (§1–§5: A, B, C, E rows) with every result row filled, on the final build, on **iPhone (installed PWA)** and **PC Chrome** | ⬜ last full pass was 0.14.0; since then targeted passes only |
| B2 | Install → update → offline cycle works (Update BOSS reloads; `worker` = `build` in the report; airplane-mode reopen) | 🟡 update + worker match seen on 0.14.8; E5 airplane mode needs a final-build re-run |
| B3 | Permissions on demand and graceful refusal: location, microphone, camera, notifications | 🟡 location + notifications seen; mic/camera in the final pass |
| B4 | Accessibility basics: text size XL, Reduce Motion (iPhone has it on), contrast | ⬜ final pass |
| B5 | No console errors on boot or during the corpus runs on both platforms | ✅ corpus runs `ERR []` |
| B6 | Known limits (TESTING §6) are accurate and each is visible to the user in-app where relevant | 🟡 |

## Gate C — Data safety  *(Required)*

| # | Criterion | Status |
|---|---|---|
| C1 | Backup file is **versioned** with a forward-compatibility check (`VERSION = 1`; newer files are refused with a clear message) | ✅ in `actions/backup.js` |
| C2 | Backup **schema is documented and frozen** for v1.0, with a test that an old backup still restores (the native app will import this file) | ⬜ |
| C3 | Export → erase everything → import round-trip restores notes, vault, profile, settings, learned preferences (TESTING E3) | ⬜ re-run on final build |
| C4 | Vault/Notes encryption: passphrase loss is stated plainly before enabling; no recovery promise | 🟡 verify wording |
| C5 | **Nothing private leaves in a feedback report**: emails, phone numbers, links, `remember …` text, locations, weather results | ✅ fixed in 0.14.6; verified on PC (G22); iPhone preview to confirm |
| C6 | API keys stay on the device and are never included in backups or reports without an explicit choice | 🟡 verify |

## Gate D — Native seams (freeze now, build later)  *(Required)*

The native app must be able to *add* capabilities without rewiring the web version.

| # | Criterion | Status |
|---|---|---|
| D1 | One documented place per 📱 Native capability where a provider plugs in (README §XII-b: "callers do not change — only the table gains entries") | ⬜ audit and document |
| D2 | The native-only/unsupported catalogue (Registry `_triggers`) is complete enough that every request in Gate A4 gets a specific honest answer | ✅ catalogue extended in 0.14.9 (6 new entries) |
| D3 | Storage separation understood and stated: the installed PWA and the native app have separate storage; moving between them is via the backup file | ✅ documented (README §XII-b) |
| D4 | Registry preset fields (id, nodes, intent, tags, risk, nativeOnly) are stable and versioned | ⬜ freeze |
| D5 | Risk tiers (low / high) and the confirmation rule for side-effect actions are written down as the contract native implementations must honour | 🟡 exists in code; document |

## Gate E — PC / Cortex packaging  *(Required for PC users; the PWA itself does not depend on it)*

| # | Criterion | Status |
|---|---|---|
| E1 | PyInstaller package of the Python Cortex bridge (Phase 11) | ⬜ |
| E2 | First-run setup wizard (endpoint, optional engine keys) | ⬜ |
| E3 | Remote-access guide (Tailscale) | ⬜ |
| E4 | BOSS degrades gracefully when the Cortex is absent (it already does: `vectorBoost` = 0) | ✅ |

## Gate F — Documentation and release hygiene  *(Required)*

| # | Criterion | Status |
|---|---|---|
| F1 | Plain-language README introduction ("what it is, why it's different, why it matters") at the top, and the same on the Home screen | ⬜ (drafted in conversation; not in the repo) |
| F2 | Short user guide: install, first requests, settings, backup, engine keys | ⬜ |
| F3 | TESTING.md current; README architecture/amendments current (§XVI-b, §XVII) | ✅ through 0.14.8 |
| F4 | Privacy page: what leaves the device and when (README §XVI) | ✅ review once more at release |
| F5 | CHANGELOG, version tag, release notes | ⬜ |
| F6 | LICENSE (MIT, as stated in the README), SECURITY.md (where to report), CONTRIBUTING (how to run the corpus, how to add a phrase, how to add a language pack — `UNDERSTANDING-LAYER.md` §16), issue templates | ⬜ verify what exists in the repo |
| F7 | Corpus run on GitHub Actions on every push | *Nice* ⬜ |

## Gate G — The capability map tells the truth  *(Required)*

| # | Criterion | Status |
|---|---|---|
| G1 | README §XV matches what the release actually does (✅ / 🟡 / ❌ checked row by row against the final build) | ⬜ |
| G2 | The in-app "What can BOSS do?" screen and the greyed 📱 Native items match §XV | ⬜ |
| G3 | Every "needs the native app / an engine / the Cortex" answer names the reason and, where possible, the nearest thing BOSS can do | ⬜ (this is A4) |

---

## Release procedure (when every Required gate is ✅)

1. Freeze: no feature work; only fixes for failures found in the final pass.
2. Run all four corpora, both stress measurements, and the ambitious-requests corpus → record the numbers in README §XVI-b.
3. Final full TESTING pass on iPhone and PC → fill §7 of TESTING.md → attach both reports to the release notes (masked).
4. Bump BUILD to 1.0.0 in `core/sw.js` and `actions/ui.js`; tag; publish release notes (CHANGELOG).
5. Confirm Update BOSS takes a user from the previous build to 1.0.0 with their data intact.

## Explicitly **not** required for v1.0

- Later Understanding Layer *versions* beyond the base layer (undecided, free base stays free).

## Added to v1.0 scope (decision 2026-10-27)

The base Understanding Layer is **in** v1.0, built in this order: **0.14.9** safety floor (done) → **0.15.0** genesis layer, shadow mode (capability manifest, `understand()` contract, lazy-loaded int8 MiniLM cached by the service worker, shadow logging, iPhone/PC size/load/memory spike) → **0.15.1** fallback tier + abstention, thresholds set from real shadow data → **≈0.15.2** personal learning memory (user-visible, resettable, in backup/export, private, with consolidation and demotion). Then the final full TESTING pass and v1.0.
- A local-model mode for the deliberation layer; engine-quality offline chat.
- The locale-pack refactor (English first; modular by rule — `UNDERSTANDING-LAYER.md` §16).
- Home screen modernisation, corpus CI.
- Everything in README §XV marked 📱 Native: reliable background alarms, contacts, direct SMS/call control, flashlight, screen recording, Bluetooth/Wi-Fi switches, DEVICES (Bluetooth, Matter, wearables, health), BOSS Browser, silent app launching, background execution, on-device speech recognition and wake word, biometric keychain, live camera/on-device OCR, platform models.

*Principle for what goes where:* the native app adds **reach** (access to the phone's own features), not **brains**. The free version must be complete in its own right.

---

## Blocking now, in order

1. **A4** — honest answers for out-of-scope requests (proposal above; awaiting approval).
2. **B1** — a full final-build pass on both devices (after A4 ships).
3. **C2 / D1 / D4** — freeze and document the backup schema and the native seams (no behaviour change; can be done in parallel).
4. **F1–F2, F5–F6** — the plain-language intro, user guide, changelog, and repo hygiene.
5. **E1–E3** — PC packaging (can follow the PWA release if needed; decide whether PC packaging blocks "complete").