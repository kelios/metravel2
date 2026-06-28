// src/utils/fetchWithTimeout.ts
// ✅ Общая утилита для fetch с таймаутом

/**
 * Выполняет fetch запрос с таймаутом
 * @param url - URL для запроса
 * @param options - Опции запроса (может включать signal для отмены)
 * @param timeout - Таймаут в миллисекундах (по умолчанию 10000)
 * @returns Promise<Response>
 */
// Ошибка нашего таймаута. Имя 'TimeoutError' позволяет retry-предикатам отличать
// её от внешней отмены ('AbortError', напр. анмаунт/cancel запроса React Query) и
// не ретраить — повтор зависшего бэка лишь утроит мёртвое ожидание под спиннером.
// Текст сохранён для обратной совместимости (глобальный retry матчит по сообщению).
function createTimeoutError(timeout: number): Error {
    const err = new Error(`Превышено время ожидания (${timeout}ms). Попробуйте позже.`);
    err.name = 'TimeoutError';
    return err;
}

export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = 10000
): Promise<Response> {
    const createAbortError = (): Error => {
        if (typeof DOMException !== 'undefined') {
            return new DOMException('Aborted', 'AbortError') as unknown as Error;
        }
        const err = new Error('Aborted');
        err.name = 'AbortError';
        return err;
    };
    const shouldRetryLocalApiProxy502 = (candidateUrl: string, init: RequestInit): boolean => {
        if (typeof window === 'undefined') return false;
        if (window.location?.hostname !== 'localhost' && window.location?.hostname !== '127.0.0.1') {
            return false;
        }
        try {
            const parsed = new URL(candidateUrl, window.location.origin);
            if (parsed.origin !== window.location.origin) return false;
            if (!parsed.pathname.startsWith('/api/')) return false;
            const method = String(init.method || 'GET').toUpperCase();
            return ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
        } catch {
            return false;
        }
    };
    const externalSignal = options.signal;
    if (externalSignal?.aborted) {
        throw createAbortError();
    }

    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
    }, timeout);
    let cleanupExternalAbort: (() => void) | undefined;

    // Если есть внешний signal, слушаем его для отмены
    if (externalSignal) {
        const abortHandler = () => controller.abort();
        externalSignal.addEventListener('abort', abortHandler);
        cleanupExternalAbort = () => externalSignal.removeEventListener('abort', abortHandler);
        if (externalSignal.aborted) {
            abortHandler();
        }
    }

    const runFetch = async (): Promise<Response> => {
        if (externalSignal?.aborted || controller.signal.aborted) {
            throw createAbortError();
        }
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    };

    try {
        let response = await runFetch();
        if (response.status === 502 && shouldRetryLocalApiProxy502(url, options)) {
            response = await runFetch();
        }
        return response;
    } catch (error: unknown) {
        const errObj = error as { code?: string; message?: string; name?: string } | null;
        const isPrematureCloseError =
            errObj?.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
            errObj?.message === 'Premature close';

        // In Node (SSR/tests/scripts), abrupt socket closure can bubble up as
        // ERR_STREAM_PREMATURE_CLOSE. Treat it as a transient network failure
        // unless it was caused by our timeout abort.
        if (isPrematureCloseError) {
            if (didTimeout) {
                throw createTimeoutError(timeout);
            }
            throw new Error(
                `Сетевое соединение было прервано при запросе ${url}. Попробуйте позже.`
            );
        }

        // Browsers often throw `TypeError: Failed to fetch` for DNS/connection/CORS issues.
        // Provide a more actionable message while preserving the original error as a cause.
        const message = String(errObj?.message ?? '');
        if (error instanceof TypeError && /failed to fetch/i.test(message)) {
            const err = new Error(
                `Network error while fetching ${url}. ` +
                  `Is the API server running and reachable from this device/browser?`
            );
            (err as Error & { cause?: unknown }).cause = error;
            throw err;
        }
        if (errObj?.name === 'AbortError') {
            // Если отмена произошла из-за внешнего signal, пробрасываем оригинальную ошибку
            if (externalSignal?.aborted) {
                throw error;
            }
            throw createTimeoutError(timeout);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        cleanupExternalAbort?.();
    }
}
