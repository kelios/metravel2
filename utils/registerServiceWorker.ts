export const registerServiceWorker = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;

  const isProd = window.location.hostname === 'metravel.by' || window.location.hostname === 'www.metravel.by';
  if (!isProd) return false;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker installed, will activate on next visit
          console.info('[SW] New version available, will reload on next navigation');
        }
      });
    });

    // Listen for messages from SW
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (!event.data) return;

        // SW signals stale chunk detected - force immediate reload with cache bust
        if (event.data.type === 'SW_STALE_CHUNK') {
          console.warn('[SW] Stale JS chunk detected, forcing reload...');
          const url = new URL(window.location.href);
          url.searchParams.set('_cb', String(Date.now()));
          window.location.replace(url.toString());
        }

        // SW signals new version ready - reload on next navigation
        if (event.data.type === 'SW_PENDING_UPDATE') {
          console.info('[SW] New version ready, will reload on next navigation');
          // Could show a toast notification here
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return false;
  }
};

export const unregisterServiceWorker = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
    return false;
  }
};
