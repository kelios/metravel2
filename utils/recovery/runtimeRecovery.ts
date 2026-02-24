import { withCacheBust } from '@/utils/recovery/sessionRecovery';
import { RECOVERY_TIMEOUTS } from '@/utils/recovery/recoveryConfig';

type RuntimeRecoveryOptions = {
  purgeAllCaches?: boolean;
  safetyTimeoutMs?: number;
};

const HARD_RELOAD_KEY = '__metravel_hard_reload_pending';

/**
 * Hard reload that bypasses browser disk cache.
 * 1. Fetches fresh HTML with cache: 'reload' to ensure we get latest chunk references
 * 2. Navigates to the URL with cache-busting parameter
 */
function navigateWithCacheBust(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const targetUrl = withCacheBust(window.location.href);
    
    // Mark that we're doing a hard reload
    try { sessionStorage.setItem(HARD_RELOAD_KEY, '1'); } catch { /* noop */ }
    
    // Fetch fresh HTML with cache: 'reload' to bypass disk cache
    // This ensures the browser gets the latest HTML with correct chunk references
    fetch(targetUrl, { cache: 'reload', credentials: 'same-origin' })
      .then(() => {
        window.location.replace(targetUrl);
      })
      .catch(() => {
        // Fallback: just navigate
        window.location.replace(targetUrl);
      });
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
