const CACHE_VERSION = 'v3.12.0';
const STATIC_CACHE = `metravel-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `metravel-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `metravel-images-${CACHE_VERSION}`;
const JS_CACHE = `metravel-js-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
];

const CRITICAL_JS_CHUNKS = [
  'TravelDetailsContainer',
  'GallerySection',
  'TravelDescription',
  'Map',
  'NetworkStatus',
  'ConsentBanner',
];

const MAX_CACHE_SIZE = 100;
const MAX_IMAGE_CACHE_SIZE = 80;
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
          .filter((name) => {
            // Keep only STATIC_CACHE and IMAGE_CACHE across activations.
            // Everything else is purged to guarantee consistency after deploy:
            // - JS_CACHE: stale chunks cause module errors
            // - DYNAMIC_CACHE: stale HTML references old chunk URLs
            // - Old-version caches: no longer needed
            if (name === STATIC_CACHE || name === IMAGE_CACHE) {
              return false;
            }
            return name.startsWith('metravel-');
          })
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Notify all open tabs to reload so they pick up fresh HTML + entry bundle.
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
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

function buildOfflineHTML() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Metravel — нет соединения</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         display:flex;align-items:center;justify-content:center;min-height:100vh;
         background:#f5f5f5;color:#333;text-align:center;padding:24px}
    .c{max-width:420px}
    h1{font-size:1.5rem;margin-bottom:12px}
    p{font-size:1rem;color:#666;margin-bottom:24px;line-height:1.5}
    button{background:#e8a838;color:#fff;border:none;padding:12px 32px;
           border-radius:8px;font-size:1rem;cursor:pointer;font-weight:600}
    button:hover{background:#d4952e}
    .spinner{display:none;margin:16px auto;width:24px;height:24px;
             border:3px solid #ddd;border-top-color:#e8a838;border-radius:50%;
             animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .retry-info{font-size:.85rem;color:#999;margin-top:16px}
  </style>
</head>
<body>
  <div class="c">
    <h1>Нет соединения</h1>
    <p>Сервер временно недоступен. Проверьте подключение к интернету или попробуйте позже.</p>
    <button onclick="retry()">Попробовать снова</button>
    <div class="spinner" id="sp"></div>
    <p class="retry-info" id="ri"></p>
  </div>
  <script>
    var attempt=0;
    function retry(){
      document.getElementById('sp').style.display='block';
      document.getElementById('ri').textContent='Подключение...';
      location.reload();
    }
    function autoRetry(){
      attempt++;
      if(attempt>10){
        document.getElementById('ri').textContent='Автоматические попытки остановлены. Нажмите кнопку.';
        return;
      }
      document.getElementById('ri').textContent='Попытка '+attempt+'… (авто-повтор через 5 сек)';
      fetch(location.href,{method:'HEAD',cache:'no-store'}).then(function(r){
        if(r.ok) location.reload();
        else setTimeout(autoRetry,5000);
      }).catch(function(){setTimeout(autoRetry,5000);});
    }
    setTimeout(autoRetry,5000);
  </script>
</body>
</html>`;
}

function offlineResponse() {
  return new Response(buildOfflineHTML(), {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function networkFirstDocument(request) {
  try {
    // cache:'no-store' bypasses the browser HTTP cache entirely.
    // Without it, fetch() respects Cache-Control headers and can return
    // stale HTML from the HTTP cache — causing old chunk URLs to load.
    const response = await fetch(request, { cache: 'no-store' });
    // Cache successful document responses for offline fallback
    if (response && response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    // Try to serve cached version of the page
    const cached = await caches.match(request).catch(() => null);
    if (cached) return cached;
    // Try to serve cached root page as fallback for any navigation
    const rootCached = await caches.match(new Request(self.location.origin + '/')).catch(() => null);
    if (rootCached) return rootCached;
    return offlineResponse();
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

  // manifest.json must always be network-first to avoid serving stale 404
  if (url.pathname === '/manifest.json') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Proxy paths (e.g. /proxy/wfs/lasy) are reverse-proxied by nginx to
  // external services. Let them pass through without SW interception so
  // nginx cache headers and stale-serving work correctly.
  if (url.pathname.startsWith('/proxy/')) {
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE));
    return;
  }

  // JS chunks з hash в імені (immutable) — агресивне кешування
  if (request.destination === 'script') {
    const isExpoWebJs = url.pathname.startsWith('/_expo/static/js/web/');
    const isHashedChunk = isExpoWebJs && /-[a-f0-9]{8,}\.js$/i.test(url.pathname);
    
    if (isHashedChunk) {
      // Immutable chunks — cache-first з довгим TTL
      event.respondWith(cacheFirstLongTerm(request, JS_CACHE, MAX_JS_CACHE_SIZE));
      return;
    }

    event.respondWith(staleWhileRevalidate(request, JS_CACHE));
    return;
  }

  if (request.destination === 'font') {
    event.respondWith(cacheFirstLongTerm(request, STATIC_CACHE, MAX_CACHE_SIZE));
    return;
  }

  if (request.destination === 'style') {
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
    return cached || offlineResponse();
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
      return offlineResponse();
    }
    
    return new Response('Network error', { status: 503 });
  }
}

async function cacheFirstLongTerm(request, cacheName = JS_CACHE, maxSize = MAX_JS_CACHE_SIZE) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      // Validate that the cached response is actual JS, not an HTML fallback
      // (nginx SPA fallback can serve index.html with 200 for missing chunks).
      const ct = cached.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        cache.delete(request);
        // Fall through to network fetch below
      } else {
        return cached;
      }
    }

    const response = await fetch(request);

    // If the server returns 404 for a hashed chunk, the build has changed.
    // Do NOT cache the 404 response — trigger a page reload instead.
    if (response && response.status === 404) {
      cache.delete(request);
      // Notify clients to reload so they pick up the new HTML with correct chunk URLs.
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
      });
      return response;
    }

    if (response && response.status === 200) {
      // Verify the response is actually JS, not an HTML SPA fallback
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('text/html') && request.url.endsWith('.js')) {
        // Server returned HTML for a .js request — chunk doesn't exist.
        // Trigger reload instead of caching broken response.
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
        });
        return response;
      }

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
    return cached || offlineResponse();
  }
}

// Stale-while-revalidate для entry bundle та динамічних ресурсів
async function staleWhileRevalidate(request, cacheName = JS_CACHE) {
  try {
    const cache = await caches.open(cacheName);
    try {
      // Bypass browser HTTP cache for non-hashed scripts (entry bundle etc.)
      // whose URL stays the same across deploys but content changes.
      const response = await fetch(request, { cache: 'no-store' });
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
        limitCacheSize(cacheName, MAX_JS_CACHE_SIZE);
      }
      return response;
    } catch {
      const cached = await cache.match(request);
      return cached || offlineResponse();
    }
  } catch {
    const cached = await caches.match(request);
    return cached || offlineResponse();
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
    
    let i = 0;
    while (keys.length - i > maxSize) {
      await cache.delete(keys[i]);
      i++;
    }
  } catch (error) {
    console.info('SW: Cache size limit error', error);
  }
}
