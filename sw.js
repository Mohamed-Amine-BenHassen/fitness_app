// Cache-first app shell. Bump CACHE_NAME on EVERY change to a precached file,
// or the installed app keeps serving the old bundle.

const CACHE_NAME = 'ppl-v9';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './src/core/program.js',
  './src/core/dates.js',
  './src/core/schema.js',
  './src/core/sets.js',
  './src/core/nutrition.js',
  './src/core/backup.js',
  './src/core/techniques.js',
  './src/core/timer.js',
  './src/core/plans.js',
  './src/core/foods.js',
  './src/core/records.js',
  './src/data/store.js',
  './src/ui/dom.js',
  './src/ui/workout.js',
  './src/ui/protein.js',
  './src/ui/backup-ui.js',
  './src/ui/technique.js',
  './src/ui/timer-bar.js',
  './src/ui/plan.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
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
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navigations: serve the shell so a deep link or refresh works offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
