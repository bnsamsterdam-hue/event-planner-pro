self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil((caches&&caches.keys?caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}):Promise.resolve()).then(function(){return self.clients.claim();})); });
self.addEventListener('fetch', function(e){ return; });
