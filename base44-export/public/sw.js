/* Service worker minimal — cache shell pour usage terrain */
const CACHE = 'phoenix-sekur-v5';
const ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/phoenix-sekur-logo.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      const clone = res.clone();
      if (res.ok && request.url.startsWith(self.location.origin)) {
        caches.open(CACHE).then((c) => c.put(request, clone));
      }
      return res;
    }).catch(() => cached)),
  );
});
