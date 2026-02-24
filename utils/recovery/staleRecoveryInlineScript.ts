import { RECOVERY_SESSION_KEYS } from '@/utils/recovery/sessionRecovery';
import { RECOVERY_COOLDOWNS, RECOVERY_RETRY_LIMITS, RECOVERY_TIMEOUTS } from '@/utils/recovery/recoveryConfig';
import { STALE_ERROR_PATTERN_SOURCE } from '@/utils/recovery/staleErrorPattern';

export const getStaleRecoveryInlineScript = () => String.raw`
(function(){
  if (typeof window === 'undefined') return;

  var KEY = ${JSON.stringify(RECOVERY_SESSION_KEYS.chunkReloadTs)};
  var COUNT_KEY = ${JSON.stringify(RECOVERY_SESSION_KEYS.chunkReloadCount)};
  var COOLDOWN = ${RECOVERY_COOLDOWNS.staleMs};
  var MAX_RETRIES = ${RECOVERY_RETRY_LIMITS.stale};

  function hasRecoveryParam() {
    try {
      return new URL(window.location.href).searchParams.has('_cb');
    } catch (_e) {
      return false;
    }
  }

  function extractMessage(payload) {
    try {
      return String(
        (payload && payload.message) ||
        (payload && payload.reason && payload.reason.message) ||
        payload ||
        ''
      );
    } catch (_e) {
      return '';
    }
  }

  function isStale(message) {
    return new RegExp(${JSON.stringify(STALE_ERROR_PATTERN_SOURCE)}, 'i').test(message);
  }

  function shouldAttemptRecovery() {
    try {
      var now = Date.now();
      var count = parseInt(sessionStorage.getItem(COUNT_KEY) || '0', 10);
      var lastRaw = sessionStorage.getItem(KEY);
      var last = lastRaw ? Number(lastRaw) : 0;
      var elapsed = (last && isFinite(last)) ? now - last : Infinity;

      if (count >= MAX_RETRIES) {
        if (elapsed >= COOLDOWN) {
          count = 0;
          sessionStorage.setItem(COUNT_KEY, '0');
        } else {
          return false;
        }
      }

      if (elapsed < COOLDOWN) return false;

      sessionStorage.setItem(KEY, String(now));
      sessionStorage.setItem(COUNT_KEY, String(count + 1));
    } catch (_e) {
      // sessionStorage unavailable; allow one best-effort attempt
    }

    return true;
  }

  function navigateWithCacheBust() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('_cb', String(Date.now()));
      window.location.replace(url.toString());
      return;
    } catch (_e) {}

    try {
      window.location.reload();
    } catch (_e2) {}
  }

  function cleanupAndRecover() {
    var safetyTimer = setTimeout(navigateWithCacheBust, ${RECOVERY_TIMEOUTS.staleCleanupSafetyMs});

    var swCleanup = ('serviceWorker' in navigator)
      ? navigator.serviceWorker.getRegistrations().then(function(registrations){
          return Promise.all(registrations.map(function(registration){
            return registration.unregister();
          }));
        })
      : Promise.resolve();

    var cacheCleanup = (typeof caches !== 'undefined')
      ? caches.keys().then(function(keys){
          return Promise.all(keys.map(function(key){ return caches.delete(key); }));
        })
      : Promise.resolve();

    Promise.all([swCleanup, cacheCleanup])
      .catch(function(){})
      .finally(function(){
        clearTimeout(safetyTimer);
        navigateWithCacheBust();
      });
  }

  function handleRecoverySignal(payload) {
    var message = extractMessage(payload);
    if (!isStale(message)) return;
    if (hasRecoveryParam()) return;
    if (!shouldAttemptRecovery()) return;
    cleanupAndRecover();
  }

  window.addEventListener('error', handleRecoverySignal, true);
  window.addEventListener('unhandledrejection', handleRecoverySignal);
})();
`;
