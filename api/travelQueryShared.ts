import { Platform } from 'react-native';
import { Travel } from '@/types/types';

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
        : (Platform.OS === 'web' && isWebLocalHost && webOriginApi
            ? webOriginApi
            : (envApiUrl
                ? envApiUrl
                : (Platform.OS === 'web' && (isE2E || isLocalApi) && webOriginApi
                    ? webOriginApi
                    : '')));

if (!rawApiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

const URLAPI = (() => {
    const trimmed = rawApiUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

export const LONG_TIMEOUT = 30000;
export const TOKEN_KEY = 'userToken';
export const GET_TRAVELS = `${URLAPI}/travels/`;
export const GET_RANDOM_TRAVELS = `${URLAPI}/travels/random/`;
export const GET_TRAVEL_FACETS = `${URLAPI}/travels/facets/`;

export const filterPublished = (items: Travel[]): Travel[] =>
    items.filter((t) => {
        const withStatus = t as Travel & { publish?: unknown; moderation?: unknown };
        const pub = withStatus.publish;
        const mod = withStatus.moderation;
        const pubOk = pub === undefined || pub === null || pub === true || pub === 1 || pub === '1';
        const modOk = mod === undefined || mod === null || mod === true || mod === 1 || mod === '1';
        return pubOk && modOk;
    });

export const coerceTotal = (value: unknown, fallback = 0): number => {
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

export const normalizeNumericFilterArray = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    return value
        .map((val: unknown) => toFiniteNumber(val))
        .filter((val): val is number => val !== null);
};

export type TravelSortQueryParams = {
    ordering?: string;
    sort?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
};

const normalizeStringParam = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};

export const extractSortQueryParams = (source: Record<string, unknown>): TravelSortQueryParams => {
    const sortOrderRaw = normalizeStringParam(source.sortOrder);
    const sortOrder = sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : undefined;
    return {
        ordering: normalizeStringParam(source.ordering),
        sort: normalizeStringParam(source.sort),
        sortBy: normalizeStringParam(source.sortBy),
        sortOrder,
    };
};

export const buildWhereQueryParams = (params: {
    page?: number;
    perPage?: number;
    query?: string;
    where: Record<string, unknown>;
    sortQuery?: TravelSortQueryParams;
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
    if (params.sortQuery?.ordering) {
        searchParams.ordering = params.sortQuery.ordering;
    }
    if (params.sortQuery?.sort) {
        searchParams.sort = params.sortQuery.sort;
    }
    if (params.sortQuery?.sortBy) {
        searchParams.sortBy = params.sortQuery.sortBy;
    }
    if (params.sortQuery?.sortOrder) {
        searchParams.sortOrder = params.sortQuery.sortOrder;
    }
    return new URLSearchParams(searchParams).toString();
};

export const unwrapTravelsList = (payload: unknown): { items: unknown[]; total: number } => {
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

export const isInvalidPagePayload = (payload: unknown): payload is { detail: string; total?: unknown } => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const detail = (payload as Record<string, unknown>).detail;
    return detail === 'Invalid page.';
};

export const hasKnownListArrays = (payload: unknown): boolean => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const source = payload as Record<string, unknown>;
    return Array.isArray(source.results) || Array.isArray(source.data) || Array.isArray(source.items);
};

export const isAbortError = (error: unknown): error is { name: string } =>
    !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';

export const applyPublishModeration = (
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

    if (source.moderation !== undefined && source.publish === undefined) {
        if (source.moderation === 0 || source.moderation === '0') {
            target.publish = 0;
        } else if (source.moderation === 1 || source.moderation === '1') {
            target.publish = 1;
        }
    }

    if (source.publish !== undefined && source.moderation === undefined) {
        if (source.publish === 1 || source.publish === '1') {
            target.moderation = 1;
        }
    }
};
