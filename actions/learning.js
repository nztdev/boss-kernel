/**
 * B.O.S.S. Learning — actions/learning.js
 * ========================================
 * BOSS adapts to the person using it, using only what they have already told
 * it. It does NOT change the routing physics (scores are untouched). It tunes
 * two small, bounded things around the Arbiter:
 *
 *   1. PAIR PREFERENCES — when you have resolved the same conflict the same way
 *      several times ("MEMORY vs CHRONOS → CHRONOS"), BOSS applies your choice
 *      and stops asking.
 *   2. PERSONAL MARGIN — the lead a node needs to win outright without asking.
 *      Starts at the default. It tightens slowly if you keep confirming BOSS's
 *      first pick, and widens (asks more) if you keep correcting it.
 *
 * Signals (all explicit; nothing is inferred from silence):
 *   • answers to a "which did you mean?" prompt          → learnClarification()
 *   • "✋ Not what I meant" flags with an expected node   → learnMiss()
 *
 * Guarantees
 *   • On device only (localStorage BOSS_LEARNED); never in the tester report
 *     except as counts.
 *   • Bounded: margin stays within [MIN_MARGIN, MAX_MARGIN]; a preference needs
 *     MIN_VOTES answers and a clear majority; one contrary answer weakens it.
 *   • Pairs involving an elevated-risk node are never auto-resolved.
 *   • Visible and resettable (Settings → Learning); can be switched off, which
 *     restores the default behaviour exactly.
 */

const KEY     = 'BOSS_LEARNED';
const KEY_ON  = 'BOSS_LEARNING';          // 'off' disables
export const BASE_MARGIN = 0.35;
export const MIN_MARGIN  = 0.20;
export const MAX_MARGIN  = 0.55;
export const MIN_VOTES   = 3;             // answers needed before a preference applies
export const MAJORITY    = 0.75;          // share of votes the winner needs
const STEP_CONFIRM = 0.01;                // user accepted BOSS's top pick → ask a bit less
const STEP_OVERRIDE = 0.02;               // user picked the other node   → ask a bit more
const STEP_MISS = 0.03;                   // flagged a margin-bypass result as wrong

function _load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    return { pairs: o.pairs || {}, adj: Number(o.adj) || 0, confirmed: o.confirmed | 0, overridden: o.overridden | 0, misses: o.misses | 0 };
  } catch (_) { return { pairs: {}, adj: 0, confirmed: 0, overridden: 0, misses: 0 }; }
}
function _save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }
const _key = (a, b) => [a, b].sort().join('|');
const _clamp = v => Math.max(MIN_MARGIN - BASE_MARGIN, Math.min(MAX_MARGIN - BASE_MARGIN, v));

export function enabled() { try { return localStorage.getItem(KEY_ON) !== 'off'; } catch (_) { return true; } }
export function setEnabled(on) { try { localStorage.setItem(KEY_ON, on ? 'on' : 'off'); } catch (_) {} }

/** The lead needed to win without asking (default when learning is off). */
export function margin() {
  if (!enabled()) return BASE_MARGIN;
  return +(BASE_MARGIN + _clamp(_load().adj)).toFixed(3);
}

/**
 * A learned winner for this conflict, or null.
 * isElevated(name) → true for nodes whose conflicts must always be asked.
 */
export function preferred(a, b, isElevated = () => false) {
  if (!enabled() || isElevated(a) || isElevated(b)) return null;
  const p = _load().pairs[_key(a, b)];
  if (!p) return null;
  const va = p[a] || 0, vb = p[b] || 0, total = va + vb;
  if (total < MIN_VOTES) return null;
  if (va / total >= MAJORITY) return a;
  if (vb / total >= MAJORITY) return b;
  return null;
}

function _vote(s, a, b, chosen) {
  const k = _key(a, b);
  const p = s.pairs[k] || (s.pairs[k] = {});
  p[chosen] = (p[chosen] || 0) + 1;
  // a contrary answer weakens the other side's lead so preferences can reverse
  const other = chosen === a ? b : a;
  if ((p[other] || 0) > 0 && (p[chosen] || 0) > 1) p[other] = Math.max(0, p[other] - 0.5);
}

/** The user answered a clarification. top = BOSS's first pick, second = the runner-up. */
export function learnClarification(top, second, chosen) {
  if (!enabled() || !top || !second || (chosen !== top && chosen !== second)) return;
  const s = _load();
  _vote(s, top, second, chosen);
  if (chosen === top) { s.confirmed++; s.adj = _clamp(s.adj - STEP_CONFIRM); }
  else                { s.overridden++; s.adj = _clamp(s.adj + STEP_OVERRIDE); }
  _save(s);
}

/**
 * A "not what I meant" flag. routedTo/expected are node names; via is how the
 * request was routed ('margin', 'arbiter', 'score', 'claim:…').
 */
export function learnMiss({ routedTo, expected, via, runnerUp } = {}) {
  if (!enabled()) return;
  const s = _load(); s.misses++;
  if (String(via || '').startsWith('margin')) s.adj = _clamp(s.adj + STEP_MISS);
  if (routedTo && expected && expected !== 'NONE' && routedTo !== expected) _vote(s, routedTo, expected, expected);
  _save(s);
}

export function summary() {
  const s = _load();
  const prefs = Object.entries(s.pairs).map(([k, v]) => {
    const [a, b] = k.split('|'); const w = preferred(a, b);
    return w ? { pair: `${a} vs ${b}`, winner: w, votes: Math.round((v[a] || 0) + (v[b] || 0)) } : null;
  }).filter(Boolean);
  return { enabled: enabled(), margin: margin(), base: BASE_MARGIN, preferences: prefs, confirmed: s.confirmed, overridden: s.overridden, misses: s.misses };
}

export function reset() { try { localStorage.removeItem(KEY); } catch (_) {} }

export const Learning = { enabled, setEnabled, margin, preferred, learnClarification, learnMiss, summary, reset, BASE_MARGIN, MIN_MARGIN, MAX_MARGIN, MIN_VOTES, MAJORITY };
if (typeof window !== 'undefined') window.BOSS_learning = Learning;
