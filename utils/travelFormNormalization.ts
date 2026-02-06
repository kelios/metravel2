// utils/travelFormNormalization.ts
// ✅ АРХИТЕКТУРА: Чистые функции нормализации данных формы путешествия
// Извлечены из hooks/useTravelFormData.ts для независимого тестирования и переиспользования

import type { TravelFormData } from '@/types/types';

export const DRAFT_PLACEHOLDER_PREFIX = '__draft_placeholder__';

/**
 * Проверяет, является ли значение локальным превью (blob: или data:)
 */
export function isLocalPreviewUrl(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return /^(blob:|data:)/i.test(trimmed);
}

/**
 * Проверяет, является ли значение пустым изображением
 */
export function isEmptyImageValue(value: unknown): boolean {
    if (value == null) return true;
    if (typeof value !== 'string') return false;
    return value.trim().length === 0;
}

/**
 * Нормализует координату в строку с 6 знаками после запятой
 */
function normalizeCoord(value: any): string {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(num)) return num.toFixed(6);
    return String(value ?? '');
}

/**
 * Объединяет серверные маркеры с текущими, сохраняя локальные изображения
 */
export function mergeMarkersPreserveImages(
    serverMarkers: any[],
    currentMarkers: any[]
): any[] {
    if (!Array.isArray(serverMarkers) || serverMarkers.length === 0) return currentMarkers;
    if (!Array.isArray(currentMarkers) || currentMarkers.length === 0) return serverMarkers;

    const makeIdKey = (m: any) => {
        const idRaw = m?.id != null ? String(m.id) : '';
        const id = idRaw && idRaw !== 'null' && idRaw !== 'undefined' ? idRaw : '';
        return id ? `id:${id}` : '';
    };

    const makeLlKey = (m: any) => {
        const lat = normalizeCoord(m?.lat);
        const lng = normalizeCoord(m?.lng);
        return `ll:${lat},${lng}`;
    };

    const currentById = new Map<string, any>();
    const currentByLl = new Map<string, any>();
    currentMarkers.forEach(m => {
        const idKey = makeIdKey(m);
        if (idKey) currentById.set(idKey, m);
        currentByLl.set(makeLlKey(m), m);
    });

    return serverMarkers.map(m => {
        const idKey = makeIdKey(m);
        const llKey = makeLlKey(m);
        const current = (idKey ? currentById.get(idKey) : null) ?? currentByLl.get(llKey);
        if (!current) return m;

        const serverImage = m?.image;
        const currentImage = current?.image;
        if (isEmptyImageValue(serverImage)) {
            if (typeof currentImage === 'string' && currentImage.trim().length > 0) {
                return { ...m, image: currentImage };
            }
        }

        return m;
    });
}

/**
 * Гарантирует наличие обязательных полей для черновика
 */
export function ensureRequiredDraftFields(payload: TravelFormData): TravelFormData {
    const normalized: TravelFormData = { ...payload };
    const draftPlaceholder = DRAFT_PLACEHOLDER_PREFIX;

    const arrayFields: Array<keyof TravelFormData> = [
        'categories', 'transports', 'month', 'complexity',
        'companions', 'over_nights_stay', 'countries',
        'thumbs200ForCollectionArr', 'travelImageThumbUrlArr', 'travelImageAddress',
    ];
    const stringFields: Array<keyof TravelFormData> = [
        'minus', 'plus', 'recommendation', 'description', 'youtube_link',
    ];
    const booleanFields: Array<keyof TravelFormData> = ['publish', 'visa', 'moderation'];

    arrayFields.forEach(field => {
        if (!Array.isArray(normalized[field])) {
            (normalized as any)[field] = [];
        }
    });

    booleanFields.forEach(field => {
        const value = normalized[field];
        if (typeof value !== 'boolean') {
            const valueAny: any = value;
            if (valueAny === 'false' || valueAny === '0' || valueAny === 0) {
                (normalized as any)[field] = false;
            } else if (valueAny === 'true' || valueAny === '1' || valueAny === 1) {
                (normalized as any)[field] = true;
            } else {
                (normalized as any)[field] = Boolean(value);
            }
        }
    });

    const isDraft = !normalized.publish && !normalized.moderation;

    stringFields.forEach(field => {
        const value = normalized[field];
        const isBlank =
            value == null ||
            (typeof value === 'string' && value.trim().length === 0);
        if (isBlank) {
            (normalized as any)[field] = isDraft ? draftPlaceholder : null;
        }
    });

    return normalized;
}

/**
 * Заменяет плейсхолдеры черновика на пустые строки для отображения в UI
 */
export function normalizeDraftPlaceholders(payload: TravelFormData): TravelFormData {
    const normalized: TravelFormData = { ...payload };
    const stringFields: Array<keyof TravelFormData> = [
        'minus', 'plus', 'recommendation', 'description', 'youtube_link',
    ];

    stringFields.forEach(field => {
        const value = normalized[field];
        if (typeof value === 'string' && value.startsWith(DRAFT_PLACEHOLDER_PREFIX)) {
            (normalized as any)[field] = '';
            return;
        }
        if (typeof value === 'string' && value.trim().length === 0) {
            (normalized as any)[field] = '';
        }
    });

    return normalized;
}

/**
 * Проверяет, является ли значение плейсхолдером черновика
 */
export function isDraftPlaceholder(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return value.trim() === DRAFT_PLACEHOLDER_PREFIX;
}

// --- Helpers for applySavedData: keep local value when server returns empty/nil ---

type KeepMode = 'emptyString' | 'nil' | 'emptyArray' | 'nilArray' | 'missingImageUrl';

/**
 * Универсальный хелпер: сохраняет текущее значение поля, если сервер вернул "пустое".
 * Заменяет 5 отдельных keepCurrentIfServer* функций.
 */
export function keepCurrentField<T extends Record<string, any>>(
    target: T,
    current: T,
    key: keyof T,
    mode: KeepMode,
): void {
    const sv = target[key];
    const cv = current[key];

    switch (mode) {
        case 'emptyString':
            if (typeof sv === 'string' && sv.trim().length === 0) {
                if (typeof cv === 'string' && cv.trim().length > 0) {
                    (target as any)[key] = cv;
                }
            }
            break;
        case 'nil':
            if (sv == null) {
                if (typeof cv === 'string' && cv.trim().length > 0) {
                    (target as any)[key] = cv;
                }
            }
            break;
        case 'emptyArray':
            if (Array.isArray(sv) && sv.length === 0) {
                if (Array.isArray(cv) && cv.length > 0) {
                    (target as any)[key] = cv;
                }
            }
            break;
        case 'nilArray':
            if (sv == null) {
                if (Array.isArray(cv) && cv.length > 0) {
                    (target as any)[key] = cv;
                }
            }
            break;
        case 'missingImageUrl':
            if (sv == null || (typeof sv === 'string' && sv.trim().length === 0)) {
                if (typeof cv === 'string' && cv.trim().length > 0) {
                    (target as any)[key] = cv;
                }
            }
            break;
    }
}

// --- Helpers for cleanAndSave: pure data normalization before sending to server ---

const NULLABLE_STRING_FIELDS: Array<keyof TravelFormData> = [
    'name', 'budget', 'year', 'number_peoples', 'number_days',
    'minus', 'plus', 'recommendation', 'description', 'youtube_link',
];

/**
 * Нормализует nullable строковые поля (backend ожидает строки, null ломает черновики).
 */
export function normalizeNullableStrings(data: TravelFormData): TravelFormData {
    const result = { ...data };
    NULLABLE_STRING_FIELDS.forEach((key) => {
        if ((result as any)[key] == null) {
            (result as any)[key] = '';
        }
    });
    return result;
}

/**
 * Нормализует маркеры для отправки на сервер:
 * - числовые categories
 * - image: null если пустой или локальный превью
 */
export function normalizeMarkersForSave(markers: any[]): any[] {
    if (!Array.isArray(markers)) return [];
    return markers.map((m: any) => {
        const { image, ...rest } = m ?? {};
        const imageValue = typeof image === 'string' ? image.trim() : '';
        const categories = Array.isArray(m?.categories)
            ? m.categories.map((c: any) => Number(c)).filter((n: number) => Number.isFinite(n))
            : [];
        return {
            ...rest,
            categories,
            image: imageValue && imageValue.length > 0 && !isLocalPreviewUrl(imageValue)
                ? imageValue
                : null,
        };
    });
}

/**
 * Фильтрует галерею: убирает пустые и локальные превью.
 */
export function normalizeGalleryForSave(gallery: any[] | undefined): any[] | undefined {
    if (!Array.isArray(gallery)) return undefined;
    return gallery.filter((item: any) => {
        if (typeof item === 'string') {
            const value = item.trim();
            return value.length > 0 && !isLocalPreviewUrl(value);
        }
        if (item && typeof item === 'object') {
            const url = typeof item.url === 'string' ? item.url.trim() : '';
            return url.length > 0 && !isLocalPreviewUrl(url);
        }
        return false;
    });
}

/**
 * Санитизирует URL обложки: null если локальный превью.
 */
export function sanitizeCoverUrl(url: string | null | undefined): string | null {
    return isLocalPreviewUrl(url) ? null : (url ?? null);
}

/**
 * Фильтрует payload, оставляя только разрешённые ключи для API.
 */
export function filterAllowedKeys(
    data: Record<string, any>,
    baseKeys: string[],
): Partial<TravelFormData> {
    const allowedKeys = new Set<string>([
        ...baseKeys,
        'slug',
        'travel_image_thumb_url',
        'travel_image_thumb_small_url',
    ]);
    return Object.fromEntries(
        Object.entries(data).filter(([key]) => allowedKeys.has(key))
    ) as Partial<TravelFormData>;
}

// --- Helper for handleManualSave: merge override with current snapshot ---

const MERGE_STRING_FIELDS: Array<keyof TravelFormData> = [
    'name', 'description', 'plus', 'minus', 'recommendation', 'youtube_link',
];
const MERGE_ARRAY_FIELDS: Array<keyof TravelFormData> = [
    'categories', 'transports', 'complexity', 'companions', 'over_nights_stay', 'month', 'countries',
];

/**
 * Объединяет override с текущим snapshot, сохраняя пользовательский ввод
 * когда override содержит пустые/null/placeholder значения.
 */
export function mergeOverridePreservingUserInput(
    current: TravelFormData,
    override: TravelFormData,
): TravelFormData {
    const merged: any = { ...current, ...override };

    MERGE_STRING_FIELDS.forEach((key) => {
        const o = (override as any)[key];
        const c = (current as any)[key];
        if (o == null) {
            if (c != null) merged[key] = c;
            return;
        }
        if (isDraftPlaceholder(o)) {
            if (typeof c === 'string' && c.trim().length > 0 && !isDraftPlaceholder(c)) {
                merged[key] = c;
            }
            return;
        }
        if (typeof o === 'string' && o.trim().length === 0) {
            if (typeof c === 'string' && c.trim().length > 0) {
                merged[key] = c;
            }
        }
    });

    MERGE_ARRAY_FIELDS.forEach((key) => {
        const o = (override as any)[key];
        const c = (current as any)[key];
        if (Array.isArray(o) && o.length === 0) {
            if (Array.isArray(c) && c.length > 0) {
                merged[key] = c;
            }
        }
    });

    return merged as TravelFormData;
}
