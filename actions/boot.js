/**
 * B.O.S.S. Boot Animation — actions/boot.js
 * ==========================================
 * The BOSS logo illuminates, drops onto a slightly 3D grid, and LED-like light
 * pulses flow outward across the grid; then the field takes over.
 *
 *   Boot.start()      → Promise that resolves when the animation has finished
 *                       (or immediately when it is skipped / not due).
 *   Boot.shouldRun()  → true once per session, and again after an update.
 *   Boot.enabled() / Boot.setEnabled(bool)   Settings toggle (localStorage BOSS_BOOT).
 *   Boot.markUpdated()                       call before a deliberate reload after an update.
 *
 * When it runs
 *   • At the start of each session (first open, or reopened after the app was closed).
 *   • After an update (flag cleared by Update BOSS / the "BOSS updated" banner).
 *   • NOT on a plain reload inside the same session (sessionStorage flag BOSS_BOOTED).
 *   • Never when switched off in Settings. Tap / key to skip at any time.
 *   • Reduce-motion (iOS/Android system setting, or Settings → Reduce motion) → a calmer
 *     version: a short soft drop (no rebound or impact ring), pulses flow more slowly.
 *
 * Self-contained: the overlay div (#boot) is placed in index.html right after
 * <body> so there is no flash of the field first; this module draws into it.
 * It makes no network calls and holds no state beyond the two storage flags.
 */

const KEY_ON = 'BOSS_BOOT';          // 'off' disables
const KEY_SESSION = 'BOSS_BOOTED';   // sessionStorage: already ran this session
const LOGO = './bosslogo-192.png';
const DURATION = 4700;               // ms until fade-out begins
const FADE = 450;

export function enabled() { try { return localStorage.getItem(KEY_ON) !== 'off'; } catch (_) { return true; } }
export function setEnabled(on) { try { localStorage.setItem(KEY_ON, on ? 'on' : 'off'); } catch (_) {} }
export function shouldRun() {
  if (!enabled()) return false;
  try { return !sessionStorage.getItem(KEY_SESSION); } catch (_) { return true; }
}
/** Make the next load play the animation again (used after an update). */
export function markUpdated() { try { sessionStorage.removeItem(KEY_SESSION); } catch (_) {} }

const _reduced = () => document.body.classList.contains('reduce-motion') ||
  (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && !document.body.classList.contains('motion-on'));
const _glow = () => (getComputedStyle(document.documentElement).getPropertyValue('--glow') || '').trim() || '#00ffcc';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = {
  in: x => x * x * x,
  out: x => 1 - Math.pow(1 - x, 3),
};

export function start() {
  const el = document.getElementById('boot');
  if (!el) return Promise.resolve();
  if (!shouldRun()) { el.remove(); return Promise.resolve(); }
  try { sessionStorage.setItem(KEY_SESSION, '1'); } catch (_) {}

  return new Promise(resolve => {
    const reduced = _reduced();
    const col = _glow();
    const cv = document.createElement('canvas');
    // the app has a global `canvas{position:fixed;100vw×100dvh}` rule; this is the same box anyway
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.appendChild(cv);
    const ctx = cv.getContext('2d');
    const img = new Image(); let imgOk = false, imgErr = false;
    img.onload = () => { imgOk = true; }; img.onerror = () => { imgErr = true; }; img.src = LOGO;

    let W = 0, H = 0, dpr = 1;
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = el.clientWidth || innerWidth; H = el.clientHeight || innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit(); addEventListener('resize', fit);

    let done = false, raf = 0, clock = 0, last = 0;
    const finish = () => {
      if (done) return; done = true;
      cancelAnimationFrame(raf); removeEventListener('resize', fit);
      el.removeEventListener('pointerdown', finish); removeEventListener('keydown', finish);
      el.style.transition = `opacity ${FADE}ms ease`; el.style.opacity = '0';
      setTimeout(() => { el.remove(); resolve(); }, FADE);
    };
    el.addEventListener('pointerdown', finish); addEventListener('keydown', finish);
    setTimeout(finish, 8000); // safety net

    // ── choreography (ms) ──────────────────────────────────────────────────
    //   0–800   the logo alone, in the dark, illuminating (grid hidden)
    //   800–1450 it falls onto the grid (reduce-motion: a short, soft drop, no rebound)
    //   1450    impact: ring of light + the grid appears
    //   1450→   LED-like pulses spread from around the logo across the grid
    //   2100→   status words appear one by one, in a single row that always fits;  fade out at the end
    const T_FALL0 = 800, T_FALL1 = 1450, T_IMPACT = T_FALL1;

    // ── grid geometry: a hexagonal floor in perspective ─────────────────────
    const ROWS = 15;                                  // floor depth, in depth units
    const landD = ROWS * 0.6;                         // where the badge lands
    const sc = d => Math.pow(clamp(d / ROWS, 0.02, 1), 1.7);
    const P = (x, d) => {                             // world (x, depth) → screen
      const s = sc(d), hy = H * 0.3, unit = Math.min(W, H * 0.62) / 4.2;
      return [W / 2 + x * unit * s, hy + (H * 0.98 - hy) * s];
    };
    const HEX_R = 1.0, DK = 0.85;                     // hex radius (x units) and depth stretch
    const MS_PER_UNIT = reduced ? 150 : 95;          // how fast light travels along the lines

    // Build the hex mesh once: vertices, unique edges, and for each wave a random
    // arrival time per vertex (Dijkstra with jittered edge costs) so light spreads
    // unevenly, branch by branch, never all at once.
    const mesh = (() => {
      const vid = new Map(), V = [], E = [], seen = new Set();
      const vert = (x, d) => {
        const k = Math.round(x * 100) + ',' + Math.round(d * 100);
        if (!vid.has(k)) { vid.set(k, V.length); V.push({ x, d, adj: [] }); }
        return vid.get(k);
      };
      const w = HEX_R * 1.5, h = Math.sqrt(3) * HEX_R;
      for (let c = -22; c <= 22; c++) {
        for (let r = -2; r <= 14; r++) {
          const cx = c * w, cd = landD + (r * h + (c & 1 ? h / 2 : 0)) * DK - 8 * h * DK;
          if (cd < 0.6 || cd > ROWS + 1.2) continue;
          const ring = [];
          for (let q = 0; q < 6; q++) { const an = q * Math.PI / 3; ring.push(vert(cx + HEX_R * Math.cos(an), cd + HEX_R * Math.sin(an) * DK)); }
          for (let q = 0; q < 6; q++) {
            const u = ring[q], v = ring[(q + 1) % 6], key = u < v ? u + '-' + v : v + '-' + u;
            if (seen.has(key)) continue; seen.add(key);
            const len = Math.hypot(V[u].x - V[v].x, (V[u].d - V[v].d) / DK);
            E.push({ u, v, len }); V[u].adj.push(E.length - 1); V[v].adj.push(E.length - 1);
          }
        }
      }
      // light is born at the vertices around the badge and flows outward
      const wave = () => {
        const ar = new Float64Array(V.length).fill(Infinity), done = new Uint8Array(V.length);
        const jit = E.map(() => 0.65 + Math.random() * 1.0);
        V.forEach((p, i) => { const dd = Math.hypot(p.x, (p.d - landD) / DK); if (dd < 1.6) ar[i] = dd * 0.5 * MS_PER_UNIT; });
        for (let n = 0; n < V.length; n++) {
          let m = -1, best = Infinity;
          for (let i = 0; i < V.length; i++) if (!done[i] && ar[i] < best) { best = ar[i]; m = i; }
          if (m < 0) break; done[m] = 1;
          for (const ei of V[m].adj) {
            const e = E[ei], o = e.u === m ? e.v : e.u, cost = e.len * jit[ei] * MS_PER_UNIT;
            if (ar[m] + cost < ar[o]) ar[o] = ar[m] + cost;
          }
        }
        return ar;
      };
      return { V, E, A: [wave(), wave()] };
    })();
    const WAVE_OFFSET = [0, 1000];                    // second wave follows, travelling different branches
    const proj = new Map();
    const pv = i => { let p = proj.get(i); if (!p) { p = P(mesh.V[i].x, mesh.V[i].d); proj.set(i, p); } return p; };
    const projReset = () => proj.clear();
    addEventListener('resize', projReset);

    function drawGrid(t) {
      if (t < T_IMPACT) return;
      const tt = t - T_IMPACT;
      ctx.lineCap = 'round';
      for (const e of mesh.E) {
        const pu = pv(e.u), pw = pv(e.v);
        const depth = 0.3 + 0.7 * sc((mesh.V[e.u].d + mesh.V[e.v].d) / 2);
        // 1) the dark, unlit wire
        ctx.globalAlpha = 0.07 * depth; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(pu[0], pu[1]); ctx.lineTo(pw[0], pw[1]); ctx.stroke();
        let res = 0, headU = -1, trail = 0, lift = 0, from = 0;
        for (let k = 0; k < 2; k++) {
          const A = mesh.A[k], au = A[e.u], av = A[e.v];
          const fwd = au <= av, t0 = (fwd ? au : av) + WAVE_OFFSET[k], dur = Math.max(30, Math.abs(au - av));
          const since = tt - t0; if (since < 0) continue;
          const u = since / dur;                        // 0..1 head position along the edge from its earlier end
          res += (k ? 0.18 : 0.42) * (1 - Math.exp(-since / 900));
          if (u < 1.6) { const hv = u < 1 ? 1 : Math.exp(-(u - 1) * 3); if (hv > trail) { trail = hv; headU = u; from = fwd ? 0 : 1; } }
        }
        if (res > 0) {                                  // lit portion fills in behind the head, then stays and slowly brightens
          const u = Math.min(1, Math.max(headU, 0) || 1);
          const a0 = from ? pw : pu, a1 = from ? pu : pw;
          const hx = a0[0] + (a1[0] - a0[0]) * (headU >= 0 && headU < 1 ? headU : 1), hy2 = a0[1] + (a1[1] - a0[1]) * (headU >= 0 && headU < 1 ? headU : 1);
          ctx.globalAlpha = clamp(res * (0.45 + 0.55 * depth)); ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(hx, hy2); ctx.stroke();
          if (trail > 0.05) {                           // the bright, raised pulse itself
            lift = trail * 5 * depth;
            const b0x = a0[0] + (a1[0] - a0[0]) * Math.max(0, (headU < 1 ? headU : 1) - 0.55), b0y = a0[1] + (a1[1] - a0[1]) * Math.max(0, (headU < 1 ? headU : 1) - 0.55);
            ctx.globalAlpha = clamp(trail * depth + 0.1); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2 + 1.8 * trail * depth;
            ctx.shadowColor = col; ctx.shadowBlur = 12 * trail;
            ctx.beginPath(); ctx.moveTo(b0x, b0y - lift); ctx.lineTo(hx, hy2 - lift); ctx.stroke();
            ctx.globalAlpha = clamp(0.35 * trail * depth);   // faint post dropping to the floor
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, hy2 - lift); ctx.lineTo(hx, hy2); ctx.stroke();
            ctx.strokeStyle = col; ctx.shadowBlur = 0;
          }
        }
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // ── the badge: a thick slab with the logo on its face ──────────────────
    // tilt 0 = standing, face to the viewer;  tilt 1 = lying flat on its back, face up.
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    const FLAT = 0.34;                                  // vertical squash of a flat face seen from the camera
    function drawBadge(cx, cy, s, tilt, roll, glowAmt, alpha) {
      const k = 1 - tilt * (1 - FLAT);                  // face squash: 1 (upright) → FLAT (lying)
      const th = s * 0.16 * tilt;                       // visible thickness grows as it lies down
      const n = Math.max(1, Math.round(th / 1.5));
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(roll); ctx.globalAlpha = alpha;
      // body of the slab: stacked rims from the bottom up, lit from above
      for (let i = n; i >= 1; i--) {
        const off = th * i / n;
        ctx.save(); ctx.translate(0, off); ctx.scale(1, k);
        ctx.fillStyle = i === n ? '#031a16' : (i % 2 ? '#0b5247' : '#0e6a5b');
        rr(-s / 2, -s / 2, s, s, s * 0.2); ctx.fill(); ctx.restore();
      }
      // glowing rim on the floor under it
      ctx.save(); ctx.translate(0, th); ctx.scale(1, k);
      ctx.shadowColor = col; ctx.shadowBlur = s * (0.1 + 0.55 * glowAmt);
      ctx.strokeStyle = col; ctx.lineWidth = 2; rr(-s / 2, -s / 2, s, s, s * 0.2); ctx.stroke(); ctx.restore();
      // the face
      ctx.save(); ctx.scale(1, k); ctx.shadowColor = col; ctx.shadowBlur = s * (0.08 + 0.4 * glowAmt);
      rr(-s / 2, -s / 2, s, s, s * 0.2); ctx.save(); ctx.clip();
      if (imgOk) ctx.drawImage(img, -s / 2, -s / 2, s, s);
      else if (imgErr) { ctx.fillStyle = '#04141a'; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.fillStyle = col; ctx.font = `${s * 0.3}px "Share Tech Mono",monospace`; ctx.textAlign = 'center'; ctx.fillText('B·O·S·S', 0, s * 0.1); }
      // sheen sweeping over the face as it lights up
      const sh = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
      sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(214,255,243,0.55)'; ctx.lineWidth = 1.5; rr(-s / 2, -s / 2, s, s, s * 0.2); ctx.stroke();
      ctx.restore(); ctx.restore();
    }

    function drawLogo(t) {
      const size = Math.min(W, H) * 0.3;
      const [lx, ly] = P(0, landD);
      const thick = size * 0.16;
      const yEnd = ly - thick - size * FLAT * 0.0;      // face centre when resting: slab bottom touches the floor point
      const yHover = reduced ? yEnd - size * 1.0 : Math.max(H * 0.14, yEnd - H * 0.3);
      const p = clamp((t - T_FALL0) / (T_FALL1 - T_FALL0));
      const lit = clamp(t / 800);
      // it tumbles over backwards while dropping, so it lands face-up
      const tilt = p * p * (3 - 2 * p);
      const y = yHover + (yEnd - yHover) * ease.in(p) - (reduced ? 0 : size * 0.05 * Math.sin(Math.PI * clamp((t - T_FALL1) / 350)));
      const roll = reduced ? 0 : 0.12 * Math.sin(p * Math.PI) * (1 - p);
      const glowAmt = lit * (1 + 0.5 * clamp((t - T_FALL1) / 300));
      if (t >= T_IMPACT - 40) {                          // light pool on the floor
        const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly, size * 1.4);
        const pa = clamp((t - T_IMPACT) / 400) * 0.5;
        pool.addColorStop(0, col + Math.round(pa * 255).toString(16).padStart(2, '0')); pool.addColorStop(1, col + '00');
        ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.32); ctx.translate(-lx, -ly);
        ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(lx, ly, size * 1.4, 0, 6.2832); ctx.fill(); ctx.restore();
      }
      if (!reduced && t > T_IMPACT - 40 && t < T_IMPACT + 700) {   // impact ring
        const k = clamp((t - (T_IMPACT - 40)) / 740);
        ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.32);
        ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * (1 - k) + 0.5;
        ctx.shadowColor = col; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(0, 0, size * (0.4 + 2.0 * ease.out(k)), 0, 6.2832); ctx.stroke(); ctx.restore();
      }
      drawBadge(lx, y, size, tilt, roll, glowAmt, lit);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      return { lx, ly, size };
    }

    const LINES = ['kernel', 'field', 'nodes', 'ready'];
    function drawText(t, g) {
      const t0 = 2100;
      if (t < t0) return;
      // one row of status words; font shrinks until the whole row fits the screen
      let fs = Math.max(13, g.size * 0.17);
      const seps = 3, gap = fs * 1.4;
      const widthAt = f => { ctx.font = `${f}px "Share Tech Mono",monospace`; return LINES.reduce((n, l) => n + ctx.measureText('▸ ' + l).width, 0) + gap * seps; };
      while (fs > 9 && widthAt(fs) > W * 0.92) fs -= 1;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 6;       // dark halo keeps it readable over the grid
      let tf = Math.max(fs * 1.5, g.size * 0.2);
      ctx.font = `bold ${tf}px "Share Tech Mono",monospace`;
      while (tf > 12 && ctx.measureText('B · O · S · S').width > W * 0.92) { tf -= 1; ctx.font = `bold ${tf}px "Share Tech Mono",monospace`; }
      ctx.fillStyle = '#d6fff3'; ctx.globalAlpha = clamp((t - t0) / 300); ctx.textAlign = 'center';
      const ty = g.ly + g.size * 0.38;
      ctx.fillText('B · O · S · S', g.lx, ty);
      ctx.font = `${fs}px "Share Tech Mono",monospace`; ctx.textAlign = 'left';
      let x = g.lx - widthAt(fs) / 2; ctx.font = `${fs}px "Share Tech Mono",monospace`;
      const y = ty + tf * 1.5;
      LINES.forEach((ln, i) => {
        const last = i === LINES.length - 1, label = (last ? '✓ ' : '▸ ') + ln, w = ctx.measureText(label).width;
        const a = clamp((t - (t0 + 250 + i * 420)) / 250);
        if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = last ? col : '#d6fff3'; ctx.fillText(label, x, y); }
        x += w + gap;
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    function frame(now) {
      if (done) return;
      // accumulate time with each step capped, so a stalled main thread pauses the
      // animation instead of skipping it to the end
      if (!imgOk && !imgErr && now - wall0 < 1500) { raf = requestAnimationFrame(frame); return; }   // let the logo load first
      if (last) clock += Math.min(now - last, 50); last = now;
      const t = clock;
      ctx.clearRect(0, 0, W, H);
      drawGrid(t);
      const g = drawLogo(t);
      drawText(t, g);
      // dim vignette so the grid fades into the dark
      const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.1, W / 2, H * 0.55, H * 0.8);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.65)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      if (t >= DURATION) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    const wall0 = performance.now();
    raf = requestAnimationFrame(frame);
  });
}

export const Boot = { start, shouldRun, enabled, setEnabled, markUpdated };
if (typeof window !== 'undefined') window.BOSS_boot = Boot;
