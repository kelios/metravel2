const CACHE_VERSION = 'v1.1.4';
const STATIC_CACHE = `metravel-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `metravel-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `metravel-images-${CACHE_VERSION}`;
const JS_CACHE = `metravel-js-${CACHE_VERSION}`;
const CRITICAL_CACHE = `metravel-critical-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
];

// Критичні JS chunks для travel pages (будуть prefetch при першому візиті)
const CRITICAL_JS_CHUNKS = [
  'TravelDetailsContainer',
  'GallerySection',
  'TravelDescription',
  'Map',
  'NetworkStatus',
  'ConsentBanner',
];

const MAX_CACHE_SIZE = 100;
const MAX_IMAGE_CACHE_SIZE = 50;
const MAX_JS_CACHE_SIZE = 200;
const CACHE_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days
const JS_CACHE_EXPIRATION_TIME = 30 * 24 * 60 * 60 * 1000; // 30 days для JS chunks

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(() => {
      console.info('SW: Static cache install failed');
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('metravel-') && 
                  name !== STATIC_CACHE && 
                  name !== DYNAMIC_CACHE && 
                  name !== IMAGE_CACHE && 
                  name !== JS_CACHE &&
                  name !== CRITICAL_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Prefetch критичних ресурсів для travel pages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PREFETCH_TRAVEL_RESOURCES') {
    const url = event.data.url;
    event.waitUntil(prefetchCriticalResources(url));
  }
});

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE));
    return;
  }

  // JS chunks з hash в імені (immutable) — агресивне кешування
  if (request.destination === 'script') {
    const isHashedChunk = /\/_expo\/static\/js\/web\/.*-[a-f0-9]{32}\.js$/.test(url.pathname);
    
    if (isHashedChunk) {
      // Immutable chunks — cache-first з довгим TTL
      event.respondWith(cacheFirstLongTerm(request, JS_CACHE, MAX_JS_CACHE_SIZE));
      return;
    }

    event.respondWith(staleWhileRevalidate(request, JS_CACHE));
    return;
  }

  if (request.destination === 'style' || request.destination === 'font') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request, cacheName = DYNAMIC_CACHE, maxSize = MAX_CACHE_SIZE) {
  try {
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fetch(request);
    }
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const maxAge = cacheName === JS_CACHE ? JS_CACHE_EXPIRATION_TIME : CACHE_EXPIRATION_TIME;
    
    if (cached) {
      const cacheDate = cached.headers.get('sw-cache-date');
      if (cacheDate) {
        const age = Date.now() - parseInt(cacheDate, 10);
        if (age > maxAge) {
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
  } catch {
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
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    if (request.destination === 'document') {
      return new Response('Offline', { status: 503 });
    }
    
    return new Response('Network error', { status: 503 });
  }
}

// Cache-first з довгим TTL для immutable chunks (з hash в імені)
async function cacheFirstLongTerm(request, cacheName = JS_CACHE, maxSize = MAX_JS_CACHE_SIZE) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      // Immutable chunks — завжди повертаємо з кешу
      return cached;
    }

    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.append('sw-cache-date', Date.now().toString());
      headers.append('Cache-Control', 'public, max-age=31536000, immutable');
      
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
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate для entry bundle та динамічних ресурсів
async function staleWhileRevalidate(request, cacheName = JS_CACHE) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    // Fetch в фоні для оновлення кешу
    const fetchPromise = fetch(request).then(response => {
      if (response && response.status === 200) {
        const responseToCache = response.clone();
        const headers = new Headers(responseToCache.headers);
        headers.append('sw-cache-date', Date.now().toString());
        
        responseToCache.blob().then(blob => {
          const cachedResponse = new Response(blob, {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers: headers,
          });
          cache.put(request, cachedResponse);
        });
      }
      return response;
    }).catch(() => null);
    
    // Повертаємо кешовану версію одразу, якщо є
    return cached || fetchPromise;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// Prefetch критичних JS chunks для travel pages
async function prefetchCriticalResources(pageUrl) {
  try {
    // NOTE: CRITICAL_CACHE is kept for backwards compatibility, but scripts are stored in JS_CACHE
    // so they are actually served by the SW fetch handler.
    const cache = await caches.open(JS_CACHE);
    await self.clients.matchAll().catch(() => []);
    
    const safeUrl = (() => {
      try {
        const base = self.location && self.location.origin ? self.location.origin : '';
        const u = new URL(pageUrl || '/', base);
        // Only allow same-origin prefetch.
        if (base && u.origin !== base) return new URL('/', base).toString();
        return u.toString();
      } catch {
        return '/';
      }
    })();

    // Знаходимо всі JS chunks на сторінці (для поточної сторінки, а не лише '/')
    const response = await fetch(safeUrl, { method: 'GET', credentials: 'omit' });
    const html = await response.text();
    const scriptMatches = html.matchAll(/<script[^>]+src="([^"]+)"/g);
    
    const criticalUrls = [];
    for (const match of scriptMatches) {
      const src = match[1];
      if (!src) continue;
      // Keep it tight: only same-origin Expo web JS.
      if (!src.startsWith('/_expo/static/js/web/')) continue;
      if (!src.endsWith('.js')) continue;

      // Перевіряємо чи це критичний chunk (або entry/common)
      const isCriticalNamed = CRITICAL_JS_CHUNKS.some((chunk) => src.includes(chunk));
      const isEntryOrCommon = src.includes('/entry-') || src.includes('/__common-');
      if (isCriticalNamed || isEntryOrCommon) criticalUrls.push(src);
    }

    // Prefetch критичних ресурсів
    const uniq = Array.from(new Set(criticalUrls));
    await Promise.all(
      uniq.map((url) =>
        fetch(url, { method: 'GET', credentials: 'omit' })
          .then((res) => {
            if (res && res.status === 200) {
              cache.put(url, res.clone());
            }
          })
          .catch(() => {})
      )
    );

    // Keep JS cache size bounded.
    limitCacheSize(JS_CACHE, MAX_JS_CACHE_SIZE);
  } catch (error) {
    console.info('SW: Prefetch failed', error);
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
    console.info('SW: Cache size limit error', error);
  }
}
