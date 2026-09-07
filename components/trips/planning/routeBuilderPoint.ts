// components/trips/planning/routeBuilderPoint.ts
// Чистые хелперы конструктора маршрута: разбор чисел и координат, нормализация
// имени точки из адреса и подпись маршрута. Вынесены из RouteBuilder.tsx (#1825)
// дословно — React и состояния здесь нет, поведение то же самое.
import type { Travel, TravelAddressItem } from '@/types/types';
import { type RoutePoint, type RoutePointType } from '@/api/plannedTrips';
import { ROUTE_POINT_COORDINATE_PRECISION } from '@/components/trips/planning/tripPlanRouteMap.types';
import { pointOvernightBooking } from '@/utils/overnightBooking';
import { translate as i18nT } from '@/i18n'

export const POINT_TYPES: RoutePointType[] = ['place', 'custom', 'rest', 'overnight'];
/**
 * Старт и финиш: тот же порог «маршрут можно строить», что и на /map.
 * Объявление единственное на каталог (#1870): по нему живут и бейдж «Готово»
 * шага 2 (`RoutePointsSection`), и лесенка CTA (`routeBuilderCta`), поэтому
 * поднятый порог двигает оба места сразу и они не расходятся.
 */
export const MIN_ROUTE_POINTS = 2;
export const SITE_SEARCH_MIN_LENGTH = 2;

export const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseLatLngPair = (value: unknown): { lat: number; lng: number } | null => {
  if (typeof value !== 'string') return null;
  const [latRaw, lngRaw] = value.split(',').map((part) => part.trim());
  const lat = parseNumber(latRaw);
  const lng = parseNumber(lngRaw);
  if (lat == null || lng == null) return null;
  return { lat, lng };
};

const travelAddressCoordinates = (point: TravelAddressItem): { lat: number; lng: number } | null => {
  if (typeof point === 'string') return null;
  const directLat = parseNumber(point.lat);
  const directLng = parseNumber(point.lng);
  if (directLat != null && directLng != null) return { lat: directLat, lng: directLng };
  return parseLatLngPair(point.coords);
};

export const travelCoordinates = (travel: Travel): [number, number] | null => {
  const routePoint = travel.coordsMeTravel?.find((point) => {
    const lat = parseNumber(point.lat);
    const lng = parseNumber(point.lng);
    return lat != null && lng != null;
  });
  if (routePoint) return [Number(routePoint.lng), Number(routePoint.lat)];

  const addressPoint = travel.travelAddress
    ?.map(travelAddressCoordinates)
    .find((point): point is { lat: number; lng: number } => point != null);
  return addressPoint ? [addressPoint.lng, addressPoint.lat] : null;
};

export const compactText = (parts: Array<string | number | null | undefined>): string =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' · ');

/**
 * Шаг округления координат точки: один и тот же для ручного ввода, карты и
 * ключа защёлки кадра (#1781) — живёт в общем контракте карты маршрута.
 */
export const COORDINATE_PRECISION = ROUTE_POINT_COORDINATE_PRECISION;

export const formatCoordinateInput = (value: number): string => {
  const rounded = value.toFixed(COORDINATE_PRECISION);
  return rounded.replace(/\.?0+$/, '');
};

// #1491/#1782: адресный поиск отдаёт полный адрес до страны. Голова адреса
// становится названием точки, весь адрес остаётся под рукой для описания.
export const addressPointName = (address: string): string => {
  const full = address.trim();
  const [head] = full.split(',');
  return head.trim() || full;
};

export const coordinatesFromFields = (
  latValue: string,
  lngValue: string,
): { coordinates: [number, number] | null; error: string | null } => {
  const latText = latValue.trim();
  const lngText = lngValue.trim();
  if (!latText && !lngText) return { coordinates: null, error: null };

  const lat = parseNumber(latText);
  const lng = parseNumber(lngText);
  if (lat == null || lng == null) {
    return { coordinates: null, error: i18nT('trips:components.trips.planning.RouteBuilder.ukazhite_shirotu_i_dolgotu_chislami_06a43fa9') };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { coordinates: null, error: i18nT('trips:components.trips.planning.RouteBuilder.shirota_dolzhna_byt_ot_90_do_90_dolgota_ot_1_964ccc95') };
  }

  return { coordinates: [lng, lat], error: null };
};

// #1843: бронь ночёвки — такая же несохранённая правка, как имя точки. Без неё в
// подписи заполнение адреса, ссылки, цены или заезда не меняло сигнатуру, кнопка
// «Сохранить маршрут» не появлялась вовсе (`routeBuilderCta`), и `handleSave`
// уходил в ранний возврат по `!hasUnsavedRouteChanges` — введённая бронь молча
// пропадала при уходе с экрана. Значение берётся через `pointOvernightBooking`,
// потому что в PUT уезжает ровно оно: бронь у точки не-ночёвки не сохраняется, и
// «менять» её нечем.
const bookingSignature = (point: RoutePoint): string => {
  const booking = pointOvernightBooking(point);
  if (!booking) return '';
  return [
    booking.address ?? '',
    booking.url ?? '',
    booking.price ?? '',
    booking.checkinTime ?? '',
  ].join('~');
};

export const routeSignature = (route: RoutePoint[]): string =>
  route
    .map((point) => {
      const coords = point.coordinates
        ? `${formatCoordinateInput(point.coordinates[0])},${formatCoordinateInput(point.coordinates[1])}`
        : '';
      return [
        point.id,
        point.type,
        point.placeId ?? '',
        point.name,
        point.description ?? '',
        coords,
        bookingSignature(point),
      ].join('|');
    })
    .join('>');
