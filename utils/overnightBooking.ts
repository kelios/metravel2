// utils/overnightBooking.ts
// #1843: данные брони ночёвки — разбор, нормализация и оба направления обмена с
// бэкендом. Слой намеренно util, а не компонент: те же правила нужны и
// нормализаторам ответа (`api/plannedTripsNormalizers`), и сборке PUT маршрута
// (`api/plannedTripsRequests`), а `api/` в проекте не импортирует `components/`.
// Подписи, тексты ошибок и черновик формы живут этажом выше, в
// `components/trips/planning/routeOvernightBooking.ts`.
import type { OvernightBooking, RoutePoint, RoutePointType } from '@/api/plannedTripsTypes';
import { normalizeHttpOrInternalUrl } from '@/utils/externalLinks';

/**
 * Поля брони принадлежат единственному типу точки. Предикат вынесен, а не
 * размазан по `=== 'overnight'`: одно и то же правило решает и «показывать ли
 * блок в форме», и «класть ли поля в PUT», и «рисовать ли строку брони».
 */
export const isOvernightPoint = (type: RoutePointType): boolean => type === 'overnight';

/**
 * `ЧЧ:ММ` из ответа бэкенда (`TimeField` отдаёт `14:00:00`) или из ручного ввода.
 * Точка и запятая — то, что реально набирают на цифровой клавиатуре вместо
 * двоеточия; секунды бэкенда до пользователя не доезжают.
 */
export const normalizeCheckinTime = (raw: unknown): string | null => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  const match = /^(\d{1,2})[:.,](\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Цена за ночь. Запятая — десятичный разделитель во всех продуктовых локалях
 * (RU/BE/UK/PL), поэтому «42,50» это то же число, что «42.50», а не мусор.
 * Бэкенд отдаёт `DecimalField` строкой, поэтому число и строка равноправны.
 */
export const parseOvernightPrice = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;
  const value = typeof raw === 'string' ? raw.trim().replace(',', '.') : '';
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Адрес брони проходит тот же контракт внешних ссылок, что и ссылки в описании
 * точки (#1494): в анкор не попадёт ничего, что не прошло `getSafeExternalUrl`,
 * даже если такое лежит в базе. Голому `booking.com/...` дописывается `https://`.
 */
export const normalizeBookingUrl = (raw: unknown): string | null =>
  (typeof raw === 'string' ? normalizeHttpOrInternalUrl(raw) : '') || null;

export const hasOvernightBooking = (booking: OvernightBooking | null | undefined): boolean =>
  Boolean(
    booking && (booking.address || booking.url || booking.price != null || booking.checkinTime),
  );

/**
 * Бронь точки — только у ночёвки. Тип точки здесь главнее содержимого: смена
 * типа на «отдых» обязана скрыть и перестать сохранять уже введённую бронь.
 */
export const pointOvernightBooking = (
  point: Pick<RoutePoint, 'type' | 'booking'>,
): OvernightBooking | null =>
  isOvernightPoint(point.type) && hasOvernightBooking(point.booking) ? point.booking ?? null : null;

const trimmedOrNull = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
};

/**
 * Бронь из ответа бэкенда. Возвращает `null`, когда не заполнено ни одно поле:
 * пустой объект заставил бы строку списка рисовать пустой блок брони. Поля
 * необязательные — развёрнутый бэкенд без миграции #1843 их просто не отдаёт.
 */
export const overnightBookingFromBe = (source: {
  address?: unknown;
  booking_url?: unknown;
  price?: unknown;
  checkin_time?: unknown;
}): OvernightBooking | null => {
  const booking: OvernightBooking = {
    address: trimmedOrNull(source.address),
    url: normalizeBookingUrl(source.booking_url),
    price: parseOvernightPrice(source.price),
    checkinTime: normalizeCheckinTime(source.checkin_time),
  };
  return hasOvernightBooking(booking) ? booking : null;
};

/**
 * Поля брони для payload сохранения маршрута. Всему, что не ночёвка, отдаёт
 * пустой объект: бэкенд эти поля у остальных типов точек отклоняет, а PUT
 * маршрута атомарный — один лишний ключ уронил бы сохранение всего маршрута
 * целиком, как это было с `point_type` в #1532.
 *
 * Пустое значение текстовых полей — пустая строка, а не `null`: по контракту
 * (docs/features/trips.md, пункт 14) `address` и `booking_url` это
 * `blank=True, default=''` без `null=True`, и DRF отклонил бы `null` вместе со
 * всем маршрутом. Тот же приём, что у `description` в этом же payload. Цена и
 * время заезда, наоборот, `null=True` — там пустое значение только `null`.
 */
export const overnightBookingPayload = (
  point: Pick<RoutePoint, 'type' | 'booking'>,
): {
  address?: string;
  booking_url?: string;
  price?: number | null;
  checkin_time?: string | null;
} => {
  if (!isOvernightPoint(point.type)) return {};
  const booking = pointOvernightBooking(point);
  return {
    address: booking?.address ?? '',
    booking_url: booking?.url ?? '',
    price: booking?.price ?? null,
    checkin_time: booking?.checkinTime ?? null,
  };
};
