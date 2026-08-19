// api/appleAuth.ts
// IOS-05: клиентская часть Sign in with Apple. Отдельный модуль, а не ветка в
// `api/auth.ts`: провайдер самодостаточен, а добавление его в auth-файл вывело
// тот за порог `guard:file-complexity` (815 LOC при лимите 800).

import { devError } from '@/utils/logger';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { getUserFriendlyError } from '@/utils/userFriendlyErrors';
import { getCsrfHeader } from '@/utils/csrf';
import { getApiRequestCredentials } from '@/utils/authPlatform';
import { translate as i18nT } from '@/i18n';
import { API_BASE_URL, DEFAULT_TIMEOUT } from '@/api/apiConfig';
import {
    parseSocialSession,
    type SocialAuthResponse,
    type SocialSessionPayload,
} from '@/api/authShared';

const APPLE_LOGIN = `${API_BASE_URL}/user/apple-login/`;

type AppleAuthResponse = SocialAuthResponse & {
    error_code?: 'identity_token_required' | 'apple_account_disabled' | string;
};

/**
 * Учётные данные Apple в том виде, в каком их отдаёт `expo-apple-authentication`.
 * `givenName`/`familyName` Apple присылает ТОЛЬКО при первом входе, поэтому поля
 * опциональные, а сервер (#1412) сохраняет имя один раз.
 */
export type AppleCredentialPayload = {
    identityToken: string;
    authorizationCode?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    /**
     * IOS-17 (#1506): audience, для которого Apple выпустил `identity_token`.
     * У приложения это bundle ID, у веба — Services ID, и ключ проверки на
     * сервере у них разный. Нативная поверхность поле не шлёт: там audience
     * ровно один и сервер берёт его по умолчанию.
     */
    clientId?: string | null;
};

export type AppleAuthResult =
    | { status: 'authenticated'; user: SocialSessionPayload }
    | { status: 'error'; message: string; errorCode?: string };

const getAppleAuthErrorMessage = (payload: Partial<AppleAuthResponse>, status: number): string => {
    // Контрактно закреплён (#1412) только `apple_account_disabled`. Остальное
    // разбираем по HTTP-статусу, чтобы неизвестный серверный код всё равно дал
    // локализованный текст, а не сырой английский `detail`.
    if (payload.error_code === 'apple_account_disabled') {
        return i18nT('errorsStatic:api.auth.appleAccountDisabled');
    }
    if (status === 409) return i18nT('errorsStatic:api.auth.appleAccountConflict');
    if (status === 400 || status === 401 || status === 403) {
        return i18nT('errorsStatic:api.auth.appleTokenInvalid');
    }
    if (status >= 500) return i18nT('errorsStatic:api.auth.appleUnavailable');
    return i18nT('errorsStatic:api.auth.appleSignInFailed');
};

/**
 * IOS-05: обмен Apple credential на обычную MeTravel-сессию (#1412).
 *
 * Без `retry`, в отличие от Google/Facebook: `authorization_code` — одноразовый
 * грант Apple, и повторная отправка того же кода после таймаута сожгла бы его
 * на сервере. Тот же приём уже используют одноразовые Facebook-completion
 * эндпоинты выше.
 */
export const appleAuthApi = async (credential: AppleCredentialPayload): Promise<AppleAuthResult> => {
    try {
        const identityToken = String(credential?.identityToken || '').trim();
        if (!identityToken) {
            return {
                status: 'error',
                errorCode: 'identity_token_required',
                message: i18nT('errorsStatic:api.auth.appleIdentityTokenMissing'),
            };
        }

        const authorizationCode = String(credential?.authorizationCode || '').trim();
        const givenName = String(credential?.givenName || '').trim();
        const familyName = String(credential?.familyName || '').trim();
        const clientId = String(credential?.clientId || '').trim();

        const body: Record<string, string> = { identity_token: identityToken };
        if (authorizationCode) body.authorization_code = authorizationCode;
        if (givenName) body.given_name = givenName;
        if (familyName) body.family_name = familyName;
        if (clientId) body.client_id = clientId;

        const response = await fetchWithTimeout(APPLE_LOGIN, {
            method: 'POST',
            ...getApiRequestCredentials(),
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify(body),
        }, DEFAULT_TIMEOUT);

        const json = await safeJsonParse<AppleAuthResponse>(response, {});
        if (!response.ok) {
            return {
                status: 'error',
                errorCode: json.error_code,
                message: getAppleAuthErrorMessage(json, response.status),
            };
        }

        const user = parseSocialSession(json);
        if (user) return { status: 'authenticated', user };
        return {
            status: 'error',
            message: i18nT('errorsStatic:api.auth.appleServerTokenMissing'),
        };
    } catch (error: unknown) {
        // Логируем только транспортную ошибку: credential Apple в логи не попадает.
        devError('Apple auth error:', error);
        return { status: 'error', message: getUserFriendlyError(error) };
    }
};
