import {
    Article,
    FeedbackData,
    Filters,
    FormValues,
    Travel,
    TravelFormData,
    TravelsForMap,
    TravelsMap,
} from '@/src/types/types';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeNumericArray } from '@/src/utils/filterQuery';
import { devError } from '@/src/utils/logger';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { validateAIMessage, validatePassword } from '@/src/utils/validation';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';
import { getUserFriendlyError } from '@/src/utils/userFriendlyErrors';
import { sanitizeInput } from '@/src/utils/security';
import { validateImageFile } from '@/src/utils/validation';
import { retry, isRetryableError } from '@/src/utils/retry';
import { getSecureItem, setSecureItem } from '@/src/utils/secureStorage';

// ===== БАЗОВЫЙ URL =====
const URLAPI: string = process.env.EXPO_PUBLIC_API_URL || '';
if (!URLAPI) {
    throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

// ===== ТАЙМАУТЫ =====
const DEFAULT_TIMEOUT = 10000; // 10 секунд
const LONG_TIMEOUT = 30000; // 30 секунд для тяжелых запросов

// ===== ENDPOINTS =====
const SEARCH_TRAVELS_FOR_MAP = `${URLAPI}/api/travels/search_travels_for_map`;
const GET_FILTER_FOR_MAP = `${URLAPI}/api/filterformap`;

const LOGIN = `${URLAPI}/api/user/login/`;
const LOGOUT = `${URLAPI}/api/user/logout/`;
const REGISTER = `${URLAPI}/api/user/registration/`;
const RESETPASSWORDLINK = `${URLAPI}/api/user/reset-password-link/`;
const CONFIRM_REGISTER = `${URLAPI}/api/user/confirm-registration/`;
const SETNEWPASSWORD = `${URLAPI}/api/user/set-password-after-reset/`;
const SENDPASSWORD = `${URLAPI}/api/user/sendpassword/`;

const GET_LIST_COUNTRIES = `${URLAPI}/location/countries`;

const SAVE_TRAVEL = `${URLAPI}/api/travels/upsert/`;
export const SEARCH_TRAVELS_NEAR_ROUTE = `${URLAPI}/api/travels/near-route/`;

const SEND_AI_QUESTION = `${URLAPI}/api/chat`;
export const UPLOAD_IMAGE = `${URLAPI}/api/upload`;
const GALLERY = `${URLAPI}/api/gallery`;
const GET_TRAVELS = `${URLAPI}/api/travels`;
const GET_TRAVELS_BY_SLUG = `${URLAPI}/api/travels/by-slug`;
const GET_TRAVEL = `${URLAPI}/api/travel`;
const GET_FILTERS_TRAVEL = `${URLAPI}/api/searchextended`;
const GET_TRAVELS_NEAR = `${URLAPI}/api/travelsNear`;
const GET_TRAVELS_POPULAR = `${URLAPI}/api/travelsPopular`;
const GET_FILTERS = `${URLAPI}/api/getFiltersTravel`;
const GET_FILTERS_COUNTRY = `${URLAPI}/api/countriesforsearch`;
const SEND_FEEDBACK = `${URLAPI}/api/feedback/`;
const GET_ARTICLES = `${URLAPI}/api/articles`;
const GET_ALL_COUNTRY = `${URLAPI}/api/countries/`;

// ===== ЗАГЛУШКА =====
const travelDef: Travel = {
    name: 'test',
    id: 498,
    travel_image_thumb_url:
        'https://metravelprod.s3.eu-north-1.amazonaws.com/6880/conversions/p9edKtQrl2wM0xC1yRrkzVJEi4B4qxkxWqSADDLM-webpTravelMainImage_400.webp',
    url: '',
    userName: '',
    slug: '',
    travel_image_thumb_small_url: '',
    youtube_link: '',
    description: '',
    recommendation: '',
    plus: '',
    minus: '',
    cityName: '',
    countryName: '',
    countUnicIpView: '0',
    gallery: [],
    travelAddress: [],
    userIds: '',
    year: '',
    monthName: '',
    number_days: 0,
    companions: [],
    countryCode: '',
} as unknown as Travel;

// ============ АВТОРИЗАЦИЯ ============

export const loginApi = async (email: string, password: string): Promise<{
    token: string;
    name: string;
    email: string;
    id: string | number;
    is_superuser: boolean;
} | null> => {
    try {
        // ✅ FIX-002: Валидация пароля на клиенте перед отправкой
        // Примечание: Валидация пароля при входе менее критична, но можно добавить базовую проверку
        if (!password || password.trim().length === 0) {
            Alert.alert('Ошибка', 'Пароль не может быть пустым');
            return null;
        }

        // ✅ УЛУЧШЕНИЕ: Retry для критических операций входа
        const response = await retry(
            async () => {
                return await fetchWithTimeout(LOGIN, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                }, DEFAULT_TIMEOUT);
            },
            {
                maxAttempts: 2, // Для входа делаем меньше попыток
                delay: 500,
                shouldRetry: (error) => {
                    // Не повторяем для ошибок авторизации (401, 403)
                    return isRetryableError(error) && !error.message.includes('401') && !error.message.includes('403');
                }
            }
        );

        if (!response.ok) {
            throw new Error('Неверный email или пароль');
        }

        const json = await safeJsonParse<{
            token?: string;
            name?: string;
            email?: string;
            id?: string | number;
            is_superuser?: boolean;
        }>(response, {});

        if (json.token) return json as any;
        return null;
    } catch (error: any) {
        devError('Login error:', error);
        const message = getUserFriendlyError(error);
        Alert.alert('Ошибка входа', message);
        return null;
    }
};

export const logoutApi = async () => {
    try {
        // ✅ FIX-001: Используем безопасное хранилище для токена
        const token = await getSecureItem('userToken');
        const response = await fetchWithTimeout(LOGOUT, {
            method: 'POST',
            headers: {
                Authorization: `Token ${token}`,
                'Content-Type': 'application/json',
            },
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        await safeJsonParse(response, {}).catch(() => undefined);
        // Очистка токенов происходит в AuthContext через secureStorage
        await AsyncStorage.removeItem('userName');
        await AsyncStorage.removeItem('userId');
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        // ✅ УЛУЧШЕНИЕ: Не показываем ошибку пользователю при logout - всегда очищаем локальные данные
        // Alert.alert('Ошибка', getUserFriendlyError(error));
    }
};

// ============ ПАРОЛЬ ============

export const sendPasswordApi = async (email: string) => {
    try {
        const response = await fetchWithTimeout(SENDPASSWORD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        const json = await safeJsonParse<{ success?: boolean; message?: string }>(response, {});
        if (json.success) {
            Alert.alert('Успех', 'Инструкции по восстановлению пароля отправлены на ваш email');
            return true;
        }
        Alert.alert('Ошибка', getUserFriendlyError(json.message || 'Не удалось отправить инструкции по восстановлению пароля'));
        return false;
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        Alert.alert('Ошибка', getUserFriendlyError(error));
        return false;
    }
};

export const resetPasswordLinkApi = async (email: string) => {
    // ✅ УЛУЧШЕНИЕ: Санитизация входных данных
    const sanitizedEmail = sanitizeInput(email.trim());
    if (!sanitizedEmail) {
        throw new Error('Email не может быть пустым');
    }

    try {
        const response = await fetchWithTimeout(RESETPASSWORDLINK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: sanitizedEmail }),
        }, DEFAULT_TIMEOUT);

        const json = await safeJsonParse<{ email?: string[]; message?: string }>(response, {});

        if (!response.ok) {
            return json?.email?.[0] || json?.message || 'Ошибка';
        }

        return json?.message || 'Инструкции по восстановлению отправлены.';
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        return 'Не удалось отправить инструкции по восстановлению пароля';
    }
};

export const setNewPasswordApi = async (password_reset_token: string, password: string) => {
    try {
        // ✅ FIX-002: Валидация пароля на клиенте перед отправкой
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            Alert.alert('Ошибка валидации', passwordValidation.error || 'Пароль не соответствует требованиям');
            return false;
        }

        const response = await fetchWithTimeout(SETNEWPASSWORD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, password_reset_token }),
        }, DEFAULT_TIMEOUT);

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        const json = await safeJsonParse<{ success?: boolean; message?: string }>(response, {});
        if (json.success) {
            Alert.alert('Успех', 'Пароль успешно изменен');
            return true;
        }
        Alert.alert('Ошибка', getUserFriendlyError(json.message || 'Не удалось изменить пароль'));
        return false;
    } catch (error) {
        if (__DEV__) {
            console.error(error);
        }
        Alert.alert('Ошибка', getUserFriendlyError(error));
        return false;
    }
};

// ============ РЕГИСТРАЦИЯ ============

export const registration = async (values: FormValues): Promise<string> => {
    try {
        // ✅ FIX-002: Валидация пароля на клиенте перед отправкой
        if (values.password) {
            const passwordValidation = validatePassword(values.password);
            if (!passwordValidation.valid) {
                Alert.alert('Ошибка валидации', passwordValidation.error || 'Пароль не соответствует требованиям');
                throw new Error(passwordValidation.error || 'Пароль не соответствует требованиям');
            }
        }

        // ✅ УЛУЧШЕНИЕ: Retry для критических операций регистрации
        const response = await retry(
            async () => {
                return await fetchWithTimeout(REGISTER, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values),
                }, DEFAULT_TIMEOUT);
            },
            {
                maxAttempts: 2, // Для регистрации делаем меньше попыток
                delay: 500,
                shouldRetry: (error) => {
                    // Не повторяем для ошибок валидации (400) и авторизации (401, 403)
                    return isRetryableError(error) && 
                           !error.message.includes('400') && 
                           !error.message.includes('401') && 
                           !error.message.includes('403');
                }
            }
        );

        const jsonResponse = await safeJsonParse<{ 
            token?: string; 
            name?: string; 
            error?: string 
        }>(response, {});
        
        if (!response.ok) {
            throw new Error(jsonResponse.error || 'Ошибка регистрации');
        }

        // ✅ FIX-001: Используем безопасное хранилище для токена
        if (jsonResponse.token) {
            await setSecureItem('userToken', jsonResponse.token);
            await AsyncStorage.setItem('userName', jsonResponse.name || '');
        }
        return 'Пользователь успешно зарегистрирован. Проверьте почту для активации.';
    } catch (error: any) {
        devError('Registration error:', error);
        return error.message || 'Произошла неизвестная ошибка.';
    }
};

// ============ TRAVEL API ============

export const fetchTravels = async (
    page: number,
    itemsPerPage: number,
    search: string,
    urlParams: Record<string, any>,
    options?: { signal?: AbortSignal }
) => {
    try {
        // ✅ Нормализуем фильтры: убеждаемся, что массивы содержат числа, а не строки
        const whereObject: Record<string, any> = {};
        
        // ✅ ИСПРАВЛЕНИЕ: Сначала устанавливаем moderation и publish
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
        
        // ✅ ИСПРАВЛЕНИЕ: Улучшенная нормализация для стран и других числовых полей
        const arrayFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
        arrayFields.forEach(field => {
            if (urlParams[field] && Array.isArray(urlParams[field])) {
                // Фильтруем и нормализуем значения
                const normalized = urlParams[field]
                    .filter((val: any) => {
                        // Исключаем невалидные значения
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
                        // Преобразуем в число
                        if (typeof val === 'string') {
                            const num = Number(val);
                            return !isNaN(num) && isFinite(num) ? num : null;
                        }
                        if (typeof val === 'number') {
                            return !isNaN(val) && isFinite(val) ? val : null;
                        }
                        return null;
                    })
                    .filter((val: any) => val !== null && val !== undefined);
                
                // Обновляем только если есть валидные значения
                if (normalized.length > 0) {
                    whereObject[field] = normalized;
                }
            }
        });

        // ✅ ИСПРАВЛЕНИЕ: Год передаем как строку, только если он не пустой
        // Год должен всегда быть строкой в запросе
        if (urlParams?.year !== undefined && urlParams?.year !== null) {
            const yearStr = String(urlParams.year).trim();
            if (yearStr !== '') {
                whereObject.year = yearStr;
            }
        }

        const params = new URLSearchParams({
            page: (page + 1).toString(),
            perPage: itemsPerPage.toString(),
            query: search || '',
            where: JSON.stringify(whereObject),
        }).toString();

        // ✅ ИСПРАВЛЕНИЕ: Добавляем слеш в конце URL для предотвращения 301 редиректов
        const baseUrl = GET_TRAVELS.endsWith('/') ? GET_TRAVELS : `${GET_TRAVELS}/`;
        const urlTravel = `${baseUrl}?${params}`;
        
        // ✅ УЛУЧШЕНИЕ: Retry для критических операций получения данных
        // Примечание: не используем retry если есть AbortSignal (запрос может быть отменен)
        const res = options?.signal 
            ? await fetchWithTimeout(urlTravel, { signal: options.signal }, LONG_TIMEOUT)
            : await retry(
                async () => {
                    return await fetchWithTimeout(urlTravel, {}, LONG_TIMEOUT);
                },
                {
                    maxAttempts: 2,
                    delay: 1000,
                    shouldRetry: (error) => {
                        // Повторяем только для сетевых ошибок и 5xx
                        return isRetryableError(error);
                    }
                }
            );
        
        // ✅ ИСПРАВЛЕНИЕ: Используем safeJsonParse для безопасного парсинга
        const result = await safeJsonParse<{
            data?: Travel[];
            total?: number;
            detail?: string;
        } | Travel[]>(res, []);
        
        if (!res.ok) {
            // ✅ ИСПРАВЛЕНИЕ: Проверяем JSON ответ на наличие ошибки "Invalid page"
            if (typeof result === 'object' && !Array.isArray(result) && result?.detail === "Invalid page.") {
                // Если страница не существует, возвращаем пустой результат
                devError('Invalid page requested:', page + 1);
                return { data: [], total: 0 };
            }
            devError('Error fetching Travels: HTTP', res.status, res.statusText);
            return { data: [], total: 0 };
        }
        
        // ✅ ИСПРАВЛЕНИЕ: Проверяем структуру ответа и нормализуем её
        // API может вернуть как { data: [], total: 0 }, так и просто массив (для обратной совместимости)
        if (Array.isArray(result)) {
            return { data: result, total: result.length };
        }
        
        // Если структура правильная, но data не массив, нормализуем
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            // ✅ ИСПРАВЛЕНИЕ: Проверяем на ошибку "Invalid page" в успешном ответе
            if (result.detail === "Invalid page.") {
                devError('Invalid page in response:', page + 1);
                return { data: [], total: result.total || 0 };
            }
            if (!Array.isArray(result.data)) {
                if (__DEV__) {
                    console.warn('API returned unexpected structure:', result);
                }
                return { data: [], total: result.total || 0 };
            }
            return {
                data: result.data || [],
                total: result.total || 0
            };
        }
        
        if (__DEV__) {
            console.warn('Unexpected API response format:', result);
        }
        return { data: [], total: 0 };
    } catch (e) {
        devError('Error fetching Travels:', e);
        return { data: [], total: 0 };
    }
};

export const fetchArticles = async (
    page: number,
    itemsPerPage: number,
    urlParams: Record<string, any>,
) => {
    try {
        // ✅ ИСПРАВЛЕНИЕ: Используем moderation и publish из urlParams, если они есть
        const whereObject = {
            // Устанавливаем по умолчанию только если их нет в urlParams
            ...(urlParams?.moderation === undefined && urlParams?.publish === undefined ? { publish: 1, moderation: 1 } : {}),
            ...(urlParams?.publish !== undefined ? { publish: urlParams.publish } : {}),
            ...(urlParams?.moderation !== undefined ? { moderation: urlParams.moderation } : {}),
            ...urlParams,
        };
        const params = new URLSearchParams({
            page: (page + 1).toString(),
            perPage: itemsPerPage.toString(),
            where: JSON.stringify(whereObject),
        }).toString();

        const urlArticles = `${GET_ARTICLES}?${params}`;
        const res = await fetchWithTimeout(urlArticles, {}, LONG_TIMEOUT);
        return await safeJsonParse<any[]>(res, []);
    } catch (e: any) {
        devError('Error fetching Articles:', e);
        return [];
    }
};

export const fetchTravelsby = async (
    page: number,
    itemsPerPage: number,
    search: string,
    urlParams: Record<string, any>,
) => {
    try {
        // ✅ ИСПРАВЛЕНИЕ: Используем moderation и publish из urlParams, если они есть
        const whereObject = {
            countries: [3],
            // Устанавливаем по умолчанию только если их нет в urlParams
            ...(urlParams?.moderation === undefined && urlParams?.publish === undefined ? { publish: 1, moderation: 1 } : {}),
            ...urlParams,
            // Явно устанавливаем moderation и publish из urlParams, если они есть (после spread, чтобы перезаписать дефолты)
            ...(urlParams?.publish !== undefined ? { publish: urlParams.publish } : {}),
            ...(urlParams?.moderation !== undefined ? { moderation: urlParams.moderation } : {}),
        };
        const params = new URLSearchParams({
            page: (page + 1).toString(),
            perPage: itemsPerPage.toString(),
            where: JSON.stringify(whereObject),
        }).toString();

        const urlTravel = `${GET_TRAVELS}?${params}`;
        const res = await fetchWithTimeout(urlTravel, {}, LONG_TIMEOUT);
        return await safeJsonParse<any[]>(res, []);
    } catch (e: any) {
        devError('Error fetching Travelsby:', e);
        return [];
    }
};

export const fetchTravel = async (id: number): Promise<Travel> => {
    try {
        const res = await fetchWithTimeout(`${GET_TRAVELS}/${id}`, {}, DEFAULT_TIMEOUT);
        return await safeJsonParse<Travel>(res, travelDef);
    } catch (e: any) {
        devError('Error fetching Travel:', e);
        return travelDef;
    }
};

export const fetchTravelBySlug = async (slug: string): Promise<Travel> => {
    try {
        const res = await fetchWithTimeout(`${GET_TRAVELS_BY_SLUG}/${slug}`, {}, DEFAULT_TIMEOUT);
        return await safeJsonParse<Travel>(res, travelDef);
    } catch (e: any) {
        devError('Error fetching Travel by slug:', e);
        return travelDef;
    }
};

export const fetchArticle = async (id: number): Promise<Article> => {
    try {
        const res = await fetchWithTimeout(`${GET_ARTICLES}/${id}`, {}, DEFAULT_TIMEOUT);
        return await safeJsonParse<Article>(res, travelDef as unknown as Article);
    } catch (e: any) {
        devError('Error fetching Article:', e);
        return travelDef as unknown as Article;
    }
};

export const fetchFilters = async (): Promise<Filters> => {
    try {
        const res = await fetchWithTimeout(GET_FILTERS, {}, DEFAULT_TIMEOUT);
        return await safeJsonParse<Filters>(res, [] as unknown as Filters);
    } catch (e: any) {
        devError('Error fetching filters:', e);
        return [] as unknown as Filters;
    }
};

export const fetchFiltersCountry = async () => {
    try {
        const res = await fetchWithTimeout(GET_FILTERS_COUNTRY, {}, DEFAULT_TIMEOUT);
        return await safeJsonParse<any[]>(res, []);
    } catch (e: any) {
        devError('Error fetching filters country:', e);
        return [];
    }
};

export const fetchAllCountries = async () => {
    try {
        const res = await fetchWithTimeout(GET_ALL_COUNTRY, {}, DEFAULT_TIMEOUT);
        return await safeJsonParse<any[]>(res, []);
    } catch (e: any) {
        devError('Error fetching all countries:', e);
        return [];
    }
};

export const fetchFiltersTravel = async (
    page: number,
    itemsPerPage: number,
    search: string,
    filter: Record<string, any>,
) => {
    try {
        // ✅ ИСПРАВЛЕНИЕ: Используем moderation и publish из filter, если они есть
        const whereObject: Record<string, any> = {
            // Устанавливаем по умолчанию только если их нет в filter
            ...(filter?.moderation === undefined && filter?.publish === undefined ? { publish: 1, moderation: 1 } : {}),
            ...(filter?.publish !== undefined ? { publish: filter.publish } : {}),
            ...(filter?.moderation !== undefined ? { moderation: filter.moderation } : {}),
        };

        // ✅ ИСПРАВЛЕНИЕ: Добавляем фильтры только если они не пустые
        if (filter?.countries && Array.isArray(filter.countries) && filter.countries.length > 0) {
            whereObject.countries = filter.countries;
        }
        if (filter?.categories && Array.isArray(filter.categories) && filter.categories.length > 0) {
            whereObject.categories = filter.categories;
        }
        if (filter?.categoryTravelAddress && Array.isArray(filter.categoryTravelAddress) && filter.categoryTravelAddress.length > 0) {
            whereObject.categoryTravelAddress = filter.categoryTravelAddress;
        }
        if (filter?.companions && Array.isArray(filter.companions) && filter.companions.length > 0) {
            whereObject.companions = filter.companions;
        }
        if (filter?.complexity && Array.isArray(filter.complexity) && filter.complexity.length > 0) {
            whereObject.complexity = filter.complexity;
        }
        if (filter?.month && Array.isArray(filter.month) && filter.month.length > 0) {
            whereObject.month = filter.month;
        }
        if (filter?.over_nights_stay && Array.isArray(filter.over_nights_stay) && filter.over_nights_stay.length > 0) {
            whereObject.over_nights_stay = filter.over_nights_stay;
        }
        if (filter?.transports && Array.isArray(filter.transports) && filter.transports.length > 0) {
            whereObject.transports = filter.transports;
        }
        // ✅ ИСПРАВЛЕНИЕ: Год передаем как строку, только если он не пустой
        if (filter?.year && typeof filter.year === 'string' && filter.year.trim() !== '') {
            whereObject.year = filter.year.trim();
        }
        
        const paramsObj = {
            page: (page + 1).toString(),
            perPage: itemsPerPage.toString(),
            query: search,
            where: JSON.stringify(whereObject),
        };
        const params = new URLSearchParams(paramsObj).toString();

        const urlTravel = `${GET_FILTERS_TRAVEL}?${params}`;
        const res = await fetchWithTimeout(urlTravel, {}, LONG_TIMEOUT);
        return await safeJsonParse<any[]>(res, []);
    } catch (e) {
        if (__DEV__) {
            console.log('Error fetching filter travels:', e);
        }
        return [];
    }
};

export const fetchTravelsNear = async (travel_id: number, signal?: AbortSignal) => {
    try {
        const params = new URLSearchParams({ travel_id: travel_id.toString() }).toString();
        const urlTravel = `${GET_TRAVELS}/${travel_id}/near?${params}`;
        const res = await fetchWithTimeout(urlTravel, { signal }, DEFAULT_TIMEOUT);
        if (!res.ok) {
            if (__DEV__) {
                console.error('Error fetching travels near: HTTP', res.status, res.statusText);
            }
            return [];
        }
        return await safeJsonParse<Travel[]>(res, []);
    } catch (e: any) {
        if (e.name === 'AbortError') {
            throw e; // Пробрасываем AbortError наверх
        }
        if (__DEV__) {
            console.log('Error fetching travels near:', e);
        }
        return [];
    }
};

export const fetchTravelsPopular = async (): Promise<TravelsMap> => {
    try {
        const urlTravel = `${GET_TRAVELS}/popular`;
        const res = await fetchWithTimeout(urlTravel, {}, DEFAULT_TIMEOUT);
        return await safeJsonParse<TravelsMap>(res, {} as TravelsMap);
    } catch (e) {
        if (__DEV__) {
            console.log('Error fetching fetchTravelsPopular:', e);
        }
        return {} as TravelsMap;
    }
};

export const fetchTravelsForMap = async (
    page: number,
    itemsPerPage: number,
    filter: Record<string, any>,
): Promise<TravelsForMap> => {
    try {
        const radius = parseInt(filter?.radius ?? '60', 10);
        const lat = filter?.lat ?? '53.9006';
        const lng = filter?.lng ?? '27.5590';

        // ✅ ИСПРАВЛЕНИЕ: Используем moderation и publish из filter, если они есть
        const whereObject: Record<string, any> = {
            // Устанавливаем по умолчанию только если их нет в filter
            ...(filter?.moderation === undefined && filter?.publish === undefined ? { publish: 1, moderation: 1 } : {}),
            ...(filter?.publish !== undefined ? { publish: filter.publish } : {}),
            ...(filter?.moderation !== undefined ? { moderation: filter.moderation } : {}),
            lat,
            lng,
            radius,
        };

        if (filter?.categories && Array.isArray(filter.categories) && filter.categories.length > 0) {
            const normalizedCategories = normalizeNumericArray(filter.categories);
            if (normalizedCategories.length > 0) {
                whereObject.categories = normalizedCategories;
            }
        }

        const paramsObj = {
            page: (page + 1).toString(),
            perPage: itemsPerPage.toString(),
            where: JSON.stringify(whereObject),
        };
        const params = new URLSearchParams(paramsObj).toString();

        const urlTravel = `${SEARCH_TRAVELS_FOR_MAP}?${params}`;
        const res = await fetchWithTimeout(urlTravel, {}, LONG_TIMEOUT);
        return await safeJsonParse<TravelsForMap>(res, [] as unknown as TravelsForMap);
    } catch (e) {
        if (__DEV__) {
            console.log('Error fetching fetchTravelsForMap:', e);
        }
        return [] as unknown as TravelsForMap;
    }
};

export const fetchTravelsNearRoute = async (
    routeCoords: [number, number][], // [lng, lat]
    toleranceKm: number = 2,
): Promise<TravelsForMap> => {
    try {
        // Отправляем tolerance в метрах (2000 метров = 2 км)
        const toleranceMeters = toleranceKm * 1000;
        const body = {
            route: {
                type: 'LineString',
                coordinates: routeCoords,
            },
            tolerance: toleranceMeters,
        };

        const res = await fetchWithTimeout(SEARCH_TRAVELS_NEAR_ROUTE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }, LONG_TIMEOUT);

        if (!res.ok) {
            if (__DEV__) {
                const errorText = await res.text().catch(() => 'Unknown error');
                console.log('Ошибка при загрузке маршрута:', errorText);
            }
            return [] as unknown as TravelsForMap;
        }

        return await safeJsonParse<TravelsForMap>(res, [] as unknown as TravelsForMap);
    } catch (e) {
        if (__DEV__) {
            console.log('Error fetching fetchTravelsNearRoute:', e);
        }
        return [] as unknown as TravelsForMap;
    }
};

export const fetchFiltersMap = async (): Promise<Filters> => {
    try {
        const res = await fetchWithTimeout(GET_FILTER_FOR_MAP, {}, DEFAULT_TIMEOUT);
        return await safeJsonParse<Filters>(res, [] as unknown as Filters);
    } catch (e) {
        if (__DEV__) {
            console.log('Error fetching filters:', e);
        }
        return [] as unknown as Filters;
    }
};

export const fetchCounties = async (): Promise<Filters> => {
    try {
        const res = await fetchWithTimeout(GET_LIST_COUNTRIES, {}, DEFAULT_TIMEOUT);
        return await safeJsonParse<Filters>(res, [] as unknown as Filters);
    } catch (e) {
        if (__DEV__) {
            console.log('Error fetching filters:', e);
        }
        return [] as unknown as Filters;
    }
};

export const sendFeedback = async (
    name: string,
    email: string,
    message: string
): Promise<string> => {
    // ✅ УЛУЧШЕНИЕ: Санитизация входных данных
    const sanitizedName = sanitizeInput(name.trim());
    const sanitizedEmail = sanitizeInput(email.trim());
    const sanitizedMessage = sanitizeInput(message.trim());

    if (!sanitizedName || !sanitizedEmail || !sanitizedMessage) {
        throw new Error('Все поля должны быть заполнены');
    }

    try {
        const res = await fetchWithTimeout(SEND_FEEDBACK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: sanitizedName, 
                email: sanitizedEmail, 
                message: sanitizedMessage 
            }),
        }, DEFAULT_TIMEOUT);

        const json = await safeJsonParse<{ 
            email?: string[]; 
            name?: string[]; 
            message?: string[] | string; 
            detail?: string 
        }>(res, {});

        if (!res.ok) {
            const firstError =
                (Array.isArray(json?.email) ? json.email[0] : undefined) ||
                (Array.isArray(json?.name) ? json.name[0] : undefined) ||
                (Array.isArray(json?.message) ? json.message[0] : undefined) ||
                (typeof json?.message === 'string' ? json.message : undefined) ||
                json?.detail ||
                'Ошибка при отправке.';
            throw new Error(firstError);
        }

        return typeof json === 'string'
            ? json
            : (typeof json?.message === 'string' ? json.message : 'Сообщение успешно отправлено');
    } catch (e: any) {
        if (__DEV__) {
            console.error('Ошибка при отправке обратной связи:', e);
        }
        throw new Error(e?.message || 'Не удалось отправить сообщение');
    }
};

export const confirmAccount = async (hash: string) => {
    try {
        const response = await fetchWithTimeout(CONFIRM_REGISTER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash }),
        }, DEFAULT_TIMEOUT);

        const jsonResponse = await safeJsonParse<{ 
            userToken?: string; 
            userName?: string 
        }>(response, {});
        
        // ✅ FIX-001: Используем безопасное хранилище для токена
        if (jsonResponse.userToken) {
            await setSecureItem('userToken', jsonResponse.userToken);
            await AsyncStorage.setItem('userName', jsonResponse.userName || '');
        }
        return jsonResponse;
    } catch (error: any) {
        throw new Error(error.message || 'Произошла ошибка при подтверждении учетной записи.');
    }
};

export const saveFormData = async (data: TravelFormData): Promise<TravelFormData> => {
    try {
        // ✅ FIX-001: Используем безопасное хранилище для токена
        const token = await getSecureItem('userToken');
        if (!token) {
            throw new Error('Пользователь не авторизован');
        }

        const response = await fetchWithTimeout(SAVE_TRAVEL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Token ${token}`,
            },
            body: JSON.stringify(data),
        }, LONG_TIMEOUT);

        if (!response.ok) {
            throw new Error('Ошибка при создании записи на сервере');
        }

        const responseData = await safeJsonParse<TravelFormData>(response);
        if (__DEV__) {
            console.log('Данные успешно сохранены:', responseData);
        }
        return responseData;
    } catch (error) {
        if (__DEV__) {
            console.error('Ошибка при создании формы:', error);
        }
        throw error;
    }
};

export const uploadImage = async (data: FormData): Promise<any> => {
    // ✅ FIX-001: Используем безопасное хранилище для токена
    const token = await getSecureItem('userToken');
    if (!token) {
        throw new Error('Пользователь не авторизован');
    }

    // ✅ УЛУЧШЕНИЕ: Валидация файла перед загрузкой
    // Проверяем файл в FormData (если доступен)
    if (typeof File !== 'undefined' && data instanceof FormData) {
        const file = data.get('file');
        if (file instanceof File) {
            const validation = validateImageFile(file);
            if (!validation.valid) {
                throw new Error(validation.error || 'Ошибка валидации файла');
            }
        }
    }

    // ✅ УЛУЧШЕНИЕ: Retry для критических операций загрузки
    return retry(
        async () => {
            const response = await fetchWithTimeout(UPLOAD_IMAGE, {
                method: 'POST',
                headers: { Authorization: `Token ${token}` },
                body: data,
            }, LONG_TIMEOUT);

            if (response.status === 200) {
                const responseData = await safeJsonParse<any>(response, {});
                return responseData;
            } else {
                const errorText = await response.text().catch(() => 'Upload failed');
                throw new Error(errorText || 'Upload failed.');
            }
        },
        {
            maxAttempts: 2, // Для загрузки файлов делаем меньше попыток
            delay: 1000,
            shouldRetry: (error) => {
                // Повторяем только для сетевых ошибок и 5xx
                return isRetryableError(error) && !error.message.includes('401') && !error.message.includes('403');
            }
        }
    );
};

export const deleteImage = async (imageId: string) => {
    // ✅ FIX-001: Используем безопасное хранилище для токена
    const token = await getSecureItem('userToken');
    if (!token) {
        throw new Error('Пользователь не авторизован');
    }

    const response = await fetchWithTimeout(`${GALLERY}/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
    }, DEFAULT_TIMEOUT);

    if (response.status === 204) {
        return response;
    } else {
        throw new Error('Ошибка удаления изображения');
    }
};

export const deleteTravel = async (id: string) => {
    try {
        // ✅ FIX-001: Используем безопасное хранилище для токена
        const token = await getSecureItem('userToken');
        const response = await fetchWithTimeout(`${GET_TRAVELS}/${id}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Token ${token}` } : {},
        }, DEFAULT_TIMEOUT);
        
        if (response.status !== 204) {
            throw new Error('Ошибка при удалении путешествия');
        }
        return response;
    } catch (error) {
        if (__DEV__) {
            console.error('Ошибка при удалении путешествия:', error);
        }
        throw error;
    }
};

export const sendAIMessage = async (inputText: string) => {
    // ✅ ИСПРАВЛЕНИЕ: Валидация входных данных
    const validation = validateAIMessage(inputText);
    if (!validation.valid) {
        throw new Error(validation.error || 'Некорректное сообщение');
    }

    try {
        const response = await fetchWithTimeout(SEND_AI_QUESTION, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: inputText.trim() }),
        }, LONG_TIMEOUT);
        
        if (!response.ok) {
            throw new Error(`AI request failed: ${response.statusText}`);
        }
        
        const responseData = await safeJsonParse<any>(response);
        return responseData;
    } catch (error) {
        if (__DEV__) {
            console.error('Ошибка:', error);
        }
        throw error;
    }
};

export const fetchMyTravels = async (params: {
    user_id: string | number;
    yearFrom?: string;
    yearTo?: string;
    country?: string;
    onlyWithGallery?: boolean;
}) => {
    try {
        // Собираем where-условие
        const whereObject: Record<string, any> = {
            user_id: params.user_id,
            publish: 1,
            moderation: 1,
        };

        if (params.country) {
            whereObject.countries = [params.country];
        }
        if (params.yearFrom || params.yearTo) {
            whereObject.year = {
                ...(params.yearFrom ? { gte: params.yearFrom } : {}),
                ...(params.yearTo ? { lte: params.yearTo } : {}),
            };
        }
        if (params.onlyWithGallery) {
            whereObject.hasGallery = true; // ⚠️ зависит от твоего бекенда
        }

        const query = new URLSearchParams({
            page: '1',
            perPage: '9999',
            where: JSON.stringify(whereObject),
        }).toString();

        const url = `${GET_TRAVELS}?${query}`;
        const res = await fetchWithTimeout(url, {}, LONG_TIMEOUT);
        if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unknown error');
            throw new Error(errorText);
        }
        return await safeJsonParse<any>(res, {});
    } catch (e) {
        if (__DEV__) {
            console.log('Error fetching MyTravels:', e);
        }
        return [];
    }
};
