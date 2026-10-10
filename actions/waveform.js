/**
 * B.O.S.S. Speaking Animation — actions/waveform.js
 * ==================================================
 * A visual "BOSS is speaking / listening" indicator. Self-contained: renders
 * its own canvases and CSS, reads the Voice module's state, owns one setting.
 *
 *   Waveform.init({ voice, getAnchor })
 *     voice     — the Voice module (needs onSpeak(), isSpeaking(), isListening(), onChange())
 *     getAnchor — () => ({ x, y, color }) screen position of the SOMA node (for "ring")
 *   Waveform.setMode('strip' | 'ring' | 'off')   Waveform.getMode()
 *   Waveform.setCollapsed(bool)                  (strip only; tap the strip to toggle)
 *
 * HONESTY NOTE — this is synthetic. Browsers do not expose the audio of
 * speechSynthesis, so there is no real waveform to draw. The animation is
 * driven by speaking-state events (start / end / word boundaries where the
 * platform reports them) and smooth pseudo-random motion. It means "BOSS is
 * speaking", not "this is the sound". The data source is isolated in
 * _level(), so a real analyser (when BOSS plays audio it controls) can be
 * dropped in later without touching the drawing code.
 *
 * Behaviour
 *   • Strip: a slim bar above the input box. Hidden when idle, grows while BOSS
 *     speaks (cyan) or listens (amber, calmer). Tap it to collapse to a thin line.
 *   • Ring: expanding rings from the SOMA node on a transparent overlay.
 *   • Reduce-motion (Settings / system) → a still, low indicator, no animation.
 *   • Animation frames only run while active (no idle battery cost).
 */

const KEY = 'BOSS_WAVE';
export const MODES = [
  { id: 'strip', label: 'Strip above the input' },
  { id: 'ring',  label: 'Ring around SOMA' },
  { id: 'off',   label: 'Off' },
];

let _cfg = { voice: null, getAnchor: () => null };
let _st = { mode: 'strip', collapsed: false };
let _built = false;
let _strip, _sctx, _ring, _rctx;
let _raf = 0;
let _amp = 0;              // smoothed 0..1
let _boost = 0;            // word-boundary kick, decays
let _state = 'idle';       // 'idle' | 'speaking' | 'listening'
let _t0 = performance.now();
const _BARS = 36;
const _ph = Array.from({ length: _BARS }, () => ({ a: Math.random() * 6.28, b: Math.random() * 6.28, f: 0.8 + Math.random() * 1.6 }));

const CSS = `
#wave-strip{display:none;pointer-events:auto;width:100%;max-width:440px;height:0;overflow:hidden;
  transition:height .25s ease;cursor:pointer;margin:0 0 4px;border-radius:6px;
  background:rgba(0,20,10,.55);border:1px solid transparent}
#wave-strip.on{display:block;height:34px;border-color:var(--dim,#0f2a20)}
#wave-strip.collapsed.on{height:6px}
#wave-strip canvas{position:static;top:auto;left:auto;display:block;width:100%;height:100%}
#wave-ring{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;display:none}
#wave-ring.on{display:block}
`;

function _load() {
  try { const o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; if (o.mode) _st.mode = o.mode; _st.collapsed = !!o.collapsed; } catch (_) {}
  if (!MODES.some(m => m.id === _st.mode)) _st.mode = 'strip';
}
function _save() { try { localStorage.setItem(KEY, JSON.stringify(_st)); } catch (_) {} }

const _reduced = () => document.body.classList.contains('reduce-motion') ||
  (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && !document.body.classList.contains('motion-on'));
const _color = () => (getComputedStyle(document.documentElement).getPropertyValue('--glow') || '#00ffcc').trim() || '#00ffcc';
const _amber = '#ffcc00';

// ── level source (swap this for a real analyser later) ───────────────────────
/** 0..1 target level for the current state. */
function _level(now) {
  if (_state === 'idle') return 0;
  const t = (now - _t0) / 1000;
  const base = _state === 'speaking' ? 0.55 : 0.28;
  const wob  = 0.22 * Math.sin(t * 5.1) * Math.sin(t * 1.7 + 1) + 0.12 * Math.sin(t * 11.3);
  return Math.max(0, Math.min(1, base + wob + _boost));
}

// ── drawing ──────────────────────────────────────────────────────────────────
function _fitCanvas(c, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return false;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return true;
}

function _drawStrip(now) {
  if (!_fitCanvas(_strip, _sctx)) return;
  const w = _strip.clientWidth, h = _strip.clientHeight;
  _sctx.clearRect(0, 0, w, h);
  const col = _state === 'listening' ? _amber : _color();
  const t = (now - _t0) / 1000;
  const reduced = _reduced();
  const gap = 3, bw = (w - gap * (_BARS + 1)) / _BARS;
  _sctx.fillStyle = col;
  for (let i = 0; i < _BARS; i++) {
    const p = _ph[i];
    // bell-shaped envelope so the middle is livelier than the edges
    const env = 0.35 + 0.65 * Math.sin((i + 0.5) / _BARS * Math.PI);
    const v = reduced ? 0.25 : (0.5 + 0.5 * Math.sin(t * p.f * 3 + p.a)) * (0.6 + 0.4 * Math.sin(t * p.f * 1.3 + p.b));
    const bh = Math.max(2, (h - 6) * Math.min(1, 1.5 * _amp * env * (0.3 + 0.7 * v)));
    _sctx.globalAlpha = 0.35 + 0.65 * Math.min(1, _amp * 1.4);
    _sctx.fillRect(gap + i * (bw + gap), (h - bh) / 2, bw, bh);
  }
  _sctx.globalAlpha = 1;
}

function _drawRing(now) {
  if (!_fitCanvas(_ring, _rctx)) return;
  const w = _ring.clientWidth, h = _ring.clientHeight;
  _rctx.clearRect(0, 0, w, h);
  const a = _cfg.getAnchor && _cfg.getAnchor();
  if (!a) return;
  const col = _state === 'listening' ? _amber : (a.color || _color());
  const t = (now - _t0) / 1000;
  const reduced = _reduced();
  const baseR = 30;
  _rctx.strokeStyle = col; _rctx.fillStyle = col;
  // soft pulsing glow on the node itself
  const g = _rctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, baseR + 26 * _amp);
  g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00');
  _rctx.fillStyle = g; _rctx.beginPath(); _rctx.arc(a.x, a.y, baseR + 26 * _amp, 0, 6.2832); _rctx.fill();
  const rings = 3;
  for (let i = 0; i < rings; i++) {
    const prog = reduced ? 0.4 : ((t * (_state === 'speaking' ? 0.55 : 0.3) + i / rings) % 1);
    const r = baseR + prog * (44 + 30 * _amp);
    _rctx.globalAlpha = Math.max(0, (1 - prog)) * Math.min(1, 0.25 + _amp) * 0.8;
    _rctx.lineWidth = 1 + 2.2 * _amp * (1 - prog);
    _rctx.beginPath(); _rctx.arc(a.x, a.y, r, 0, 6.2832); _rctx.stroke();
  }
  _rctx.globalAlpha = 1;
}

// ── loop (runs only while there is something to show) ────────────────────────
function _frame(now) {
  _raf = 0;
  const target = _level(now);
  _amp += (target - _amp) * (target > _amp ? 0.25 : 0.08);
  _boost *= 0.9;
  if (_st.mode === 'strip') _drawStrip(now);
  else if (_st.mode === 'ring') _drawRing(now);
  const keepGoing = _state !== 'idle' || _amp > 0.02;
  if (keepGoing && !_reduced()) _raf = requestAnimationFrame(_frame);
  else if (!keepGoing) _hide();
}
function _kick() { if (!_raf) _raf = requestAnimationFrame(_frame); }

function _show() {
  if (_st.mode === 'strip') { _strip.parentNode.classList.add('on'); _strip.parentNode.classList.toggle('collapsed', _st.collapsed); }
  if (_st.mode === 'ring') _ring.classList.add('on');
}
function _hide() {
  if (!_built) return;
  _strip.parentNode.classList.remove('on'); _ring.classList.remove('on');
  _sctx.clearRect(0, 0, _strip.width, _strip.height); _rctx.clearRect(0, 0, _ring.width, _ring.height);
}

function _setState(s) {
  if (_st.mode === 'off') { _state = 'idle'; _hide(); return; }
  if (s === _state) return;
  _state = s;
  if (s !== 'idle') { _t0 = performance.now(); _show(); }
  // reduced motion: draw one still frame and stop
  if (_reduced()) { _amp = s === 'idle' ? 0 : 0.5; const now = performance.now(); (_st.mode === 'strip' ? _drawStrip : _drawRing)(now); if (s === 'idle') _hide(); return; }
  _kick();
}

function _sync() {
  const v = _cfg.voice; if (!v) return;
  _setState(v.isSpeaking() ? 'speaking' : v.isListening() ? 'listening' : 'idle');
}

// ── build / API ──────────────────────────────────────────────────────────────
function _build() {
  if (_built) return; _built = true;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const wrap = document.createElement('div'); wrap.id = 'wave-strip';
  wrap.innerHTML = '<canvas></canvas>';
  wrap.title = 'Tap to collapse';
  wrap.addEventListener('click', () => setCollapsed(!_st.collapsed));
  const bar = document.getElementById('input-bar');
  if (bar && bar.parentNode) bar.parentNode.insertBefore(wrap, document.getElementById('fb-miss-chip') || bar);
  else document.body.appendChild(wrap);
  _strip = wrap.querySelector('canvas'); _sctx = _strip.getContext('2d');

  _ring = document.createElement('canvas'); _ring.id = 'wave-ring';
  document.body.appendChild(_ring); _rctx = _ring.getContext('2d');
}

export function getMode() { return _st.mode; }
export function setMode(m) {
  if (!MODES.some(x => x.id === m)) return;
  _st.mode = m; _save();
  _hide(); _state = 'idle'; _amp = 0;
  _sync();
}
export function getCollapsed() { return _st.collapsed; }
export function setCollapsed(c) {
  _st.collapsed = !!c; _save();
  if (_built) _strip.parentNode.classList.toggle('collapsed', _st.collapsed);
}

export function init(cfg) {
  _cfg = { ..._cfg, ...(cfg || {}) };
  _load(); _build();
  const v = _cfg.voice;
  if (v) {
    v.onSpeak(kind => {
      if (kind === 'boundary') { _boost = Math.min(0.4, _boost + 0.18); return; }
      _sync();
    });
    v.onChange(_sync);
  }
  window.addEventListener('resize', () => { if (_state !== 'idle') _kick(); });
}

export const Waveform = { init, getMode, setMode, getCollapsed, setCollapsed, MODES,
  /** test helper: force a state without the Voice module */
  _force: s => { _setState(s); } };
if (typeof window !== 'undefined') window.BOSS_wave = Waveform;
