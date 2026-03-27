/* ═══════════════════════════════════════════════════════════════════════
   BACKSTAX v4.2 — SERVICE WORKER
   ═══════════════════════════════════════════════════════════════════════
   Provides offline capability and caches static assets for PWA support.
   ═══════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'backstax-v4.2.0';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Assets to cache on install (static resources)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/ui-controller.js',
  '/map-renderer.js'
];

// External resources to cache on first request
const EXTERNAL_PATTERNS = [
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /unpkg\.com\/leaflet/
];

/* ─── INSTALL EVENT ───────────────────────────────────────────────────────
   Pre-cache static assets when the service worker is installed.
─────────────────────────────────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[BACKSTAX SW] Caching static assets');
        // Cache static assets individually to handle failures gracefully
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[BACKSTAX SW] Failed to cache: ${url}`, err.message);
            })
          )
        );
      })
      .then(() => {
        console.log('[BACKSTAX SW] Install complete');
        return self.skipWaiting();
      })
  );
});

/* ─── ACTIVATE EVENT ──────────────────────────────────────────────────────
   Clean up old caches when a new service worker activates.
─────────────────────────────────────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[BACKSTAX SW] Removing old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[BACKSTAX SW] Activate complete');
        return self.clients.claim();
      })
  );
});

/* ─── FETCH EVENT ─────────────────────────────────────────────────────────
   Serve from cache, fallback to network, cache external resources.
─────────────────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.match(request)
          .then((cachedResponse) => {
            // Return cached response if available and fresh
            if (cachedResponse) {
              // Check if cache is stale (for API calls, always fetch fresh)
              const isApiRequest = url.pathname.includes('/api/') || 
                                   url.hostname.includes('api.');
              
              if (!isApiRequest) {
                return cachedResponse;
              }
            }

            // Fetch from network
            return fetch(request)
              .then((networkResponse) => {
                // Cache successful responses
                if (networkResponse && networkResponse.status === 200) {
                  const shouldCache = EXTERNAL_PATTERNS.some(pattern => 
                    pattern.test(url.hostname)
                  );

                  if (shouldCache) {
                    cache.put(request, networkResponse.clone());
                  }
                }
                return networkResponse;
              })
              .catch((error) => {
                // Network failed, return cached version if available
                if (cachedResponse) {
                  return cachedResponse;
                }

                // Return offline fallback for navigation requests
                if (request.mode === 'navigate') {
                  return caches.match('/index.html');
                }

                throw error;
              });
          });
      })
  );
});

/* ─── MESSAGE EVENT ───────────────────────────────────────────────────────
   Handle messages from the main application.
─────────────────────────────────────────────────────────────────────────── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[BACKSTAX SW] Service Worker loaded v4.2.0');
