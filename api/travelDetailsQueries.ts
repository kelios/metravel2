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

            if (bestMatch && bestScore >= 1.1) {
                return bestMatch;
            }
        }
    }

    return bestMatch;
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
        if (isAbortError(e)) throw e;
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
        if (isAbortError(e)) throw e;

        const status = getErrorStatus(e);
        if (shouldUseSlugFallback(status)) {
            const fallbackTravel = await findTravelBySlugFallback(slug, options);
            if (fallbackTravel) {
                const fallbackTravelId = Number(fallbackTravel.id);
                if (Number.isFinite(fallbackTravelId) && fallbackTravelId > 0) {
                    const detailedTravel = await fetchTravel(fallbackTravelId, options);
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
