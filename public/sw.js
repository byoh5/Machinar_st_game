const CACHE_NAME = 'machinar-mvp-v3';

const resolveScopeUrl = (path) => new URL(path, self.location.href).toString();

const CORE_ASSETS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'assets/backgrounds/scrap_yard.webp',
  'assets/backgrounds/sewer_gate.webp',
  'assets/backgrounds/clock_tower.webp',
  'assets/backgrounds/city_gate.webp',
  'assets/backgrounds/steam_square.webp',
  'assets/backgrounds/train_hub.webp',
  'assets/backgrounds/radio_lab.webp',
  'assets/backgrounds/outer_rooftop.webp',
  'assets/characters/hero_player.svg',
  'assets/characters/scrap_merchant.svg',
  'assets/characters/valve_guard.svg',
  'assets/characters/tower_mechanic.svg',
  'assets/characters/gate_sentinel.svg',
  'assets/characters/signal_operator.svg',
  'assets/characters/rail_dispatcher.svg',
  'assets/characters/lab_engineer.svg',
  'assets/characters/rooftop_watcher.svg',
  'assets/items/wire.svg',
  'assets/items/battery.svg',
  'assets/items/power_core.svg',
  'assets/items/small_gear.svg',
  'assets/items/oil_can.svg',
  'assets/items/lubricated_rotor.svg',
  'assets/props/wire_bundle.svg',
  'assets/props/battery_cell.svg',
  'assets/props/power_panel.svg',
  'assets/props/sewer_door.svg',
  'assets/props/valve_lock.svg',
  'assets/props/workbench.svg',
  'assets/props/generator_switch.svg',
  'assets/props/security_console.svg',
  'assets/props/gate_core_slot.svg',
  'assets/props/gear_piece.svg',
  'assets/props/oil_can_prop.svg',
  'assets/props/signal_panel.svg',
  'assets/props/route_lock.svg',
  'assets/props/antenna_switch.svg',
  'assets/props/amplifier_slot.svg',
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
