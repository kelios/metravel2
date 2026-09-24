type NetworkListener = (online: boolean) => void;

const PROBE_TIMEOUT_MS = 5_000;
const MAX_RECHECKS = 10;

let source: ReturnType<typeof createNetworkSource> | undefined;

/** One reachability source for web queries, offline UI and queued writes. */
export function subscribeWebNetworkStatus(listener: NetworkListener): () => void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    listener(true);
    return () => undefined;
  }
  source ??= createNetworkSource();
  return source.subscribe(listener);
}

function createNetworkSource() {
  const listeners = new Set<NetworkListener>();
  let online = navigator.onLine !== false;
  let disposed = false;
  let attempts = 0;
  let controller: AbortController | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let recheck: ReturnType<typeof setTimeout> | undefined;

  const publish = (nextOnline: boolean) => {
    if (disposed || nextOnline === online) return;
    online = nextOnline;
    listeners.forEach((listener) => listener(online));
  };

  const clearRecheck = () => {
    clearTimeout(recheck);
    recheck = undefined;
  };

  const cancelProbe = () => {
    const pending = controller;
    controller = undefined;
    clearTimeout(timeout);
    timeout = undefined;
    pending?.abort();
  };

  const scheduleRecheck = () => {
    if (disposed || online || document.visibilityState === 'hidden' || attempts >= MAX_RECHECKS) return;
    recheck = setTimeout(() => {
      recheck = undefined;
      attempts += 1;
      update();
    }, Math.min(2_000 * 2 ** attempts, 60_000));
  };

  function update() {
    if (disposed) return;
    clearRecheck();
    if (navigator.onLine !== false) {
      cancelProbe();
      attempts = 0;
      publish(true);
      return;
    }
    if (controller || document.visibilityState === 'hidden') return;

    // navigator.onLine is only a hint: Chrome can report false while HTTP works.
    // Reuse the existing same-origin favicon probe without sending credentials.
    const pending = new AbortController();
    controller = pending;
    timeout = setTimeout(() => pending.abort(), PROBE_TIMEOUT_MS);
    void (async () => {
      try {
        const url = new URL('/favicon.ico', window.location.origin);
        url.searchParams.set('__network_probe', String(Date.now()));
        await fetch(url.toString(), {
          method: 'HEAD',
          cache: 'no-store',
          credentials: 'omit',
          signal: pending.signal,
        });
        if (disposed || controller !== pending) return;
        // Even an HTTP error proves connectivity; the API owns its own errors.
        attempts = 0;
        publish(true);
      } catch {
        if (disposed || controller !== pending) return;
        publish(false);
      } finally {
        if (controller === pending) {
          controller = undefined;
          clearTimeout(timeout);
          timeout = undefined;
          scheduleRecheck();
        }
      }
    })();
  }

  const resume = () => {
    attempts = 0;
    update();
  };
  const visibilityChanged = () => {
    if (document.visibilityState === 'hidden') clearRecheck();
    else resume();
  };
  window.addEventListener('online', resume);
  window.addEventListener('offline', resume);
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', visibilityChanged);
  update();

  return {
    subscribe(listener: NetworkListener) {
      listeners.add(listener);
      listener(online);
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0 || disposed) return;
        disposed = true;
        clearRecheck();
        cancelProbe();
        window.removeEventListener('online', resume);
        window.removeEventListener('offline', resume);
        window.removeEventListener('focus', resume);
        document.removeEventListener('visibilitychange', visibilityChanged);
        source = undefined;
      };
    },
  };
}
