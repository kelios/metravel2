/**
 * Shared place/source model карты (#1571, problem MAP-POI-SOURCE-GROUPING-001).
 *
 * Физическое место и запись «точка внутри статьи» — разные сущности: несколько
 * статей могут описывать один объект. Backend (#1567) присваивает канонический
 * `place_id` и отдаёт additive DTO `{ place_id, source_count, primary_source }`
 * поверх прежних плоских полей; контракт зафиксирован в
 * `docs/features/map.md` → «Один физический объект с несколькими источниками» и
 * `openspec/changes/group-map-place-sources/`.
 *
 * Этот модуль — нижний слой без сетевых и компонентных зависимостей:
 * типы, стабильные ключи, нормализация source-полей и группировка O(n).
 * Сетевые адаптеры живут в `api/map.ts`, UI — в PlacePopupCard/renderers.
 */

/** Короткое summary одного материала (статьи), связанного с местом. */
export type MapPlaceSource = {
  /** Стабильный id источника, у backend — `travel-address:<point_id>`. */
  sourceId: string;
  pointId: number | null;
  travelId: number | null;
  articleTitle: string;
  articleUrl: string | null;
  thumbnailUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
};

/** Ответ `GET /api/map/places/{place_id}/sources/` после нормализации. */
export type MapPlaceSourcesPage = {
  results: MapPlaceSource[];
  next: string | null;
};

/**
 * Один физический объект на карте: ровно один marker/hit target на все
 * связанные материалы. `record` — репрезентативная исходная запись, которой
 * продолжают питаться существующие popup/marker-пайплайны.
 */
export type MapPlaceMarker<TRecord = unknown> = {
  /** Ключ маркера: `String(place_id)` либо legacy record identity. */
  placeKey: string;
  /** Канонический id места; null — legacy-запись без place identity. */
  placeId: string | number | null;
  name: string;
  address: string | null;
  coord: string;
  lat: string;
  lng: string;
  /** Заявленное сервером число материалов (не меньше локально собранных). */
  sourceCount: number;
  primarySource: MapPlaceSource | null;
  /**
   * Локально известные материалы (primary + записи, слившиеся по `place_id`).
   * Полный список при `sourceCount > 1` приходит лениво из sources endpoint.
   */
  sources: MapPlaceSource[];
  record: TRecord;
};

/** Структурный минимум записи карты (TravelCoords и MapClusterPoint подходят). */
export type MapPlaceRecordLike = {
  id?: unknown;
  coord?: unknown;
  lat?: unknown;
  lng?: unknown;
  address?: unknown;
  name?: unknown;
  urlTravel?: unknown;
  articleUrl?: unknown;
  travelImageThumbUrl?: unknown;
  imageUrl?: unknown;
  placeId?: string | number;
  sourceCount?: number;
  primarySource?: MapPlaceSource | null;
};

/**
 * Stable identity of a map point for React keys / imperative marker diffing
 * (#1347). Position is part of the identity: a point that moved must be
 * re-created, not silently left at its old coordinates.
 *
 * Перенесена из `components/MapPage/Map/utils.ts` без изменения алгоритма —
 * это же значение служит legacy-fallback для `placeKey`, поэтому живёт в
 * api-слое; компонентный модуль ре-экспортирует её для прежних импортёров.
 */
export const getMapPointIdentityKey = (point: { id?: unknown; coord?: unknown }): string => {
  const id = point?.id != null ? String(point.id).trim() : '';
  const coord = String(point?.coord ?? '').replace(/,/g, '-');
  return id ? `travel-${id}@${coord}` : `travel-${coord}`;
};

/**
 * Ключ места. Группировка опирается ТОЛЬКО на backend `place_id`; расстояние и
 * совпадение названия/адреса не являются identity (запрет fuzzy merge).
 * Legacy-запись без `place_id` сохраняет прежний record-ключ #1347, поэтому
 * существующие маркеры не пересоздаются от одного факта внедрения модели.
 */
export const getMapPlaceKey = (record: MapPlaceRecordLike): string => {
  const placeId = readMapPlaceId(record);
  return placeId != null ? String(placeId) : getMapPointIdentityKey(record);
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const readNumberOrNull = (value: unknown): number | null => {
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const readStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const travelAddressSourceId = (pointId: number): string => `travel-address:${pointId}`;

/**
 * Production #1567 currently serializes `source_id` as the bare point-id
 * string. Client grouping of flat map rows uses `travel-address:<point_id>`.
 * Treat those two spellings as one identity so the pager does not prepend a
 * duplicate primary on top of the fetched collection.
 */
export const canonicalizeMapPlaceSourceId = (
  sourceIdRaw: string | null,
  pointId: number | null,
): string | null => {
  if (pointId != null) {
    const canonical = travelAddressSourceId(pointId);
    if (!sourceIdRaw || sourceIdRaw === String(pointId) || sourceIdRaw === canonical) {
      return canonical;
    }
  }
  return sourceIdRaw;
};

export const isSameMapPlaceSource = (
  a: Pick<MapPlaceSource, 'sourceId' | 'pointId'> | null | undefined,
  b: Pick<MapPlaceSource, 'sourceId' | 'pointId'> | null | undefined,
): boolean => {
  if (!a || !b) return false;
  if (a.sourceId === b.sourceId) return true;
  if (a.pointId != null && b.pointId != null && a.pointId === b.pointId) return true;
  const aCanon = canonicalizeMapPlaceSourceId(a.sourceId, a.pointId);
  const bCanon = canonicalizeMapPlaceSourceId(b.sourceId, b.pointId);
  return Boolean(aCanon && bCanon && aCanon === bCanon);
};

/** `place_id` из сырой записи или уже нормализованного объекта. */
export const readMapPlaceId = (record: unknown): string | number | null => {
  if (!record || typeof record !== 'object') return null;
  const t = record as Record<string, unknown>;
  const raw = t.placeId ?? t.place_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  return null;
};

export type NormalizeMediaUrl = (value: unknown) => string;

const identityUrl: NormalizeMediaUrl = (value) => readStringOrNull(value) ?? '';

/**
 * Нормализация одного source summary из DTO (`primary_source` или элемент
 * `results`). `normalizeUrl` инжектится вызывающим слоем (`api/map.ts` передаёт
 * свой `normalizeImageUrl`), чтобы правила медиа-URL не дублировались здесь.
 */
export const normalizeMapPlaceSource = (
  raw: unknown,
  normalizeUrl: NormalizeMediaUrl = identityUrl,
): MapPlaceSource | null => {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;

  const pointId = readNumberOrNull(t.pointId ?? t.point_id);
  const sourceId = canonicalizeMapPlaceSourceId(
    readStringOrNull(t.sourceId ?? t.source_id),
    pointId,
  );
  if (!sourceId) return null;

  const thumbnailUrl = normalizeUrl(t.thumbnailUrl ?? t.thumbnail_url) || null;

  return {
    sourceId,
    pointId,
    travelId: readNumberOrNull(t.travelId ?? t.travel_id),
    articleTitle: readStringOrNull(t.articleTitle ?? t.article_title) ?? '',
    articleUrl: readStringOrNull(t.articleUrl ?? t.article_url),
    thumbnailUrl,
    thumbnailWidth: readNumberOrNull(t.thumbnailWidth ?? t.thumbnail_width),
    thumbnailHeight: readNumberOrNull(t.thumbnailHeight ?? t.thumbnail_height),
  };
};

/**
 * Place-поля grouped DTO для спреда в существующие нормализаторы записей
 * (`normalizeClusterPoint`/`normalizeTravelCoordsItem`): без них новые поля
 * терялись бы на явной пересборке объекта. Возвращает только присутствующее.
 */
export const readMapPlaceMarkerFields = (
  raw: Record<string, unknown>,
  normalizeUrl: NormalizeMediaUrl = identityUrl,
): Pick<MapPlaceRecordLike, 'placeId' | 'sourceCount' | 'primarySource'> => {
  const out: Pick<MapPlaceRecordLike, 'placeId' | 'sourceCount' | 'primarySource'> = {};

  const placeId = readMapPlaceId(raw);
  if (placeId != null) out.placeId = placeId;

  const sourceCount = readNumberOrNull(raw.sourceCount ?? raw.source_count);
  if (sourceCount != null && sourceCount > 0) out.sourceCount = Math.floor(sourceCount);

  const primarySource = normalizeMapPlaceSource(raw.primarySource ?? raw.primary_source, normalizeUrl);
  if (primarySource) out.primarySource = primarySource;

  return out;
};

/** Best-effort source из плоской legacy-записи (для локального слияния). */
const derivePlaceSourceFromRecord = (record: MapPlaceRecordLike): MapPlaceSource | null => {
  if (record.primarySource) return record.primarySource;

  const pointId = readNumberOrNull(record.id);
  const articleUrl = readStringOrNull(record.articleUrl) ?? readStringOrNull(record.urlTravel);
  const thumbnailUrl =
    readStringOrNull(record.travelImageThumbUrl) ?? readStringOrNull(record.imageUrl);
  if (pointId == null && !articleUrl && !thumbnailUrl) return null;

  return {
    sourceId:
      pointId != null
        ? travelAddressSourceId(pointId)
        : `record:${getMapPointIdentityKey(record)}`,
    pointId,
    travelId: null,
    articleTitle: '',
    articleUrl,
    thumbnailUrl,
    thumbnailWidth: null,
    thumbnailHeight: null,
  };
};

const readRecordString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Группировка записей в места: один проход, `Map` по `placeKey`, порядок
 * первого появления сохраняется. Сливаются ТОЛЬКО записи с одинаковым
 * `place_id`; legacy-записи без него всегда остаются отдельными маркерами
 * (коллизия record-ключа получает суффикс `#n` по образцу MarkerClusterGroup,
 * а не слияние). Вызывается один раз на обновление dataset; перелистывание
 * popup не должно приводить к повторной группировке или пересборке маркеров.
 */
export const groupMapPlaces = <TRecord extends MapPlaceRecordLike>(
  records: readonly TRecord[] | null | undefined,
): MapPlaceMarker<TRecord>[] => {
  const out: MapPlaceMarker<TRecord>[] = [];
  if (!Array.isArray(records) || records.length === 0) return out;

  const byPlaceKey = new Map<string, MapPlaceMarker<TRecord>>();
  const legacyKeySeen = new Map<string, number>();

  for (const record of records) {
    if (!record || typeof record !== 'object') continue;

    const placeId = readMapPlaceId(record);
    const source = derivePlaceSourceFromRecord(record);

    if (placeId == null) {
      const baseKey = getMapPointIdentityKey(record);
      const duplicateIndex = legacyKeySeen.get(baseKey) ?? 0;
      legacyKeySeen.set(baseKey, duplicateIndex + 1);
      out.push({
        placeKey: duplicateIndex === 0 ? baseKey : `${baseKey}#${duplicateIndex}`,
        placeId: null,
        name: readRecordString(record.name) || readRecordString(record.address),
        address: readStringOrNull(record.address),
        coord: readRecordString(record.coord),
        lat: readRecordString(record.lat),
        lng: readRecordString(record.lng),
        sourceCount: 1,
        primarySource: source,
        sources: source ? [source] : [],
        record,
      });
      continue;
    }

    const placeKey = String(placeId);
    const existing = byPlaceKey.get(placeKey);
    if (!existing) {
      const declaredCount = isFiniteNumber(record.sourceCount) ? record.sourceCount : 0;
      const sources = source ? [source] : [];
      const marker: MapPlaceMarker<TRecord> = {
        placeKey,
        placeId,
        name: readRecordString(record.name) || readRecordString(record.address),
        address: readStringOrNull(record.address),
        coord: readRecordString(record.coord),
        lat: readRecordString(record.lat),
        lng: readRecordString(record.lng),
        sourceCount: Math.max(declaredCount, sources.length, 1),
        primarySource: record.primarySource ?? source,
        sources,
        record,
      };
      byPlaceKey.set(placeKey, marker);
      out.push(marker);
      continue;
    }

    // Вторая запись того же места: канонические поля остаются от первой
    // (координата/название/адрес принадлежат месту, не материалу), источник
    // добавляется без дублей по sourceId.
    if (source && !existing.sources.some((s) => isSameMapPlaceSource(s, source))) {
      existing.sources.push(source);
    }
    const declaredCount = isFiniteNumber(record.sourceCount) ? record.sourceCount : 0;
    existing.sourceCount = Math.max(existing.sourceCount, declaredCount, existing.sources.length);
    if (!existing.primarySource && source) existing.primarySource = source;
  }

  return out;
};

/**
 * Представление записи для popup/selection на стыке grouped place → legacy UI.
 *
 * Renderers исторически передают карточке плоский `record`, а вычисленные
 * `sourceCount`/`primarySource` живут на `MapPlaceMarker`. Для переходного
 * payload из нескольких строк с одним `place_id`, но без `source_count`, это
 * молча отключало lazy sources и pager. Протаскиваем только компактные summary
 * поля; полный `sources` в record/WebView payload намеренно не попадает.
 *
 * Исходную запись не мутируем. В `MarkerClusterGroup` helper вызывается только
 * ПОСЛЕ lookup координат по object identity — это сохраняет keyed diff #1347.
 */
export const materializeMapPlaceRecord = <TRecord extends MapPlaceRecordLike>(
  place: MapPlaceMarker<TRecord>,
): TRecord => {
  const record = place.record;
  if (place.placeId == null) return record;

  if (
    readMapPlaceId(record) === place.placeId &&
    record.sourceCount === place.sourceCount &&
    record.primarySource === place.primarySource
  ) {
    return record;
  }

  return {
    ...record,
    placeId: place.placeId,
    sourceCount: place.sourceCount,
    primarySource: place.primarySource,
  };
};
