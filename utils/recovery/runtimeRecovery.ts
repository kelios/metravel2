// withCacheBust no longer used - we now always set new _cb timestamp directly
import { RECOVERY_TIMEOUTS } from '@/utils/recovery/recoveryConfig';

type RuntimeRecoveryOptions = {
  purgeAllCaches?: boolean;
  safetyTimeoutMs?: number;
};

const HARD_RELOAD_KEY = '__metravel_hard_reload_pending';

/**
 * Hard reload that bypasses browser disk cache for ALL resources including JS chunks.
 * Always uses NEW _cb timestamp to force fresh fetch even if _cb already exists.
 */
function navigateWithCacheBust(): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Mark that we're doing a hard reload
    try { sessionStorage.setItem(HARD_RELOAD_KEY, '1'); } catch { /* noop */ }
    
    // Always use NEW _cb timestamp to bypass browser disk cache.
    // Even if _cb already exists, a new timestamp forces fresh fetch.
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    try {
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
