import { Travel } from '@/types/types';
import { devError, devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { retry, isRetryableError } from '@/utils/retry';
import { getSecureItem } from '@/utils/secureStorage';
import { normalizeTravelItem } from './travelsNormalize';
import {
    LONG_TIMEOUT,
    TOKEN_KEY,
    GET_TRAVELS,
    GET_RANDOM_TRAVELS,
    GET_TRAVEL_FACETS,
    filterPublished,
    coerceTotal,
    normalizeNumericFilterArray,
    extractSortQueryParams,
    buildWhereQueryParams,
    unwrapTravelsList,
    isInvalidPagePayload,
    hasKnownListArrays,
    isAbortError,
    applyPublishModeration,
} from './travelQueryShared';

export type TravelFacetItem = {
    id: string | number;
    name: string;
    count: number;
};

export type TravelFacetsResponse = {
    total: number;
    facets: Record<string, TravelFacetItem[]>;
};

const createTravelQueryError = (message: string, status?: number) => {
    const error = new Error(message) as Error & { status?: number };
    if (typeof status === 'number') {
        error.status = status;
    }
    return error;
};

export const fetchTravelFacets = async (
    search: string,
    urlParams: Record<string, unknown>,
    options?: { signal?: AbortSignal; suppressErrors?: boolean }
): Promise<TravelFacetsResponse> => {
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
            applyPublishModeration(whereObject, urlParams, { publish: 1, moderation: 1 });
        }

        const arrayFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
        arrayFields.forEach((field) => {
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

        const handledKeys = new Set<string>([
            ...arrayFields, 'year', 'moderation', 'publish', 'sort', 'sortBy', 'sortOrder', 'ordering',
        ]);
        Object.entries(urlParams || {}).forEach(([key, value]) => {
            if (handledKeys.has(key)) return;
            if (value === undefined || value === null || value === '') return;
            if (Array.isArray(value) && value.length === 0) return;
            whereObject[key] = value;
        });

        const searchParams: Record<string, string> = {
            where: JSON.stringify(whereObject),
        };
        if (search !== undefined) {
            searchParams.query = search || '';
        }

        const url = `${GET_TRAVEL_FACETS}?${new URLSearchParams(searchParams).toString()}`;

        const res = options?.signal
            ? await fetchWithTimeout(url, { signal: options.signal }, LONG_TIMEOUT)
            : await retry(
                async () => await fetchWithTimeout(url, {}, LONG_TIMEOUT),
                { maxAttempts: 2, delay: 1000, shouldRetry: (error) => isRetryableError(error) }
            );

        const payload = await safeJsonParse<Record<string, unknown>>(res, {});
        if (!res.ok) {
            if (!options?.suppressErrors) {
                devError('Error fetching travel facets: HTTP', res.status, res.statusText);
            }
            return { total: 0, facets: {} };
        }

        const total = coerceTotal(payload?.total, 0);
        const rawFacets = payload?.facets;
        if (!rawFacets || typeof rawFacets !== 'object' || Array.isArray(rawFacets)) {
            return { total, facets: {} };
        }

        const facets = Object.entries(rawFacets as Record<string, unknown>).reduce<Record<string, TravelFacetItem[]>>(
            (acc, [facetKey, facetValue]) => {
                if (!Array.isArray(facetValue)) return acc;

                acc[facetKey] = facetValue
                    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
                    .map((item) => ({
                        id: typeof item.id === 'number' || typeof item.id === 'string' ? item.id : String(item.id ?? ''),
                        name: typeof item.name === 'string' ? item.name : String(item.name ?? ''),
                        count: coerceTotal(item.count, 0),
                    }))
                    .filter((item) => item.name.trim().length > 0);

                return acc;
            },
            {}
        );

        return { total, facets };
    } catch (e) {
        if (isAbortError(e)) throw e;
        if (!options?.suppressErrors) {
            devError('Error fetching travel facets:', e);
        }
        return { total: 0, facets: {} };
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
        const sortQuery = extractSortQueryParams(urlParams || {});

        const isUserScoped = urlParams?.user_id !== undefined && urlParams?.user_id !== null;
        const allowDrafts =
            isUserScoped &&
            urlParams?.publish === undefined &&
            urlParams?.moderation === undefined;

        if (isUserScoped) {
            if (urlParams?.moderation !== undefined) whereObject.moderation = urlParams.moderation;
            if (urlParams?.publish !== undefined) whereObject.publish = urlParams.publish;
        } else {
            applyPublishModeration(whereObject, urlParams, { publish: 1, moderation: 1 });
        }

        const arrayFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
        arrayFields.forEach((field) => {
            if (urlParams[field]) {
                const normalized = normalizeNumericFilterArray(urlParams[field]);
                if (normalized.length > 0) whereObject[field] = normalized;
            }
        });

        if (urlParams?.year !== undefined && urlParams?.year !== null) {
            const yearStr = String(urlParams.year).trim();
            if (yearStr !== '') whereObject.year = yearStr;
        }

        const handledKeys = new Set<string>([
            ...arrayFields, 'year', 'moderation', 'publish', 'sort', 'sortBy', 'sortOrder', 'ordering',
        ]);
        Object.entries(urlParams || {}).forEach(([key, value]) => {
            if (handledKeys.has(key)) return;
            if (value === undefined || value === null || value === '') return;
            if (Array.isArray(value) && value.length === 0) return;
            whereObject[key] = value;
        });

        const params = buildWhereQueryParams({ page, perPage: itemsPerPage, query: search, where: whereObject, sortQuery });
        const urlTravel = `${GET_TRAVELS}?${params}`;

        const authToken = allowDrafts ? await getSecureItem(TOKEN_KEY) : null;
        const canIncludeDrafts = allowDrafts && !!authToken;
        const baseInit: RequestInit = {
            ...(authToken ? { headers: { Authorization: `Token ${authToken}` } } : {}),
            ...(options?.signal ? { signal: options.signal } : {}),
        };

        const res = options?.signal
            ? await fetchWithTimeout(urlTravel, baseInit, LONG_TIMEOUT)
            : await retry(
                async () => fetchWithTimeout(urlTravel, baseInit, LONG_TIMEOUT),
                { maxAttempts: 2, delay: 1000, shouldRetry: (error) => isRetryableError(error) }
            );

        const parseFallback: Travel[] = [];
        const result = await safeJsonParse<{
            data?: Travel[];
            total?: unknown;
            results?: Travel[];
            count?: unknown;
            detail?: string;
        } | Travel[]>(res, parseFallback as Travel[]);

        if (!res.ok) {
            if (isInvalidPagePayload(result)) {
                devError('Invalid page requested:', page + 1);
                return { data: [], total: 0 };
            }
            throw createTravelQueryError(
                `Не удалось загрузить путешествия: ${res.status} ${res.statusText || 'Unknown error'}`.trim(),
                res.status
            );
        }

        if (result === parseFallback) {
            throw createTravelQueryError('API путешествий вернул непарсируемый ответ.');
        }

        const { items, total } = unwrapTravelsList(result);

        if (isInvalidPagePayload(result)) {
            devError('Invalid page in response:', page + 1);
            return { data: [], total: coerceTotal(result.total, total) };
        }

        if (!Array.isArray(result) && !hasKnownListArrays(result)) {
            if (__DEV__) {
                devWarn('API returned unexpected structure:', result);
            }
            throw createTravelQueryError('API путешествий вернул неожиданный формат данных.');
        }

        const normalized = items.map(normalizeTravelItem);
        return {
            data: canIncludeDrafts ? normalized : filterPublished(normalized),
            total: coerceTotal(total, 0),
        };
    } catch (e) {
        if (isAbortError(e)) throw e;
        devError('Error fetching Travels:', e);
        throw e;
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
        const sortQuery = extractSortQueryParams(urlParams || {});

        applyPublishModeration(whereObject, urlParams, { publish: 1, moderation: 1 });

        const arrayFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
        arrayFields.forEach((field) => {
            if (urlParams[field] && Array.isArray(urlParams[field])) {
                const normalized = normalizeNumericFilterArray(urlParams[field]);
                if (normalized.length > 0) whereObject[field] = normalized;
            }
        });

        if (urlParams?.year !== undefined && urlParams?.year !== null) {
            const yearStr = String(urlParams.year).trim();
            if (yearStr !== '') whereObject.year = yearStr;
        }

        whereObject.moderation = 1;
        whereObject.publish = 1;

        const params = buildWhereQueryParams({ page, perPage: itemsPerPage, where: whereObject, query: search, sortQuery });
        const urlTravel = `${GET_RANDOM_TRAVELS}?${params}`;

        const res = options?.signal
            ? await fetchWithTimeout(urlTravel, { signal: options.signal }, LONG_TIMEOUT)
            : await retry(
                async () => fetchWithTimeout(urlTravel, {}, LONG_TIMEOUT),
                { maxAttempts: 2, delay: 1000, shouldRetry: (error) => isRetryableError(error) }
            );

        const parseFallback: Travel[] = [];
        const result = await safeJsonParse<{
            data?: Travel[];
            total?: unknown;
            results?: Travel[];
            count?: unknown;
            detail?: string;
        } | Travel[]>(res, parseFallback as Travel[]);

        if (!res.ok) {
            if (isInvalidPagePayload(result)) {
                devError('Invalid random page requested:', page + 1);
                return { data: [], total: 0 };
            }
            throw createTravelQueryError(
                `Не удалось загрузить случайные путешествия: ${res.status} ${res.statusText || 'Unknown error'}`.trim(),
                res.status
            );
        }

        if (result === parseFallback) {
            throw createTravelQueryError('API случайных путешествий вернул непарсируемый ответ.');
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

        if (!Array.isArray(result) && !hasKnownListArrays(result)) {
            if (__DEV__) {
                devWarn('API returned unexpected random structure:', result);
            }
            throw createTravelQueryError('API случайных путешествий вернул неожиданный формат данных.');
        }

        return {
            data: filterPublished(items.map(normalizeTravelItem)),
            total: coerceTotal(total, 0),
        };
    } catch (e) {
        if (isAbortError(e)) throw e;
        devError('Error fetching Random Travels:', e);
        throw e;
    }
};
