import { RECOVERY_TIMEOUTS } from '@/utils/recovery/recoveryConfig';

type RuntimeRecoveryOptions = {
  purgeAllCaches?: boolean;
  safetyTimeoutMs?: number;
};

/**
 * Hard reload with cache-busting to bypass browser HTTP cache.
 * 
 * Problem: JS files served with `Cache-Control: immutable` stay in browser
 * HTTP cache even after SW unregister + Cache Storage purge. A simple
 * `location.reload()` still loads stale JS from HTTP cache.
 * 
 * Solution: Navigate to a URL with a fresh `_cb` timestamp parameter.
 * This forces the browser to fetch fresh HTML (which references new JS chunks).
 * The new JS chunk URLs have different hashes, so they bypass HTTP cache.
 */
function navigateWithCacheBust(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const url = new URL(window.location.href);
    // Always set fresh cache-bust parameter to force new HTML fetch
    url.searchParams.set('_cb', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    try {
      // Fallback: simple reload (may not bypass HTTP cache)
      window.location.reload();
    } catch { /* noop */ }
  }
}

async function unregisterAllServiceWorkers(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // noop
  }
}

async function purgeRelevantCaches(purgeAllCaches: boolean): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    const keys = await caches.keys();
    const keysToDelete = purgeAllCaches
      ? keys
      : keys.filter((key) => key.startsWith('metravel-'));
    await Promise.all(keysToDelete.map((key) => caches.delete(key)));
  } catch {
    // noop
  }
}

export function runStaleChunkRecovery(
  options: RuntimeRecoveryOptions = {
    purgeAllCaches: true,
    safetyTimeoutMs: RECOVERY_TIMEOUTS.staleCleanupSafetyMs,
  }
): void {
  const {
    purgeAllCaches = true,
    safetyTimeoutMs = RECOVERY_TIMEOUTS.staleCleanupSafetyMs,
  } = options;

  // Flag for tests to verify recovery was triggered
  if (typeof window !== 'undefined') {
    (window as any).__metravelModuleReloadTriggered = true;
  }

  const safetyTimer = setTimeout(navigateWithCacheBust, safetyTimeoutMs);

  Promise.all([
    unregisterAllServiceWorkers(),
    purgeRelevantCaches(purgeAllCaches),
  ])
    .catch(() => {})
    .finally(() => {
      clearTimeout(safetyTimer);
      navigateWithCacheBust();
    });
}
