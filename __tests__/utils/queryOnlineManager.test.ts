import { isQueryNetworkOnline } from '@/utils/queryOnlineManager';

describe('isQueryNetworkOnline', () => {
  it('treats an explicit transport or reachability failure as offline', () => {
    expect(isQueryNetworkOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isQueryNetworkOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('keeps unresolved NetInfo state provisionally online', () => {
    expect(isQueryNetworkOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isQueryNetworkOnline({})).toBe(true);
  });
});
