const CACHE_VERSION = '__STAMPED_AT_BUILD__';
const STATIC_CACHE = `metravel-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `metravel-runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = ['/manifest.json', '/favicon.ico'];

const MAX_RUNTIME_ENTRIES = 150;
const STALE_SCRIPT_STATUSES = new Set([404, 410, 500, 502, 503, 504]);

function buildStaleChunkRecoveryScript() {
  return `;(() => {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', String(Date.now()));
    window.location.replace(url.toString());
  } catch (_err) {
    try {
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    } catch (_ignored) {}
  }
})();`;
}

function staleChunkScriptResponse() {
  return new Response(buildStaleChunkRecoveryScript(), {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

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
          .filter((name) => name.startsWith('metravel-') && name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  const type = event?.data?.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
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

function fallbackResponse(request) {
  try {
    if (request && (request.mode === 'navigate' || request.destination === 'document')) {
      return offlineResponse();
    }
  } catch {
    void 0;
  }
  return new Response('Network error', { status: 503 });
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request).catch(() => null);
    return cached || fallbackResponse(request);
  }
}

async function networkFirstDocument(request) {
  try {
    // cache:'no-store' bypasses the browser HTTP cache entirely.
    // Without it, fetch() respects Cache-Control headers and can return
    // stale HTML from the HTTP cache — causing old chunk URLs to load.
    const response = await fetch(request, { cache: 'no-store' });
    return response;
  } catch {
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

  if (request.destination === 'script') {
    event.respondWith(fetchScriptWithRecovery(event));
    return;
  }

  if (request.destination === 'image' || request.destination === 'font' || request.destination === 'style') {
    event.respondWith(cacheFirstRuntime(request));
    return;
  }

  event.respondWith(staleWhileRevalidateRuntime(request));
});

async function notifyStaleChunk(event, reason) {
  const payload = {
    type: 'SW_STALE_CHUNK',
    reason,
    url: event?.request?.url || '',
    ts: Date.now(),
  };

  try {
    const targetClientId = event?.clientId || event?.resultingClientId;
    if (targetClientId) {
      const client = await self.clients.get(targetClientId);
      if (client) {
        client.postMessage(payload);
        return;
      }
    }
  } catch {
    void 0;
  }

  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
      client.postMessage(payload);
    });
  } catch {
    void 0;
  }
}

async function fetchScriptWithRecovery(event) {
  const { request } = event;
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && STALE_SCRIPT_STATUSES.has(response.status)) {
      await notifyStaleChunk(event, `script-http-${response.status}`);
      return staleChunkScriptResponse();
    }
    return response;
  } catch {
    await notifyStaleChunk(event, 'script-network-error');
    return staleChunkScriptResponse();
  }
}

async function cacheFirstRuntime(request) {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
      limitCacheSize(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch {
    const cached = await caches.match(request).catch(() => null);
    return cached || fallbackResponse(request);
  }
}

async function staleWhileRevalidateRuntime(request) {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response && response.ok) {
          cache.put(request, response.clone()).catch(() => {});
          limitCacheSize(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
        }
        return response;
      })
      .catch(() => null);

    return cached || (await fetchPromise) || fallbackResponse(request);
  } catch {
    const cached = await caches.match(request).catch(() => null);
    return cached || fallbackResponse(request);
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
