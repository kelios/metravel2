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

/**
 * Defensive filter: strip items that are not published or not moderated.
 * The backend should already filter these, but some endpoints (e.g. /random/)
 * occasionally return items still under moderation, causing 403 on detail fetch.
 */
const filterPublished = (items: Travel[]): Travel[] =>
    items.filter((t) => {
        const withStatus = t as Travel & { publish?: unknown; moderation?: unknown };
        const pub = withStatus.publish;
        const mod = withStatus.moderation;
        // Keep items where publish/moderation are truthy or undefined (not explicitly false/0)
        const pubOk = pub === undefined || pub === null || pub === true || pub === 1 || pub === '1';
        const modOk = mod === undefined || mod === null || mod === true || mod === 1 || mod === '1';
        return pubOk && modOk;
    });
const TOKEN_KEY = 'userToken';

export type MyTravelsItem = Record<string, unknown>;
export type MyTravelsPayload =
    | MyTravelsItem[]
    | {
        data?: MyTravelsItem[];
        results?: MyTravelsItem[];
        items?: MyTravelsItem[];
        total?: unknown;
        count?: unknown;
    };

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const getPositiveNumericId = (value: unknown): number | null => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
};

const extractFirstUserId = (raw: unknown): number | null => {
    if (typeof raw === 'string') {
        return getPositiveNumericId(raw.split(',')[0]?.trim() ?? '');
    }
    if (Array.isArray(raw) && raw.length > 0) {
        return getPositiveNumericId(raw[0]);
    }
    return getPositiveNumericId(raw);
};

export const normalizeTravelItem = (input: unknown): Travel => {
    const t = asRecord(input);
    const out: Record<string, unknown> = { ...t };

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

    // Normalize user object: ensure travel.user.id is populated from userIds when missing
    const existingUser = asRecord(out.user);
    const hasExistingUserId = getPositiveNumericId(existingUser.id) !== null;

    if (!hasExistingUserId) {
        const raw = t.userIds ?? t.user_ids;
        const uid = extractFirstUserId(raw);
        if (uid !== null) {
            out.user = {
                ...existingUser,
                id: uid,
                name: typeof out.userName === 'string' ? out.userName : '',
            };
        }
    }

    if (Array.isArray(out.gallery)) {
        out.gallery = out.gallery
            .map((item: unknown) => {
                if (typeof item === 'string') {
                    const normalized = normalizeImageUrl(item);
                    return normalized || item;
                }
                if (item && typeof item === 'object') {
                    const galleryItem = item as Record<string, unknown>;
                    const rawUrl = typeof galleryItem.url === 'string' ? galleryItem.url : '';
                    const normalized = rawUrl ? normalizeImageUrl(rawUrl) : rawUrl;
                    return {
                        ...galleryItem,
                        ...(normalized ? { url: normalized } : null),
                    };
                }
                return item;
            })
            .filter(Boolean);
    }

    return out as Travel;
};

const coerceTotal = (value: unknown, fallback = 0): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const normalizeNumericFilterArray = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];

    return value
        .map((val: unknown) => toFiniteNumber(val))
        .filter((val): val is number => val !== null);
};

const buildWhereQueryParams = (params: {
    page?: number;
    perPage?: number;
    query?: string;
    where: Record<string, unknown>;
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
    payload: unknown
): { items: unknown[]; total: number } => {
    if (!payload) return { items: [], total: 0 };

    if (Array.isArray(payload)) {
        return { items: payload, total: payload.length };
    }

    if (payload && typeof payload === 'object') {
        const source = payload as Record<string, unknown>;
        const items = source.items;
        const results = source.results;
        const data = source.data;

        if (Array.isArray(items)) {
            return {
                items,
                total: coerceTotal(source.total, coerceTotal(source.count, items.length)),
            };
        }

        if (Array.isArray(results)) {
            return {
                items: results,
                total: coerceTotal(source.count, coerceTotal(source.total, results.length)),
            };
        }

        if (Array.isArray(data)) {
            return {
                items: data,
                total: coerceTotal(source.total, coerceTotal(source.count, data.length)),
            };
        }
    }

    return { items: [], total: 0 };
};

const isInvalidPagePayload = (payload: unknown): payload is { detail: string; total?: unknown } => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const detail = (payload as Record<string, unknown>).detail;
    return detail === 'Invalid page.';
};

const hasKnownListArrays = (payload: unknown): boolean => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const source = payload as Record<string, unknown>;
    return Array.isArray(source.results) || Array.isArray(source.data) || Array.isArray(source.items);
};

const isAbortError = (error: unknown): error is { name: string } =>
    !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';

export const unwrapMyTravelsPayload = (
    payload: MyTravelsPayload | null | undefined
): { items: MyTravelsItem[]; total: number } => {
    if (!payload) return { items: [], total: 0 };
    if (Array.isArray(payload)) return { items: payload, total: payload.length };

    if (Array.isArray(payload.data)) {
        return {
            items: payload.data,
            total: coerceTotal(payload.total, coerceTotal(payload.count, payload.data.length)),
        };
    }
    if (Array.isArray(payload.results)) {
        return {
            items: payload.results,
            total: coerceTotal(payload.count, coerceTotal(payload.total, payload.results.length)),
        };
    }
    if (Array.isArray(payload.items)) {
        return {
            items: payload.items,
            total: coerceTotal(payload.total, coerceTotal(payload.count, payload.items.length)),
        };
    }

    return { items: [], total: coerceTotal(payload.total, coerceTotal(payload.count, 0)) };
};

const applyPublishModeration = (
    target: Record<string, unknown>,
    source: Record<string, unknown> | undefined | null,
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
    urlParams: Record<string, unknown>,
    options?: { signal?: AbortSignal }
) => {
    try {
        const whereObject: Record<string, unknown> = {};

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
            total?: unknown;
            results?: Travel[];
            count?: unknown;
            detail?: string;
        } | Travel[]>(res, []);

        if (!res.ok) {
            if (isInvalidPagePayload(result)) {
                devError('Invalid page requested:', page + 1);
                return { data: [], total: 0 };
            }
            devError('Error fetching Travels: HTTP', res.status, res.statusText);
            return { data: [], total: 0 };
        }

        const { items, total } = unwrapTravelsList(result);

        if (isInvalidPagePayload(result)) {
            devError('Invalid page in response:', page + 1);
            return { data: [], total: coerceTotal(result.total, total) };
        }

        if (items.length === 0 && result && typeof result === 'object' && !Array.isArray(result)) {
            // Empty list is a valid response; warn only if the structure is truly unknown.
            if (!hasKnownListArrays(result) && __DEV__) {
                devWarn('API returned unexpected structure:', result);
            }

            return { data: [], total: coerceTotal((result as Record<string, unknown>).total, 0) };
        }

        return {
            data: filterPublished(items.map(normalizeTravelItem)),
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
    urlParams: Record<string, unknown>,
    options?: { signal?: AbortSignal }
) => {
    try {
        const whereObject: Record<string, unknown> = {};

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
            total?: unknown;
            results?: Travel[];
            count?: unknown;
            detail?: string;
        } | Travel[]>(res, []);

        if (!res.ok) {
            if (isInvalidPagePayload(result)) {
                devError('Invalid random page requested:', page + 1);
                return { data: [], total: 0 };
            }
            devError('Error fetching Random Travels: HTTP', res.status, res.statusText);
            return { data: [], total: 0 };
        }

        if (Array.isArray(result)) {
            const data = filterPublished(result.map(normalizeTravelItem));
            return { data, total: data.length };
        }

        const { items, total } = unwrapTravelsList(result);

        if (isInvalidPagePayload(result)) {
            devError('Invalid random page in response:', page + 1);
            return { data: [], total: coerceTotal(result.total, 0) };
        }

        if (items.length === 0 && result && typeof result === 'object' && !Array.isArray(result)) {
            // Empty list is a valid response; warn only if the structure is truly unknown.
            if (!hasKnownListArrays(result) && __DEV__) {
                devWarn('API returned unexpected random structure:', result);
            }

            return { data: [], total: coerceTotal((result as Record<string, unknown>).total, 0) };
        }

        return {
            data: filterPublished(items.map(normalizeTravelItem)),
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
    } catch (e: unknown) {
        if (isAbortError(e)) {
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
    } catch (e: unknown) {
        if (isAbortError(e)) {
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
}): Promise<MyTravelsPayload> => {
    type MyTravelsYearRange = {
        gte?: string;
        lte?: string;
    };

    type MyTravelsWhere = {
        user_id: string | number;
        publish?: number;
        moderation?: number;
        countries?: string[];
        year?: MyTravelsYearRange;
        hasGallery?: true;
    };

    try {
        const whereObject: MyTravelsWhere = {
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
        return await safeJsonParse<MyTravelsPayload>(res, {});
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

export const deleteTravel = async (travelId: string | number): Promise<null> => {
    return apiClient.delete<null>(`/travels/${travelId}/`);
};
