// components/trips/planning/tripPlanFormatting.ts
// Презентационные хелперы планирования поездок (Sprint 13): метки транспорта,
// видимости, статуса, типов точек, форматирование сводки маршрута и дат.

import type {
  RoutingState,
  RoutePointType,
  RouteSummary,
  TripBikeType,
  TripPlanStatus,
  TripRsvp,
  TripTransport,
  TripVisibility,
} from '@/api/plannedTrips';
import type { ThemedColors } from '@/hooks/useTheme';
import { selectPlural, translate as i18nT } from '@/i18n'
import { formatInteger } from '@/i18n/format'
import { formatDistance as formatDistanceKm } from '@/utils/distanceCalculator'
import { formatTripDateLong, formatTripDateTimeLong } from '@/utils/tripDateTime'


export const TRANSPORT_LABEL: Record<TripTransport, string> = {
  get car() { return i18nT('tripsStatic:plan.transport.car') },
  get bike() { return i18nT('tripsStatic:plan.transport.bike') },
  get foot() { return i18nT('tripsStatic:plan.transport.foot') },
  get public() { return i18nT('tripsStatic:plan.transport.public') },
  get mixed() { return i18nT('tripsStatic:plan.transport.mixed') },
};

export const BIKE_TYPE_LABEL: Record<TripBikeType, string> = {
  get regular() { return i18nT('tripsStatic:plan.bikeType.regular') },
  get road() { return i18nT('tripsStatic:plan.bikeType.road') },
  get mountain() { return i18nT('tripsStatic:plan.bikeType.mountain') },
};

export const TRANSPORT_ICON_NAME: Record<TripTransport, string> = {
  car: 'truck',
  bike: 'circle',
  foot: 'navigation',
  public: 'map',
  mixed: 'compass',
};

export const VISIBILITY_LABEL: Record<TripVisibility, string> = {
  get public() { return i18nT('tripsStatic:plan.visibility.public') },
  get followers() { return i18nT('tripsStatic:plan.visibility.followers') },
  get private() { return i18nT('tripsStatic:plan.visibility.private') },
};

// Иконка обязана совпадать с подписью: «глаз» рядом с «Личная» читался как
// «поездку видно всем» (#1314).
export const VISIBILITY_ICON_NAME: Record<TripVisibility, string> = {
  public: 'globe',
  followers: 'users',
  private: 'lock',
};

export const VISIBILITY_HINT: Record<TripVisibility, string> = {
  get public() { return i18nT('tripsStatic:plan.visibilityHint.public') },
  get followers() { return i18nT('tripsStatic:plan.visibilityHint.followers') },
  get private() { return i18nT('tripsStatic:plan.visibilityHint.private') },
};

export const PLAN_STATUS_LABEL: Record<TripPlanStatus, string> = {
  get planning() { return i18nT('tripsStatic:plan.status.planning') },
  get active() { return i18nT('tripsStatic:plan.status.active') },
  get completed() { return i18nT('tripsStatic:plan.status.completed') },
};

export function planStatusColor(
  status: TripPlanStatus,
  colors: ThemedColors,
): string {
  switch (status) {
    case 'planning':
      return colors.info;
    case 'active':
      return colors.success;
    case 'completed':
      return colors.textMuted;
  }
}

export const ROUTE_POINT_LABEL: Record<RoutePointType, string> = {
  get place() { return i18nT('tripsStatic:plan.routePoint.place') },
  get custom() { return i18nT('tripsStatic:plan.routePoint.custom') },
  get rest() { return i18nT('tripsStatic:plan.routePoint.rest') },
  get overnight() { return i18nT('tripsStatic:plan.routePoint.overnight') },
};

export const ROUTE_POINT_ICON_NAME: Record<RoutePointType, string> = {
  place: 'map-pin',
  custom: 'edit-3',
  rest: 'coffee',
  overnight: 'home',
};

export const RSVP_LABEL: Record<TripRsvp, string> = {
  get going() { return i18nT('tripsStatic:plan.rsvp.going') },
  get maybe() { return i18nT('tripsStatic:plan.rsvp.maybe') },
  get declined() { return i18nT('tripsStatic:plan.rsvp.declined') },
  get invited() { return i18nT('tripsStatic:plan.rsvp.invited') },
};

export function rsvpColor(rsvp: TripRsvp, colors: ThemedColors): string {
  switch (rsvp) {
    case 'going':
      return colors.success;
    case 'maybe':
      return colors.warning;
    case 'declined':
      return colors.danger;
    case 'invited':
      return colors.textMuted;
  }
}

/**
 * «12,4 км» / «252 км» / «2 800 км» — числом занимается общий форматтер
 * (#1440), здесь остаётся только прочерк для пустого маршрута.
 */
export function formatDistance(km: number): string {
  if (km <= 0) return '—';
  return formatDistanceKm(km);
}

/** «1 ч 45 мин» / «36 мин». */
export function formatDuration(min: number): string {
  if (min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return i18nT('trips:components.trips.planning.tripPlanFormatting.value1_min_eb78c758', { value1: formatInteger(m) });
  if (m === 0) return i18nT('trips:components.trips.planning.tripPlanFormatting.value1_ch_a0bf8320', { value1: formatInteger(h) });
  return i18nT('trips:components.trips.planning.tripPlanFormatting.value1_ch_value2_min_124c7a8f', { value1: formatInteger(h), value2: formatInteger(m) });
}

export function formatElevation(m: number): string {
  if (m <= 0) return '—';
  return i18nT('trips:components.trips.planning.tripPlanFormatting.value1_m_7f82c902', { value1: formatInteger(m) });
}

/** Краткая сводка маршрута строкой: «252 км · 4 ч 12 мин · 3 остановки». */
export function routeSummaryLine(summary: RouteSummary | null): string {
  if (!summary) return i18nT('trips:components.trips.planning.tripPlanFormatting.marshrut_ne_postroen_e3365d5c');
  return [
    formatDistance(summary.distanceKm),
    formatDuration(summary.durationMin),
    `${summary.stopsCount} ${pluralStops(summary.stopsCount)}`,
  ].join(' · ');
}

export function isRouteApproximate(routingState: RoutingState | null | undefined): boolean {
  if (!routingState) return false;
  return routingState.provider === 'direct' || routingState.isOptimal === false;
}

export function routingStateLabel(routingState: RoutingState | null | undefined): string {
  if (!routingState) return i18nT('trips:components.trips.planning.tripPlanFormatting.lokalnaya_otsenka_1df49d8f');
  if (isRouteApproximate(routingState)) return i18nT('trips:components.trips.planning.tripPlanFormatting.priblizitelnyy_marshrut_915ddadf');
  if (routingState.provider === 'ors') return i18nT('trips:components.trips.planning.tripPlanFormatting.marshrut_postroen_ors_c62e109b');
  return i18nT('trips:components.trips.planning.tripPlanFormatting.marshrut_postroen_value1_19ed87bb', { value1: routingState.provider });
}

// Машинные коды бэка (routing/services.py, trips/views.py) → человеческий текст.
// Сырые коды вида `not_enough_points` пользователю не показываем.
const ROUTING_REASON_HINT: Record<string, string> = {
  get not_enough_points() { return i18nT('tripsStatic:plan.routingReason.notEnoughPoints') },
  get route_provider_unavailable() { return i18nT('tripsStatic:plan.routingReason.providerUnavailable') },
  get routing_provider_unavailable() { return i18nT('tripsStatic:plan.routingReason.providerUnavailable') },
};

function humanizeRoutingReason(reason: string | null | undefined): string | null {
  const code = (reason ?? '').trim();
  if (!code) return null;
  if (ROUTING_REASON_HINT[code]) return ROUTING_REASON_HINT[code];
  if (/^ors_/.test(code) || /_not_configured$/.test(code)) {
    return i18nT('trips:components.trips.planning.tripPlanFormatting.servis_postroeniya_marshrutov_vremenno_nedos_925a517c');
  }
  // Русский текст (например, из мока) показываем как есть; латинский код/фразу — нет.
  if (/[а-яё]/i.test(code)) return code;
  return null;
}

export function routingStateHint(routingState: RoutingState | null | undefined): string | null {
  if (!routingState || !isRouteApproximate(routingState)) return null;
  const candidates = [...routingState.warnings, routingState.fallbackReason];
  for (const candidate of candidates) {
    const humanized = humanizeRoutingReason(candidate);
    if (humanized) return humanized;
  }
  return i18nT('trips:components.trips.planning.tripPlanFormatting.servis_routinga_ne_smog_postroit_dorogu_ili__b8007009');
}

function pluralStops(n: number): string {
  return selectPlural(n, {
    one: i18nT('trips:components.trips.planning.tripPlanFormatting.ostanovka_19da4ade'),
    few: i18nT('trips:components.trips.planning.tripPlanFormatting.ostanovki_9b530687'),
    many: i18nT('trips:components.trips.planning.tripPlanFormatting.ostanovok_0abc545a'),
    other: i18nT('trips:components.trips.planning.tripPlanFormatting.ostanovok_0abc545a'),
  });
}

/**
 * Значение поля формы: пустое — это приглашение выбрать дату, а не «дата
 * неизвестна». Всё остальное разбирает общий модуль (#1313).
 */
export function formatTripDisplayDate(value: string): string {
  if (!value.trim()) return i18nT('trips:components.trips.planning.tripPlanFormatting.vyberite_datu_54abc3cf');
  return formatTripDateLong(value);
}

/** «11 июля 2026 г.» / с временем «11 июля 2026 г., 08:00». */
export function formatTripDateTime(dateIso: string, time: string | null): string {
  return formatTripDateTimeLong(dateIso, time);
}
