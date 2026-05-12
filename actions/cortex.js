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
function _classify(intent) {
  const s = intent.toLowerCase().trim();

  // OS-action intents — delegated to Python Cortex server /pulse endpoint
  // These require local machine access that only the Python server has.
  const osPatterns = [
    /\b(open|launch|start|run)\b/,           // app launching
    /\b(download|recent\s+file|what.*download)\b/, // file awareness
    /\b(clipboard|paste|copy)\b/,             // clipboard (future)
    /\b(notification|notify|alert)\b/,        // system notifications
    /\b(screenshot|screen\s+capture)\b/,     // screen capture (future)
  ];
  if (osPatterns.some(rx => rx.test(s))) {
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
    models.forEach(m => {
      const { successCount, failCount, avgLatencyMs, reliability, suspended } = m.metrics;
      const total    = successCount + failCount;
      const failRate = total > 0 ? ((failCount / total) * 100).toFixed(0) : '0';
      const status   = suspended ? '⛔ suspended' : reliability > 0.8 ? '✅ healthy' : '⚠ degraded';
      clog(`   ${m.name}: ${status} | calls: ${total} | fail: ${failRate}% | avg: ${avgLatencyMs}ms`, 'log-vec');
    });
  }

  if (Immune) {
    const report = Immune.report();
    if (report.flags.length) {
      clog(`   ⚠ ${report.flags.length} flag(s): ${report.summary}`, 'log-vec');
    } else {
      clog(`   All models nominal`, 'log-vec');
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

  try {
    const result = await deliberateFn(subject || intent, enginePool, {
      systemPrompt: systemPrompts[type] || systemPrompts.question,
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
  async handle(intent, clog, Nervous, EVENT, enginePool, deliberateFn, Immune, Registry, cortexUrl = null) {
    _flash();

    const classified = _classify(intent);

    if (!classified) {
      clog(`🔬 CORTEX: no recognised action in "${intent}"`, 'log-vec');
      clog('   Analyse: "analyse [topic]" · "break down [topic]"', 'log-vec');
      clog('   Explain: "explain [topic]" · "what is [topic]"', 'log-vec');
      clog('   Reason:  "think through [topic]" · "reason about [topic]"', 'log-vec');
      clog('   Status:  "engine status" · "model health"', 'log-vec');
      return;
    }

    if (Nervous && EVENT) {
      Nervous.emit('CORTEX_ACTION', {
        source:  'CORTEX',
        payload: { type: classified.type, intent },
      });
    }

    switch (classified.type) {
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
  },
};
