/**
 * B.O.S.S. Immune System — immune/immune.js
 * ===========================================
 * github.com/nztdev/boss-kernel
 *
 * The Immune System monitors the BOSS field for anomalies and degrades
 * reliability scores when components behave badly. It is an observer
 * and recommender — it never modifies kernel physics directly.
 *
 * It works by:
 *   1. Subscribing to all events via the Nervous System
 *   2. Accumulating behavioural patterns per node and model
 *   3. Writing reliability scores back to the Registry
 *   4. Emitting IMMUNE_FLAG and IMMUNE_INTERVENED events when thresholds
 *      are crossed — the Soma can choose to surface these to the user
 *
 * Architectural constraint:
 *   The Immune System NEVER modifies node.resonance or node.warmth directly.
 *   It works through Registry.setReliability() which updates the stored
 *   reliability score. The Soma reads this on the next pulse cycle.
 *   Physics remain deterministic and auditable.
 *
 * Interface:
 *   Immune.init(registry, nervous)  — wire up subscriptions
 *   Immune.report()                 — return current health summary
 *   Immune.reset(name)             — reset metrics for a node or model
 *
 * Thresholds (all tunable):
 *   GRIEF_RATE_THRESHOLD    — grief/fire ratio above this → reliability penalty
 *   MODEL_FAIL_THRESHOLD    — consecutive failures before model suspension
 *   CONFLICT_RATE_THRESHOLD — arbiter involvement ratio above this → flag
 *   RELIABILITY_FLOOR       — minimum reliability score (prevents total suppression)
 *   RELIABILITY_RECOVERY    — reliability gained per successful fire
 *   RELIABILITY_PENALTY     — reliability lost per grief event
 */

export const Immune = {
  // ── Thresholds ───────────────────────────────────────────────────────────────
  GRIEF_RATE_THRESHOLD:    0.30,  // >30% grief rate → flag node
  MODEL_FAIL_THRESHOLD:    5,     // 5 consecutive failures → suspend model
  CONFLICT_RATE_THRESHOLD: 0.50,  // >50% pulses involve Arbiter → flag seeds
  RELIABILITY_FLOOR:       0.25,  // minimum reliability (node can still fire)
  RELIABILITY_RECOVERY:    0.02,  // per successful fire
  RELIABILITY_PENALTY:     0.05,  // per grief event
  HEALTH_REPORT_INTERVAL:  10,    // emit health report every N HEART_BEAT events

  // ── State ─────────────────────────────────────────────────────────────────────
  _registry:        null,
  _nervous:         null,
  _beatCount:       0,
  _modelFailStreak: {},  // modelId → consecutive fail count
  _initialized:     false,

  // ── Initialisation ────────────────────────────────────────────────────────────
  init(registry, nervous) {
    this._registry = registry;
    this._nervous  = nervous;

    // Subscribe to all events via wildcard
    nervous.on('*', (event) => this._handleEvent(event));

    this._initialized = true;
    console.log('[Immune] Online — monitoring all event channels');
  },

  // ── Event handler ─────────────────────────────────────────────────────────────
  _handleEvent(event) {
    if (!this._registry) return;

    // Forward all relevant events to Registry for metric accumulation
    this._registry.recordEvent({
      type:      event.type,
      node:      event.node,
      modelId:   event.modelId,
      latencyMs: event.payload?.latencyMs,
    });

    // Then apply Immune System logic per event type
    switch (event.type) {

      case 'NODE_FIRED':
        this._onNodeFired(event.node);
        break;

      case 'NODE_GRIEVED':
        this._onNodeGrieved(event.node);
        break;

      case 'MODEL_SUCCESS':
        this._onModelSuccess(event.modelId);
        break;

      case 'MODEL_FAIL':
        this._onModelFail(event.modelId);
        break;

      case 'HEART_BEAT':
        this._onHeartBeat();
        break;

      case 'ARBITER_CONFLICT':
        this._onArbiterConflict(event.node, event.payload?.secondNode);
        break;
    }
  },

  // ── Node reliability management ───────────────────────────────────────────────
  _onNodeFired(nodeName) {
    if (!nodeName) return;
    const node = this._registry.getNode(nodeName);
    if (!node) return;

    // Recovery: reliability increases slightly on each successful fire
    const current = node.metrics.reliability;
    const updated = Math.min(1.0, current + this.RELIABILITY_RECOVERY);
    if (updated !== current) {
      this._registry.setReliability(nodeName, updated);
    }
  },

  _onNodeGrieved(nodeName) {
    if (!nodeName) return;
    const node = this._registry.getNode(nodeName);
    if (!node) return;

    // Penalty: reliability decreases on grief
    const current = node.metrics.reliability;
    const updated = Math.max(this.RELIABILITY_FLOOR, current - this.RELIABILITY_PENALTY);
    this._registry.setReliability(nodeName, updated);

    // Check grief rate — flag if consistently high
    const { totalGriefs, totalFires } = node.metrics;
    const griefRate = totalFires > 0 ? totalGriefs / totalFires : 0;

    if (griefRate > this.GRIEF_RATE_THRESHOLD && totalFires >= 10) {
      this._nervous.emit('IMMUNE_FLAG', {
        source:   'IMMUNE',
        node:     nodeName,
        severity: 'warn',
        payload:  {
          reason:    'high_grief_rate',
          griefRate: griefRate.toFixed(2),
          message:   `${nodeName} grief rate ${(griefRate * 100).toFixed(0)}% — specialty may overlap with adjacent nodes`,
        },
      });
    }
  },

  _onArbiterConflict(nodeA, nodeB) {
    // Track Arbiter involvement — high rates suggest seed ambiguity
    // Logged to registry via recordEvent — flagging happens on HEART_BEAT
  },

  // ── Model reliability management ──────────────────────────────────────────────
  _onModelSuccess(modelId) {
    if (!modelId) return;
    // Reset fail streak on success
    this._modelFailStreak[modelId] = 0;

    const model = this._registry.getModel(modelId);
    if (!model) return;

    // Restore suspended model if it has recovered
    if (model.metrics.suspended) {
      this._registry.recordEvent({ type: 'MODEL_RESTORED', modelId });
      this._nervous.emit('MODEL_RESTORED', {
        source:   'IMMUNE',
        modelId,
        severity: 'info',
        payload:  { message: `${model.name} restored after recovery` },
      });
      this._nervous.emit('IMMUNE_INTERVENED', {
        source:   'IMMUNE',
        modelId,
        severity: 'info',
        payload:  { action: 'model_restored', modelId },
      });
    }

    // Reliability recovery
    const current = model.metrics.reliability;
    this._registry.setReliability(modelId, Math.min(1.0, current + 0.01), true);
  },

  _onModelFail(modelId) {
    if (!modelId) return;
    this._modelFailStreak[modelId] = (this._modelFailStreak[modelId] || 0) + 1;
    const streak = this._modelFailStreak[modelId];

    // Reliability penalty per failure
    const model = this._registry.getModel(modelId);
    if (model) {
      const current = model.metrics.reliability;
      this._registry.setReliability(modelId, Math.max(this.RELIABILITY_FLOOR, current - 0.1), true);
    }

    // Suspend after threshold of consecutive failures
    if (streak >= this.MODEL_FAIL_THRESHOLD) {
      this._registry.recordEvent({ type: 'MODEL_SUSPENDED', modelId });
      this._nervous.emit('MODEL_SUSPENDED', {
        source:   'IMMUNE',
        modelId,
        severity: 'warn',
        payload:  { streak, message: `${modelId} suspended after ${streak} consecutive failures` },
      });
      this._nervous.emit('IMMUNE_INTERVENED', {
        source:   'IMMUNE',
        modelId,
        severity: 'warn',
        payload:  { action: 'model_suspended', modelId, streak },
      });
    }
  },

  // ── Periodic health check (every HEART_BEAT) ──────────────────────────────────
  _onHeartBeat() {
    this._beatCount++;

    // Emit health report every N beats
    if (this._beatCount % this.HEALTH_REPORT_INTERVAL === 0) {
      const report = this.report();
      this._nervous.emit('HEALTH_REPORT', {
        source:   'IMMUNE',
        severity: report.flags.length > 0 ? 'warn' : 'info',
        payload:  report,
      });
    }

    // Check conflict rate across all nodes
    const nodes = this._registry.getAllNodes();
    const totalFires     = nodes.reduce((s, n) => s + n.metrics.totalFires, 0);
    const totalConflicts = nodes.reduce((s, n) => s + n.metrics.arbiterInvolvement, 0);

    if (totalFires >= 20) {
      const conflictRate = totalConflicts / totalFires;
      if (conflictRate > this.CONFLICT_RATE_THRESHOLD) {
        this._nervous.emit('IMMUNE_FLAG', {
          source:   'IMMUNE',
          severity: 'warn',
          payload:  {
            reason:       'high_conflict_rate',
            conflictRate: conflictRate.toFixed(2),
            message:      `${(conflictRate * 100).toFixed(0)}% of pulses trigger Arbiter — consider seed refinement`,
          },
        });
      }
    }
  },

  // ── Health report ─────────────────────────────────────────────────────────────
  /**
   * Returns a snapshot of current system health.
   * Called by HEART_BEAT, available to Soma for display.
   */
  report() {
    if (!this._registry) return { error: 'not_initialized' };

    const nodes  = this._registry.getAllNodes();
    const models = this._registry.getAllModels();
    const flags  = [];

    // Node health
    const nodeHealth = nodes.map(n => {
      const { totalFires, totalGriefs, reliability, arbiterInvolvement } = n.metrics;
      const griefRate    = totalFires > 0 ? (totalGriefs / totalFires) : 0;
      const conflictRate = totalFires > 0 ? (arbiterInvolvement / totalFires) : 0;
      const status       = reliability < 0.5  ? 'degraded'
                         : reliability < 0.75 ? 'reduced'
                         : 'healthy';

      if (status !== 'healthy') {
        flags.push({ type: 'node', name: n.name, status, reliability });
      }

      return { name: n.name, status, reliability, griefRate, conflictRate, totalFires };
    });

    // Model health
    const modelHealth = models.map(m => {
      const { successCount, failCount, avgLatencyMs, reliability, suspended } = m.metrics;
      const total      = successCount + failCount;
      const failRate   = total > 0 ? (failCount / total) : 0;
      const status     = suspended   ? 'suspended'
                       : failRate > 0.5 ? 'degraded'
                       : 'healthy';

      if (status !== 'healthy') {
        flags.push({ type: 'model', id: m.id, name: m.name, status });
      }

      return {
        id: m.id, name: m.name, status, reliability,
        successCount, failCount, avgLatencyMs, suspended,
      };
    });

    return {
      timestamp:   Date.now(),
      beatCount:   this._beatCount,
      nodeHealth,
      modelHealth,
      flags,
      summary:     flags.length === 0
        ? 'All systems nominal'
        : `${flags.length} component(s) require attention`,
    };
  },

  /**
   * Reset accumulated metrics for a node or model.
   * Called when user manually recovers the kernel (after grief protocol).
   */
  reset(name, isModel = false) {
    if (isModel) {
      this._modelFailStreak[name] = 0;
      this._registry.setReliability(name, 1.0, true);
    } else {
      this._registry.setReliability(name, 1.0, false);
    }
  },
};
