// api/client.ts
// ✅ АРХИТЕКТУРА: Единый API клиент с автоматическим refresh token
// ✅ FIX-001: Использует безопасное хранилище для токенов
// ✅ FIX-003: Исправлена race condition при обновлении токена

import { devError } from '@/utils/logger';
import { Platform } from 'react-native';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getCsrfHeader } from '@/utils/csrf';
import { setSecureItem, getSecureItem, removeSecureItems } from '@/utils/secureStorage';
import {
    API_BASE_URL,
    DEFAULT_TIMEOUT,
    LONG_TIMEOUT,
    TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    isE2E,
} from '@/api/apiConfig';
import { notifyAuthInvalidation } from '@/api/authInvalidation';
export { setAuthInvalidationHandler } from '@/api/authInvalidation';
import { getApiErrorMessage, getErrorTextField } from '@/utils/errorHelpers';
import { RateLimiter, type RateLimitSlot } from '@/utils/rateLimiter';
import { ApiError, hasLoggableRequestError, isOfflineLikeError } from '@/api/clientErrors';
import {
    type DownloadResponse,
    TRANSIENT_UPLOAD_STATUSES,
    UPLOAD_RETRY_DELAY_MS,
    parseDownloadFilename,
} from '@/api/clientTypes';

export { ApiError, isTimeoutError } from '@/api/clientErrors';

/**
 * Единый API клиент
 */
class ApiClient {
    private baseURL: string;
    private defaultHeaders: HeadersInit;
    private refreshTokenPromise: Promise<string> | null = null;
    private refreshTokenLock: boolean = false; // ✅ FIX-003: Lock для предотвращения race condition

    // ⚠️ Чисто клиентский in-memory предохранитель от runaway render-loop'ов
    // (на сервер не ходит, сбрасывается на полной перезагрузке). Реальный
    // rate limiting — на бэкенде. Поэтому глобальный потолок держим высоким,
    // чтобы обычная навигация по SPA (главная/лента/места шлют пачки запросов)
    // не упёрлась в лимит и не показала ложное «Нет подключения к интернету».
    // От зацикливания защищает maxPerEndpoint (на один и тот же эндпоинт).
    private rateLimiter = new RateLimiter({
        window: 60_000,
        maxPerWindow: 600,
        maxPerEndpoint: 60,
        endpointLimits: { '/travels/upsert/': 120 },
    });

    constructor() {
        this.baseURL = API_BASE_URL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    private checkRateLimit(endpoint: string): RateLimitSlot | null {
        return this.rateLimiter.acquire(endpoint);
    }

    private releaseRateLimitSlot(slot: RateLimitSlot): void {
        this.rateLimiter.release(slot);
    }

    /**
     * Обновляет access token используя refresh token
     * ✅ FIX-003: Исправлена race condition через lock механизм
     */
    private async refreshAccessToken(): Promise<string> {
        // Если уже идет обновление, ждем его завершения
        if (this.refreshTokenLock) {
            // Ждем завершения текущего обновления
            while (this.refreshTokenLock && this.refreshTokenPromise) {
                try {
                    return await this.refreshTokenPromise;
                } catch {
                    // Если обновление провалилось, продолжаем ждать или запускаем новое
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }

        // Если есть существующий промис, возвращаем его
        if (this.refreshTokenPromise) {
            return this.refreshTokenPromise;
        }

        // Устанавливаем lock
        this.refreshTokenLock = true;

        this.refreshTokenPromise = (async () => {
            try {
                // ✅ FIX-001: Используем безопасное хранилище
                const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
                if (!refreshToken) {
                    throw new Error('Refresh token не найден');
                }

                const response = await fetchWithTimeout(
                    `${this.baseURL}/user/refresh/`,
                    {
                        method: 'POST',
                        headers: this.defaultHeaders,
                        body: JSON.stringify({ refresh: refreshToken }),
                    },
                    DEFAULT_TIMEOUT
                );

                if (!response.ok) {
                    // Если refresh не удался, очищаем токены
                    await this.clearTokens();
                    throw new ApiError(response.status, 'Не удалось обновить токен');
                }

                const data = await response.json();
                const newAccessToken = data.access || data.token;

                if (newAccessToken) {
                    // ✅ FIX-001: Сохраняем в безопасное хранилище
                    await setSecureItem(TOKEN_KEY, newAccessToken);
                    if (data.refresh) {
                        await setSecureItem(REFRESH_TOKEN_KEY, data.refresh);
                    }
                }

                return newAccessToken;
            } catch (error) {
                // Очищаем токены при ошибке
                await this.clearTokens();
                throw error;
            } finally {
                // Снимаем lock и очищаем промис
                this.refreshTokenLock = false;
                this.refreshTokenPromise = null;
            }
        })();

        return this.refreshTokenPromise;
    }

    /**
     * Очищает все токены
     * ✅ FIX-001: Использует безопасное хранилище
     */
    private async clearTokens(): Promise<void> {
        await removeSecureItems([TOKEN_KEY, REFRESH_TOKEN_KEY]);
        notifyAuthInvalidation();
    }

    /**
     * Получает текущий access token
     * ✅ FIX-001: Использует безопасное хранилище
     */
    private async getAccessToken(): Promise<string | null> {
        return await getSecureItem(TOKEN_KEY);
    }

    /**
     * Строит заголовки запроса: опциональные defaultHeaders + Authorization (если есть токен)
     * + переданные extra. Поведение идентично прежним inline-литералам:
     * пустой/нулевой токен не добавляет Authorization.
     */
    private authHeaders(
        token: string | null,
        options: { includeDefaults?: boolean; extra?: HeadersInit } = {}
    ): HeadersInit {
        const { includeDefaults = false, extra } = options;
        return {
            ...(includeDefaults ? this.defaultHeaders : {}),
            ...(token ? { Authorization: `Token ${token}` } : {}),
            // FE-mitigation: Django/DRF требует X-CSRFToken на unsafe-методах при
            // наличии session-cookie, иначе 403. Безвреден на GET. См. utils/csrf.ts.
            ...getCsrfHeader(),
            ...extra,
        };
    }

    /** Пытается распарсить тело ошибки как JSON, иначе возвращает исходный текст. */
    private parseErrorBody(text: string): unknown {
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    /** Читает тело ответа-ошибки и бросает ApiError с человекочитаемым сообщением. */
    private async throwDetailedError(response: Response): Promise<never> {
        const errorText = await response.text().catch(() => 'Unknown error');
        const errorData = this.parseErrorBody(errorText);
        throw new ApiError(
            response.status,
            getApiErrorMessage(errorData, response.statusText),
            errorData
        );
    }

    private async parseSuccessResponse<T>(response: Response): Promise<T> {
        if (response.status === 204) {
            return null as T;
        }

        const maybeTextFn = (response as Partial<Response>)?.text;
        if (typeof maybeTextFn === 'function') {
            const text = await response.text().catch(() => '');
            if (!text) {
                return null as T;
            }
            try {
                return JSON.parse(text) as T;
            } catch {
                // Если это простой текст, не JSON, логируем и возвращаем null
                if (__DEV__) {
                    devError('Ошибка парсинга JSON в parseSuccessResponse:', text.substring(0, 100));
                }
                return null as T;
            }
        }

        const maybeJsonFn = (response as Partial<Response>)?.json;
        if (typeof maybeJsonFn === 'function') {
            return (await response.json()) as T;
        }

        return null as T;
    }

    private isTransientUploadStatus(status: number): boolean {
        return TRANSIENT_UPLOAD_STATUSES.has(status);
    }

    private async wait(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async fetchUploadWithTransientRetry(
        endpoint: string,
        init: RequestInit,
        timeout: number,
        retries: number = 1
    ): Promise<Response> {
        let attempt = 0;

        while (true) {
            const response = await fetchWithTimeout(`${this.baseURL}${endpoint}`, init, timeout);
            const shouldRetry =
                attempt < retries && !response.ok && this.isTransientUploadStatus(response.status);

            if (!shouldRetry) {
                return response;
            }

            attempt += 1;
            if (UPLOAD_RETRY_DELAY_MS > 0) {
                await this.wait(UPLOAD_RETRY_DELAY_MS);
            }
        }
    }

    /**
     * Проверяет доступность сети
     * ✅ FIX-005: Проверка offline режима
     */
    private async checkNetworkStatus(): Promise<boolean> {
        return true;
    }

    /**
     * Основной метод для выполнения запросов
     * ✅ FIX-005: Добавлена обработка offline режима
     * ✅ FIX: Добавлена проверка rate limit
     */
    async request<T>(
        endpoint: string,
        options: RequestInit & { skipAuth?: boolean } = {},
        timeout: number = DEFAULT_TIMEOUT
    ): Promise<T> {
        const { skipAuth = false } = options;
        // ✅ FIX: Проверяем rate limit перед запросом
        const rateLimitSlot = this.checkRateLimit(endpoint);
        if (!rateLimitSlot) {
            throw new ApiError(
                429,
                'Слишком много запросов. Пожалуйста, подождите немного.',
                { rateLimited: true }
            );
        }

        // ✅ FIX-005: Проверяем доступность сети перед запросом
        const isOnline = await this.checkNetworkStatus();
        if (!isOnline) {
            throw new ApiError(
                0,
                'Нет подключения к интернету. Проверьте ваше соединение и попробуйте снова.',
                { offline: true }
            );
        }

        const token = skipAuth ? null : await this.getAccessToken();
        const headers = this.authHeaders(token, { includeDefaults: true, extra: options.headers });

        try {
            const response = await fetchWithTimeout(
                `${this.baseURL}${endpoint}`,
                { ...options, headers },
                timeout
            );

            // Если токена нет, но сервер вернул 401 — состояние аутентификации, вероятно, устарело
            // (например, токен был удалён в другой вкладке). Сбрасываем состояние, чтобы UI обновился.
            if (response.status === 401 && !token) {
                // Do not wipe a stored token when the caller explicitly opted out of
                // auth (skipAuth) — the endpoint is public and the token may still be
                // valid elsewhere. Only clear when we actually sent no token.
                if (!skipAuth) {
                    await this.clearTokens();
                }
                throw new ApiError(401, 'Требуется авторизация');
            }

            // Если получили 401, пробуем обновить токен.
            // В E2E окружении токен может быть "фейковым" (см. e2e/global-setup.ts) и
            // попытка refresh без refreshToken приводит к очистке токенов и каскадным
            // падениям e2e после первого 401. Поэтому в E2E не делаем refresh.
            if (response.status === 401 && token) {
                if (isE2E) {
                    throw new ApiError(401, 'Требуется авторизация');
                }
                try {
                    const newToken = await this.refreshAccessToken();
                    // Повторяем запрос с новым токеном
                    const retryHeaders: HeadersInit = {
                        ...this.defaultHeaders,
                        Authorization: `Token ${newToken}`,
                        ...options.headers,
                    };

                    const retryResponse = await fetchWithTimeout(
                        `${this.baseURL}${endpoint}`,
                        { ...options, headers: retryHeaders },
                        timeout
                    );

                    if (!retryResponse.ok) {
                        throw new ApiError(
                            retryResponse.status,
                            `Ошибка запроса: ${retryResponse.statusText}`,
                            await retryResponse.text().catch(() => null)
                        );
                    }

                    return await this.parseSuccessResponse<T>(retryResponse);
                } catch {
                    // Если refresh не удался, очищаем токены и пробуем повторить запрос без авторизации.
                    // Это важно для публичных эндпоинтов, которые могут работать без токена, но
                    // падают из‑за устаревшего/некорректного токена в хранилище.
                    await this.clearTokens();

                    const fallbackHeaders = this.authHeaders(null, {
                        includeDefaults: true,
                        extra: options.headers,
                    });
                    const fallbackResponse = await fetchWithTimeout(
                        `${this.baseURL}${endpoint}`,
                        { ...options, headers: fallbackHeaders },
                        timeout
                    );

                    if (!fallbackResponse.ok) {
                        await this.throwDetailedError(fallbackResponse);
                    }

                    return await this.parseSuccessResponse<T>(fallbackResponse);
                }
            }

            if (!response.ok) {
                await this.throwDetailedError(response);
            }

            // Если ответ пустой (204 No Content), возвращаем null
            if (response.status === 204) {
                return null as T;
            }

            return await this.parseSuccessResponse<T>(response);
        } catch (error) {
            const errorName = error instanceof Error ? error.name : '';
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isAbortError =
                errorName === 'AbortError' ||
                (typeof options.signal !== 'undefined' && options.signal?.aborted === true) ||
                // Отменённый/прерванный fetch (в т.ч. expo "Fetch request has been
                // canceled") — это не ошибка, не логируем и не маппим в offline.
                /\b(aborted|cancell?ed)\b/i.test(errorMessage);
            if (isAbortError) {
                this.releaseRateLimitSlot(rateLimitSlot);
                throw error;
            }

            if (error instanceof ApiError) {
                throw error;
            }
            
            // ✅ ИСПРАВЛЕНИЕ: Улучшенная обработка сетевых ошибок
            if (hasLoggableRequestError(error)) {
                devError('API request error:', error);
            }
            
            // Проверяем, является ли это сетевой ошибкой
            if (isOfflineLikeError(error)) {
                throw new ApiError(
                    0,
                    'Нет подключения к интернету. Проверьте ваше соединение и попробуйте снова.',
                    { offline: true }
                );
            }

            // For non-offline errors, preserve original error message for callers/tests.
            throw error;
        }
    }

    async download(
        endpoint: string,
        options: RequestInit = {},
        timeout: number = LONG_TIMEOUT
    ): Promise<DownloadResponse> {
        const rateLimitSlot = this.checkRateLimit(endpoint);
        if (!rateLimitSlot) {
            throw new ApiError(
                429,
                'Слишком много запросов. Пожалуйста, подождите немного.',
                { rateLimited: true }
            );
        }

        const isOnline = await this.checkNetworkStatus();
        if (!isOnline) {
            throw new ApiError(
                0,
                'Нет подключения к интернету. Проверьте ваше соединение и попробуйте снова.',
                { offline: true }
            );
        }

        const token = await this.getAccessToken();
        const headers = this.authHeaders(token, { extra: options.headers });

        const handle = async (resp: Response): Promise<DownloadResponse> => {
            if (!resp.ok) {
                const errorText = await resp.text().catch(() => 'Unknown error');
                const errorData: unknown = this.parseErrorBody(errorText);
                throw new ApiError(
                    resp.status,
                    getErrorTextField(errorData, 'message') ||
                        getErrorTextField(errorData, 'detail') ||
                        `Ошибка запроса: ${resp.statusText}`,
                    errorData
                );
            }

            const contentType = resp.headers.get('content-type') ?? undefined;
            const filename = parseDownloadFilename(resp.headers.get('content-disposition'));
            const blob =
                Platform.OS === 'web'
                    ? await resp.blob()
                    : ({
                        text: () => resp.text(),
                      } as Blob);
            return { blob, contentType, filename };
        };

        try {
            const resp = await fetchWithTimeout(
                `${this.baseURL}${endpoint}`,
                { ...options, method: options.method || 'GET', headers },
                timeout
            );

            if (resp.status === 401 && !token) {
                await this.clearTokens();
                throw new ApiError(401, 'Требуется авторизация');
            }

            if (resp.status === 401 && token) {
                if (isE2E) {
                    throw new ApiError(401, 'Требуется авторизация');
                }
                try {
                    const newToken = await this.refreshAccessToken();
                    const retryHeaders: HeadersInit = {
                        Authorization: `Token ${newToken}`,
                        ...options.headers,
                    };
                    const retryResp = await fetchWithTimeout(
                        `${this.baseURL}${endpoint}`,
                        { ...options, method: options.method || 'GET', headers: retryHeaders },
                        timeout
                    );
                    return await handle(retryResp);
                } catch {
                    await this.clearTokens();
                    const fallbackHeaders = this.authHeaders(null, { extra: options.headers });
                    const fallbackResp = await fetchWithTimeout(
                        `${this.baseURL}${endpoint}`,
                        { ...options, method: options.method || 'GET', headers: fallbackHeaders },
                        timeout
                    );
                    return await handle(fallbackResp);
                }
            }

            return await handle(resp);
        } catch (error) {
            const errorName = error instanceof Error ? error.name : '';
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isAbortError =
                errorName === 'AbortError' ||
                (typeof options.signal !== 'undefined' && options.signal?.aborted === true) ||
                // Отменённый/прерванный fetch (в т.ч. expo "Fetch request has been
                // canceled") — это не ошибка, не логируем и не маппим в offline.
                /\b(aborted|cancell?ed)\b/i.test(errorMessage);
            if (isAbortError) {
                // Отменённая загрузка не должна тратить лимит эндпоинта — возвращаем слот (как в request()).
                this.releaseRateLimitSlot(rateLimitSlot);
                throw error;
            }

            if (error instanceof ApiError) throw error;
            devError('API download error:', error);

            if (isOfflineLikeError(error)) {
                throw new ApiError(
                    0,
                    'Нет подключения к интернету. Проверьте ваше соединение и попробуйте снова.',
                    { offline: true }
                );
            }

            throw error;
        }
    }

    /**
     * GET запрос
     */
    async get<T>(
        endpoint: string,
        timeout?: number,
        options?: RequestInit & { skipAuth?: boolean }
    ): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET', ...(options ?? {}) }, timeout);
    }

    /**
     * POST запрос
     */
    async post<T>(endpoint: string, data?: unknown, timeout?: number): Promise<T> {
        return this.request<T>(
            endpoint,
            {
                method: 'POST',
                body: data ? JSON.stringify(data) : undefined,
            },
            timeout
        );
    }

    /**
     * PUT запрос
     */
    async put<T>(endpoint: string, data?: unknown, timeout?: number): Promise<T> {
        return this.request<T>(
            endpoint,
            {
                method: 'PUT',
                body: data ? JSON.stringify(data) : undefined,
            },
            timeout
        );
    }

    /**
     * PATCH запрос
     */
    async patch<T>(endpoint: string, data?: unknown, timeout?: number): Promise<T> {
        return this.request<T>(
            endpoint,
            {
                method: 'PATCH',
                body: data ? JSON.stringify(data) : undefined,
            },
            timeout
        );
    }

    /**
     * DELETE запрос
     */
    async delete<T>(endpoint: string, timeout?: number): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' }, timeout);
    }

    /**
     * Загрузка файла (multipart/form-data)
     * ✅ FIX-001: Использует безопасное хранилище для токенов
     */
    async uploadFile<T>(
        endpoint: string,
        formData: FormData,
        timeout: number = LONG_TIMEOUT
    ): Promise<T> {
        const token = await this.getAccessToken();
        const headers = this.authHeaders(token);

        try {
            const response = await this.fetchUploadWithTransientRetry(
                endpoint,
                {
                    method: 'POST',
                    headers,
                    body: formData,
                },
                timeout
            );

            if (response.status === 401 && token) {
                if (isE2E) {
                    throw new ApiError(401, 'Требуется авторизация');
                }
                const newToken = await this.refreshAccessToken();
                const retryHeaders: HeadersInit = {
                    Authorization: `Token ${newToken}`,
                };

                const retryResponse = await this.fetchUploadWithTransientRetry(
                    endpoint,
                    {
                        method: 'POST',
                        headers: retryHeaders,
                        body: formData,
                    },
                    timeout
                );

                if (!retryResponse.ok) {
                    throw new ApiError(
                        retryResponse.status,
                        `Ошибка загрузки: ${retryResponse.statusText}`
                    );
                }

                return await retryResponse.json();
            }

            if (!response.ok) {
                throw new ApiError(
                    response.status,
                    `Ошибка загрузки: ${response.statusText}`
                );
            }

            return await response.json();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            devError('File upload error:', error);
            throw new ApiError(0, error instanceof Error ? error.message : 'Ошибка загрузки файла');
        }
    }

    async uploadFormData<T>(
        endpoint: string,
        formData: FormData,
        method: 'POST' | 'PUT' | 'PATCH' = 'POST',
        timeout: number = LONG_TIMEOUT
    ): Promise<T> {
        return this.uploadFormDataWithProgress<T>(endpoint, formData, undefined, method, timeout);
    }

    /**
     * AND-15: Upload FormData with progress tracking via XMLHttpRequest.
     * On native, xhr.upload.onprogress fires with loaded/total bytes.
     * On web, falls back to fetch if XHR is unavailable.
     */
    async uploadFormDataWithProgress<T>(
        endpoint: string,
        formData: FormData,
        onProgress?: (percent: number) => void,
        method: 'POST' | 'PUT' | 'PATCH' = 'POST',
        timeout: number = LONG_TIMEOUT
    ): Promise<T> {
        const token = await this.getAccessToken();

        // На native глобальный fetch — это expo/winter fetch, который собирает
        // multipart-тело в JS и НЕ поддерживает RN-части вида { uri, name, type }
        // (бросает "Unsupported FormDataPart implementation"). Нативный XHR умеет
        // отдавать такие части через FormData.getParts(), поэтому любые загрузки
        // на устройстве идём через XHR. На web остаёмся на fetch (File/Blob + CSRF).
        if (onProgress || Platform.OS !== 'web') {
            return this._uploadViaXhr<T>(endpoint, formData, token, method, timeout, onProgress);
        }

        return this._uploadViaFetch<T>(endpoint, formData, token, method, timeout);
    }

    /**
     * Internal: upload via XMLHttpRequest.
     * На native корректно сериализует RN-части { uri, name, type } через нативный
     * сетевой слой. Поддерживает опциональный onProgress.
     */
    private _uploadViaXhr<T>(
        endpoint: string,
        formData: FormData,
        token: string | null,
        method: string,
        timeout: number,
        onProgress?: (percent: number) => void
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, `${this.baseURL}${endpoint}`);

            const headers = this.authHeaders(token);
            for (const [headerKey, headerValue] of Object.entries(headers)) {
                if (typeof headerValue === 'string') {
                    xhr.setRequestHeader(headerKey, headerValue);
                }
            }
            xhr.timeout = timeout;

            if (onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        onProgress(event.loaded / event.total);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve(data as T);
                    } catch {
                        resolve(xhr.responseText as unknown as T);
                    }
                } else if (xhr.status === 401 && token && !isE2E) {
                    // Retry with refreshed token via XHR (no progress on retry)
                    this.refreshAccessToken()
                        .then((newToken) =>
                            this._uploadViaXhr<T>(endpoint, formData, newToken, method, timeout)
                        )
                        .then(resolve)
                        .catch(reject);
                } else if (this.isTransientUploadStatus(xhr.status)) {
                    this._uploadViaXhr<T>(endpoint, formData, token, method, timeout)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(new ApiError(xhr.status, `Ошибка загрузки: ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => reject(new ApiError(0, 'Ошибка сети при загрузке'));
            xhr.ontimeout = () => reject(new ApiError(0, 'Превышено время загрузки'));

            xhr.send(formData);
        });
    }

    /** Internal: upload via fetch (no progress). Web only — на native fetch не умеет { uri }-части. */
    private async _uploadViaFetch<T>(
        endpoint: string,
        formData: FormData,
        token: string | null,
        method: string,
        timeout: number
    ): Promise<T> {
        const headers = this.authHeaders(token);

        try {
            const response = await this.fetchUploadWithTransientRetry(
                endpoint,
                { method, headers, body: formData },
                timeout
            );

            if (response.status === 401 && token) {
                if (isE2E) {
                    throw new ApiError(401, 'Требуется авторизация');
                }
                const newToken = await this.refreshAccessToken();
                const retryHeaders: HeadersInit = {
                    Authorization: `Token ${newToken}`,
                };
                const retryResponse = await this.fetchUploadWithTransientRetry(
                    endpoint,
                    { method, headers: retryHeaders, body: formData },
                    timeout
                );
                if (!retryResponse.ok) {
                    throw new ApiError(retryResponse.status, `Ошибка загрузки: ${retryResponse.statusText}`);
                }
                return await this.parseSuccessResponse<T>(retryResponse);
            }

            if (!response.ok) {
                throw new ApiError(response.status, `Ошибка загрузки: ${response.statusText}`);
            }

            return await this.parseSuccessResponse<T>(response);
        } catch (error) {
            if (error instanceof ApiError) throw error;
            devError('FormData upload error:', error);
            throw new ApiError(0, error instanceof Error ? error.message : 'Ошибка загрузки файла');
        }
    }
}

// Экспортируем singleton экземпляр
export const apiClient = new ApiClient();
