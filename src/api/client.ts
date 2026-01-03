// src/api/client.ts
// ✅ АРХИТЕКТУРА: Единый API клиент с автоматическим refresh token
// ✅ FIX-001: Использует безопасное хранилище для токенов
// ✅ FIX-003: Исправлена race condition при обновлении токена

import { Platform } from 'react-native';
import { devError } from '@/src/utils/logger';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';
import { 
    setSecureItem, 
    getSecureItem, 
    removeSecureItems 
} from '@/src/utils/secureStorage';

const rawApiUrl: string =
    process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
if (!rawApiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}
// Нормализуем: чтобы всегда был суффикс /api и не было двойных слэшей
const URLAPI = (() => {
    const trimmed = rawApiUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();
const DEFAULT_TIMEOUT = 10000;
const LONG_TIMEOUT = 30000;

// Ключи для безопасного хранилища
const TOKEN_KEY = 'userToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

type AuthInvalidationHandler = () => void;

let authInvalidationHandler: AuthInvalidationHandler | null = null;

export const setAuthInvalidationHandler = (handler: AuthInvalidationHandler | null) => {
    authInvalidationHandler = handler;
};

/**
 * Класс ошибки API
 */
export class ApiError extends Error {
    constructor(
        public status: number,
        public message: string,
        public data?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Единый API клиент
 */
class ApiClient {
    private baseURL: string;
    private defaultHeaders: HeadersInit;
    private refreshTokenPromise: Promise<string> | null = null;
    private refreshTokenLock: boolean = false; // ✅ FIX-003: Lock для предотвращения race condition

    // ✅ FIX: Rate limiting для предотвращения спама запросов
    private requestTimestamps: Map<string, number[]> = new Map();
    private readonly rateLimitWindow = 60000; // 1 минута
    private readonly maxRequestsPerWindow = 100; // Максимум 100 запросов в минуту
    private readonly maxRequestsPerEndpoint = 20; // Максимум 20 запросов к одному эндпоинту в минуту

    constructor() {
        this.baseURL = URLAPI;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * ✅ FIX: Проверка rate limit перед отправкой запроса
     */
    private checkRateLimit(endpoint: string): boolean {
        const now = Date.now();
        const key = endpoint.split('?')[0]; // Игнорируем query параметры

        // Получаем временные метки для этого эндпоинта
        const timestamps = this.requestTimestamps.get(key) || [];

        // Удаляем старые метки (вне окна)
        const recentTimestamps = timestamps.filter(ts => now - ts < this.rateLimitWindow);

        // Проверяем лимит для конкретного эндпоинта
        if (recentTimestamps.length >= this.maxRequestsPerEndpoint) {
            console.warn(`Rate limit exceeded for endpoint: ${key}`);
            return false;
        }

        // Проверяем общий лимит по всем эндпоинтам
        const allTimestamps = Array.from(this.requestTimestamps.values())
            .flat()
            .filter(ts => now - ts < this.rateLimitWindow);

        if (allTimestamps.length >= this.maxRequestsPerWindow) {
            console.warn('Global rate limit exceeded');
            return false;
        }

        // Добавляем текущую метку
        recentTimestamps.push(now);
        this.requestTimestamps.set(key, recentTimestamps);

        return true;
    }

    /**
     * Очистка старых меток времени (для оптимизации памяти)
     */
    private cleanupRateLimitData(): void {
        const now = Date.now();
        for (const [key, timestamps] of this.requestTimestamps.entries()) {
            const recentTimestamps = timestamps.filter(ts => now - ts < this.rateLimitWindow);
            if (recentTimestamps.length === 0) {
                this.requestTimestamps.delete(key);
            } else {
                this.requestTimestamps.set(key, recentTimestamps);
            }
        }
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
        authInvalidationHandler?.();
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

        const maybeTextFn = (response as any)?.text;
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

        const maybeJsonFn = (response as any)?.json;
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

        // Периодически очищаем старые метки (каждые 100 запросов примерно)
        if (Math.random() < 0.01) {
            this.cleanupRateLimitData();
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

            // Если получили 401, пробуем обновить токен
            if (response.status === 401 && token) {
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
                    // Если refresh не удался, пробрасываем ошибку
                    throw new ApiError(401, 'Требуется авторизация');
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

    /**
     * GET запрос
     */
    async get<T>(endpoint: string, timeout?: number): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' }, timeout);
    }

    /**
     * POST запрос
     */
    async post<T>(endpoint: string, data?: any, timeout?: number): Promise<T> {
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
    async put<T>(endpoint: string, data?: any, timeout?: number): Promise<T> {
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
    async patch<T>(endpoint: string, data?: any, timeout?: number): Promise<T> {
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
