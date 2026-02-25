const CACHE_PREFIX = 'metravel-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name))
        );
      } catch {
        // noop
      }

      try {
        await self.registration.unregister();
      } catch {
        // noop
      }

      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.navigate(client.url);
        }
      } catch {
        // noop
      }
    })()
  );
});
