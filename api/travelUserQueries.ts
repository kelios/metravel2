import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { devError } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { getSecureItem } from '@/utils/secureStorage';
import type { MyTravelsPayload } from './travelsNormalize';
import {
    LONG_TIMEOUT,
    TOKEN_KEY,
    GET_TRAVELS,
    coerceTotal,
} from './travelQueryShared';

export const unwrapMyTravelsPayload = (
    payload: MyTravelsPayload | null | undefined
): { items: Record<string, unknown>[]; total: number } => {
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

export const fetchMyTravels = async (params: {
    user_id: string | number;
    yearFrom?: string;
    yearTo?: string;
    country?: string;
    onlyWithGallery?: boolean;
    includeDrafts?: boolean;
    publish?: number;
    moderation?: number;
    page?: number;
    perPage?: number;
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

    const normalizePositiveInt = (value: unknown, fallback: number): number => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        const normalized = Math.trunc(parsed);
        return normalized > 0 ? normalized : fallback;
    };

    try {
        const whereObject: MyTravelsWhere = {
            user_id: params.user_id,
        };

        const hasExplicitStatus =
            typeof params.publish !== 'undefined' || typeof params.moderation !== 'undefined';

        if (typeof params.publish !== 'undefined') whereObject.publish = params.publish;
        if (typeof params.moderation !== 'undefined') whereObject.moderation = params.moderation;

        if (!params.includeDrafts && !hasExplicitStatus) {
            whereObject.publish = 1;
            whereObject.moderation = 1;
        }

        if (params.country) whereObject.countries = [params.country];
        if (params.yearFrom || params.yearTo) {
            whereObject.year = {
                ...(params.yearFrom ? { gte: params.yearFrom } : {}),
                ...(params.yearTo ? { lte: params.yearTo } : {}),
            };
        }
        if (params.onlyWithGallery) whereObject.hasGallery = true;

        const page = normalizePositiveInt(params.page, 1);
        const perPage = normalizePositiveInt(params.perPage, 9999);

        const query = new URLSearchParams({
            page: String(page),
            perPage: String(perPage),
            where: JSON.stringify(whereObject),
        }).toString();

        const url = `${GET_TRAVELS}?${query}`;
        const token = params.includeDrafts ? await getSecureItem(TOKEN_KEY) : null;
        const init: RequestInit = token ? { headers: { Authorization: `Token ${token}` } } : {};
        const res = await fetchWithTimeout(url, init, LONG_TIMEOUT);
        if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unknown error');
            throw new Error(errorText);
        }
        return await safeJsonParse<MyTravelsPayload>(res, {});
    } catch (e) {
        if (__DEV__) {
            devError('Error fetching MyTravels:', e);
        }
        if (params.throwOnError) throw e;
        return [];
    }
};
