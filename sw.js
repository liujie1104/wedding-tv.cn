const CACHE_NAME = 'wedding-tv-v3';

// Only pre-cache fixed static brand icons and assets
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/og.png',
  '/manifest.json'
];

// Install: pre-cache static brand assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up ALL old caches (including wedding-tv-v1, wedding-tv-v2)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler: strict policy
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Only handle GET requests
  if (req.method !== 'GET') {
    return;
  }

  // 2. Network-Only for all API routes, analytics, third-parties
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('hm.baidu.com') ||
    url.hostname.includes('googlesyndication.com') ||
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('doubleclick.net')
  ) {
    return; // Standard network fetch
  }

  // 3. Network-Only for all HTML documents & navigations (never cache dynamic HTML or private user pages)
  if (req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    return;
  }

  // 4. Network-Only for dynamic user data, uploads, or images from API
  if (url.pathname.startsWith('/api/img') || url.pathname.startsWith('/api/avatar') || url.pathname.startsWith('/api/poster-img')) {
    return;
  }

  // 5. Stale-While-Revalidate for static assets (.css, .js, .woff2, .ttf, static images)
  const isStaticAsset = /\.(css|js|woff2?|ttf|png|svg|ico|webp|jpg|jpeg)$/i.test(url.pathname);
  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(req).then(cached => {
        const fetchPromise = fetch(req).then(res => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            // Respect Cache-Control: private, no-store
            const cacheControl = res.headers.get('cache-control') || '';
            if (!cacheControl.includes('no-store') && !cacheControl.includes('private')) {
              return cache.put(req, res.clone()).then(() => res);
            }
          }
          return res;
        }).catch(err => {
          if (cached) return cached;
          throw err;
        });

        if (cached) {
          event.waitUntil(fetchPromise.catch(() => {}));
          return cached;
        }

        return fetchPromise;
      });
    })
  );
});
