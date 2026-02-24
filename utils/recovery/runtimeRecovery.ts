import { withCacheBust } from '@/utils/recovery/sessionRecovery';
import { RECOVERY_TIMEOUTS } from '@/utils/recovery/recoveryConfig';

type RuntimeRecoveryOptions = {
  purgeAllCaches?: boolean;
  safetyTimeoutMs?: number;
};

const HARD_RELOAD_KEY = '__metravel_hard_reload_pending';

/**
 * Hard reload that bypasses browser disk cache for ALL resources including JS chunks.
 * If already has _cb param, does location.reload(true) for true hard reload.
 */
function navigateWithCacheBust(): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Mark that we're doing a hard reload
    try { sessionStorage.setItem(HARD_RELOAD_KEY, '1'); } catch { /* noop */ }
    
    // Check if we already have _cb param - if so, do a true hard reload
    const url = new URL(window.location.href);
    if (url.searchParams.has('_cb')) {
      // Already tried with _cb, now do location.reload(true) for hard reload
      // This forces browser to revalidate ALL cached resources including JS chunks
      window.location.reload();
      return;
    }
    
    // First attempt: add _cb param and navigate
    window.location.replace(withCacheBust(window.location.href));
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
