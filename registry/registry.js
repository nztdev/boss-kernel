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
const REGISTRY_VERSION = '1.1.0';  // added preset schema and intent source model

// ── Intent source types ───────────────────────────────────────────────────────
// All intent inputs are normalised to this structure before routing.
// Source is metadata — the kernel physics are source-agnostic.
export const INTENT_SOURCE = {
  CHAT:    'chat',     // typed text input (current)
  TAP:     'tap',     // node tap / orbital preset tap
  VOICE:   'voice',   // voice input (sensory layer, future)
  HABIT:   'habit',   // scheduled/pattern-triggered (future)
  VITALS:  'vitals',  // biometric-triggered (future)
  PRESET:  'preset',  // fired from a saved preset directly
};

/**
 * Canonical intent object structure.
 * All intent sources produce this shape before entering the kernel.
 * @typedef {Object} BossIntent
 * @property {string}   text       — the intent string
 * @property {string}   source     — one of INTENT_SOURCE
 * @property {string[]} nodeHints  — explicit node targets (multi-node tap)
 * @property {string}   presetId   — set when source === 'preset'
 */

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
    specialty:    'identity self who what soma appearance theme colour color switch style skin palette ui somatic personality profile customise mood feeling state crimson amber violet ice solar',
    color:        '#ff66aa',
    resonance:    1.8,
    tier:         'active',
    hasAction:    true,
    actionType:   'interface',
    capabilities: ['theme_change', 'personality_response', 'identity_query', 'theme_list', 'colour_change'],
    description:  'Identity, interface appearance, personality, and somatic self-representation.',
  },
  {
    name:         'CORTEX',
    specialty:    'ai logic intelligence think reason analyse explain evaluate process decide infer breakdown examine what is how does why',
    color:        '#cc00ff',
    resonance:    1.6,
    tier:         'active',
    hasAction:    true,
    actionType:   'reasoning',
    capabilities: ['reasoning', 'analysis', 'inference', 'explain', 'engine_query', 'pool_status'],
    description:  'Logical reasoning, analysis, explanation, and deliberation engine interface.',
  },
  {
    name:         'MEMORY',
    specialty:    'recall retrieve stored information data records vault database archive remember forget store memorize note list memories what do you remember',
    color:        '#66aaff',
    resonance:    1.5,
    tier:         'active',
    hasAction:    true,
    actionType:   'memory',
    capabilities: ['vault_read', 'vault_write', 'vault_forget', 'vault_status', 'vault_export', 'recall'],
    description:  'Episodic memory — vault retrieval, storage, forgetting, and inspection.',
  },
  {
    name:         'MEDIA',
    specialty:    'music sound audio playback play pause stop mute volume track song speaker listen headphones photo image picture video visual show display watch screen gallery wallpaper stream playing',
    color:        '#00F0FF',
    resonance:    1.4,
    tier:         'active',
    hasAction:    true,
    actionType:   'sensory',
    capabilities: [
      // Audio
      'audio_play', 'audio_pause', 'audio_stop', 'volume_control',
      'track_info', 'audio_search', 'audio_next', 'audio_prev',
      // Visual
      'image_display', 'image_search', 'photo_open', 'wallpaper_set',
      // Video
      'video_play', 'video_embed', 'video_open',
      // General
      'media_status', 'media_cancel',
    ],
    description:  'Full sensory output layer — audio, images, and video.',
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

// ── Default preset definitions ───────────────────────────────────────────────
// Presets are pre-resolved intent-action mappings.
// No deliberation at fire time — actions array is executed directly.
// source: 'default' = built-in, 'user' = created via Birth Protocol.
// Modular by design — fields can be extended without breaking existing presets.

const DEFAULT_PRESETS = [
  // ── CHRONOS presets ────────────────────────────────────────────────────────
  {
    id:         'chronos_timer_5m',
    label:      '5 min timer',
    icon:       '⏱',
    nodes:      ['CHRONOS'],
    intent:     'set a timer for 5 minutes',
    actions:    [{ node: 'CHRONOS', command: 'timer', params: { ms: 300000, label: '5 minutes' } }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['timer', 'quick'],
  },
  {
    id:         'chronos_timer_25m',
    label:      '25 min timer',
    icon:       '🍅',
    nodes:      ['CHRONOS'],
    intent:     'set a timer for 25 minutes',
    actions:    [{ node: 'CHRONOS', command: 'timer', params: { ms: 1500000, label: '25 minutes' } }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['timer', 'pomodoro', 'focus'],
  },
  {
    id:         'chronos_remind_morning',
    label:      'Remind tomorrow',
    icon:       '⏰',
    nodes:      ['CHRONOS'],
    intent:     'remind me tomorrow morning',
    actions:    [{ node: 'CHRONOS', command: 'alarm', params: { label: 'tomorrow morning' } }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['alarm', 'morning', 'reminder'],
  },

  // ── MEDIA presets ──────────────────────────────────────────────────────────
  {
    id:         'media_play',
    label:      'Play music',
    icon:       '▶',
    nodes:      ['MEDIA'],
    intent:     'play music',
    actions:    [{ node: 'MEDIA', command: 'audio', params: { action: 'play' } }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['audio', 'music'],
  },
  {
    id:         'media_pause',
    label:      'Pause',
    icon:       '⏸',
    nodes:      ['MEDIA'],
    intent:     'pause',
    actions:    [{ node: 'MEDIA', command: 'audio', params: { action: 'pause' } }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['audio', 'pause'],
  },
  {
    id:         'media_status',
    label:      "What's playing",
    icon:       '🎵',
    nodes:      ['MEDIA'],
    intent:     'whats playing',
    actions:    [{ node: 'MEDIA', command: 'status', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['audio', 'status'],
  },

  // ── SOMA presets ───────────────────────────────────────────────────────────
  {
    id:         'soma_identity',
    label:      'Who are you',
    icon:       '🧠',
    nodes:      ['SOMA'],
    intent:     'who are you',
    actions:    [{ node: 'SOMA', command: 'identity', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['identity', 'self'],
  },
  {
    id:         'soma_mood',
    label:      'How are you',
    icon:       '💫',
    nodes:      ['SOMA'],
    intent:     'how are you',
    actions:    [{ node: 'SOMA', command: 'personality', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['personality', 'mood'],
  },
  {
    id:         'soma_themes',
    label:      'List themes',
    icon:       '🎨',
    nodes:      ['SOMA'],
    intent:     'list themes',
    actions:    [{ node: 'SOMA', command: 'theme_list', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['theme', 'appearance'],
  },

  // ── CORE presets ───────────────────────────────────────────────────────────
  {
    id:         'core_status',
    label:      'System status',
    icon:       '💻',
    nodes:      ['CORE'],
    intent:     'check system status',
    actions:    [{ node: 'CORE', command: 'status', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['system', 'status'],
  },
  {
    id:         'core_battery',
    label:      'Battery level',
    icon:       '🔋',
    nodes:      ['CORE'],
    intent:     'check battery level',
    actions:    [{ node: 'CORE', command: 'battery', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['battery', 'power'],
  },

  // ── MEMORY presets ─────────────────────────────────────────────────────────
  {
    id:         'memory_recall',
    label:      'What do you remember',
    icon:       '🧬',
    nodes:      ['MEMORY'],
    intent:     'what do you remember',
    actions:    [{ node: 'MEMORY', command: 'recall', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['memory', 'recall'],
  },
  {
    id:         'memory_remember',
    label:      'Remember this',
    icon:       '📌',
    nodes:      ['MEMORY'],
    intent:     'remember this',
    actions:    [{ node: 'MEMORY', command: 'store', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['memory', 'store'],
  },

  // ── CORTEX presets ─────────────────────────────────────────────────────────
  {
    id:         'cortex_analyse',
    label:      'Analyse this',
    icon:       '🔬',
    nodes:      ['CORTEX'],
    intent:     'analyse this',
    actions:    [{ node: 'CORTEX', command: 'analyse', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['reasoning', 'analysis'],
  },
  {
    id:         'cortex_explain',
    label:      'Explain this',
    icon:       '💡',
    nodes:      ['CORTEX'],
    intent:     'explain this',
    actions:    [{ node: 'CORTEX', command: 'explain', params: {} }],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['reasoning', 'explain'],
  },

  // ── Compound presets (multi-node) ──────────────────────────────────────────
  {
    id:         'compound_work_session',
    label:      'Work session',
    icon:       '💼',
    nodes:      ['MEDIA', 'CHRONOS'],
    intent:     'play focus music and set a 25 minute timer',
    actions:    [
      { node: 'MEDIA',   command: 'audio', params: { action: 'play' } },
      { node: 'CHRONOS', command: 'timer', params: { ms: 1500000, label: '25 minutes' } },
    ],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['compound', 'focus', 'work'],
  },
  {
    id:         'compound_morning_check',
    label:      'Morning check',
    icon:       '🌅',
    nodes:      ['CORE', 'CHRONOS'],
    intent:     'check system status and what is scheduled today',
    actions:    [
      { node: 'CORE',    command: 'status',  params: {} },
      { node: 'CHRONOS', command: 'schedule', params: {} },
    ],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['compound', 'morning', 'routine'],
  },
  {
    id:         'compound_wind_down',
    label:      'Wind down',
    icon:       '🌙',
    nodes:      ['MEDIA', 'CHRONOS'],
    intent:     'play calm music and set a 30 minute sleep timer',
    actions:    [
      { node: 'MEDIA',   command: 'audio', params: { action: 'play' } },
      { node: 'CHRONOS', command: 'timer', params: { ms: 1800000, label: '30 minutes' } },
    ],
    source:     'default',
    createdAt:  null,
    usageCount: 0,
    tags:       ['compound', 'sleep', 'wind-down'],
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
  _presets: {},   // id   → preset definition + usage metrics
  _meta:    {},   // registry-level metadata
  _dirty:   false,

  // ── Initialisation ───────────────────────────────────────────────────────────
  init() {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (raw) {
      try {
        const stored = JSON.parse(raw);
        if (stored.version === REGISTRY_VERSION) {
          this._nodes   = stored.nodes   || {};
          this._models  = stored.models  || {};
          this._presets = stored.presets || {};
          this._meta    = stored.meta    || {};
          this._ensureDefaults();
          return;
        }
        // Version mismatch — migrate defaults in, preserve runtime metrics
        console.warn('[Registry] Version mismatch — migrating to', REGISTRY_VERSION);
        this._nodes   = stored.nodes   || {};
        this._models  = stored.models  || {};
        this._presets = stored.presets || {};
        this._meta    = stored.meta    || {};
      } catch(_) {
        console.warn('[Registry] Corrupt data — resetting to defaults');
      }
    }
    this._loadDefaults();
  },

  _loadDefaults() {
    this._nodes   = {};
    this._models  = {};
    this._presets = {};
    this._meta    = { created: Date.now(), instanceId: this._generateId() };
    DEFAULT_NODES.forEach(n   => { this._nodes[n.name]    = this._nodeEntry(n);    });
    DEFAULT_MODELS.forEach(m  => { this._models[m.id]     = this._modelEntry(m);   });
    DEFAULT_PRESETS.forEach(p => { this._presets[p.id]    = this._presetEntry(p);  });
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
    DEFAULT_PRESETS.forEach(p => {
      if (!this._presets[p.id]) {
        this._presets[p.id] = this._presetEntry(p);
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

  _presetEntry(def) {
    return {
      ...def,
      usageCount: def.usageCount || 0,
      createdAt:  def.createdAt  || (def.source === 'user' ? Date.now() : null),
    };
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

  // ── Preset access ─────────────────────────────────────────────────────────
  getPreset(id) {
    return this._presets[id] || null;
  },

  getAllPresets() {
    return Object.values(this._presets);
  },

  getPresetsForNode(nodeName) {
    return Object.values(this._presets).filter(p =>
      p.nodes.length === 1 && p.nodes[0] === nodeName.toUpperCase()
    );
  },

  getPresetsForNodes(nodeNames) {
    const sorted = [...nodeNames].map(n => n.toUpperCase()).sort().join(',');
    return Object.values(this._presets).filter(p => {
      const pSorted = [...p.nodes].sort().join(',');
      return pSorted === sorted;
    });
  },

  getCompoundPresets() {
    return Object.values(this._presets).filter(p => p.nodes.length > 1);
  },

  /**
   * Add a user-created preset — called by Birth Protocol preset mode.
   * @param {object} def — preset definition (id auto-generated if not provided)
   */
  addPreset(def) {
    const id = def.id || 'user_' + this._generateId().toLowerCase();
    if (this._presets[id]) {
      console.warn(`[Registry] Preset ${id} already exists`);
      return false;
    }
    this._presets[id] = this._presetEntry({
      ...def,
      id,
      source:    'user',
      createdAt: Date.now(),
      usageCount: 0,
    });
    this._dirty = true;
    this.save();
    return id;
  },

  removePreset(id) {
    if (!this._presets[id] || this._presets[id].source === 'default') return false;
    delete this._presets[id];
    this._dirty = true;
    this.save();
    return true;
  },

  recordPresetFired(id) {
    if (this._presets[id]) {
      this._presets[id].usageCount++;
      this._dirty = true;
    }
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
        presets: this._presets,
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
      presets: { ...this._presets },
      meta:    { ...this._meta },
    };
  },
};
