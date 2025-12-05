// src/api/travels-v2.ts
// ✅ АРХИТЕКТУРА: Пример миграции API вызовов на apiClient
// Этот файл показывает, как мигрировать существующие функции на новый apiClient

import { apiClient, ApiError } from './client';
import { Travel, Article, Filters } from '@/src/types/types';
import { normalizeNumericArray } from '@/src/utils/filterQuery';
import { devError } from '@/src/utils/logger';

// ===== КОНСТАНТЫ ENDPOINTS =====
// Оставляем для обратной совместимости, но можно использовать напрямую в apiClient

/**
 * ✅ ПРИМЕР МИГРАЦИИ: Получение путешествия по ID
 * 
 * Было:
 * const res = await fetchWithTimeout(`${GET_TRAVELS}/${id}`, {}, DEFAULT_TIMEOUT);
 * return await res.json();
 * 
 * Стало:
 */
export const fetchTravelV2 = async (id: number): Promise<Travel> => {
    try {
        return await apiClient.get<Travel>(`/api/travels/${id}`);
    } catch (error) {
        if (error instanceof ApiError) {
            devError('Error fetching travel:', error.message);
        }
        // Возвращаем дефолтное значение для обратной совместимости
        return {
            id: 0,
            name: '',
            slug: '',
            travel_image_thumb_url: '',
            travel_image_thumb_small_url: '',
            url: '',
            youtube_link: '',
            userName: '',
            description: '',
            recommendation: '',
            plus: '',
            minus: '',
            cityName: '',
            countryName: '',
            countUnicIpView: '',
            gallery: [],
            travelAddress: [],
            userIds: '',
            year: '',
            monthName: '',
            number_days: 0,
            companions: [],
            countryCode: '',
        };
    }
};

/**
 * ✅ ПРИМЕР МИГРАЦИИ: Получение путешествия по slug
 */
export const fetchTravelBySlugV2 = async (slug: string): Promise<Travel> => {
    try {
        return await apiClient.get<Travel>(`/api/travels/by-slug/${slug}`);
    } catch (error) {
        if (error instanceof ApiError) {
            devError('Error fetching travel by slug:', error.message);
        }
        // Возвращаем дефолтное значение
        return fetchTravelV2(0);
    }
};

/**
 * ✅ ПРИМЕР МИГРАЦИИ: Получение фильтров
 */
export const fetchFiltersV2 = async (): Promise<Filters> => {
    try {
        return await apiClient.get<Filters>('/api/getFiltersTravel');
    } catch (error) {
        if (error instanceof ApiError) {
            devError('Error fetching filters:', error.message);
        }
        return {
            countries: [],
            categories: [],
            categoryTravelAddress: [],
            companions: [],
            complexity: [],
            month: [],
            overNightStay: [],
            transports: [],
            year: '',
        };
    }
};

/**
 * ✅ ПРИМЕР МИГРАЦИИ: Получение списка путешествий с фильтрами
 * 
 * Примечание: Для сложных запросов с параметрами можно использовать query params
 */
export const fetchTravelsV2 = async (
    page: number,
    itemsPerPage: number,
    search: string,
    urlParams: Record<string, any>,
    options?: { signal?: AbortSignal }
) => {
    try {
        // Нормализуем фильтры
        const whereObject: Record<string, any> = {};
        
        if (urlParams?.moderation !== undefined) {
            whereObject.moderation = urlParams.moderation;
        } else if (urlParams?.publish === undefined) {
            whereObject.moderation = 1;
        }
        
        if (urlParams?.publish !== undefined) {
            whereObject.publish = urlParams.publish;
        } else if (urlParams?.moderation === undefined) {
            whereObject.publish = 1;
        }

        // Нормализация массивов
        const arrayFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
        arrayFields.forEach(field => {
            if (urlParams[field] && Array.isArray(urlParams[field])) {
                const normalized = urlParams[field]
                    .filter((val: any) => {
                        if (val === undefined || val === null || val === '') return false;
                        if (typeof val === 'string') {
                            const num = Number(val);
                            return !isNaN(num) && isFinite(num) && val.trim() !== '';
                        }
                        if (typeof val === 'number') {
                            return !isNaN(val) && isFinite(val);
                        }
                        return false;
                    })
                    .map((val: any) => {
                        if (typeof val === 'string') {
                            const num = Number(val);
                            return !isNaN(num) && isFinite(num) ? num : null;
                        }
                        return val;
                    })
                    .filter((val: any) => val !== null && val !== undefined);
                
                if (normalized.length > 0) {
                    whereObject[field] = normalized;
                }
            }
        });

        if (urlParams?.year !== undefined && urlParams?.year !== null) {
            const yearStr = String(urlParams.year).trim();
            if (yearStr !== '') {
                whereObject.year = yearStr;
            }
        }

        // Используем apiClient с query параметрами
        const params = new URLSearchParams({
            page: (page + 1).toString(),
            perPage: itemsPerPage.toString(),
            query: search || '',
            where: JSON.stringify(whereObject),
        }).toString();

        const response = await apiClient.get<{ data: Travel[]; total: number }>(
            `/api/travels?${params}`,
            // Таймаут можно передать как третий параметр, но apiClient использует DEFAULT_TIMEOUT
        );

        // Проверяем структуру ответа
        if (Array.isArray(response)) {
            return { data: response, total: response.length };
        }

        if (response && typeof response === 'object' && 'data' in response) {
            if (!Array.isArray(response.data)) {
                return { data: [], total: response.total || 0 };
            }
            return {
                data: response.data || [],
                total: response.total || 0
            };
        }

        return { data: [], total: 0 };
    } catch (error) {
        if (error instanceof ApiError) {
            devError('Error fetching travels:', error.message);
        }
        return { data: [], total: 0 };
    }
};

/**
 * ✅ ПРИМЕР МИГРАЦИИ: Отправка обратной связи
 */
export const sendFeedbackV2 = async (
    name: string,
    email: string,
    message: string
): Promise<string> => {
    try {
        const response = await apiClient.post<{ message?: string }>('/api/feedback/', {
            name,
            email,
            message,
        });

        return typeof response === 'string'
            ? response
            : response?.message || 'Сообщение успешно отправлено';
    } catch (error) {
        if (error instanceof ApiError) {
            const errorMessage = error.data?.email?.[0] ||
                error.data?.name?.[0] ||
                error.data?.message?.[0] ||
                error.data?.detail ||
                error.message ||
                'Ошибка при отправке.';
            throw new Error(errorMessage);
        }
        throw new Error('Не удалось отправить сообщение');
    }
};

/**
 * ✅ ПРИМЕР МИГРАЦИИ: Загрузка изображения
 * 
 * Примечание: Для загрузки файлов используем uploadFile метод
 */
export const uploadImageV2 = async (formData: FormData): Promise<any> => {
    try {
        return await apiClient.uploadFile('/api/upload', formData);
    } catch (error) {
        if (error instanceof ApiError) {
            devError('Error uploading image:', error.message);
        }
        throw new Error('Ошибка загрузки изображения');
    }
};

/**
 * ✅ ПРИМЕР МИГРАЦИИ: Удаление путешествия
 */
export const deleteTravelV2 = async (id: string): Promise<void> => {
    try {
        await apiClient.delete(`/api/travels/${id}`);
    } catch (error) {
        if (error instanceof ApiError) {
            devError('Error deleting travel:', error.message);
        }
        throw new Error('Ошибка при удалении путешествия');
    }
};

/**
 * ✅ ПРИМЕР МИГРАЦИИ: Сохранение путешествия
 */
export const saveTravelV2 = async (data: any): Promise<any> => {
    try {
        return await apiClient.put('/api/travels/upsert/', data);
    } catch (error) {
        if (error instanceof ApiError) {
            devError('Error saving travel:', error.message);
        }
        throw new Error('Ошибка при сохранении путешествия');
    }
};

/**
 * ПРИМЕЧАНИЯ ПО МИГРАЦИИ:
 * 
 * 1. Авторизация:
 *    - apiClient автоматически добавляет токен из AsyncStorage
 *    - При 401 ошибке автоматически пытается обновить токен
 *    - Если refresh token не поддерживается бэкендом, можно отключить эту логику
 * 
 * 2. Обработка ошибок:
 *    - ApiError содержит структурированную информацию об ошибке
 *    - Можно получить статус, сообщение и данные ошибки
 * 
 * 3. Таймауты:
 *    - apiClient использует DEFAULT_TIMEOUT (10s) по умолчанию
 *    - Для тяжелых запросов можно передать timeout как третий параметр
 * 
 * 4. AbortSignal:
 *    - apiClient поддерживает AbortSignal через options
 *    - Можно отменять запросы через React Query или вручную
 * 
 * 5. Постепенная миграция:
 *    - Можно использовать оба подхода параллельно
 *    - Мигрировать функции по одной
 *    - Тестировать каждую миграцию отдельно
 */

