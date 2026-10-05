/**
 * B.O.S.S. Backup Manager — actions/backup.js
 * =============================================
 * github.com/nztdev/boss-kernel
 *
 * Versioned export/import of all user state ("boss-state" files).
 * Designed so the same file moves a user between the PWA and the future
 * native app (the native shell runs this same code, so import is identical).
 *
 * MODULAR: every module owns its own localStorage keys and registers them
 * here via BackupManager.register(). Adding a module never touches the
 * export/import logic — new data is backed up automatically.
 *
 * What is NOT backed up (by design):
 *   BOSS_REGISTRY        — rebuilt from the app's own defaults; restoring a
 *                          stale copy would mask newer app versions
 *   BOSS_CURRENCY_RATES  — cache, refetched at boot
 *   BOSS_ENGINE_POOL     — derived from engine keys
 *   BOSS_CORTEX_URL      — device-specific (a phone's PC address ≠ a PC's)
 *
 * Engine API keys are excluded unless the user opts in, and are then
 * encrypted with a passphrase (PBKDF2 → AES-GCM). A key file sitting in a
 * Downloads folder must never be plaintext.
 *
 * Vault note: if vault encryption is enabled (separate feature), the vault
 * value is already an encrypted blob and travels through here untouched.
 */

const FORMAT = 'boss-state';
const VERSION = 1;               // bump on breaking schema change
const APP_VERSION = 'v0.9';

// ── Manifest ──────────────────────────────────────────────────────────────────
// { key, label, sensitive?, transform?(raw)->raw }
const _manifest = new Map();

function register(entry) {
  if (!entry || !entry.key) return;
  _manifest.set(entry.key, { sensitive: false, ...entry });
}

// Files history stores blob: URLs that die with the page — keep names only.
function _stripFileUrls(raw) {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return raw;
    return JSON.stringify(arr.map(({ url, ...rest }) => rest));
  } catch (_) { return raw; }
}

// Biometric wrap is bound to this device's authenticator — useless elsewhere.
function _stripBio(raw) {
  try { const m = JSON.parse(raw); delete m.bio; return JSON.stringify(m); } catch (_) { return raw; }
}

[
  { key: 'BOSS_VAULT',         label: 'Vault' },
  { key: 'BOSS_SECURE_META',   label: 'Encryption settings', transform: _stripBio },
  { key: 'BOSS_NOTES',         label: 'Notes' },
  { key: 'BOSS_PROFILE',       label: 'Profile' },
  { key: 'BOSS_SOMA_CONFIG',   label: 'Theme & identity' },
  { key: 'BOSS_CHRONOS_CONFIG',label: 'Alarms & clock' },
  { key: 'BOSS_MEDIA_CONFIG',  label: 'Media settings' },
  { key: 'BOSS_FILES_HISTORY', label: 'Recent files (names only)', transform: _stripFileUrls },
  { key: 'BOSS_GAPS',          label: 'Capability gap log' },
  { key: 'BOSS_VOICE',         label: 'Voice settings' },
  { key: 'BOSS_LAUNCHER',      label: 'Custom apps' },
  { key: 'BOSS_ENGINE_KEYS',   label: 'Engine API keys', sensitive: true },
].forEach(register);

// ── Crypto helpers (WebCrypto; passphrase → AES-GCM) ──────────────────────────
const _b64 = {
  enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: str => Uint8Array.from(atob(str), c => c.charCodeAt(0)),
};

async function _deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function _encrypt(text, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await _deriveKey(passphrase, salt);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { alg: 'PBKDF2-250k/AES-GCM', salt: _b64.enc(salt), iv: _b64.enc(iv), data: _b64.enc(data) };
}

async function _decrypt(blob, passphrase) {
  const key = await _deriveKey(passphrase, _b64.dec(blob.salt));
  const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _b64.dec(blob.iv) }, key, _b64.dec(blob.data));
  return new TextDecoder().decode(out);
}

async function _sha256(text) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Public interface ──────────────────────────────────────────────────────────
export const BackupManager = {
  register,
  FORMAT, VERSION,

  /** What would be exported right now: [{key,label,sensitive,bytes}] */
  describe() {
    const out = [];
    for (const e of _manifest.values()) {
      let raw = null;
      try { raw = localStorage.getItem(e.key); } catch (_) {}
      if (raw != null) out.push({ key: e.key, label: e.label, sensitive: e.sensitive, bytes: raw.length });
    }
    return out;
  },

  /**
   * Build a boss-state document (object). includeKeys requires a passphrase.
   * Throws if includeKeys without passphrase.
   */
  async buildExport({ includeKeys = false, passphrase = '' } = {}) {
    if (globalThis.SecureStore) await globalThis.SecureStore.flush();   // pending encrypted writes
    if (includeKeys && !passphrase) throw new Error('A passphrase is required to include engine keys');
    const sections = {};
    let encryptedKeys = null;

    for (const e of _manifest.values()) {
      let raw = null;
      try { raw = localStorage.getItem(e.key); } catch (_) {}
      if (raw == null) continue;
      if (e.transform) raw = e.transform(raw);

      if (e.sensitive) {
        if (!includeKeys) continue;
        encryptedKeys = encryptedKeys || {};
        encryptedKeys[e.key] = { label: e.label, enc: await _encrypt(raw, passphrase) };
      } else {
        sections[e.key] = { label: e.label, value: raw };
      }
    }

    const doc = {
      format: FORMAT,
      version: VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      sections,
    };
    if (encryptedKeys) doc.sensitive = encryptedKeys;
    doc.checksum = await _sha256(JSON.stringify(doc.sections));
    return doc;
  },

  /** Trigger a file download of the export. Returns the filename. */
  async downloadExport(opts) {
    const doc  = await this.buildExport(opts);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const name = `boss-state_${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { name, sections: Object.keys(doc.sections).length, keys: !!doc.sensitive };
  },

  /**
   * Validate a file's text WITHOUT applying it.
   * Returns { ok, error?, doc?, summary?: [{key,label,bytes}], hasKeys }
   */
  async inspect(text) {
    let doc;
    try { doc = JSON.parse(text); } catch (_) { return { ok: false, error: 'Not a valid JSON file' }; }
    if (!doc || doc.format !== FORMAT) return { ok: false, error: 'Not a B.O.S.S. state file' };
    if (typeof doc.version !== 'number' || doc.version > VERSION)
      return { ok: false, error: `File is from a newer BOSS (schema v${doc.version}); update the app first` };
    if (!doc.sections || typeof doc.sections !== 'object')
      return { ok: false, error: 'File has no data sections' };
    const sum = await _sha256(JSON.stringify(doc.sections));
    if (doc.checksum && doc.checksum !== sum)
      return { ok: false, error: 'File is damaged or was edited (checksum mismatch)' };
    const summary = Object.entries(doc.sections).map(([key, s]) => ({
      key, label: s.label || key, bytes: (s.value || '').length,
    }));
    return { ok: true, doc, summary, hasKeys: !!doc.sensitive,
             appVersion: doc.appVersion, exportedAt: doc.exportedAt };
  },

  /**
   * Apply a validated doc. Only keys present in the file are overwritten
   * (others untouched). Unknown keys are ignored — the manifest is the
   * allow-list, so a file can never write arbitrary storage.
   */
  async apply(doc, { passphrase = '' } = {}) {
    // Decrypt first: a wrong passphrase must fail BEFORE anything is written.
    const decrypted = [];
    if (doc.sensitive && passphrase) {
      for (const [key, s] of Object.entries(doc.sensitive)) {
        if (!_manifest.has(key)) continue;
        decrypted.push([key, await _decrypt(s.enc, passphrase)]);   // throws if wrong
      }
    }
    let written = 0, skipped = 0;
    for (const [key, s] of Object.entries(doc.sections)) {
      if (!_manifest.has(key) || typeof s.value !== 'string') { skipped++; continue; }
      try { localStorage.setItem(key, s.value); written++; } catch (_) { skipped++; }
    }
    let keysRestored = 0;
    for (const [key, plain] of decrypted) {
      try { localStorage.setItem(key, plain); keysRestored++; } catch (_) { skipped++; }
    }
    return { written, skipped, keysRestored };
  },
};
