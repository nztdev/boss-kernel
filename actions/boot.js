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

    // ── the world: a hexagonal grid wrapped around a large sphere ───────────
    // A geodesic "Goldberg" mesh: cells are hexagons (plus 12 pentagons, like a football).
    // Nodes are the cell corners; edges are the grid lines. Orthographic view of the sphere.
    const v3 = {
      add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
      mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
      cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
      len: a => Math.hypot(a[0], a[1], a[2]), norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
      rot: (v, ax, an) => { const c = Math.cos(an), s2 = Math.sin(an), k = ax;           // Rodrigues
        const kv = v3.cross(k, v), kd = v3.dot(k, v);
        return [v[0] * c + kv[0] * s2 + k[0] * kd * (1 - c), v[1] * c + kv[1] * s2 + k[1] * kd * (1 - c), v[2] * c + kv[2] * s2 + k[2] * kd * (1 - c)]; },
    };
    const FREQ_LEVEL = 2;                                   // 2 → 162 cells (4× subdivision of an icosahedron)
    const world = (() => {
      const t = (1 + Math.sqrt(5)) / 2;
      let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v3.norm);
      let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      for (let l = 0; l < FREQ_LEVEL; l++) {
        const cache = new Map(), mid = (i, j) => {
          const k = i < j ? i + '_' + j : j + '_' + i;
          if (!cache.has(k)) { V.push(v3.norm(v3.mul(v3.add(V[i], V[j]), 0.5))); cache.set(k, V.length - 1); }
          return cache.get(k);
        };
        const NF = [];
        for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
        F = NF;
      }
      const nodes = F.map(([a, b, c]) => v3.norm(v3.add(v3.add(V[a], V[b]), V[c])));   // one node per triangle = a cell corner
      const cellFaces = V.map(() => []), edgeFaces = new Map();
      F.forEach((f, fi) => {
        f.forEach(vi => cellFaces[vi].push(fi));
        for (let q = 0; q < 3; q++) { const i = f[q], j = f[(q + 1) % 3], k = i < j ? i + '_' + j : j + '_' + i; (edgeFaces.get(k) || edgeFaces.set(k, []).get(k)).push(fi); }
      });
      const edges = [];
      edgeFaces.forEach(fs => { if (fs.length === 2) edges.push({ u: fs[0], v: fs[1], len: Math.acos(Math.max(-1, Math.min(1, v3.dot(nodes[fs[0]], nodes[fs[1]])))) }); });
      const adj = nodes.map(() => []); edges.forEach((e, i) => { adj[e.u].push(i); adj[e.v].push(i); });
      // the landing cell: a hexagon (6 corners), not one of the 12 pentagons
      const c0 = V.findIndex((p, i) => cellFaces[i].length === 6 && p[2] > 0.2);
      return { nodes, edges, adj, c0, centre: V[c0], corners: cellFaces[c0] };
    })();

    // Orient the sphere: the landing cell faces up-and-toward the viewer, one corner pointing right (flat-top hex).
    const PHI = 0.62;                                      // how far the landing cell leans back from facing the viewer (rad)
    const TV = [0, -Math.sin(PHI), Math.cos(PHI)];         // landing cell normal in view space (x right, y down, z toward viewer)
    const B1 = [1, 0, 0], B2 = v3.cross(TV, B1);           // tangent axes at the landing cell
    const orient = (() => {
      const n0 = world.centre, ax0 = v3.cross(n0, TV), sn = v3.len(ax0), an0 = Math.atan2(sn, v3.dot(n0, TV));
      const r1 = v => sn < 1e-6 ? v : v3.rot(v, v3.mul(ax0, 1 / sn), an0);
      const p = r1(world.nodes[world.corners[0]]);
      const u = v3.sub(p, v3.mul(TV, v3.dot(p, TV))), roll = Math.atan2(v3.dot(u, B2), v3.dot(u, B1));
      return v => v3.rot(r1(v), TV, -roll);
    })();
    const N = world.nodes.map(orient);
    const cornerPts = world.corners.map(i => N[i]).map(p => ({ p, a: Math.atan2(v3.dot(v3.sub(p, TV), B2), v3.dot(v3.sub(p, TV), B1)) })).sort((x, y) => x.a - y.a);
    const CELL_R = cornerPts.reduce((m, c) => m + v3.len(v3.sub(c.p, TV)), 0) / 6;   // cell corner radius (unit sphere)
    const RF = CELL_R * 0.9;                               // badge circumradius: fits inside the cell with a small gap

    // layout (depends on screen size)
    let Rs = 0, cx0 = 0, cy0 = 0;
    const layout = () => {
      Rs = Math.min(W * 0.9, H * 0.62); cx0 = W / 2;
      cy0 = H * 0.46 + Rs * Math.sin(PHI);                 // so the landing cell sits at 46% of the height
    };
    layout(); addEventListener('resize', layout);
    const MS_PER_RAD = reduced ? 1500 : 1000;              // how fast light travels along the lines
    const WAVE_OFFSET = [0, 1000];

    // Light spreads from the landing cell's six corners: shortest paths with jittered costs
    // (Dijkstra), so it advances branch by branch and never all at once. Two waves.
    const waves = [0, 1].map(() => {
      const n = N.length, ar = new Float64Array(n).fill(Infinity), done = new Uint8Array(n);
      const jit = world.edges.map(() => 0.65 + Math.random() * 1.0);
      world.corners.forEach(i => { ar[i] = Math.random() * 140; });
      for (let k = 0; k < n; k++) {
        let m = -1, best = Infinity;
        for (let i = 0; i < n; i++) if (!done[i] && ar[i] < best) { best = ar[i]; m = i; }
        if (m < 0) break; done[m] = 1;
        for (const ei of world.adj[m]) {
          const e = world.edges[ei], o = e.u === m ? e.v : e.u, c = ar[m] + e.len * jit[ei] * MS_PER_RAD;
          if (c < ar[o]) ar[o] = c;
        }
      }
      return ar;
    });

    let spin = 0;                                          // slow turn of the whole sphere (not under reduce-motion)
    const view = v => { const c = Math.cos(spin), s2 = Math.sin(spin); return [v[0] * c + v[2] * s2, v[1], -v[0] * s2 + v[2] * c]; };
    const scr = v => [cx0 + Rs * v[0], cy0 + Rs * v[1]];

    function drawGrid(t) {
      if (t < T_IMPACT) return;
      const tt = t - T_IMPACT, fadeIn = clamp(tt / 600);
      spin = reduced ? 0 : -0.16 * clamp(tt / 3200);
      // sphere body + limb glow
      const body = ctx.createRadialGradient(cx0 - Rs * 0.2, cy0 - Rs * 0.35, Rs * 0.1, cx0, cy0, Rs);
      body.addColorStop(0, 'rgba(12,60,50,' + (0.28 * fadeIn) + ')'); body.addColorStop(1, 'rgba(0,10,10,' + (0.0) + ')');
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx0, cy0, Rs, 0, 6.2832); ctx.fill();
      ctx.save(); ctx.globalAlpha = 0.5 * fadeIn; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.shadowColor = col; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(cx0, cy0, Rs, 0, 6.2832); ctx.stroke(); ctx.restore();
      // node screen positions
      const S = N.map(p => { const v = view(p); const q = scr(v); return [q[0], q[1], v[2], v]; });
      ctx.lineCap = 'round';
      for (const e of world.edges) {
        const a = S[e.u], b = S[e.v], zm = (a[2] + b[2]) / 2;
        if (zm < 0.02 && a[2] < 0.02 && b[2] < 0.02) continue;          // behind the limb
        const face = clamp(0.2 + 0.8 * zm) * fadeIn;                     // fades toward the horizon
        ctx.globalAlpha = 0.08 * face; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();      // the dark, unlit wire
        let res = 0, trail = 0, headU = 1, from = 0;
        for (let k = 0; k < 2; k++) {
          const A = waves[k], au = A[e.u], av = A[e.v], fwd = au <= av;
          const since = tt - ((fwd ? au : av) + WAVE_OFFSET[k]), dur = Math.max(40, Math.abs(au - av));
          if (since < 0) continue;
          const u = since / dur;
          res += (k ? 0.18 : 0.42) * (1 - Math.exp(-since / 900));
          if (u < 1.6) { const hv = u < 1 ? 1 : Math.exp(-(u - 1) * 3); if (hv > trail) { trail = hv; headU = u; from = fwd ? 0 : 1; } }
        }
        if (res <= 0) continue;
        const p0 = from ? b : a, p1 = from ? a : b, hu = headU < 1 ? headU : 1;
        const hx = p0[0] + (p1[0] - p0[0]) * hu, hy = p0[1] + (p1[1] - p0[1]) * hu;
        ctx.globalAlpha = clamp(res * face); ctx.lineWidth = 1.3;                  // fills in behind the head and stays, slowly brightening
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(hx, hy); ctx.stroke();
        if (trail > 0.05) {                                                        // the bright pulse, raised off the surface
          const lift = trail * 0.03 * Rs * (0.4 + 0.6 * zm);
          const bx = p0[0] + (p1[0] - p0[0]) * Math.max(0, hu - 0.55), by = p0[1] + (p1[1] - p0[1]) * Math.max(0, hu - 0.55);
          const nx = (hx - cx0) / Rs, ny = (hy - cy0) / Rs;                         // lift outward from the sphere centre
          ctx.globalAlpha = clamp((trail + 0.1) * face); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2 + 1.8 * trail * face;
          ctx.shadowColor = col; ctx.shadowBlur = 12 * trail;
          ctx.beginPath(); ctx.moveTo(bx + ((bx - cx0) / Rs) * lift, by + ((by - cy0) / Rs) * lift); ctx.lineTo(hx + nx * lift, hy + ny * lift); ctx.stroke();
          ctx.strokeStyle = col; ctx.shadowBlur = 0;
        }
      }
      // shock ring travelling over the surface from the landing cell
      if (!reduced && tt < 900) {
        const k = clamp(tt / 900), rho = 0.12 + 1.0 * ease.out(k);
        ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.beginPath(); let pen = false;
        for (let q = 0; q <= 72; q++) {
          const an = q / 72 * 6.2832, p = v3.add(v3.mul(TV, Math.cos(rho)), v3.mul(v3.add(v3.mul(B1, Math.cos(an)), v3.mul(B2, Math.sin(an))), Math.sin(rho)));
          const v = view(p); if (v[2] < 0.03) { pen = false; continue; }
          const sp = scr(v); pen ? ctx.lineTo(sp[0], sp[1]) : ctx.moveTo(sp[0], sp[1]); pen = true;
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // ── the badge: a thin hexagonal tile that drops onto the landing cell ───
    function drawLogo(t) {
      const p = clamp((t - T_FALL0) / (T_FALL1 - T_FALL0));
      const lit = clamp(t / 800);
      const glowAmt = lit * (1 + 0.5 * clamp((t - T_FALL1) / 300));
      const tilt = p * p * (3 - 2 * p);                                    // 0 → 1 while falling
      // it tumbles over backwards onto its back: leaning forward at first, ending face-up on the cell
      const th0 = PHI + (reduced ? 0.12 : 0.55), th = th0 * (1 - tilt);
      const Nn = v3.add(v3.mul(TV, Math.cos(th)), v3.mul(B2, Math.sin(th)));
      const A2 = v3.sub(v3.mul(B2, Math.cos(th)), v3.mul(TV, Math.sin(th)));
      const roll = reduced ? 0 : 0.14 * Math.sin(p * Math.PI) * (1 - p);
      const A1r = v3.add(v3.mul(B1, Math.cos(roll)), v3.mul(A2, Math.sin(roll)));
      const A2r = v3.sub(v3.mul(A2, Math.cos(roll)), v3.mul(B1, Math.sin(roll)));
      const thick = RF * 0.07;
      const drop = (reduced ? H * 0.12 : H * 0.3) * (1 - ease.in(p));         // starts high above its cell, falls to it
      const rebound = reduced ? 0 : -Rs * 0.012 * Math.sin(Math.PI * clamp((t - T_FALL1) / 350));
      const C = v3.add(TV, v3.mul(Nn, thick));
      const top = [], bot = [];
      for (let a = 0; a < 6; a++) {
        const ca = Math.cos(a * Math.PI / 3) * RF, sa = Math.sin(a * Math.PI / 3) * RF;
        const T3 = v3.add(C, v3.add(v3.mul(A1r, ca), v3.mul(A2r, sa)));
        top.push(scr(view(T3)));
        bot.push(scr(view(v3.sub(T3, v3.mul(Nn, thick)))));
      }
      const off = y => y - drop + rebound;
      const lx = cx0 + Rs * view(TV)[0], ly = cy0 + Rs * view(TV)[1];
      ctx.save(); ctx.globalAlpha = lit;
      if (t >= T_IMPACT - 40) {                                            // light pool under the tile
        const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly, Rs * CELL_R * 2.2);
        const pa = clamp((t - T_IMPACT) / 400) * 0.5;
        pool.addColorStop(0, col + Math.round(pa * 255).toString(16).padStart(2, '0')); pool.addColorStop(1, col + '00');
        ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(lx, ly, Rs * CELL_R * 2.2, 0, 6.2832); ctx.fill();
      }
      // body: base, then the six side walls, then the lit face
      ctx.fillStyle = '#031a16'; ctx.beginPath(); bot.forEach((q, i) => i ? ctx.lineTo(q[0], off(q[1])) : ctx.moveTo(q[0], off(q[1]))); ctx.closePath(); ctx.fill();
      for (let a = 0; a < 6; a++) {
        const b = (a + 1) % 6;
        ctx.fillStyle = a % 2 ? '#0b5247' : '#0e6a5b';
        ctx.beginPath(); ctx.moveTo(top[a][0], off(top[a][1])); ctx.lineTo(top[b][0], off(top[b][1])); ctx.lineTo(bot[b][0], off(bot[b][1])); ctx.lineTo(bot[a][0], off(bot[a][1])); ctx.closePath(); ctx.fill();
      }
      const cs = scr(view(C)), cxs = cs[0], cys = off(cs[1]);
      const ax = view(v3.mul(A1r, RF)), ay = view(v3.mul(A2r, RF));          // face axes → screen
      ctx.save(); ctx.translate(cxs, cys); ctx.transform(Rs * ax[0], Rs * ax[1], Rs * ay[0], Rs * ay[1], 0, 0);
      ctx.shadowColor = col; ctx.shadowBlur = Rs * RF * (0.08 + 0.4 * glowAmt);
      ctx.beginPath(); for (let a = 0; a < 6; a++) { const x = Math.cos(a * Math.PI / 3), y = Math.sin(a * Math.PI / 3); a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath();
      ctx.fillStyle = '#04141a'; ctx.fill(); ctx.shadowBlur = 0; ctx.save(); ctx.clip();
      if (imgOk) ctx.drawImage(img, -1, -1, 2, 2);
      else if (imgErr) { ctx.fillStyle = col; ctx.font = '0.5px "Share Tech Mono",monospace'; ctx.textAlign = 'center'; ctx.fillText('B·O·S·S', 0, 0.15); }
      const sh = ctx.createLinearGradient(-1, -1, 1, 1);
      sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
      ctx.strokeStyle = 'rgba(214,255,243,0.7)'; ctx.lineWidth = 0.05; ctx.shadowColor = col; ctx.shadowBlur = Rs * RF * 0.3 * glowAmt;
      ctx.beginPath(); for (let a = 0; a < 6; a++) { const x = Math.cos(a * Math.PI / 3), y = Math.sin(a * Math.PI / 3); a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke();
      ctx.restore(); ctx.restore();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      return { lx: W / 2, ly, size: Rs * RF * 2 };
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
      const ty = g.ly + g.size * 0.62;
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
