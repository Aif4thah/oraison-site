'use strict';

const CACHE_NAME = 'oraison-cache-v1';

// Fichiers vitaux pré-chargés dans le cache dès l'installation
const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.json',
  'favicon.png',
  'icons/Icon-192.png',
  'icons/Icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isOraisonOrigin = url.origin === self.location.origin;
  const isGoogleCdn = url.hostname === 'www.gstatic.com' ||
                      url.hostname === 'fonts.gstatic.com' ||
                      url.hostname === 'fonts.googleapis.com';

  if (!isOraisonOrigin && !isGoogleCdn) return;

  // Ressources statiques et lourdes (Dart JS, CanvasKit, WASM, JSON, icônes, polices)
  // Stratégie : Cache-First avec mise à jour discrète en arrière-plan
  const isStaticAsset = (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.otf') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/canvaskit/') ||
    isGoogleCdn
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(req).then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

    // Pour index.html : Stale-While-Revalidate (affichage instantané + actualisation discrète)
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
