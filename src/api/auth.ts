import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FormValues } from '@/src/types/types';
import { devError } from '@/src/utils/logger';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { sanitizeInput } from '@/src/utils/security';
import { validatePassword } from '@/src/utils/validation';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';
import { getUserFriendlyError } from '@/src/utils/userFriendlyErrors';
import { retry, isRetryableError } from '@/src/utils/retry';
import { getSecureItem, setSecureItem } from '@/src/utils/secureStorage';

const rawApiUrl: string =
    process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
if (!rawApiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

// Нормализуем базу API: гарантируем суффикс /api и убираем лишние слэши
const URLAPI = (() => {
    const trimmed = rawApiUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

const DEFAULT_TIMEOUT = 10000; // 10 секунд

const LOGIN = `${URLAPI}/user/login/`;
const LOGOUT = `${URLAPI}/user/logout/`;
const REGISTER = `${URLAPI}/user/registration/`;
const RESETPASSWORDLINK = `${URLAPI}/user/reset-password-link/`;
const CONFIRM_REGISTER = `${URLAPI}/user/confirm-registration/`;
const SETNEWPASSWORD = `${URLAPI}/user/set-password-after-reset/`;
const SENDPASSWORD = `${URLAPI}/user/sendpassword/`;

export const loginApi = async (email: string, password: string): Promise<{
    token: string;
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

        const response = await retry(
            async () => {
                return await fetchWithTimeout(LOGIN, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
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

        if (!response.ok) {
            throw new Error('Неверный email или пароль');
        }

        const json = await safeJsonParse<{
            token?: string;
            name?: string;
            email?: string;
            id?: string | number;
            is_superuser?: boolean;
        }>(response, {});

        if (json.token) return json as any;
        return null;
    } catch (error: any) {
        devError('Login error:', error);
        const message = getUserFriendlyError(error);
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
            },
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        await safeJsonParse(response, {}).catch(() => undefined);
        await AsyncStorage.removeItem('userName');
        await AsyncStorage.removeItem('userId');
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
    }
};

export const sendPasswordApi = async (email: string) => {
    try {
        const response = await fetchWithTimeout(SENDPASSWORD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, password_reset_token }),
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        const json = await safeJsonParse<{ success?: boolean; message?: string }>(response, {});
        if (json.success) {
            Alert.alert('Успех', 'Пароль успешно изменен');
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
                throw new Error(passwordValidation.error || 'Пароль не соответствует требованиям');
            }
        }

        const response = await retry(
            async () => {
                return await fetchWithTimeout(REGISTER, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
            name?: string;
            error?: string;
        }>(response, {});

        if (!response.ok) {
            throw new Error(jsonResponse.error || 'Ошибка регистрации');
        }

        if (jsonResponse.token) {
            await setSecureItem('userToken', jsonResponse.token);
            await AsyncStorage.setItem('userName', jsonResponse.name || '');
        }
        return { ok: true, message: 'Пользователь успешно зарегистрирован. Проверьте почту для активации.' };
    } catch (error: any) {
        devError('Registration error:', error);
        return { ok: false, message: error.message || 'Произошла неизвестная ошибка.' };
    }
};

export const confirmAccount = async (hash: string) => {
    try {
        const response = await fetchWithTimeout(CONFIRM_REGISTER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash }),
        }, DEFAULT_TIMEOUT);

        const jsonResponse = await safeJsonParse<{
            userToken?: string;
            userName?: string;
        }>(response, {});

        if (jsonResponse.userToken) {
            await setSecureItem('userToken', jsonResponse.userToken);
            await AsyncStorage.setItem('userName', jsonResponse.userName || '');
        }
        return jsonResponse;
    } catch (error: any) {
        throw new Error(error.message || 'Произошла ошибка при подтверждении учетной записи.');
    }
};
