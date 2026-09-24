import type { QueryNetworkState } from '@/utils/queryOnlineManager';

/**
 * Web counterpart of the NetInfo/AppState listener. queryOnlineManager never calls
 * it on web (navigator.onLine drives onlineManager there); the split only keeps the
 * native recheck out of the web bundle.
 */
export function setupNativeQueryOnlineListener(
  setOnline: (online: boolean) => void,
  _isOnline: (state: QueryNetworkState) => boolean,
): (() => void) | undefined {
  setOnline(true);
  return undefined;
}
