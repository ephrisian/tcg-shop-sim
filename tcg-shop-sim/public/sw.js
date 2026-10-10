const IMAGE_CACHE = 'tcg-sim-images-v1';
const IMAGE_PATTERN = /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('tcg-sim-images-') && name !== IMAGE_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Cache-first for card and product images, including remote card art.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isImage = request.destination === 'image' || IMAGE_PATTERN.test(url.pathname);
  if (!isImage || !/^https?:$/.test(url.protocol)) return;
  event.respondWith((async () => {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone()).catch(() => {});
    return response;
  })());
});
