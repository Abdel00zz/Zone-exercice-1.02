const CACHE_PREFIX = 'mathplus-fiches';
const CACHE_NAME = `${CACHE_PREFIX}-v3`;
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];
const TRUSTED_STATIC_ORIGINS = new Set([
  self.location.origin,
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // La synchronisation cloud reste toujours fraîche et n'entre jamais dans le cache PWA.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;
  if (!TRUSTED_STATIC_ORIGINS.has(url.origin)) return;

  if (request.mode === 'navigate') {
    // Document HTML : réseau d'abord (respecte le gate mot de passe / dernier déploiement), cache en secours hors-ligne.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Assets statiques (JS/CSS/polices/images) : cache d'abord pour la vitesse, mise à jour silencieuse en arrière-plan.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
