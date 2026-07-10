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
const PUSH_TOKEN = `${URLAPI}/user/push-token/`;

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
        return 'Google не подтвердил аккаунт. Попробуйте выбрать аккаунт ещё раз.';
    }
    if (status >= 500) {
        return 'Сервис Google-входа временно недоступен. Попробуйте позже.';
    }
    return 'Не удалось войти через Google.';
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
            Alert.alert('Ошибка', 'Пароль не может быть пустым');
            return null;
        }

        const trimmedEmail = (email ?? '').trim();
        if (!trimmedEmail) {
            Alert.alert('Ошибка', 'Email не может быть пустым');
            return null;
        }

        const response = await retry(
            async () => {
                const res = await fetchWithTimeout(LOGIN, {
                    method: 'POST',
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
            message = 'Неверный email или пароль';
        } else if (/Login failed: \d+/.test(rawMessage)) {
            // 5xx/429/прочее — серверная/временная ошибка, не вводим в заблуждение «неверным паролем».
            message = 'Сервис временно недоступен. Попробуйте позже.';
        } else {
            message = getUserFriendlyError(error);
        }
        Alert.alert('Ошибка входа', message);
        return null;
    }
};

export const logoutApi = async () => {
    try {
        const token = await getSecureItem('userToken');
        const response = await fetchWithTimeout(LOGOUT, {
            method: 'POST',
            headers: {
                Authorization: `Token ${token}`,
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
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ email }),
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        const json = await safeJsonParse<{ success?: boolean; message?: string }>(response, {});
        if (json.success) {
            Alert.alert('Успех', 'Инструкции по восстановлению пароля отправлены на ваш email');
            return true;
        }
        Alert.alert('Ошибка', getUserFriendlyError(json.message || 'Не удалось отправить инструкции по восстановлению пароля'));
        return false;
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        Alert.alert('Ошибка', getUserFriendlyError(error));
        return false;
    }
};

export const resetPasswordLinkApi = async (email: string) => {
    const sanitizedEmail = sanitizeInput(email.trim());
    if (!sanitizedEmail) {
        throw new Error('Email не может быть пустым');
    }

    try {
        const response = await fetchWithTimeout(RESETPASSWORDLINK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ email: sanitizedEmail }),
        }, DEFAULT_TIMEOUT);

        const json = await safeJsonParse<{ email?: string[]; message?: string }>(response, {});

        if (!response.ok) {
            return json?.email?.[0] || json?.message || 'Ошибка';
        }

        return json?.message || 'Инструкции по восстановлению отправлены.';
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        return 'Не удалось отправить инструкции по восстановлению пароля';
    }
};

export const setNewPasswordApi = async (password_reset_token: string, password: string) => {
    try {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            Alert.alert('Ошибка валидации', passwordValidation.error || 'Пароль не соответствует требованиям');
            return false;
        }

        const response = await fetchWithTimeout(SETNEWPASSWORD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ password, password_reset_token }),
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        const json = await safeJsonParse<{ success?: boolean; detail?: string; message?: string }>(response, {});
        if (json.success || json.detail) {
            Alert.alert('Успех', json.detail || 'Пароль успешно изменен');
            return true;
        }
        Alert.alert('Ошибка', getUserFriendlyError(json.message || 'Не удалось изменить пароль'));
        return false;
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        Alert.alert('Ошибка', getUserFriendlyError(error));
        return false;
    }
};

export const registration = async (values: FormValues): Promise<{ ok: boolean; message: string }> => {
    try {
        if (values.password) {
            const passwordValidation = validatePassword(values.password);
            if (!passwordValidation.valid) {
                Alert.alert('Ошибка валидации', passwordValidation.error || 'Пароль не соответствует требованиям');
                return { ok: false, message: passwordValidation.error || 'Пароль не соответствует требованиям' };
            }
        }

        const response = await retry(
            async () => {
                return await fetchWithTimeout(REGISTER, {
                    method: 'POST',
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
            return { ok: false, message: jsonResponse.error || 'Ошибка регистрации' };
        }

        if (jsonResponse.token) {
            await setSecureItem('userToken', jsonResponse.token);
            const resp = jsonResponse as Record<string, unknown>;
            if (typeof resp.refresh === 'string') {
                await setSecureItem('refreshToken', resp.refresh);
            }
            await AsyncStorage.setItem('userName', jsonResponse.name || '');
        }

        const successMessage = 'Пользователь успешно зарегистрирован. Проверьте почту для активации.';
        return { ok: true, message: successMessage };
    } catch (error: unknown) {
        devError('Registration error:', error);
        const msg = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { ok: false, message: msg };
    }
};

export const confirmAccount = async (hash: string) => {
    try {
        const response = await fetchWithTimeout(CONFIRM_REGISTER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getCsrfHeader() },
            body: JSON.stringify({ hash }),
        }, DEFAULT_TIMEOUT);

        const jsonResponse = await safeJsonParse<{
            userToken?: string;
            userName?: string;
            refreshToken?: string;
        }>(response, {});

        if (jsonResponse.userToken) {
            await setSecureItem('userToken', jsonResponse.userToken);
            if (jsonResponse.refreshToken) {
                await setSecureItem('refreshToken', jsonResponse.refreshToken);
            }
            await AsyncStorage.setItem('userName', jsonResponse.userName || '');
        }
        return jsonResponse;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Произошла ошибка при подтверждении учетной записи.';
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
            throw new Error('Не удалось получить id_token от Google');
        }

        const response = await retry(
            async () => {
                return await fetchWithTimeout(GOOGLE_LOGIN, {
                    method: 'POST',
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
        throw new Error('Сервер не вернул токен авторизации Google.');
    } catch (error: unknown) {
        devError('Google auth error:', error);
        const message = getUserFriendlyError(error);
        Alert.alert('Ошибка входа через Google', message);
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
        const token = await getSecureItem('userToken');
        if (!token) return false;

        const response = await fetchWithTimeout(PUSH_TOKEN, {
            method: 'POST',
            headers: {
                Authorization: `Token ${token}`,
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
