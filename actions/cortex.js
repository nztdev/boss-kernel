/**
 * B.O.S.S. CORTEX Action Module — actions/cortex.js
 * ===================================================
 * github.com/nztdev/boss-kernel
 *
 * Reasoning and deliberation actions for the CORTEX node.
 * Calls the deliberation engine directly for analytical tasks.
 *
 * Interface:
 *   CortexAction.handle(intent, clog, Nervous, EVENT, enginePool, deliberateFn, Immune, Registry)
 *
 * Capabilities (matches Registry definition):
 *   reasoning    — analyse, explain, think through
 *   analysis     — structured breakdown of a topic
 *   inference    — draw conclusions from available data
 *   engine_query — direct deliberation engine call
 *   pool_status  — engine pool health report
 */

// ── Intent classification ─────────────────────────────────────────────────────
import { isVisionIntent, visionMode } from './vision.js';
import { Launcher } from './launch.js';

function _classify(intent) {
  const s = intent.toLowerCase().trim();

  // Vision: camera / read / describe an image → the Look panel
  if (isVisionIntent(s)) return { type: 'vision', mode: visionMode(s) };

  // Clipboard → Text Tools (device clipboard; PC clipboard needs an explicit PC word)
  if ((/\bclipboard\b/.test(s) || /\bwhat (?:i|i've|i have) (?:just )?copied\b/.test(s) || /\b(?:the )?(?:text|thing|link) (?:i|i've|i have) (?:just )?copied\b/.test(s)) &&
      !/\b(pc|computer|desktop|laptop)\b/.test(s)) {
    const mode = /\btranslate\b/.test(s) ? 'translate' : /\brewrite\b/.test(s) ? 'rewrite'
               : /\banaly[sz]e\b/.test(s) ? 'analyse' : /\bexplain\b/.test(s) ? 'explain' : 'summarise';
    const autorun = /\b(summari[sz]e|summary|translate|rewrite|analy[sz]e|explain)\b/.test(s);
    return { type: 'clipboard', mode, autorun };
  }

  // "open text tools" / "text tools" → the Text Tools panel
  if (/^(?:open\s+|show\s+|launch\s+)?(?:the\s+|my\s+)?text\s*tools?$/.test(s)) return { type: 'text_tools' };

  // "summarise / translate / rewrite this text" with no text supplied → Text Tools in that mode
  { const tm = /^(summari[sz]e|translate|rewrite|paraphrase)\s+(?:this|the|my|some|a)?\s*text$/.exec(s.replace(/[.!?]+$/, ""));
    if (tm) return { type: 'text_mode', mode: tm[1].startsWith('summ') ? 'summarise' : tm[1] === 'paraphrase' ? 'rewrite' : tm[1] }; }

  // Local app launching / iOS Shortcuts (this device). "on my pc" is excluded
  // inside parse() and falls through to the PC server below.
  const _l = Launcher.parse(intent);
  if (_l) return { type: 'launch', launch: _l };

  // OS-action intents — delegated to Python Cortex server /pulse endpoint
  // These require local machine access that only the Python server has.
  const osPatterns = [
    /\b(open|launch|start|run)\b/,           // app launching
    /\b(download|recent\s+file|what.*download)\b/, // file awareness
    /\b(clipboard|paste|copy)\b/,             // clipboard (future)
    /\b(notification|notify|alert)\b/,        // system notifications
    /\b(screenshot|screen\s+capture)\b/,     // screen capture (future)
  ];
  // Bare "open a file/document" is a device-file request (FILES picker), not a
  // PC action — it is an OS action only if the intent names the PC explicitly.
  const _fileNoun = /\b(file|files|document|doc|pdf|image|photo|picture|video)\b/.test(s);
  const _pcRef    = /\b(pc|computer|desktop|laptop|cortex)\b/.test(s);
  const _bareFileOpen = /\b(open|view|show)\b/.test(s) && _fileNoun && !_pcRef;
  if (!_bareFileOpen && osPatterns.some(rx => rx.test(s))) {
    return { type: 'os_action' };
  }

  // Engine pool status
  if (/\b(engine|model|pool)\s*(status|health|report|info)\b/.test(s) ||
      /\b(who|which)\s*(model|knows|is\s+best)\b/.test(s)) {
    return { type: 'pool_status' };
  }

  // Analyse
  if (/\b(analys[ez]|breakdown|break\s+down|examine|evaluate|assess)\b/.test(s)) {
    const subject = _extractSubject(s, ['analyse', 'analyze', 'breakdown',
                                        'break down', 'examine', 'evaluate', 'assess']);
    return { type: 'analyse', subject };
  }

  // Explain
  if (/\b(explain|describe|what\s+is|what\s+are|how\s+does|how\s+do|define)\b/.test(s)) {
    const subject = _extractSubject(s, ['explain', 'describe', 'what is',
                                        'what are', 'how does', 'how do', 'define']);
    return { type: 'explain', subject };
  }

  // Think through / reason
  if (/\b(think|reason|consider|reflect|ponder|contemplate|figure\s+out)\b/.test(s)) {
    const subject = _extractSubject(s, ['think through', 'think about', 'reason about',
                                        'consider', 'reflect on', 'figure out', 'think']);
    return { type: 'reason', subject };
  }

  // General question — anything ending in ? or starting with question words
  if (s.endsWith('?') || /^(what|why|how|when|where|who|which|is|are|can|should|would)\b/.test(s)) {
    return { type: 'question', subject: intent };
  }

  return null;
}

function _extractSubject(s, keywords) {
  // Try longest keyword first to avoid partial matches
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    const idx = s.indexOf(kw);
    if (idx >= 0) {
      return s.slice(idx + kw.length).trim().replace(/^(about|on|this|that|:)\s*/i, '') || s;
    }
  }
  return s;
}

// ── Handlers ──────────────────────────────────────────────────────────────────
async function _handleOsAction(intent, clog, Nervous, EVENT, cortexUrl) {
  if (!cortexUrl) {
    clog('🔬 CORTEX: Python Cortex server offline — tap cortex pill to configure', 'log-vec');
    clog('   The Cortex server provides local OS access: app launching, file awareness', 'log-vec');
    return;
  }
  try {
    const r = await fetch(`${cortexUrl}/pulse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ intent, node: 'CORTEX' }),
      signal:  AbortSignal.timeout(3000),
    });
    if (!r.ok) throw new Error(`${r.status}`);
    const d = await r.json();
    if (d.response) {
      clog(`🔬 [cortex→CORTEX] ${d.response}`, 'log-action');
    }
    if (d.action) {
      clog(`🔬 CORTEX: executed — ${d.action}`, 'log-action');
      if (Nervous && EVENT) {
        Nervous.emit('CORTEX_OS_ACTION', {
          source:  'CORTEX',
          payload: { intent, action: d.action, source: d.source },
        });
      }
    }
  } catch(e) {
    clog(`🔬 CORTEX: OS action failed — ${e.message}`, 'log-err');
    clog('   Ensure the Python Cortex server is running', 'log-err');
  }
}

function _handlePoolStatus(clog, Immune, Registry) {
  clog('🔬 CORTEX: engine pool status', 'log-vec');

  if (Registry) {
    const models = Registry.getAllModels();
    let anyConfigured = false;
    models.forEach(m => {
      const { successCount, failCount, avgLatencyMs, reliability, suspended } = m.metrics;
      const hasKey   = !!(m.apiKey);
      const total    = successCount + failCount;
      const failRate = total > 0 ? ((failCount / total) * 100).toFixed(0) : '0';
      let status;
      if (!hasKey)            status = '⚪ unconfigured';
      else if (suspended)     status = '⛔ suspended';
      else if (reliability > 0.8) { status = '✅ healthy'; anyConfigured = true; }
      else                    { status = '⚠ degraded';  anyConfigured = true; }
      clog(`   ${m.name}: ${status} | calls: ${total} | fail: ${failRate}% | avg: ${avgLatencyMs}ms`, 'log-vec');
    });
    if (!anyConfigured) {
      clog('   No engine keys configured — tap cortex pill → Engine Keys', 'log-vec');
    } else {
      const report = Immune?.report();
      if (!report?.flags?.length) clog('   All configured models nominal', 'log-vec');
    }
  }
}

async function _handleDeliberate(type, subject, intent, clog, Nervous, EVENT, enginePool, deliberateFn) {
  if (!enginePool || !deliberateFn) {
    clog('🔬 CORTEX: engine not configured — add API keys via cortex pill', 'log-vec');
    return;
  }

  const activeTier1 = enginePool.filter(n => n.tier === 1 && n.apiKey);
  if (!activeTier1.length) {
    clog('🔬 CORTEX: no Tier 1 engine models configured', 'log-vec');
    clog('   Add Groq or Gemini keys via the cortex pill → Engine Keys', 'log-vec');
    return;
  }

  const typeLabel = type === 'analyse' ? 'Analysing'
                  : type === 'explain' ? 'Explaining'
                  : type === 'reason'  ? 'Reasoning through'
                  : 'Processing';

  clog(`🔬 CORTEX: ${typeLabel} — consulting engine…`, 'log-vec');

  // System prompt tailored to the type
  const systemPrompts = {
    analyse:  'You are an analytical reasoning engine. Break down the topic clearly and concisely. Identify key components, relationships, and implications. Be structured but brief.',
    explain:  'You are a clear explainer. Explain the topic in plain language. Be accurate, concise, and accessible. Avoid jargon unless necessary.',
    reason:   'You are a careful reasoner. Think through the topic step by step. Consider multiple angles and arrive at a well-reasoned conclusion. Be concise.',
    question: 'You are a knowledgeable assistant. Answer the question directly and accurately. Be concise and clear.',
  };

  // Prepend BOSS capability context + user profile — grounds engine responses
  // in what BOSS can actually do and who it's talking to.
  let systemPrompt = systemPrompts[type] || systemPrompts.question;
  if (window.BOSS_CAPABILITY_CONTEXT) {
    systemPrompt = `${window.BOSS_CAPABILITY_CONTEXT} ${systemPrompt}`;
  }
  if (window.getUserProfile) {
    const profile = window.getUserProfile();
    const contextParts = [];
    if (profile.name)        contextParts.push(`The user's name is ${profile.name}.`);
    if (profile.preferences) contextParts.push(`User preferences: ${profile.preferences}.`);
    if (profile.routines)    contextParts.push(`User routines: ${profile.routines}.`);
    if (contextParts.length) {
      systemPrompt = `${contextParts.join(' ')} ${systemPrompt}`;
    }
  }

  try {
    const result = await deliberateFn(subject || intent, enginePool, {
      systemPrompt,
    });

    if (result.error) {
      clog(`🔬 CORTEX: engine error — ${result.error}`, 'log-err');
      return;
    }

    const conf    = Math.round((result.confidence || 0) * 100);
    const winner  = result.winner?.name || 'unknown';
    const output  = result.output || '';

    clog(`🔬 CORTEX [${winner}, ${conf}% consensus]:`, 'log-vec');

    // Split into paragraphs for readable console output
    output.split(/\n\n+/).forEach(para => {
      if (para.trim()) {
        const lines = para.match(/.{1,100}(\s|$)/g) || [para];
        lines.forEach(line => line.trim() && clog(`   ${line.trim()}`, 'log-vec'));
      }
    });

    if (result.escalated) {
      clog(`   [tiebreaker: ${result.tiebreaker?.name || 'T2'} consulted]`, 'log-sys');
    }

    if (Nervous && EVENT) {
      Nervous.emit('CORTEX_RESPONSE', {
        source:  'CORTEX',
        payload: { type, subject, confidence: result.confidence, winner },
      });
    }

  } catch(e) {
    clog(`🔬 CORTEX: deliberation failed — ${e.message}`, 'log-err');
  }
}

// ── Screen flash ──────────────────────────────────────────────────────────────
function _flash() {
  const f = document.createElement('div');
  f.className = 'action-flash';
  f.style.background = 'rgba(204,0,255,0.06)';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

// ── Public interface ──────────────────────────────────────────────────────────
export const CortexAction = {
  async handle(intent, clog, Nervous, EVENT, enginePool, deliberateFn, Immune, Registry,
               cortexUrl = null, selectToolFn = null, firePresetFn = null) {
    _flash();

    const classified = _classify(intent);

    if (!classified) {
      // Deterministic hand-off (no engine needed): a bare device-file request
      // that routing happened to give to CORTEX belongs to FILES. Specialty
      // overlap makes this a near-tie, so don't depend on who wins it.
      const _s = intent.toLowerCase();
      if (/\b(open|view|show|pick|choose|select|browse)\b/.test(_s) &&
          /\b(file|files|document|doc|pdf|image|photo|picture|video)\b/.test(_s) &&
          !/\b(pc|computer|desktop|laptop|cortex)\b/.test(_s) && Registry && firePresetFn) {
        const p = Registry.getPreset('files_open');
        if (p) {
          clog('🔬 CORTEX: device file request → handing off to FILES', 'log-vec');
          firePresetFn(p);
          return true;
        }
      }
      // Gap-filling fallback (v0.9 Direction) — before giving up entirely,
      // let the engine check the full preset catalogue for a match beyond
      // CORTEX's own local patterns. Only attempted if the engine is
      // actually configured — no point spending a network call otherwise.
      const engineReady = enginePool && enginePool.some(n => n.tier === 1 && n.apiKey);
      if (engineReady && selectToolFn && Registry) {
        try {
          const tools  = Registry.exportToolSchema();
          const result = await selectToolFn(intent, tools, enginePool);
          if (result) {
            const preset = Registry.getPreset(result.presetId);
            if (preset && firePresetFn) {
              clog(`🔬 CORTEX: gap-filled → "${preset.label}" (${result.node}, via ${result.model})`, 'log-vec');
              firePresetFn(preset);
              return true;  // handled — no orbitals needed
            }
          }
          clog(`🔬 CORTEX: checked ${tools.length} capabilities — none genuinely matched`, 'log-vec');
        } catch(e) {
          clog(`🔬 CORTEX: gap-fill lookup failed (${e.message}) — continuing`, 'log-vec');
        }
      }

      // Genuine gap — nothing local, nothing the engine could match either.
      // Recorded locally (v0.9 gap detection) so patterns in what people
      // actually ask for can inform what BOSS builds next, rather than
      // this signal just evaporating each time.
      if (window.logCapabilityGap) window.logCapabilityGap(intent, engineReady);

      clog(`🔬 CORTEX: no recognised action in "${intent}"`, 'log-vec');
      if (!engineReady) {
        clog('   💡 Open questions ("tell me a joke", "why is the sky blue") need an AI engine key —', 'log-vec');
        clog('      tap the cortex pill → Engine Keys. Everything else works without one.', 'log-vec');
      }
      clog('   Analyse: "analyse [topic]" · "break down [topic]"', 'log-vec');
      clog('   Explain: "explain [topic]" · "what is [topic]"', 'log-vec');
      clog('   Reason:  "think through [topic]" · "reason about [topic]"', 'log-vec');
      clog('   Status:  "engine status" · "model health"', 'log-vec');
      return false;
    }

    if (Nervous && EVENT) {
      Nervous.emit('CORTEX_ACTION', {
        source:  'CORTEX',
        payload: { type: classified.type, intent },
      });
    }

    switch (classified.type) {
      case 'vision':
        if (window.openLookModal) {
          const camera = /\btake (a |an )?(photo|picture|pic|snap|snapshot)\b/i.test(intent);
          window.openLookModal(classified.mode, { camera });
          clog('📷 CORTEX: Look', 'log-vec');
          return true;
        }
        return false;

      case 'clipboard':
        if (window.ttFromClipboard) return await window.ttFromClipboard(classified.mode, classified.autorun);
        return false;

      case 'text_mode':
        if (window.openTextToolsMode) { window.openTextToolsMode(classified.mode); clog('✎ CORTEX: Text Tools — paste your text, then Run', 'log-vec'); return true; }
        return false;

      case 'text_tools': {
        const p = Registry && Registry.getPreset('cortex_texttools');
        if (p && firePresetFn) { firePresetFn(p); return true; }
        return false;
      }

      case 'launch': {
        const done = Launcher.run(classified.launch, clog);
        if (done) return true;
        // Unknown app name: PC server if configured, else say so honestly.
        if (cortexUrl) { await _handleOsAction(intent, clog, Nervous, EVENT, cortexUrl); return true; }
        clog(`🚀 CORTEX: I don't know an app called "${classified.launch.name}" — add it with "add app ${classified.launch.name} scheme://…"`, 'log-vec');
        return true;
      }

      case 'os_action':
        await _handleOsAction(intent, clog, Nervous, EVENT, cortexUrl);
        break;

      case 'pool_status':
        _handlePoolStatus(clog, Immune, Registry);
        break;

      case 'analyse':
      case 'explain':
      case 'reason':
      case 'question':
        await _handleDeliberate(
          classified.type,
          classified.subject,
          intent,
          clog, Nervous, EVENT,
          enginePool, deliberateFn
        );
        break;
    }
    return true;
  },
};
