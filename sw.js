const CACHE_NAME = 'sudoku-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/script.js',
  '/styles.css',
  '/manifest.json',
  '/icon.svg'
];

// Installation du service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Activation du service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interception des requêtes
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retourner la réponse en cache si elle existe, sinon faire la requête
        return response || fetch(event.request);
      })
  );
});
