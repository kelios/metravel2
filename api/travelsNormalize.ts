// api/travelsNormalize.ts
// Travel data normalization utilities extracted from travelsApi.ts (task A2)

import { Travel } from '@/types/types';

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

const isPrivateOrLocalHost = (host: string): boolean => {
    const normalizedHost = String(host || '').trim().toLowerCase();
    if (!normalizedHost) return false;
    return normalizedHost === 'localhost' ||
        normalizedHost === '127.0.0.1' ||
        /^10\./.test(normalizedHost) ||
        /^192\.168\./.test(normalizedHost) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedHost);
};

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
    const mediaPathWithApiPrefix = /^\/api\/(travel-image|travel-description-image|address-image|gallery|uploads|media)(\/|$)/i;
    const firstPartyMediaUrl = /http:\/\/(?:metravel\.by|cdn\.metravel\.by|api\.metravel\.by)(\/(?:travel-image|travel-description-image|address-image|gallery|uploads|media)[^\s"'<>)]*)/gi;

    const stripDraftPlaceholder = (value: unknown): unknown => {
        if (typeof value !== 'string') return value;
        return value.trim() === '__draft_placeholder__' ? '' : value;
    };

    const normalizeRichTextMediaUrls = (value: unknown): unknown => {
        if (typeof value !== 'string' || !value) return value;
        return value.replace(firstPartyMediaUrl, (_match, path: string) => `https://metravel.by${path}`);
    };

    if (typeof t.id !== 'undefined') {
        out.id = Number(t.id) || 0;
    }
    if (typeof t.slug !== 'undefined') {
        out.slug = String(t.slug);
    }

    // Normalize display title: backend variants may provide either `name` or `title`.
    const normalizedName = typeof t.name === 'string'
        ? t.name.replace(/\s{2,}/g, ' ').trim()
        : undefined;
    const normalizedTitle = typeof t.title === 'string'
        ? t.title.replace(/\s{2,}/g, ' ').trim()
        : undefined;

    if (typeof normalizedName === 'string') {
        out.name = normalizedName || normalizedTitle || '';
    } else if (typeof normalizedTitle === 'string') {
        out.name = normalizedTitle;
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

    // Backend can return "__draft_placeholder__" for empty draft fields.
    // Treat it as empty so UI doesn't render broken sections (e.g. Video tab with no YouTube id).
    out.description = normalizeRichTextMediaUrls(stripDraftPlaceholder(out.description));
    out.youtube_link = stripDraftPlaceholder(out.youtube_link);
    out.recommendation = normalizeRichTextMediaUrls(stripDraftPlaceholder(out.recommendation));
    out.plus = normalizeRichTextMediaUrls(stripDraftPlaceholder(out.plus));
    out.minus = normalizeRichTextMediaUrls(stripDraftPlaceholder(out.minus));

    // Нормализация полей рейтинга
    if (typeof t.rating !== 'undefined') {
        const ratingVal = Number(t.rating);
        out.rating = Number.isFinite(ratingVal) && ratingVal > 0 ? ratingVal : null;
    }
    if (typeof t.rating_count !== 'undefined') {
        out.rating_count = Number(t.rating_count) || 0;
    }
    if (typeof t.user_rating !== 'undefined') {
        const userRatingVal = Number(t.user_rating);
        out.user_rating = Number.isFinite(userRatingVal) && userRatingVal > 0 ? userRatingVal : null;
    }

    // Нормализация URL изображений (относительные -> абсолютные)
    const normalizeImageUrl = (url: string | undefined): string => {
        if (!url) return '';
        let trimmed = url.trim();
        if (!trimmed) return '';

        // Backend (or stale payloads) may occasionally return media URLs with an invalid `/api` prefix.
        // Fix known media paths to avoid 404s in slider/gallery.
        if (mediaPathWithApiPrefix.test(trimmed)) {
            trimmed = trimmed.replace(/^\/api/i, '');
        } else if (/^https?:\/\//i.test(trimmed)) {
            try {
                const parsed = new URL(trimmed);
                if (mediaPathWithApiPrefix.test(parsed.pathname)) {
                    parsed.pathname = parsed.pathname.replace(/^\/api/i, '');
                    trimmed = parsed.toString();
                }
            } catch {
                // Keep original value when URL parsing fails.
            }
        }

        if (/^http:\/\//i.test(trimmed)) {
            try {
                const parsed = new URL(trimmed);
                const host = String(parsed.hostname || '').trim().toLowerCase();
                if (!isPrivateOrLocalHost(host)) {
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

    // Normalize userIds to a stable comma-separated string.
    // Backend has returned this field as a string ("1,2"), number (1), or array ([1]).
    const rawUserIds = (t.userIds ?? t.user_ids) as unknown;
    if (typeof rawUserIds !== 'undefined') {
        if (Array.isArray(rawUserIds)) {
            out.userIds = rawUserIds
                .map((v) => String(v).trim())
                .filter(Boolean)
                .join(',');
        } else {
            out.userIds = String(rawUserIds ?? '').trim();
        }
    }

    // Normalize user object: ensure travel.user.id is populated from userIds when missing
    const existingUser = asRecord(out.user);
    const hasExistingUserId = getPositiveNumericId(existingUser.id) !== null;

    if (!hasExistingUserId) {
        const uid = extractFirstUserId(rawUserIds);
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
