import { Alert } from 'react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FormValues } from '@/types/types';
import { devError, devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { API_BASE_URL as URLAPI, DEFAULT_TIMEOUT } from '@/api/apiConfig';
import {
    parseSocialSession,
    type SocialAuthResponse,
    type SocialSessionPayload,
} from '@/api/authShared';
import {
    authFailure,
    authFailureFromError,
    authFailureReasonFromStatus,
    authRejectionCode,
    type AuthAttempt,
    type AuthFailureReason,
} from '@/utils/authFailure';
import { isConnectionFailure } from '@/utils/networkFailureTag';
import { sanitizeInput } from '@/utils/security';
import { validatePassword } from '@/utils/aiValidation';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getUserFriendlyError } from '@/utils/userFriendlyErrors';
import { retry, isRetryableError } from '@/utils/retry';
import { getSecureItem } from '@/utils/secureStorage';
import { persistSessionTokens, clearSessionTokens } from '@/utils/authTokenStore';
import { getCsrfHeader } from '@/utils/csrf';
import { setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import {
    ACCESS_TOKEN_STORAGE_KEY,
    getApiRequestCredentials,
    hasUsableAuthCredential,
    shouldUseStoredAuthToken,
} from '@/utils/authPlatform';
import { translate as i18nT } from '@/i18n';

const LOGIN = `${URLAPI}/user/login/`;
const LOGOUT = `${URLAPI}/user/logout/`;
const REGISTER = `${URLAPI}/user/registration/`;
const RESETPASSWORDLINK = `${URLAPI}/user/reset-password-link/`;
const CONFIRM_REGISTER = `${URLAPI}/user/confirm-registration/`;
const SETNEWPASSWORD = `${URLAPI}/user/set-password-after-reset/`;
const SENDPASSWORD = `${URLAPI}/user/sendpassword/`;
const GOOGLE_LOGIN = `${URLAPI}/user/google-login/`;
const FACEBOOK_LOGIN = `${URLAPI}/user/facebook-login/`;
const FACEBOOK_COMPLETION_START = `${URLAPI}/user/facebook-login/complete/start/`;
const FACEBOOK_COMPLETION_CONFIRM = `${URLAPI}/user/facebook-login/complete/confirm/`;
const PUSH_TOKEN = `${URLAPI}/user/push-token/`;
const WEB_SESSION_PROBE = `${URLAPI}/user/me/verifications/`;

const getStoredAuthToken = async (): Promise<string | null> =>
    shouldUseStoredAuthToken() ? getSecureItem(ACCESS_TOKEN_STORAGE_KEY) : null;

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

/** Исторический алиас: Google-ветка ниже читает общую форму ответа. */
type GoogleAuthResponse = SocialAuthResponse;

type FacebookAuthResponse = GoogleAuthResponse & {
    error_code?:
        | 'access_token_required'
        | 'facebook_token_invalid'
        | 'facebook_email_completion_required'
        | 'facebook_completion_request_invalid'
        | 'facebook_completion_code_invalid'
        | 'facebook_completion_invalid'
        | 'facebook_account_conflict'
        | string;
    reason_code?: FacebookEmailCompletionReason | string;
    completion_handle?: string;
    expires_in?: number;
    verification_sent?: boolean;
};

// Тело `POST /user/facebook-login/`. Web и Android шлют access token Graph API,
// iPhone (#1918) — OIDC authentication token режима Meta Limited Login вместе с
// nonce попытки: в Limited Login access token недоступен, а nonce сервер
// сверяет с одноимённым claim токена. Объединение размечено, поэтому «оба
// токена сразу» или «ни одного» не собираются на этапе компиляции — бэкенд
// такой запрос отклоняет.
export type FacebookCredentialPayload =
    | { kind: 'access_token'; accessToken: string }
    | { kind: 'authentication_token'; authenticationToken: string; nonce: string };

export type FacebookEmailCompletionReason =
    | 'facebook_email_permission_missing'
    | 'facebook_primary_email_unavailable';

export type FacebookAuthResult =
    | { status: 'authenticated'; user: SocialSessionPayload }
    | {
        status: 'email_completion_required';
        completionHandle: string;
        reasonCode: FacebookEmailCompletionReason;
        expiresIn: number;
    }
    // `reason` — общая таксономия отказа (#1944). Facebook-форма показывает
    // `message`, но причина нужна общему финишеру соц-входа в сторе.
    | { status: 'error'; message: string; errorCode?: string; reason?: AuthFailureReason };

export type FacebookCompletionStartResult =
    | { status: 'verification_sent' }
    | { status: 'error'; message: string; errorCode?: string; reason?: AuthFailureReason };

/**
 * #1946: тот же контракт, что и у пароля выше и у Facebook-ветки ниже — текст
 * отказа всегда собственный и локализованный, тело ответа лишь выбирает ключ.
 *
 * Раньше `payload.detail || error || message` (и `non_field_errors`/`id_token`)
 * выигрывали у ключей ниже, а `users/views.py` action `google_login` отдаёт
 * только англоязычные технические строки — `id_token is required`,
 * `Google token is invalid`, `Google email is not verified`. Машиночитаемого
 * `error_code`, как у Facebook, у него нет, поэтому RU/BE/UK/PL показывали эту
 * отладочную латиницу как текст ошибки входа. Статус — единственный стабильный
 * признак, и он же оставлен без изменений для причины (#1944).
 */
const getGoogleAuthErrorMessage = (status: number): string => {
    if (status === 401 || status === 403) {
        return i18nT('errorsStatic:api.auth.googleAccountNotConfirmed');
    }
    if (status >= 500) {
        return i18nT('errorsStatic:api.auth.googleUnavailable');
    }
    return i18nT('errorsStatic:api.auth.googleSignInFailed');
};

/**
 * #1944: результат входа несёт причину отказа, а `Alert` отсюда убран.
 * Раньше любая неудача возвращала `null`, форма трактовала его как «неверный
 * пароль», а транспортный сбой дополнительно всплывал модальным окном — при
 * обрыве связи пользователь видел два противоречивых сообщения сразу.
 */
export const loginApi = async (
    email: string,
    password: string,
): Promise<AuthAttempt<SocialSessionPayload>> => {
    try {
        if (!password || password.trim().length === 0) {
            return authFailure('rejected', i18nT('errorsStatic:api.auth.emptyPassword'));
        }

        const trimmedEmail = (email ?? '').trim();
        if (!trimmedEmail) {
            return authFailure('rejected', i18nT('errorsStatic:api.auth.emptyEmail'));
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
                    // Тело читаем ДО throw — иначе бэкендовый `detail`/`error`/`message`
                    // (например «Аккаунт не активирован. Воспользуйтесь ссылкой активации
                    // в письме») теряется, и 401 показывается как «Неверный email или
                    // пароль» независимо от реальной причины отказа.
                    const errorPayload = await safeJsonParse<Partial<SocialAuthResponse>>(res, {});
                    const detail = errorPayload.detail || errorPayload.error || errorPayload.message;
                    const httpError = new Error(`Login failed: ${res.status}`) as Error & { detail?: string };
                    if (typeof detail === 'string' && detail.trim()) {
                        httpError.detail = detail.trim();
                    }
                    throw httpError;
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

        const json = await safeJsonParse<SocialAuthResponse>(response, {});

        const user = parseSocialSession(json);
        if (user) return { ok: true, user };
        // Сервер ответил 2xx без сессии — это его сбой, а не ошибка пользователя.
        return authFailure('server', i18nT('errorsStatic:api.auth.signInFailed'));
    } catch (error: unknown) {
        devError('Login error:', error);
        const rawMessage = error instanceof Error ? error.message : '';
        const failedStatus = rawMessage.match(/Login failed: (\d{3})/);
        if (failedStatus) {
            const status = Number(failedStatus[1]);
            const detail = error instanceof Error ? (error as Error & { detail?: string }).detail : undefined;
            if (status === 401 || status === 403 || status === 400) {
                // #1946: строку бэкенда НЕ показываем как есть — она всегда
                // русская (`{"error": "Данные входа не корректные"}` на любой
                // обычный отказ), и в EN/BE/UK/PL форма входа показывала её
                // поверх собственного локализованного текста. Тело ответа теперь
                // только ВЫБИРАЕТ ключ приложения: причина #1945 («аккаунт не
                // активирован») доходит до пользователя на его языке.
                return authFailure(
                    'rejected',
                    authRejectionCode(detail) === 'account_not_activated'
                        ? i18nT('errorsStatic:api.auth.accountNotActivated')
                        : i18nT('errorsStatic:api.auth.invalidCredentials'),
                );
            }
            // 5xx/429/прочее — серверная/временная ошибка. `detail` сюда намеренно
            // НЕ подставляется по той же причине, что и в ветке 400/401/403 выше
            // (#1946): DRF отдаёт такие тексты (например throttle) на языке
            // сервера, а не пользователя. Сырая строка бэкенда не попадает в форму
            // входа ни на одном статусе.
            return authFailure(
                authFailureReasonFromStatus(status),
                i18nT('errorsStatic:api.auth.serviceUnavailable'),
            );
        }
        return authFailureFromError(error, i18nT('errorsStatic:api.auth.signInFailed'));
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
            clearSessionTokens(),
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
            await persistSessionTokens(
                jsonResponse.token,
                typeof resp.refresh === 'string' ? resp.refresh : undefined,
            );
            await AsyncStorage.setItem('userName', jsonResponse.name || '');
        }

        const successMessage = i18nT('errorsStatic:api.auth.registrationSucceeded');
        return { ok: true, message: successMessage };
    } catch (error: unknown) {
        devError('Registration error:', error);
        // #1944: форма регистрации показывает это сообщение как есть. При обрыве связи
        // в него попадал сырой технический текст (`Network request failed`), поэтому
        // транспортный сбой переводим тем же дружелюбным текстом с тегом, что и вход.
        if (isConnectionFailure(error)) {
            return { ok: false, message: getUserFriendlyError(error) };
        }
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
            await persistSessionTokens(jsonResponse.userToken, jsonResponse.refreshToken);
            await setStorageBatch([
                ['userName', jsonResponse.userName || ''],
                ['userId', String(userId)],
                ['isSuperuser', 'false'],
            ]);
            // На общем устройстве в storage мог остаться аватар предыдущего аккаунта:
            // у только что подтверждённого его нет, а `checkAuthentication` восстановил
            // бы чужой. Пишем ту же тройку ключей, что и обычный вход. (#1462)
            await removeStorageBatch(['userAvatar']);
        }
        return jsonResponse;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : i18nT('errorsStatic:api.auth.confirmationFailed');
        throw new Error(msg);
    }
};

/** #1944: тот же контракт, что и у `loginApi` — причина отказа вместо `null` и `Alert`. */
export const googleAuthApi = async (idToken: string): Promise<AuthAttempt<SocialSessionPayload>> => {
    try {
        const trimmedToken = String(idToken || '').trim();
        if (!trimmedToken) {
            return authFailure('rejected', i18nT('errorsStatic:api.auth.googleIdTokenMissing'));
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
            return authFailure(
                authFailureReasonFromStatus(response.status),
                getGoogleAuthErrorMessage(response.status),
            );
        }

        const user = parseSocialSession(json);
        if (user) return { ok: true, user };
        return authFailure('server', i18nT('errorsStatic:api.auth.googleServerTokenMissing'));
    } catch (error: unknown) {
        devError('Google auth error:', error);
        return authFailureFromError(error, i18nT('errorsStatic:api.auth.googleSignInFailed'));
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
        case 'facebook_completion_request_invalid':
            return i18nT('errorsStatic:api.auth.facebookCompletionRequestInvalid');
        case 'facebook_completion_code_invalid':
            return i18nT('errorsStatic:api.auth.facebookCompletionCodeInvalid');
        case 'facebook_completion_invalid':
            return i18nT('errorsStatic:api.auth.facebookCompletionInvalid');
        case 'facebook_account_conflict':
            return i18nT('errorsStatic:api.auth.facebookAccountConflict');
        default:
            if (status >= 500) return i18nT('errorsStatic:api.auth.facebookUnavailable');
            return i18nT('errorsStatic:api.auth.facebookSignInFailed');
    }
};

const facebookErrorResult = (
    payload: Partial<FacebookAuthResponse>,
    status: number,
): FacebookAuthResult => ({
    status: 'error',
    errorCode: payload.error_code,
    reason: authFailureReasonFromStatus(status),
    message: getFacebookAuthErrorMessage(payload, status),
});

const parseFacebookCompletion = (
    payload: FacebookAuthResponse,
): Extract<FacebookAuthResult, { status: 'email_completion_required' }> | null => {
    if (payload.error_code !== 'facebook_email_completion_required') return null;
    const completionHandle = String(payload.completion_handle || '').trim();
    const expiresIn = Number(payload.expires_in);
    const reasonCode = payload.reason_code;
    if (
        !completionHandle ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0 ||
        (reasonCode !== 'facebook_email_permission_missing' &&
            reasonCode !== 'facebook_primary_email_unavailable')
    ) {
        return null;
    }
    return {
        status: 'email_completion_required',
        completionHandle,
        reasonCode,
        expiresIn,
    };
};

// Пустой токен (и пустой nonce у Limited Login) — это тот же отказ
// `access_token_required`, что отдаёт сервер: код сохранён ради совместимости
// клиентов, текст общий для обеих форм credential.
export const getFacebookLoginBody = (
    credential: FacebookCredentialPayload,
): Record<string, string> | null => {
    if (credential.kind === 'authentication_token') {
        const token = String(credential.authenticationToken || '').trim();
        const nonce = String(credential.nonce || '').trim();
        if (!token || !nonce) return null;
        return { authentication_token: token, nonce };
    }
    const token = String(credential.accessToken || '').trim();
    if (!token) return null;
    return { access_token: token };
};

export const facebookAuthApi = async (
    credential: FacebookCredentialPayload,
): Promise<FacebookAuthResult> => {
    try {
        const body = getFacebookLoginBody(credential);
        if (!body) {
            return {
                status: 'error',
                errorCode: 'access_token_required',
                message: i18nT('errorsStatic:api.auth.facebookAccessTokenMissing'),
            };
        }

        const response = await retry(
            async () => fetchWithTimeout(FACEBOOK_LOGIN, {
                method: 'POST',
                ...getApiRequestCredentials(),
                headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
                body: JSON.stringify(body),
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
            const completion = parseFacebookCompletion(json);
            if (response.status === 409 && completion) return completion;
            return facebookErrorResult(json, response.status);
        }
        const user = parseSocialSession(json);
        if (user) return { status: 'authenticated', user };
        return {
            status: 'error',
            message: i18nT('errorsStatic:api.auth.facebookServerTokenMissing'),
        };
    } catch (error: unknown) {
        devError('Facebook auth error:', error);
        const failure = authFailureFromError(error, i18nT('errorsStatic:api.auth.facebookSignInFailed'));
        return { status: 'error', reason: failure.reason, message: failure.message };
    }
};

export const startFacebookEmailCompletionApi = async (
    completionHandle: string,
    email: string,
): Promise<FacebookCompletionStartResult> => {
    try {
        const response = await fetchWithTimeout(FACEBOOK_COMPLETION_START, {
            method: 'POST',
            ...getApiRequestCredentials(),
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ completion_handle: completionHandle, email: email.trim() }),
        }, DEFAULT_TIMEOUT);
        const json = await safeJsonParse<FacebookAuthResponse>(response, {});
        if (response.ok && json.verification_sent === true) {
            return { status: 'verification_sent' };
        }
        return {
            status: 'error',
            errorCode: json.error_code,
            message: getFacebookAuthErrorMessage(json, response.status),
        };
    } catch (error: unknown) {
        devError('Facebook email completion start error:', error);
        const failure = authFailureFromError(error, i18nT('errorsStatic:api.auth.facebookSignInFailed'));
        return { status: 'error', reason: failure.reason, message: failure.message };
    }
};

export const confirmFacebookEmailCompletionApi = async (
    completionHandle: string,
    code: string,
): Promise<FacebookAuthResult> => {
    try {
        const response = await fetchWithTimeout(FACEBOOK_COMPLETION_CONFIRM, {
            method: 'POST',
            ...getApiRequestCredentials(),
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ completion_handle: completionHandle, code: code.trim() }),
        }, DEFAULT_TIMEOUT);
        const json = await safeJsonParse<FacebookAuthResponse>(response, {});
        if (!response.ok) return facebookErrorResult(json, response.status);
        const user = parseSocialSession(json);
        if (user) return { status: 'authenticated', user };
        return {
            status: 'error',
            message: i18nT('errorsStatic:api.auth.facebookServerTokenMissing'),
        };
    } catch (error: unknown) {
        devError('Facebook email completion confirm error:', error);
        return { status: 'error', message: getUserFriendlyError(error) };
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
    } catch {
        devWarn('Push token registration unavailable');
        return false;
    }
};

/**
 * Idempotent DELETE /api/user/push-token/ (#1680). Removes only this device
 * token while the auth credential is still live. Backend contract is
 * `{ push_token }` and 204; extra fields are not part of the unregister
 * serializer. Non-2xx is never reported as success.
 */
export const deletePushTokenApi = async (pushToken: string): Promise<boolean> => {
    try {
        const token = await getStoredAuthToken();
        if (!hasUsableAuthCredential(token) || !pushToken) return false;

        const response = await fetchWithTimeout(PUSH_TOKEN, {
            method: 'DELETE',
            ...getApiRequestCredentials(),
            headers: {
                ...(token ? { Authorization: `Token ${token}` } : {}),
                'Content-Type': 'application/json',
                ...getCsrfHeader(),
            },
            body: JSON.stringify({
                push_token: pushToken,
            }),
        }, DEFAULT_TIMEOUT);

        return response.status === 204 || response.ok;
    } catch {
        devWarn('Push token removal unavailable');
        return false;
    }
};
