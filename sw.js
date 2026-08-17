// sw.js — caches the app shell (HTML/CSS/JS) so the interface itself still
// loads when offline. Quran text/audio requests are NOT intercepted here;
// those already have their own localStorage cache (see js/api.js), and any
// surah not previously opened will need a connection, which the app
// communicates clearly via its own offline/error states.

const CACHE_NAME = 'quranread-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './css/base.css',
  './css/themes.css',
  './css/components.css',
  './js/app.js',
  './js/api.js',
  './js/storage.js',
  './js/audio.js',
  './js/router.js',
  './js/ui/common.js',
  './js/ui/home.js',
  './js/ui/surahIndex.js',
  './js/ui/reader.js',
  './js/ui/bookmarks.js',
  './js/ui/search.js',
  './js/ui/settings.js',
  './js/ui/playerBar.js',
  './favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => {}) // don't block install if one asset fails (e.g. dev server quirks)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin GET requests for the app shell; everything else
  // (the Quran API, fonts, etc.) goes straight to the network as normal.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});
