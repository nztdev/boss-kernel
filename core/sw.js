// B.O.S.S. Service Worker — Somatic Cache
// ---------------------------------------------------------------------------
// v0.9.1 — what changed and why:
//   • Was CACHE-FIRST under a cache name that never changed, so an installed
//     (home-screen) BOSS could keep serving an old index.html forever, and the
//     kernel's JS modules were not cached at all (so "offline" only half worked).
//   • Now NETWORK-FIRST with the cache as the offline fallback: online you
//     always get the latest files; offline you get the last good copy.
//   • Every shell file and kernel module is pre-cached on install, so the first
//     offline launch works too.
//   • Bump BUILD whenever you ship (the page shows it in ⚙ Settings). Changing
//     this file is also what makes browsers install the new worker.
// The Python Cortex (port 5000) is a live connection and is never cached.

const BUILD      = '0.9.1';
const CACHE_NAME = 'boss-' + BUILD;

const SHELL = [
  './', './index.html', './manifest.json', './bosslogo.jpg',
  '../heart/heart.js', '../engine/engine.js', '../registry/registry.js',
  '../nervous/nervous.js', '../immune/immune.js',
  '../actions/backup.js',   '../actions/chronos.js', '../actions/clipboard.js',
  '../actions/comms.js',    '../actions/core.js',    '../actions/cortex.js',
  '../actions/files.js',    '../actions/launch.js',  '../actions/location.js',
  '../actions/media.js',    '../actions/memory.js',  '../actions/secure.js',
  '../actions/soma.js',     '../actions/vision.js',  '../actions/voice.js',  '../actions/ui.js',
  '../actions/weather.js',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // One missing file must not break the whole install.
    await Promise.all(SHELL.map(async path => {
      try {
        const res = await fetch(new Request(path, { cache: 'no-cache' }));
        if (res.ok) await cache.put(path, res);
      } catch (_) { /* offline during install, or file not present */ }
    }));
  })());
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Remove every older cache version
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', build: BUILD }));
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Cortex API calls: live only, never cached
  if (req.url.includes(':5000')) {
    event.respondWith(fetch(req).catch(() => new Response('{"error":"cortex offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Everything off-site (engine APIs, weather, fonts…) is the browser's business
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // 'no-cache' = revalidate with the server, skipping the browser's own stale copy
    const res = await fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }));
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req, { ignoreSearch: true }))
             || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (hit) return hit;
    throw err;
  }
}