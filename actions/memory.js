/**
 * B.O.S.S. MEMORY Action Module — actions/memory.js
 * ===================================================
 * github.com/nztdev/boss-kernel
 *
 * Vault interaction and episodic memory management for the MEMORY node.
 * Handles recall, storage, forgetting, and vault inspection.
 *
 * Interface:
 *   MemoryAction.handle(intent, clog, Nervous, EVENT, cortexUrl?, vaultGet?, vaultSet?)
 *
 * Capabilities (matches Registry definition):
 *   vault_read    — search and retrieve memories
 *   vault_write   — explicitly store a memory
 *   vault_forget  — remove matching memories
 *   vault_status  — inspect vault state
 *   vault_export  — list recent memories
 */

import { semanticSim } from '../engine/engine.js';

// ── Intent classification ─────────────────────────────────────────────────────
function _classify(intent) {
  const s = intent.toLowerCase().trim();

  // Status / inspection
  if (/\b(vault|memory)\s*(status|size|count|info|stats)\b/.test(s) ||
      /\bhow\s+(?:much|many).*\b(remember|memory|vault)\b/.test(s)) {
    return { type: 'status' };
  }

  // Export / list recent
  if (/\b(list|show|export|recent|all)\b.*\b(memor|vault|remember)\b/.test(s) ||
      /\b(what|everything).*\b(remember|stored|know)\b/.test(s)) {
    return { type: 'list' };
  }

  // Forget / delete
  if (/\b(forget|delete|remove|clear|erase)\b/.test(s)) {
    const about = _extractContent(s, ['forget', 'delete', 'remove', 'clear', 'erase']);
    return { type: 'forget', content: about };
  }

  // Remember / store — explicit store command
  if (/\b(remember|memorize|note|store|save)\b/.test(s)) {
    const content = _extractContent(s, ['remember', 'memorize', 'note', 'store', 'save']);
    return { type: 'store', content };
  }

  // Recall / search — "what do you remember about X", "do you know X"
  if (/\b(recall|retrieve|find|search|look\s+up|what.*know|do\s+you\s+know|what.*remember)\b/.test(s) ||
      s === 'what do you remember' || s === 'recall') {
    const query = _extractQuery(s);
    return { type: 'recall', query };
  }

  return null;
}

function _extractContent(s, keywords) {
  for (const kw of keywords) {
    const idx = s.indexOf(kw);
    if (idx >= 0) {
      return s.slice(idx + kw.length).trim().replace(/^(that|this|:)\s*/i, '');
    }
  }
  return s;
}

function _extractQuery(s) {
  // Extract what comes after "about", "regarding", "on"
  const aboutMatch = s.match(/\b(?:about|regarding|on|for)\s+(.+)/);
  if (aboutMatch) return aboutMatch[1].trim();
  // Extract after "remember" / "know"
  const remMatch = s.match(/\b(?:remember|know)\b\s*(.+)/);
  if (remMatch) return remMatch[1].trim();
  return s;
}

// ── Vault helpers ─────────────────────────────────────────────────────────────
function _getVault() {
  try { return JSON.parse(localStorage.getItem('BOSS_VAULT') || '[]'); } catch(_) { return []; }
}

function _setVault(vault) {
  try { localStorage.setItem('BOSS_VAULT', JSON.stringify(vault)); } catch(_) {}
}

// ── Handlers ──────────────────────────────────────────────────────────────────
function _handleStatus(clog) {
  const vault = _getVault();
  if (!vault.length) {
    clog('🧬 MEMORY: vault is empty', 'log-mem');
    return;
  }
  const oldest  = new Date(Math.min(...vault.map(m => m.time || 0)));
  const newest  = new Date(Math.max(...vault.map(m => m.time || 0)));
  const avgLen  = Math.round(vault.reduce((s, m) => s + (m.content?.length || 0), 0) / vault.length);
  clog(`🧬 MEMORY: ${vault.length} entries in vault`, 'log-mem');
  clog(`   oldest: ${oldest.toLocaleDateString()} · newest: ${newest.toLocaleDateString()}`, 'log-mem');
  clog(`   avg entry length: ${avgLen} chars`, 'log-mem');
}

function _handleList(clog) {
  const vault = _getVault();
  if (!vault.length) {
    clog('🧬 MEMORY: vault is empty', 'log-mem');
    return;
  }
  const recent = vault.slice(0, 8);
  clog(`🧬 MEMORY: ${vault.length} entries — showing ${recent.length} most recent:`, 'log-mem');
  recent.forEach((m, i) => {
    const preview = (m.content || '').slice(0, 60);
    const time    = m.time ? new Date(m.time).toLocaleDateString() : '?';
    clog(`   ${i + 1}. [${time}] "${preview}${preview.length === 60 ? '…' : ''}"`, 'log-mem');
  });
}

function _handleRecall(query, intent, clog, cortexUrl) {
  const vault = _getVault();
  if (!vault.length) {
    clog('🧬 MEMORY: vault is empty — nothing to recall', 'log-mem');
    return;
  }

  if (!query || query.length < 2) {
    // No specific query — show most recent
    _handleList(clog);
    return;
  }

  // Semantic search using engine's semanticSim
  const scored = vault
    .map(m => ({ m, sim: semanticSim(query, m.content || '') }))
    .filter(({ sim }) => sim > 0.15)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5);

  if (!scored.length) {
    clog(`🧬 MEMORY: nothing found matching "${query}"`, 'log-mem');
    clog('   Try broader terms or check vault with "memory status"', 'log-mem');
    return;
  }

  clog(`🧬 MEMORY: ${scored.length} match${scored.length !== 1 ? 'es' : ''} for "${query}":`, 'log-mem');
  scored.forEach(({ m, sim }, i) => {
    const preview = (m.content || '').slice(0, 70);
    clog(`   ${i + 1}. (${(sim * 100).toFixed(0)}%) "${preview}${preview.length === 70 ? '…' : ''}"`, 'log-mem');
  });
}

function _handleStore(content, clog, Nervous, EVENT) {
  if (!content || content.length < 3) {
    clog('🧬 MEMORY: nothing to store — say "remember [text]"', 'log-mem');
    return;
  }

  const vault = _getVault();

  // Dedup check using semanticSim
  const duplicate = vault.some(m => semanticSim(m.content || '', content) > 0.85);
  if (duplicate) {
    clog(`🧬 MEMORY: already stored — "${content.slice(0, 50)}"`, 'log-mem');
    return;
  }

  vault.unshift({ content, time: Date.now() });
  if (vault.length > 200) vault.pop();
  _setVault(vault);

  clog(`🧬 MEMORY: stored — "${content.slice(0, 60)}${content.length > 60 ? '…' : ''}"`, 'log-mem');

  if (Nervous && EVENT) {
    Nervous.emit(EVENT.VAULT_WRITTEN, {
      source:  'MEMORY',
      payload: { preview: content.slice(0, 50), source: 'explicit' },
    });
  }
}

function _handleForget(content, clog) {
  if (!content || content.length < 2) {
    clog('🧬 MEMORY: specify what to forget — say "forget [text]"', 'log-mem');
    return;
  }

  const vault   = _getVault();
  const before  = vault.length;

  // Remove entries with high similarity to the forget query
  const filtered = vault.filter(m => semanticSim(content, m.content || '') < 0.6);
  const removed  = before - filtered.length;

  if (!removed) {
    clog(`🧬 MEMORY: nothing found matching "${content.slice(0, 40)}" to forget`, 'log-mem');
    return;
  }

  _setVault(filtered);
  clog(`🧬 MEMORY: forgot ${removed} entr${removed !== 1 ? 'ies' : 'y'} matching "${content.slice(0, 40)}"`, 'log-mem');
}

// ── Screen flash ──────────────────────────────────────────────────────────────
function _flash() {
  const f = document.createElement('div');
  f.className = 'action-flash';
  f.style.background = 'rgba(102,170,255,0.07)';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

// ── Public interface ──────────────────────────────────────────────────────────
export const MemoryAction = {
  handle(intent, clog, Nervous, EVENT, cortexUrl = null) {
    _flash();

    const classified = _classify(intent);

    if (!classified) {
      clog(`🧬 MEMORY: no recognised action in "${intent}"`, 'log-mem');
      clog('   Recall:  "what do you remember" · "recall [topic]"', 'log-mem');
      clog('   Store:   "remember [text]"', 'log-mem');
      clog('   Forget:  "forget [text]"', 'log-mem');
      clog('   Inspect: "memory status" · "list memories"', 'log-mem');
      return;
    }

    if (Nervous && EVENT) {
      Nervous.emit('MEMORY_ACTION', {
        source:  'MEMORY',
        payload: { type: classified.type, intent },
      });
    }

    switch (classified.type) {
      case 'status': _handleStatus(clog);                                          break;
      case 'list':   _handleList(clog);                                            break;
      case 'recall': _handleRecall(classified.query, intent, clog, cortexUrl);    break;
      case 'store':  _handleStore(classified.content, clog, Nervous, EVENT);      break;
      case 'forget': _handleForget(classified.content, clog);                     break;
    }
  },
};
