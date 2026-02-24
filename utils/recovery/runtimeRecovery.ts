import { RECOVERY_TIMEOUTS } from '@/utils/recovery/recoveryConfig';

type RuntimeRecoveryOptions = {
  purgeAllCaches?: boolean;
  safetyTimeoutMs?: number;
};

/**
 * Simple reload without _cb parameter.
 * SW already uses network-first with cache:'no-store' for documents,
 * so a plain reload fetches fresh HTML from server.
 * Removes any existing _cb parameter to clean up URLs.
 */
function navigateClean(): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Remove _cb parameter if present to clean up URL
    const url = new URL(window.location.href);
    if (url.searchParams.has('_cb')) {
      url.searchParams.delete('_cb');
      window.location.replace(url.toString());
      return;
    }
    // Simple reload - SW handles cache bypass
    window.location.reload();
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

  // Flag for tests to verify recovery was triggered
  if (typeof window !== 'undefined') {
    (window as any).__metravelModuleReloadTriggered = true;
  }

  const safetyTimer = setTimeout(navigateClean, safetyTimeoutMs);

  Promise.all([
    unregisterAllServiceWorkers(),
    purgeRelevantCaches(purgeAllCaches),
  ])
    .catch(() => {})
    .finally(() => {
      clearTimeout(safetyTimer);
      navigateClean();
    });
}
