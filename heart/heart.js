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
 *   Heart.start()                           — begin 30s autosave interval
 *   Heart.stop()                            — clear interval (for testing)
 */

export const Heart = {
  nodes: null,
  chain: null,
  systemVitals: null,
  interval: null,

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

  start() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (this.nodes && this.nodes.length) {
        this.save();
      }
    }, 30000);
  },

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
};