// components/trips/tripFormatting.ts
// Презентационные хелперы каталога публичных поездок (метки/цвета статусов, даты).

import type {
  ApplicationStatus,
  PublicTrip,
  PublicTripStatus,
} from '@/api/publicTrips';
import type { ThemedColors } from '@/hooks/useTheme';

export const TRIP_STATUS_LABEL: Record<PublicTripStatus, string> = {
  open: 'Открыта',
  full: 'Мест нет',
  completed: 'Завершена',
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'Новая',
  pending: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
};

export function tripStatusColor(
  status: PublicTripStatus,
  colors: ThemedColors,
): string {
  switch (status) {
    case 'open':
      return colors.success;
    case 'full':
      return colors.warning;
    case 'completed':
      return colors.textMuted;
  }
}

export function applicationStatusColor(
  status: ApplicationStatus,
  colors: ThemedColors,
): string {
  switch (status) {
    case 'approved':
      return colors.success;
    case 'rejected':
    case 'cancelled':
      return colors.danger;
    case 'new':
    case 'pending':
      return colors.warning;
  }
}

const MONTHS = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** «18–20 июл» / «28 июн». */
export function formatTripDates(trip: Pick<PublicTrip, 'startDate' | 'endDate'>): string {
  if (!trip.endDate || trip.endDate === trip.startDate) return fmt(trip.startDate);
  return `${fmt(trip.startDate)} – ${fmt(trip.endDate)}`;
}

/** Свободные места: «осталось 4 из 6». */
export function formatSeats(trip: Pick<PublicTrip, 'seatsTotal' | 'seatsTaken'>): string {
  const free = Math.max(0, trip.seatsTotal - trip.seatsTaken);
  return `мест: ${free} из ${trip.seatsTotal}`;
}

/** Строка-мета под заголовком карточки. */
export function tripCardMeta(trip: PublicTrip): string {
  return [trip.region, formatTripDates(trip), formatSeats(trip)]
    .filter(Boolean)
    .join(' · ');
}
