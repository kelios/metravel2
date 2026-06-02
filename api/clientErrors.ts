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
    const isOffline =
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.onLine === false;
    const isFetchFailure =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('network failed');

    return isOffline || isFetchFailure;
};
