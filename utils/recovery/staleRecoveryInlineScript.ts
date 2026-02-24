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
  var HARD_RELOAD_KEY = '__metravel_hard_reload_pending';
  var EXHAUSTED_FLAG = ${JSON.stringify(RECOVERY_SESSION_KEYS.recoveryExhausted)};

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
          sessionStorage.removeItem(EXHAUSTED_FLAG);
        } else {
          // Set exhausted flag so ErrorBoundary shows cache clear instructions
          sessionStorage.setItem(EXHAUSTED_FLAG, '1');
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

  // Hard reload: force browser to bypass ALL caches including disk cache for JS chunks
  function hardReloadWithCacheBust() {
    try {
      // Mark that we're doing a hard reload to prevent loops
      try { sessionStorage.setItem(HARD_RELOAD_KEY, '1'); } catch (_e) {}

      // Always use NEW _cb timestamp to bypass browser disk cache.
      // Even if _cb already exists, a new timestamp forces fresh fetch.
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
    var safetyTimer = setTimeout(hardReloadWithCacheBust, ${RECOVERY_TIMEOUTS.staleCleanupSafetyMs});

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
        hardReloadWithCacheBust();
      });
  }

  // Check if a script load failed (404 returning HTML instead of JS)
  function isScriptLoadError(event) {
    try {
      if (!event || !event.target) return false;
      var target = event.target;
      if (target.tagName !== 'SCRIPT') return false;
      var src = target.src || '';
      // Check if it's an Expo chunk that failed to load
      return src.indexOf('/_expo/static/js/') !== -1;
    } catch (_e) {
      return false;
    }
  }

  function handleRecoverySignal(payload) {
    var message = extractMessage(payload);
    
    // Check for script load errors (chunk 404s)
    if (payload && payload.target && isScriptLoadError(payload)) {
      // Don't block on hasRecoveryParam() - retry budget handles loops.
      // Old _cb may have failed, new _cb with fresh timestamp can succeed.
      if (!shouldAttemptRecovery()) {
        // Recovery exhausted - don't reload, let ErrorBoundary show instructions
        return;
      }
      cleanupAndRecover();
      return;
    }
    
    if (!isStale(message)) return;
    // Don't block on hasRecoveryParam() - retry budget handles loops.
    if (!shouldAttemptRecovery()) {
      // Recovery exhausted - don't reload, let ErrorBoundary show instructions
      return;
    }
    cleanupAndRecover();
  }

  // Listen for script load errors (captures chunk 404s before they become runtime errors)
  window.addEventListener('error', handleRecoverySignal, true);
  window.addEventListener('unhandledrejection', handleRecoverySignal);

  // Clear hard reload flag on successful page load
  try {
    if (sessionStorage.getItem(HARD_RELOAD_KEY) === '1') {
      sessionStorage.removeItem(HARD_RELOAD_KEY);
    }
  } catch (_e) {}
})();
`;
