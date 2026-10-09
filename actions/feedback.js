/**
 * B.O.S.S. Feedback — actions/feedback.js
 * ========================================
 * Everything needed to turn "how did BOSS do for this tester?" into one
 * file a developer can read. Pure logic: no DOM here (see feedback-ui.js).
 *
 * What it keeps (all local, nothing leaves the device by itself):
 *   • a rolling log of pulsed requests and what BOSS did with each
 *     (which node, why — claim / score / arbiter / clarification — and
 *     whether the action handled it)
 *   • "misses": requests the tester flagged as "not what I meant",
 *     optionally with the node they expected and a note
 *   • the existing capability-gap log (BOSS_GAPS) is read when a report is built
 *
 * What it builds:
 *   Feedback.build(opts) → a plain JSON report (schema "boss-feedback/1")
 *   Feedback.toCorpusTsv(report) → ready-to-paste lines for tests/phrases.tsv
 *
 * How it leaves the device — MODULAR TRANSPORTS:
 *   A transport is { id, label, available(), send(report, filename) → {ok, note} }.
 *   Built in: "share" (system share sheet, with the file attached) and
 *   "download" (saves a .json file). A backend later is ONE more call:
 *       Feedback.registerTransport({ id:'http', label:'Send to BOSS team',
 *         available: () => navigator.onLine,
 *         async send(report) { await fetch(URL, {method:'POST', body: JSON.stringify(report)}); return {ok:true}; } });
 *   Nothing else (UI, report shape, redaction) needs to change.
 *
 * Privacy rules (enforced here, not in the UI):
 *   • Never included: vault, notes, API keys, clipboard, location, files, contacts.
 *   • Request text is masked by default: emails, phone numbers and links are
 *     replaced, and anything a tester asked BOSS to remember/forget/note is
 *     reduced to the verb only.
 *   • The report is shown to the tester (preview) before it is sent or saved.
 */

const REQ_KEY    = 'BOSS_FEEDBACK_LOG';
const MISS_KEY   = 'BOSS_FEEDBACK_MISSES';
const GAPS_KEY   = 'BOSS_GAPS';
const MAX_REQS   = 150;
const MAX_MISSES = 100;
export const SCHEMA = 'boss-feedback/1';

// ── storage helpers (never throw) ─────────────────────────────────────────────
function _load(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (_) { return []; } }
function _save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (_) { return false; } }

// ── redaction ─────────────────────────────────────────────────────────────────
const _SECRET_VERBS = /^(?:please\s+)?(remember|memori[sz]e|note|forget|save)\b/i;
/** Mask personal details in a request. Exported for tests. */
export function redact(text) {
  let t = String(text == null ? '' : text);
  if (_SECRET_VERBS.test(t.trim())) return t.trim().match(_SECRET_VERBS)[1].toLowerCase() + ' […]';
  t = t.replace(/https?:\/\/([^\s/]+)[^\s]*/gi, (_, host) => `[link:${host.replace(/^www\./, '')}]`);
  t = t.replace(/[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}/g, '[email]');
  t = t.replace(/\+?\d[\d\s().-]{5,}\d/g, '[number]');
  return t;
}

// ── request log ───────────────────────────────────────────────────────────────
/**
 * Called once per pulse by the kernel.
 * entry: { intent, node, via, top3?, between?, handled? }
 *   via: 'claim:<reason>' | 'score' | 'arbiter:<stage>' | 'clarification' | 'native'
 */
function record(entry) {
  if (!entry || !entry.intent) return;
  const list = _load(REQ_KEY);
  list.push({
    t: Date.now(),
    intent: String(entry.intent).slice(0, 300),
    node: entry.node || null,
    via: entry.via || null,
    top3: entry.top3 || null,
    between: entry.between || null,
    handled: entry.handled === undefined ? null : !!entry.handled,
  });
  _save(REQ_KEY, list.slice(-MAX_REQS));
}

/** Updates the last logged request once the action reports back. */
function settleLast(intent, handled) {
  const list = _load(REQ_KEY);
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].intent === String(intent).slice(0, 300)) { list[i].handled = !!handled; _save(REQ_KEY, list); return; }
  }
}

// ── misses ────────────────────────────────────────────────────────────────────
/** miss: { intent, routedTo, via, expected?, note? } */
function markMiss(miss) {
  if (!miss || !miss.intent) return false;
  const list = _load(MISS_KEY);
  list.push({
    t: Date.now(),
    intent: String(miss.intent).slice(0, 300),
    routedTo: miss.routedTo || null,
    via: miss.via || null,
    expected: miss.expected || null,          // node name the tester thinks was right (optional)
    note: String(miss.note || '').slice(0, 500),
  });
  return _save(MISS_KEY, list.slice(-MAX_MISSES));
}

// ── transports (modular delivery) ─────────────────────────────────────────────
const _transports = new Map();
function registerTransport(t) {
  if (!t || !t.id || typeof t.send !== 'function') throw new Error('transport needs { id, send }');
  _transports.set(t.id, { label: t.id, available: () => true, ...t });
}
function listTransports() { return [..._transports.values()].filter(t => { try { return t.available(); } catch (_) { return false; } }); }

function _blobFor(report) {
  return new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
}
function _filename(report) {
  const d = new Date(report.createdAt);
  const p = n => String(n).padStart(2, '0');
  return `boss-feedback-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${report.id}.json`;
}

registerTransport({
  id: 'download', label: '⬇ Save file',
  available: () => typeof document !== 'undefined',
  async send(report) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(_blobFor(report));
    a.download = _filename(report);
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return { ok: true, note: `Saved ${a.download} — send it to the BOSS team.` };
  },
});

registerTransport({
  id: 'share', label: '📤 Share…',
  available: () => {
    try {
      if (!navigator.canShare || !navigator.share) return false;
      return navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] });
    } catch (_) { return false; }
  },
  async send(report) {
    const file = new File([_blobFor(report)], _filename(report), { type: 'application/json' });
    try {
      await navigator.share({ files: [file], title: 'BOSS feedback', text: 'BOSS tester report' });
      return { ok: true, note: 'Shared.' };
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: false, note: 'Cancelled.' };
      return { ok: false, note: 'Sharing failed — use Save file instead.' };
    }
  },
});

// ── report ────────────────────────────────────────────────────────────────────
function _rid() { return Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join(''); }

/**
 * @param {object} o
 *   include: { requests, misses, gaps, device, console }   (booleans)
 *   mask:    boolean   (default true)
 *   note, tester: strings
 *   env:     object supplied by the kernel (build, platform, installed, permissions…)
 *   consoleText: string (only used if include.console)
 */
function build(o = {}) {
  const inc = { requests: true, misses: true, gaps: true, device: true, console: false, ...(o.include || {}) };
  const mask = o.mask !== false;
  const m = s => (mask ? redact(s) : String(s));

  const report = {
    schema: SCHEMA,
    id: _rid(),
    createdAt: Date.now(),
    tester: String(o.tester || '').slice(0, 60),
    note: String(o.note || '').slice(0, 2000),
    masked: mask,
  };

  if (inc.device) report.device = { ...(o.env || {}), tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return null; } })(), lang: (typeof navigator !== 'undefined' && navigator.language) || null };

  if (inc.requests) {
    report.requests = _load(REQ_KEY).map(r => ({ ...r, intent: m(r.intent) }));
  }
  if (inc.misses) {
    report.misses = _load(MISS_KEY).map(x => ({ ...x, intent: m(x.intent), note: m(x.note || '') }));
  }
  if (inc.gaps) {
    report.gaps = _load(GAPS_KEY).map(g => ({ t: g.timestamp, intent: m(g.intent), engineConfigured: !!g.engineConfigured, native: g.native || null }));
  }
  if (inc.console && o.consoleText) {
    report.console = String(o.consoleText).split('\n').slice(-80).map(m).join('\n');
  }
  report.counts = {
    requests: (report.requests || []).length,
    misses: (report.misses || []).length,
    gaps: (report.gaps || []).length,
    clarifications: (report.requests || []).filter(r => r.via === 'clarification').length,
  };
  return report;
}

/** Misses where the tester named the expected node → lines for tests/phrases.tsv */
function toCorpusTsv(report) {
  return (report.misses || []).filter(x => x.expected)
    .map(x => `${x.expected}\t${String(x.intent).replace(/[\t\n]+/g, ' ')}`).join('\n');
}

function counts() {
  return { requests: _load(REQ_KEY).length, misses: _load(MISS_KEY).length, gaps: _load(GAPS_KEY).length };
}
function clear() { try { localStorage.removeItem(REQ_KEY); localStorage.removeItem(MISS_KEY); } catch (_) {} }

async function send(transportId, report) {
  const t = _transports.get(transportId);
  if (!t) return { ok: false, note: 'Unknown way of sending.' };
  try { return await t.send(report, _filename(report)); }
  catch (e) { return { ok: false, note: 'Could not send: ' + (e && e.message || e) }; }
}

export const Feedback = {
  record, settleLast, markMiss, build, toCorpusTsv, counts, clear,
  registerTransport, listTransports, send,
  redact, SCHEMA,
  filename: _filename,
};

if (typeof window !== 'undefined') window.BOSS_feedback = Feedback;
