/**
 * B.O.S.S. Feedback UI — actions/feedback-ui.js
 * ==============================================
 * Self-contained: renders its own DOM and CSS, talks to feedback.js.
 *
 *   FeedbackUI.init({ getEnv, getNodeNames, getConsoleText, log })
 *   FeedbackUI.noteLastPulse({ intent, node, via })   ← kernel calls after every pulse
 *   FeedbackUI.openReport()                           ← ⚙ Settings → "Send feedback"
 *
 * Two surfaces:
 *   1. A small "✋ Not what I meant" chip that appears above the input bar for
 *      ~30 s after each pulse. Tap → say which part of BOSS you expected (or
 *      just describe it) → saved as a labelled miss.
 *   2. A tester-report sheet: choose what to include, see the exact file
 *      contents, then share or save it. Nothing is ever sent automatically.
 */

import { Feedback } from './feedback.js';

let _cfg = { getEnv: () => ({}), getNodeNames: () => [], getConsoleText: () => '', log: () => {} };
let _last = null;          // { intent, node, via }
let _chipTimer = null;
let _built = false;
let _expected = null;

const CSS = `
#fb-miss-chip{display:none;margin:0 0 6px;padding:5px 10px;font:calc(10px * var(--ts,1)) 'Share Tech Mono',monospace;
  color:#ffcc88;background:rgba(40,25,0,.7);border:1px solid #5a4010;border-radius:14px;cursor:pointer;align-self:flex-start}
#fb-miss-chip.show{display:inline-block}
.fb-overlay{display:none;position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.8);backdrop-filter:blur(4px);
  align-items:center;justify-content:center;padding:12px}
.fb-overlay.show{display:flex}
.fb-box{background:rgba(3,10,6,.98);border:1px solid var(--dim,#0f2a20);border-radius:8px;width:100%;max-width:360px;
  max-height:90vh;overflow-y:auto;padding:16px 18px;font-family:'Share Tech Mono',monospace;color:var(--glow,#00ffcc)}
.fb-h{font-family:'Orbitron',monospace;font-size:calc(11px * var(--ts,1));letter-spacing:.15em;margin-bottom:10px}
.fb-p{font-size:calc(11px * var(--ts,1));line-height:1.55;color:#88ccaa;margin-bottom:10px}
.fb-q{font-size:calc(11px * var(--ts,1));color:#ccffee;margin:8px 0;padding:7px 9px;background:rgba(0,40,25,.5);border-radius:4px;word-break:break-word}
.fb-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.fb-chip{font:calc(10px * var(--ts,1)) 'Share Tech Mono',monospace;color:var(--glow,#00ffcc);background:transparent;
  border:1px solid #1a4a38;border-radius:14px;padding:5px 10px;cursor:pointer}
.fb-chip.on{background:rgba(0,255,204,.15);border-color:var(--glow,#00ffcc)}
.fb-ta,.fb-in{width:100%;background:rgba(0,20,10,.8);border:1px solid #1a4a38;border-radius:4px;color:#ccffee;
  font:calc(12px * var(--ts,1)) 'Share Tech Mono',monospace;padding:8px;margin:6px 0;resize:vertical}
.fb-ta{min-height:64px}
.fb-row{display:flex;align-items:center;justify-content:space-between;font-size:calc(11px * var(--ts,1));color:#88ccaa;padding:5px 0}
.fb-row small{color:#446655;display:block;font-size:calc(9px * var(--ts,1))}
.fb-btn{font:calc(11px * var(--ts,1)) 'Share Tech Mono',monospace;color:var(--glow,#00ffcc);background:rgba(0,40,25,.6);
  border:1px solid #1a4a38;border-radius:5px;padding:9px 12px;cursor:pointer}
.fb-btn.primary{background:rgba(0,255,204,.14);border-color:var(--glow,#00ffcc)}
.fb-btn:disabled{opacity:.4}
.fb-grid{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.fb-grid .fb-btn{flex:1;min-width:110px}
.fb-pre{white-space:pre-wrap;word-break:break-word;font-size:calc(9px * var(--ts,1));color:#88ccaa;background:rgba(0,15,8,.9);
  border:1px solid #0f2a20;border-radius:4px;padding:8px;max-height:220px;overflow:auto;margin-top:8px}
.fb-note{font-size:calc(10px * var(--ts,1));color:#ffcc88;min-height:14px;margin-top:8px}
.fb-never{font-size:calc(9px * var(--ts,1));color:#446655;line-height:1.5;margin-top:8px}
`;

function _el(html) { const t = document.createElement('div'); t.innerHTML = html.trim(); return t.firstChild; }

function _build() {
  if (_built) return; _built = true;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  // chip, placed above the input bar
  const chip = _el(`<button id="fb-miss-chip" type="button">✋ Not what I meant</button>`);
  chip.addEventListener('click', openMiss);
  const bar = document.getElementById('input-bar');
  if (bar && bar.parentNode) bar.parentNode.insertBefore(chip, bar);

  // miss sheet
  const miss = _el(`<div class="fb-overlay" id="fb-miss"><div class="fb-box">
    <div class="fb-h">✋ NOT WHAT I MEANT</div>
    <div class="fb-p">You said:</div><div class="fb-q" id="fb-miss-intent"></div>
    <div class="fb-p" id="fb-miss-got"></div>
    <div class="fb-p">Which part of BOSS should have handled it? <small style="color:#446655">(optional)</small></div>
    <div class="fb-chips" id="fb-miss-nodes"></div>
    <textarea class="fb-ta" id="fb-miss-note" placeholder="What did you expect to happen? (optional)"></textarea>
    <div class="fb-grid"><button class="fb-btn" id="fb-miss-cancel">Cancel</button><button class="fb-btn primary" id="fb-miss-save">Save</button></div>
    <div class="fb-never">Saved on this device. It only leaves when you send a tester report.</div>
  </div></div>`);
  document.body.appendChild(miss);
  miss.addEventListener('click', e => { if (e.target === miss) closeMiss(); });
  miss.querySelector('#fb-miss-cancel').onclick = closeMiss;
  miss.querySelector('#fb-miss-save').onclick = _saveMiss;

  // report sheet
  const rep = _el(`<div class="fb-overlay" id="fb-report"><div class="fb-box">
    <div class="fb-h">💬 TESTER REPORT</div>
    <div class="fb-p">Packages what you tried and how BOSS handled it into one file for the BOSS team. <b>Nothing is sent automatically</b> — you choose to share or save it.</div>
    <div class="fb-p" id="fb-counts"></div>
    <input class="fb-in" id="fb-tester" maxlength="60" placeholder="Your name or initials (optional)">
    <textarea class="fb-ta" id="fb-rnote" placeholder="Anything confusing, broken or missing? What were you trying to do?"></textarea>
    <div class="fb-row"><span>Requests &amp; what BOSS did<small>Each thing you typed or said, and where it went</small></span><input type="checkbox" id="fb-i-req" checked></div>
    <div class="fb-row"><span>“Not what I meant” flags</span><input type="checkbox" id="fb-i-miss" checked></div>
    <div class="fb-row"><span>Unmatched requests (gaps)</span><input type="checkbox" id="fb-i-gaps" checked></div>
    <div class="fb-row"><span>Device &amp; app info<small>Version, phone/computer type, installed or browser</small></span><input type="checkbox" id="fb-i-dev" checked></div>
    <div class="fb-row"><span>Activity log<small>The console text — may contain more detail</small></span><input type="checkbox" id="fb-i-con"></div>
    <div class="fb-row"><span>Hide numbers, emails &amp; links<small>Recommended</small></span><input type="checkbox" id="fb-i-mask" checked></div>
    <div class="fb-grid"><button class="fb-btn" id="fb-preview">👁 Preview file</button></div>
    <div class="fb-pre" id="fb-pre" style="display:none"></div>
    <div class="fb-grid" id="fb-send"></div>
    <div class="fb-note" id="fb-rstatus"></div>
    <div class="fb-never">Never included: notes, vault, API keys, clipboard, location, files or contacts.</div>
    <div class="fb-grid"><button class="fb-btn" id="fb-clear">Clear saved log</button><button class="fb-btn" id="fb-rclose">✕ Close</button></div>
  </div></div>`);
  document.body.appendChild(rep);
  rep.addEventListener('click', e => { if (e.target === rep) closeReport(); });
  rep.querySelector('#fb-rclose').onclick = closeReport;
  rep.querySelector('#fb-preview').onclick = _preview;
  rep.querySelector('#fb-clear').onclick = () => {
    if (confirm('Clear the saved request log and flags on this device?')) { Feedback.clear(); _refreshReport(); }
  };
  rep.querySelectorAll('input[type=checkbox]').forEach(i => i.addEventListener('change', () => { _preview(true); }));
}

// ── miss flow ─────────────────────────────────────────────────────────────────
function noteLastPulse(p) {
  _build();
  _last = p && p.intent ? { intent: p.intent, node: p.node || null, via: p.via || null } : null;
  const chip = document.getElementById('fb-miss-chip');
  if (!chip) return;
  clearTimeout(_chipTimer);
  if (!_last) { chip.classList.remove('show'); return; }
  chip.classList.add('show');
  _chipTimer = setTimeout(() => chip.classList.remove('show'), 30000);
}

function openMiss() {
  _build();
  if (!_last) return;
  _expected = null;
  document.getElementById('fb-miss-intent').textContent = _last.intent;
  const got = document.getElementById('fb-miss-got');
  got.textContent = _last.node ? `BOSS sent it to ${_last.node}${_last.via ? ' (' + _last.via + ')' : ''}.` :
                    (_last.via === 'clarification' ? 'BOSS asked you to choose between two parts.' : 'BOSS did not route it anywhere.');
  const nodes = _cfg.getNodeNames();
  const box = document.getElementById('fb-miss-nodes');
  box.innerHTML = '';
  nodes.concat(['None — it can’t do this']).forEach(n => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fb-chip'; b.textContent = n;
    b.onclick = () => { _expected = n.startsWith('None') ? 'NONE' : n; box.querySelectorAll('.fb-chip').forEach(c => c.classList.toggle('on', c === b)); };
    box.appendChild(b);
  });
  document.getElementById('fb-miss-note').value = '';
  document.getElementById('fb-miss').classList.add('show');
}
function closeMiss() { document.getElementById('fb-miss').classList.remove('show'); }
function _saveMiss() {
  if (_last) {
    Feedback.markMiss({ intent: _last.intent, routedTo: _last.node, via: _last.via, expected: _expected,
                        note: document.getElementById('fb-miss-note').value.trim() });
    _cfg.log('✋ Thanks — saved. It will be in your tester report.');
  }
  document.getElementById('fb-miss-chip').classList.remove('show');
  closeMiss();
}

// ── report flow ───────────────────────────────────────────────────────────────
function _opts() {
  const g = id => document.getElementById(id).checked;
  return {
    tester: document.getElementById('fb-tester').value.trim(),
    note: document.getElementById('fb-rnote').value.trim(),
    mask: g('fb-i-mask'),
    include: { requests: g('fb-i-req'), misses: g('fb-i-miss'), gaps: g('fb-i-gaps'), device: g('fb-i-dev'), console: g('fb-i-con') },
    env: _cfg.getEnv(),
    consoleText: g('fb-i-con') ? _cfg.getConsoleText() : '',
  };
}
function _refreshReport() {
  const c = Feedback.counts();
  document.getElementById('fb-counts').textContent =
    `${c.requests} request${c.requests === 1 ? '' : 's'} logged · ${c.misses} flagged · ${c.gaps} unmatched`;
  const send = document.getElementById('fb-send'); send.innerHTML = '';
  Feedback.listTransports().forEach((t, i) => {
    const b = document.createElement('button'); b.className = 'fb-btn' + (i === 0 ? ' primary' : ''); b.textContent = t.label;
    b.onclick = async () => {
      b.disabled = true;
      const r = await Feedback.send(t.id, Feedback.build(_opts()));
      document.getElementById('fb-rstatus').textContent = r.note || (r.ok ? 'Done.' : 'Not sent.');
      b.disabled = false;
    };
    send.appendChild(b);
  });
}
function _preview(onlyIfOpen) {
  const pre = document.getElementById('fb-pre');
  if (onlyIfOpen === true && pre.style.display === 'none') return;
  pre.style.display = 'block';
  pre.textContent = JSON.stringify(Feedback.build(_opts()), null, 2);
}
function openReport() {
  _build(); _refreshReport();
  document.getElementById('fb-pre').style.display = 'none';
  document.getElementById('fb-rstatus').textContent = '';
  document.getElementById('fb-report').classList.add('show');
}
function closeReport() { document.getElementById('fb-report').classList.remove('show'); }

function init(cfg) { _cfg = { ..._cfg, ...(cfg || {}) }; _build(); }

export const FeedbackUI = { init, noteLastPulse, openReport, closeReport, openMiss };
if (typeof window !== 'undefined') window.BOSS_feedbackUI = FeedbackUI;
