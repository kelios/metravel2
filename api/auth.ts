import { Alert } from 'react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FormValues } from '@/types/types';
import { devError } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { sanitizeInput } from '@/utils/security';
import { validatePassword } from '@/utils/aiValidation';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getUserFriendlyError } from '@/utils/userFriendlyErrors';
import { retry, isRetryableError } from '@/utils/retry';
import { getSecureItem, setSecureItem, removeSecureItems } from '@/utils/secureStorage';
import { resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl';
import { getCsrfHeader } from '@/utils/csrf';
import { setStorageBatch } from '@/utils/storageBatch';
import {
    getApiRequestCredentials,
    hasUsableAuthCredential,
    shouldUseStoredAuthToken,
} from '@/utils/authPlatform';
import { translate as i18nT } from '@/i18n';

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';
const rawApiUrl = resolveApiBaseUrl({
    platformOS: Platform.OS,
    envApiUrl: process.env.EXPO_PUBLIC_API_URL,
    prodApiUrl: process.env.PROD_API_URL,
    nodeEnv: process.env.NODE_ENV,
    isLocalApi,
    isE2E,
    windowOrigin: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.origin : null,
    windowHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : null,
});
if (!rawApiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}
const URLAPI = rawApiUrl;

const DEFAULT_TIMEOUT = 10000; // 10 секунд

const LOGIN = `${URLAPI}/user/login/`;
const LOGOUT = `${URLAPI}/user/logout/`;
const REGISTER = `${URLAPI}/user/registration/`;
const RESETPASSWORDLINK = `${URLAPI}/user/reset-password-link/`;
const CONFIRM_REGISTER = `${URLAPI}/user/confirm-registration/`;
const SETNEWPASSWORD = `${URLAPI}/user/set-password-after-reset/`;
const SENDPASSWORD = `${URLAPI}/user/sendpassword/`;
const GOOGLE_LOGIN = `${URLAPI}/user/google-login/`;
const FACEBOOK_LOGIN = `${URLAPI}/user/facebook-login/`;
const PUSH_TOKEN = `${URLAPI}/user/push-token/`;
const WEB_SESSION_PROBE = `${URLAPI}/user/me/verifications/`;

const getStoredAuthToken = async (): Promise<string | null> =>
    shouldUseStoredAuthToken() ? getSecureItem('userToken') : null;

const persistNativeAuthTokens = async (token?: string, refresh?: string): Promise<void> => {
    if (!shouldUseStoredAuthToken() || !token) return;
    await setSecureItem('userToken', token);
    if (refresh) await setSecureItem('refreshToken', refresh);
};

/**
 * Validate the ambient HttpOnly-cookie session through a private endpoint.
 * Public profile endpoints cannot prove that the browser still owns a session.
 */
export const validateWebCookieSessionApi = async (): Promise<boolean> => {
    if (shouldUseStoredAuthToken()) return false;

    const response = await fetchWithTimeout(WEB_SESSION_PROBE, {
        method: 'GET',
        ...getApiRequestCredentials(),
        headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
    }, DEFAULT_TIMEOUT);

    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) {
        throw new Error(`Web session probe failed: ${response.status}`);
    }
    return true;
};

type GoogleAuthResponse = {
    token?: string;
    refresh?: string;
    name?: string;
    email?: string;
    id?: string | number;
    is_superuser?: boolean;
    detail?: string;
    error?: string;
    message?: string;
    non_field_errors?: string[];
    id_token?: string[];
};

type FacebookAuthResponse = GoogleAuthResponse & {
    error_code?:
        | 'access_token_required'
        | 'facebook_token_invalid'
        | 'facebook_email_required'
        | 'facebook_account_conflict'
        | string;
};

const getGoogleAuthErrorMessage = (payload: Partial<GoogleAuthResponse>, status: number): string => {
    const directMessage = payload.detail || payload.error || payload.message;
    if (directMessage) return directMessage;
    if (Array.isArray(payload.non_field_errors) && payload.non_field_errors[0]) {
        return payload.non_field_errors[0];
    }
    if (Array.isArray(payload.id_token) && payload.id_token[0]) {
        return payload.id_token[0];
    }
    if (status === 401 || status === 403) {
        return i18nT('errorsStatic:api.auth.googleAccountNotConfirmed');
    }
    if (status >= 500) {
        return i18nT('errorsStatic:api.auth.googleUnavailable');
    }
    return i18nT('errorsStatic:api.auth.googleSignInFailed');
};

export const loginApi = async (email: string, password: string): Promise<{
    token: string;
    refresh?: string;
    name: string;
    email: string;
    id: string | number;
    is_superuser: boolean;
} | null> => {
    try {
        if (!password || password.trim().length === 0) {
            Alert.alert(i18nT('errorsStatic:api.auth.errorTitle'), i18nT('errorsStatic:api.auth.emptyPassword'));
            return null;
        }

        const trimmedEmail = (email ?? '').trim();
        if (!trimmedEmail) {
            Alert.alert(i18nT('errorsStatic:api.auth.errorTitle'), i18nT('errorsStatic:api.auth.emptyEmail'));
            return null;
        }

        const response = await retry(
            async () => {
                const res = await fetchWithTimeout(LOGIN, {
                    method: 'POST',
                    ...getApiRequestCredentials(),
                    headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
                    body: JSON.stringify({ email: trimmedEmail, password }),
                }, DEFAULT_TIMEOUT);
                // Проверяем статус ВНУТРИ retry: статус в сообщении позволяет shouldRetry
                // ретраить 5xx (isRetryableError матчит /50\d/) и не ретраить 4xx.
                if (!res.ok) {
                    throw new Error(`Login failed: ${res.status}`);
                }
                return res;
            },
            {
                maxAttempts: 2,
                delay: 500,
                shouldRetry: (error) => {
                    return isRetryableError(error) && !error.message.includes('401') && !error.message.includes('403');
                }
            }
        );

        const json = await safeJsonParse<{
            token?: string;
            refresh?: string;
            name?: string;
            email?: string;
            id?: string | number;
            is_superuser?: boolean;
        }>(response, {});

        if (json.token) return json as {
            token: string;
            refresh?: string;
            name: string;
            email: string;
            id: string | number;
            is_superuser: boolean;
        };
        return null;
    } catch (error: unknown) {
        devError('Login error:', error);
        const rawMessage = error instanceof Error ? error.message : '';
        let message: string;
        if (/Login failed: (401|403)/.test(rawMessage)) {
            message = i18nT('errorsStatic:api.auth.invalidCredentials');
        } else if (/Login failed: \d+/.test(rawMessage)) {
            // 5xx/429/прочее — серверная/временная ошибка, не вводим в заблуждение «неверным паролем».
            message = i18nT('errorsStatic:api.auth.serviceUnavailable');
        } else {
            message = getUserFriendlyError(error);
        }
        Alert.alert(i18nT('errorsStatic:api.auth.signInErrorTitle'), message);
        return null;
    }
};

export const logoutApi = async () => {
    try {
        const token = await getStoredAuthToken();
        const response = await fetchWithTimeout(LOGOUT, {
            method: 'POST',
            ...getApiRequestCredentials(),
            headers: {
                ...(token ? { Authorization: `Token ${token}` } : {}),
                'Content-Type': 'application/json',
                ...getCsrfHeader(),
            },
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        await safeJsonParse(response, {}).catch(() => undefined);
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
    } finally {
        // Чистим креды БЕЗУСЛОВНО — даже если серверный logout упал/таймаут,
        // иначе на устройстве остаётся валидный токен и запросы шлют старый Authorization.
        await Promise.allSettled([
            removeSecureItems(['userToken', 'refreshToken']),
            AsyncStorage.multiRemove(['userName', 'userId']),
        ]);
    }
};

export const sendPasswordApi = async (email: string) => {
    try {
        const response = await fetchWithTimeout(SENDPASSWORD, {
            method: 'POST',
            ...getApiRequestCredentials(),
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ email }),
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        const json = await safeJsonParse<{ success?: boolean; message?: string }>(response, {});
        if (json.success) {
            Alert.alert(i18nT('errorsStatic:api.auth.successTitle'), i18nT('errorsStatic:api.auth.resetInstructionsSent'));
            return true;
        }
        Alert.alert(i18nT('errorsStatic:api.auth.errorTitle'), getUserFriendlyError(json.message || i18nT('errorsStatic:api.auth.resetInstructionsFailed')));
        return false;
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        Alert.alert(i18nT('errorsStatic:api.auth.errorTitle'), getUserFriendlyError(error));
        return false;
    }
};

export const resetPasswordLinkApi = async (email: string) => {
    const sanitizedEmail = sanitizeInput(email.trim());
    if (!sanitizedEmail) {
        throw new Error(i18nT('errorsStatic:api.auth.emptyEmail'));
    }

    try {
        const response = await fetchWithTimeout(RESETPASSWORDLINK, {
            method: 'POST',
            ...getApiRequestCredentials(),
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ email: sanitizedEmail }),
        }, DEFAULT_TIMEOUT);

        const json = await safeJsonParse<{ email?: string[]; message?: string }>(response, {});

        if (!response.ok) {
            return json?.email?.[0] || json?.message || i18nT('errorsStatic:api.auth.errorTitle');
        }

        return json?.message || i18nT('errorsStatic:api.auth.resetInstructionsSentShort');
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        return i18nT('errorsStatic:api.auth.resetInstructionsFailed');
    }
};

export const setNewPasswordApi = async (password_reset_token: string, password: string) => {
    try {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            Alert.alert(i18nT('errorsStatic:api.auth.validationErrorTitle'), passwordValidation.error || i18nT('errorsStatic:api.auth.passwordRequirements'));
            return false;
        }

        const response = await fetchWithTimeout(SETNEWPASSWORD, {
            method: 'POST',
            ...getApiRequestCredentials(),
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ password, password_reset_token }),
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        const json = await safeJsonParse<{ success?: boolean; detail?: string; message?: string }>(response, {});
        if (json.success || json.detail) {
            Alert.alert(i18nT('errorsStatic:api.auth.successTitle'), json.detail || i18nT('errorsStatic:api.auth.passwordChanged'));
            return true;
        }
        Alert.alert(i18nT('errorsStatic:api.auth.errorTitle'), getUserFriendlyError(json.message || i18nT('errorsStatic:api.auth.passwordChangeFailed')));
        return false;
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        Alert.alert(i18nT('errorsStatic:api.auth.errorTitle'), getUserFriendlyError(error));
        return false;
    }
};

export const registration = async (values: FormValues): Promise<{ ok: boolean; message: string }> => {
    try {
        if (values.password) {
            const passwordValidation = validatePassword(values.password);
            if (!passwordValidation.valid) {
                const fallbackMessage = i18nT('errorsStatic:api.auth.passwordRequirements');
                Alert.alert(i18nT('errorsStatic:api.auth.validationErrorTitle'), passwordValidation.error || fallbackMessage);
                return { ok: false, message: passwordValidation.error || fallbackMessage };
            }
        }

        const response = await retry(
            async () => {
                return await fetchWithTimeout(REGISTER, {
                    method: 'POST',
                    ...getApiRequestCredentials(),
                    headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
                    body: JSON.stringify(values),
                }, DEFAULT_TIMEOUT);
            },
            {
                maxAttempts: 2,
                delay: 500,
                shouldRetry: (error) => {
                    return isRetryableError(error) &&
                        !error.message.includes('400') &&
                        !error.message.includes('401') &&
                        !error.message.includes('403');
                }
            }
        );

        const jsonResponse = await safeJsonParse<{
            token?: string;
            refresh?: string;
            name?: string;
            error?: string;
        }>(response, {});

        if (!response.ok) {
            return { ok: false, message: jsonResponse.error || i18nT('errorsStatic:api.auth.registrationErrorTitle') };
        }

        if (jsonResponse.token) {
            const resp = jsonResponse as Record<string, unknown>;
            await persistNativeAuthTokens(
                jsonResponse.token,
                typeof resp.refresh === 'string' ? resp.refresh : undefined,
            );
            await AsyncStorage.setItem('userName', jsonResponse.name || '');
        }

        const successMessage = i18nT('errorsStatic:api.auth.registrationSucceeded');
        return { ok: true, message: successMessage };
    } catch (error: unknown) {
        devError('Registration error:', error);
        const msg = error instanceof Error ? error.message : i18nT('errorsStatic:api.common.unknownError');
        return { ok: false, message: msg };
    }
};

export const confirmAccount = async (hash: string) => {
    try {
        const response = await fetchWithTimeout(CONFIRM_REGISTER, {
            method: 'POST',
            ...getApiRequestCredentials(),
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ hash }),
        }, DEFAULT_TIMEOUT);

        const jsonResponse = await safeJsonParse<{
            userToken?: string;
            userName?: string;
            userId?: string | number;
            refreshToken?: string;
        }>(response, {});

        if (jsonResponse.userToken) {
            const userId = jsonResponse.userId;
            if ((typeof userId !== 'string' && typeof userId !== 'number') || String(userId).trim() === '') {
                throw new Error(i18nT('errorsStatic:api.auth.confirmationFailed'));
            }
            await persistNativeAuthTokens(jsonResponse.userToken, jsonResponse.refreshToken);
            await setStorageBatch([
                ['userName', jsonResponse.userName || ''],
                ['userId', String(userId)],
            ]);
        }
        return jsonResponse;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : i18nT('errorsStatic:api.auth.confirmationFailed');
        throw new Error(msg);
    }
};

export const googleAuthApi = async (idToken: string): Promise<{
    token: string;
    refresh?: string;
    name: string;
    email: string;
    id: string | number;
    is_superuser: boolean;
} | null> => {
    try {
        const trimmedToken = String(idToken || '').trim();
        if (!trimmedToken) {
            throw new Error(i18nT('errorsStatic:api.auth.googleIdTokenMissing'));
        }

        const response = await retry(
            async () => {
                return await fetchWithTimeout(GOOGLE_LOGIN, {
                    method: 'POST',
                    ...getApiRequestCredentials(),
                    headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
                    body: JSON.stringify({ id_token: trimmedToken }),
                }, DEFAULT_TIMEOUT);
            },
            {
                maxAttempts: 2,
                delay: 500,
                shouldRetry: (error) => {
                    return isRetryableError(error) && !error.message.includes('401') && !error.message.includes('403');
                }
            }
        );

        const json = await safeJsonParse<GoogleAuthResponse>(response, {});

        if (!response.ok) {
            throw new Error(getGoogleAuthErrorMessage(json, response.status));
        }

        if (json.token) return json as {
            token: string;
            refresh?: string;
            name: string;
            email: string;
            id: string | number;
            is_superuser: boolean;
        };
        throw new Error(i18nT('errorsStatic:api.auth.googleServerTokenMissing'));
    } catch (error: unknown) {
        devError('Google auth error:', error);
        const message = getUserFriendlyError(error);
        Alert.alert(i18nT('errorsStatic:api.auth.googleSignInErrorTitle'), message);
        return null;
    }
};

const getFacebookAuthErrorMessage = (payload: Partial<FacebookAuthResponse>, status: number): string => {
    switch (payload.error_code) {
        case 'access_token_required':
            return i18nT('errorsStatic:api.auth.facebookAccessTokenMissing');
        case 'facebook_token_invalid':
            return i18nT('errorsStatic:api.auth.facebookTokenInvalid');
        case 'facebook_email_required':
            return i18nT('errorsStatic:api.auth.facebookEmailRequired');
        case 'facebook_account_conflict':
            return i18nT('errorsStatic:api.auth.facebookAccountConflict');
        default:
            if (status >= 500) return i18nT('errorsStatic:api.auth.facebookUnavailable');
            return i18nT('errorsStatic:api.auth.facebookSignInFailed');
    }
};

export const facebookAuthApi = async (accessToken: string): Promise<{
    token: string;
    refresh?: string;
    name: string;
    email: string;
    id: string | number;
    is_superuser: boolean;
} | null> => {
    try {
        const trimmedToken = String(accessToken || '').trim();
        if (!trimmedToken) {
            throw new Error(i18nT('errorsStatic:api.auth.facebookAccessTokenMissing'));
        }

        const response = await retry(
            async () => fetchWithTimeout(FACEBOOK_LOGIN, {
                method: 'POST',
                ...getApiRequestCredentials(),
                headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
                body: JSON.stringify({ access_token: trimmedToken }),
            }, DEFAULT_TIMEOUT),
            {
                maxAttempts: 2,
                delay: 500,
                shouldRetry: (error) =>
                    isRetryableError(error) &&
                    !error.message.includes('400') &&
                    !error.message.includes('401') &&
                    !error.message.includes('409'),
            },
        );

        const json = await safeJsonParse<FacebookAuthResponse>(response, {});
        if (!response.ok) {
            throw new Error(getFacebookAuthErrorMessage(json, response.status));
        }
        if (json.token) {
            return json as {
                token: string;
                refresh?: string;
                name: string;
                email: string;
                id: string | number;
                is_superuser: boolean;
            };
        }
        throw new Error(i18nT('errorsStatic:api.auth.facebookServerTokenMissing'));
    } catch (error: unknown) {
        devError('Facebook auth error:', error);
        Alert.alert(
            i18nT('errorsStatic:api.auth.facebookSignInErrorTitle'),
            getUserFriendlyError(error),
        );
        return null;
    }
};

/**
 * AND-05: Register Expo push token on the backend.
 * Sends the push token so the server can send notifications to this device.
 * Silently fails — push token registration is non-critical.
 */
export const registerPushTokenApi = async (pushToken: string): Promise<boolean> => {
    try {
        const token = await getStoredAuthToken();
        if (!hasUsableAuthCredential(token)) return false;

        const response = await fetchWithTimeout(PUSH_TOKEN, {
            method: 'POST',
            ...getApiRequestCredentials(),
            headers: {
                ...(token ? { Authorization: `Token ${token}` } : {}),
                'Content-Type': 'application/json',
                ...getCsrfHeader(),
            },
            body: JSON.stringify({
                push_token: pushToken,
                platform: Platform.OS,
            }),
        }, DEFAULT_TIMEOUT);

        return response.ok;
    } catch (error: unknown) {
        devError('Push token registration error:', error);
        return false;
    }
};
