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
// Persists across intents within a session.
// Not persisted to localStorage — timers are session-scoped.
const _timers = [];  // [{ id, label, fireAt, timeoutId }]
let   _notificationPermission = null;
let   _elapsedStart = null;  // tracks when CHRONOS last fired

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
      clog(`⏱ CHRONOS: no time expression found in "${intent}"`, 'log-action');
      clog('   Try: "set a timer for 5 minutes" · "remind me at 3pm" · "cancel timer"', 'log-action');
      return;
    }

    switch (parsed.type) {
      case 'timer':   _handleTimer(parsed, intent, clog, Nervous, EVENT);  break;
      case 'alarm':   _handleAlarm(parsed, intent, clog, Nervous, EVENT);  break;
      case 'cancel':  _handleCancel(clog);                                  break;
      case 'query':   _handleQuery(clog);                                   break;
      case 'elapsed': _handleElapsed(clog);                                 break;
    }
  },

  // Expose timer state for Soma inspection if needed
  getTimers() { return [..._timers]; },
  clearAll()  { _handleCancel(() => {}); },
};
