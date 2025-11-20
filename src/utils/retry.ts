// src/utils/retry.ts
// ✅ Утилита для повторных попыток выполнения операций

import { devError } from './logger';

export interface RetryOptions {
    maxAttempts?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number, error: Error) => void;
    shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'shouldRetry'>> = {
    maxAttempts: 3,
    delay: 1000,
    backoff: 'exponential',
};

/**
 * Выполняет функцию с повторными попытками при ошибке
 * @param fn - Функция для выполнения
 * @param options - Опции для retry
 * @returns Результат выполнения функции
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = DEFAULT_OPTIONS.maxAttempts,
        delay = DEFAULT_OPTIONS.delay,
        backoff = DEFAULT_OPTIONS.backoff,
        onRetry,
        shouldRetry,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Проверяем, нужно ли повторять попытку
            if (shouldRetry && !shouldRetry(lastError)) {
                throw lastError;
            }

            // Если это последняя попытка, пробрасываем ошибку
            if (attempt >= maxAttempts) {
                throw lastError;
            }

            // Вызываем callback перед повторной попыткой
            onRetry?.(attempt, lastError);

            // Вычисляем задержку
            const currentDelay = backoff === 'exponential'
                ? delay * Math.pow(2, attempt - 1)
                : delay * attempt;

            // Ждем перед следующей попыткой
            await new Promise(resolve => setTimeout(resolve, currentDelay));

            if (__DEV__) {
                devError(`Retry attempt ${attempt + 1}/${maxAttempts} after ${currentDelay}ms:`, lastError.message);
            }
        }
    }

    // Этот код не должен выполняться, но TypeScript требует возврат
    throw lastError || new Error('Unknown error');
}

/**
 * Проверяет, является ли ошибка сетевой (можно повторить)
 */
export function isNetworkError(error: Error): boolean {
    const networkErrorPatterns = [
        /network/i,
        /timeout/i,
        /fetch/i,
        /ECONNREFUSED/i,
        /ENOTFOUND/i,
        /ETIMEDOUT/i,
        /Failed to fetch/i,
        /NetworkError/i,
    ];

    return networkErrorPatterns.some(pattern => pattern.test(error.message));
}

/**
 * Проверяет, является ли ошибка временной (можно повторить)
 */
export function isRetryableError(error: Error): boolean {
    // Не повторяем для ошибок валидации или авторизации
    const nonRetryablePatterns = [
        /401/i,
        /403/i,
        /400/i,
        /validation/i,
        /invalid/i,
        /unauthorized/i,
        /forbidden/i,
    ];

    if (nonRetryablePatterns.some(pattern => pattern.test(error.message))) {
        return false;
    }

    // Повторяем для сетевых ошибок и 5xx ошибок
    return isNetworkError(error) || /50\d/i.test(error.message);
}

