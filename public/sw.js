const CACHE = 'lifeops-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './lifeops-icon.svg'];
const SUPABASE_PATHS = ['/rest/', '/auth/', '/storage/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isSupabaseRequest(request) {
  const url = new URL(request.url);
  return SUPABASE_PATHS.some((path) => url.pathname.includes(path))
    || /\.supabase\.(co|in|net)$/i.test(url.hostname);
}

function hasCredentials(request) {
  return request.credentials === 'include'
    || Boolean(request.headers.get('authorization'))
    || Boolean(request.headers.get('cookie'));
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate') return false;
  return request.destination === 'script'
    || request.destination === 'style'
    || request.destination === 'image'
    || request.destination === 'font'
    || request.destination === 'manifest'
    || /\.(?:html?|css|js|mjs|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || isSupabaseRequest(request) || hasCredentials(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (!isStaticAsset(request)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
