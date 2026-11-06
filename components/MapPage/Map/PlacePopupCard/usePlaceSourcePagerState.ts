/**
 * usePlaceSourcePagerState — состояние перелистывания материалов места (#1572).
 *
 * Владелец данных карточки: держит активный источник (по `activeSourceId`, а не
 * по индексу массива — список догружается и индекс уехал бы), лениво тянет
 * коллекцию материалов и отдаёт презентационной `PlacePopupCard` уже готовые
 * source-поля.
 *
 * Карта включает запрос при открытии карточки, каталог — по первой стрелке.
 * Кэш React Query по `placeKey` общий: пока ответ свежий, повторное открытие
 * и перелистывание обходятся без сети.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  getMapPlaceKey,
  isSameMapPlaceSource,
  readMapPlaceId,
  type MapPlaceSource,
} from '@/api/mapPlaces';
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
  sourceLoadStatus: 'idle' | 'loading' | 'error';
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

const resolveSources = (
  primarySource: MapPlaceSource | null,
  fetchedSources: MapPlaceSource[] | undefined,
): MapPlaceSource[] => {
  if (!primarySource) return fetchedSources ?? [];
  if (!fetchedSources?.length) return [primarySource];
  const isPrimary = (source: MapPlaceSource) => isSameMapPlaceSource(source, primarySource);
  return [fetchedSources.find(isPrimary) ?? primarySource, ...fetchedSources.filter((source) => !isPrimary(source))];
};

const getAdjacentSourceId = (sources: MapPlaceSource[], index: number, delta: number): string | null =>
  sources.length > 1 ? sources[(index + delta + sources.length) % sources.length].sourceId : null;

export const usePlaceSourcePagerState = (
  point: PointLike | null | undefined,
  enabled: boolean,
  { loadOnInteraction = false }: { loadOnInteraction?: boolean } = {},
): PlaceSourcePagerState => {
  const placeId = readMapPlaceId(point);
  const placeKey = point ? getMapPlaceKey(point) : '';
  const primarySource = point?.primarySource ?? null;
  const declaredCount = Number.isFinite(point?.sourceCount) ? Number(point?.sourceCount) : 1;

  const canLoadOnInteraction = enabled && loadOnInteraction && placeId != null && declaredCount > 1;
  const [requestedPage, setRequestedPage] = useState<{ placeKey: string; delta: number | null } | null>(null);
  const currentRequest = requestedPage?.placeKey === placeKey ? requestedPage : null;
  const { data, isError, isStale, fetchStatus, refetch } = useMapPlaceSources({
    placeKey,
    placeId,
    sourceCount: declaredCount,
    enabled: enabled && (!loadOnInteraction || currentRequest != null),
  });

  // The shared query is invalidated when a user blocks an author. Once the
  // catalog starts listening, keep it active and suppress invalidated sources
  // until the server returns the currently visible articles.
  const fetchedSources = canLoadOnInteraction && (!currentRequest || isStale) ? undefined : data;
  const sourcesFailed = isError && (!canLoadOnInteraction || currentRequest != null);
  const loading = currentRequest != null && (fetchStatus === 'fetching' || fetchStatus === 'paused');
  const sourceLoadStatus = loading ? 'loading' : canLoadOnInteraction && sourcesFailed ? 'error' : 'idle';

  // Primary из маркера остаётся первым и доступным даже при неполном/неверно
  // упорядоченном ответе endpoint. Иначе ответ только со вторым материалом
  // самопроизвольно переключал карточку на него и делал primary недоступным.
  const sources = useMemo(() => resolveSources(primarySource, fetchedSources), [fetchedSources, primarySource]);

  // Пока коллекция едет, счётчик берётся из маркера — карточка сразу честно
  // показывает «1 из N». Как только запрос завершился (данными или ошибкой),
  // счётчик равен тому, что реально листается: иначе стрелки остались бы на
  // экране навсегда и не делали бы ничего.
  const sourcesSettled = fetchedSources != null || (sourcesFailed && !canLoadOnInteraction);
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
    if (requestedPage) setRequestedPage(null);
  }

  const activeSourceIndex = useMemo(() => {
    if (!activeSourceId) return 0;
    const index = sources.findIndex((source) => source.sourceId === activeSourceId);
    return index >= 0 ? index : 0;
  }, [activeSourceId, sources]);

  if (currentRequest?.delta != null && !loading && (fetchedSources != null || sourcesFailed)) {
    setRequestedPage({ placeKey, delta: null });
    const next = getAdjacentSourceId(sources, activeSourceIndex, currentRequest.delta);
    if (next) setActiveSourceId(next);
  }

  const step = useCallback(
    (delta: number) => {
      if (canLoadOnInteraction && fetchedSources == null) {
        if (loading) return;
        setRequestedPage({ placeKey, delta });
        // Enabling the observer is sufficient on the first activation. A
        // subsequent activation after failure retries the same query.
        if (currentRequest) void refetch({ cancelRefetch: false });
        return;
      }
      const next = getAdjacentSourceId(sources, activeSourceIndex, delta);
      if (next) setActiveSourceId(next);
    },
    [activeSourceIndex, canLoadOnInteraction, currentRequest, fetchedSources, loading, placeKey, refetch, sources],
  );

  const goPrev = useCallback(() => step(-1), [step]);
  const goNext = useCallback(() => step(1), [step]);

  const activeSource = sources[activeSourceIndex] ?? primarySource;

  return {
    sourceCount,
    activeSourceIndex,
    activeSource,
    isPrimarySourceActive:
      !primarySource || !activeSource || isSameMapPlaceSource(activeSource, primarySource),
    sourceLoadStatus,
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
  // `hasPager` управляет только UI счётчика/стрелок. Primary source остаётся
  // владельцем своих URL/media и после ошибки загрузки коллекции, когда pager
  // схлопнулся до одного доступного материала и legacy-дубли могут отсутствовать.
  const activeArticleUrl = trimmed(state.activeSource?.articleUrl);
  const activeThumbnailUrl = trimmed(state.activeSource?.thumbnailUrl);
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
