import {
    Travel,
} from '@/types/types';
import { devError, devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { retry, isRetryableError } from '@/utils/retry';
import { getSecureItem } from '@/utils/secureStorage';
import { apiClient } from '@/api/client';
import { Platform } from 'react-native';

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';
const envApiUrl = process.env.EXPO_PUBLIC_API_URL || '';
const webOriginApi =
    Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/api`
        : '';

const isWebLocalHost =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.location?.hostname === 'string' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const rawApiUrl: string =
    process.env.NODE_ENV === 'test'
        ? 'http://example.test/api'
        : (envApiUrl
            ? envApiUrl
            : (Platform.OS === 'web' && (isE2E || isLocalApi) && isWebLocalHost && webOriginApi
                ? webOriginApi
                : ''));
if (!rawApiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

// Нормализуем базу API: гарантируем суффикс /api и убираем лишние слэши
const URLAPI = (() => {
    const trimmed = rawApiUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

const LONG_TIMEOUT = 30000; // 30 секунд для тяжелых запросов

// Base travels endpoint with trailing slash
const GET_TRAVELS = `${URLAPI}/travels/`;
const GET_RANDOM_TRAVELS = `${URLAPI}/travels/random/`;

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

    // Normalize url field:
    // - Backend can return relative paths, empty strings, or non-canonical values.
    // - Ensure we always have a stable canonical route for navigation.
    const normalizedId = typeof out.id === 'number' ? out.id : Number(out.id) || 0;
    const normalizedSlug = typeof out.slug === 'string' ? out.slug.trim() : String(out.slug ?? '').trim();
    const canonicalKey = normalizedSlug || (normalizedId ? String(normalizedId) : '');

    const rawUrl = typeof out.url === 'string' ? out.url.trim() : '';
    const hasTravelsUrl = rawUrl.includes('/travels/');

    // We do NOT synthesize url if it was not provided by API.
    // But if API provided a url and it is non-canonical (e.g. '/test' or 'test'),
    // we fix it to the canonical travel route.
    if (rawUrl) {
        if (canonicalKey && !hasTravelsUrl) {
            out.url = `/travels/${canonicalKey}`;
        } else if (!rawUrl.startsWith('http') && !rawUrl.startsWith('/')) {
            out.url = `/${rawUrl}`;
        }
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

    // Нормализация URL изображений (относительные -> абсолютные)
    const normalizeImageUrl = (url: string | undefined): string => {
        if (!url) return '';
        const trimmed = url.trim();
        if (!trimmed) return '';

        if (/^http:\/\//i.test(trimmed)) {
            try {
                const parsed = new URL(trimmed);
                const host = String(parsed.hostname || '').trim().toLowerCase();
                const isPrivateOrLocal =
                    host === 'localhost' ||
                    host === '127.0.0.1' ||
                    /^10\./.test(host) ||
                    /^192\.168\./.test(host) ||
                    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
                if (!isPrivateOrLocal) {
                    return trimmed.replace(/^http:\/\//i, 'https://');
                }
            } catch {
                return trimmed.replace(/^http:\/\//i, 'https://');
            }
        }
        
        // Если URL уже абсолютный, возвращаем как есть
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
        }
        
        // Если URL относительный, добавляем домен
        if (trimmed.startsWith('/')) {
            const baseUrl = typeof window !== 'undefined' && window.location?.origin
                ? window.location.origin
                : 'https://metravel.by';
            return `${baseUrl}${trimmed}`;
        }
        
        return trimmed;
    };

    if (typeof t.travel_image_thumb_url === 'undefined' && typeof t.travelImageThumbUrl !== 'undefined') {
        out.travel_image_thumb_url = normalizeImageUrl(String(t.travelImageThumbUrl ?? ''));
    } else if (typeof t.travel_image_thumb_url !== 'undefined') {
        out.travel_image_thumb_url = normalizeImageUrl(String(t.travel_image_thumb_url ?? ''));
    }
    
    if (
        typeof t.travel_image_thumb_small_url === 'undefined' &&
        typeof t.travelImageThumbSmallUrl !== 'undefined'
    ) {
        out.travel_image_thumb_small_url = normalizeImageUrl(String(t.travelImageThumbSmallUrl ?? ''));
    } else if (typeof t.travel_image_thumb_small_url !== 'undefined') {
        out.travel_image_thumb_small_url = normalizeImageUrl(String(t.travel_image_thumb_small_url ?? ''));
    }
    
    if (
        typeof out.travel_image_thumb_small_url === 'undefined' &&
        typeof out.travel_image_thumb_url !== 'undefined'
    ) {
        out.travel_image_thumb_small_url = out.travel_image_thumb_url;
    }

    if (Array.isArray((out as any).gallery)) {
        out.gallery = (out as any).gallery
            .map((item: any) => {
                if (typeof item === 'string') {
                    const normalized = normalizeImageUrl(item);
                    return normalized || item;
                }
                if (item && typeof item === 'object') {
                    const rawUrl = typeof (item as any).url === 'string' ? String((item as any).url) : '';
                    const normalized = rawUrl ? normalizeImageUrl(rawUrl) : rawUrl;
                    return {
                        ...(item as any),
                        ...(normalized ? { url: normalized } : null),
                    };
                }
                return item;
            })
            .filter(Boolean);
    }

    return out as Travel;
};

const coerceTotal = (value: any, fallback = 0): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
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
        if (Array.isArray((payload as any).items)) {
            return {
                items: (payload as any).items,
                total:
                    typeof (payload as any).total === 'number'
                        ? (payload as any).total
                        : (typeof (payload as any).count === 'number'
                            ? (payload as any).count
                            : (payload as any).items.length),
            };
        }

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
            const hasKnownListShape =
                Array.isArray((result as any).results) ||
                Array.isArray((result as any).data) ||
                Array.isArray((result as any).items);

            // Empty list is a valid response; warn only if the structure is truly unknown.
            if (!hasKnownListShape && __DEV__) {
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
            page,
            perPage: itemsPerPage,
            where: whereObject,
            query: search,
        });

        // DRF endpoints expect the trailing slash; keep it to avoid 301 redirects
        const urlTravel = `${GET_RANDOM_TRAVELS}?${params}`;

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
            const hasKnownListShape =
                Array.isArray((result as any).results) ||
                Array.isArray((result as any).data) ||
                Array.isArray((result as any).items);

            // Empty list is a valid response; warn only if the structure is truly unknown.
            if (!hasKnownListShape && __DEV__) {
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

export const fetchTravel = async (
    id: number,
    options?: { signal?: AbortSignal }
): Promise<Travel> => {
    const token = await getSecureItem(TOKEN_KEY);
    const isAuthenticated = Boolean(token);

    if (!isAuthenticated && travelCache.has(id)) {
        return travelCache.get(id) as Travel;
    }

    try {
        const travel = await apiClient.get<Travel>(`/travels/${id}/`, LONG_TIMEOUT, { signal: options?.signal });
        const normalized = normalizeTravelItem(travel);
        if (!isAuthenticated) {
            travelCache.set(id, normalized);
        }
        return normalized;
    } catch (e: any) {
        if (e?.name === 'AbortError') {
            throw e;
        }
        devError('Error fetching Travel:', e);
        throw e;
    }
};

export const fetchTravelBySlug = async (
    slug: string,
    options?: { signal?: AbortSignal }
): Promise<Travel> => {
    try {
        const safeSlug = encodeURIComponent(String(slug).replace(/^\/+/, ''));
        const travel = await apiClient.get<Travel>(`/travels/by-slug/${safeSlug}/`, LONG_TIMEOUT, { signal: options?.signal });
        return normalizeTravelItem(travel);
    } catch (e: any) {
        if (e?.name === 'AbortError') {
            throw e;
        }
        devError('Error fetching Travel by slug:', e);
        throw e;
    }
};

export const fetchMyTravels = async (params: {
    user_id: string | number;
    yearFrom?: string;
    yearTo?: string;
    country?: string;
    onlyWithGallery?: boolean;
    includeDrafts?: boolean;
    publish?: number;
    moderation?: number;
    throwOnError?: boolean;
}) => {
    try {
        const whereObject: Record<string, any> = {
            user_id: params.user_id,
        };

        const hasExplicitStatus =
            typeof params.publish !== 'undefined' || typeof params.moderation !== 'undefined';

        if (typeof params.publish !== 'undefined') {
            whereObject.publish = params.publish;
        }
        if (typeof params.moderation !== 'undefined') {
            whereObject.moderation = params.moderation;
        }

        if (!params.includeDrafts && !hasExplicitStatus) {
            whereObject.publish = 1;
            whereObject.moderation = 1;
        }

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
        if (params.throwOnError) {
            throw e;
        }
        return [];
    }
};
