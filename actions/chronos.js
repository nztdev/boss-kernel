/**
 * B.O.S.S. CHRONOS Action Module — actions/chronos.js
 * =====================================================
 * github.com/nztdev/boss-kernel
 *
 * Real temporal actions for the CHRONOS node.
 * Handles timer setting, alarms, elapsed time queries,
 * and timer cancellation — all browser-native, no OS dependency.
 *
 * Interface:
 *   ChronosAction.handle(intent, clog, Nervous, EVENT)
 *     — called by ACTION_MAP when CHRONOS fires
 *     — parses intent, schedules action, logs result
 *
 * Capabilities (matches Registry definition):
 *   timer_set      — "set a timer for X minutes"
 *   alarm_set      — "remind me at 3pm" / "alarm at HH:MM"
 *   countdown      — "how long until X"
 *   schedule_query — "what timers are running"
 *   elapsed        — "how long has it been"
 *   cancel         — "cancel timer" / "stop timer"
 */

import { Weather } from './weather.js';

// ── Timer state ───────────────────────────────────────────────────────────────
const _timers = [];       // [{ id, label, fireAt, timeoutId }]
let   _notificationPermission = null;
let   _elapsedStart = null;

// ── Stopwatch state ───────────────────────────────────────────────────────────
let _stopwatchStart = null;
let _stopwatchPaused = 0;   // accumulated ms when paused
let _stopwatchRunning = false;
let _laps = [];

// ── Timezone state ────────────────────────────────────────────────────────────
const CHRONOS_CONFIG_KEY = 'BOSS_CHRONOS_CONFIG';
let _userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let _worldClocks  = [];  // [{ label, timezone }]

function _loadChronosConfig() {
  try {
    const raw = localStorage.getItem(CHRONOS_CONFIG_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    if (cfg.timezone)   _userTimezone = cfg.timezone;
    if (cfg.worldClocks) _worldClocks = cfg.worldClocks;
  } catch(_) {}
}

function _saveChronosConfig() {
  try {
    localStorage.setItem(CHRONOS_CONFIG_KEY, JSON.stringify({
      timezone:   _userTimezone,
      worldClocks: _worldClocks,
    }));
  } catch(_) {}
}

_loadChronosConfig();

// ── Time formatting ───────────────────────────────────────────────────────────
function _formatClockTime(date, timezone) {
  return new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   false,
  }).format(date);
}

function _formatClockDate(date, timezone) {
  return new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    weekday:  'long',
    day:      'numeric',
    month:    'long',
    year:     'numeric',
  }).format(date);
}

function _formatStopwatch(ms) {
  const h   = Math.floor(ms / 3600000);
  const m   = Math.floor((ms % 3600000) / 60000);
  const s   = Math.floor((ms % 60000) / 1000);
  const cs  = Math.floor((ms % 1000) / 10);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

// ── Notification helper ───────────────────────────────────────────────────────
async function _requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const result = await Notification.requestPermission();
  _notificationPermission = result;
  return result === 'granted';
}

function _notify(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag:  'boss-chronos',
    });
  }
}

// ── Number words ("two minutes", "twenty five seconds", "at nine") ───────────
const _NW = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12,
  thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19,
  twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };
const _NW_RE = '(?:' + Object.keys(_NW).join('|') + ')';
/** "nine" → "9", "nine thirty" → "9:30", "six forty five" → "6:45", "nine oh five" → "9:05", "twenty three" → "23". */
function clockWords(w) {
  const t = w.toLowerCase().split(/[\s-]+/).filter(x => x && x !== "o'clock");
  const n = x => _NW[x];
  let h = n(t.shift());
  if (h >= 20 && t.length && n(t[0]) >= 1 && n(t[0]) <= 3 && h === 20) h += n(t.shift());   // "twenty three" → 23
  if (!t.length) return String(h);
  let m = 0;
  if (t[0] === 'oh') { t.shift(); m = t.length ? n(t.shift()) || 0 : 0; }
  else { m = n(t.shift()) || 0; if (t.length && m >= 20 && n(t[0]) < 10) m += n(t.shift()); }
  return h + ':' + String(m).padStart(2, '0');
}
/** Replace number words with digits, but only where a time unit (or "at") makes the meaning
 *  unambiguous, so ordinary words like "one" elsewhere in a sentence are left alone. */
function _numberWords(s) {
  const val = w => {
    const parts = w.split(/[\s-]+/).filter(Boolean);
    return parts.reduce((a, p) => a + (_NW[p] ?? 0), 0);
  };
  const seq = `${_NW_RE}(?:[\\s-]+${_NW_RE})?`;
  return s
    .replace(new RegExp(`\\b(${seq})(\\s*(?:sec(?:ond)?s?|min(?:ute)?s?|hours?|hrs?)\\b)`, 'g'), (_, w, u) => val(w) + u)
    .replace(new RegExp(`\\bat ((?:${_NW_RE}|oh|o'clock)(?:[\\s-]+(?:${_NW_RE}|oh|o'clock))*)\\b(?!\\s*(?:sec|min|hour|hr))`, 'g'), (_, w) => 'at ' + clockWords(w))
    .replace(/\b(\d+) and a half (hours?|minutes?)\b/g, (_, n, u) => (+n + 0.5) + ' ' + u);
}

/** Tidies spoken/typed alarm times into the "at H:MM" form the parser understands:
 *  "alarm at 9.30" → "at 9:30" (a dot between hour and TWO-digit minutes is a clock time, not a decimal like "1.25 hours"),
 *  "alarm 8:05" / "alarm 7pm" → "alarm at …", "alarm for 6:45 am" → "alarm at 6:45 am". */
function _alarmNorm(t) {
  t = t.replace(/\b(at|for|@)\s*(\d{1,2})\.(\d{2})(?![\d.])(?!\s*(?:sec|min|hour|hr))/g, '$1 $2:$3')
       .replace(/\balarm\s+(\d{1,2})\.(\d{2})(?![\d.])(?!\s*(?:sec|min|hour|hr))/g, 'alarm at $1:$2')
       .replace(/\balarm\s+(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm)\b)/g, 'alarm at $1');
  if (/\balarm\b/.test(t)) t = t.replace(/\bfor\s+(\d{1,2}(?::\d{2}\s*(?:am|pm)?|\s*(?:am|pm))\b)/, 'at $1');
  return t;
}

// ── Intent parser ─────────────────────────────────────────────────────────────
/**
 * Parses a natural language intent for time expressions.
 * Returns { type, ms, label } or null if no expression found.
 *
 * Supported patterns:
 *   Duration:  "5 minutes", "30 seconds", "2 hours", "an hour", "half an hour"
 *   Clock:     "at 3pm", "at 14:30", "at 9:00am", "at 3:30 pm"
 *   Cancel:    "cancel timer", "stop timer", "clear timer"
 *   Elapsed:   "how long", "elapsed", "how long has it been"
 *   Query:     "what timers", "timer status", "active timers"
 */
/** The first duration in a string: "5 minutes", "2 hours 30 minutes", "half an hour", "an hour" → { ms, label } | null. */
function _durationOf(s) {
  const h  = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/);
  const m  = s.match(/(\d+(?:\.\d+)?)\s*min(?:ute)?s?\b/);
  const sc = s.match(/(\d+(?:\.\d+)?)\s*sec(?:ond)?s?\b/);
  if (h || m || sc) {
    const hh = h ? parseFloat(h[1]) : 0, mm = m ? parseFloat(m[1]) : 0, ss = sc ? parseFloat(sc[1]) : 0;
    const ms = Math.round((hh * 3600 + mm * 60 + ss) * 1000);
    const bits = [];
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    if (hh) bits.push(pl(hh, 'hour'));
    if (mm) bits.push(pl(mm, 'minute'));
    if (ss) bits.push(pl(ss, 'second'));
    if (ms > 0) return { ms, label: bits.join(' ') };
  }
  // fractions first — "half an hour" must not be read as "an hour"
  if (/half\s+an?\s+hour/.test(s))   return { ms: 1800000, label: '30 minutes' };
  if (/quarter\s+(?:of\s+an?\s+)?hour/.test(s)) return { ms: 900000, label: '15 minutes' };
  if (/\ban?\s+hour\b/.test(s))      return { ms: 3600000, label: '1 hour' };
  if (/\ban?\s+minute\b/.test(s))    return { ms: 60000,   label: '1 minute' };
  return null;
}

/** Words that mean "swap the running timer for this one" rather than "add another". */
const _REPLACE_RX = /\b(?:instead|replace|replacing|rather)\b|\b(?:change|switch|update|reset|swap)\b.*\btimer\b/;
function _parseIntent(intent) {
  const p = _parseIntentCore(intent);
  if (p && p.type === 'timer' && _REPLACE_RX.test(intent.toLowerCase())) p.replace = true;
  return p;
}

function _parseIntentCore(intent) {
  const s = _numberWords(_alarmNorm(intent.toLowerCase().trim()));

  // Stopwatch
  if (/\bstopwatch\b/.test(s)) {
    if (/\b(start|begin|go)\b/.test(s) || s === 'stopwatch') return { type: 'stopwatch_start' };
    if (/\b(stop|pause|hold)\b/.test(s))  return { type: 'stopwatch_stop' };
    if (/\b(reset|clear|zero)\b/.test(s)) return { type: 'stopwatch_reset' };
    if (/\blap\b/.test(s))                return { type: 'stopwatch_lap' };
    return { type: 'stopwatch_check' };
  }

  // World clock
  const worldMatch = s.match(/(?:what(?:'s| is| time is it| is the time)\s+(?:in|at)|time (?:in|at)|clock (?:in|at))\s+(.+)/i)
    || s.match(/(?:what time is it in|time in|time at|clock in)\s+(.+)/i);
  if (worldMatch) return { type: 'world_clock', place: (worldMatch[1] || worldMatch[2] || '').trim() };

  // Add world clock
  if (/\b(add|save|track)\b.*\b(clock|time)\b/.test(s)) {
    const m = s.match(/(?:in|at|for)\s+(.+)/);
    return { type: 'add_world_clock', place: m ? m[1].trim() : '' };
  }

  // Current time/date
  if (/\b(what(?:'s| is|\'s)?\s+(?:the\s+)?(?:time|date|day)|current time|today)\b/.test(s) ||
      /\bwhat time\b/.test(s) || /\bwhat('s| is) the time\b/.test(s) ||
      s === 'time' || s === 'date' || s === 'what time is it' || s === 'what time is it?') {
    return { type: 'current_time' };
  }

  // Cancel — "cancel timer", "cancel all timers", "cancel the latest timer", "cancel the 5 minute timer", "cancel my alarm"
  if (/\b(cancel|stop|clear|dismiss|delete|remove|kill)\b.*\b(timers?|alarms?)\b/.test(s) ||
      /\b(timers?|alarms?)\b.*\b(cancel|stop|clear)\b/.test(s)) {
    const kind = /\balarms?\b/.test(s) && !/\btimers?\b/.test(s) ? 'alarm' : 'timer';
    let scope = null;
    if (/\b(?:all|every|both|everything)\b/.test(s)) scope = 'all';
    else if (/\b(?:last|latest|newest|most recent|recent)\b/.test(s)) scope = 'latest';
    else if (/\b(?:first|oldest)\b/.test(s)) scope = 'oldest';
    const d = scope ? null : _durationOf(s);
    if (d) return { type: 'cancel', kind, scope: 'match', ms: d.ms, label: d.label };
    return { type: 'cancel', kind, scope };
  }

  // Query
  if (/\b(what|list|show|active|running|pending)\b.*\btimer/.test(s) ||
      /timer.*\b(status|list|active|running)\b/.test(s)) {
    return { type: 'query' };
  }

  // Elapsed
  if (/how long\b/.test(s) || /\belapsed\b/.test(s) ||
      /how long has it been/.test(s) || /\bsince\b.*\blast\b/.test(s)) {
    return { type: 'elapsed' };
  }

  // Duration — "2 hours 30 minutes", "1.5 hours", "90 seconds", "half an hour", "an hour"
  { const d = _durationOf(s); if (d) return { type: 'timer', ms: d.ms, label: d.label }; }

  // Clock time — "at 3pm", "at 14:30", "at 9:00am", "at 3:30 pm"
  const clockMatch = s.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (clockMatch) {
    let hours   = parseInt(clockMatch[1]);
    const mins  = parseInt(clockMatch[2] || '0');
    const ampm  = clockMatch[3];
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    const now    = new Date();
    const target = new Date(now);
    target.setHours(hours, mins, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1); // next occurrence

    const ms    = target.getTime() - now.getTime();
    const label = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`;
    return { type: 'alarm', ms, label, fireAt: target };
  }

  return null;
}

// ── Action handlers ───────────────────────────────────────────────────────────

const CITY_TZ = {
  'london': 'Europe/London', 'paris': 'Europe/Paris', 'berlin': 'Europe/Berlin',
  'madrid': 'Europe/Madrid', 'rome': 'Europe/Rome', 'amsterdam': 'Europe/Amsterdam',
  'moscow': 'Europe/Moscow', 'dubai': 'Asia/Dubai', 'mumbai': 'Asia/Kolkata',
  'india': 'Asia/Kolkata', 'delhi': 'Asia/Kolkata', 'bangkok': 'Asia/Bangkok',
  'singapore': 'Asia/Singapore', 'hong kong': 'Asia/Hong_Kong',
  'beijing': 'Asia/Shanghai', 'shanghai': 'Asia/Shanghai', 'china': 'Asia/Shanghai',
  'tokyo': 'Asia/Tokyo', 'japan': 'Asia/Tokyo', 'seoul': 'Asia/Seoul',
  'sydney': 'Australia/Sydney', 'melbourne': 'Australia/Melbourne',
  'auckland': 'Pacific/Auckland', 'new zealand': 'Pacific/Auckland',
  'los angeles': 'America/Los_Angeles', 'la': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles', 'new york': 'America/New_York',
  'nyc': 'America/New_York', 'toronto': 'America/Toronto', 'chicago': 'America/Chicago',
  'sao paulo': 'America/Sao_Paulo', 'mexico city': 'America/Mexico_City',
  'johannesburg': 'Africa/Johannesburg', 'cairo': 'Africa/Cairo',
  'lagos': 'Africa/Lagos', 'nairobi': 'Africa/Nairobi',
  'lisbon': 'Europe/Lisbon', 'oslo': 'Europe/Oslo', 'stockholm': 'Europe/Stockholm',
  'istanbul': 'Europe/Istanbul', 'athens': 'Europe/Athens',
};

function _handleCurrentTime(clog) {
  const now  = new Date();
  clog(`⏱ ${_formatClockTime(now, _userTimezone)}`, 'log-action');
  clog(`   ${_formatClockDate(now, _userTimezone)}`, 'log-action');
  clog(`   timezone: ${_userTimezone}`, 'log-action');
  if (_worldClocks.length) {
    _worldClocks.forEach(wc => {
      clog(`   ${wc.label}: ${_formatClockTime(now, wc.timezone)}`, 'log-action');
    });
  }
}

function _handleWorldClock(place, clog) {
  const tz = CITY_TZ[place.toLowerCase().trim()];
  if (!tz) {
    clog(`⏱ CHRONOS: unknown location "${place}"`, 'log-action');
    clog('   Try: "what time is it in Tokyo" · "time in London"', 'log-action');
    return;
  }
  const now = new Date();
  clog(`⏱ ${place.charAt(0).toUpperCase() + place.slice(1)}: ${_formatClockTime(now, tz)}`, 'log-action');
  clog(`   ${_formatClockDate(now, tz)}`, 'log-action');
}

function _handleAddWorldClock(place, clog) {
  const tz = CITY_TZ[place.toLowerCase().trim()];
  if (!tz) { clog(`⏱ Unknown location "${place}"`, 'log-action'); return; }
  const label = place.charAt(0).toUpperCase() + place.slice(1);
  if (!_worldClocks.find(w => w.timezone === tz)) {
    _worldClocks.push({ label, timezone: tz });
    _saveChronosConfig();
    clog(`⏱ World clock added: ${label}`, 'log-action');
  } else {
    clog(`⏱ ${label} already in world clocks`, 'log-action');
  }
}

function _handleStopwatchStart(clog) {
  if (_stopwatchRunning) { clog('⏱ Stopwatch already running', 'log-action'); return; }
  _stopwatchStart   = Date.now() - _stopwatchPaused;
  _stopwatchRunning = true;
  _laps = [];
  clog('⏱ Stopwatch started', 'log-action');
}

function _handleStopwatchStop(clog) {
  if (!_stopwatchRunning) { clog('⏱ Stopwatch not running', 'log-action'); return; }
  _stopwatchPaused  = Date.now() - _stopwatchStart;
  _stopwatchRunning = false;
  clog(`⏱ Stopped: ${_formatStopwatch(_stopwatchPaused)}`, 'log-action');
}

function _handleStopwatchReset(clog) {
  _stopwatchStart = null; _stopwatchPaused = 0;
  _stopwatchRunning = false; _laps = [];
  clog('⏱ Stopwatch reset', 'log-action');
}

function _handleStopwatchLap(clog) {
  if (!_stopwatchRunning) { clog('⏱ Stopwatch not running', 'log-action'); return; }
  const elapsed = Date.now() - _stopwatchStart;
  _laps.push(elapsed);
  clog(`⏱ Lap ${_laps.length}: ${_formatStopwatch(elapsed)}`, 'log-action');
}

function _handleStopwatchCheck(clog) {
  if (!_stopwatchStart && !_stopwatchPaused) {
    clog('⏱ Stopwatch not started — say "start stopwatch"', 'log-action'); return;
  }
  const elapsed = _stopwatchRunning ? Date.now() - _stopwatchStart : _stopwatchPaused;
  clog(`⏱ Stopwatch: ${_formatStopwatch(elapsed)} ${_stopwatchRunning ? '▶' : '⏸'}`, 'log-action');
  _laps.forEach((l, i) => clog(`   lap ${i+1}: ${_formatStopwatch(l)}`, 'log-action'));
}

function _dropAlarmCfg(id) {
  try {
    const cfg = JSON.parse(localStorage.getItem(CHRONOS_CONFIG_KEY) || '{}');
    cfg.alarms = (cfg.alarms || []).filter(a => a.id !== id);
    localStorage.setItem(CHRONOS_CONFIG_KEY, JSON.stringify(cfg));
  } catch (_) {}
}
function _removeTimer(t) {
  clearTimeout(t.timeoutId);
  const i = _timers.indexOf(t); if (i >= 0) _timers.splice(i, 1);
  if (t.kind === 'alarm') _dropAlarmCfg(t.id);
}
const _isTimer = t => (t.kind || 'timer') === 'timer';

function _handleTimer(parsed, intent, clog, Nervous, EVENT) {
  // "change the timer to 10 minutes" / "…instead": swap the most recent timer for this one
  let replaced = null;
  if (parsed.replace) {
    const prev = _timers.filter(_isTimer).pop();
    if (prev) { replaced = prev.label; _removeTimer(prev); }
  }
  const others = _timers.filter(_isTimer).map(t => t.label);
  const fireAt = new Date(Date.now() + parsed.ms);
  const timeStr = fireAt.toLocaleTimeString('en', { hour12: false });
  const id = Date.now();

  const timeoutId = setTimeout(async () => {
    // Remove from active timers
    const idx = _timers.findIndex(t => t.id === id);
    if (idx >= 0) _timers.splice(idx, 1);

    clog(`⏱ CHRONOS: "${parsed.label}" timer complete`, 'log-action');
    _notify(`⏱ B.O.S.S. Timer`, `${parsed.label} — ${intent}`);

    if (Nervous && EVENT) {
      Nervous.emit('CHRONOS_FIRED', {
        source:  'CHRONOS',
        payload: { type: 'timer', label: parsed.label, intent },
      });
    }
  }, parsed.ms);

  _timers.push({ id, kind: 'timer', ms: parsed.ms, label: parsed.label, fireAt, timeoutId, intent });
  clog(`⏱ Timer set: ${parsed.label} → fires at ${timeStr}`, 'log-action');
  if (replaced) clog(`   ↺ replaced the ${replaced} timer`, 'log-action');
  else if (others.length) clog(`   (also running: ${others.join(', ')} — say "cancel the ${others[others.length - 1].replace(/\b(minute|hour|second)s\b/g, '$1')} timer" or "change the timer to …")`, 'log-action');
}

function _handleAlarm(parsed, intent, clog, Nervous, EVENT) {
  const timeStr = parsed.fireAt.toLocaleTimeString('en', { hour12: false });
  const id = Date.now();

  const timeoutId = setTimeout(() => {
    const idx = _timers.findIndex(t => t.id === id);
    if (idx >= 0) _timers.splice(idx, 1);

    clog(`⏰ CHRONOS: Alarm fired — ${parsed.label}`, 'log-action');
    _notify(`⏰ B.O.S.S. Alarm`, `${parsed.label} — ${intent}`);

    if (Nervous && EVENT) {
      Nervous.emit('CHRONOS_FIRED', {
        source:  'CHRONOS',
        payload: { type: 'alarm', label: parsed.label, intent },
      });
    }
  }, parsed.ms);

  _timers.push({ id, kind: 'alarm', ms: parsed.ms, label: parsed.label, fireAt: parsed.fireAt, timeoutId, intent });
  clog(`⏰ Alarm set: ${parsed.label} (fires at ${timeStr})`, 'log-action');

  // Persist alarm to config so modal can list it
  try {
    const cfg    = JSON.parse(localStorage.getItem(CHRONOS_CONFIG_KEY) || '{}');
    cfg.alarms   = cfg.alarms || [];
    cfg.alarms.push({ time: parsed.label, label: intent, id, _timeoutId: timeoutId });
    localStorage.setItem(CHRONOS_CONFIG_KEY, JSON.stringify(cfg));
  } catch(_) {}
}

function _handleCancel(clog, p) {
  const kind = p ? p.kind : null;                       // null = everything (clearAll)
  const pool = _timers.filter(t => !kind || (t.kind || 'timer') === kind);
  const noun = kind === 'alarm' ? 'alarm' : 'timer';
  if (!pool.length) { clog(`⏱ No ${noun}s running`, 'log-action'); return; }
  let victims = pool, scope = p && p.scope;
  if (scope === 'latest') victims = [pool[pool.length - 1]];
  else if (scope === 'oldest') victims = [pool[0]];
  else if (scope === 'match') {
    const hit = pool.filter(t => t.ms === p.ms || t.label === p.label);
    if (!hit.length) { clog(`⏱ I don't have a ${p.label} ${noun} running — I have: ${pool.map(t => t.label).join(', ')}`, 'log-action'); return; }
    victims = [hit[hit.length - 1]];
  }
  victims.forEach(_removeTimer);
  clog(victims.length === 1 ? `⏱ Cancelled the ${victims[0].label} ${noun}` : `⏱ Cancelled ${victims.length} ${noun}s`, 'log-action');
}

function _handleQuery(clog) {
  if (!_timers.length) {
    clog('⏱ No active timers', 'log-action');
    return;
  }
  const now = Date.now();
  _timers.forEach(t => {
    const remaining = Math.max(0, t.fireAt.getTime() - now);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    clog(`⏱ [${t.label}] fires at ${t.fireAt.toLocaleTimeString('en',{hour12:false})} — ${mins}m ${secs}s remaining`, 'log-action');
  });
}

function _handleElapsed(clog) {
  if (!_elapsedStart) {
    clog('⏱ Elapsed: no reference point — fire a CHRONOS intent first', 'log-action');
    return;
  }
  const ms      = Date.now() - _elapsedStart;
  const hours   = Math.floor(ms / 3600000);
  const mins    = Math.floor((ms % 3600000) / 60000);
  const secs    = Math.floor((ms % 60000) / 1000);
  const parts   = [];
  if (hours) parts.push(`${hours}h`);
  if (mins)  parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  clog(`⏱ Elapsed since last CHRONOS: ${parts.join(' ')}`, 'log-action');
}

// ── Screen flash (preserved from original) ────────────────────────────────────
function _flash() {
  const f = document.createElement('div');
  f.className = 'action-flash';
  f.style.background = 'rgba(255,170,0,0.07)';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

// ── Boot time display ─────────────────────────────────────────────────────────
export function chronosBoot(clog) {
  const now  = new Date();
  const time = _formatClockTime(now, _userTimezone);
  const date = _formatClockDate(now, _userTimezone);
  clog(`⏱ CHRONOS: ${time} · ${date}`, 'log-sys');
  if (_worldClocks.length) {
    _worldClocks.forEach(wc => {
      const t = _formatClockTime(now, wc.timezone);
      clog(`   ${wc.label}: ${t}`, 'log-sys');
    });
  }
}

// Returns live clock state for orbital rendering
export function getClockState() {
  const now = new Date();
  return {
    time:      _formatClockTime(now, _userTimezone),
    timezone:  _userTimezone,
    worldClocks: _worldClocks.map(wc => ({
      label: wc.label,
      time:  _formatClockTime(now, wc.timezone),
    })),
    stopwatch: _stopwatchRunning
      ? _formatStopwatch(Date.now() - _stopwatchStart)
      : _stopwatchPaused ? _formatStopwatch(_stopwatchPaused) : null,
    stopwatchRunning: _stopwatchRunning,
    timers: _timers.map(t => ({
      id:     t.id,
      label:  t.label,
      fireAt: t.fireAt,
    })),
  };
}

// ── Public interface ──────────────────────────────────────────────────────────
export const ChronosAction = {
  /**
   * Main entry point — called by ACTION_MAP when CHRONOS node fires.
   * @param {string} intent  — the full user intent string
   * @param {function} clog  — Soma console log function
   * @param {object} Nervous — Nervous System instance
   * @param {object} EVENT   — Nervous System event catalogue
   */
  async handle(intent, clog, Nervous, EVENT) {
    _elapsedStart = Date.now();
    _flash();

    // Weather is a read-only CHRONOS query — handle before the notification
    // permission prompt, which is only relevant to timers/alarms.
    if (Weather.isWeatherIntent(intent)) return await Weather.handle(intent, clog);

    // Request notification permission on first real timer use
    if (!_notificationPermission) {
      _notificationPermission = await _requestNotificationPermission();
      if (!_notificationPermission) {
        clog('⏱ Notifications blocked — timers will log to console only', 'log-action');
      }
    }

    const parsed = _parseIntent(intent);

    if (!parsed) {
      // v0.14.9: only ask "choose a duration" when the request is actually about a timer / alarm / clock
      if (!/\b(?:timers?|alarms?|countdown|stopwatch|remind(?:er)?s?|clock|time)\b/i.test(intent) && window.BOSS_noMatch && window.BOSS_noMatch(intent)) return false;
      clog(`⏱ CHRONOS: no time expression in "${intent}" — choose a duration:`, 'log-action');
      return false;  // incomplete — show orbitals
    }

    switch (parsed.type) {
      case 'timer':            _handleTimer(parsed, intent, clog, Nervous, EVENT); break;
      case 'alarm':            _handleAlarm(parsed, intent, clog, Nervous, EVENT); break;
      case 'cancel':           _handleCancel(clog, parsed);                        break;
      case 'query':            _handleQuery(clog);                                 break;
      case 'elapsed':          _handleElapsed(clog);                               break;
      case 'current_time':     _handleCurrentTime(clog);                           break;
      case 'world_clock':      _handleWorldClock(parsed.place, clog);              break;
      case 'add_world_clock':  _handleAddWorldClock(parsed.place, clog);           break;
      case 'stopwatch_start':  _handleStopwatchStart(clog);                        break;
      case 'stopwatch_stop':   _handleStopwatchStop(clog);                         break;
      case 'stopwatch_reset':  _handleStopwatchReset(clog);                        break;
      case 'stopwatch_lap':    _handleStopwatchLap(clog);                          break;
      case 'stopwatch_check':  _handleStopwatchCheck(clog);                        break;
    }
    return true;  // fully handled
  },

  // Expose timer state for Soma inspection
  getTimers()  { return [..._timers]; },
  /** Only the running timers (not alarms), oldest first — { id, label, ms, fireAt } — for the conversation layer. */
  getRunningTimers() { return _timers.filter(_isTimer).map(t => ({ id: t.id, label: t.label, ms: t.ms, fireAt: t.fireAt })); },
  getLaps()    { return _laps.map((ms, i) => _formatStopwatch(ms)); },
  isSwRunning(){ return _stopwatchRunning; },
  clearAll()   { _handleCancel(() => {}); },

  // Cancel a specific timer by id — used by timer modal ✕ button
  cancelById(id) {
    const idx = _timers.findIndex(t => t.id === id);
    if (idx >= 0) {
      clearTimeout(_timers[idx].timeoutId);
      _timers.splice(idx, 1);
    }
  },

  // Alarm persistence — alarms stored in config alongside world clocks
  getAlarms() {
    try {
      const cfg = JSON.parse(localStorage.getItem(CHRONOS_CONFIG_KEY) || '{}');
      return cfg.alarms || [];
    } catch(_) { return []; }
  },

  removeAlarmByIndex(i) {
    try {
      const cfg    = JSON.parse(localStorage.getItem(CHRONOS_CONFIG_KEY) || '{}');
      const alarms = cfg.alarms || [];
      if (i >= 0 && i < alarms.length) {
        // Cancel the timeout if it exists
        if (alarms[i]._timeoutId) clearTimeout(alarms[i]._timeoutId);
        alarms.splice(i, 1);
        cfg.alarms = alarms;
        localStorage.setItem(CHRONOS_CONFIG_KEY, JSON.stringify(cfg));
      }
    } catch(_) {}
  },
};