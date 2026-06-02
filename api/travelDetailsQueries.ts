import { Travel } from '@/types/types';
import { apiClient } from '@/api/client';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { devError, devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { getSecureItem } from '@/utils/secureStorage';
import { normalizeTravelItem } from './travelsNormalize';
import {
    LONG_TIMEOUT,
    TOKEN_KEY,
    GET_TRAVELS,
    filterPublished,
    unwrapTravelsList,
    isAbortError,
} from './travelQueryShared';

const travelCache = new Map<number, Travel>();
const travelSlugCache = new Map<string, Travel>();
const travelInFlight = new Map<string, Promise<Travel>>();

type TravelPreloadWindow = Window & typeof globalThis & {
    __metravelTravelPreload?: {
        data?: unknown;
        slug?: string;
        isId?: boolean;
        source?: string;
    };
    __metravelTravelPreloadPending?: boolean;
    __metravelTravelPreloadPromise?: Promise<unknown>;
};

const getSlugCacheKey = (slug: string): string =>
    String(slug || '').replace(/^\/+/, '').trim();

const runSharedGuestTravelRequest = async (
    key: string,
    request: () => Promise<Travel>
): Promise<Travel> => {
    const existing = travelInFlight.get(key);
    if (existing) return existing;

    const pending = request().finally(() => {
        travelInFlight.delete(key);
    });
    travelInFlight.set(key, pending);
    return pending;
};

const hasMinimumTravelIdentity = (travel: Travel | undefined): travel is Travel => {
    if (!travel) return false;
    const hasIdentity =
        (typeof travel.id === 'number' && Number.isFinite(travel.id) && travel.id > 0) ||
        (typeof travel.slug === 'string' && travel.slug.trim().length > 0);
    const hasName = typeof travel.name === 'string' && travel.name.trim().length > 0;
    return hasIdentity && hasName;
};

const consumeDirectApiWindowPreload = (
    key: string | number,
    isId: boolean
): Travel | undefined => {
    if (typeof window === 'undefined') return undefined;
    const win = window as TravelPreloadWindow;
    const preload = win.__metravelTravelPreload;
    if (preload?.source !== 'direct-api' || !preload.data) return undefined;

    const matches = isId
        ? preload.isId && String(preload.slug) === String(key)
        : !preload.isId && getSlugCacheKey(String(preload.slug || '')) === String(key);
    if (!matches) return undefined;

    try {
        const normalized = normalizeTravelItem(preload.data);
        if (!hasMinimumTravelIdentity(normalized)) return undefined;
        return normalized;
    } catch {
        return undefined;
    }
};

const waitForDirectApiWindowPreload = async (
    key: string | number,
    isId: boolean
): Promise<Travel | undefined> => {
    if (typeof window === 'undefined') return undefined;
    const immediate = consumeDirectApiWindowPreload(key, isId);
    if (immediate) return immediate;

    const win = window as TravelPreloadWindow;
    if (!win.__metravelTravelPreloadPending && !win.__metravelTravelPreloadPromise) return undefined;

    try {
        await Promise.race([
            win.__metravelTravelPreloadPromise ?? Promise.resolve(),
            new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);
    } catch {
        // noop
    }

    return consumeDirectApiWindowPreload(key, isId);
};

const getErrorStatus = (error: unknown): number | null => {
    if (!error || typeof error !== 'object') return null;
    const rawStatus =
        (error as { status?: unknown }).status ??
        ((error as { response?: { status?: unknown } }).response?.status);
    const status = Number(rawStatus);
    return Number.isFinite(status) ? status : null;
};

const shouldUseSlugFallback = (status: number | null): boolean =>
    status === 404 || (status !== null && status >= 500 && status < 600);
const SLUG_FALLBACK_TIMEOUT_MS = 4_000;

const slugTokenize = (value: string): string[] =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .split('-')
        .map((part) => part.trim())
        .filter(Boolean);

const simplifySlugToken = (token: string): string =>
    token
        .replace(/kh/g, 'h')
        .replace(/ii/g, 'i')
        .replace(/yi/g, 'i');

const SLUG_FALLBACK_STOPWORDS = new Set([
    'a', 'i', 'iz', 'k', 'na', 'o', 'odna', 'odin', 'odno',
    'odnoi', 'odnoy', 'po', 's', 'v', 'vershin',
]);
const STRONG_SLUG_FALLBACK_SCORE = 1.0;

const buildSlugFallbackQueries = (slug: string): string[] => {
    const tokens = slugTokenize(slug).filter((token) => !/^\d+$/.test(token));
    if (tokens.length === 0) return [];

    const full = tokens.join(' ');
    const shortened = tokens.slice(0, Math.min(tokens.length, 6)).join(' ');
    const boundary =
        tokens.length >= 4
            ? [tokens[0], tokens[1], tokens[tokens.length - 2], tokens[tokens.length - 1]].join(' ')
            : '';
    const simplified = tokens.map(simplifySlugToken).join(' ');
    const firstToken = tokens[0];
    const firstTwo = tokens.slice(0, 2).join(' ');
    const firstThree = tokens.slice(0, 3).join(' ');
    const compact = tokens.length >= 2 ? [tokens[0], tokens[tokens.length - 1]].join(' ') : '';

    const meaningfulTokens = tokens.filter(
        (token) => token.length >= 4 && !SLUG_FALLBACK_STOPWORDS.has(token)
    );
    const primaryTokens = meaningfulTokens.slice(0, 4);
    const simplifiedPrimaryTokens = primaryTokens
        .map(simplifySlugToken)
        .filter((token) => token.length >= 3);

    const orderedQueries = [
        ...primaryTokens,
        ...simplifiedPrimaryTokens,
        firstToken,
        full,
        shortened,
        boundary,
        simplified,
        firstThree,
        firstTwo,
        compact,
    ];

    return Array.from(new Set(orderedQueries.map((q) => q.trim()).filter(Boolean)));
};

const scoreSlugSimilarity = (requestedSlug: string, candidateSlug: string): number => {
    const requested = slugTokenize(requestedSlug)
        .map(simplifySlugToken)
        .filter((token) => !/^\d+$/.test(token));
    const candidate = slugTokenize(candidateSlug)
        .map(simplifySlugToken)
        .filter((token) => !/^\d+$/.test(token));
    if (!requested.length || !candidate.length) return 0;

    const candidateSet = new Set(candidate);
    const overlap = requested.reduce((acc, token) => (candidateSet.has(token) ? acc + 1 : acc), 0);
    const overlapRatio = overlap / requested.length;

    const firstTokenBonus = requested[0] === candidate[0] ? 0.2 : 0;
    const lastToken = requested[requested.length - 1];
    const tailBonus = candidateSet.has(lastToken) ? 0.1 : 0;
    const lengthPenalty = Math.max(0, candidate.length - requested.length) * 0.03;

    return overlapRatio + firstTokenBonus + tailBonus - lengthPenalty;
};

const fetchFallbackTravelCandidates = async (
    query: string,
    page: number,
    options?: { signal?: AbortSignal }
): Promise<Travel[]> => {
    const params = new URLSearchParams({
        page: String(page),
        perPage: '50',
    });
    if (query) {
        params.set('query', query);
    }

    const urlTravel = `${GET_TRAVELS}?${params.toString()}`;
    const res = await fetchWithTimeout(
        urlTravel,
        options?.signal ? { signal: options.signal } : {},
        LONG_TIMEOUT
    );
    if (!res.ok) return [];

    const result = await safeJsonParse<{
        data?: Travel[];
        total?: unknown;
        results?: Travel[];
        count?: unknown;
    } | Travel[]>(res, []);
    const { items } = unwrapTravelsList(result);
    if (!items.length) return [];

    return filterPublished(items.map(normalizeTravelItem));
};

const findTravelBySlugFallback = async (
    slug: string,
    options?: { signal?: AbortSignal }
): Promise<Travel | null> => {
    const queries = buildSlugFallbackQueries(slug);
    const scanQueries = Array.from(new Set([...queries, '']));

    let bestMatch: Travel | null = null;
    let bestScore = 0;

    for (const query of scanQueries) {
        const queryWordCount = query.trim() ? query.trim().split(/\s+/).length : 0;
        const maxPages = queryWordCount <= 1 ? 5 : 3;

        for (let page = 1; page <= maxPages; page += 1) {
            const candidates = await fetchFallbackTravelCandidates(query, page, options);
            if (!candidates.length) break;

            for (const item of candidates) {
                const candidateSlug = typeof item?.slug === 'string' ? item.slug.trim() : '';
                if (!candidateSlug) continue;

                const score = scoreSlugSimilarity(slug, candidateSlug);
                if (score < 0.72) continue;

                if (!bestMatch || score > bestScore) {
                    bestMatch = item;
                    bestScore = score;
                }
            }

            if (bestMatch && bestScore >= STRONG_SLUG_FALLBACK_SCORE) {
                return bestMatch;
            }
        }
    }

    return bestMatch;
};

const findTravelBySlugFallbackWithDeadline = async (
    slug: string,
    options?: { signal?: AbortSignal }
): Promise<Travel | null> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            findTravelBySlugFallback(slug, options),
            new Promise<null>((resolve) => {
                timeoutId = setTimeout(() => resolve(null), SLUG_FALLBACK_TIMEOUT_MS);
            }),
        ]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

export const fetchTravel = async (
    id: number,
    options?: { signal?: AbortSignal }
): Promise<Travel> => {
    const token = await getSecureItem(TOKEN_KEY);
    const isAuthenticated = Boolean(token);
    const cacheKey = `id:${id}`;

    if (!isAuthenticated && travelCache.has(id)) {
        return travelCache.get(id) as Travel;
    }

    if (!isAuthenticated) {
        const preloaded = await waitForDirectApiWindowPreload(id, true);
        if (preloaded) {
            travelCache.set(id, preloaded);
            return preloaded;
        }

        return runSharedGuestTravelRequest(cacheKey, async () => {
            try {
                const travel = await apiClient.get<Travel>(`/travels/${id}/`, LONG_TIMEOUT);
                const normalized = normalizeTravelItem(travel);
                travelCache.set(id, normalized);
                return normalized;
            } catch (e: unknown) {
                if (isAbortError(e)) throw e;
                devError('Error fetching Travel:', e);
                throw e;
            }
        });
    }

    try {
        const travel = await apiClient.get<Travel>(`/travels/${id}/`, LONG_TIMEOUT, { signal: options?.signal });
        const normalized = normalizeTravelItem(travel);
        return normalized;
    } catch (e: unknown) {
        if (isAbortError(e)) throw e;
        // Public travel detail: recover from a stale/expired token by retrying without
        // auth instead of failing the whole page. The token is left untouched.
        if (getErrorStatus(e) === 401) {
            const travel = await apiClient.get<Travel>(`/travels/${id}/`, LONG_TIMEOUT, {
                signal: options?.signal,
                skipAuth: true,
            });
            return normalizeTravelItem(travel);
        }
        devError('Error fetching Travel:', e);
        throw e;
    }
};

export const fetchTravelBySlug = async (
    slug: string,
    options?: { signal?: AbortSignal }
): Promise<Travel> => {
    const token = await getSecureItem(TOKEN_KEY);
    const isAuthenticated = Boolean(token);
    const slugCacheKey = getSlugCacheKey(slug);
    const cacheKey = `slug:${slugCacheKey}`;

    if (!isAuthenticated && travelSlugCache.has(slugCacheKey)) {
        return travelSlugCache.get(slugCacheKey) as Travel;
    }

    const fetchBySlug = async (requestOptions?: { signal?: AbortSignal }) => {
        const safeSlug = encodeURIComponent(slugCacheKey);
        const endpoint = `/travels/by-slug/${safeSlug}/`;
        try {
            const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, requestOptions);
            return normalizeTravelItem(travel);
        } catch (e: unknown) {
            // Travel detail is public. A 401 means the stored token is stale/expired
            // (or invalid for the current API backend). Retry once without auth so the
            // public page still loads instead of showing an error — keep the token intact.
            if (!isAbortError(e) && getErrorStatus(e) === 401) {
                const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, {
                    ...requestOptions,
                    skipAuth: true,
                });
                return normalizeTravelItem(travel);
            }
            throw e;
        }
    };

    const fetchBySlugWithFallback = async (requestOptions?: { signal?: AbortSignal }) => {
        try {
            return await fetchBySlug(requestOptions);
        } catch (e: unknown) {
            if (isAbortError(e)) throw e;

            const status = getErrorStatus(e);
            if (shouldUseSlugFallback(status)) {
                const fallbackTravel = await findTravelBySlugFallbackWithDeadline(slug, requestOptions);
                if (fallbackTravel) {
                    const fallbackTravelId = Number(fallbackTravel.id);
                    if (Number.isFinite(fallbackTravelId) && fallbackTravelId > 0) {
                        const detailedTravel = await fetchTravel(fallbackTravelId, requestOptions);
                        if (__DEV__) {
                            devWarn('Resolved travel by slug fallback via detail fetch', {
                                requestedSlug: slug,
                                resolvedSlug: fallbackTravel.slug,
                                id: fallbackTravelId,
                            });
                        }
                        return normalizeTravelItem(detailedTravel);
                    }
                    if (__DEV__) {
                        devWarn('Resolved travel by slug fallback', {
                            requestedSlug: slug,
                            resolvedSlug: fallbackTravel.slug,
                            id: fallbackTravel.id,
                        });
                    }
                    return normalizeTravelItem(fallbackTravel);
                }
            }

            devError('Error fetching Travel by slug:', e);
            throw e;
        }
    };

    if (!isAuthenticated) {
        const preloaded = await waitForDirectApiWindowPreload(slugCacheKey, false);
        if (preloaded) {
            travelSlugCache.set(slugCacheKey, preloaded);
            if (typeof preloaded.id === 'number' && Number.isFinite(preloaded.id) && preloaded.id > 0) {
                travelCache.set(preloaded.id, preloaded);
            }
            return preloaded;
        }

        return runSharedGuestTravelRequest(cacheKey, async () => {
            const normalized = await fetchBySlugWithFallback();
            travelSlugCache.set(slugCacheKey, normalized);
            if (typeof normalized.id === 'number' && Number.isFinite(normalized.id) && normalized.id > 0) {
                travelCache.set(normalized.id, normalized);
            }
            return normalized;
        });
    }

    return fetchBySlugWithFallback({ signal: options?.signal });
};
