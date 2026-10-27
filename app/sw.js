'use strict';

const CACHE_NAME = 'oraison-cache-v1';
const PRECACHE_URLS = ['./', 'index.html', 'manifest.json', 'favicon.png', 'icons/Icon-192.png', 'icons/Icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE_URLS)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isOraison = url.origin === self.location.origin;
  const isGoogle = ['www.gstatic.com', 'fonts.gstatic.com', 'fonts.googleapis.com'].includes(url.hostname);
  if (!isOraison && !isGoogle) return;

  const isStatic = isGoogle || ['/assets/', '/canvaskit/'].some((p) => url.pathname.includes(p)) ||
    /\.(js|wasm|json|png|otf|ttf|woff2)$/.test(url.pathname);

  const putInCache = (res, allowOpaque) => {
    if (res && (res.status === 200 || (allowOpaque && res.type === 'opaque'))) {
      const clone = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, clone));
    }
    return res;
  };

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          fetch(req).then((res) => putInCache(res, false)).catch(() => {});
          return cached;
        }
        return fetch(req).then((res) => putInCache(res, true));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => putInCache(res, false)).catch(() => cached);
      return cached || network;
    })
  );
});
