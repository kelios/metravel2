// src/utils/networkErrorHandler.ts
// ✅ УЛУЧШЕНИЕ: Глобальный обработчик сетевых ошибок

import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { ApiError } from '@/src/api/client';

/**
 * Проверяет, является ли ошибка сетевой
 */
export const isNetworkError = (error: any): boolean => {
    if (!error) return false;

    // Проверка для ApiError
    if (error instanceof ApiError) {
        // ApiError с status 0 обычно означает сетевую ошибку
        if (error.status === 0 || error.data?.offline) {
            return true;
        }
    }

    // Проверка сообщения об ошибке
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code?.toLowerCase() || '';
    const name = error?.name?.toLowerCase() || '';

    return (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('timeout') ||
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('нет подключения') ||
        message.includes('интернет') ||
        code === 'network_error' ||
        code === 'econnrefused' ||
        code === 'enetunreach' ||
        code === 'etimedout' ||
        name === 'networkerror' ||
        name === 'typeerror' ||
        (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine)
    );
};

/**
 * Проверяет, является ли ошибка ошибкой авторизации
 */
export const isAuthError = (error: any): boolean => {
    if (!error) return false;

    if (error instanceof ApiError) {
        return error.status === 401 || error.status === 403;
    }

    const message = error?.message?.toLowerCase() || '';
    return (
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('авторизация') ||
        message.includes('доступ запрещен')
    );
};

/**
 * Проверяет, является ли ошибка ошибкой сервера (5xx)
 */
export const isServerError = (error: any): boolean => {
    if (!error) return false;

    if (error instanceof ApiError) {
        return error.status >= 500 && error.status < 600;
    }

    const message = error?.message?.toLowerCase() || '';
    return message.includes('server error') || message.includes('ошибка сервера');
};

/**
 * Получает понятное сообщение об ошибке для пользователя
 */
export const getUserFriendlyNetworkError = (error: any): string => {
    if (!error) {
        return 'Произошла неизвестная ошибка';
    }

    // Если это ApiError, используем его сообщение
    if (error instanceof ApiError) {
        if (error.data?.offline || error.status === 0) {
            return 'Нет подключения к интернету. Проверьте ваше соединение и попробуйте снова.';
        }
        if (error.status === 401) {
            return 'Требуется авторизация. Пожалуйста, войдите в систему.';
        }
        if (error.status === 403) {
            return 'Доступ запрещен. У вас нет прав для выполнения этого действия.';
        }
        if (error.status >= 500) {
            return 'Ошибка сервера. Пожалуйста, попробуйте позже.';
        }
        if (error.status === 404) {
            return 'Запрашиваемый ресурс не найден.';
        }
        return error.message || 'Произошла ошибка при выполнении запроса.';
    }

    // Проверяем тип ошибки
    if (isNetworkError(error)) {
        return 'Нет подключения к интернету. Проверьте ваше соединение и попробуйте снова.';
    }

    if (isAuthError(error)) {
        return 'Требуется авторизация. Пожалуйста, войдите в систему.';
    }

    if (isServerError(error)) {
        return 'Ошибка сервера. Пожалуйста, попробуйте позже.';
    }

    // Возвращаем сообщение об ошибке или дефолтное
    return error?.message || 'Произошла неизвестная ошибка';
};

/**
 * Обрабатывает сетевую ошибку и показывает уведомление пользователю
 */
export const handleNetworkError = (
    error: any,
    options?: {
        showToast?: boolean;
        toastType?: 'error' | 'info' | 'warning';
        onRetry?: () => void;
        silent?: boolean;
    }
): void => {
    const {
        showToast = true,
        toastType = 'error',
        onRetry,
        silent = false,
    } = options || {};

    if (silent) {
        return;
    }

    const message = getUserFriendlyNetworkError(error);

    // Логируем ошибку в dev режиме
    if (__DEV__) {
        console.error('[NetworkErrorHandler]', error);
    }

    // Показываем Toast уведомление
    if (showToast && Platform.OS === 'web') {
        Toast.show({
            type: toastType,
            text1: isNetworkError(error) ? 'Нет подключения' : 'Ошибка',
            text2: message,
            visibilityTime: isNetworkError(error) ? 5000 : 4000,
        });
    }

    // Если есть callback для повтора, можно его вызвать
    if (onRetry && isNetworkError(error)) {
        // Можно автоматически повторить при восстановлении сети
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const handleOnline = () => {
                window.removeEventListener('online', handleOnline);
                onRetry();
            };
            window.addEventListener('online', handleOnline);
        }
    }
};

/**
 * Обертка для async функций с автоматической обработкой ошибок
 */
export const withNetworkErrorHandler = async <T>(
    fn: () => Promise<T>,
    options?: {
        showToast?: boolean;
        onError?: (error: any) => void;
        silent?: boolean;
    }
): Promise<T | null> => {
    try {
        return await fn();
    } catch (error) {
        handleNetworkError(error, {
            showToast: options?.showToast,
            silent: options?.silent,
        });

        if (options?.onError) {
            options.onError(error);
        }

        return null;
    }
};

