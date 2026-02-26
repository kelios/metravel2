// api/client.ts
// ✅ АРХИТЕКТУРА: Единый API клиент с автоматическим refresh token
// ✅ FIX-001: Использует безопасное хранилище для токенов
// ✅ FIX-003: Исправлена race condition при обновлении токена

import { Platform } from 'react-native';
import { devError } from '@/utils/logger';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { 
    setSecureItem, 
    getSecureItem, 
    removeSecureItems 
} from '@/utils/secureStorage';
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

type DownloadResponse = {
    blob: Blob;
    filename?: string;
    contentType?: string;
};

const getErrorTextField = (data: unknown, field: 'message' | 'detail'): string | undefined => {
    if (!data || typeof data !== 'object') return undefined;
    const value = (data as Record<string, unknown>)[field];
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

/**
 * Единый API клиент
 */
class ApiClient {
    private baseURL: string;
    private defaultHeaders: HeadersInit;
    private refreshTokenPromise: Promise<string> | null = null;
    private refreshTokenLock: boolean = false; // ✅ FIX-003: Lock для предотвращения race condition

    // ✅ FIX: Rate limiting для предотвращения спама запросов
    // Optimized: per-endpoint counters + global counter avoid O(n) scans.
    private requestTimestamps: Map<string, number[]> = new Map();
    private globalTimestamps: number[] = [];
    private readonly rateLimitWindow = 60000; // 1 минута
    private readonly maxRequestsPerWindow = 100; // Максимум 100 запросов в минуту
    private readonly maxRequestsPerEndpoint = 20; // Максимум 20 запросов к одному эндпоинту в минуту

    constructor() {
        this.baseURL = API_BASE_URL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * ✅ FIX: Проверка rate limit перед отправкой запроса
     */
    private checkRateLimit(endpoint: string): boolean {
        const now = Date.now();
        const cutoff = now - this.rateLimitWindow;
        const key = endpoint.split('?')[0]; // Игнорируем query параметры

        // Trim global timestamps (oldest first, so trim from head)
        while (this.globalTimestamps.length > 0 && this.globalTimestamps[0] < cutoff) {
            this.globalTimestamps.shift();
        }

        // Проверяем общий лимит
        if (this.globalTimestamps.length >= this.maxRequestsPerWindow) {
            console.warn('Global rate limit exceeded');
            return false;
        }

        // Trim per-endpoint timestamps
        const timestamps = this.requestTimestamps.get(key);
        if (timestamps) {
            while (timestamps.length > 0 && timestamps[0] < cutoff) {
                timestamps.shift();
            }
            if (timestamps.length === 0) {
                this.requestTimestamps.delete(key);
            }
        }

        // Проверяем лимит для конкретного эндпоинта
        const current = this.requestTimestamps.get(key);
        if (current && current.length >= this.maxRequestsPerEndpoint) {
            console.warn(`Rate limit exceeded for endpoint: ${key}`);
            return false;
        }

        // Добавляем текущую метку
        this.globalTimestamps.push(now);
        if (current) {
            current.push(now);
        } else {
            this.requestTimestamps.set(key, [now]);
        }

        return true;
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

    /**
     * Проверяет доступность сети
     * ✅ FIX-005: Проверка offline режима
     */
    private async checkNetworkStatus(): Promise<boolean> {
        if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
            return navigator.onLine;
        }
        // Для native платформ проверка будет через NetInfo в компонентах
        return true; // По умолчанию считаем, что сеть есть
    }

    /**
     * Основной метод для выполнения запросов
     * ✅ FIX-005: Добавлена обработка offline режима
     * ✅ FIX: Добавлена проверка rate limit
     */
    async request<T>(
        endpoint: string,
        options: RequestInit = {},
        timeout: number = DEFAULT_TIMEOUT
    ): Promise<T> {
        // ✅ FIX: Проверяем rate limit перед запросом
        if (!this.checkRateLimit(endpoint)) {
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

        const token = await this.getAccessToken();
        const headers: HeadersInit = {
            ...this.defaultHeaders,
            ...(token && { Authorization: `Token ${token}` }),
            ...options.headers,
        };

        try {
            const response = await fetchWithTimeout(
                `${this.baseURL}${endpoint}`,
                { ...options, headers },
                timeout
            );

            // Если токена нет, но сервер вернул 401 — состояние аутентификации, вероятно, устарело
            // (например, токен был удалён в другой вкладке). Сбрасываем состояние, чтобы UI обновился.
            if (response.status === 401 && !token) {
                await this.clearTokens();
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

                    const fallbackHeaders: HeadersInit = {
                        ...this.defaultHeaders,
                        ...options.headers,
                    };
                    const fallbackResponse = await fetchWithTimeout(
                        `${this.baseURL}${endpoint}`,
                        { ...options, headers: fallbackHeaders },
                        timeout
                    );

                    if (!fallbackResponse.ok) {
                        const errorText = await fallbackResponse.text().catch(() => 'Unknown error');
                        let errorData;
                        try {
                            errorData = JSON.parse(errorText);
                        } catch {
                            errorData = errorText;
                        }

                        throw new ApiError(
                            fallbackResponse.status,
                            errorData?.message ||
                                errorData?.detail ||
                                `Ошибка запроса: ${fallbackResponse.statusText}`,
                            errorData
                        );
                    }

                    return await this.parseSuccessResponse<T>(fallbackResponse);
                }
            }

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = errorText;
                }

                throw new ApiError(
                    response.status,
                    errorData?.message || errorData?.detail || `Ошибка запроса: ${response.statusText}`,
                    errorData
                );
            }

            // Если ответ пустой (204 No Content), возвращаем null
            if (response.status === 204) {
                return null as T;
            }

            return await this.parseSuccessResponse<T>(response);
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            
            // ✅ ИСПРАВЛЕНИЕ: Улучшенная обработка сетевых ошибок
            devError('API request error:', error);
            
            // Проверяем, является ли это сетевой ошибкой
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isOffline = Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false;
            const isFetchFailure =
                errorMessage.includes('Failed to fetch') ||
                errorMessage.includes('Network request failed') ||
                errorMessage.includes('fetch') ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('network failed');

            if (isOffline || isFetchFailure) {
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
        if (!this.checkRateLimit(endpoint)) {
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
        const headers: HeadersInit = {
            ...(token && { Authorization: `Token ${token}` }),
            ...options.headers,
        };

        const parseFilename = (contentDisposition: string | null): string | undefined => {
            if (!contentDisposition) return undefined;
            const v = String(contentDisposition);
            const utf8 = v.match(/filename\*=UTF-8''([^;]+)/i);
            if (utf8?.[1]) {
                try {
                    return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ''));
                } catch {
                    return utf8[1].trim().replace(/^"|"$/g, '');
                }
            }
            const plain = v.match(/filename=([^;]+)/i);
            if (plain?.[1]) {
                return plain[1].trim().replace(/^"|"$/g, '');
            }
            return undefined;
        };

        const handle = async (resp: Response): Promise<DownloadResponse> => {
            if (!resp.ok) {
                const errorText = await resp.text().catch(() => 'Unknown error');
                let errorData: unknown = errorText;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    // keep raw
                }
                throw new ApiError(
                    resp.status,
                    getErrorTextField(errorData, 'message') ||
                        getErrorTextField(errorData, 'detail') ||
                        `Ошибка запроса: ${resp.statusText}`,
                    errorData
                );
            }

            const blob = await resp.blob();
            const contentType = resp.headers.get('content-type') ?? undefined;
            const filename = parseFilename(resp.headers.get('content-disposition'));
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
                    const fallbackHeaders: HeadersInit = {
                        ...options.headers,
                    };
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
            if (error instanceof ApiError) throw error;
            devError('API download error:', error);

            const errorMessage = error instanceof Error ? error.message : String(error);
            const isOffline = Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false;
            const isFetchFailure =
                errorMessage.includes('Failed to fetch') ||
                errorMessage.includes('Network request failed') ||
                errorMessage.includes('fetch') ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('network failed');

            if (isOffline || isFetchFailure) {
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
    async get<T>(endpoint: string, timeout?: number, options?: RequestInit): Promise<T> {
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
        const headers: HeadersInit = {
            ...(token && { Authorization: `Token ${token}` }),
        };

        try {
            const response = await fetchWithTimeout(
                `${this.baseURL}${endpoint}`,
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

                const retryResponse = await fetchWithTimeout(
                    `${this.baseURL}${endpoint}`,
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
        const token = await this.getAccessToken();
        const headers: HeadersInit = {
            ...(token && { Authorization: `Token ${token}` }),
        };

        try {
            const response = await fetchWithTimeout(
                `${this.baseURL}${endpoint}`,
                {
                    method,
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

                const retryResponse = await fetchWithTimeout(
                    `${this.baseURL}${endpoint}`,
                    {
                        method,
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

                return await this.parseSuccessResponse<T>(retryResponse);
            }

            if (!response.ok) {
                throw new ApiError(
                    response.status,
                    `Ошибка загрузки: ${response.statusText}`
                );
            }

            return await this.parseSuccessResponse<T>(response);
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            devError('FormData upload error:', error);
            throw new ApiError(0, error instanceof Error ? error.message : 'Ошибка загрузки файла');
        }
    }
}

// Экспортируем singleton экземпляр
export const apiClient = new ApiClient();
