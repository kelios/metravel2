// components/trips/planning/routeOvernightBooking.ts
// #1843: черновик формы брони ночёвки и её показ в строке точки. Правила разбора
// значений общие с API-слоем и живут в `utils/overnightBooking`; здесь только то,
// что принадлежит интерфейсу, — строковый черновик полей, тексты ошибок и формат
// вывода.
import type { OvernightBooking, RoutePoint } from '@/api/plannedTrips';
import { translate as i18nT } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import {
  hasOvernightBooking,
  normalizeBookingUrl,
  normalizeCheckinTime,
  parseOvernightPrice,
  pointOvernightBooking,
} from '@/utils/overnightBooking';

/** Черновик формы: все четыре поля — строки, пока пользователь их набирает. */
export interface OvernightBookingDraft {
  address: string;
  url: string;
  price: string;
  checkinTime: string;
}

export type OvernightBookingField = keyof OvernightBookingDraft;

export const EMPTY_OVERNIGHT_BOOKING_DRAFT: OvernightBookingDraft = {
  address: '',
  url: '',
  price: '',
  checkinTime: '',
};

/** Черновик из точки маршрута. У не-ночёвки — пустой: бронь ей не принадлежит. */
export const overnightBookingDraft = (
  point: Pick<RoutePoint, 'type' | 'booking'>,
): OvernightBookingDraft => {
  const booking = pointOvernightBooking(point);
  if (!booking) return { ...EMPTY_OVERNIGHT_BOOKING_DRAFT };
  return {
    address: booking.address ?? '',
    url: booking.url ?? '',
    price: booking.price != null ? String(booking.price) : '',
    checkinTime: booking.checkinTime ?? '',
  };
};

/**
 * Черновик → бронь. Ошибка возвращается значением, а не бросается: форма
 * показывает её там же, где ошибку координат, и не теряет введённое.
 */
export const parseOvernightBookingDraft = (
  draft: OvernightBookingDraft,
): { booking: OvernightBooking | null; error: string | null } => {
  const rawUrl = draft.url.trim();
  const url = rawUrl ? normalizeBookingUrl(rawUrl) : null;
  if (rawUrl && !url) {
    return { booking: null, error: i18nT('tripsStatic:plan.overnight.errors.url') };
  }

  const rawPrice = draft.price.trim();
  const price = rawPrice ? parseOvernightPrice(rawPrice) : null;
  if (rawPrice && price == null) {
    return { booking: null, error: i18nT('tripsStatic:plan.overnight.errors.price') };
  }

  const rawCheckin = draft.checkinTime.trim();
  const checkinTime = rawCheckin ? normalizeCheckinTime(rawCheckin) : null;
  if (rawCheckin && checkinTime == null) {
    return { booking: null, error: i18nT('tripsStatic:plan.overnight.errors.checkin') };
  }

  const booking: OvernightBooking = {
    address: draft.address.trim() || null,
    url,
    price,
    checkinTime,
  };
  return { booking: hasOvernightBooking(booking) ? booking : null, error: null };
};

/**
 * Цена за ночь строкой: разряды по активной локали. Валюты в контракте поля
 * нет, поэтому символ не подставляется — единицу задаёт подпись «за ночь».
 */
export const formatOvernightPrice = (price: number | null | undefined): string | null =>
  price == null ? null : formatNumber(price);
