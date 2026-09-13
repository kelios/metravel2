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
    // #1921: cookie отключается явно — иначе запрос без токена уходит в
    // cookie-ветку бэкенда и падает на CSRF (403) вместо честного 401.
    expect(getApiRequestCredentials()).toEqual({ credentials: 'omit' });
    expect(getApiRequestCredentials(true)).toEqual({ credentials: 'omit' });
  });

  it('recognizes only access and refresh credential keys', () => {
    expect(isAuthTokenStorageKey('userToken')).toBe(true);
    expect(isAuthTokenStorageKey('refreshToken')).toBe(true);
    expect(isAuthTokenStorageKey('privatePreference')).toBe(false);
  });
});
