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
 *   • Reduce-motion → a calm still frame (no movement), shorter.
 *
 * Self-contained: the overlay div (#boot) is placed in index.html right after
 * <body> so there is no flash of the field first; this module draws into it.
 * It makes no network calls and holds no state beyond the two storage flags.
 */

const KEY_ON = 'BOSS_BOOT';          // 'off' disables
const KEY_SESSION = 'BOSS_BOOTED';   // sessionStorage: already ran this session
const LOGO = './bosslogo-192.png';
const DURATION = 3300;               // ms until fade-out begins
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
    const img = new Image(); let imgOk = false;
    img.onload = () => { imgOk = true; }; img.src = LOGO;

    let W = 0, H = 0, dpr = 1;
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = el.clientWidth || innerWidth; H = el.clientHeight || innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit(); addEventListener('resize', fit);

    let done = false, raf = 0, t0 = performance.now();
    const finish = () => {
      if (done) return; done = true;
      cancelAnimationFrame(raf); removeEventListener('resize', fit);
      el.removeEventListener('pointerdown', finish); removeEventListener('keydown', finish);
      el.style.transition = `opacity ${FADE}ms ease`; el.style.opacity = '0';
      setTimeout(() => { el.remove(); resolve(); }, FADE);
    };
    el.addEventListener('pointerdown', finish); addEventListener('keydown', finish);
    setTimeout(finish, 8000); // safety net

    // ── grid geometry (perspective floor) ──────────────────────────────────
    const ROWS = 15, COLS = 13;                       // half-width in columns
    const landD = ROWS * 0.6;                        // where the logo lands (depth units)
    const sc = d => Math.pow(clamp(d / ROWS, 0.02, 1), 1.7);
    const P = (i, d) => {                            // world (column, depth) → screen
      const s = sc(d), hy = H * 0.3;
      return [W / 2 + i * (W / 4.2) * s, hy + (H * 0.98 - hy) * s];
    };

    function drawGrid(t, tImpact) {
      const R = t < tImpact ? -1 : (t - tImpact) * 0.0105;     // wavefront radius, grid units / ms
      ctx.lineCap = 'round';
      const seg = (a, b, i0, d0, i1, d1) => {
        const mi = (i0 + i1) / 2, md = (d0 + d1) / 2;
        const dist = Math.hypot(mi, (md - landD) * 0.8);
        let glow = 0;
        if (R >= 0) {
          // repeating fronts: an LED-style pulse every ~5.2 grid units
          const period = 5.2;
          for (let k = 0; k < 4; k++) {
            const front = R - k * period;
            if (front < 0 || front > 22) continue;
            glow = Math.max(glow, Math.exp(-Math.pow((dist - front) / 0.9, 2)) * (1 - front / 26));
          }
        }
        const depthFade = 0.25 + 0.75 * sc(md);
        const base = 0.13 * depthFade * clamp(t / 500);
        ctx.globalAlpha = clamp(base + glow * 0.95);
        ctx.lineWidth = 1 + glow * 2.2 * depthFade;
        ctx.strokeStyle = glow > 0.15 ? '#ffffff' : col;
        if (glow > 0.05) { ctx.shadowColor = col; ctx.shadowBlur = 10 * glow; } else ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      };
      for (let j = 1; j <= ROWS; j++)                      // horizontal lines (cell by cell)
        for (let i = -COLS; i < COLS; i++) seg(P(i, j), P(i + 1, j), i, j, i + 1, j);
      for (let i = -COLS; i <= COLS; i++)                  // lines receding to the horizon
        for (let j = 1; j < ROWS; j++) seg(P(i, j), P(i, j + 1), i, j, i, j + 1);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    function drawLogo(t) {
      const size = Math.min(W, H) * 0.24;
      const [lx, ly] = P(0, landD);
      const tFall0 = 350, tFall1 = 1150;
      const p = clamp((t - tFall0) / (tFall1 - tFall0));
      const yEnd = ly - size * 0.62, yStart = -size;
      const rebound = reduced ? 0 : -size * 0.07 * Math.sin(Math.PI * clamp((t - tFall1) / 380)) ;
      const y = reduced ? yEnd : yStart + (yEnd - yStart) * ease.in(p) + rebound;
      const lit = reduced ? 1 : clamp((t - 150) / 1000);         // illumination ramps while falling
      // light pool on the floor
      const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly, size * 1.5);
      const poolA = clamp((t - 900) / 500) * 0.5 * (reduced ? 1 : 1);
      pool.addColorStop(0, col + Math.round(poolA * 255).toString(16).padStart(2, '0')); pool.addColorStop(1, col + '00');
      ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.32); ctx.translate(-lx, -ly);
      ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(lx, ly, size * 1.5, 0, 6.2832); ctx.fill(); ctx.restore();
      // impact ring
      if (!reduced && t > tFall1 - 60 && t < tFall1 + 700) {
        const k = clamp((t - (tFall1 - 60)) / 760);
        ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.32);
        ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * (1 - k) + 0.5;
        ctx.shadowColor = col; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(0, 0, size * (0.4 + 2.2 * ease.out(k)), 0, 6.2832); ctx.stroke(); ctx.restore();
      }
      ctx.globalAlpha = 0.25 + 0.75 * lit;
      ctx.shadowColor = col; ctx.shadowBlur = size * (0.15 + 0.45 * lit);
      if (imgOk) ctx.drawImage(img, lx - size / 2, y, size, size);
      else { ctx.fillStyle = col; ctx.font = `${size * 0.3}px "Share Tech Mono",monospace`; ctx.textAlign = 'center'; ctx.fillText('B·O·S·S', lx, y + size * 0.55); }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      return { lx, ly, size };
    }

    const LINES = ['kernel', 'field', 'nodes', 'ready'];
    function drawText(t, g) {
      const a = clamp((t - 1500) / 400);
      if (a <= 0) return;
      ctx.textAlign = 'center'; ctx.fillStyle = col;
      ctx.font = `${Math.max(12, g.size * 0.16)}px "Share Tech Mono",monospace`;
      ctx.globalAlpha = a * 0.9;
      const step = Math.min(LINES.length, Math.floor((t - 1500) / 380) + 1);
      ctx.fillText('B · O · S · S', g.lx, g.ly + g.size * 0.55);
      ctx.globalAlpha = a * 0.55;
      ctx.font = `${Math.max(10, g.size * 0.12)}px "Share Tech Mono",monospace`;
      ctx.fillText(LINES.slice(0, step).join('  ·  '), g.lx, g.ly + g.size * 0.8);
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (done) return;
      const t = reduced ? 2400 : now - t0;
      ctx.clearRect(0, 0, W, H);
      // dim vignette so the grid fades into the dark
      const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.1, W / 2, H * 0.55, H * 0.8);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.65)');
      drawGrid(t, 1150);
      const g = drawLogo(t);
      drawText(t, g);
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      if (reduced) { raf = 0; setTimeout(finish, 900); return; }
      if (t >= DURATION) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
}

export const Boot = { start, shouldRun, enabled, setEnabled, markUpdated };
if (typeof window !== 'undefined') window.BOSS_boot = Boot;
