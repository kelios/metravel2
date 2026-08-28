/**
 * Мост RN → WebView для маркеров карты (#1573, problem MAP-POI-SOURCE-GROUPING-001).
 *
 * Одно физическое место = один WebView-маркер и один hit target, а выбор места
 * возвращается стабильным `placeKey`. Логика вынесена из `Map.ios.tsx` (общего
 * для iOS и Android) в чистый модуль: проекция payload и резолв выбора — это
 * контракт моста, который проверяется unit-тестами без WebView и симулятора.
 */
import type { MapPlaceMarker, MapPlaceRecordLike } from '@/api/mapPlaces';

/**
 * Ровно то, что рисует и отправляет обратно WebView-маркер. Полные записи места
 * (ссылки, превью, адрес) остаются в RN — карточку показывает MapPlaceBottomCard,
 * поэтому массив источников места через мост не сериализуется вовсе.
 */
export type NativeMarkerPayloadItem = {
  /** Стабильный ключ места: приходит обратно в SELECT_PLACE. */
  placeKey: string;
  /** Legacy-идентификатор записи: fallback резолва на переходный период. */
  id: string | null;
  coord: string;
  /** Нужна WebView для зоны кемпинга; полиморфные формы сюда не проходят. */
  categoryName: string;
  /** Число материалов места — WebView может отличить одиночное место от сборного. */
  sourceCount: number;
};

/** Выбор места из WebView; legacy-поля переходного периода опциональны. */
export type NativeSelectPlaceMessage = {
  placeKey?: string;
  id?: string;
  coord?: string;
  index?: number | null;
};

/** `categoryName` полиморфна между payload'ами — в WebView уходит только строка. */
const readCategoryName = (record: unknown): string => {
  if (!record || typeof record !== 'object') return '';
  const value = (record as { categoryName?: unknown }).categoryName;
  return typeof value === 'string' ? value : '';
};

/**
 * Проекция 1:1 по индексу: WebView присылает `index` тапнутого маркера как индекс
 * ЭТОГО массива, а RN резолвит legacy-fallback по массиву мест. Отфильтруй здесь
 * место без координаты — и индексы разъедутся, тап открыл бы соседнюю карточку.
 * Запись без координаты WebView и так пропускает (`if (!point.coord) return`).
 */
export const toNativeMarkerPayload = <TRecord extends MapPlaceRecordLike>(
  places: readonly MapPlaceMarker<TRecord>[] | null | undefined,
): NativeMarkerPayloadItem[] => {
  if (!Array.isArray(places) || places.length === 0) return [];
  return places.map((place) => ({
    placeKey: place?.placeKey ?? '',
    id: place?.record?.id == null ? null : String(place.record.id),
    coord: place?.coord || String(place?.record?.coord ?? ''),
    categoryName: readCategoryName(place?.record),
    sourceCount: place?.sourceCount ?? 1,
  }));
};

/**
 * Кластер для WebView. Скрипт рисует его по `center`/`count`/`bounds`, а `key` —
 * стабильный геометрический ключ #1347: серверные id меняются между запросами с
 * перекрывающимися bbox, и native обязан получать тот же ключ, что и web.
 */
export type NativeClusterPayloadItem = {
  key: string;
  center: [number, number];
  count: number;
  bounds: [[number, number], [number, number]];
};

/**
 * Проекция кластеров для WebView: отбрасывается только `ClusterData.items` —
 * полные записи точек превью (а с #1571 ещё и `primarySource` каждой), которых
 * WebView не читает. Без сужения весь preview уезжал бы через мост впустую, как
 * только backend #1567 начнёт отдавать place DTO.
 */
export const toNativeClusterPayload = (
  clusters: readonly NativeClusterPayloadItem[] | null | undefined,
): NativeClusterPayloadItem[] => {
  if (!Array.isArray(clusters) || clusters.length === 0) return [];
  return clusters.map(({ key, center, count, bounds }) => ({ key, center, count, bounds }));
};

/**
 * Резолв выбранного места. Приоритет — `placeKey`: server cluster updates могут
 * пересобрать массив между рендером и тапом, и тогда ни индекс, ни координата не
 * указывают на нужное место однозначно. Неизвестный ключ означает устаревший тап,
 * который надо игнорировать. `id`/`coord`/`index` остаются fallback только для
 * старого WebView-HTML без `placeKey`.
 */
export const resolveSelectedNativePlace = <TRecord extends MapPlaceRecordLike>(
  places: readonly MapPlaceMarker<TRecord>[] | null | undefined,
  message: NativeSelectPlaceMessage,
): MapPlaceMarker<TRecord> | null => {
  if (!Array.isArray(places) || places.length === 0) return null;

  if (message.placeKey) {
    return places.find((place) => place?.placeKey === message.placeKey) ?? null;
  }
  if (message.id) {
    const byId = places.find(
      (place) => place?.record?.id != null && String(place.record.id) === message.id,
    );
    if (byId) return byId;
  }
  if (message.coord) {
    const byCoord = places.find(
      (place) => String(place?.coord ?? place?.record?.coord ?? '').trim() === message.coord,
    );
    if (byCoord) return byCoord;
  }
  const { index } = message;
  if (index != null && index >= 0 && index < places.length) return places[index] ?? null;

  return null;
};
