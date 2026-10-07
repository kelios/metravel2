// src/utils/retry.ts
// ✅ Утилита для повторных попыток выполнения операций

import { devError } from './logger';
import { isServerStillWorkingAfter } from '@/api/clientErrors';
import { noServerWorkInFlight } from '@/utils/queryRetryPolicy';
import { isConnectionFailure } from '@/utils/networkFailureTag';

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

            if (!noServerWorkInFlight(error)) {
                throw lastError;
            }

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
    return !isServerStillWorkingAfter(error) && isConnectionFailure(error);
}

/**
 * Проверяет, является ли ошибка временной (можно повторить)
 */
export function isRetryableError(error: Error): boolean {
    return noServerWorkInFlight(error);
}
