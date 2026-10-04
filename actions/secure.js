/**
 * B.O.S.S. SecureStore — actions/secure.js
 * ==========================================
 * github.com/nztdev/boss-kernel
 *
 * Opt-in encryption at rest for the private collections (Vault + Notes).
 *
 * DESIGN
 *   A random 256-bit data key K encrypts the collections (AES-GCM).
 *   K itself is stored only *wrapped*:
 *     • wrapP — wrapped by a key derived from the user's passphrase (PBKDF2)
 *     • wrapB — optional; wrapped by a key derived from a WebAuthn PRF secret
 *               (Face ID / fingerprint / device PIN). Only offered where the
 *               browser supports the PRF extension.
 *   Changing the passphrase just re-wraps K — no bulk re-encryption.
 *
 *   NO RECOVERY: forget the passphrase (and lose biometric) and the data is
 *   unreadable. This is deliberate and is warned about in the UI.
 *
 * SYNC API, ASYNC CRYPTO
 *   The rest of BOSS reads/writes the vault synchronously. SecureStore keeps
 *   the decrypted collections in memory while unlocked, so read()/write() stay
 *   synchronous; persistence (encrypt → localStorage) is queued.
 *   While locked, read() returns the fallback and write() refuses.
 *
 * CRASH SAFETY
 *   enable():  meta is written first, then envelopes. disable(): plaintext is
 *   written first, then meta is removed. read() tolerates a plaintext value
 *   when encryption is on (and re-encrypts it on next write), so an
 *   interruption between steps never loses data.
 *
 * BACKUP
 *   Envelopes + BOSS_SECURE_META travel together in a boss-state file; the
 *   device-specific biometric block is stripped on export (see backup.js).
 */

export const SECURE_META_KEY = 'BOSS_SECURE_META';
const COLLECTIONS = ['BOSS_VAULT', 'BOSS_NOTES'];
const PBKDF2_ITER = 250000;
const MAGIC = 'boss_enc';

// ── byte helpers ──────────────────────────────────────────────────────────────
const _b64 = {
  enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: str => Uint8Array.from(atob(str), c => c.charCodeAt(0)),
};
const _rand = n => crypto.getRandomValues(new Uint8Array(n));

// ── state (memory only) ───────────────────────────────────────────────────────
let _K = null;                 // CryptoKey (non-extractable) while unlocked
const _cache = {};             // key -> decrypted JS value while unlocked
let _queue = Promise.resolve();
let _idleTimer = null;
const _listeners = new Set();

function _emit() { _listeners.forEach(fn => { try { fn(SecureStore.status()); } catch (_) {} }); }

// ── meta ──────────────────────────────────────────────────────────────────────
function _getMeta() {
  try {
    const raw = localStorage.getItem(SECURE_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
function _setMeta(m) {
  if (m) localStorage.setItem(SECURE_META_KEY, JSON.stringify(m));
  else localStorage.removeItem(SECURE_META_KEY);
}

// ── crypto ────────────────────────────────────────────────────────────────────
async function _kekFromPassphrase(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function _kekFromSecret(secretBytes, salt) {
  const base = await crypto.subtle.importKey('raw', secretBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('boss-vault-wrap') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function _wrap(kek, rawK) {
  const iv = _rand(12);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, rawK);
  return { iv: _b64.enc(iv), data: _b64.enc(data) };
}
async function _unwrap(kek, w) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _b64.dec(w.iv) }, kek, _b64.dec(w.data)));
}
const _importK = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

async function _seal(value) {
  const iv = _rand(12);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, _K, new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify({ [MAGIC]: 1, iv: _b64.enc(iv), data: _b64.enc(data) });
}
async function _open(envelopeObj) {
  const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _b64.dec(envelopeObj.iv) }, _K, _b64.dec(envelopeObj.data));
  return JSON.parse(new TextDecoder().decode(out));
}
const _isEnvelope = o => o && typeof o === 'object' && o[MAGIC] === 1;

function _parseRaw(key) {
  try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); } catch (_) { return null; }
}

// ── auto-lock ─────────────────────────────────────────────────────────────────
function _armIdle() {
  clearTimeout(_idleTimer);
  const meta = _getMeta();
  const min = meta && typeof meta.autoLockMin === 'number' ? meta.autoLockMin : 5;
  if (!_K || min <= 0) return;
  _idleTimer = setTimeout(() => SecureStore.lock(), min * 60000);
}
if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (_K) _armIdle(); }, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    // Backgrounded for more than 60 s while unlocked → lock.
    if (document.hidden && _K) {
      window.__bossHiddenAt = Date.now();
    } else if (!document.hidden && _K && window.__bossHiddenAt && Date.now() - window.__bossHiddenAt > 60000) {
      SecureStore.lock();
    }
  });
}

// ── load all collections into the memory cache (after unlock) ─────────────────
async function _loadCache() {
  for (const key of COLLECTIONS) {
    const parsed = _parseRaw(key);
    if (parsed == null) { _cache[key] = []; continue; }
    if (_isEnvelope(parsed)) _cache[key] = await _open(parsed);
    else { _cache[key] = parsed; _persist(key); }   // plaintext leftover → adopt & encrypt
  }
}

function _persist(key) {
  _queue = _queue.then(async () => {
    if (!_K || !(key in _cache)) return;
    try { localStorage.setItem(key, await _seal(_cache[key])); } catch (_) {}
  });
  return _queue;
}

// ── WebAuthn PRF (biometric / device-PIN quick unlock) ────────────────────────
async function _prfSecret(credIdB64, saltB64) {
  const cred = await navigator.credentials.get({ publicKey: {
    challenge: _rand(32),
    allowCredentials: [{ type: 'public-key', id: _b64.dec(credIdB64) }],
    userVerification: 'required',
    extensions: { prf: { eval: { first: _b64.dec(saltB64) } } },
  }});
  const first = cred.getClientExtensionResults()?.prf?.results?.first;
  if (!first) throw new Error('This device did not return a biometric secret');
  return new Uint8Array(first);
}

// ── Public interface ──────────────────────────────────────────────────────────
export const SecureStore = {
  COLLECTIONS,

  isEnabled() { return !!_getMeta(); },
  isLocked()  { return this.isEnabled() && !_K; },

  status() {
    const m = _getMeta();
    return {
      enabled: !!m, locked: !!m && !_K,
      biometric: !!(m && m.bio), autoLockMin: m && typeof m.autoLockMin === 'number' ? m.autoLockMin : 5,
    };
  },
  onChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); },

  /** Synchronous read. Plain mode: straight from storage. Locked: fallback. */
  read(key, fallback = []) {
    if (!this.isEnabled()) {
      const v = _parseRaw(key);
      return v == null ? fallback : v;
    }
    if (_K) return key in _cache ? _cache[key] : fallback;
    const v = _parseRaw(key);                       // locked: only legacy plaintext is visible
    return (v != null && !_isEnvelope(v)) ? v : fallback;
  },

  /** Synchronous write. Returns false if refused (locked). */
  write(key, value) {
    if (!this.isEnabled()) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
    }
    if (!_K) return false;
    _cache[key] = value;
    _persist(key);
    return true;
  },

  /** Turn encryption on. Encrypts existing data. */
  async enable(passphrase) {
    if (this.isEnabled()) throw new Error('Encryption is already on');
    if (!passphrase || passphrase.length < 8) throw new Error('Passphrase must be at least 8 characters');
    const rawK = _rand(32);
    const salt = _rand(16);
    const kek  = await _kekFromPassphrase(passphrase, salt, PBKDF2_ITER);
    const meta = { v: 1, iter: PBKDF2_ITER, salt: _b64.enc(salt), wrapP: await _wrap(kek, rawK), autoLockMin: 5 };

    const plain = {};
    COLLECTIONS.forEach(k => { const v = _parseRaw(k); plain[k] = v == null ? [] : v; });

    _K = await _importK(rawK);
    _setMeta(meta);                                  // meta first (crash-safe, see header)
    for (const k of COLLECTIONS) { _cache[k] = plain[k]; await _persist(k); }
    _armIdle(); _emit();
  },

  async unlock(passphrase) {
    const meta = _getMeta();
    if (!meta) return true;
    if (_K) return true;
    let rawK;
    try {
      const kek = await _kekFromPassphrase(passphrase, _b64.dec(meta.salt), meta.iter);
      rawK = await _unwrap(kek, meta.wrapP);
    } catch (_) { return false; }                    // wrong passphrase
    _K = await _importK(rawK);
    await _loadCache();
    _armIdle(); _emit();
    return true;
  },

  async unlockBiometric() {
    const meta = _getMeta();
    if (!meta || !meta.bio) throw new Error('Biometric unlock is not set up');
    const secret = await _prfSecret(meta.bio.credId, meta.bio.salt);
    const kek = await _kekFromSecret(secret, _b64.dec(meta.bio.salt));
    const rawK = await _unwrap(kek, meta.bio.wrapB);
    _K = await _importK(rawK);
    await _loadCache();
    _armIdle(); _emit();
    return true;
  },

  lock() {
    _K = null;
    Object.keys(_cache).forEach(k => delete _cache[k]);
    clearTimeout(_idleTimer);
    _emit();
  },

  /** Turn encryption off (must be unlocked). Writes plaintext back. */
  async disable() {
    if (!this.isEnabled()) return;
    if (!_K) throw new Error('Unlock first');
    await _queue;
    for (const k of COLLECTIONS) localStorage.setItem(k, JSON.stringify(_cache[k] ?? []));
    _setMeta(null);                                  // meta last (crash-safe)
    this.lock();
  },

  async changePassphrase(oldPass, newPass) {
    const meta = _getMeta();
    if (!meta) throw new Error('Encryption is off');
    if (!newPass || newPass.length < 8) throw new Error('Passphrase must be at least 8 characters');
    let rawK;
    try { rawK = await _unwrap(await _kekFromPassphrase(oldPass, _b64.dec(meta.salt), meta.iter), meta.wrapP); }
    catch (_) { throw new Error('Current passphrase is wrong'); }
    const salt = _rand(16);
    meta.salt  = _b64.enc(salt);
    meta.iter  = PBKDF2_ITER;
    meta.wrapP = await _wrap(await _kekFromPassphrase(newPass, salt, PBKDF2_ITER), rawK);
    _setMeta(meta);
  },

  setAutoLock(min) {
    const meta = _getMeta();
    if (!meta) return;
    meta.autoLockMin = min;
    _setMeta(meta);
    _armIdle();
  },

  // ── Biometric ───────────────────────────────────────────────────────────────
  async biometricSupported() {
    try {
      return !!(window.PublicKeyCredential &&
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (_) { return false; }
  },

  /** Must be unlocked. Throws a readable error if PRF is unsupported. */
  async enableBiometric(passphrase) {
    const meta = _getMeta();
    if (!meta) throw new Error('Turn encryption on first');
    if (!_K) throw new Error('Unlock first');
    // Need raw K to wrap it again: re-derive from the passphrase.
    let rawK;
    try { rawK = await _unwrap(await _kekFromPassphrase(passphrase, _b64.dec(meta.salt), meta.iter), meta.wrapP); }
    catch (_) { throw new Error('Passphrase is wrong'); }

    const cred = await navigator.credentials.create({ publicKey: {
      challenge: _rand(32),
      rp: { name: 'B.O.S.S.', id: location.hostname },
      user: { id: _rand(16), name: 'boss-vault', displayName: 'B.O.S.S. vault' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      extensions: { prf: {} },
    }});
    if (!cred.getClientExtensionResults()?.prf?.enabled)
      throw new Error('This device/browser does not support biometric vault unlock — passphrase only');

    const credId = _b64.enc(cred.rawId);
    const salt = _rand(32);
    const secret = await _prfSecret(credId, _b64.enc(salt));
    const kek = await _kekFromSecret(secret, salt);
    meta.bio = { credId, salt: _b64.enc(salt), wrapB: await _wrap(kek, rawK) };
    _setMeta(meta);
    _emit();
  },

  disableBiometric() {
    const meta = _getMeta();
    if (!meta) return;
    delete meta.bio;
    _setMeta(meta);
    _emit();
  },

  /** Await pending encrypt/writes (used before backup/export). */
  flush() { return _queue; },
};

if (typeof window !== 'undefined') window.SecureStore = SecureStore;
