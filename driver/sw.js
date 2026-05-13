self.addEventListener('install',function(e){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil((async function(){try{var ks=await caches.keys();await Promise.all(ks.map(function(k){return caches.delete(k)}));}catch(err){} await self.clients.claim();})());});
self.addEventListener('fetch',function(e){});
