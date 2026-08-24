import { Platform } from 'react-native';

/**
 * Единственное объявление имён ключей сессионной пары на всё приложение (#1551).
 * Раньше те же литералы жили ещё в `api/apiConfig.ts`, `api/travelQueryShared.ts`
 * и `utils/authTokenStore.ts`, причём писатель пары и читатели брали имя из
 * РАЗНЫХ объявлений: переименование в одном месте молча развело бы запись и
 * чтение — на диске живой токен, а приложение считает пользователя гостем.
 * Владельцем выбран этот модуль: он уже владеет именами для web-гарда и не
 * имеет зависимостей, поэтому его может импортировать любой слой. Остальные
 * модули только ре-экспортируют эти константы.
 */
export const ACCESS_TOKEN_STORAGE_KEY = 'userToken';
export const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

const AUTH_TOKEN_KEYS = new Set<string>([ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY]);

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
