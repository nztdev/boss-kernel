/**
 * B.O.S.S. CORE Action Module — actions/core.js
 * ===============================================
 * github.com/nztdev/boss-kernel
 *
 * System diagnostics and health monitoring for the CORE node.
 * Reads from browser-native APIs — no Cortex dependency, works offline.
 *
 * APIs used:
 *   Battery Status API  — navigator.getBattery()
 *   Performance API     — performance.memory, performance.now()
 *   Navigator API       — navigator.onLine, navigator.hardwareConcurrency,
 *                         navigator.connection, navigator.platform
 *   Screen API          — screen.width/height, devicePixelRatio
 *   Nervous System      — emits CORE_STATUS event on every query
 *
 * Capabilities (matches Registry definition):
 *   system_query      — full system status report
 *   diagnostics       — performance and memory diagnostics
 *   battery_monitor   — battery level, charging state, estimated time
 *   network_status    — online/offline, connection type
 *   uptime            — session uptime since page load
 */

// ── Session start time ────────────────────────────────────────────────────────
const _sessionStart = Date.now();

// ── Intent classification ─────────────────────────────────────────────────────
function _classify(intent) {
  const s = intent.toLowerCase().trim();

  // Battery
  if (/\b(battery|charge|charging|power|plugged)\b/.test(s)) {
    return { type: 'battery' };
  }

  // Network
  if (/\b(network|connection|online|offline|internet|wifi|connected)\b/.test(s)) {
    return { type: 'network' };
  }

  // Memory / performance diagnostics
  if (/\b(memory|ram|heap|performance|diagnos|diagnostic)\b/.test(s)) {
    return { type: 'diagnostics' };
  }

  // Uptime
  if (/\b(uptime|session|running|how long|started|launch)\b/.test(s)) {
    return { type: 'uptime' };
  }

  // General status — catches "check system", "system status", "how's the system"
  if (/\b(status|health|check|vitals|system|monitor|report)\b/.test(s)) {
    return { type: 'status' };
  }

  return null;
}

// ── Formatters ────────────────────────────────────────────────────────────────
function _formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function _formatBytes(bytes) {
  if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes > 1048576)    return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes > 1024)       return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ── Handlers ──────────────────────────────────────────────────────────────────
async function _handleBattery(clog) {
  if (!navigator.getBattery) {
    clog('💻 CORE: Battery API not available on this device/browser', 'log-action');
    clog('   Battery monitoring requires Chrome or Edge on desktop', 'log-action');
    return;
  }
  try {
    const b = await navigator.getBattery();
    const level    = Math.round(b.level * 100);
    const charging = b.charging;
    const bar      = '█'.repeat(Math.floor(level / 10)) + '░'.repeat(10 - Math.floor(level / 10));
    const status   = charging ? '⚡ charging' : level < 20 ? '🔴 low' : level < 50 ? '🟡 moderate' : '🟢 good';

    clog(`💻 CORE: Battery ${level}% [${bar}] ${status}`, 'log-action');

    if (charging && b.chargingTime !== Infinity) {
      clog(`   full in: ${_formatDuration(b.chargingTime * 1000)}`, 'log-action');
    } else if (!charging && b.dischargingTime !== Infinity) {
      clog(`   remaining: ${_formatDuration(b.dischargingTime * 1000)}`, 'log-action');
    }
  } catch(e) {
    clog(`💻 CORE: battery read failed — ${e.message}`, 'log-err');
  }
}

function _handleNetwork(clog) {
  const online = navigator.onLine;
  clog(`💻 CORE: Network ${online ? '🟢 online' : '🔴 offline'}`, 'log-action');

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    const type     = conn.effectiveType || conn.type || 'unknown';
    const downlink = conn.downlink ? `${conn.downlink} Mbps` : null;
    const rtt      = conn.rtt ? `${conn.rtt}ms RTT` : null;
    const parts    = [type, downlink, rtt].filter(Boolean);
    clog(`   connection: ${parts.join(' · ')}`, 'log-action');
    if (conn.saveData) clog('   data saver: enabled', 'log-action');
  }
}

function _handleDiagnostics(clog) {
  clog('💻 CORE: System diagnostics', 'log-action');

  // CPU cores
  const cores = navigator.hardwareConcurrency || 'unknown';
  clog(`   CPU: ${cores} logical core${cores !== 1 ? 's' : ''}`, 'log-action');

  // Platform
  const platform = navigator.platform || navigator.userAgentData?.platform || 'unknown';
  clog(`   platform: ${platform}`, 'log-action');

  // Memory (Chrome only)
  if (performance.memory) {
    const used  = _formatBytes(performance.memory.usedJSHeapSize);
    const total = _formatBytes(performance.memory.totalJSHeapSize);
    const limit = _formatBytes(performance.memory.jsHeapSizeLimit);
    clog(`   JS heap: ${used} used / ${total} total / ${limit} limit`, 'log-action');
  } else {
    clog('   JS heap: not available (Chrome only)', 'log-action');
  }

  // Screen
  const dpr = window.devicePixelRatio || 1;
  clog(`   screen: ${screen.width}×${screen.height} @ ${dpr}x DPR`, 'log-action');

  // Page performance
  const nav = performance.getEntriesByType('navigation')[0];
  if (nav) {
    const loadTime = Math.round(nav.loadEventEnd - nav.startTime);
    clog(`   page load: ${loadTime}ms`, 'log-action');
  }
}

function _handleUptime(clog, systemVitals) {
  const sessionMs   = Date.now() - _sessionStart;
  const heartUptime = systemVitals?.uptime || null;

  clog(`💻 CORE: Session uptime — ${_formatDuration(sessionMs)}`, 'log-action');

  // Page load timing
  const nav = performance.getEntriesByType('navigation')[0];
  if (nav) {
    const since = new Date(Date.now() - sessionMs);
    clog(`   started: ${since.toLocaleTimeString()}`, 'log-action');
  }
}

async function _handleStatus(clog, systemVitals, nodes, Immune) {
  clog('💻 CORE: System status report', 'log-action');

  // Uptime
  const sessionMs = Date.now() - _sessionStart;
  clog(`   uptime: ${_formatDuration(sessionMs)}`, 'log-action');

  // Network
  const online = navigator.onLine;
  clog(`   network: ${online ? '🟢 online' : '🔴 offline'}`, 'log-action');

  // Battery
  if (navigator.getBattery) {
    try {
      const b     = await navigator.getBattery();
      const level = Math.round(b.level * 100);
      const icon  = b.charging ? '⚡' : level < 20 ? '🔴' : '🟢';
      clog(`   battery: ${icon} ${level}%${b.charging ? ' charging' : ''}`, 'log-action');
    } catch(_) {}
  }

  // Kernel field health from Immune
  if (Immune) {
    const report = Immune.report();
    const degraded = report.nodeHealth?.filter(n => n.status !== 'healthy') || [];
    if (degraded.length) {
      clog(`   field: ⚠ ${degraded.length} node(s) degraded — ${degraded.map(n => n.name).join(', ')}`, 'log-action');
    } else {
      clog(`   field: 🟢 all ${report.nodeHealth?.length || 0} nodes nominal`, 'log-action');
    }
    if (report.flags?.length) {
      clog(`   flags: ${report.summary}`, 'log-action');
    }
  }

  // Node warmth snapshot
  if (nodes?.length) {
    const hot = nodes.filter(n => n.warmth > 1.5).map(n => `${n.name}(${n.warmth.toFixed(1)})`);
    if (hot.length) clog(`   hot nodes: ${hot.join(' · ')}`, 'log-action');
  }

  // Decay rate from systemVitals
  if (systemVitals) {
    const mode = systemVitals.isLowPower ? '🔋 low-power mode' : 'normal mode';
    clog(`   decay: ${mode} (rate=${systemVitals.decayRate.toFixed(3)})`, 'log-action');
  }
}

// ── Screen flash ──────────────────────────────────────────────────────────────
function _flash() {
  const f = document.createElement('div');
  f.className = 'action-flash';
  f.style.background = 'rgba(0,255,204,0.06)';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

// ── Public interface ──────────────────────────────────────────────────────────
export const CoreAction = {
  async handle(intent, clog, Nervous, EVENT, systemVitals, getNodes, Immune) {
    _flash();

    const classified = _classify(intent);

    if (!classified) {
      clog(`💻 CORE: no recognised action in "${intent}"`, 'log-action');
      clog('   Status:      "system status" · "check system" · "vitals"', 'log-action');
      clog('   Battery:     "battery level" · "check charge"', 'log-action');
      clog('   Network:     "network status" · "am I online"', 'log-action');
      clog('   Diagnostics: "run diagnostics" · "memory usage"', 'log-action');
      clog('   Uptime:      "session uptime" · "how long running"', 'log-action');
      return;
    }

    if (Nervous && EVENT) {
      Nervous.emit('CORE_STATUS', {
        source:  'CORE',
        payload: { type: classified.type, intent },
      });
    }

    const nodes = getNodes ? getNodes() : [];

    switch (classified.type) {
      case 'battery':     await _handleBattery(clog);                                      break;
      case 'network':     _handleNetwork(clog);                                             break;
      case 'diagnostics': _handleDiagnostics(clog);                                        break;
      case 'uptime':      _handleUptime(clog, systemVitals);                               break;
      case 'status':      await _handleStatus(clog, systemVitals, nodes, Immune);          break;
    }
  },
};
