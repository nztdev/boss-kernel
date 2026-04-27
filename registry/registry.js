/**
 * B.O.S.S. Registry — registry/registry.js
 * ==========================================
 * github.com/nztdev/boss-kernel
 *
 * The Registry is the single source of truth for node definitions,
 * model definitions, and accumulated reliability data in a BOSS instance.
 *
 * It replaces scattered constants (ACTION_MAP, ACTIVE_NODES, seed array)
 * with a structured, inspectable, runtime-editable catalogue.
 *
 * Architecture:
 *   - Local-first: initialises from localStorage, works fully offline
 *   - Cortex-sync: when Cortex is online, syncs with server-side copy
 *   - Additive: existing components continue to work during migration
 *
 * Interface:
 *   Registry.init()                    — load from localStorage or defaults
 *   Registry.getNode(name)             — get node definition by name
 *   Registry.getAllNodes()             — get all node definitions
 *   Registry.addNode(def)              — add a new node (Birth Protocol)
 *   Registry.updateNode(name, patch)   — update node fields
 *   Registry.getModel(id)             — get engine model definition
 *   Registry.getAllModels()            — get all model definitions
 *   Registry.recordEvent(event)        — accumulate reliability metrics
 *   Registry.save()                   — persist to localStorage
 *   Registry.sync(cortexUrl)          — sync with Cortex server
 *   Registry.export()                 — return full registry as plain object
 *
 * localStorage key: 'BOSS_REGISTRY'
 */

const REGISTRY_KEY     = 'BOSS_REGISTRY';
const REGISTRY_VERSION = '1.0.0';

// ── Default node definitions ──────────────────────────────────────────────────
// These are the canonical seed definitions. They populate the Registry on
// first boot and serve as the fallback if Registry data is corrupt.
// Specialty strings must match index.html seeds exactly — they are the
// same semantic anchors used by the scoring engine.

const DEFAULT_NODES = [
  {
    name:         'CORE',
    specialty:    'health battery power status diagnostics system reboot uptime integrity vitals',
    color:        '#00ffcc',
    resonance:    2.0,
    tier:         'passive',
    hasAction:    false,
    actionType:   null,
    capabilities: ['system_query', 'diagnostics', 'battery_monitor'],
    description:  'System health, diagnostics, and vitals monitoring.',
  },
  {
    name:         'SOMA',
    specialty:    'identity self who soma appearance theme ui somatic personality profile customise',
    color:        '#ff66aa',
    resonance:    1.8,
    tier:         'active',
    hasAction:    true,
    actionType:   'interface',
    capabilities: ['theme_change', 'personality_response', 'identity_query'],
    description:  'Identity, interface appearance, and somatic self-representation.',
  },
  {
    name:         'CORTEX',
    specialty:    'ai logic intelligence think reason analyse evaluate process decide infer',
    color:        '#cc00ff',
    resonance:    1.6,
    tier:         'passive',
    hasAction:    false,
    actionType:   null,
    capabilities: ['reasoning', 'analysis', 'inference'],
    description:  'Logical reasoning, analysis, and cognitive processing.',
  },
  {
    name:         'MEMORY',
    specialty:    'recall retrieve stored information data records vault database archive remember',
    color:        '#66aaff',
    resonance:    1.5,
    tier:         'passive',
    hasAction:    false,
    actionType:   null,
    capabilities: ['vault_read', 'vault_write', 'recall'],
    description:  'Episodic memory, retrieval, and information storage.',
  },
  {
    name:         'MEDIA',
    specialty:    'music sound audio playback play volume track song speaker listen headphones',
    color:        '#00F0FF',
    resonance:    1.4,
    tier:         'active',
    hasAction:    true,
    actionType:   'audio',
    capabilities: ['audio_play', 'audio_pause', 'volume_control', 'track_info'],
    description:  'Audio playback, music control, and sensory output.',
  },
  {
    name:         'CHRONOS',
    specialty:    'time schedule clock calendar timer alarm duration elapsed long countdown remind when set running active',
    color:        '#ffaa00',
    resonance:    1.3,
    tier:         'active',
    hasAction:    true,
    actionType:   'temporal',
    capabilities: ['timer_set', 'alarm_set', 'schedule_query', 'countdown'],
    description:  'Temporal management, timers, alarms, and scheduling.',
  },
];

// ── Default model definitions ─────────────────────────────────────────────────
// Engine pool LLM nodes. These mirror buildDefaultPool() in engine.js
// but live in the Registry so they can be inspected and modified at runtime.

const DEFAULT_MODELS = [
  {
    id:        'groq-llama',
    name:      'Groq Llama 3.1',
    provider:  'groq',
    model:     'llama-3.1-8b-instant',
    specialty: 'fast factual retrieval summarisation concise answer general knowledge lookup quick response data fact',
    tier:      1,
    warmth:    0.6,
    resonance: 1.2,
    description: 'Fast factual retrieval. T1 primary model.',
  },
  {
    id:        'gemini-flash',
    name:      'Gemini Flash',
    provider:  'gemini',
    model:     'gemini-2.5-flash',
    specialty: 'reasoning analysis explain science ethics philosophy context synthesis creative writing nuanced understanding deep explanation',
    tier:      1,
    warmth:    0.6,
    resonance: 1.2,
    description: 'Deep reasoning and creative synthesis. T1 primary model.',
  },
  {
    id:        'deepseek-r1',
    name:      'DeepSeek R1',
    provider:  'mistral',
    model:     'deepseek-ai/DeepSeek-R1',
    specialty: 'code generation technical explanation structured output logical reasoning ethical analysis multilingual',
    tier:      2,
    warmth:    0.4,
    resonance: 1.0,
    description: 'Reasoning tiebreaker via HuggingFace SambaNova. T2 escalation model.',
  },
];

// ── Registry ──────────────────────────────────────────────────────────────────
export const Registry = {
  _nodes:   {},   // name → node definition + runtime metrics
  _models:  {},   // id   → model definition + runtime metrics
  _meta:    {},   // registry-level metadata
  _dirty:   false,

  // ── Initialisation ───────────────────────────────────────────────────────────
  init() {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (raw) {
      try {
        const stored = JSON.parse(raw);
        if (stored.version === REGISTRY_VERSION) {
          this._nodes  = stored.nodes  || {};
          this._models = stored.models || {};
          this._meta   = stored.meta   || {};
          this._ensureDefaults();
          return;
        }
        // Version mismatch — migrate defaults in, preserve runtime metrics
        console.warn('[Registry] Version mismatch — migrating to', REGISTRY_VERSION);
        this._nodes  = stored.nodes  || {};
        this._models = stored.models || {};
        this._meta   = stored.meta   || {};
      } catch(_) {
        console.warn('[Registry] Corrupt data — resetting to defaults');
      }
    }
    this._loadDefaults();
  },

  _loadDefaults() {
    this._nodes  = {};
    this._models = {};
    this._meta   = { created: Date.now(), instanceId: this._generateId() };
    DEFAULT_NODES.forEach(n  => { this._nodes[n.name]  = this._nodeEntry(n);  });
    DEFAULT_MODELS.forEach(m => { this._models[m.id]   = this._modelEntry(m); });
    this.save();
  },

  _ensureDefaults() {
    // Add any new default nodes/models not present in stored registry
    DEFAULT_NODES.forEach(n => {
      if (!this._nodes[n.name]) {
        this._nodes[n.name] = this._nodeEntry(n);
        this._dirty = true;
      }
    });
    DEFAULT_MODELS.forEach(m => {
      if (!this._models[m.id]) {
        this._models[m.id] = this._modelEntry(m);
        this._dirty = true;
      }
    });
    if (this._dirty) this.save();
  },

  _nodeEntry(def) {
    return {
      ...def,
      // Runtime metrics — accumulated by Immune System via recordEvent()
      metrics: {
        totalFires:          0,
        totalGriefs:         0,
        arbiterInvolvement:  0,
        engineEscalations:   0,
        reliability:         1.0,
        lastFired:           null,
        lastGrieved:         null,
        created:             Date.now(),
      },
    };
  },

  _modelEntry(def) {
    return {
      ...def,
      metrics: {
        successCount:  0,
        failCount:     0,
        totalLatencyMs: 0,
        avgLatencyMs:  0,
        reliability:   1.0,
        suspended:     false,
        lastUsed:      null,
        created:       Date.now(),
      },
    };
  },

  _generateId() {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  },

  // ── Node access ───────────────────────────────────────────────────────────────
  getNode(name) {
    return this._nodes[name.toUpperCase()] || null;
  },

  getAllNodes() {
    return Object.values(this._nodes);
  },

  getActiveNodeNames() {
    return Object.values(this._nodes)
      .filter(n => n.hasAction)
      .map(n => n.name);
  },

  /**
   * Add a new node — called by Birth Protocol when user confirms node creation.
   * The node is added to the Registry and the Soma creates a Node instance from it.
   */
  addNode(def) {
    const name = def.name.toUpperCase().slice(0, 10);
    if (this._nodes[name]) {
      console.warn(`[Registry] Node ${name} already exists`);
      return false;
    }
    this._nodes[name] = this._nodeEntry({ ...def, name });
    this._dirty = true;
    this.save();
    return true;
  },

  updateNode(name, patch) {
    const key = name.toUpperCase();
    if (!this._nodes[key]) return false;
    Object.assign(this._nodes[key], patch);
    this._dirty = true;
    this.save();
    return true;
  },

  // ── Model access ──────────────────────────────────────────────────────────────
  getModel(id) {
    return this._models[id] || null;
  },

  getAllModels() {
    return Object.values(this._models);
  },

  getActiveModels() {
    return Object.values(this._models).filter(m => !m.metrics.suspended);
  },

  // ── Reliability metrics ───────────────────────────────────────────────────────
  /**
   * Called by the Immune System (via Nervous System events) to accumulate metrics.
   * Does not apply reliability scores — that's the Immune System's job.
   * Registry only stores what happened — Immune System decides what it means.
   */
  recordEvent(event) {
    const { type, node, modelId, latencyMs } = event;

    if (node) {
      const n = this._nodes[node.toUpperCase()];
      if (n) {
        switch (type) {
          case 'NODE_FIRED':
            n.metrics.totalFires++;
            n.metrics.lastFired = Date.now();
            break;
          case 'NODE_GRIEVED':
            n.metrics.totalGriefs++;
            n.metrics.lastGrieved = Date.now();
            break;
          case 'ARBITER_CONFLICT':
            n.metrics.arbiterInvolvement++;
            break;
          case 'ENGINE_ESCALATED':
            n.metrics.engineEscalations++;
            break;
        }
        this._dirty = true;
      }
    }

    if (modelId) {
      const m = this._models[modelId];
      if (m) {
        switch (type) {
          case 'MODEL_SUCCESS':
            m.metrics.successCount++;
            m.metrics.lastUsed = Date.now();
            if (latencyMs) {
              m.metrics.totalLatencyMs += latencyMs;
              m.metrics.avgLatencyMs = Math.round(
                m.metrics.totalLatencyMs / m.metrics.successCount
              );
            }
            break;
          case 'MODEL_FAIL':
            m.metrics.failCount++;
            break;
          case 'MODEL_SUSPENDED':
            m.metrics.suspended = true;
            break;
          case 'MODEL_RESTORED':
            m.metrics.suspended = false;
            break;
        }
        this._dirty = true;
      }
    }

    // Debounce saves — only persist every 5 events or on explicit save()
    if (this._dirty && (this._eventCount = (this._eventCount || 0) + 1) % 5 === 0) {
      this.save();
    }
  },

  /**
   * Called by Immune System to update computed reliability scores.
   * Reliability is written back to the node/model for the Soma to read.
   */
  setReliability(name, score, isModel = false) {
    const target = isModel ? this._models[name] : this._nodes[name.toUpperCase()];
    if (target) {
      target.metrics.reliability = Math.max(0, Math.min(1, score));
      this._dirty = true;
    }
  },

  // ── Persistence ───────────────────────────────────────────────────────────────
  save() {
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify({
        version: REGISTRY_VERSION,
        nodes:   this._nodes,
        models:  this._models,
        meta:    { ...this._meta, lastSaved: Date.now() },
      }));
      this._dirty = false;
    } catch(e) {
      console.error('[Registry] Save failed:', e);
    }
  },

  // ── Cortex sync ───────────────────────────────────────────────────────────────
  /**
   * Sync with Cortex /registry endpoint.
   * Strategy: last-write-wins per node. Cortex is authoritative for nodes
   * it knows about; Soma is authoritative for nodes it created locally.
   * Nodes created on the Soma that the Cortex doesn't know about are pushed up.
   * Nodes the Cortex has that the Soma doesn't are pulled down.
   */
  async sync(cortexUrl) {
    if (!cortexUrl) return;
    try {
      // Pull from Cortex
      const r = await fetch(`${cortexUrl}/registry`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!r.ok) return;
      const remote = await r.json();

      // Merge nodes — remote wins on conflict for server-side nodes
      if (remote.nodes) {
        Object.entries(remote.nodes).forEach(([name, def]) => {
          if (!this._nodes[name]) {
            // New node from Cortex — add it
            this._nodes[name] = def;
            this._dirty = true;
          }
          // Existing nodes: preserve local metrics, update definition if newer
          else if (def.updatedAt > (this._nodes[name].updatedAt || 0)) {
            this._nodes[name] = { ...def, metrics: this._nodes[name].metrics };
            this._dirty = true;
          }
        });
      }

      // Push local-only nodes to Cortex
      const localOnly = Object.entries(this._nodes)
        .filter(([name]) => !remote.nodes?.[name])
        .reduce((acc, [name, def]) => ({ ...acc, [name]: def }), {});

      if (Object.keys(localOnly).length) {
        await fetch(`${cortexUrl}/registry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes: localOnly }),
          signal: AbortSignal.timeout(3000),
        });
      }

      if (this._dirty) this.save();

    } catch(e) {
      // Sync failure is silent — Soma continues with local Registry
      console.warn('[Registry] Sync failed:', e.message);
    }
  },

  // ── Export ────────────────────────────────────────────────────────────────────
  export() {
    return {
      version: REGISTRY_VERSION,
      nodes:   { ...this._nodes },
      models:  { ...this._models },
      meta:    { ...this._meta },
    };
  },
};
