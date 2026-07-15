import { getListTravelOwnUserGateMode } from '@/components/listTravel/parts/ListTravelOwnUserGate';

describe('getListTravelOwnUserGateMode', () => {
  it('keeps own-user routes neutral until hydration and auth bootstrap finish', () => {
    expect(getListTravelOwnUserGateMode({
      authReady: true,
      hydrationReady: false,
      isAuthenticated: true,
      requiresOwnUser: true,
    })).toBe('bootstrap');
    expect(getListTravelOwnUserGateMode({
      authReady: false,
      hydrationReady: true,
      isAuthenticated: false,
      requiresOwnUser: true,
    })).toBe('bootstrap');
  });

  it('shows login only after bootstrap and releases authenticated content', () => {
    expect(getListTravelOwnUserGateMode({
      authReady: true,
      hydrationReady: true,
      isAuthenticated: false,
      requiresOwnUser: true,
    })).toBe('login');
    expect(getListTravelOwnUserGateMode({
      authReady: true,
      hydrationReady: true,
      isAuthenticated: true,
      requiresOwnUser: true,
    })).toBeNull();
    expect(getListTravelOwnUserGateMode({
      authReady: false,
      hydrationReady: false,
      isAuthenticated: false,
      requiresOwnUser: false,
    })).toBeNull();
  });
});
