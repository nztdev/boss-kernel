/**
 * B.O.S.S. Voice — actions/voice.js
 * ===================================
 * github.com/nztdev/boss-kernel
 *
 * Voice in and out for the Soma console (owned by SOMA — it is the
 * interface, how you talk to BOSS; it is not a communication node).
 *
 *   IN  — dictation via the browser's SpeechRecognition.
 *   OUT — spoken replies via SpeechSynthesis (on-device voices).
 *
 * PRIVACY (shown once, in the console, on first dictation):
 *   Browser dictation is NOT offline. Chrome sends audio to Google's speech
 *   service; Safari to Apple's. Typed intents never leave the device this
 *   way. Spoken output (SpeechSynthesis) is local.
 *
 * PLATFORM NOTES
 *   • Dictation: Chrome/Edge (desktop + Android) and Safari (iOS 14.5+, needs
 *     Siri/Dictation enabled). Not in Firefox → the mic button is hidden.
 *   • iOS only allows speech output after a user gesture; toggling the voice
 *     on (a tap) "unlocks" it.
 *   • Wake word / always-listening is native-only (Phase 10).
 */

const KEY = 'BOSS_VOICE';
const DEFAULTS = { out: false, rate: 1, voiceURI: '', autoSend: true, seenNotice: false };

let _settings = null;
let _recog = null;
let _listening = false;
let _voices = [];
const _listeners = new Set();

// ── settings ──────────────────────────────────────────────────────────────────
function _load() {
  if (_settings) return _settings;
  try { _settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch (_) { _settings = { ...DEFAULTS }; }
  return _settings;
}
function _save() { try { localStorage.setItem(KEY, JSON.stringify(_settings)); } catch (_) {} }
function _emit() { _listeners.forEach(fn => { try { fn(); } catch (_) {} }); }

// ── speech output text cleaning ───────────────────────────────────────────────
const SKIP_LINE = /^\s*(data:|kept in memory|say:|try\b|analyse:|explain:|reason:|status:|identity:|themes?:|colou?r:|reset:)/i;

export function cleanForSpeech(raw) {
  let t = String(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/^\s*[A-Z]{3,8}:\s*/, '')                 // "CHRONOS: " node tags
    .replace(/°\s*C\b/g, ' degrees Celsius').replace(/°\s*F\b/g, ' degrees Fahrenheit').replace(/°/g, ' degrees')
    .replace(/\bkm\/h\b/g, ' kilometres per hour').replace(/\bmph\b/g, ' miles per hour')
    .replace(/±/g, 'plus or minus ')
    .replace(/[—–]/g, ', ').replace(/[·•|]/g, ', ')
    .replace(/\s+/g, ' ').trim();
  return t;
}

function _speakable(raw) {
  const plain = String(raw).replace(/<[^>]*>/g, '');
  if (SKIP_LINE.test(plain)) return '';
  const t = cleanForSpeech(plain);
  return t.length >= 3 ? t : '';
}

// ── public interface ──────────────────────────────────────────────────────────
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

let _pending = [];
let _flushTimer = null;
let _lastRecogEnd = 0;     // when dictation last stopped (ms epoch)

// ── Audio routing (best-effort) ───────────────────────────────────────────────
// On iPhone, dictation puts the audio session into "play and record", which
// tends to send speech to the phone speaker instead of Bluetooth headphones,
// and Safari may not switch back by itself. Where Safari exposes the Audio
// Session API we ask for 'playback' when speaking and 'play-and-record' while
// listening. Where it doesn't, this does nothing. A web page can't fully
// control routing — the native app can (Phase 10).
function _audioSession(type) {
  try {
    const as = typeof navigator !== 'undefined' && navigator.audioSession;
    if (as && as.type !== type) { as.type = type; return true; }
    return !!as;
  } catch (_) { return false; }
}

export const Voice = {
  supportsInput()  { return !!SR; },
  supportsOutput() { return typeof window !== 'undefined' && 'speechSynthesis' in window; },

  settings() { return { ..._load() }; },
  set(patch) { Object.assign(_load(), patch); _save(); _emit(); },
  onChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); },
  isListening() { return _listening; },
  /** 'available' if this browser lets the page choose the audio session type. */
  audioSessionSupport() { return (typeof navigator !== 'undefined' && navigator.audioSession) ? 'available' : 'unavailable'; },

  // ── OUT ─────────────────────────────────────────────────────────────────────
  voices() {
    if (!this.supportsOutput()) return [];
    _voices = window.speechSynthesis.getVoices();
    return _voices;
  },

  /** Queue console text for speech; lines arriving together are spoken as one. */
  enqueue(raw) {
    const s = _load();
    if (!s.out || !this.supportsOutput()) return;
    const t = _speakable(raw);
    if (!t) return;
    _pending.push(t);
    clearTimeout(_flushTimer);
    _flushTimer = setTimeout(() => this._flush(), 450);
  },

  _flush() {
    const text = _pending.join('. ');
    _pending = [];
    if (text) this.say(text);
  },

  /** Speak text now (also used for test + the iOS gesture unlock). */
  say(text) {
    if (!this.supportsOutput()) return false;
    // Just after dictation, give the OS a moment to leave record mode, then
    // ask for playback routing before speaking.
    const since = Date.now() - _lastRecogEnd;
    if (_lastRecogEnd && since < 700) { setTimeout(() => this.say(text), 700 - since); return true; }
    _audioSession('playback');
    const s = _load();
    const u = new SpeechSynthesisUtterance(text.slice(0, 600));
    u.rate = s.rate;
    u.lang = navigator.language || 'en-US';
    // '' = BOSS default → Zarvox where the platform has it (macOS / iOS
    // novelty voice), otherwise the system default. '__system__' = user
    // explicitly chose the system default.
    let v = null;
    if (s.voiceURI && s.voiceURI !== '__system__') v = this.voices().find(x => x.voiceURI === s.voiceURI);
    else if (!s.voiceURI) v = this.voices().find(x => /zarvox/i.test(x.name));
    if (v) { u.voice = v; u.lang = v.lang; }
    window.speechSynthesis.speak(u);
    return true;
  },

  cancel() {
    _pending = []; clearTimeout(_flushTimer);
    if (this.supportsOutput()) window.speechSynthesis.cancel();
  },

  // ── IN ──────────────────────────────────────────────────────────────────────
  /**
   * Start one dictation. Callbacks: onInterim(text), onFinal(text),
   * onError(code, friendlyMessage), onEnd().
   */
  startListening({ onInterim, onFinal, onError, onEnd } = {}) {
    if (!SR) { onError && onError('unsupported', 'Dictation is not supported in this browser'); return false; }
    if (_listening) { this.stopListening(); return false; }
    this.cancel();   // don't transcribe our own voice
    _audioSession('play-and-record');

    _recog = new SR();
    _recog.lang = navigator.language || 'en-US';
    _recog.interimResults = true;
    _recog.continuous = false;
    _recog.maxAlternatives = 1;

    // Some browsers (notably iOS Safari / mobile Chrome) end a session without
    // ever flagging a result as "final", so track the latest full transcript
    // too and fall back to it when the session ends.
    let finalText = '';
    let lastText  = '';
    _recog.onresult = e => {
      let fin = '', interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript;
      }
      finalText = fin;
      lastText  = (fin + interim).trim();
      if (onInterim && lastText) onInterim(lastText);
    };
    _recog.onerror = e => {
      const msg = {
        'not-allowed':        'Microphone permission was denied',
        'service-not-allowed':'Speech service is not allowed (check Siri & Dictation settings)',
        'no-speech':          "Didn't hear anything — tap the mic and try again",
        'audio-capture':      'No microphone found',
        'network':            'Speech service unreachable (dictation needs a connection)',
        'aborted':            '',
      }[e.error];
      if (onError && msg !== '') onError(e.error, msg || `Dictation error: ${e.error}`);
    };
    _recog.onend = () => {
      _listening = false; _lastRecogEnd = Date.now(); _audioSession('playback'); _emit();
      const text = (finalText.trim() || lastText).trim();
      if (text && onFinal) onFinal(text);
      if (onEnd) onEnd();
    };

    try { _recog.start(); _listening = true; _emit(); return true; }
    catch (e) { onError && onError('start-failed', 'Could not start dictation'); return false; }
  },

  stopListening() { try { _recog && _recog.stop(); } catch (_) {} },
};

if (typeof window !== 'undefined') {
  window.BOSS_voice = Voice;
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => _emit();
}