import { Platform } from 'react-native';

const AUTH_TOKEN_KEYS = new Set(['userToken', 'refreshToken']);

/** Web authenticates with the backend-managed HttpOnly cookie. */
export const usesWebCookieAuth = (): boolean => Platform.OS === 'web';

/** Only native platforms may read or persist access/refresh tokens. */
export const shouldUseStoredAuthToken = (): boolean => !usesWebCookieAuth();

export const isAuthTokenStorageKey = (key: string): boolean => AUTH_TOKEN_KEYS.has(key);

export const hasUsableAuthCredential = (storedToken: string | null): boolean =>
  usesWebCookieAuth() || Boolean(storedToken);

/**
 * Web API requests either participate in the cookie session or explicitly opt
 * out for public endpoints. Native keeps the header-token contract.
 */
export const getApiRequestCredentials = (
  skipAuth: boolean = false,
): Pick<RequestInit, 'credentials'> => {
  if (!usesWebCookieAuth()) return {};
  return { credentials: skipAuth ? 'omit' : 'include' };
};
