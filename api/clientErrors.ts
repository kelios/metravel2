// api/clientErrors.ts
// ✅ Извлечено из api/client.ts (TD-012, pure-move): класс ошибки API и
// хелперы маппинга/детекции ошибок. Поведение не меняется.

import { Platform } from 'react-native';

/**
 * Класс ошибки API
 */
export class ApiError extends Error {
    constructor(
        public status: number,
        public message: string,
        public data?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export const hasLoggableRequestError = (error: unknown): boolean => {
    if (error == null) return false;
    if (typeof error === 'string') {
        return error.trim().length > 0;
    }
    if (error instanceof Error) {
        return error.message.trim().length > 0 || error.name.trim().length > 0;
    }
    if (typeof error === 'object') {
        return Object.keys(error as Record<string, unknown>).length > 0;
    }
    return true;
};

export const isOfflineLikeError = (error: unknown): boolean => {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Отменённый/прерванный запрос — это НЕ offline (иначе показываем юзеру
    // «нет интернета», хотя сеть есть и запрос просто отменён при анмаунте).
    if (/\b(aborted|cancell?ed)\b/i.test(errorMessage)) return false;

    const isOffline =
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.onLine === false;
    // Узкие сигнатуры реального отсутствия сети (Chrome / RN). НЕ матчим по
    // широким 'fetch'/'timeout': серверный таймаут или 5xx ≠ offline.
    const isFetchFailure =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('network failed');

    return isOffline || isFetchFailure;
};
