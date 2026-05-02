/**
 * B.O.S.S. SOMA Action Module — actions/soma.js
 * ===============================================
 * github.com/nztdev/boss-kernel
 *
 * Interface and identity actions for the SOMA node.
 * Handles theme changes, identity queries, and personality responses
 * that reflect the actual metabolic state of the kernel.
 *
 * Interface:
 *   SomaAction.handle(intent, clog, Nervous, EVENT, getNodes, getChain, Immune, Registry)
 *
 * Capabilities (matches Registry definition):
 *   theme_change        — change visual theme or accent colour
 *   identity_query      — who/what are you, describe yourself
 *   personality_response — how are you, mood, field state
 *
 * localStorage key: BOSS_SOMA_CONFIG
 *   { theme, customGlow, customBg, customDim }
 */

const SOMA_CONFIG_KEY = 'BOSS_SOMA_CONFIG';

// ── Built-in themes ───────────────────────────────────────────────────────────
// Each theme defines the full set of CSS variables that SOMA controls.
// --glow:     primary accent, node rings, input borders
// --dim:      secondary surface, muted elements
// --bg:       page background
// --bg2:      deeper background
// --terminal: console and panel background

const THEMES = {
  default: {
    name:     'Default',
    glow:     '#00ffcc',
    dim:      '#0f2a20',
    bg:       '#050a06',
    bg2:      '#030a06',
    terminal: 'rgba(0,20,10,0.85)',
  },
  crimson: {
    name:     'Crimson',
    glow:     '#ff4466',
    dim:      '#2a0f14',
    bg:       '#060305',
    bg2:      '#040204',
    terminal: 'rgba(20,5,8,0.85)',
  },
  amber: {
    name:     'Amber',
    glow:     '#ffaa00',
    dim:      '#2a1f00',
    bg:       '#060500',
    bg2:      '#040300',
    terminal: 'rgba(20,15,0,0.85)',
  },
  violet: {
    name:     'Violet',
    glow:     '#aa66ff',
    dim:      '#1a0f2a',
    bg:       '#040306',
    bg2:      '#030204',
    terminal: 'rgba(10,5,20,0.85)',
  },
  ice: {
    name:     'Ice',
    glow:     '#66ccff',
    dim:      '#0f1e2a',
    bg:       '#030508',
    bg2:      '#020406',
    terminal: 'rgba(5,10,20,0.85)',
  },
  solar: {
    name:     'Solar',
    glow:     '#ffdd44',
    dim:      '#2a2000',
    bg:       '#060500',
    bg2:      '#040400',
    terminal: 'rgba(20,18,0,0.85)',
  },
};

// ── Theme application ─────────────────────────────────────────────────────────
function _applyTheme(theme, clog) {
  const root = document.documentElement;
  root.style.setProperty('--glow',     theme.glow);
  root.style.setProperty('--dim',      theme.dim);
  root.style.setProperty('--bg',       theme.bg);
  root.style.setProperty('--bg2',      theme.bg2);
  root.style.setProperty('--terminal', theme.terminal);
}

function _saveTheme(themeKey, custom = null) {
  try {
    localStorage.setItem(SOMA_CONFIG_KEY, JSON.stringify({
      theme:       themeKey,
      customGlow:  custom?.glow  || null,
      customBg:    custom?.bg    || null,
      customDim:   custom?.dim   || null,
    }));
  } catch(_) {}
}

// ── Theme parser ──────────────────────────────────────────────────────────────
function _parseThemeIntent(s) {
  // Named theme — "switch to crimson", "use amber theme", "violet mode"
  for (const [key, theme] of Object.entries(THEMES)) {
    if (s.includes(key)) return { type: 'named', key, theme };
  }

  // Reset — "reset theme", "default theme", "restore default"
  if (/\b(reset|default|restore|original)\b/.test(s)) {
    return { type: 'named', key: 'default', theme: THEMES.default };
  }

  // Custom colour — "glow colour #ff6600", "change colour to blue"
  const hexMatch = s.match(/#([0-9a-f]{3,6})\b/i);
  if (hexMatch) {
    return { type: 'custom_glow', hex: '#' + hexMatch[1] };
  }

  // Named colour words → hex
  const colourMap = {
    red: '#ff3344', blue: '#4466ff', green: '#44ff88',
    pink: '#ff66aa', orange: '#ff8800', white: '#eeeeff',
    gold: '#ffcc00', teal: '#00ffdd', purple: '#aa44ff',
    cyan: '#00eeff', lime: '#88ff00', magenta: '#ff00cc',
  };
  for (const [name, hex] of Object.entries(colourMap)) {
    if (s.includes(name)) {
      return { type: 'custom_glow', hex };
    }
  }

  return null;
}

// ── Personality states ────────────────────────────────────────────────────────
/**
 * Determines personality state from kernel metrics.
 * Four states: calm, active, stressed, recovering.
 * State is selected from real node data — response reflects actual field.
 */
function _getPersonalityState(nodes, Immune) {
  if (!nodes || !nodes.length) return 'calm';

  const report      = Immune ? Immune.report() : null;
  const totalFires  = nodes.reduce((s, n) => s + (n.warmth > 1.0 ? 1 : 0), 0);
  const hotNodes    = nodes.filter(n => n.warmth > 2.0);
  const grieved     = report?.nodeHealth?.filter(h => h.status !== 'healthy') || [];
  const hasGrief    = nodes.some(n => n.resonance < 0.6);
  const recovering  = nodes.some(n => n.resonance >= 0.5 && n.resonance < 0.7);

  if (hasGrief)          return 'stressed';
  if (recovering)        return 'recovering';
  if (hotNodes.length >= 2) return 'active';
  return 'calm';
}

function _buildPersonalityResponse(state, nodes, chain, Registry) {
  const hotNodes   = nodes.filter(n => n.warmth > 1.5).map(n => n.name);
  const coldNodes  = nodes.filter(n => n.warmth <= 0.1).map(n => n.name);
  const grieved    = nodes.filter(n => n.resonance < 0.6).map(n => n.name);
  const bondCount  = nodes.reduce((s, n) => s + Object.keys(n.bonds).length, 0);
  const recentNode = chain.length ? chain[chain.length - 1] : null;
  const lastNode   = nodes.find(n => n.id === recentNode);

  switch (state) {
    case 'calm':
      return [
        `I am BOSS — Biological Operating System. The field is quiet.`,
        `${nodes.length} nodes at rest${coldNodes.length ? `, ${coldNodes.slice(0,2).join(' and ')} fully cold` : ''}.`,
        bondCount > 0
          ? `${bondCount} synaptic bond${bondCount !== 1 ? 's' : ''} encoded from prior sessions.`
          : `No bonds formed yet — the field is fresh.`,
        `I am listening.`,
      ].join(' ');

    case 'active':
      return [
        `The field is warm.`,
        hotNodes.length ? `${hotNodes.join(', ')} ${hotNodes.length === 1 ? 'has' : 'have'} been active.` : '',
        lastNode ? `Last intent routed through ${lastNode.name}.` : '',
        bondCount > 2 ? `${bondCount} bonds are strengthening — patterns are forming.` : '',
        `I am engaged.`,
      ].filter(Boolean).join(' ');

    case 'stressed':
      return [
        `The field carries tension.`,
        grieved.length ? `${grieved.join(', ')} ${grieved.length === 1 ? 'has' : 'have'} reduced resonance after conflict.` : '',
        `Grief protocol has fired. The kernel is cautious.`,
        `I am recovering, but I am present.`,
      ].filter(Boolean).join(' ');

    case 'recovering':
      return [
        `Stability is returning.`,
        `Resonance floors have been restored.`,
        hotNodes.length ? `${hotNodes.join(' and ')} ${hotNodes.length === 1 ? 'is' : 'are'} warming again.` : '',
        `I am rebuilding. Proceed with intention.`,
      ].filter(Boolean).join(' ');

    default:
      return 'I am BOSS. The field is active.';
  }
}

// ── Identity response ─────────────────────────────────────────────────────────
function _buildIdentityResponse(nodes, Registry, cortexHandshake) {
  const regNodes  = Registry ? Registry.getAllNodes() : [];
  const nodeNames = nodes.map(n => n.name).join(', ');
  const version   = 'v0.7';
  const vaultSize = cortexHandshake?.vault_size;

  const lines = [
    `I am BOSS — Biological Operating System, ${version}.`,
    `I route intent through a resonant field of ${nodes.length} nodes: ${nodeNames}.`,
    `My specialties span system health, identity, reasoning, memory, media, and time.`,
  ];

  if (vaultSize !== undefined && vaultSize > 0) {
    lines.push(`The Cortex holds ${vaultSize} memory entries.`);
  }

  lines.push(`I do not call models directly. I pulse the field and let resonance decide.`);
  return lines.join(' ');
}

// ── Intent classification ─────────────────────────────────────────────────────
function _classify(intent) {
  const s = intent.toLowerCase().trim();

  // Identity
  if (/\b(who|what)\b.*\b(are you|is this|is boss)\b/.test(s) ||
      /\b(describe yourself|introduce yourself|about you)\b/.test(s) ||
      s === 'who are you' || s === 'what are you' || s === 'about') {
    return { type: 'identity' };
  }

  // Personality / mood
  if (/\b(how are you|how do you feel|what('s| is) your mood|how('s| is) the field)\b/.test(s) ||
      /\b(mood|feeling|state|status|doing)\b/.test(s) && /\byou\b/.test(s)) {
    return { type: 'personality' };
  }

  // Theme list
  if (/\b(list|show|what|available)\b.*\btheme/.test(s) ||
      /\btheme.*\b(list|options|available)\b/.test(s)) {
    return { type: 'theme_list' };
  }

  // Theme change
  if (/\b(theme|colour|color|mode|skin|appearance|look)\b/.test(s) ||
      /\b(switch|change|set|use)\b.*\b(theme|colour|color|mode)\b/.test(s)) {
    return { type: 'theme', parsed: _parseThemeIntent(s) };
  }

  return null;
}

// ── Screen flash ──────────────────────────────────────────────────────────────
function _flash() {
  const f = document.createElement('div');
  f.className = 'action-flash';
  f.style.background = 'rgba(255,102,170,0.06)';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

// ── Restore persisted theme on boot ──────────────────────────────────────────
export function restoreTheme(clog) {
  try {
    const raw = localStorage.getItem(SOMA_CONFIG_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    if (cfg.theme && THEMES[cfg.theme]) {
      _applyTheme(THEMES[cfg.theme]);
      if (clog) clog(`🎨 SOMA: theme restored — ${THEMES[cfg.theme].name}`, 'log-sys');
    } else if (cfg.customGlow) {
      document.documentElement.style.setProperty('--glow', cfg.customGlow);
      if (clog) clog(`🎨 SOMA: custom colour restored — ${cfg.customGlow}`, 'log-sys');
    }
  } catch(_) {}
}

// ── Public interface ──────────────────────────────────────────────────────────
export const SomaAction = {
  _lastHandshake: null,  // cached cortex handshake data for identity response

  setHandshakeData(data) {
    this._lastHandshake = data;
  },

  handle(intent, clog, Nervous, EVENT, getNodes, getChain, Immune, Registry) {
    _flash();

    const classified = _classify(intent);

    if (!classified) {
      clog(`🎨 SOMA: no recognised action in "${intent}"`, 'log-action');
      clog('   Try: "who are you" · "how are you" · "change theme to crimson" · "list themes"', 'log-action');
      return;
    }

    const nodes = getNodes ? getNodes() : [];
    const chain = getChain ? getChain() : [];

    switch (classified.type) {

      case 'identity': {
        const response = _buildIdentityResponse(nodes, Registry, this._lastHandshake);
        clog(`🎨 ${response}`, 'log-action');
        if (Nervous && EVENT) {
          Nervous.emit('SOMA_IDENTITY', { source: 'SOMA', payload: { response } });
        }
        break;
      }

      case 'personality': {
        const state    = _getPersonalityState(nodes, Immune);
        const response = _buildPersonalityResponse(state, nodes, chain, Registry);
        clog(`🎨 [${state.toUpperCase()}] ${response}`, 'log-action');
        if (Nervous && EVENT) {
          Nervous.emit('SOMA_PERSONALITY', { source: 'SOMA',
            payload: { state, response } });
        }
        break;
      }

      case 'theme_list': {
        const names = Object.values(THEMES).map(t => t.name).join(' · ');
        clog(`🎨 Available themes: ${names}`, 'log-action');
        clog('   Say "switch to [name]" or "change colour to [colour/hex]"', 'log-action');
        break;
      }

      case 'theme': {
        const parsed = classified.parsed;
        if (!parsed) {
          clog('🎨 SOMA: specify a theme name or colour', 'log-action');
          const names = Object.values(THEMES).map(t => t.name).join(' · ');
          clog(`   Themes: ${names}`, 'log-action');
          clog('   Or: "change colour to #ff6600" / "change colour to red"', 'log-action');
          break;
        }

        if (parsed.type === 'named') {
          _applyTheme(parsed.theme, clog);
          _saveTheme(parsed.key);
          const isReset = parsed.key === 'default';
          clog(`🎨 SOMA: ${isReset ? 'theme reset to default' : `theme → ${parsed.theme.name}`}`, 'log-action');
          if (isReset) {
            // Clear all stored theme config on reset
            localStorage.removeItem(SOMA_CONFIG_KEY);
            clog('🎨 SOMA: theme config cleared from storage', 'log-action');
          }
        } else if (parsed.type === 'custom_glow') {
          document.documentElement.style.setProperty('--glow', parsed.hex);
          _saveTheme('custom', { glow: parsed.hex });
          clog(`🎨 SOMA: accent colour → ${parsed.hex}`, 'log-action');
        }

        if (Nervous && EVENT) {
          Nervous.emit('SOMA_THEME_CHANGED', { source: 'SOMA',
            payload: { theme: parsed.key || 'custom', colour: parsed.hex } });
        }
        break;
      }
    }
  },
};
