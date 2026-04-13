/**
 * BOSS Deliberation Engine — engine.js
 * =====================================
 * github.com/nztdev/boss-kernel
 * github.com/nztdev/boss-deliberate
 *
 * The shared core of two products:
 *   1. BOSS Kernel — imported by the deliberation layer to resolve
 *      ambiguous intents when the Arbiter surfaces a conflict.
 *   2. Standalone PWA — the entire product; this engine IS the app.
 *
 * The engine is UI-agnostic. It has no DOM dependencies.
 * Import it anywhere, pass it an intent and a pool, get a result.
 *
 * Architecture:
 *   semanticSim()     — intent/specialty similarity (offline, n-gram)
 *   LLMNode           — a model as a resonant field participant
 *   scorePool()       — ranks all nodes against an intent
 *   callModel()       — adapter dispatcher (Groq / Gemini / Mistral / Ollama)
 *   measureDissonance() — cosine distance between two text responses
 *   deliberate()      — the full tiered pipeline, returns a DelibeResult
 *
 * Architectural locks (do not modify without understanding why):
 *   - warmth × match is a MULTIPLICATION. Intent gates thermal energy.
 *   - vectorBoost is RELATIVE (mean-subtracted). Defaults to 0 offline.
 *   - Dissonance is measured on OUTPUTS, not specialties.
 *     (Specialty dissonance is the Arbiter's job in the BOSS kernel.
 *      Output dissonance is this engine's job.)
 *   - Tier escalation uses early exit: if T1A and T1B agree, T2 is
 *     never called. Median latency = fastest agreeing pair.
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const ENGINE_VERSION   = '0.1.0';
export const DISSONANCE_AGREE = 0.35;  // below this → models agree → early exit
export const DISSONANCE_WARN  = 0.60;  // above this → genuine contradiction
const BOND_DECAY_K     = 0.6;
const BOND_LOOKBACK    = 4;
const BASE_DECAY       = 0.05;
const VECTOR_WEIGHT    = 2.0;

// ── Semantic similarity (offline, no dependencies) ────────────────────────────
/**
 * n-gram cosine similarity + synonym boosting.
 * Returns float [0, 1].
 *
 * This is the same function used throughout the BOSS kernel.
 * When the cortex is online, its embedding-based similarity supersedes
 * this for scoring — but this remains the fallback and is used for
 * specialty-vs-specialty dissonance checks in the Arbiter.
 */
const SYNONYMS = {
  health:    ['vitality','status','wellbeing','monitor','check','diagnostics','condition'],
  read:      ['retrieve','load','fetch','access','recall','get','find','search'],
  identity:  ['self','who','name','describe','about','you','soma'],
  data:      ['records','files','storage','memory','information','database','archive'],
  reasoning: ['think','logic','analyse','evaluate','decide','process','infer','explain','meaning'],
  media:     ['music','sound','audio','play','volume','track','song','speaker'],
  time:      ['schedule','clock','calendar','timer','alarm','when','duration','routine'],
  code:      ['program','script','function','debug','compile','syntax','algorithm','build'],
  write:     ['generate','draft','compose','create','produce','essay','email','message'],
  summarise: ['summarize','summarise','shorten','tldr','brief','condense','overview'],
};

export function semanticSim(a, b, n = 3) {
  const clean  = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const ngrams = s => {
    const out = new Set(), c = clean(s);
    for (let i = 0; i <= c.length - n; i++) out.add(c.slice(i, i + n));
    c.split(/\s+/).filter(w => w.length >= 2).forEach(w => out.add(w));
    return out;
  };
  const sa = ngrams(a), sb = ngrams(b);
  const inter = [...sa].filter(x => sb.has(x)).length;
  const denom = Math.sqrt(sa.size * sb.size);
  const base  = denom ? Math.min(1, inter / denom) : 0;

  // Synonym boost — catches "analyse audio" → MEDIA even without n-gram overlap
  let boost = 0;
  const wa = a.toLowerCase().split(/\s+/);
  const wb = b.toLowerCase().split(/\s+/);
  for (const [, syns] of Object.entries(SYNONYMS)) {
    const inA = wa.some(w => syns.includes(w));
    const inB = wb.some(w => syns.includes(w));
    if (inA && inB) boost = Math.max(boost, 0.35);
  }
  return Math.min(1, base + boost);
}

// ── LLM Node ──────────────────────────────────────────────────────────────────
/**
 * An LLM wrapped as a resonant field participant.
 *
 * Properties:
 *   name         — display name ("Groq Llama 3", "Gemini Flash", etc.)
 *   provider     — adapter key: 'groq' | 'gemini' | 'mistral' | 'ollama'
 *   model        — provider-specific model string
 *   specialty    — text description of what this model is good at
 *   tier         — 1 (fast/cheap) or 2 (capable/slower tiebreaker)
 *   apiKey       — user-supplied key (never logged, never stored by engine)
 *   warmth       — recent activation energy [0, 10], decays over time
 *   resonance    — accumulated reliability [0.1, ∞), grows on agreement
 *   bonds        — { targetNodeId: strength } — co-activation memory
 *   reliability  — long-term score [0, 1], penalised by dissonance events
 *   costWeight   — [0, 1] efficiency scalar (1 = ideal for this intent type)
 */
export class LLMNode {
  constructor({ name, provider, model, specialty, tier = 1,
                apiKey = '', baseUrl = '', warmth = 0.5,
                resonance = 1.0, reliability = 1.0 }) {
    this.id          = `${provider}-${model}`.replace(/[^a-z0-9-]/gi, '-');
    this.name        = name;
    this.provider    = provider;
    this.model       = model;
    this.specialty   = specialty;
    this.tier        = tier;
    this.apiKey      = apiKey;
    this.baseUrl     = baseUrl;   // for Ollama or self-hosted
    this.warmth      = warmth;
    this.resonance   = resonance;
    this.reliability = reliability;
    this.bonds       = {};
    this.lastT       = Date.now();
    this.lastOutput  = null;
    this.costWeight  = 1.0;       // tuned externally per intent if needed
  }

  /**
   * Frequency score for this node against a given intent.
   *
   * freq = (warmth × match)                           thermal, intent-gated
   *       + resonance × matchGate × (1 + 0.3·sin)    standing wave, match-gated
   *       + bondSignal × 2                            synaptic gradient
   *       + vectorBoost × 2                           optional cortex signal
   *       × reliability                               long-term penalty multiplier
   *
   * NOTE: The standing wave in this engine differs from the BOSS kernel.
   * In the kernel, resonance represents accumulated node trust and fires
   * at full strength regardless of match — this is intentional for routing.
   * In the engine, LLM nodes all start with equal resonance (1.2), so an
   * unmodified standing wave makes pool construction order the tiebreaker
   * on low-match intents. matchGate scales the standing wave with semantic
   * relevance, making specialty strings decisive rather than pool position.
   * Floor at 0.15 ensures resonance is never fully suppressed — a model
   * with weak match still contributes, it just doesn't dominate.
   */
  score(intent, chain = [], allNodes = [], vectorBoost = 0) {
    const match        = semanticSim(intent, this.specialty);
    const thermal      = this.warmth * match;
    const phase        = Math.sin(2 * Math.PI * this.resonance);
    // matchGate: scales standing wave by semantic relevance.
    // Prevents pool construction order from breaking ties on low-match intents.
    const matchGate    = Math.max(match, 0.15);
    const standingWave = this.resonance * matchGate * (1 + 0.3 * phase);

    let bondSignal = 0;
    chain.slice(-BOND_LOOKBACK).reverse().forEach((nid, i) => {
      const prev = allNodes.find(n => n.id === nid);
      if (prev && prev.bonds[this.id] !== undefined)
        bondSignal += prev.bonds[this.id] * Math.pow(BOND_DECAY_K, i);
    });

    const raw = thermal + standingWave + (bondSignal * 2) + (vectorBoost * VECTOR_WEIGHT);
    // Reliability multiplies the final score — a model with a bad track
    // record can still score, but needs a stronger semantic match to win.
    return {
      total: raw * this.reliability,
      match, thermal, standingWave, bondSignal, vectorBoost,
    };
  }

  /** Metabolic decay — call on each engine invocation to keep warmth current. */
  decay() {
    const dt = (Date.now() - this.lastT) / 1000;
    this.warmth *= Math.exp(-BASE_DECAY * dt);
    if (this.warmth < 0.05) this.warmth = 0.05;
    this.lastT = Date.now();
  }

  /** Called when this node produces an output that agrees with consensus. */
  ignite() {
    this.warmth     = Math.min(this.warmth + 1.5, 10);
    this.resonance += 0.005;
    this.reliability = Math.min(this.reliability + 0.01, 1.0);
    this.lastT = Date.now();
  }

  /**
   * Called when this node's output contradicts consensus.
   * Metabolic grief — reduces reliability over time if contradictions persist.
   */
  grieve(penalty = 0.05) {
    this.warmth    *= 0.7;
    this.reliability = Math.max(this.reliability - penalty, 0.1);
  }

  toJSON() {
    return {
      id: this.id, name: this.name, provider: this.provider,
      model: this.model, specialty: this.specialty, tier: this.tier,
      warmth: this.warmth, resonance: this.resonance,
      reliability: this.reliability, bonds: this.bonds,
    };
  }

  static fromJSON(d, apiKey = '', baseUrl = '') {
    const n = new LLMNode({ ...d, apiKey, baseUrl });
    n.bonds = d.bonds || {};
    return n;
  }
}

// ── Scoring ───────────────────────────────────────────────────────────────────
/**
 * Rank all nodes in a pool against an intent.
 * Returns scored array sorted descending by total frequency.
 */
export function scorePool(intent, pool, chain = [], vectorBoosts = []) {
  pool.forEach(n => n.decay());
  return pool
    .map((n, i) => ({ node: n, ...n.score(intent, chain, pool, vectorBoosts[i] || 0) }))
    .sort((a, b) => b.total - a.total);
}

// ── Model adapters ────────────────────────────────────────────────────────────
/**
 * Common interface: async (node, intent, systemPrompt?) → string
 * All adapters return plain text. Error handling is local — callers
 * receive null on failure, not thrown exceptions.
 */

async function callGroq(node, intent, systemPrompt) {
  const body = {
    model: node.model || 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt || defaultSystemPrompt(node) },
      { role: 'user',   content: intent },
    ],
    max_tokens: 512,
    temperature: 0.4,
  };
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${node.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(`Groq ${r.status}: ${err?.error?.message || r.statusText}`);
    }
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || null;
  } catch(e) {
    return { error: e.message };
  }
}

async function callGemini(node, intent, systemPrompt) {
  // Model: 'gemini-2.5-flash' confirmed working on AI Studio free tier (2026-04-04).
  // If you see 404s on a different account, try 'gemini-1.5-flash' as fallback.
  const model  = node.model || 'gemini-2.5-flash';
  const url    = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${node.apiKey}`;
  const body   = {
    system_instruction: { parts: [{ text: systemPrompt || defaultSystemPrompt(node) }] },
    contents: [{ role: 'user', parts: [{ text: intent }] }],
    generationConfig: { maxOutputTokens: 512, temperature: 0.4 },
  };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),  // extended: AI Studio free-tier cold-start can exceed 8s
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      // Surface the full error — most common:
      //   400 → wrong model string or malformed body
      //   403 → wrong key type (Vertex key used instead of AI Studio key)
      //   404 → model string doesn't exist for this API version
      //   429 → free tier quota exceeded
      throw new Error(`Gemini ${r.status} (${err?.error?.status || 'unknown'}): ${err?.error?.message || r.statusText}`);
    }
    const d = await r.json();
    // Check for content blocked by safety filters
    const blockReason = d.candidates?.[0]?.finishReason;
    if (blockReason && blockReason !== 'STOP' && blockReason !== 'MAX_TOKENS') {
      return { error: `Gemini blocked: finishReason=${blockReason}` };
    }
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return { error: 'Gemini returned empty content' };
    return text;
  } catch(e) {
    return { error: e.message };
  }
}

async function callMistralHF(node, intent, systemPrompt) {
  // HuggingFace Inference Router — free tier, no billing required.
  // Endpoint: router.huggingface.co/v1 (updated 2026 — old api-inference endpoint deprecated)
  // Model appended with provider suffix e.g. ':together' or ':nebius'
  // Qwen2.5-7B-Instruct is the recommended free-tier model — warm, fast, capable tiebreaker.
  const model    = node.model || 'deepseek-ai/DeepSeek-R1';
  const provider = node.hfProvider || 'auto';     // 'auto' lets HF pick available provider
  const url      = 'https://router.huggingface.co/v1/chat/completions';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${node.apiKey}`,
      },
      body: JSON.stringify({
        model:       `${model}:${provider}`,
        messages: [
          { role: 'system', content: systemPrompt || defaultSystemPrompt(node) },
          { role: 'user',   content: intent },
        ],
        max_tokens:  512,
        temperature: 0.4,
        stream:      false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      // Common causes:
      //   401 → invalid or missing HF token
      //   403 → model requires Pro subscription or provider not available on free tier
      //   404 → model:provider combination doesn't exist — try ':nebius' or ':auto'
      //   503 → provider overloaded — retry or switch provider suffix
      throw new Error(`HuggingFace ${r.status}: ${err?.error?.message || err?.error || r.statusText}`);
    }
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || null;
  } catch(e) {
    return { error: e.message };
  }
}

async function callOllama(node, intent, systemPrompt) {
  const base = node.baseUrl || 'http://localhost:11434';
  const body = {
    model:  node.model || 'llama3.2:1b',
    prompt: `${systemPrompt || defaultSystemPrompt(node)}\n\nUser: ${intent}\nAssistant:`,
    stream: false,
  };
  try {
    const r = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),  // local inference latency varies
    });
    if (!r.ok) throw new Error(`Ollama ${r.status}`);
    const d = await r.json();
    return d.response?.trim() || null;
  } catch(e) {
    return { error: e.message };
  }
}

function defaultSystemPrompt(node) {
  return `You are ${node.name}, specialising in ${node.specialty}. `
    + `Respond clearly and concisely. Do not mention that you are an AI unless directly asked.`;
}

/**
 * Dispatch to the correct adapter based on node.provider.
 * Returns { text, latency, model, error? }
 */
export async function callModel(node, intent, systemPrompt = null) {
  const t0 = Date.now();
  let result;

  switch (node.provider) {
    case 'groq':    result = await callGroq(node, intent, systemPrompt);     break;
    case 'gemini':  result = await callGemini(node, intent, systemPrompt);   break;
    case 'mistral': result = await callMistralHF(node, intent, systemPrompt); break;
    case 'ollama':  result = await callOllama(node, intent, systemPrompt);   break;
    default:
      result = { error: `Unknown provider: ${node.provider}` };
  }

  const latency = Date.now() - t0;

  if (result && typeof result === 'object' && result.error) {
    return { text: null, latency, model: node.name, error: result.error };
  }
  return { text: result, latency, model: node.name, error: null };
}

// ── Dissonance measurement ────────────────────────────────────────────────────
/**
 * Measure semantic distance between two model outputs.
 * Uses the same n-gram similarity as the scoring engine.
 *
 * Returns float [0, 1]:
 *   0.0  = identical meaning
 *   0.35 = same topic, different emphasis (AGREE threshold)
 *   0.60 = meaningfully different answers (WARN threshold)
 *   1.0  = completely unrelated
 *
 * Note: n-gram similarity is an approximation. For production use,
 * replace with embedding cosine distance from the cortex /resonate
 * endpoint. The interface contract is identical.
 */
export function measureDissonance(textA, textB) {
  if (!textA || !textB) return 0;

  const a = textA.trim();
  const b = textB.trim();

  // Short-response subsumption check.
  // If one response is short (≤ 60 chars) and is contained within the other,
  // the models are saying the same thing with different verbosity.
  // e.g. "Paris." vs "The capital of France is Paris." → agreement.
  const shorter = a.length <= b.length ? a : b;
  const longer  = a.length <= b.length ? b : a;
  if (shorter.length <= 60) {
    const core = shorter.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (core.length >= 2 && longer.toLowerCase().includes(core)) {
      return 0;  // subsumption → treat as full agreement
    }
  }

  return 1 - semanticSim(a, b);
}

// ── Synaptic bond update ──────────────────────────────────────────────────────
function formBond(prev, winner) {
  if (!prev || prev.id === winner.id) return;
  prev.bonds[winner.id] = (prev.bonds[winner.id] || 0) + 0.05;
}

// ── Main deliberation pipeline ────────────────────────────────────────────────
/**
 * deliberate(intent, pool, options?) → DelibeResult
 *
 * The full tiered pipeline:
 *   1. Score all nodes → select Tier 1A and Tier 1B winners
 *   2. Call T1A and T1B in parallel
 *   3. Measure output dissonance
 *   4a. Agree (dissonance < AGREE) → synthesise, return early
 *   4b. Warn  (dissonance < WARN)  → return with low confidence flag
 *   4c. Conflict                   → escalate to Tier 2 tiebreaker
 *   5. Tier 2 resolves or reports contradiction
 *
 * Options:
 *   systemPrompt  string   — override default system prompt for all calls
 *   chain         string[] — prior node IDs for bond signal calculation
 *   vectorBoosts  number[] — relative cortex boosts, aligned with pool
 *   onProgress    fn       — callback({ stage, node?, partial? }) for streaming UI
 *
 * Returns DelibeResult:
 *   output        string   — the synthesised response to show the user
 *   confidence    number   — [0, 1] how much the models agreed
 *   winner        LLMNode  — the node whose response led the synthesis
 *   contributions array    — [{ node, text, latency, scored, used }]
 *   dissonance    number   — measured distance between T1 outputs
 *   escalated     boolean  — whether Tier 2 was invoked
 *   error         string?  — set if all models failed
 */
export async function deliberate(intent, pool, options = {}) {
  const {
    systemPrompt = null,
    chain        = [],
    vectorBoosts = [],
    onProgress   = null,
  } = options;

  const emit = (stage, data = {}) => {
    if (onProgress) onProgress({ stage, ...data });
  };

  // ── 0. Validate ────────────────────────────────────────────────────────────
  const activeTier1 = pool.filter(n => n.tier === 1 && n.apiKey);
  const activeTier2 = pool.filter(n => n.tier === 2 && n.apiKey);

  if (activeTier1.length === 0) {
    return _errorResult('No Tier 1 models configured. Add at least one API key.');
  }

  // ── 1. Score pool ──────────────────────────────────────────────────────────
  emit('scoring');
  const scored = scorePool(intent, pool, chain, vectorBoosts);
  const t1Scored = scored.filter(s => s.node.tier === 1);

  const topA = t1Scored[0]?.node;
  const topB = t1Scored[1]?.node;  // may be undefined if only one T1 model

  emit('routing', { topA: topA?.name, topB: topB?.name });

  const contributions = [];

  // ── 2. Call Tier 1 models in parallel ─────────────────────────────────────
  emit('calling_t1');

  const t1Calls = [topA, topB].filter(Boolean).map(node =>
    callModel(node, intent, systemPrompt).then(result => ({ node, ...result }))
  );

  const t1Results = await Promise.all(t1Calls);

  t1Results.forEach(r => {
    contributions.push({
      node:    r.node,
      text:    r.text,
      latency: r.latency,
      scored:  scored.find(s => s.node === r.node),
      used:    !r.error,
      error:   r.error,
    });
  });

  const resultA = t1Results[0];
  const resultB = t1Results[1];

  // Handle complete T1 failure
  const t1Success = t1Results.filter(r => r.text && !r.error);
  if (t1Success.length === 0) {
    return _errorResult(
      'All Tier 1 models failed. ' +
      t1Results.map(r => `${r.node.name}: ${r.error}`).join(' | ')
    );
  }

  // Only one T1 model responded — return it directly, no dissonance possible
  if (t1Success.length === 1) {
    const sole = t1Success[0];
    sole.node.ignite();
    formBond(chain.length ? pool.find(n => n.id === chain[chain.length - 1]) : null, sole.node);
    return {
      output:        sole.text,
      confidence:    0.6,          // moderate — no agreement check was possible
      winner:        sole.node,
      contributions,
      dissonance:    null,
      escalated:     false,
      error:         null,
    };
  }

  // ── 3. Measure dissonance between T1 outputs ───────────────────────────────
  emit('measuring_dissonance');
  const dissonance = measureDissonance(resultA.text, resultB.text);
  emit('dissonance_result', { dissonance, threshold: DISSONANCE_AGREE });

  // ── 4a. Agreement — early exit ─────────────────────────────────────────────
  if (dissonance <= DISSONANCE_AGREE) {
    // Both models agree — winner is the higher-scored T1 node
    const winner = topA;
    winner.ignite();
    topB?.ignite();
    formBond(chain.length ? pool.find(n => n.id === chain[chain.length - 1]) : null, winner);

    const output = _synthesise(resultA.text, resultB.text, dissonance);
    return {
      output,
      confidence:    _confidence(dissonance),
      winner,
      contributions,
      dissonance,
      escalated:     false,
      error:         null,
    };
  }

  // ── 4b. Low-level disagreement — return with warning, no T2 needed ─────────
  if (dissonance <= DISSONANCE_WARN) {
    const winner = topA;          // higher-scored T1 wins
    winner.ignite();
    const output = _synthesise(resultA.text, resultB.text, dissonance);
    return {
      output,
      confidence:    _confidence(dissonance),
      winner,
      contributions,
      dissonance,
      escalated:     false,
      warning:       `Models partially disagreed (dissonance ${dissonance.toFixed(2)}). `
                   + `Showing best-scored response.`,
      error:         null,
    };
  }

  // ── 4c. High dissonance — escalate to Tier 2 ──────────────────────────────
  emit('escalating_t2', { dissonance });

  if (activeTier2.length === 0) {
    // No Tier 2 available — apply grief to both T1 nodes, return T1 winner
    // with a contradiction flag so the UI can surface it
    topA.grieve();
    topB.grieve();
    return {
      output:        resultA.text,  // T1A wins by score order
      confidence:    0.2,
      winner:        topA,
      contributions,
      dissonance,
      escalated:     false,
      contradiction: true,
      warning:       `Models strongly disagreed (dissonance ${dissonance.toFixed(2)}). `
                   + `No Tier 2 model available for tiebreaking. `
                   + `Showing highest-scored response — verify independently.`,
      error:         null,
    };
  }

  // Score Tier 2 nodes and pick the best match
  const t2Scored = scored.filter(s => s.node.tier === 2);
  const topT2    = t2Scored[0]?.node;

  emit('calling_t2', { model: topT2.name });
  const t2Result = await callModel(topT2, intent, systemPrompt);

  contributions.push({
    node:    topT2,
    text:    t2Result.text,
    latency: t2Result.latency,
    scored:  t2Scored[0],
    used:    !t2Result.error,
    error:   t2Result.error,
  });

  if (!t2Result.text || t2Result.error) {
    // T2 failed — fall back to T1 winner with warning
    topA.grieve(0.02);
    topB.grieve(0.02);
    return {
      output:        resultA.text,
      confidence:    0.25,
      winner:        topA,
      contributions,
      dissonance,
      escalated:     true,
      warning:       `Tier 2 escalation failed (${t2Result.error}). Returning Tier 1 winner.`,
      error:         null,
    };
  }

  // ── 5. T2 tiebreaking ─────────────────────────────────────────────────────
  const dissonanceAT2 = measureDissonance(resultA.text, t2Result.text);
  const dissonanceBT2 = measureDissonance(resultB.text, t2Result.text);

  emit('t2_resolution', { dissonanceAT2, dissonanceBT2 });

  let winner, loser, winnerResult;

  if (dissonanceAT2 <= dissonanceBT2) {
    // T2 agrees more with T1A
    winner = topA;   loser = topB;   winnerResult = resultA;
  } else {
    // T2 agrees more with T1B
    winner = topB;   loser = topA;   winnerResult = resultB;
  }

  winner.ignite();
  loser.grieve(0.03);
  topT2.ignite();
  formBond(chain.length ? pool.find(n => n.id === chain[chain.length - 1]) : null, winner);

  // Synthesise from winner + T2 (they agree)
  const output = _synthesise(winnerResult.text, t2Result.text, Math.min(dissonanceAT2, dissonanceBT2));

  return {
    output,
    confidence:    _confidence(Math.min(dissonanceAT2, dissonanceBT2)),
    winner,
    tiebreaker:    topT2,
    contributions,
    dissonance,
    escalated:     true,
    error:         null,
  };
}

// ── Synthesis helpers ─────────────────────────────────────────────────────────
/**
 * Synthesise two agreeing responses into one.
 * Strategy: when dissonance is very low, return the longer response
 * (tends to be more complete). When dissonance is moderate, return
 * the first response (higher-scored model).
 *
 * v0.2 target: use an LLM call to actually synthesise the two responses
 * into a unified answer rather than selecting one. For now, selection
 * is the correct MVP choice — it avoids adding latency for a marginal
 * quality improvement at this stage.
 */
function _synthesise(textA, textB, dissonance) {
  if (!textA) return textB;
  if (!textB) return textA;
  // Very close agreement — pick the more complete response
  if (dissonance < 0.15) {
    return textA.length >= textB.length ? textA : textB;
  }
  // Moderate agreement — trust the higher-scored model (textA = T1A winner)
  return textA;
}

/** Map dissonance [0,1] to confidence [0,1] — inverse relationship. */
function _confidence(dissonance) {
  return Math.max(0, Math.min(1, 1 - dissonance * 1.4));
}

function _errorResult(message) {
  return {
    output:        null,
    confidence:    0,
    winner:        null,
    contributions: [],
    dissonance:    null,
    escalated:     false,
    error:         message,
  };
}

// ── Pool builder ──────────────────────────────────────────────────────────────
/**
 * Default pool for zero-budget initial deployment.
 * All three models are free-tier accessible.
 * User supplies API keys via configuration UI.
 *
 * Specialty strings are the LLM equivalent of semantic seeds.
 * They govern which model wins on which intent type.
 * These are the strings to iterate on during testing.
 */
export function buildDefaultPool(keys = {}) {
  return [
    new LLMNode({
      name:      'Groq Llama 3.1',
      provider:  'groq',
      model:     'llama-3.1-8b-instant',
      specialty: 'fast factual retrieval summarisation concise answer general knowledge lookup quick response data fact',
      tier:      1,
      apiKey:    keys.groq || '',
      warmth:    0.6,
      resonance: 1.2,
    }),
    new LLMNode({
      name:      'Gemini Flash',
      provider:  'gemini',
      model:     'gemini-2.5-flash',
      specialty: 'reasoning analysis explain science ethics philosophy context synthesis creative writing nuanced understanding deep explanation',
      tier:      1,
      apiKey:    keys.gemini || '',
      warmth:    0.6,
      resonance: 1.2,
    }),
    new LLMNode({
      name:      'DeepSeek R1',
      provider:  'mistral',
      model:     'deepseek-ai/DeepSeek-R1',
      specialty: 'code generation technical explanation structured output logical reasoning ethical analysis multilingual',
      tier:      2,
      apiKey:    keys.huggingface || '',
      warmth:    0.4,
      resonance: 1.0,
    }),
  ];
}

// ── Persistence helpers ───────────────────────────────────────────────────────
/**
 * Serialise pool state (warmth, resonance, reliability, bonds) to a plain
 * JSON string. The application layer is responsible for storing this string
 * wherever is appropriate for its environment (localStorage, a file, a DB).
 * API keys are intentionally NOT included — they are injected at runtime.
 *
 * Usage (browser application layer):
 *   localStorage.setItem('BOSS_ENGINE_POOL', savePool(pool));
 *
 * Usage (Node.js application layer):
 *   fs.writeFileSync('pool.json', savePool(pool));
 */
export function savePool(pool) {
  return JSON.stringify({ nodes: pool.map(n => n.toJSON()), saved: Date.now() });
}

/**
 * Deserialise pool state from a JSON string produced by savePool().
 * The application layer is responsible for reading the string from
 * wherever it was stored. Re-injects API keys from the keys map.
 *
 * Usage (browser application layer):
 *   const pool = loadPool(localStorage.getItem('BOSS_ENGINE_POOL'), keys);
 *
 * Usage (Node.js application layer):
 *   const pool = loadPool(fs.readFileSync('pool.json', 'utf8'), keys);
 *
 * Returns null if the input is null, undefined, or unparseable.
 */
export function loadPool(serialised, keys = {}) {
  if (!serialised) return null;
  try {
    const { nodes } = JSON.parse(serialised);
    return nodes.map(d => LLMNode.fromJSON(d, keys[d.provider] || '', d.baseUrl || ''));
  } catch(_) { return null; }
}

// ── Public API summary ────────────────────────────────────────────────────────
export default {
  version:          ENGINE_VERSION,
  semanticSim,
  LLMNode,
  scorePool,
  callModel,
  measureDissonance,
  deliberate,
  buildDefaultPool,
  savePool,         // returns JSON string — caller handles storage
  loadPool,         // accepts JSON string — caller handles retrieval
  DISSONANCE_AGREE,
  DISSONANCE_WARN,
};
