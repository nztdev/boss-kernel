/**
 * B.O.S.S. Nervous System — nervous/nervous.js
 * ==============================================
 * github.com/nztdev/boss-kernel
 *
 * The Nervous System is a typed event bus connecting all BOSS components.
 * It replaces scattered point-to-point connections (direct function calls,
 * DOM manipulation, SSE events, clog() calls) with a single observable
 * channel that all components can publish to and subscribe from.
 *
 * Design principles:
 *   - Additive: existing component behaviour is unchanged during migration.
 *     Components emit events IN ADDITION to their current behaviour.
 *   - Synchronous delivery: subscribers are called immediately on emit.
 *     No queuing, no async dispatch — events are observations, not commands.
 *   - No dependencies: this module imports nothing. It is the foundation
 *     that everything else builds on.
 *   - Observable: all events are stored in a ring buffer for inspection.
 *
 * Interface:
 *   Nervous.on(type, handler)      — subscribe to an event type (* for all)
 *   Nervous.off(type, handler)     — unsubscribe
 *   Nervous.emit(type, payload)    — publish an event
 *   Nervous.history(n)             — get last n events from ring buffer
 *   Nervous.clear()                — clear all subscribers (for testing)
 *
 * Event schema:
 *   {
 *     type:      string    — event type (see EVENT_TYPES below)
 *     source:    string    — component that emitted ('SOMA'|'HEART'|'ARBITER'|...)
 *     node:      string?   — affected kernel node name if applicable
 *     modelId:   string?   — affected engine model id if applicable
 *     payload:   object    — event-specific data
 *     timestamp: number    — Date.now()
 *     severity:  string    — 'info' | 'warn' | 'critical'
 *   }
 */

// ── Event type catalogue ──────────────────────────────────────────────────────
// All valid event types. Components should use these constants rather than
// raw strings to prevent typos from creating silent routing failures.

export const EVENT = {
  // Kernel routing events
  NODE_FIRED:           'NODE_FIRED',           // a node won a pulse and ignited
  NODE_GRIEVED:         'NODE_GRIEVED',         // a node received grief penalty
  BOND_FORMED:          'BOND_FORMED',          // synaptic bond created or strengthened
  BIRTH_SIGNAL:         'BIRTH_SIGNAL',         // no node matched intent — Birth Protocol

  // Arbiter events
  ARBITER_CONFLICT:     'ARBITER_CONFLICT',     // Arbiter detected conflict between nodes
  ARBITER_RESOLVED:     'ARBITER_RESOLVED',     // Arbiter resolved conflict (any path)
  ARBITER_GRIEF:        'ARBITER_GRIEF',        // hard grief protocol activated
  ARBITER_CLARIFIED:    'ARBITER_CLARIFIED',    // user chose from clarification toast

  // Engine events
  ENGINE_ESCALATED:     'ENGINE_ESCALATED',     // deliberation engine was called
  ENGINE_RESOLVED:      'ENGINE_RESOLVED',      // engine returned consensus answer
  ENGINE_FAILED:        'ENGINE_FAILED',        // engine call failed or timed out

  // Model events (engine pool LLM nodes)
  MODEL_SUCCESS:        'MODEL_SUCCESS',        // LLM call succeeded
  MODEL_FAIL:           'MODEL_FAIL',           // LLM call failed
  MODEL_SUSPENDED:      'MODEL_SUSPENDED',      // Immune System suspended a model
  MODEL_RESTORED:       'MODEL_RESTORED',       // Immune System restored a model

  // Memory events
  VAULT_WRITTEN:        'VAULT_WRITTEN',        // memory ingested to vault
  VAULT_RECALLED:       'VAULT_RECALLED',       // memory retrieved from vault
  VAULT_PRUNED:         'VAULT_PRUNED',         // Heart pruned stale vault entries

  // Metabolic events (Heart)
  HEART_BEAT:           'HEART_BEAT',           // Heart 30s interval fired
  BONDS_NORMALISED:     'BONDS_NORMALISED',     // Heart normalised bond weights
  KERNEL_SAVED:         'KERNEL_SAVED',         // Heart persisted kernel state

  // Cortex events
  CORTEX_ONLINE:        'CORTEX_ONLINE',        // Cortex handshake succeeded
  CORTEX_OFFLINE:       'CORTEX_OFFLINE',       // Cortex went offline or timed out
  VECTOR_BOOST:         'VECTOR_BOOST',         // Cortex provided vector boosts

  // Registry events
  REGISTRY_NODE_ADDED:  'REGISTRY_NODE_ADDED',  // new node registered (Birth Protocol)
  REGISTRY_SYNCED:      'REGISTRY_SYNCED',      // Registry synced with Cortex

  // Immune System events
  IMMUNE_FLAG:          'IMMUNE_FLAG',          // anomaly detected
  IMMUNE_INTERVENED:    'IMMUNE_INTERVENED',    // Immune System took action
  HEALTH_REPORT:        'HEALTH_REPORT',        // periodic health summary
};

// ── Ring buffer ───────────────────────────────────────────────────────────────
const HISTORY_SIZE = 200;

// ── Nervous System ────────────────────────────────────────────────────────────
export const Nervous = {
  _subscribers: {},   // type → Set of handler functions
  _wildcard:    new Set(),  // handlers subscribed to all events (*)
  _history:     [],   // ring buffer of recent events
  _eventCount:  0,

  /**
   * Subscribe to an event type.
   * Use '*' to receive all events (used by Immune System and debug tools).
   */
  on(type, handler) {
    if (type === '*') {
      this._wildcard.add(handler);
      return;
    }
    if (!this._subscribers[type]) this._subscribers[type] = new Set();
    this._subscribers[type].add(handler);
  },

  /**
   * Unsubscribe a handler.
   */
  off(type, handler) {
    if (type === '*') { this._wildcard.delete(handler); return; }
    this._subscribers[type]?.delete(handler);
  },

  /**
   * Emit an event to all subscribers.
   * payload fields: source, node?, modelId?, payload?, severity?
   */
  emit(type, data = {}) {
    const event = {
      type,
      source:    data.source    || 'UNKNOWN',
      node:      data.node      || null,
      modelId:   data.modelId   || null,
      payload:   data.payload   || {},
      timestamp: Date.now(),
      severity:  data.severity  || 'info',
      id:        ++this._eventCount,
    };

    // Store in ring buffer
    this._history.push(event);
    if (this._history.length > HISTORY_SIZE) this._history.shift();

    // Deliver to type-specific subscribers
    this._subscribers[type]?.forEach(handler => {
      try { handler(event); }
      catch(e) { console.error(`[Nervous] Handler error on ${type}:`, e); }
    });

    // Deliver to wildcard subscribers
    this._wildcard.forEach(handler => {
      try { handler(event); }
      catch(e) { console.error(`[Nervous] Wildcard handler error on ${type}:`, e); }
    });
  },

  /**
   * Get the last n events from the ring buffer.
   * Used by Immune System for pattern detection and debug tools.
   */
  history(n = 20, type = null) {
    const buf = type
      ? this._history.filter(e => e.type === type)
      : this._history;
    return buf.slice(-n);
  },

  /**
   * Get event counts by type (for health reporting).
   */
  counts() {
    return this._history.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {});
  },

  /**
   * Clear all subscribers. Used in testing only.
   */
  clear() {
    this._subscribers = {};
    this._wildcard.clear();
  },
};
