const CACHE_PREFIX = 'mathplus-fiches';
// Vite substitutes these values for every production build.
const CACHE_NAME = `${CACHE_PREFIX}-__BUILD_ID__`;
const BUILD_ASSETS = /* __PRECACHE_ASSETS__ */ [];
const APP_SHELL = [
  '/',
  ...BUILD_ASSETS,
];
const TRUSTED_STATIC_ORIGINS = new Set([
  self.location.origin,
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
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
    // A 401 remains authoritative online. Offline always serves the HTML
    // installed together with this cache's complete set of local chunks.
    // Replacing only HTML could leave an offline page pointing at absent chunks.
    event.respondWith(
      fetch(request)
        .catch(async () => (await caches.open(CACHE_NAME)).match('/')
          .then((cached) => cached || Response.error()))
    );
    return;
  }

  // Do not turn arbitrary same-origin GETs into persisted responses.
  const isLocalAsset = url.origin === self.location.origin && (
    BUILD_ASSETS.includes(url.pathname)
    || ['script', 'style', 'font', 'image', 'manifest'].includes(request.destination)
  );
  if (url.origin === self.location.origin && !isLocalAsset) return;

  // Fingerprinted build assets are immutable and need no background fetch.
  // Optional remote fonts/MathJax are cached only after being requested online.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Preview/CDN servers may add Vary: Origin to JS/CSS. The immutable,
      // same-origin build files contain identical bytes for module CORS and
      // install-time requests, so those files must not miss the precache.
      const cached = await cache.match(request, {
        ignoreVary: isLocalAsset && BUILD_ASSETS.includes(url.pathname),
      });
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const clone = response.clone();
            event.waitUntil(cache.put(request, clone));
          }
          return response;
        })
        .catch(() => Response.error());
    })
  );
});
