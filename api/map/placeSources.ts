import { normalizeMapPlaceSource, type MapPlaceSource, type MapPlaceSourcesPage } from '@/api/mapPlaces';
import type { ApiOptions } from './contracts';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { normalizeImageUrl } from './pointAdapters';
import { DEFAULT_TIMEOUT, fetchWithTransientRetry, getMapPlaceSourcesUrl } from './transport';

// --- Ленивые sources места (#1567/#1571) -------------------------------------
// Запрашивается только после первого открытия карточки места с sourceCount > 1
// и кэшируется по placeKey (см. hooks/map/useMapPlaceSources.ts); перелистывание
// popup не перезапрашивает map dataset и не пересобирает marker-слой.

const normalizeMapPlaceSourcesPayload = (payload: unknown): MapPlaceSourcesPage => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { results: [], next: null };
  }
  const obj = payload as Record<string, unknown>;
  const results = Array.isArray(obj.results)
    ? obj.results
        .map((item) => normalizeMapPlaceSource(item, normalizeImageUrl))
        .filter((item): item is MapPlaceSource => item !== null)
    : [];
  const nextRaw = obj.next;
  const next = typeof nextRaw === 'string' && nextRaw.trim() ? nextRaw.trim() : null;
  return { results, next };
};

/**
 * Курсор следующей страницы. DRF отдаёт в `next` ПОЛНЫЙ URL страницы, а не голый
 * токен (тот же конверт разбирает `api/quests.ts` через `next.match(/[?&]page=/)`),
 * поэтому URL в `?cursor=` подставлять нельзя: бэкенд вернул бы первую страницу
 * заново, а карточка получила бы дубли материалов. Забираем из URL сам токен и
 * всегда бьём в собственный абсолютный endpoint (относительный URL не годится
 * для fetch на native). URL без `cursor=` означает «дальше идти нечем».
 */
const resolveMapPlaceSourcesCursor = (next: string | null): string | null => {
  const value = typeof next === 'string' ? next.trim() : '';
  if (!value) return null;
  const isUrlLike = /^https?:\/\//i.test(value) || value.startsWith('/') || value.includes('?');
  if (!isUrlLike) return value;
  const match = value.match(/[?&]cursor=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

/** Одна страница sources места. Ошибки бросаются: запрос ленивый и user-triggered. */
export const fetchMapPlaceSources = async (
  placeId: string | number,
  cursor?: string | null,
  options?: ApiOptions,
): Promise<MapPlaceSourcesPage> => {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  const url = `${getMapPlaceSourcesUrl(placeId)}${query ? `?${query}` : ''}`;

  const res = await fetchWithTransientRetry(url, { signal: options?.signal }, DEFAULT_TIMEOUT, 1);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const payload = await safeJsonParse<unknown>(res, { results: [], next: null });
  return normalizeMapPlaceSourcesPayload(payload);
};

/**
 * Все sources места одним вызовом для React Query cache: идём по `next`-курсору
 * с жёстким потолком страниц — материалов у места единицы, потолок только
 * страхует от зацикленного курсора (ср. ловушку backfill next_cursor).
 */
export const fetchAllMapPlaceSources = async (
  placeId: string | number,
  options?: ApiOptions,
): Promise<MapPlaceSource[]> => {
  const MAX_PAGES = 5;
  const results: MapPlaceSource[] = [];
  // Один и тот же материал не должен попасть в список дважды: pager ищет активный
  // источник по `sourceId`, и на дубле `findIndex` вечно возвращает первое
  // вхождение — перелистывание молча замирает на первом материале.
  const seenSourceIds = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const chunk: MapPlaceSourcesPage = await fetchMapPlaceSources(placeId, cursor, options);
    for (const source of chunk.results) {
      if (seenSourceIds.has(source.sourceId)) continue;
      seenSourceIds.add(source.sourceId);
      results.push(source);
    }
    const nextCursor = resolveMapPlaceSourcesCursor(chunk.next);
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }
  return results;
};
