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
 *
 * На native cookie отключается ЯВНО. Пустой объект оставлял решение рантайму, и
 * fetch в React Native прикладывал cookie общего хранилища устройства: запрос,
 * ушедший без заголовка `Authorization` (токен не прочитался из Keychain),
 * попадал на бэкенде в cookie-ветку `CookieTokenAuthentication`, где для
 * небезопасного метода включается CSRF-проверка. Нативный запрос не шлёт
 * `Referer`, поэтому вместо честного 401 приходил `403 CSRF Failed: Referer
 * checking failed`, приложение считало себя залогиненным, а запись пропадала
 * молча — прод 13.09.2026, потерян отзыв о квесте и две пачки телеметрии
 * (#1921).
 */
export const getApiRequestCredentials = (
  skipAuth: boolean = false,
): Pick<RequestInit, 'credentials'> => {
  if (!usesWebCookieAuth()) return { credentials: 'omit' };
  return { credentials: skipAuth ? 'omit' : 'include' };
};
