import { Platform } from 'react-native';
import { queueAnalyticsEvent } from '@/utils/analytics';

/**
 * События экрана /map (#2908). Только web: native-телеметрия ведётся своим
 * словарём (#2841), и у карты на native отдельный рендер. Все параметры —
 * перечислимые или числовые, без адресов, координат и текста поиска.
 */
export const MAP_ANALYTICS_EVENTS = {
  open: 'map_open',
  filterChange: 'map_filter_change',
  placeSearch: 'map_place_search',
  markerOpen: 'map_marker_open',
  routeBuild: 'map_route_build',
} as const;

export type MapOpenEntry = 'direct' | 'place_link' | 'coords_link';
export type MapFilterName = 'categories' | 'categoryTravelAddress' | 'radius' | 'reset';
export type MapMarkerKind = 'place' | 'travel_point' | 'point';
export type MapPlaceSearchOutcome = 'found' | 'empty' | 'error';

type MarkerLike = {
  placeId?: unknown;
  urlTravel?: unknown;
  travelId?: unknown;
};

const isWeb = () => Platform.OS === 'web';

const emit = (eventName: string, params: Record<string, unknown>) => {
  if (!isWeb()) return;
  queueAnalyticsEvent(
    eventName,
    Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)),
  );
};

export const resolveMapMarkerKind = (point: MarkerLike | null | undefined): MapMarkerKind => {
  if (!point) return 'point';
  const hasValue = (value: unknown) =>
    value !== undefined && value !== null && String(value).trim().length > 0;
  if (hasValue(point.placeId)) return 'place';
  if (hasValue(point.urlTravel) || hasValue(point.travelId)) return 'travel_point';
  return 'point';
};

export const trackMapOpened = ({ entry, isMobile }: { entry: MapOpenEntry; isMobile: boolean }) => {
  emit(MAP_ANALYTICS_EVENTS.open, { entry, layout: isMobile ? 'mobile' : 'desktop' });
};

export const trackMapPlaceSearch = (
  outcome: MapPlaceSearchOutcome,
  isMobile: boolean,
  radiusKm: number,
) => {
  emit(MAP_ANALYTICS_EVENTS.placeSearch, {
    outcome,
    layout: isMobile ? 'mobile' : 'desktop',
    radius_km: radiusKm,
  });
};

export const trackMapFilterChanged = ({
  filter,
  valueCount,
  radiusKm,
}: {
  filter: MapFilterName;
  valueCount?: number;
  radiusKm?: number;
}) => {
  emit(MAP_ANALYTICS_EVENTS.filterChange, {
    filter,
    value_count: valueCount,
    radius_km: radiusKm,
  });
};

export const trackMapMarkerOpened = ({
  point,
  surface,
}: {
  point: MarkerLike | null | undefined;
  surface: 'popup' | 'card';
}) => {
  emit(MAP_ANALYTICS_EVENTS.markerOpen, { kind: resolveMapMarkerKind(point), surface });
};

/**
 * Колбэк для `onMarkerOpened` карты экрана /map. Общий `Map.web` рендерят и
 * карта квестов, планировщик поездки и точки пользователя — их тапы в
 * `map_marker_open` не попадают, потому что колбэк передаёт только /map.
 * Модульная функция: ссылка стабильна и не ломает memo-компаратор карты.
 */
export const reportMapScreenMarkerOpened = (
  point: MarkerLike | null | undefined,
  surface: 'popup' | 'card',
) => {
  trackMapMarkerOpened({ point, surface });
};

export const trackMapRouteBuilt = ({
  transportMode,
  pointsCount,
  distanceMeters,
}: {
  transportMode: string;
  pointsCount: number;
  distanceMeters: number;
}) => {
  emit(MAP_ANALYTICS_EVENTS.routeBuild, {
    transport_mode: transportMode,
    points_count: pointsCount,
    // Округление до км: длина — для разреза «короткие/длинные», не для восстановления маршрута.
    distance_km: Math.round(distanceMeters / 1000),
  });
};
