const CACHE = 'backstax-v1';
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/index.html', '/geo-intelligence.js', '/data-engine.js', '/map-renderer.js', '/ui-controller.js']))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
