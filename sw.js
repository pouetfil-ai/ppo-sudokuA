const CACHE_NAME = 'sudoku-cache-v2'; // Incrémenter la version pour forcer la mise à jour
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
  console.log('Service Worker: Installation en cours');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache ouvert, ajout des fichiers');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation terminée');
        // Forcer l'activation du nouveau service worker
        return self.skipWaiting();
      })
  );
});

// Activation du service worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activation en cours');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      console.log('Service Worker: Suppression des anciens caches');
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Suppression du cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Activation terminée');
      // Prendre le contrôle de tous les clients immédiatement
      return self.clients.claim();
    })
  );
});

// Stratégie Network First avec fallback sur cache
self.addEventListener('fetch', event => {
  // Ne gérer que les requêtes GET pour les ressources de l'app
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la requête réseau réussit, mettre en cache et retourner la réponse
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Si la requête réseau échoue, utiliser le cache
        console.log('Service Worker: Réseau indisponible, utilisation du cache pour', event.request.url);
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            // Si pas en cache, retourner une page d'erreur ou la page d'accueil
            return caches.match('/');
          });
      })
  );
});

// Écouter les messages pour forcer la mise à jour
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
