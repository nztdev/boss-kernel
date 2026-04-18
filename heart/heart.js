/**
 * B.O.S.S. Heart — heart/heart.js
 * Metabolic rhythm module. Manages persistence, biometrics, and autosave.
 * Extracted from core/index.html during Phase 3.
 *
 * Interface:
 *   Heart.init(nodes, chain, systemVitals)  — call once at boot
 *   Heart.initBiometrics()                  — async, sets battery state
 *   Heart.loadKernel()                      — returns saved state or null
 *   Heart.save()                            — serialise current state
 *   Heart.start()                           — begin 30s metabolic interval
 *   Heart.stop()                            — clear interval (for testing)
 *
 * Each beat (every 30s) runs three metabolic processes in order:
 *   1. Bond normalisation — caps strong bonds, prunes dead ones
 *   2. Vault maintenance  — removes stale memory entries
 *   3. Autosave           — persists field state to localStorage
 */

export const Heart = {
  nodes: null,
  chain: null,
  systemVitals: null,
  interval: null,

  // Bond normalisation constants
  BOND_MAX:        2.0,   // ceiling — no bond grows beyond this
  BOND_PRUNE:      0.02,  // floor   — bonds weaker than this are removed
  BOND_DECAY_RATE: 0.98,  // multiplier per beat — slow gravitational drift toward zero

  // Vault maintenance constants
  VAULT_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,  // 7 days
  VAULT_MAX_SIZE:   200,

  init(nodes, chain, systemVitals) {
    this.nodes = nodes;
    this.chain = chain;
    this.systemVitals = systemVitals;
  },

  async initBiometrics() {
    if (typeof navigator === 'undefined' || !navigator.getBattery) return;
    try {
      const b = await navigator.getBattery();
      const upd = () => {
        if (!this.systemVitals) return;
        // BASE_DECAY is read from systemVitals.baseDecay if set by Soma,
        // otherwise falls back to the canonical value of 0.05 (Lock 2).
        const base = this.systemVitals.baseDecay || 0.05;
        this.systemVitals.battery    = b.level;
        this.systemVitals.isLowPower = b.level < 0.2 && !b.charging;
        this.systemVitals.decayRate  = this.systemVitals.isLowPower
          ? base * 0.4
          : base * (0.6 + b.level * 0.4);
        // DOM updates are Soma's responsibility (Lock 10).
        // Heart only updates systemVitals — Soma reads and renders.
      };
      upd();
      b.addEventListener('levelchange',    upd);
      b.addEventListener('chargingchange', upd);
    } catch(_) {}
  },

  loadKernel() {
    const raw = localStorage.getItem('BOSS_KERNEL');
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      return { nodes: s.nodes, chain: s.chain || [] };
    } catch(_) { return null; }
  },

  save() {
    if (!this.nodes) return;
    localStorage.setItem('BOSS_KERNEL', JSON.stringify({
      nodes: this.nodes.map(n => n.toJSON ? n.toJSON() : n),
      chain: this.chain ? this.chain.slice(-50) : [],
      saved: Date.now()
    }));
  },

  /**
   * Bond normalisation — runs every beat.
   *
   * Bonds are synaptic weights between nodes. They grow when nodes
   * co-activate (firePulse forms them). Without a ceiling they would
   * accumulate without bound over long sessions, making early co-activation
   * patterns permanently dominant regardless of current behaviour.
   *
   * Three operations:
   *   - Decay: multiply every bond by BOND_DECAY_RATE (slow drift toward zero)
   *   - Cap:   clamp any bond above BOND_MAX back to BOND_MAX
   *   - Prune: delete bonds that have decayed below BOND_PRUNE (dead weight)
   *
   * The decay rate (0.98 per 30s beat) is intentionally slow — a bond formed
   * an hour ago still carries ~85% of its weight. The field has long memory
   * but not permanent memory.
   */
  normaliseBonds() {
    if (!this.nodes) return;
    this.nodes.forEach(node => {
      Object.keys(node.bonds).forEach(targetId => {
        // Slow gravitational decay
        node.bonds[targetId] *= this.BOND_DECAY_RATE;
        // Cap at maximum
        if (node.bonds[targetId] > this.BOND_MAX) {
          node.bonds[targetId] = this.BOND_MAX;
        }
        // Prune dead bonds
        if (node.bonds[targetId] < this.BOND_PRUNE) {
          delete node.bonds[targetId];
        }
      });
    });
  },

  /**
   * Vault maintenance — runs every beat.
   *
   * The vault is the kernel's episodic memory — text fragments remembered
   * via "remember [text]" commands or auto-ingested from cortex responses.
   * Without maintenance it grows to 200 entries and then stops accepting new
   * memories because the size cap is enforced on write but old entries are
   * never aged out.
   *
   * Two operations:
   *   - Age: remove entries older than VAULT_MAX_AGE_MS (7 days default)
   *   - Trim: if still over VAULT_MAX_SIZE after aging, drop the oldest
   *
   * Entries are stored newest-first so trim drops from the tail.
   */
  maintainVault() {
    try {
      const raw = localStorage.getItem('BOSS_VAULT');
      if (!raw) return;
      let vault = JSON.parse(raw);
      if (!Array.isArray(vault) || !vault.length) return;

      const now     = Date.now();
      const cutoff  = now - this.VAULT_MAX_AGE_MS;

      // Remove stale entries
      vault = vault.filter(m => m.time && m.time > cutoff);

      // Trim to size cap (entries are newest-first, drop from tail)
      if (vault.length > this.VAULT_MAX_SIZE) {
        vault = vault.slice(0, this.VAULT_MAX_SIZE);
      }

      localStorage.setItem('BOSS_VAULT', JSON.stringify(vault));
    } catch(_) {}
  },

  /**
   * The beat — runs every 30 seconds.
   * Order matters: normalise and maintain first, then save the clean state.
   */
  start() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (!this.nodes || !this.nodes.length) return;
      this.normaliseBonds();
      this.maintainVault();
      this.save();
    }, 30000);
  },

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
};
