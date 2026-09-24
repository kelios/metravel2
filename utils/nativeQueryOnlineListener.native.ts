import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { devLog } from '@/utils/logger';
import type { QueryNetworkState } from '@/utils/queryOnlineManager';

interface NetInfoLike {
  fetch: () => Promise<QueryNetworkState>;
  /** Re-reads the native state and notifies every NetInfo subscriber (useNetworkStatus included). */
  refresh?: () => Promise<QueryNetworkState>;
  addEventListener: (listener: (state: QueryNetworkState) => void) => () => void;
}

type SetOnline = (online: boolean) => void;
type RefreshReason = 'foreground' | 'retry';

// Recheck while the app believes it is offline: 2s, 4s, 8s … capped at 60s,
// at most 10 refreshes per offline episode (~6 min). Every return to `active`
// refreshes immediately and resets the budget.
const RECHECK_BASE_DELAY_MS = 2_000;
const RECHECK_MAX_DELAY_MS = 60_000;
const RECHECK_MAX_ATTEMPTS = 10;
const NETWORK_DIAGNOSTICS_TAG = '[NET-DIAG]';

/**
 * Opt-in NetInfo/AppState trace for device QA (OFFLINE-001, #603).
 * Enabled only by the bundle-time flag EXPO_PUBLIC_NETWORK_DIAGNOSTICS=1, so a
 * production build without the flag stays silent. Release bundles strip
 * console.info/warn (babel transform-remove-console keeps console.error), so the
 * release channel is console.error → logcat `E ReactNativeJS`; dev goes through
 * devLog and never opens LogBox. Payload is a fixed whitelist: no IP/SSID/details.
 */
function logNetworkDiagnostic(event: string, payload?: Record<string, unknown>): void {
  const flag = process.env.EXPO_PUBLIC_NETWORK_DIAGNOSTICS;
  if (flag !== '1' && flag !== 'true') return;
  const line = `${NETWORK_DIAGNOSTICS_TAG} ${event}${payload ? ` ${JSON.stringify(payload)}` : ''}`;
  if (__DEV__) {
    devLog(line);
    return;
  }
  console.error(line);
}

function describeNetworkState(state: QueryNetworkState): Record<string, unknown> {
  return {
    type: state.type ?? null,
    isConnected: state.isConnected ?? null,
    isInternetReachable: state.isInternetReachable ?? null,
  };
}

function readAppState(): AppStateStatus | null {
  // Test doubles and early native startup may not expose a string yet.
  const current = AppState.currentState;
  return typeof current === 'string' ? current : null;
}

/**
 * NetInfo → onlineManager on Android/iOS. A live process can miss the moment the
 * network comes back (Android per-uid background firewall, #603), so the state is
 * re-read on every return to `active` and on a bounded backoff while offline and
 * in the foreground. Online is decided only by an actual NetInfo answer through
 * `isOnline`; an explicit `isConnected=false` keeps requests paused.
 */
export function setupNativeQueryOnlineListener(
  setOnline: SetOnline,
  isOnline: (state: QueryNetworkState) => boolean,
): (() => void) | undefined {
  // Do not allow an offline native cold start to race NetInfo resolution.
  setOnline(false);

  let NetInfo: NetInfoLike;
  try {
    NetInfo = require('@react-native-community/netinfo') as NetInfoLike;
  } catch {
    setOnline(true);
    return undefined;
  }

  let disposed = false;
  let online = false;
  let appState = readAppState();
  let recheckTimer: ReturnType<typeof setTimeout> | null = null;
  let recheckAttempts = 0;
  let lastEventSnapshot = '';

  const stopRecheck = (reason: string) => {
    if (recheckTimer === null) return;
    clearTimeout(recheckTimer);
    recheckTimer = null;
    logNetworkDiagnostic('recheck-stop', { reason, attempts: recheckAttempts });
  };

  const applyState = (state: QueryNetworkState) => {
    if (disposed) return;
    const nextOnline = isOnline(state);
    if (nextOnline !== online) {
      online = nextOnline;
      logNetworkDiagnostic('online-manager', { online: nextOnline });
    }
    setOnline(nextOnline);
    if (nextOnline) {
      recheckAttempts = 0;
      stopRecheck('online');
      return;
    }
    scheduleRecheck();
  };

  const runRefresh = (reason: RefreshReason) => {
    if (disposed || typeof NetInfo.refresh !== 'function') return;
    logNetworkDiagnostic('refresh', { reason, attempt: recheckAttempts });
    NetInfo.refresh()
      .then((state) => {
        if (disposed) return;
        logNetworkDiagnostic('refresh-result', { reason, ...describeNetworkState(state) });
        // NetInfo already fans the result out to its subscribers; applying it here
        // again is idempotent and keeps recovery independent of that fan-out.
        applyState(state);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        logNetworkDiagnostic('refresh-error', {
          reason,
          message: error instanceof Error ? error.message : String(error),
        });
        scheduleRecheck();
      });
  };

  function scheduleRecheck() {
    if (disposed || online || recheckTimer !== null) return;
    if (appState !== 'active' || typeof NetInfo.refresh !== 'function') return;
    if (recheckAttempts >= RECHECK_MAX_ATTEMPTS) return;

    const delayMs = Math.min(RECHECK_BASE_DELAY_MS * 2 ** recheckAttempts, RECHECK_MAX_DELAY_MS);
    logNetworkDiagnostic('recheck-scheduled', { attempt: recheckAttempts + 1, delayMs });
    recheckTimer = setTimeout(() => {
      recheckTimer = null;
      if (disposed || online || appState !== 'active') return;
      recheckAttempts += 1;
      if (recheckAttempts >= RECHECK_MAX_ATTEMPTS) {
        logNetworkDiagnostic('recheck-exhausted', { attempts: recheckAttempts });
      }
      runRefresh('retry');
    }, delayMs);
  }

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (disposed || nextAppState === appState) return;
    logNetworkDiagnostic('appstate', { from: appState, to: nextAppState, online });
    appState = nextAppState;
    if (nextAppState === 'active') {
      recheckAttempts = 0;
      runRefresh('foreground');
      return;
    }
    stopRecheck(nextAppState);
  };

  let unsubscribeNetInfo: () => void;
  try {
    unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (disposed) return;
      const snapshot = describeNetworkState(state);
      const serialized = JSON.stringify(snapshot);
      if (serialized !== lastEventSnapshot) {
        lastEventSnapshot = serialized;
        logNetworkDiagnostic('netinfo', snapshot);
      }
      applyState(state);
    });

    void NetInfo.fetch()
      .then((state) => {
        if (disposed) return;
        logNetworkDiagnostic('netinfo-initial', { ...describeNetworkState(state), appState });
        applyState(state);
      })
      .catch(() => {
        if (disposed) return;
        online = true;
        stopRecheck('fetch-error');
        setOnline(true);
      });
  } catch {
    setOnline(true);
    return undefined;
  }

  const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    disposed = true;
    if (recheckTimer !== null) clearTimeout(recheckTimer);
    recheckTimer = null;
    unsubscribeNetInfo();
    appStateSubscription?.remove();
  };
}
