import { onlineManager } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { setupNativeQueryOnlineListener } from '@/utils/nativeQueryOnlineListener';

export interface QueryNetworkState {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
  type?: string | null;
}

let configured = false;

/** Unknown reachability is provisionally online; only an explicit false pauses requests. */
export function isQueryNetworkOnline(state: QueryNetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Connects TanStack Query to the actual platform network source exactly once.
 * Native starts conservatively offline until NetInfo resolves, which prevents
 * an offline cold start from firing a first doomed request. The native listener
 * (NetInfo + AppState recheck, #603) lives in a `.native.ts` file so the web
 * bundle keeps only the navigator.onLine path below.
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

    return setupNativeQueryOnlineListener(setOnline, isQueryNetworkOnline);
  });
}
