// Minimal service worker: precaches the app shell so the game satisfies PWA
// installability checks and can reopen without a network round-trip, then
// opportunistically caches everything else (level images etc.) as it's
// fetched during play.
const CACHE_NAME = 'monster-land-v2';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/game.js',
  './js/entities.js',
  './js/level.js',
  './js/levels-data.js',
  './js/shops-data.js',
  './js/sprite.js',
  './js/input.js',
  './js/assets.js',
  './js/audio.js',
  './js/music.js',
  './js/constants.js',
  './icons/icon-any-192.png',
  './icons/icon-any-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
