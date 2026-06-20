// components/trips/planning/tripPlanFormatting.ts
// Презентационные хелперы планирования поездок (Sprint 13): метки транспорта,
// видимости, статуса, типов точек, форматирование сводки маршрута и дат.

import type {
  RoutePointType,
  RouteSummary,
  TripPlanStatus,
  TripRsvp,
  TripTransport,
  TripVisibility,
} from '@/api/plannedTrips';
import type { ThemedColors } from '@/hooks/useTheme';

export const TRANSPORT_LABEL: Record<TripTransport, string> = {
  car: 'На машине',
  bike: 'На велосипеде',
  foot: 'Пешком',
  public: 'Общественный транспорт',
  mixed: 'Смешанный',
};

export const TRANSPORT_ICON_NAME: Record<TripTransport, string> = {
  car: 'truck',
  bike: 'circle',
  foot: 'navigation',
  public: 'map',
  mixed: 'compass',
};

export const VISIBILITY_LABEL: Record<TripVisibility, string> = {
  public: 'Публичная',
  followers: 'Для подписчиков',
  private: 'Личная',
};

export const VISIBILITY_HINT: Record<TripVisibility, string> = {
  public: 'Видна всем и может попасть в каталог сообщества',
  followers: 'Видна только вашим подписчикам',
  private: 'Видна только вам и приглашённым участникам',
};

export const PLAN_STATUS_LABEL: Record<TripPlanStatus, string> = {
  planning: 'Планируется',
  active: 'В пути',
  completed: 'Завершена',
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
  place: 'Место',
  custom: 'Своя точка',
  rest: 'Отдых',
  overnight: 'Ночёвка',
};

export const ROUTE_POINT_ICON_NAME: Record<RoutePointType, string> = {
  place: 'map-pin',
  custom: 'edit-3',
  rest: 'coffee',
  overnight: 'home',
};

export const RSVP_LABEL: Record<TripRsvp, string> = {
  going: 'Поеду',
  maybe: 'Думаю',
  declined: 'Не смогу',
  invited: 'Приглашён',
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

/** «12,4 км» / «252 км». */
export function formatDistance(km: number): string {
  if (km <= 0) return '—';
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} км`;
  return `${Math.round(km)} км`;
}

/** «1 ч 45 мин» / «36 мин». */
export function formatDuration(min: number): string {
  if (min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

export function formatElevation(m: number): string {
  if (m <= 0) return '—';
  return `${m} м`;
}

/** Краткая сводка маршрута строкой: «252 км · 4 ч 12 мин · 3 остановки». */
export function routeSummaryLine(summary: RouteSummary | null): string {
  if (!summary) return 'Маршрут не построен';
  return [
    formatDistance(summary.distanceKm),
    formatDuration(summary.durationMin),
    `${summary.stopsCount} ${pluralStops(summary.stopsCount)}`,
  ].join(' · ');
}

function pluralStops(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'остановка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'остановки';
  return 'остановок';
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** «11 июля 2026» / с временем «11 июля 2026, 08:00». */
export function formatTripDateTime(dateIso: string, time: string | null): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return time ? `${base}, ${time}` : base;
}
