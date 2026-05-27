const CACHE = 'spacerollr-v1';
const ASSETS = [
  '/spacerollr-office/',
  '/spacerollr-office/index.html',
  '/spacerollr-office/css/style.css',
  '/spacerollr-office/js/config.js',
  '/spacerollr-office/js/levels.js',
  '/spacerollr-office/js/game.js',
  '/spacerollr-office/audio/level1.mp3',
  '/spacerollr-office/audio/level2.mp3',
  '/spacerollr-office/audio/level3.mp3',
  '/spacerollr-office/audio/level4.mp3',
  '/spacerollr-office/audio/level5.mp3',
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
