// CACHE VERSION — bump this every deployment to force iOS PWA to reload fresh files
const CACHE_NAME = 'deutsch-c1-cache-v13';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=13',
  './app.js?v=13',
  './manifest.json',
  './icon.png'
];

// Install: cache all assets fresh
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: delete ALL old caches, take control immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first strategy — always try network, fallback to cache
// This ensures new deployments are always picked up immediately
self.addEventListener('fetch', (e) => {
  // Bypass Service Worker for cross-origin requests
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Bypass for Firebase realtime DB
  if (e.request.url.includes('firebaseio.com') || e.request.url.includes('googleapis.com')) {
    return;
  }

  e.respondWith(
    fetch(e.request).then((networkResponse) => {
      // Update cache with fresh response
      if (e.request.method === 'GET') {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseClone);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Offline fallback: serve from cache
      return caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        // For navigation, serve index.html
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
