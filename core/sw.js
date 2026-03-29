// B.O.S.S. Service Worker — Somatic Cache
// Caches the shell so the kernel runs fully offline.
// The cortex (Python) is never cached — it's a live connection.

const CACHE_NAME = 'boss-v0.5';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Clean up old cache versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Network-first for cortex API calls (never cache LAN responses)
  if (event.request.url.includes(':5000')) {
    event.respondWith(fetch(event.request).catch(() => new Response('{"error":"cortex offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }
  // Cache-first for shell assets
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});
