import {
    Travel,
} from '@/src/types/types';
import { devError, devWarn } from '@/src/utils/logger';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';
import { retry, isRetryableError } from '@/src/utils/retry';
import { getSecureItem } from '@/src/utils/secureStorage';

const rawApiUrl: string =
    process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
if (!rawApiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

// Нормализуем базу API: гарантируем суффикс /api и убираем лишние слэши
const URLAPI = (() => {
    const trimmed = rawApiUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

const DEFAULT_TIMEOUT = 10000; // 10 секунд
const LONG_TIMEOUT = 30000; // 30 секунд для тяжелых запросов

// Base travels endpoint with trailing slash
const GET_TRAVELS = `${URLAPI}/travels/`;
const GET_RANDOM_TRAVELS = `${URLAPI}/travels/random/`;
const GET_TRAVELS_BY_SLUG = `${URLAPI}/travels/by-slug/`;

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

const travelCache = new Map<number, Travel>();
const TOKEN_KEY = 'userToken';

const normalizeTravelItem = (input: any): Travel => {
    const t = (input && typeof input === 'object') ? input : {};
    const out: any = { ...t };

    if (typeof t.id !== 'undefined') {
        out.id = Number(t.id) || 0;
    }
    if (typeof t.slug !== 'undefined') {
        out.slug = String(t.slug);
    }

    if (typeof t.youtube_link === 'undefined' && typeof t.youtubeLink !== 'undefined') {
        out.youtube_link = String(t.youtubeLink ?? '');
    }
    if (typeof t.userName === 'undefined' && typeof t.user_name !== 'undefined') {
        out.userName = String(t.user_name ?? '');
    }
    if (typeof t.cityName === 'undefined' && typeof t.city_name !== 'undefined') {
        out.cityName = String(t.city_name ?? '');
    }
    if (typeof t.countryName === 'undefined' && typeof t.country_name !== 'undefined') {
        out.countryName = String(t.country_name ?? '');
    }

    if (typeof t.countUnicIpView !== 'undefined' || typeof t.count_unic_ip_view !== 'undefined') {
        out.countUnicIpView = String(t.countUnicIpView ?? t.count_unic_ip_view ?? '0');
    }

    if (typeof t.travel_image_thumb_url === 'undefined' && typeof t.travelImageThumbUrl !== 'undefined') {
        out.travel_image_thumb_url = String(t.travelImageThumbUrl ?? '');
    }
    if (
        typeof t.travel_image_thumb_small_url === 'undefined' &&
        typeof t.travelImageThumbSmallUrl !== 'undefined'
    ) {
        out.travel_image_thumb_small_url = String(t.travelImageThumbSmallUrl ?? '');
    }
    if (
        typeof out.travel_image_thumb_small_url === 'undefined' &&
        typeof out.travel_image_thumb_url !== 'undefined'
    ) {
        out.travel_image_thumb_small_url = out.travel_image_thumb_url;
    }

    return out as Travel;
};

const coerceTotal = (value: any, fallback = 0): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const buildAuthHeaders = async (): Promise<HeadersInit | undefined> => {
    const token = await getSecureItem(TOKEN_KEY);
    if (!token) {
        return undefined;
    }
    return {
        Authorization: `Token ${token}`,
    };
};

const normalizeNumericFilterArray = (value: any): number[] => {
    if (!Array.isArray(value)) return [];

    return value
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
            if (typeof val === 'number') {
                return !isNaN(val) && isFinite(val) ? val : null;
            }
            return null;
        })
        .filter((val: any): val is number => val !== null && val !== undefined);
};

const buildWhereQueryParams = (params: {
    page?: number;
    perPage?: number;
    query?: string;
    where: Record<string, any>;
}): string => {
    const searchParams: Record<string, string> = {
        where: JSON.stringify(params.where),
    };

    if (typeof params.page === 'number') {
        searchParams.page = (params.page + 1).toString();
    }
    if (typeof params.perPage === 'number') {
        searchParams.perPage = params.perPage.toString();
    }
    if (params.query !== undefined) {
        searchParams.query = params.query || '';
    }

    return new URLSearchParams(searchParams).toString();
};

const unwrapTravelsList = (
    payload: any
): { items: any[]; total: number } => {
    if (!payload) return { items: [], total: 0 };

    if (Array.isArray(payload)) {
        return { items: payload, total: payload.length };
    }

    if (payload && typeof payload === 'object') {
        if (Array.isArray((payload as any).results)) {
            return {
                items: (payload as any).results,
                total: typeof (payload as any).count === 'number' ? (payload as any).count : (payload as any).results.length,
            };
        }

        if (Array.isArray((payload as any).data)) {
            return {
                items: (payload as any).data,
                total: typeof (payload as any).total === 'number' ? (payload as any).total : (payload as any).data.length,
            };
        }
    }

    return { items: [], total: 0 };
};

const applyPublishModeration = (
    target: Record<string, any>,
    source: Record<string, any> | undefined | null,
    defaults?: { publish?: number; moderation?: number },
) => {
    if (!source) {
        if (defaults) {
            if (defaults.publish !== undefined) target.publish = defaults.publish;
            if (defaults.moderation !== undefined) target.moderation = defaults.moderation;
        }
        return;
    }

    if (source.moderation === undefined && source.publish === undefined && defaults) {
        if (defaults.publish !== undefined) target.publish = defaults.publish;
        if (defaults.moderation !== undefined) target.moderation = defaults.moderation;
    }

    if (source.publish !== undefined) {
        target.publish = source.publish;
    }
    if (source.moderation !== undefined) {
        target.moderation = source.moderation;
    }
};

export const fetchTravels = async (
    page: number,
    itemsPerPage: number,
    search: string,
    urlParams: Record<string, any>,
    options?: { signal?: AbortSignal }
) => {
    try {
        const whereObject: Record<string, any> = {};

        const isUserScoped = urlParams?.user_id !== undefined && urlParams?.user_id !== null;

        if (isUserScoped) {
            if (urlParams?.moderation !== undefined) {
                whereObject.moderation = urlParams.moderation;
            }
            if (urlParams?.publish !== undefined) {
                whereObject.publish = urlParams.publish;
            }
        } else {
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
        }

        const arrayFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
        arrayFields.forEach(field => {
            if (urlParams[field]) {
                const normalized = normalizeNumericFilterArray(urlParams[field]);

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

        const handledKeys = new Set<string>([...arrayFields, 'year', 'moderation', 'publish']);
        Object.entries(urlParams || {}).forEach(([key, value]) => {
            if (handledKeys.has(key)) {
                return;
            }
            if (value === undefined || value === null || value === '') {
                return;
            }
            if (Array.isArray(value) && value.length === 0) {
                return;
            }
            whereObject[key] = value;
        });

        const params = buildWhereQueryParams({
            page,
            perPage: itemsPerPage,
            query: search,
            where: whereObject,
        });


        const urlTravel = `${GET_TRAVELS}?${params}`;

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
                        return isRetryableError(error);
                    }
                }
            );

        const result = await safeJsonParse<{
            data?: Travel[];
            total?: number;
            results?: Travel[];
            count?: number;
            detail?: string;
        } | Travel[]>(res, []);

        if (!res.ok) {
            if (typeof result === 'object' && !Array.isArray(result) && result?.detail === "Invalid page.") {
                devError('Invalid page requested:', page + 1);
                return { data: [], total: 0 };
            }
            devError('Error fetching Travels: HTTP', res.status, res.statusText);
            return { data: [], total: 0 };
        }

        const { items, total } = unwrapTravelsList(result);

        if (result && typeof result === 'object' && !Array.isArray(result) && (result as any).detail === "Invalid page.") {
            devError('Invalid page in response:', page + 1);
            return { data: [], total: typeof (result as any).total === 'number' ? (result as any).total : total };
        }

        if (items.length === 0 && result && typeof result === 'object' && !Array.isArray(result)) {
            if (__DEV__) {
                devWarn('API returned unexpected structure:', result);
            }
            return { data: [], total: coerceTotal((result as any).total, 0) };
        }

        return {
            data: items.map(normalizeTravelItem),
            total: coerceTotal(total, 0),
        };
    } catch (e) {
        devError('Error fetching Travels:', e);
        return { data: [], total: 0 };
    }
};

export const fetchRandomTravels = async (
    page: number,
    itemsPerPage: number,
    search: string,
    urlParams: Record<string, any>,
    options?: { signal?: AbortSignal }
) => {
    try {
        const whereObject: Record<string, any> = {};

        applyPublishModeration(whereObject, urlParams, { publish: 1, moderation: 1 });

        const arrayFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
        arrayFields.forEach(field => {
            if (urlParams[field] && Array.isArray(urlParams[field])) {
                const normalized = normalizeNumericFilterArray(urlParams[field]);
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

        whereObject.moderation = 1;
        whereObject.publish = 1;

        const params = buildWhereQueryParams({
            where: whereObject,
            query: search,
        });

        // для запросов с query убираем завершающий слеш
        const baseUrl = GET_RANDOM_TRAVELS.replace(/\/+$/, '');
        const urlTravel = `${baseUrl}?${params}`;

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
                        return isRetryableError(error);
                    }
                }
            );

        const result = await safeJsonParse<{
            data?: Travel[];
            total?: number;
            results?: Travel[];
            count?: number;
            detail?: string;
        } | Travel[]>(res, []);

        if (!res.ok) {
            if (typeof result === 'object' && !Array.isArray(result) && result?.detail === "Invalid page.") {
                devError('Invalid random page requested:', page + 1);
                return { data: [], total: 0 };
            }
            devError('Error fetching Random Travels: HTTP', res.status, res.statusText);
            return { data: [], total: 0 };
        }

        if (Array.isArray(result)) {
            const data = result.map(normalizeTravelItem);
            return { data, total: data.length };
        }

        const { items, total } = unwrapTravelsList(result);

        if (result && typeof result === 'object' && !Array.isArray(result) && (result as any).detail === "Invalid page.") {
            devError('Invalid random page in response:', page + 1);
            return { data: [], total: coerceTotal((result as any).total, 0) };
        }

        if (items.length === 0 && result && typeof result === 'object' && !Array.isArray(result)) {
            if (__DEV__) {
                console.warn('API returned unexpected random structure:', result);
            }
            return { data: [], total: coerceTotal((result as any).total, 0) };
        }

        return {
            data: items.map(normalizeTravelItem),
            total: coerceTotal(total, 0),
        };
    } catch (e) {
        devError('Error fetching Random Travels:', e);
        return { data: [], total: 0 };
    }
};

export const fetchTravel = async (id: number): Promise<Travel> => {
    const authHeaders = await buildAuthHeaders();
    const isAuthenticated = Boolean(authHeaders);

    if (!isAuthenticated && travelCache.has(id)) {
        return travelCache.get(id) as Travel;
    }

    try {
        const res = await fetchWithTimeout(
            `${GET_TRAVELS}/${id}/`,
            authHeaders ? { headers: authHeaders } : {},
            DEFAULT_TIMEOUT,
        );
        const travel = await safeJsonParse<Travel>(res, travelDef);
        if (!isAuthenticated) {
            travelCache.set(id, travel);
        }
        return travel;
    } catch (e: any) {
        devError('Error fetching Travel:', e);
        return travelDef;
    }
};

export const fetchTravelBySlug = async (slug: string): Promise<Travel> => {
    try {
        const authHeaders = await buildAuthHeaders();
        const safeSlug = encodeURIComponent(String(slug).replace(/^\/+/, ''));
        const res = await fetchWithTimeout(
            `${GET_TRAVELS_BY_SLUG}${safeSlug}/`,
            authHeaders ? { headers: authHeaders } : {},
            DEFAULT_TIMEOUT,
        );
        return await safeJsonParse<Travel>(res, travelDef);
    } catch (e: any) {
        devError('Error fetching Travel by slug:', e);
        return travelDef;
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
            whereObject.hasGallery = true;
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
            devError('Error fetching MyTravels:', e);
        }
        return [];
    }
};
