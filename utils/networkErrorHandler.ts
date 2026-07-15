// src/utils/networkErrorHandler.ts
// УЛУЧШЕНИЕ: Глобальный обработчик сетевых ошибок

import { Platform } from 'react-native';
import { ApiError } from '@/api/client';
import { showToast } from '@/utils/toast';
import { translate as i18nT } from '@/i18n'


const showToastMessage = async (payload: any) => {
    await showToast(payload);
};

/**
 * Проверяет, является ли ошибка сетевой
 */
const getGlobalNavigator = () =>
    (globalThis as typeof globalThis & { navigator?: { onLine?: boolean } }).navigator;

const hasOfflineFlag = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && (value as { offline?: unknown }).offline === true;

export const isNetworkError = (error: any): boolean => {
    if (!error) return false;

    // Проверка для ApiError
    if (error instanceof ApiError) {
        // ApiError с status 0 обычно означает сетевую ошибку
        if (error.status === 0 || hasOfflineFlag(error.data)) {
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
        (() => {
            const navigatorObject = getGlobalNavigator();
            return Boolean(
                navigatorObject &&
                typeof navigatorObject.onLine === 'boolean' &&
                !navigatorObject.onLine
            );
        })()
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
        return i18nT('errors:utils.networkErrorHandler.proizoshla_neizvestnaya_oshibka_678842d7');
    }

    // Если это ApiError, используем его сообщение
    if (error instanceof ApiError) {
        if (hasOfflineFlag(error.data) || error.status === 0) {
            return i18nT('errors:utils.networkErrorHandler.net_podklyucheniya_k_internetu_proverte_vash_76b1a868');
        }
        if (error.status === 401) {
            return i18nT('errors:utils.networkErrorHandler.trebuetsya_avtorizatsiya_pozhaluysta_voydite_e6066fc3');
        }
        if (error.status === 403) {
            return i18nT('errors:utils.networkErrorHandler.dostup_zapreschen_u_vas_net_prav_dlya_vypoln_87f83810');
        }
        if (error.status >= 500) {
            return i18nT('errors:utils.networkErrorHandler.oshibka_servera_pozhaluysta_poprobuyte_pozzh_bec5b04f');
        }
        if (error.status === 404) {
            return i18nT('errors:utils.networkErrorHandler.zaprashivaemyy_resurs_ne_nayden_859798c3');
        }
        return error.message || i18nT('errorsStatic:utils.network.requestFailed');
    }

    // Проверяем тип ошибки
    if (isNetworkError(error)) {
        return i18nT('errors:utils.networkErrorHandler.net_podklyucheniya_k_internetu_proverte_vash_76b1a868');
    }

    if (isAuthError(error)) {
        return i18nT('errors:utils.networkErrorHandler.trebuetsya_avtorizatsiya_pozhaluysta_voydite_e6066fc3');
    }

    if (isServerError(error)) {
        return i18nT('errors:utils.networkErrorHandler.oshibka_servera_pozhaluysta_poprobuyte_pozzh_bec5b04f');
    }

    // Возвращаем сообщение об ошибке или дефолтное
    return error?.message || i18nT('errorsStatic:utils.network.unknownError');
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
        void showToastMessage({
            type: toastType,
            text1: isNetworkError(error) ? i18nT('errors:utils.networkErrorHandler.net_podklyucheniya_d70bb618') : i18nT('errors:utils.networkErrorHandler.oshibka_de1b2f1a'),
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
