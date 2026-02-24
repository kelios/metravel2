import { withCacheBust } from '@/utils/recovery/sessionRecovery';
import { RECOVERY_TIMEOUTS } from '@/utils/recovery/recoveryConfig';

type RuntimeRecoveryOptions = {
  purgeAllCaches?: boolean;
  safetyTimeoutMs?: number;
};

function navigateWithCacheBust(): void {
  if (typeof window === 'undefined') return;
  try {
    window.location.replace(withCacheBust(window.location.href));
  } catch {
    window.location.reload();
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
