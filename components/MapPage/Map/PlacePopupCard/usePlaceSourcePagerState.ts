/**
 * usePlaceSourcePagerState — состояние перелистывания материалов места (#1572).
 *
 * Владелец данных карточки: держит активный источник (по `activeSourceId`, а не
 * по индексу массива — список догружается и индекс уехал бы), лениво тянет
 * коллекцию материалов и отдаёт презентационной `PlacePopupCard` уже готовые
 * source-поля.
 *
 * Ленивость: хук живёт внутри карточки, а карточка монтируется только когда
 * место открыто, — запрос не может уйти на рендере маркеров. Кэш React Query
 * по `placeKey` держит «один запрос на place на cache lifetime», поэтому
 * повторное открытие и перелистывание сети не касаются.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import { getMapPlaceKey, readMapPlaceId, type MapPlaceSource } from '@/api/mapPlaces';
import { useMapPlaceSources } from '@/hooks/map/useMapPlaceSources';

export type PlaceSourcePagerState = {
  /** Сколько материалов у места (по данным маркера/коллекции). */
  sourceCount: number;
  activeSourceIndex: number;
  activeSource: MapPlaceSource | null;
  /**
   * Активен ли primary-материал места. Плоские legacy-поля записи
   * (`imageUrl`/`articleUrl`/`urlTravel`) описывают именно его, поэтому
   * подставлять их как fallback под другой активный источник нельзя —
   * карточка показала бы чужое фото и увела бы по чужой ссылке.
   */
  isPrimarySourceActive: boolean;
  goPrev: () => void;
  goNext: () => void;
};

type PointLike = {
  id?: unknown;
  coord?: unknown;
  placeId?: string | number;
  sourceCount?: number;
  primarySource?: MapPlaceSource | null;
};

export const usePlaceSourcePagerState = (
  point: PointLike | null | undefined,
  enabled: boolean,
): PlaceSourcePagerState => {
  const placeId = readMapPlaceId(point);
  const placeKey = point ? getMapPlaceKey(point) : '';
  const primarySource = point?.primarySource ?? null;
  const declaredCount = Number.isFinite(point?.sourceCount) ? Number(point?.sourceCount) : 1;

  const { data: fetchedSources, isError: sourcesFailed } = useMapPlaceSources({
    placeKey,
    placeId,
    sourceCount: declaredCount,
    enabled,
  });

  // Пока коллекция не пришла, известен только primary — карточка уже показывает
  // корректный счётчик `1 из N` из маркера, а листать становится чем после ответа.
  const sources = useMemo<MapPlaceSource[]>(() => {
    if (fetchedSources && fetchedSources.length > 0) return fetchedSources;
    return primarySource ? [primarySource] : [];
  }, [fetchedSources, primarySource]);

  // Пока коллекция едет, счётчик берётся из маркера — карточка сразу честно
  // показывает «1 из N». Как только запрос завершился (данными или ошибкой),
  // счётчик равен тому, что реально листается: иначе стрелки остались бы на
  // экране навсегда и не делали бы ничего.
  const sourcesSettled = fetchedSources != null || sourcesFailed;
  const sourceCount = sourcesSettled
    ? Math.max(sources.length, 1)
    : Math.max(declaredCount, sources.length, 1);

  const [activeSourceId, setActiveSourceId] = useState<string | null>(
    primarySource?.sourceId ?? null,
  );

  // Другое место — начинаем с его первого материала. Подстройка стейта под смену
  // пропа делается на рендере (React отбрасывает этот проход и сразу считает
  // следующий), а не эффектом: эффект дал бы лишний закоммиченный кадр, в
  // котором карточка нового места ещё показывала бы материал предыдущего.
  const renderedPlaceKeyRef = useRef(placeKey);
  if (renderedPlaceKeyRef.current !== placeKey) {
    renderedPlaceKeyRef.current = placeKey;
    setActiveSourceId(primarySource?.sourceId ?? null);
  }

  const activeSourceIndex = useMemo(() => {
    if (!activeSourceId) return 0;
    const index = sources.findIndex((source) => source.sourceId === activeSourceId);
    return index >= 0 ? index : 0;
  }, [activeSourceId, sources]);

  const step = useCallback(
    (delta: number) => {
      if (sources.length <= 1) return;
      const next = (activeSourceIndex + delta + sources.length) % sources.length;
      setActiveSourceId(sources[next]?.sourceId ?? null);
    },
    [activeSourceIndex, sources],
  );

  const goPrev = useCallback(() => step(-1), [step]);
  const goNext = useCallback(() => step(1), [step]);

  const activeSource = sources[activeSourceIndex] ?? primarySource;

  return {
    sourceCount,
    activeSourceIndex,
    activeSource,
    isPrimarySourceActive:
      !primarySource || !activeSource || activeSource.sourceId === primarySource.sourceId,
    goPrev,
    goNext,
  };
};

/** Плоские поля записи карты — они описывают primary-материал места. */
type PlaceRecordLegacyFields = {
  articleUrl?: unknown;
  urlTravel?: unknown;
  imageUrl?: unknown;
  travelImageThumbUrl?: unknown;
};

export type PlaceSourceCardFields = {
  /** Ссылка на материал. Пусто — карточка не показывает переход к статье. */
  articleUrl: string;
  /** Фото материала. Пусто — карточка остаётся без фото, чужое не подставляется. */
  imageUrl: string;
  /** Заголовок материала для счётчика pager'а. */
  articleTitle: string;
};

const trimmed = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Source-owned поля карточки. Плоские legacy-поля записи легальны только под
 * primary-материалом: под другим активным источником они увели бы на ЧУЖУЮ
 * статью и показали бы чужое фото (класс, закрытый в 815302ef).
 */
export const resolvePlaceSourceCardFields = (
  record: PlaceRecordLegacyFields | null | undefined,
  state: Pick<PlaceSourcePagerState, 'activeSource' | 'isPrimarySourceActive'>,
  hasPager: boolean,
): PlaceSourceCardFields => {
  const activeArticleUrl = hasPager ? trimmed(state.activeSource?.articleUrl) : '';
  const activeThumbnailUrl = hasPager ? trimmed(state.activeSource?.thumbnailUrl) : '';
  const legacyAllowed = state.isPrimarySourceActive;

  return {
    articleUrl:
      activeArticleUrl ||
      (legacyAllowed ? trimmed(record?.articleUrl) || trimmed(record?.urlTravel) : ''),
    imageUrl:
      activeThumbnailUrl ||
      (legacyAllowed ? trimmed(record?.imageUrl) || trimmed(record?.travelImageThumbUrl) : ''),
    articleTitle: hasPager ? trimmed(state.activeSource?.articleTitle) : '',
  };
};
