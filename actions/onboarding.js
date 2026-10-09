/**
 * B.O.S.S. Onboarding & Home — actions/onboarding.js
 * ===================================================
 * The "front door": turns the field from a sandbox into something a first-time
 * user can understand in under a minute. Self-contained (renders its own DOM
 * and CSS) and driven by data, so copy and examples can change without touching
 * the kernel.
 *
 *   Onboarding.init({ run(intent), openSettings(), enterField(), nativeItems() })
 *   Onboarding.start()            ← call once at boot: intro on first run, then Home
 *   Onboarding.openHome() / closeHome()
 *   Onboarding.openIntro()        ← replay the 3-card intro
 *   Onboarding.openCapabilities() ← "What can BOSS do?"
 *   Onboarding.isHelpIntent(text) ← typed "help", "what can you do", "show me around"…
 *
 * Surfaces
 *   • Intro   – three skippable cards: what BOSS is · how the field works ·
 *               what stays on your device. Shown once (BOSS_ONBOARDED).
 *   • Home    – greeting, an input, tappable example requests, shortcuts to
 *               "What can BOSS do?", Settings and the field. Shown on launch
 *               unless switched off (BOSS_HOME = 'off', a Settings toggle).
 *   • Capabilities – every area with example phrases (tap to run), which ones
 *               need an AI engine key, and what waits for the native app.
 *
 * Everything the user can tap here runs a normal pulse through the kernel — the
 * examples are real requests, so onboarding doubles as a smoke test.
 */

const KEY_ONBOARDED = 'BOSS_ONBOARDED';
const KEY_HOME      = 'BOSS_HOME';

// ── Content (edit here) ───────────────────────────────────────────────────────
export const EXAMPLES = [
  { icon: '⏱', text: 'Set a 10 minute timer' },
  { icon: '🌤', text: 'What’s the weather?' },
  { icon: '📍', text: 'Where am I?' },
  { icon: '📝', text: 'Remember my locker code is 4821' },
  { icon: '📋', text: 'Summarise my clipboard', ai: true },
  { icon: '🚀', text: 'Open Spotify' },
];

export const CAPABILITIES = [
  { icon: '⏱', name: 'Time & weather', blurb: 'Timers, alarms, world clocks, forecasts.',
    ex: ['Set a timer for 15 minutes', 'Alarm at 7:30', 'What time is it in Tokyo?', 'Will it rain tomorrow?'] },
  { icon: '🧠', name: 'Memory', blurb: 'Notes and a private vault you can lock.',
    ex: ['Remember my locker code is 4821', 'Show my notes', 'What do you remember?', 'Lock the vault'] },
  { icon: '🎵', name: 'Media', blurb: 'Music, video and images.',
    ex: ['Play music', 'Volume down', 'Play the video from my clipboard', 'Stop'] },
  { icon: '📂', name: 'Files', blurb: 'Open files from your device.',
    ex: ['Open a file', 'Show my recent downloads'] },
  { icon: '📞', name: 'Phone', blurb: 'Starts a call, text or email — you press send.',
    ex: ['Call +34 600 123 456', 'Text +34 600 123 456 saying hi', 'Send an email'] },
  { icon: '🚀', name: 'Open apps', blurb: 'Launch apps and run your Shortcuts.',
    ex: ['Open Spotify', 'Open calendar', 'List apps', 'Run shortcut Good morning'] },
  { icon: '👁', name: 'Look & text tools', blurb: 'Read and describe photos; summarise or translate text.', ai: true,
    ex: ['Describe this photo', 'Summarise my clipboard', 'Open text tools', 'Take a photo'] },
  { icon: '💡', name: 'Ask anything', blurb: 'Open questions and writing help.', ai: true,
    ex: ['Why is the sky blue?', 'Write me a short poem', 'Give me an idea for dinner'] },
  { icon: '⚙', name: 'Device & settings', blurb: 'Battery, location, backup, look and voice.',
    ex: ['Battery', 'Back up my data', 'Voice on', 'Change theme', 'Open settings'] },
];

const CARDS = [
  { icon: 'logo', title: 'Say what you want.',
    body: 'BOSS is an assistant you talk to in your own words. Type or speak a request and it finds the right part of itself to do it — timers, notes, music, calls, files, weather and more.' },
  { icon: '🔆', title: 'The field is BOSS thinking.',
    body: 'Each glowing dot is a part of BOSS. When you send a request, the dots light up and the best match acts. If two parts fit equally well, BOSS asks you instead of guessing. Tap a dot to see what it can do.' },
  { icon: '🔒', title: 'Yours, on your device.',
    list: ['Works offline — timers, notes, vault and clock need no internet.',
           'Private by default — notes and keys stay here. Nothing leaves unless you ask for an AI answer or send a feedback report.',
           'Permissions on demand — microphone, location and camera are only requested when you use them.',
           'Portable — Settings → Backup saves everything to a file.'] },
];

const HELP_RX = /^(?:hey\s+|ok\s+|please\s+)?(?:help(?:\s+me)?|what can (?:you|boss|i) do(?:\s+(?:for me|here))?|what do you do|how (?:do i use|does this work|do you work)(?:\s+(?:you|this|boss))?|show me around|take (?:a|the) tour|tutorial|intro(?:duction)?|getting started|what is boss|what can i say|what can i ask)$/i;
const HOME_RX = /^(?:go\s+)?(?:home|home\s*screen|main\s*menu)$/i;

export function isHelpIntent(text) { return HELP_RX.test(String(text || '').trim().replace(/[?!.]+$/, '')); }
export function isHomeIntent(text) { return HOME_RX.test(String(text || '').trim().replace(/[?!.]+$/, '')); }

// ── Storage ───────────────────────────────────────────────────────────────────
function _get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function _set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
export function isOnboarded() { return _get(KEY_ONBOARDED) === '1'; }
export function homeOnLaunch() { return _get(KEY_HOME) !== 'off'; }
export function setHomeOnLaunch(on) { _set(KEY_HOME, on ? 'on' : 'off'); }

// ── Rendering ─────────────────────────────────────────────────────────────────
let _cfg = { run: () => {}, openSettings: () => {}, enterField: () => {}, nativeItems: () => [] };
let _built = false;
let _card = 0;

const CSS = `
.ob-screen{display:none;position:fixed;inset:0;z-index:80;background:radial-gradient(ellipse at 50% 18%,#06201a 0%,#030a06 62%);
  color:var(--glow,#00ffcc);font-family:'Share Tech Mono',monospace;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:max(18px,env(safe-area-inset-top)) 18px max(18px,env(safe-area-inset-bottom))}
.ob-screen.show{display:block}
.ob-wrap{max-width:420px;margin:0 auto;min-height:100%;display:flex;flex-direction:column}
.ob-logo{width:84px;height:84px;border-radius:20px;margin:18px auto 10px;display:block;box-shadow:0 0 28px rgba(0,255,204,.25);object-fit:cover}
.ob-brand{font-family:'Orbitron',monospace;text-align:center;letter-spacing:.3em;font-size:calc(18px * var(--ts,1));margin-bottom:6px}
.ob-tag{text-align:center;color:#88ccaa;font-size:calc(12px * var(--ts,1));line-height:1.55;margin:0 8px 18px}
.ob-in-row{display:flex;gap:8px;margin:0 0 6px}
.ob-in{flex:1;min-width:0;background:rgba(0,20,10,.85);border:1px solid #1a4a38;border-radius:22px;color:#ccffee;padding:12px 16px;
  font:calc(14px * var(--ts,1)) 'Share Tech Mono',monospace;outline:none}
.ob-in:focus{border-color:var(--glow,#00ffcc)}
.ob-go{flex-shrink:0;background:rgba(0,255,204,.14);border:1px solid var(--glow,#00ffcc);border-radius:22px;color:var(--glow,#00ffcc);
  padding:0 16px;font:calc(13px * var(--ts,1)) 'Orbitron',monospace;cursor:pointer}
.ob-sec{font-size:calc(9px * var(--ts,1));letter-spacing:.14em;color:#335544;margin:18px 2px 8px}
.ob-chips{display:flex;flex-wrap:wrap;gap:8px}
.ob-chip{font:calc(12px * var(--ts,1)) 'Share Tech Mono',monospace;color:#ccffee;background:rgba(0,40,25,.55);border:1px solid #1a4a38;
  border-radius:16px;padding:9px 13px;cursor:pointer;text-align:left}
.ob-chip:active{background:rgba(0,255,204,.15)}
.ob-chip small{color:#ffcc88;font-size:calc(8px * var(--ts,1));margin-left:6px}
.ob-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
.ob-tile{font:calc(12px * var(--ts,1)) 'Share Tech Mono',monospace;color:var(--glow,#00ffcc);background:transparent;border:1px solid #1a4a38;
  border-radius:8px;padding:13px 8px;cursor:pointer}
.ob-tile.wide{grid-column:1 / -1;background:rgba(0,255,204,.1);border-color:var(--glow,#00ffcc);font-family:'Orbitron',monospace;letter-spacing:.08em}
.ob-foot{margin-top:auto;padding-top:20px;text-align:center;color:#335544;font-size:calc(10px * var(--ts,1));line-height:1.6}
.ob-foot label{display:inline-flex;gap:6px;align-items:center;cursor:pointer;color:#446655}
/* intro cards */
.ob-card{margin:auto 0;text-align:center;padding:10px 4px}
.ob-card-icon{font-size:54px;margin-bottom:14px}
.ob-card h2{font-family:'Orbitron',monospace;font-size:calc(17px * var(--ts,1));letter-spacing:.06em;margin-bottom:14px;line-height:1.35}
.ob-card p{color:#aaddc8;font-size:calc(13px * var(--ts,1));line-height:1.7}
.ob-card ul{list-style:none;text-align:left;color:#aaddc8;font-size:calc(12px * var(--ts,1));line-height:1.6}
.ob-card li{padding:7px 0 7px 22px;position:relative}
.ob-card li::before{content:'✓';position:absolute;left:0;color:var(--glow,#00ffcc)}
.ob-dots{display:flex;justify-content:center;gap:8px;margin:12px 0}
.ob-dots i{width:7px;height:7px;border-radius:50%;background:#1a4a38}
.ob-dots i.on{background:var(--glow,#00ffcc)}
.ob-nav{display:flex;gap:10px;align-items:center;justify-content:space-between;padding-top:6px}
.ob-link{background:none;border:none;color:#446655;font:calc(12px * var(--ts,1)) 'Share Tech Mono',monospace;padding:12px 6px;cursor:pointer}
.ob-next{background:rgba(0,255,204,.14);border:1px solid var(--glow,#00ffcc);border-radius:22px;color:var(--glow,#00ffcc);
  padding:12px 26px;font:calc(12px * var(--ts,1)) 'Orbitron',monospace;letter-spacing:.1em;cursor:pointer}
/* capabilities */
.ob-cap{border:1px solid #12382a;border-radius:8px;padding:11px 12px;margin-bottom:10px;background:rgba(0,25,15,.5)}
.ob-cap h3{font-size:calc(12px * var(--ts,1));font-weight:normal;margin-bottom:3px}
.ob-cap h3 small{color:#ffcc88;font-size:calc(9px * var(--ts,1));margin-left:6px}
.ob-cap p{color:#6fae92;font-size:calc(11px * var(--ts,1));margin-bottom:8px}
.ob-native{border:1px dashed #243a30;border-radius:8px;padding:11px 12px;color:#668877;font-size:calc(11px * var(--ts,1));line-height:1.6}
.ob-back{display:inline-block;background:none;border:none;color:#668877;font:calc(12px * var(--ts,1)) 'Share Tech Mono',monospace;padding:6px 0 10px;cursor:pointer}
`;

function _el(html) { const t = document.createElement('div'); t.innerHTML = html.trim(); return t.firstChild; }
const _esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function _build() {
  if (_built) return; _built = true;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  // HOME
  const home = _el(`<div class="ob-screen" id="ob-home"><div class="ob-wrap">
    <img class="ob-logo" src="./bosslogo-192.png" alt="" onerror="this.style.display='none'">
    <div class="ob-brand">B·O·S·S</div>
    <div class="ob-tag">Say what you want. BOSS finds the right part of itself to do it.</div>
    <form class="ob-in-row" id="ob-form"><input class="ob-in" id="ob-in" placeholder="What do you want to do?" autocomplete="off" enterkeyhint="go">
      <button class="ob-go" type="submit">GO</button></form>
    <div class="ob-sec">TRY ONE</div>
    <div class="ob-chips" id="ob-examples"></div>
    <div class="ob-sec">EXPLORE</div>
    <div class="ob-tiles">
      <button class="ob-tile" id="ob-t-caps">❓ What can BOSS do?</button>
      <button class="ob-tile" id="ob-t-set">⚙ Settings</button>
      <button class="ob-tile" id="ob-t-intro">👋 Quick intro</button>
      <button class="ob-tile" id="ob-t-fb">💬 Send feedback</button>
      <button class="ob-tile wide" id="ob-t-field">ENTER THE FIELD →</button>
    </div>
    <div class="ob-foot">Works offline · your data stays on this device<br>
      <label><input type="checkbox" id="ob-show"> Show this screen when BOSS opens</label></div>
  </div></div>`);
  document.body.appendChild(home);

  const ex = home.querySelector('#ob-examples');
  EXAMPLES.forEach(e => {
    const b = document.createElement('button'); b.className = 'ob-chip'; b.type = 'button';
    b.innerHTML = `${e.icon} ${_esc(e.text)}${e.ai ? '<small>needs AI key</small>' : ''}`;
    b.onclick = () => _run(e.text);
    ex.appendChild(b);
  });
  home.querySelector('#ob-form').onsubmit = ev => {
    ev.preventDefault();
    const v = home.querySelector('#ob-in').value.trim();
    if (v) { home.querySelector('#ob-in').value = ''; _run(v); }
  };
  home.querySelector('#ob-t-caps').onclick = openCapabilities;
  home.querySelector('#ob-t-set').onclick = () => { closeHome(); _cfg.openSettings(); };
  home.querySelector('#ob-t-intro').onclick = openIntro;
  home.querySelector('#ob-t-fb').onclick = () => { if (window.BOSS_feedbackUI) window.BOSS_feedbackUI.openReport(); };
  home.querySelector('#ob-t-field').onclick = () => { closeHome(); _cfg.enterField(); };
  const show = home.querySelector('#ob-show');
  show.checked = homeOnLaunch();
  show.onchange = () => setHomeOnLaunch(show.checked);

  // INTRO
  const intro = _el(`<div class="ob-screen" id="ob-intro" style="z-index:85"><div class="ob-wrap">
    <div class="ob-card" id="ob-card"></div>
    <div class="ob-dots" id="ob-dots"></div>
    <div class="ob-nav"><button class="ob-link" id="ob-skip">Skip</button><span style="flex:1"></span>
      <button class="ob-link" id="ob-back">Back</button><button class="ob-next" id="ob-next">NEXT</button></div>
  </div></div>`);
  document.body.appendChild(intro);
  intro.querySelector('#ob-skip').onclick = _finishIntro;
  intro.querySelector('#ob-back').onclick = () => { if (_card > 0) { _card--; _renderCard(); } };
  intro.querySelector('#ob-next').onclick = () => { if (_card < CARDS.length - 1) { _card++; _renderCard(); } else _finishIntro(); };

  // CAPABILITIES
  const caps = _el(`<div class="ob-screen" id="ob-caps" style="z-index:82"><div class="ob-wrap">
    <button class="ob-back" id="ob-caps-back">← back</button>
    <div class="ob-brand" style="letter-spacing:.14em;font-size:calc(15px * var(--ts,1))">WHAT CAN BOSS DO?</div>
    <div class="ob-tag" style="margin-bottom:12px">Tap any example to try it. Say it your own way — these are just starting points.</div>
    <div id="ob-caps-list"></div>
    <div class="ob-sec">COMING WITH THE BOSS APP</div>
    <div class="ob-native" id="ob-caps-native"></div>
  </div></div>`);
  document.body.appendChild(caps);
  caps.querySelector('#ob-caps-back').onclick = () => caps.classList.remove('show');
}

function _run(text) {
  closeHome(); closeIntro(); document.getElementById('ob-caps').classList.remove('show');
  _cfg.enterField();
  setTimeout(() => _cfg.run(text), 60);
}

function _renderCard() {
  const c = CARDS[_card];
  const icon = c.icon === 'logo' ? `<img class="ob-logo" style="margin:0 auto 14px" src="./bosslogo-192.png" alt="" onerror="this.style.display='none'">`
                                 : `<div class="ob-card-icon">${c.icon}</div>`;
  const body = c.list ? `<ul>${c.list.map(l => `<li>${_esc(l)}</li>`).join('')}</ul>` : `<p>${_esc(c.body)}</p>`;
  document.getElementById('ob-card').innerHTML = `${icon}<h2>${_esc(c.title)}</h2>${body}`;
  document.getElementById('ob-dots').innerHTML = CARDS.map((_, i) => `<i class="${i === _card ? 'on' : ''}"></i>`).join('');
  document.getElementById('ob-next').textContent = _card === CARDS.length - 1 ? 'START' : 'NEXT';
  document.getElementById('ob-back').style.visibility = _card === 0 ? 'hidden' : 'visible';
}

function _finishIntro() {
  _set(KEY_ONBOARDED, '1');
  closeIntro();
  if (!document.getElementById('ob-home').classList.contains('show')) openHome();
}

// ── Public ────────────────────────────────────────────────────────────────────
export function openHome() { _build(); document.getElementById('ob-show').checked = homeOnLaunch(); document.getElementById('ob-home').classList.add('show'); }
export function closeHome() { if (_built) document.getElementById('ob-home').classList.remove('show'); }
export function openIntro() { _build(); _card = 0; _renderCard(); document.getElementById('ob-intro').classList.add('show'); }
export function closeIntro() { if (_built) document.getElementById('ob-intro').classList.remove('show'); }

export function openCapabilities() {
  _build();
  const list = document.getElementById('ob-caps-list');
  list.innerHTML = '';
  CAPABILITIES.forEach(c => {
    const box = document.createElement('div'); box.className = 'ob-cap';
    box.innerHTML = `<h3>${c.icon} ${_esc(c.name)}${c.ai ? '<small>needs AI key</small>' : ''}</h3><p>${_esc(c.blurb)}</p><div class="ob-chips"></div>`;
    const chips = box.querySelector('.ob-chips');
    c.ex.forEach(t => { const b = document.createElement('button'); b.className = 'ob-chip'; b.type = 'button'; b.textContent = t; b.onclick = () => _run(t); chips.appendChild(b); });
    list.appendChild(box);
  });
  let nat = [];
  try { nat = _cfg.nativeItems() || []; } catch (_) {}
  document.getElementById('ob-caps-native').innerHTML = nat.length
    ? nat.map(n => `${_esc(n.icon || '📱')} <b>${_esc(n.label)}</b> — ${_esc(n.reason || '')}`).join('<br>')
    : 'Some things (contacts, flashlight, reliable alarms…) need the native app.';
  document.getElementById('ob-caps').classList.add('show');
}

/** Boot: first run → intro (then Home); later runs → Home unless switched off. */
export function start() {
  _build();
  if (!isOnboarded()) { openHome(); openIntro(); return; }
  if (homeOnLaunch()) openHome();
}

export function init(cfg) { _cfg = { ..._cfg, ...(cfg || {}) }; _build(); }

export const Onboarding = {
  init, start, openHome, closeHome, openIntro, closeIntro, openCapabilities,
  isHelpIntent, isHomeIntent, isOnboarded, homeOnLaunch, setHomeOnLaunch,
  EXAMPLES, CAPABILITIES,
};
if (typeof window !== 'undefined') window.BOSS_onboarding = Onboarding;
