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
function _parseIntent(intent) {
  const s = intent.toLowerCase().trim();

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

  // Cancel
  if (/\b(cancel|stop|clear|dismiss)\b.*\btimer\b/.test(s) ||
      /\btimer\b.*\b(cancel|stop|clear)\b/.test(s)) {
    return { type: 'cancel' };
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

  // Duration — seconds
  const secMatch = s.match(/(\d+)\s*sec(?:ond)?s?/);
  if (secMatch) {
    const n = parseInt(secMatch[1]);
    return { type: 'timer', ms: n * 1000, label: `${n} second${n !== 1 ? 's' : ''}` };
  }

  // Duration — minutes
  const minMatch = s.match(/(\d+)\s*min(?:ute)?s?/);
  if (minMatch) {
    const n = parseInt(minMatch[1]);
    return { type: 'timer', ms: n * 60 * 1000, label: `${n} minute${n !== 1 ? 's' : ''}` };
  }

  // Duration — hours (numeric)
  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*hours?/);
  if (hourMatch) {
    const n = parseFloat(hourMatch[1]);
    return { type: 'timer', ms: n * 3600 * 1000, label: `${n} hour${n !== 1 ? 's' : ''}` };
  }

  // Duration — "an hour" / "half an hour" / "a minute"
  if (/\ban?\s+hour\b/.test(s))      return { type: 'timer', ms: 3600000,  label: '1 hour' };
  if (/half\s+an?\s+hour/.test(s))   return { type: 'timer', ms: 1800000,  label: '30 minutes' };
  if (/quarter\s+(?:of\s+an?\s+)?hour/.test(s)) return { type: 'timer', ms: 900000, label: '15 minutes' };
  if (/\ban?\s+minute\b/.test(s))    return { type: 'timer', ms: 60000,    label: '1 minute' };

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

function _handleTimer(parsed, intent, clog, Nervous, EVENT) {
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

  _timers.push({ id, label: parsed.label, fireAt, timeoutId, intent });
  clog(`⏱ Timer set: ${parsed.label} → fires at ${timeStr}`, 'log-action');
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

  _timers.push({ id, label: parsed.label, fireAt: parsed.fireAt, timeoutId, intent });
  clog(`⏰ Alarm set: ${parsed.label} (fires at ${timeStr})`, 'log-action');

  // Persist alarm to config so modal can list it
  try {
    const cfg    = JSON.parse(localStorage.getItem(CHRONOS_CONFIG_KEY) || '{}');
    cfg.alarms   = cfg.alarms || [];
    cfg.alarms.push({ time: parsed.label, label: intent, id, _timeoutId: timeoutId });
    localStorage.setItem(CHRONOS_CONFIG_KEY, JSON.stringify(cfg));
  } catch(_) {}
}

function _handleCancel(clog) {
  if (!_timers.length) {
    clog('⏱ No active timers to cancel', 'log-action');
    return;
  }
  _timers.forEach(t => clearTimeout(t.timeoutId));
  const count = _timers.length;
  _timers.length = 0;
  clog(`⏱ Cancelled ${count} timer${count !== 1 ? 's' : ''}`, 'log-action');
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

    // Request notification permission on first real timer use
    if (!_notificationPermission) {
      _notificationPermission = await _requestNotificationPermission();
      if (!_notificationPermission) {
        clog('⏱ Notifications blocked — timers will log to console only', 'log-action');
      }
    }

    const parsed = _parseIntent(intent);

    if (!parsed) {
      clog(`⏱ CHRONOS: no time expression in "${intent}" — choose a duration:`, 'log-action');
      return false;  // incomplete — show orbitals
    }

    switch (parsed.type) {
      case 'timer':            _handleTimer(parsed, intent, clog, Nervous, EVENT); break;
      case 'alarm':            _handleAlarm(parsed, intent, clog, Nervous, EVENT); break;
      case 'cancel':           _handleCancel(clog);                                break;
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