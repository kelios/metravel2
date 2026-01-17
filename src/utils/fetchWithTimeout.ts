// src/utils/fetchWithTimeout.ts
// ✅ Общая утилита для fetch с таймаутом

/**
 * Выполняет fetch запрос с таймаутом
 * @param url - URL для запроса
 * @param options - Опции запроса (может включать signal для отмены)
 * @param timeout - Таймаут в миллисекундах (по умолчанию 10000)
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = 10000
): Promise<Response> {
    const externalSignal = options.signal;
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

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } catch (error: any) {
        if ((error?.code === 'ERR_STREAM_PREMATURE_CLOSE' || error?.message === 'Premature close') && didTimeout) {
            throw new Error(`Превышено время ожидания (${timeout}ms). Попробуйте позже.`);
        }
        if (error.name === 'AbortError') {
            // Если отмена произошла из-за внешнего signal, пробрасываем оригинальную ошибку
            if (externalSignal?.aborted) {
                throw error;
            }
            throw new Error(`Превышено время ожидания (${timeout}ms). Попробуйте позже.`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        cleanupExternalAbort?.();
    }
}

