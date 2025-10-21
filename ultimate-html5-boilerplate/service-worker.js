const CACHE_VERSION = '0.0.1';
const CACHE_NAME = `uhb-cache-${CACHE_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles/index.css',
  './styles/variables.css',
  './styles/layout.css',
  './scripts/main.js',
  './scripts/core/logger.js',
  './scripts/core/state.js',
  './scripts/core/eventBus.js',
  './scripts/systems/gameLoop.js',
  './scripts/modules/sceneManager.js',
  './manifest.webmanifest',
  './assets/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
