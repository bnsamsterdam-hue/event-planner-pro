self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    try { var keys = await caches.keys(); await Promise.all(keys.map(function(k){ return caches.delete(k); })); } catch(e) {}
    try { await self.clients.claim(); } catch(e) {}
  })());
});
self.addEventListener('fetch', function(e){ return; });
