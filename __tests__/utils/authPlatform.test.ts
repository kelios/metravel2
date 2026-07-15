import { Platform } from 'react-native';

import {
  getApiRequestCredentials,
  hasUsableAuthCredential,
  isAuthTokenStorageKey,
  shouldUseStoredAuthToken,
  usesWebCookieAuth,
} from '@/utils/authPlatform';

const originalPlatformOS = Platform.OS;

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
});

describe('authPlatform', () => {
  it('uses HttpOnly-cookie credentials and no stored token on web', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    expect(usesWebCookieAuth()).toBe(true);
    expect(shouldUseStoredAuthToken()).toBe(false);
    expect(hasUsableAuthCredential(null)).toBe(true);
    expect(getApiRequestCredentials()).toEqual({ credentials: 'include' });
    expect(getApiRequestCredentials(true)).toEqual({ credentials: 'omit' });
  });

  it('keeps native auth on stored token headers', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    expect(usesWebCookieAuth()).toBe(false);
    expect(shouldUseStoredAuthToken()).toBe(true);
    expect(hasUsableAuthCredential(null)).toBe(false);
    expect(hasUsableAuthCredential('token')).toBe(true);
    expect(getApiRequestCredentials()).toEqual({});
  });

  it('recognizes only access and refresh credential keys', () => {
    expect(isAuthTokenStorageKey('userToken')).toBe(true);
    expect(isAuthTokenStorageKey('refreshToken')).toBe(true);
    expect(isAuthTokenStorageKey('privatePreference')).toBe(false);
  });
});
