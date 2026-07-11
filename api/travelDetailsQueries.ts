import { Travel } from '@/types/types';
import { apiClient } from '@/api/client';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { devError, devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { getSecureItem } from '@/utils/secureStorage';
import {
    getPublicStalePayloadMeta,
    isRecoverablePublicStaleError,
    markPublicStalePayload,
    readPublicStalePayload,
    savePublicStalePayload,
} from '@/utils/publicStaleCache';
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

type PublicTravelRequestOptions = { signal?: AbortSignal; skipAuth?: boolean };
type FetchTravelOptions = { signal?: AbortSignal; forceRefresh?: boolean };

type ResolveTravelSlugResponse = {
    id?: unknown;
    slug?: unknown;
    url?: unknown;
    canonical_url?: unknown;
    status?: unknown;
    item?: unknown;
};

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
    const hasName = typeof travel.name === 'string' && travel.name.trim().length > 0;
    return hasAnyTravelIdentity(travel) && hasName;
};

// Lighter check than hasMinimumTravelIdentity: a payload with an id or slug is a
// real travel even if minimal; a 301-followed HTML page parses into `{}` and fails.
const hasAnyTravelIdentity = (travel: Travel | undefined): boolean => {
    if (!travel) return false;
    return (
        (typeof travel.id === 'number' && Number.isFinite(travel.id) && travel.id > 0) ||
        (typeof travel.slug === 'string' && travel.slug.trim().length > 0)
    );
};

// The resolve-slug `item` may be a lightweight card payload (rich_text/points/media
// only, without description/travelAddress/coordsMeTravel/countries). Returning it as
// the detail loses the article body and the route map on SPA navigation. Card payloads
// are recognized by `points` replacing the legacy route arrays; an item with a legacy
// description and no card markers is a full detail even without route arrays.
const hasFullTravelDetailPayload = (travel: Travel | undefined): boolean => {
    if (!travel) return false;
    const t = travel as Record<string, unknown>;
    if (typeof t.description !== 'string' || t.description.length === 0) {
        return false;
    }
    const hasRouteFields =
        Array.isArray(t.travelAddress) || Array.isArray(t.coordsMeTravel);
    const looksLikeCardPayload = Array.isArray(t.points) && !hasRouteFields;
    return !looksLikeCardPayload;
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

const readStaleTravelDetail = async (endpoint: string): Promise<Travel | null> => {
    const stale = await readPublicStalePayload<Travel>(endpoint);
    if (!stale) return null;
    const meta = getPublicStalePayloadMeta(stale);
    const normalized = normalizeTravelItem(stale);
    return meta ? markPublicStalePayload(normalized, meta) : normalized;
};

const saveStaleTravelDetail = async (endpoint: string, travel: Travel): Promise<void> => {
    await savePublicStalePayload(endpoint, travel, { method: 'GET' });
};

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

const buildAdjacentTranspositionVariants = (token: string): string[] => {
    if (token.length < 4 || token.length > 32) return [];

    const variants: string[] = [];
    for (let index = 0; index < token.length - 1; index += 1) {
        const left = token[index];
        const right = token[index + 1];
        if (left === right) continue;

        variants.push(`${token.slice(0, index)}${right}${left}${token.slice(index + 2)}`);
    }
    return variants;
};

const longestCommonSubsequenceLength = (left: string, right: string): number => {
    if (!left || !right) return 0;

    const previous = new Array(right.length + 1).fill(0);
    const current = new Array(right.length + 1).fill(0);

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            current[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
                ? previous[rightIndex - 1] + 1
                : Math.max(previous[rightIndex], current[rightIndex - 1]);
        }
        for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
            previous[rightIndex] = current[rightIndex];
            current[rightIndex] = 0;
        }
    }

    return previous[right.length];
};

const scoreTokenSimilarity = (requestedToken: string, candidateToken: string): number => {
    if (requestedToken === candidateToken) return 1;
    if (!requestedToken || !candidateToken) return 0;

    const maxLength = Math.max(requestedToken.length, candidateToken.length);
    if (maxLength === 0) return 0;

    return longestCommonSubsequenceLength(requestedToken, candidateToken) / maxLength;
};

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
    const transposedPrimaryTokens = primaryTokens.flatMap(buildAdjacentTranspositionVariants);

    const orderedQueries = [
        ...primaryTokens,
        ...transposedPrimaryTokens,
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

const buildSlugDirectFallbackSlugs = (slug: string): string[] => {
    const tokens = slugTokenize(slug).filter((token) => !/^\d+$/.test(token));
    if (!tokens.length) return [];
    if (tokens.length !== 1) return [];

    const requestedSlug = tokens.join('-');
    const variants: string[] = [];

    tokens.forEach((token, tokenIndex) => {
        if (SLUG_FALLBACK_STOPWORDS.has(token)) return;
        buildAdjacentTranspositionVariants(token).forEach((variantToken) => {
            const candidateTokens = [...tokens];
            candidateTokens[tokenIndex] = variantToken;
            variants.push(candidateTokens.join('-'));
        });
    });

    return Array.from(new Set(variants))
        .filter((candidate) => candidate !== requestedSlug && candidate.length >= 3)
        .slice(0, 20);
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
    const fuzzyOverlapRatio =
        requested.reduce((acc, token) => {
            const bestTokenScore = candidate.reduce(
                (best, candidateToken) => Math.max(best, scoreTokenSimilarity(token, candidateToken)),
                0
            );
            return acc + (bestTokenScore >= 0.84 ? bestTokenScore : 0);
        }, 0) / requested.length;

    const firstTokenBonus = requested[0] === candidate[0] ? 0.2 : 0;
    const lastToken = requested[requested.length - 1];
    const tailBonus = candidateSet.has(lastToken) ? 0.1 : 0;
    const lengthPenalty = Math.max(0, candidate.length - requested.length) * 0.03;

    return Math.max(overlapRatio, fuzzyOverlapRatio) + firstTokenBonus + tailBonus - lengthPenalty;
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

// Canonical backend resolver for exact, redirected, and fuzzy travel slugs.
// It runs before legacy by-slug/fuzzy compatibility fallbacks and may return the
// full detail payload in `item`, avoiding a second detail request.
const fetchTravelByResolvedSlug = async (
    slug: string,
    options?: { signal?: AbortSignal }
): Promise<Travel | null> => {
    const response = await apiClient.get<ResolveTravelSlugResponse>(
        `/travels/resolve-slug/${encodeURIComponent(slug)}/`,
        LONG_TIMEOUT,
        { ...(options ?? {}), skipAuth: true }
    );

    let lightResolvedItem: Travel | null = null;
    if (response?.item) {
        const normalized = normalizeTravelItem(response.item as Travel);
        if (hasAnyTravelIdentity(normalized)) {
            if (hasFullTravelDetailPayload(normalized)) return normalized;
            lightResolvedItem = normalized;
        }
    }

    const detailLikeResponse = normalizeTravelItem(response as Travel);
    if (hasMinimumTravelIdentity(detailLikeResponse)) return detailLikeResponse;

    const id = Number(response?.id ?? lightResolvedItem?.id);
    if (!Number.isFinite(id) || id <= 0) return lightResolvedItem;

    const detailedTravel = await fetchTravel(id, options);
    const normalized = normalizeTravelItem(detailedTravel);
    if (!hasAnyTravelIdentity(normalized)) return null;

    if (__DEV__) {
        devWarn('Resolved travel via canonical slug resolver', {
            requestedSlug: slug,
            resolvedSlug: normalized.slug,
            id,
            status: response?.status,
        });
    }
    return normalized;
};

export const fetchTravel = async (
    id: number,
    options?: FetchTravelOptions
): Promise<Travel> => {
    const token = await getSecureItem(TOKEN_KEY);
    const isAuthenticated = Boolean(token);
    const cacheKey = `id:${id}`;

    if (!isAuthenticated && !options?.forceRefresh && travelCache.has(id)) {
        return travelCache.get(id) as Travel;
    }

    if (!isAuthenticated) {
        if (!options?.forceRefresh) {
            const preloaded = await waitForDirectApiWindowPreload(id, true);
            if (preloaded) {
                travelCache.set(id, preloaded);
                await saveStaleTravelDetail(`/travels/${id}/`, preloaded);
                return preloaded;
            }
        }

        const fetchFreshTravel = async () => {
            const endpoint = `/travels/${id}/`;
            try {
                const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, {
                    signal: options?.signal,
                    ...(options?.forceRefresh ? { skipAuth: true } : {}),
                });
                const normalized = normalizeTravelItem(travel);
                travelCache.set(id, normalized);
                if (typeof normalized.slug === 'string' && normalized.slug.trim()) {
                    travelSlugCache.set(getSlugCacheKey(normalized.slug), normalized);
                }
                await saveStaleTravelDetail(endpoint, normalized);
                return normalized;
            } catch (e: unknown) {
                if (isAbortError(e)) throw e;
                if (isRecoverablePublicStaleError(e)) {
                    const stale = await readStaleTravelDetail(endpoint);
                    if (stale) return stale;
                }
                devError('Error fetching Travel:', e);
                throw e;
            }
        };

        // Static travel HTML intentionally provides an instant first-paint snapshot.
        // A post-hydration refresh must bypass both that preload and the in-memory
        // guest cache, otherwise recently edited captions/content stay invisible
        // until the next frontend deploy.
        if (options?.forceRefresh) return fetchFreshTravel();

        return runSharedGuestTravelRequest(cacheKey, fetchFreshTravel);
    }

    const endpoint = `/travels/${id}/`;
    try {
        const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, { signal: options?.signal });
        const normalized = normalizeTravelItem(travel);
        return normalized;
    } catch (e: unknown) {
        if (isAbortError(e)) throw e;
        // Public travel detail: recover from a stale/expired token by retrying without
        // auth instead of failing the whole page. The token is left untouched.
        if (getErrorStatus(e) === 401) {
            const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, {
                signal: options?.signal,
                skipAuth: true,
            });
            const normalized = normalizeTravelItem(travel);
            await saveStaleTravelDetail(endpoint, normalized);
            return normalized;
        }
        if (!isAuthenticated && isRecoverablePublicStaleError(e)) {
            const stale = await readStaleTravelDetail(endpoint);
            if (stale) return stale;
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

    const fetchBySlug = async (requestOptions?: PublicTravelRequestOptions) => {
        const safeSlug = encodeURIComponent(slugCacheKey);
        const endpoint = `/travels/by-slug/${safeSlug}/`;
        try {
            const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, requestOptions);
            const normalized = normalizeTravelItem(travel);
            if (!isAuthenticated || requestOptions?.skipAuth) {
                await saveStaleTravelDetail(endpoint, normalized);
            }
            return normalized;
        } catch (e: unknown) {
            // Travel detail is public. A 401 means the stored token is stale/expired
            // (or invalid for the current API backend). Retry once without auth so the
            // public page still loads instead of showing an error — keep the token intact.
            if (!isAbortError(e) && getErrorStatus(e) === 401) {
                const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, {
                    ...requestOptions,
                    skipAuth: true,
                });
                const normalized = normalizeTravelItem(travel);
                await saveStaleTravelDetail(endpoint, normalized);
                return normalized;
            }
            if (
                !isAbortError(e) &&
                (!isAuthenticated || requestOptions?.skipAuth) &&
                isRecoverablePublicStaleError(e)
            ) {
                const stale = await readStaleTravelDetail(endpoint);
                if (stale) return stale;
            }
            throw e;
        }
    };

    const fetchByDirectSlugVariant = async (requestOptions?: PublicTravelRequestOptions) => {
        const candidates = buildSlugDirectFallbackSlugs(slugCacheKey);
        for (const candidate of candidates) {
            try {
                const endpoint = `/travels/by-slug/${encodeURIComponent(candidate)}/`;
                const travel = await apiClient.get<Travel>(
                    endpoint,
                    LONG_TIMEOUT,
                    {
                        ...requestOptions,
                        skipAuth: true,
                    }
                );
                const normalized = normalizeTravelItem(travel);
                if (hasMinimumTravelIdentity(normalized)) {
                    await saveStaleTravelDetail(endpoint, normalized);
                    return normalized;
                }
            } catch (error: unknown) {
                if (isAbortError(error)) throw error;
            }
        }
        return null;
    };

    const fetchBySlugWithFallback = async (requestOptions?: PublicTravelRequestOptions) => {
        try {
            const resolvedTravel = await fetchTravelByResolvedSlug(slugCacheKey, requestOptions);
            if (resolvedTravel) return resolvedTravel;
        } catch (e: unknown) {
            if (isAbortError(e)) throw e;

            const status = getErrorStatus(e);
            if (status === 404) {
                try {
                    const legacyTravel = await fetchBySlug(requestOptions);
                    if (hasAnyTravelIdentity(legacyTravel)) return legacyTravel;
                } catch (legacyError: unknown) {
                    if (isAbortError(legacyError)) throw legacyError;
                }
                const notFoundError = Object.assign(
                    new Error(`Travel not found by slug: ${slug}`),
                    { status: 404 }
                );
                devError('Error fetching Travel by slug:', notFoundError);
                throw notFoundError;
            }

            if (!shouldUseSlugFallback(status)) {
                devError('Error fetching Travel by slug:', e);
                throw e;
            }
        }

        let bySlugError: unknown = null;
        try {
            const travel = await fetchBySlug(requestOptions);
            // Legacy compatibility path after a resolver API failure: if /by-slug/
            // returns a sparse/HTML-followed payload, treat it as a miss and continue
            // to the old fuzzy compatibility fallback.
            if (hasAnyTravelIdentity(travel)) {
                return travel;
            }
        } catch (e: unknown) {
            if (isAbortError(e)) throw e;

            const status = getErrorStatus(e);
            if (!shouldUseSlugFallback(status)) {
                devError('Error fetching Travel by slug:', e);
                throw e;
            }
            bySlugError = e;
        }

        const directVariantTravel = await fetchByDirectSlugVariant(requestOptions);
        if (directVariantTravel) {
            if (__DEV__) {
                devWarn('Resolved travel by direct slug variant fallback', {
                    requestedSlug: slug,
                    resolvedSlug: directVariantTravel.slug,
                    id: directVariantTravel.id,
                });
            }
            return directVariantTravel;
        }

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

        const finalError = bySlugError ?? Object.assign(
            new Error(`Travel not found by slug: ${slug}`),
            { status: 404 }
        );
        devError('Error fetching Travel by slug:', finalError);
        throw finalError;
    };

    if (!isAuthenticated) {
        const preloaded = await waitForDirectApiWindowPreload(slugCacheKey, false);
        if (preloaded) {
            travelSlugCache.set(slugCacheKey, preloaded);
            if (typeof preloaded.id === 'number' && Number.isFinite(preloaded.id) && preloaded.id > 0) {
                travelCache.set(preloaded.id, preloaded);
            }
            await saveStaleTravelDetail(`/travels/by-slug/${encodeURIComponent(slugCacheKey)}/`, preloaded);
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
