import { Platform } from 'react-native';

import { ApiError } from '@/api/clientErrors';
import type { DownloadResponse } from '@/api/clientTypes';
import { parseDownloadFilename } from '@/api/clientTypes';
import { translate as i18nT } from '@/i18n';
import { getApiErrorMessage, getErrorTextField } from '@/utils/errorHelpers';
import { devError } from '@/utils/logger';

/**
 * Единый разбор envelope-ответов бэка. Формы видели разные:
 * bare array | `{results}` (DRF) | `{data}` | `{items}`. Раньше это переизобретали
 * независимо в каждом доменном api, и расхождения (`.items` учитывался в одном
 * файле, но не в другом) при смене формы бэком приводили к «пустым спискам».
 * Держим ОДНУ точку эволюции контракта пагинации здесь. (FE-ARCH D2)
 *
 * NB: намеренно НЕ покрывает `api/travelQueryShared.unwrapTravelsList`
 * (hydration-sensitive travel, отдельный per-shape приоритет count/total),
 * `api/map.normalizeTravelsForMapPayload` (keyed `TravelsForMap` + non-envelope
 * fallback опирается на null-vs-array).
 */
const asEnvelopeRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;

const coerceCount = (value: unknown, fallback: number): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
};

/** Достаёт массив элементов из bare-array или конверта `{items|results|data}`. */
export const unwrapList = <T = unknown>(payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    const rec = asEnvelopeRecord(payload);
    if (!rec) return [];
    if (Array.isArray(rec.items)) return rec.items as T[];
    if (Array.isArray(rec.results)) return rec.results as T[];
    if (Array.isArray(rec.data)) return rec.data as T[];
    return [];
};

/**
 * Размер выборки из конверта по приоритету `total`→`count`, либо `null`, если
 * бэкенд его не прислал вовсе.
 *
 * Отличать «выборка пуста» от «размера нет» нужно тем, кто по этому размеру
 * принимает решение, а не показывает число: постраничное чтение в `api/quests`
 * так узнаёт, известно ли ему число страниц заранее. `unwrapPaginated` ниже
 * зовёт эту же читалку, чтобы приоритет полей не разъехался на два места.
 */
export const readEnvelopeTotal = (payload: unknown): number | null => {
    const rec = asEnvelopeRecord(payload);
    if (!rec) return null;
    if (!('total' in rec) && !('count' in rec)) return null;
    const total = coerceCount(rec.total, coerceCount(rec.count, Number.NaN));
    return Number.isFinite(total) ? total : null;
};

/** Как `unwrapList`, но с total из `total`→`count`→длины списка. */
export const unwrapPaginated = <T = unknown>(
    payload: unknown,
): { items: T[]; total: number } => {
    const items = unwrapList<T>(payload);
    return { items, total: readEnvelopeTotal(payload) ?? items.length };
};

export const parseErrorBody = (text: string): unknown => {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

export const throwDetailedError = async (response: Response): Promise<never> => {
    const errorText = await response.text().catch(() => 'Unknown error');
    const errorData = parseErrorBody(errorText);
    const fallbackStatusText = response.statusText || `HTTP ${response.status}`;
    throw new ApiError(
        response.status,
        getApiErrorMessage(errorData, fallbackStatusText),
        errorData
    );
};

export const parseSuccessResponse = async <T>(response: Response): Promise<T> => {
    if (response.status === 204) {
        return null as T;
    }

    const maybeTextFn = (response as Partial<Response>)?.text;
    if (typeof maybeTextFn === 'function') {
        const text = await response.text().catch(() => '');
        if (!text) {
            return null as T;
        }
        try {
            return JSON.parse(text) as T;
        } catch {
            if (__DEV__) {
                devError('Ошибка парсинга JSON в parseSuccessResponse:', text.substring(0, 100));
            }
            return null as T;
        }
    }

    const maybeJsonFn = (response as Partial<Response>)?.json;
    if (typeof maybeJsonFn === 'function') {
        return (await response.json()) as T;
    }

    return null as T;
};

export const parseDownloadResponse = async (response: Response): Promise<DownloadResponse> => {
    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        const errorData = parseErrorBody(errorText);
        throw new ApiError(
            response.status,
            getErrorTextField(errorData, 'message') ||
                getErrorTextField(errorData, 'detail') ||
                i18nT('errorsStatic:api.common.requestFailed', { details: response.statusText }),
            errorData
        );
    }

    const contentType = response.headers.get('content-type') ?? undefined;
    const filename = parseDownloadFilename(response.headers.get('content-disposition'));
    if (Platform.OS === 'web') {
        return { blob: await response.blob(), contentType, filename };
    }
    const bytes = await response.arrayBuffer();
    // Native-потребители текста сохраняют прежний контракт `blob.text()`, а
    // бинарные download-пути используют bytes и не теряют BOM/кодировку.
    const blob = {
        text: async () => new TextDecoder().decode(bytes),
    } as Blob;
    return { blob, bytes, contentType, filename };
};
