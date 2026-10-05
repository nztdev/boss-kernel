/**
 * B.O.S.S. Launcher — actions/launch.js
 * =====================================
 * github.com/nztdev/boss-kernel
 *
 * Opens apps on THIS device through URL schemes, and runs iOS Shortcuts.
 * Used by CORTEX ("open spotify", "run shortcut BOSS Test"); the shared
 * openScheme() helper is also what COMMS uses for tel:/sms:/mailto:.
 *
 * HONESTY: a PWA cannot tell whether a scheme opened anything (no installed
 * app = nothing happens). So we try, and always show a tap-to-open chip —
 * on iOS a tap is the reliable path because typed intents have no user gesture.
 *
 * "open X on my pc/computer" is NOT handled here — that goes to the Python
 * Cortex server (os_action). Local (this device) vs PC is decided by the
 * presence of a PC word.
 *
 * Native wrap later: the same table gains Android Intents / package names;
 * callers don't change.
 */

const KEY = 'BOSS_LAUNCHER';   // user-added apps: { "name": "scheme://…" }

// ── Platform ──────────────────────────────────────────────────────────────────
export function platform() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/iPhone|iPad|iPod/i.test(ua) ||
      (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

// ── App table ─────────────────────────────────────────────────────────────────
// names: spoken/typed aliases. any: scheme used on every platform unless a
// platform-specific one is given. Missing for a platform → falls back to web.
const APPS = [
  { names: ['spotify'],                     any: 'spotify:' },
  { names: ['whatsapp'],                    any: 'whatsapp://' },
  { names: ['telegram'],                    any: 'tg://' },
  { names: ['signal'],                      any: 'sgnl://' },
  { names: ['discord'],                     any: 'discord://' },
  { names: ['slack'],                       any: 'slack://open' },
  { names: ['zoom'],                        any: 'zoommtg://' },
  { names: ['instagram'],                   any: 'instagram://app' },
  { names: ['twitter', 'x'],                any: 'twitter://' },
  { names: ['reddit'],                      any: 'reddit://' },
  { names: ['linkedin'],                    any: 'linkedin://' },
  { names: ['netflix'],                     any: 'nflx://' },
  { names: ['notion'],                      any: 'notion://' },
  { names: ['uber'],                        any: 'uber://' },
  { names: ['waze'],                        any: 'waze://' },
  { names: ['vscode', 'vs code'],           any: 'vscode://' },
  { names: ['youtube'],                     ios: 'youtube://',  android: 'vnd.youtube://', desktop: 'https://www.youtube.com' },
  { names: ['maps', 'map'],                 ios: 'maps://',     android: 'geo:0,0',        desktop: 'https://maps.google.com' },
  { names: ['gmail'],                       ios: 'googlegmail://', android: 'mailto:',     desktop: 'https://mail.google.com' },
  { names: ['mail', 'email', 'e-mail'],     any: 'mailto:' },
  { names: ['phone', 'dialer', 'dialpad'],  any: 'tel:' },
  { names: ['messages', 'sms', 'texts'],    any: 'sms:' },
  { names: ['facetime'],                    ios: 'facetime:',   desktop: 'facetime:' },
  { names: ['calendar'],                    ios: 'calshow://',  android: 'content://com.android.calendar/time/', desktop: 'https://calendar.google.com' },
  { names: ['photos', 'gallery'],           ios: 'photos-redirect://', android: 'content://media/internal/images/media', desktop: 'https://photos.google.com' },
  { names: ['music', 'apple music'],        ios: 'music://',    desktop: 'music://' },
  { names: ['podcasts'],                    ios: 'podcasts://', desktop: 'podcasts://' },
  { names: ['notes'],                       ios: 'mobilenotes://' },
  { names: ['reminders'],                   ios: 'x-apple-reminderkit://' },
  { names: ['files'],                       ios: 'shareddocuments://' },
  { names: ['shortcuts'],                   ios: 'shortcuts://' },
  { names: ['app store', 'appstore'],       ios: 'itms-apps://', android: 'market://', desktop: 'https://apps.apple.com' },
  { names: ['play store', 'google play'],   android: 'market://', desktop: 'https://play.google.com' },
  { names: ['chrome'],                      ios: 'googlechromes://', desktop: 'https://www.google.com/chrome/' },
  { names: ['firefox'],                     ios: 'firefox://',  desktop: 'https://www.mozilla.org/firefox/' },
];

// ── Custom apps (user-added, persisted + backed up) ───────────────────────────
function _loadCustom() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; }
}
function _saveCustom(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} }

/** Only app-style schemes: refuse anything that can run script or embed data. */
function _safeScheme(url) {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(url || '');
  if (!m) return false;
  return !['javascript', 'data', 'blob', 'file', 'vbscript'].includes(m[1].toLowerCase());
}

function _norm(s) { return s.toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim(); }

function _resolveApp(name) {
  const n = _norm(name);
  const custom = _loadCustom();
  for (const k of Object.keys(custom)) if (_norm(k) === n) return { label: k, url: custom[k], custom: true };
  const p = platform();
  for (const a of APPS) {
    if (!a.names.some(x => _norm(x) === n)) continue;
    const url = a[p] || a.any || a.desktop;
    if (!url) return { label: a.names[0], url: null, unsupported: true };
    return { label: a.names[0], url };
  }
  return null;
}

// ── Opening a scheme ──────────────────────────────────────────────────────────
let _chip = null, _chipTimer = null;

function _showChip(label, url) {
  if (typeof document === 'undefined') return;
  if (_chip) { _chip.remove(); clearTimeout(_chipTimer); }
  const a = document.createElement('a');
  a.href = url;
  a.textContent = `Tap to open ${label} ↗`;
  a.style.cssText =
    'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:9999;' +
    'padding:10px 18px;border-radius:20px;background:rgba(20,20,30,.95);color:#fff;' +
    'border:1px solid rgba(255,255,255,.35);font:13px system-ui,sans-serif;text-decoration:none;';
  a.addEventListener('click', () => setTimeout(() => { a.remove(); _chip = null; }, 300));
  document.body.appendChild(a);
  _chip = a;
  _chipTimer = setTimeout(() => { a.remove(); if (_chip === a) _chip = null; }, 10000);
}

/**
 * Try to open a URL scheme; always offer a tap chip as the reliable path.
 * Returns true (the attempt was made — success cannot be observed).
 */
export function openScheme(url, label) {
  if (!_safeScheme(url)) return false;
  try {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    // Web fallbacks (desktop) open in a new tab so BOSS isn't replaced.
    if (/^https?:/i.test(url)) a.target = '_blank';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
  } catch (_) { /* chip below still works */ }
  _showChip(label || url.split(':')[0], url);
  return true;
}

// ── Intent parsing ────────────────────────────────────────────────────────────
const _PC_WORD = /\b(pc|computer|desktop|laptop|cortex)\b/i;

/**
 * Returns null (not ours) or one of:
 *  { kind:'shortcut', name } | { kind:'open', app } | { kind:'unknown_open', name }
 *  { kind:'list' } | { kind:'add', name, url } | { kind:'forget', name }
 */
export function parse(intent) {
  const raw = (intent || '').trim().replace(/[.!?]+$/, '');
  if (!raw || _PC_WORD.test(raw)) return null;

  let m;
  // Shortcuts: "run shortcut BOSS Test", "run the shortcut called X", "shortcut X"
  if ((m = /^(?:run|start|trigger|launch|open|use)\s+(?:the\s+)?(?:ios\s+|apple\s+)?shortcut\s+(?:called\s+|named\s+)?(.+)$/i.exec(raw)) ||
      (m = /^shortcut\s+(.+)$/i.exec(raw))) {
    return { kind: 'shortcut', name: m[1].replace(/^["“']|["”']$/g, '').trim() };
  }

  if (/^(?:list|show|which|what)\b.*\b(?:apps?)\b.*\b(?:open|launch|know|have|can)\b/i.test(raw) ||
      /^(?:list|show)\s+(?:my\s+)?apps?$/i.test(raw)) return { kind: 'list' };

  if ((m = /^(?:add|save|register)\s+app\s+(.+?)\s+((?:[a-z][a-z0-9+.-]*):\S*)$/i.exec(raw))) {
    return { kind: 'add', name: m[1].trim(), url: m[2] };
  }
  if ((m = /^(?:forget|remove|delete)\s+app\s+(.+)$/i.exec(raw))) {
    return { kind: 'forget', name: m[1].trim() };
  }

  if ((m = /^(?:open|launch|start)\s+(?:the\s+)?(.+?)(?:\s+app)?$/i.exec(raw))) {
    const name = m[1].trim();
    // Files/documents are FILES' job, not an app.
    if (/\b(file|files|document|doc|pdf|image|photo|picture|video|clipboard)\b/i.test(name)) return null;
    const app = _resolveApp(name);
    if (app) return { kind: 'open', app };
    return { kind: 'unknown_open', name };
  }
  return null;
}

// Names that overlap another node's domain (calendar→CHRONOS, music→MEDIA …).
// These are NOT claimed: normal scoring + the Arbiter decide them.
const _CONTESTED = new Set(['photos','gallery','music','apple music','podcasts','files','notes','reminders','maps','map','phone','dialer','dialpad','messages','sms','texts','mail','email','e-mail']);

/** True when the launcher should deterministically own this intent (see INTENT_CLAIMS). */
export function claims(intent) {
  const p = parse(intent);
  if (!p) return false;
  if (p.kind === 'open') return !_CONTESTED.has(_norm(p.app.label)) || p.app.custom === true;
  return p.kind !== 'unknown_open';
}

// ── Execute ───────────────────────────────────────────────────────────────────
/** Returns true when handled (including honest failures); false to let CORTEX fall through. */
export function run(p, clog) {
  switch (p.kind) {
    case 'shortcut': {
      if (platform() !== 'ios') {
        clog(`⚡ CORTEX: Shortcuts are an iPhone/iPad feature — "${p.name}" can't run on this device`, 'log-vec');
        return true;
      }
      const url = `shortcuts://run-shortcut?name=${encodeURIComponent(p.name)}`;
      clog(`⚡ CORTEX: running shortcut "${p.name}" — tap the chip if nothing opens`, 'log-action');
      return openScheme(url, `shortcut "${p.name}"`);
    }
    case 'open': {
      if (p.app.unsupported || !p.app.url) {
        clog(`🚀 CORTEX: ${p.app.label} has no launch link on this device`, 'log-vec');
        return true;
      }
      clog(`🚀 CORTEX: opening ${p.app.label} — tap the chip if nothing happens`, 'log-action');
      return openScheme(p.app.url, p.app.label);
    }
    case 'unknown_open':
      // Not a known local app. Let the caller fall through (PC server / gap-fill).
      return false;
    case 'list': {
      const pl = platform();
      const names = APPS.filter(a => a[pl] || a.any || a.desktop).map(a => a.names[0]);
      const custom = Object.keys(_loadCustom());
      clog(`🚀 CORTEX: can open — ${names.join(', ')}`, 'log-vec');
      if (custom.length) clog(`   Yours: ${custom.join(', ')}`, 'log-vec');
      clog('   Add one: "add app NAME scheme://…" · Shortcuts (iPhone): "run shortcut NAME"', 'log-vec');
      return true;
    }
    case 'add': {
      if (!_safeScheme(p.url)) { clog('🚀 CORTEX: that link type is not allowed', 'log-err'); return true; }
      const c = _loadCustom(); c[p.name] = p.url; _saveCustom(c);
      clog(`🚀 CORTEX: added "${p.name}" → ${p.url}`, 'log-action');
      return true;
    }
    case 'forget': {
      const c = _loadCustom();
      const k = Object.keys(c).find(x => _norm(x) === _norm(p.name));
      if (!k) { clog(`🚀 CORTEX: no custom app "${p.name}"`, 'log-vec'); return true; }
      delete c[k]; _saveCustom(c);
      clog(`🚀 CORTEX: removed "${k}"`, 'log-action');
      return true;
    }
  }
  return false;
}

export const Launcher = { platform, parse, run, claims, openScheme, KEY };

if (typeof window !== 'undefined') window.BOSS_openScheme = openScheme;
