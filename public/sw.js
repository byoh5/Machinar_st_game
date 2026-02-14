const CACHE_NAME = 'machinar-mvp-v2';

const resolveScopeUrl = (path) => new URL(path, self.location.href).toString();

const CORE_ASSETS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'assets/backgrounds/scrap_yard.svg',
  'assets/backgrounds/sewer_gate.svg',
  'assets/backgrounds/clock_tower.svg',
  'assets/backgrounds/city_gate.svg',
  'assets/backgrounds/steam_square.svg',
  'assets/backgrounds/train_hub.svg',
  'assets/backgrounds/radio_lab.svg',
  'assets/backgrounds/outer_rooftop.svg',
  'assets/sfx/ui_click.wav',
  'assets/sfx/puzzle_success.wav',
  'assets/sfx/puzzle_error.wav',
  'assets/sfx/episode_complete.wav',
  'assets/sfx/ambient_loop.wav',
].map(resolveScopeUrl);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(resolveScopeUrl('index.html'))));
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
            });
            return response;
          })
          .catch(() => cached),
    ),
  );
});
