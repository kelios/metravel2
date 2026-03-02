// api/parsers/apiResponseParser.ts
// A3: Shared API response parsing utilities
// Provides type-safe parsing helpers for API DTO normalization.

/**
 * Safely extract a Record from an unknown value.
 */
export const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

/**
 * Parse a paginated API response into a normalized shape.
 * Handles common backend formats: { data: T[] }, { results: T[] }, { items: T[] }, T[]
 */
export interface PaginatedResult<T> {
    items: T[];
    total: number;
}

export const parsePaginatedResponse = <T>(
    payload: unknown,
    normalizeItem: (raw: unknown) => T,
): PaginatedResult<T> => {
    if (!payload) return { items: [], total: 0 };

    if (Array.isArray(payload)) {
        return { items: payload.map(normalizeItem), total: payload.length };
    }

    const rec = asRecord(payload);
    const rawList =
        Array.isArray(rec.results) ? rec.results
        : Array.isArray(rec.data) ? rec.data
        : Array.isArray(rec.items) ? rec.items
        : null;

    if (!rawList) return { items: [], total: coerceNumber(rec.total, 0) };

    const items = rawList.map(normalizeItem);
    const total = coerceNumber(rec.count, coerceNumber(rec.total, items.length));
    return { items, total };
};

/**
 * Coerce an unknown value to a finite number, or return fallback.
 */
export const coerceNumber = (value: unknown, fallback = 0): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
};

/**
 * Coerce an unknown value to a string, or return fallback.
 */
export const coerceString = (value: unknown, fallback = ''): string => {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return fallback;
    return String(value);
};

/**
 * Coerce an unknown value to a boolean.
 */
export const coerceBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    return false;
};

/**
 * Extract HTTP status from an unknown error object.
 * Works with ApiError, fetch errors, and plain objects with `.status`.
 */
export const getErrorStatus = (error: unknown): number | null => {
    if (!error || typeof error !== 'object') return null;
    const rec = error as Record<string, unknown>;
    const rawStatus = rec.status ??
        (rec.response && typeof rec.response === 'object'
            ? (rec.response as Record<string, unknown>).status
            : undefined);
    const status = Number(rawStatus);
    return Number.isFinite(status) ? status : null;
};

/**
 * Check if an error is an AbortError (from fetch signal cancellation).
 */
export const isAbortError = (error: unknown): boolean =>
    !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';

