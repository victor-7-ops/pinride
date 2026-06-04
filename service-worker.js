// PinRide service worker
const SHELL_CACHE = 'pinride-shell-v4';
const TILE_CACHE = 'pinride-tiles-v1';

// App shell — cached on install so the app opens offline.
const SHELL_ASSETS = [
  'index.html',
  'driver.html',
  'offline.html',
  'manifest.json',
  'css/style.css',
  'js/geohash.js',
  'js/geohash.js?v=2',
  'js/passenger.js',
  'js/passenger.js?v=2',
  'js/driver.js',
  'js/driver.js?v=2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isTile(url) {
  return /tile\.openstreetmap\.org/.test(url);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = request.url;

  // Map tiles: cache-first, best effort. We do NOT promise full offline maps.
  if (isTile(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(request).then((cached) =>
          cached || fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          }).catch(() => cached)
        )
      )
    );
    return;
  }

  // Navigations: network-first, fall back to cache, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((c) => c || caches.match('offline.html'))
      )
    );
    return;
  }

  // Everything else (shell assets, libs): cache-first.
  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
