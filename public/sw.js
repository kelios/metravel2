const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `metravel-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `metravel-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `metravel-images-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg',
];

const MAX_CACHE_SIZE = 100;
const MAX_IMAGE_CACHE_SIZE = 50;
const CACHE_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS.filter(asset => asset !== '/offline.html'));
    }).catch(() => {
      console.log('SW: Static cache install failed');
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('metravel-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== IMAGE_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE));
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request, cacheName = DYNAMIC_CACHE, maxSize = MAX_CACHE_SIZE) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      const cacheDate = cached.headers.get('sw-cache-date');
      if (cacheDate) {
        const age = Date.now() - parseInt(cacheDate, 10);
        if (age > CACHE_EXPIRATION_TIME) {
          cache.delete(request);
        } else {
          return cached;
        }
      } else {
        return cached;
      }
    }

    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.append('sw-cache-date', Date.now().toString());
      
      const blob = await responseToCache.blob();
      const cachedResponse = new Response(blob, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      cache.put(request, cachedResponse);
      
      limitCacheSize(cacheName, maxSize);
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
      limitCacheSize(DYNAMIC_CACHE, MAX_CACHE_SIZE);
    }
    
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    if (request.destination === 'document') {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Network error', { status: 503 });
  }
}

async function limitCacheSize(cacheName, maxSize) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxSize) {
      await cache.delete(keys[0]);
      limitCacheSize(cacheName, maxSize);
    }
  } catch (error) {
    console.log('SW: Cache size limit error', error);
  }
}
