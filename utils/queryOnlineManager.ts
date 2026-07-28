import { onlineManager } from '@tanstack/react-query';
import { Platform } from 'react-native';

export interface QueryNetworkState {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}

interface NetInfoLike {
  fetch: () => Promise<QueryNetworkState>;
  addEventListener: (
    listener: (state: QueryNetworkState) => void,
  ) => () => void;
}

let configured = false;

/** Unknown reachability is provisionally online; only an explicit false pauses requests. */
export function isQueryNetworkOnline(state: QueryNetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Connects TanStack Query to the actual platform network source exactly once.
 * Native starts conservatively offline until NetInfo resolves, which prevents
 * an offline cold start from firing a first doomed request.
 */
export function setupQueryOnlineManager(): void {
  if (configured) return;
  configured = true;

  onlineManager.setEventListener((setOnline) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        setOnline(true);
        return undefined;
      }

      const update = () => setOnline(navigator.onLine !== false);
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);

      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    // Do not allow an offline native cold start to race NetInfo resolution.
    setOnline(false);

    try {
      const NetInfo = require('@react-native-community/netinfo') as NetInfoLike;
      const applyState = (state: QueryNetworkState) => {
        setOnline(isQueryNetworkOnline(state));
      };
      const unsubscribe = NetInfo.addEventListener(applyState);

      void NetInfo.fetch()
        .then(applyState)
        .catch(() => setOnline(true));

      return unsubscribe;
    } catch {
      setOnline(true);
      return undefined;
    }
  });
}
