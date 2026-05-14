self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async()=>{
    try{ const keys = await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); }catch(err){}
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
