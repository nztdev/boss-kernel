/**
 * B.O.S.S. UI settings & maintenance — actions/ui.js
 * ===================================================
 * github.com/nztdev/boss-kernel
 *
 * Owned by SOMA (the interface). Not a node and not routed by scoring — it
 * backs the ⚙ Settings hub in the top bar (and the typed "settings" claim).
 *
 *   • UI settings  — text size, reduce-motion, active style  (key BOSS_UI)
 *   • Style tokens — a small registry so a style is just a set of CSS
 *                    variables. Today there is one ("default"); later styles
 *                    (density, shape, even whole layouts) register here
 *                    without touching the hub. This is the modular base for
 *                    full UI customisation.
 *   • Maintenance  — Update BOSS (refresh app files), Reset settings,
 *                    Erase everything
 *   • Permissions  — what the browser currently allows, and ways to ask
 *
 * Text size works by scaling every font-size through --ts (the stylesheet
 * writes sizes as calc(Npx * var(--ts))). The top status bar and the canvas
 * node labels keep a fixed size on purpose, so they always fit.
 */

export const BUILD = '0.9.1';          // keep in step with BUILD in core/sw.js
const KEY = 'BOSS_UI';

// Settings that "Reset settings" restores to default. Everything else —
// vault, notes, alarms, profile, keys — is DATA and is never touched by it.
export const SETTINGS_KEYS = ['BOSS_UI', 'BOSS_SOMA_CONFIG', 'BOSS_VOICE'];

export const TEXT_SIZES = [
  { id: 's',  label: 'S',  scale: 0.9 },
  { id: 'm',  label: 'M',  scale: 1.0 },
  { id: 'l',  label: 'L',  scale: 1.2 },
  { id: 'xl', label: 'XL', scale: 1.4 },
];

// ── Style registry (modular) ──────────────────────────────────────────────────
const _styles = new Map();
export function registerStyle(id, def) { _styles.set(id, { id, label: id, vars: {}, ...def }); }
export function listStyles() { return [..._styles.values()]; }
registerStyle('default', { label: 'BOSS default', vars: {} });

// ── Settings ──────────────────────────────────────────────────────────────────
function _defaults() {
  let reduce = false;
  try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) {}
  return { textSize: 'm', reduceMotion: reduce, style: 'default' };
}
let _s = null;
export function get() {
  if (_s) return _s;
  try { _s = { ..._defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch (_) { _s = _defaults(); }
  return _s;
}
export function set(patch) {
  Object.assign(get(), patch);
  try { localStorage.setItem(KEY, JSON.stringify(_s)); } catch (_) {}
  apply();
}

/** Push settings into the page. Safe to call any time (and at boot). */
export function apply() {
  const s = get();
  const root = document.documentElement;
  const size = TEXT_SIZES.find(t => t.id === s.textSize) || TEXT_SIZES[1];
  root.style.setProperty('--ts', String(size.scale));
  document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
  root.dataset.style = s.style || 'default';
  const style = _styles.get(s.style) || _styles.get('default');
  Object.entries(style.vars || {}).forEach(([k, v]) => root.style.setProperty(k, v));
}

// ── Maintenance ───────────────────────────────────────────────────────────────
async function _dropAppCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (_) {}
  try {
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (_) {}
}

/** Re-download the app files and reload. Your data is not touched. */
export async function updateBoss() {
  await _dropAppCaches();       // the page re-registers the worker on reload
  location.reload();
}

/** Put appearance / voice settings back to defaults. Data is not touched. */
export function resetSettings() {
  SETTINGS_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
  location.reload();
}

/** Wipe EVERYTHING BOSS stored on this device, then reload. Irreversible. */
export async function eraseEverything() {
  try { localStorage.clear(); } catch (_) {}
  try { sessionStorage.clear(); } catch (_) {}
  try {
    if (indexedDB && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      await Promise.all(dbs.map(d => d.name && new Promise(res => {
        const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => res();
      })));
    }
  } catch (_) {}
  await _dropAppCaches();
  location.reload();
}

// ── Environment / permissions ─────────────────────────────────────────────────
export function isInstalledApp() {
  try { return !!(window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches); }
  catch (_) { return false; }
}

async function _perm(name) {
  try { const r = await navigator.permissions.query({ name }); return r.state; }   // granted | denied | prompt
  catch (_) { return 'unknown'; }
}

/** → { location, microphone, camera, notifications } each: granted | denied | prompt | unknown | unsupported */
export async function permissionStatus() {
  const out = {
    location:      navigator.geolocation ? await _perm('geolocation') : 'unsupported',
    microphone:    (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? await _perm('microphone') : 'unsupported',
    camera:        (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? await _perm('camera') : 'unsupported',
    notifications: ('Notification' in window) ? Notification.permission.replace('default', 'prompt') : 'unsupported',
  };
  return out;
}

/** Ask for a permission (must be called from a tap). → { ok, error? } */
export async function requestPermission(which) {
  try {
    if (which === 'location') {
      await window.BOSS_getLocation({ force: true });
      return { ok: true };
    }
    if (which === 'microphone' || which === 'camera') {
      const stream = await navigator.mediaDevices.getUserMedia(which === 'camera' ? { video: true } : { audio: true });
      stream.getTracks().forEach(t => t.stop());
      return { ok: true };
    }
    if (which === 'notifications') {
      const r = await Notification.requestPermission();
      return { ok: r === 'granted', error: r === 'granted' ? '' : 'not allowed' };
    }
  } catch (e) { return { ok: false, error: (e && (e.message || e.name)) || 'failed' }; }
  return { ok: false, error: 'unsupported' };
}

export const UI = {
  BUILD, TEXT_SIZES, get, set, apply, registerStyle, listStyles,
  updateBoss, resetSettings, eraseEverything, isInstalledApp, permissionStatus, requestPermission,
};