/**
 * B.O.S.S. COMMS Action Module — actions/comms.js
 * ================================================
 * github.com/nztdev/boss-kernel
 *
 * COMMS (label: "Phone") — reaching people. PWA tier is "light": BOSS hands
 * the request to the device's own Phone / Messages / Mail apps through
 * tel: / sms: / mailto: links. YOU confirm the call and press send — a
 * browser cannot place calls or send messages by itself.
 *
 * Native tier (not built, flagged): contacts lookup by name, direct SMS send,
 * call control. Those need the native app, so "call mom" in the PWA says so
 * honestly instead of guessing.
 *
 * Shared link opener: openScheme() from launch.js (also used by CORTEX).
 *
 * Interface:
 *   CommsAction.handle(intent, clog) → true when handled
 *   Comms.parse / claims / buildUrl   (pure helpers, used by the kernel + panel)
 */

import { openScheme } from './launch.js';

// ── Validation / URL building ─────────────────────────────────────────────────
const _NUM = /^\+?\d[\d\s().-]{1,}\d$/;
const _EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;
const _NOT_A_NAME = /^(it|me|this|that|them|him|her|us|you|a|an|the|back|now|later|up|off|tools?|settings?|status|number|numbers|book|app|apps|battery|box|area|size|field|input|editor|file|files|history|log)$/i;
/** A plausible person/contact name: ≤3 words, has a letter, none are stop-words. */
function _looksLikeName(t) {
  const words = String(t).trim().split(/\s+/);
  return words.length <= 3 && /[a-z]/i.test(t) && !words.some(w => _NOT_A_NAME.test(w));
}

export function cleanPhone(s) {
  const t = String(s || '').trim();
  if (!_NUM.test(t)) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length < 3 || digits.length > 15) return null;
  return (t.startsWith('+') ? '+' : '') + digits;
}
export function cleanEmail(s) {
  const t = String(s || '').trim().replace(/^<|>$/g, '').replace(/[.,;]+$/, '');
  return _EMAIL.test(t) ? t : null;
}

/** kind: 'call' | 'sms' | 'email'. Returns a URL or null when the target is invalid. */
export function buildUrl(kind, { to = '', body = '', subject = '' } = {}) {
  if (kind === 'call') {
    const n = cleanPhone(to);               // empty target → bare dialer
    return n ? `tel:${n}` : (to ? null : 'tel:');
  }
  if (kind === 'sms') {
    const n = cleanPhone(to);
    if (to && !n) return null;
    // "?&body=" is the form both iOS and Android accept.
    return `sms:${n || ''}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;
  }
  if (kind === 'email') {
    const e = cleanEmail(to);
    if (to && !e) return null;
    const q = [];
    if (subject) q.push('subject=' + encodeURIComponent(subject));
    if (body)    q.push('body='    + encodeURIComponent(body));
    return `mailto:${e || ''}${q.length ? '?' + q.join('&') : ''}`;
  }
  return null;
}

// ── Intent parsing ────────────────────────────────────────────────────────────
// Anchored at the START of the intent so ordinary sentences that merely contain
// "call" or "text" ("summarise this text", "what do you call it") never match.
/**
 * → null | { kind:'call'|'sms'|'email', to, body, subject, name }
 *   `to` is a validated number/address; `name` is set instead when the target
 *   looks like a person's name (contacts need the native app).
 */
export function parse(intent) {
  let raw = (intent || '').trim().replace(/[.!?]+$/, '');
  if (!raw) return null;
  // Polite / conversational wrappers: "can you send an email for me", "I want to call my mum"
  raw = raw.replace(/^(?:(?:hey|ok|okay|please|can you|could you|would you|will you|i want to|i'd like to|i need to|i wanna|let's|lets)\s+)+/i, '')
           .replace(/\s+(?:for me|please)$/i, '').trim();
  let m;

  // "make a (phone) call [to X]", "write an email [to X]" → same as the plain verbs
  if ((m = /^make\s+(?:a\s+)?(?:phone\s+)?call(?:\s+to\s+(.+))?$/i.exec(raw)))
    raw = m[1] ? 'call ' + m[1] : 'call';
  else if ((m = /^(?:write|compose|draft)\s+(?:an?\s+)?(?:e-?mail|mail)(?:\s+to\s+(.+))?$/i.exec(raw)) && !/\babout\b/i.test(raw))
    raw = m[1] ? 'email ' + m[1] : 'email';
  else if ((m = /^(?:write|compose|draft)\s+(?:an?\s+)?(?:e-?mail|mail)\s+to\s+(\S+@\S+)\s+about\s+(.+)$/i.exec(raw)))
    raw = `email ${m[1]} subject ${m[2]}`;

  if (/^(?:call|phone|dial|ring)$/i.test(raw)) return { kind: 'call', to: '' };

  // ── CALL ──
  if ((m = /^(?:please\s+)?(?:call|dial|phone|ring)\s+(.+)$/i.exec(raw))) {
    const t = m[1].trim();
    const num = cleanPhone(t);
    if (num) return { kind: 'call', to: num };
    if (_looksLikeName(t)) return { kind: 'call', name: t };
    return null;
  }

  // ── SMS ── "text +34 600 123 456 saying hi", "sms 555123: hello", "send a text to Anna"
  if ((m = /^(?:please\s+)?(?:send\s+(?:an?\s+)?)?(?:text|sms)(?:\s+message)?(?:\s+to)?\s+(.+)$/i.exec(raw)) ||
      (m = /^(?:please\s+)?send\s+(?:an?\s+)?message\s+to\s+(.+)$/i.exec(raw))) {
    const rest = m[1].trim();
    // number (with spaces) followed by optional body
    const nm = /^(\+?\d[\d\s().-]*\d)(?:\s*(?:saying|that says|with|:)\s*|\s+)?(.*)$/i.exec(rest);
    if (nm && cleanPhone(nm[1])) return { kind: 'sms', to: cleanPhone(nm[1]), body: (nm[2] || '').trim() };
    // name [saying body]
    const sp = /^(.+?)(?:\s+(?:saying|that says|with)\s+|\s*:\s*)(.+)$/i.exec(rest);
    const who = (sp ? sp[1] : rest).trim();
    const body = sp ? sp[2].trim() : '';
    if (_looksLikeName(who)) return { kind: 'sms', name: who, body };
    return null;
  }

  // ── EMAIL ── "email a@b.com subject Hi saying hello", "send an email to Anna"
  if ((m = /^(?:please\s+)?(?:send\s+(?:an?\s+)?)?(?:e-?mail|mail)(?:\s+to)?(?:\s+(.+))?$/i.exec(raw))) {
    const rest = (m[1] || '').trim();
    if (!rest) return { kind: 'email', to: '' };   // bare → open the panel
    const em = /^(\S+@\S+?)(?:[\s,]+(.*))?$/.exec(rest);
    if (em && cleanEmail(em[1])) {
      let tail = (em[2] || '').trim(), subject = '', body = '';
      const sm = /^subject\s*[:\-]?\s*(.+?)(?:\s+(?:saying|body|message|:)\s+(.+))?$/i.exec(tail);
      if (sm) { subject = sm[1].trim(); body = (sm[2] || '').trim(); }
      else { body = tail.replace(/^(?:saying|body|message|:)\s*/i, ''); }
      return { kind: 'email', to: cleanEmail(em[1]), subject, body };
    }
    if (_looksLikeName(rest)) return { kind: 'email', name: rest };
    return null;
  }

  return null;
}

/** True when COMMS should deterministically own this intent (see INTENT_CLAIMS in the kernel). */
export function claims(intent) { return !!parse(intent); }

// ── Handler ───────────────────────────────────────────────────────────────────
const _VERB = { call: 'dialler', sms: 'Messages', email: 'Mail' };

export const CommsAction = {
  async handle(intent, clog) {
    const p = parse(intent);
    if (!p) return false;

    // Person's name → needs contacts, which only the native app has.
    if (p.name) {
      clog(`📞 COMMS: I can't look up "${p.name}" in the browser — contacts need the native app`, 'log-vec');
      clog('   Give me a number or address instead, or use the Phone panel', 'log-vec');
      if (window.openCommsModal) window.openCommsModal(p.kind, { body: p.body || '' });
      return true;
    }

    // Bare "send an email" / "make a call" → just open the panel
    if (!p.to && !p.subject && !p.body) {
      if (window.openCommsModal) window.openCommsModal(p.kind);
      clog('📞 COMMS: Phone panel — ' + p.kind, 'log-vec');
      return true;
    }

    const url = buildUrl(p.kind, p);
    if (!url) { clog('📞 COMMS: that doesn\'t look like a valid number or address', 'log-err'); return true; }

    const label = p.kind === 'call' ? `call ${p.to}` : p.kind === 'sms' ? `text ${p.to}` : `email ${p.to}`;
    clog(`📞 COMMS: opening ${_VERB[p.kind]} — ${label}. You confirm and send; tap the chip if nothing opens`, 'log-action');
    openScheme(url, label);
    return true;
  },
};

export const Comms = { parse, claims, buildUrl, cleanPhone, cleanEmail };

if (typeof window !== 'undefined') window.BOSS_comms = Comms;
