/**
 * B.O.S.S. Personal memory ("hippocampus") — actions/personal.js          v0.16.0
 * ---------------------------------------------------------------------------------------------
 * BOSS learns YOUR way of saying things, only from what you explicitly tell it, and applies it next time.
 *
 *   Two kinds of lesson (both stored on this device only, listed and deletable in Settings):
 *     • "alias"  — a shortcut you teach: "when I say brew time, I mean set a timer for 4 minutes".
 *                  "brew time" is rewritten to the request on the right, which then goes through the normal
 *                  routing and the normal confirmations. (A lesson can therefore carry a node, a timer length…
 *                  anything BOSS already understands — and nothing it doesn't.)
 *     • "node"   — learned from your answers to "which did you mean?" and ✋ "Not what I meant": a phrase that
 *                  keeps ending up at the same node is sent there directly once it is trusted.
 *
 *   Trust:  taught shortcuts are trusted at once (you said it outright). Learned node lessons start tentative
 *           and become trusted after TRUST_AFTER consistent answers; one contradiction sends a trusted lesson
 *           back to tentative, CONTRADICTIONS_DROP of them delete it. Nothing is ever promoted by BOSS's own guess.
 *   Safety: memory changes WHERE a request goes, never what is allowed — the target request still routes and
 *           confirms normally; elevated-risk nodes are never auto-routed by a node lesson. Secrets are never
 *           stored (anything with remember/note/password/pin… is refused).
 *   Aging:  none by default (you delete lessons yourself). Optional, modular: setAutoAge(true) drops lessons
 *           unused for AGE_DELETE_DAYS. Capped at MAX_ITEMS (taught shortcuts are never silently dropped).
 *   Storage: one key, BOSS_PERSONAL_MEMORY (in Backup/export); never in tester reports except counts.
 */

const KEY = 'BOSS_PERSONAL_MEMORY';
export const MAX_ITEMS = 200;
export const TRUST_AFTER = 3;
export const CONTRADICTIONS_DROP = 3;
export const AGE_DELETE_DAYS = 180;
const MAX_PHRASE = 60, MAX_TARGET = 90, MIN_PHRASE = 2;
const DAY = 86400000;

function _load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null') || {};
    return { v: 1, on: o.on !== false, autoAge: !!o.autoAge, items: Array.isArray(o.items) ? o.items : [] };
  } catch (_) { return { v: 1, on: true, autoAge: false, items: [] }; }
}
function _save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (_) { return false; } }

/** Canonical form used for matching: lower-case, no punctuation, single spaces, polite filler removed. */
export function normalise(text) {
  return String(text || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9'À-ɏ ]+/g, ' ')
    .replace(/\b(?:please|pls|hey boss|boss)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
const _SECRET = /\b(?:remember|memori[sz]e|note|forget|save|password|passcode|pin|secret|vault|api key|token)\b/i;
const _id = () => Math.random().toString(36).slice(2, 9);

export function enabled() { return _load().on; }
export function setEnabled(on) { const s = _load(); s.on = !!on; _save(s); }
export function autoAge() { return _load().autoAge; }
export function setAutoAge(on) { const s = _load(); s.autoAge = !!on; _save(s); if (on) prune(); }

/** Drop lessons unused for AGE_DELETE_DAYS (only when auto-aging is on). Returns how many were removed. */
export function prune(now = Date.now()) {
  const s = _load(); if (!s.autoAge) return 0;
  const before = s.items.length;
  s.items = s.items.filter(i => now - (i.lastUsed || i.created || now) < AGE_DELETE_DAYS * DAY);
  _save(s); return before - s.items.length;
}

// ── teaching ("when I say X, I mean Y") ──────────────────────────────────────────────────────
const _TEACH = [
  /^(?:when|if) i say\s+["“']?(.+?)["”']?\s*,?\s+(?:then\s+)?(?:i mean|i want|do|run|use|it means|treat (?:it )?as|take it as)\s+["“']?(.+?)["”']?\s*\.?$/i,
  /^from now on\s*,?\s+["“']?(.+?)["”']?\s+(?:means|should (?:mean|be)|is)\s+["“']?(.+?)["”']?\s*\.?$/i,
  /^(?:teach|learn)\s*:?\s+["“']?(.+?)["”']?\s*(?:=|means)\s*["“']?(.+?)["”']?\s*\.?$/i,
];
/** Is this a "teach" sentence? → { phrase, target } | null */
export function parseTeach(intent) {
  const t = String(intent || '').trim();
  for (const rx of _TEACH) { const m = t.match(rx); if (m) return { phrase: m[1].trim(), target: m[2].trim() }; }
  return null;
}

/** Store a taught shortcut. → { ok, message, item? } */
export function teach(phrase, target) {
  const x = normalise(phrase), y = String(target || '').trim().replace(/\s+/g, ' ');
  if (x.length < MIN_PHRASE || x.length > MAX_PHRASE) return { ok: false, message: `That phrase should be between ${MIN_PHRASE} and ${MAX_PHRASE} characters.` };
  if (y.length < 2 || y.length > MAX_TARGET) return { ok: false, message: `What it should do needs to be a short request (up to ${MAX_TARGET} characters).` };
  if (_SECRET.test(x) || _SECRET.test(y)) return { ok: false, message: 'I don\'t store anything that looks like a secret or a note — use the vault for that.' };
  if (x === normalise(y)) return { ok: false, message: 'Those are the same thing already.' };
  if (parseTeach(y)) return { ok: false, message: 'A shortcut can\'t be another teaching sentence.' };
  const s = _load();
  const ex = s.items.find(i => i.type === 'alias' && i.phrase === x);
  if (ex) { ex.target = y; ex.state = 'trusted'; ex.contradictions = 0; ex.lastUsed = Date.now(); _save(s); return { ok: true, message: 'updated', item: ex, updated: true }; }
  if (s.items.length >= MAX_ITEMS) {
    const drop = s.items.filter(i => i.type === 'node' && i.state === 'tentative').sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0))[0];
    if (!drop) return { ok: false, message: `The list is full (${MAX_ITEMS}). Delete a lesson in Settings first.` };
    s.items.splice(s.items.indexOf(drop), 1);
  }
  const item = { id: _id(), type: 'alias', phrase: x, target: y, state: 'trusted', confirmations: 0, contradictions: 0, created: Date.now(), lastUsed: Date.now() };
  s.items.push(item); _save(s); return { ok: true, message: 'saved', item };
}

// ── using it ────────────────────────────────────────────────────────────────────────────────────
/** A trusted alias for this request → { id, to } | null.   (Whole-phrase match only.) */
export function lookupAlias(intent) {
  const s = _load(); if (!s.on || !s.items.length) return null;
  const x = normalise(intent); if (!x) return null;
  const it = s.items.find(i => i.type === 'alias' && i.state === 'trusted' && i.phrase === x);
  if (!it) return null;
  it.confirmations = (it.confirmations | 0) + 1; it.lastUsed = Date.now(); _save(s);
  return { id: it.id, phrase: it.phrase, to: it.target };
}
/** A trusted node lesson for this request → node name | null. */
export function lookupNode(intent, isElevated = () => false) {
  const s = _load(); if (!s.on || !s.items.length) return null;
  const x = normalise(intent); if (!x) return null;
  const it = s.items.find(i => i.type === 'node' && i.state === 'trusted' && i.phrase === x);
  if (!it || isElevated(it.target)) return null;
  it.lastUsed = Date.now(); _save(s); return it.target;
}

// ── learning from explicit answers ─────────────────────────────────────────────────────────────
/** The user chose `node` for this phrase (a "which did you mean?" answer, or the node named in a ✋ flag). */
export function learnNode(intent, node, isElevated = () => false) {
  const x = normalise(intent);
  if (!node || x.length < MIN_PHRASE || x.length > MAX_PHRASE || _SECRET.test(x) || /^\[/.test(String(intent))) return null;
  if (isElevated(node)) return null;
  const s = _load(); if (!s.on) return null;
  let it = s.items.find(i => i.type === 'node' && i.phrase === x);
  if (!it) {
    if (s.items.length >= MAX_ITEMS) return null;
    it = { id: _id(), type: 'node', phrase: x, target: node, state: 'tentative', confirmations: 0, contradictions: 0, created: Date.now(), lastUsed: Date.now() };
    s.items.push(it);
  }
  if (it.target === node) {
    it.confirmations++; it.lastUsed = Date.now();
    if (it.state === 'tentative' && it.confirmations >= TRUST_AFTER) it.state = 'trusted';
  } else {
    it.contradictions++; it.lastUsed = Date.now();
    if (it.contradictions >= CONTRADICTIONS_DROP) s.items.splice(s.items.indexOf(it), 1);
    else { it.state = 'tentative'; it.confirmations = 0; it.target = node; }
  }
  _save(s); return it;
}

// ── visibility & control ───────────────────────────────────────────────────────────────────────
export function list() { return _load().items.slice().sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0)); }
export function remove(id) { const s = _load(); const n = s.items.length; s.items = s.items.filter(i => i.id !== id); _save(s); return n - s.items.length; }
export function forgetAll() { const s = _load(); s.items = []; _save(s); }
export function summary() { const s = _load(); return { on: s.on, autoAge: s.autoAge, count: s.items.length, trusted: s.items.filter(i => i.state === 'trusted').length, aliases: s.items.filter(i => i.type === 'alias').length }; }

export const PersonalMemory = { normalise, enabled, setEnabled, autoAge, setAutoAge, prune, parseTeach, teach, lookupAlias, lookupNode, learnNode, list, remove, forgetAll, summary,
  MAX_ITEMS, TRUST_AFTER, CONTRADICTIONS_DROP, AGE_DELETE_DAYS };
if (typeof window !== 'undefined') window.BOSS_personal = PersonalMemory;