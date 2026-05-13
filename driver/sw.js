self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    if (self.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  // Geen cache: telefoon moet altijd de nieuwste driver.js en opdrachten ophalen.
  e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => fetch(e.request)));
});
