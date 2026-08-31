import { Platform } from 'react-native';

/**
 * FE-mitigation под бэкенд-CSRF: Django/DRF при наличии session-cookie включает
 * SessionAuthentication и требует CSRF на unsafe-методах. SPA обязан вернуть
 * cookie `csrftoken` обратно заголовком `X-CSRFToken`, иначе бэк отвечает
 * 403 `{"detail":"CSRF Failed: CSRF token missing."}` (ломает логин и любые POST).
 *
 * Только web: authenticated native-запросы шлют header-токен, а csrftoken им
 * взять неоткуда. AllowAny POST из `api/misc.ts` идут через `publicPostInit` с
 * `credentials: 'omit'` и без Authorization, чтобы cookie-auth/CSRF и stale
 * SecureStore token не превращали публичный endpoint в 403/401.
 * Guard остаётся, пока бэк-фикс (CSRF-exempt auth / убрать SessionAuth) не
 * верифицирован на проде и не покрыт регресс-тестом.
 */
export const getCsrfHeader = (): Record<string, string> => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return {};
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
    const token = match ? decodeURIComponent(match[1]) : '';
    return token ? { 'X-CSRFToken': token } : {};
};
