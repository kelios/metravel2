// components/trips/tripFormatting.ts
// Презентационные хелперы каталога публичных поездок (метки/цвета статусов, даты).

import type {
  ApplicationStatus,
  PublicTrip,
  PublicTripStatus,
} from '@/api/publicTrips';
import type { ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'
import { formatDate } from '@/i18n/format'


export const TRIP_STATUS_LABEL: Record<PublicTripStatus, string> = {
  get open() { return i18nT('tripsStatic:trip.status.open') },
  get full() { return i18nT('tripsStatic:trip.status.full') },
  get completed() { return i18nT('tripsStatic:trip.status.completed') },
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  get new() { return i18nT('tripsStatic:trip.application.new') },
  get pending() { return i18nT('tripsStatic:trip.application.pending') },
  get approved() { return i18nT('tripsStatic:trip.application.approved') },
  get rejected() { return i18nT('tripsStatic:trip.application.rejected') },
  get cancelled() { return i18nT('tripsStatic:trip.application.cancelled') },
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

function fmt(iso: string): string {
  if (typeof iso !== 'string' || !iso.trim()) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return iso;
  }
  return formatDate(d, { day: 'numeric', month: 'short' });
}

/** «18 июл. – 20 июл.» / «28 июн.». */
export function formatTripDates(trip: Pick<PublicTrip, 'startDate' | 'endDate'>): string {
  if (!trip.endDate || trip.endDate === trip.startDate) return fmt(trip.startDate);
  return `${fmt(trip.startDate)} – ${fmt(trip.endDate)}`;
}

/** Свободные места: «осталось 4 из 6». */
export function formatSeats(trip: Pick<PublicTrip, 'seatsTotal' | 'seatsTaken'>): string {
  const free = Math.max(0, trip.seatsTotal - trip.seatsTaken);
  return i18nT('trips:components.trips.tripFormatting.mest_value1_iz_value2_11fa56e7', { value1: free, value2: trip.seatsTotal });
}

/** Строка-мета под заголовком карточки. */
export function tripCardMeta(trip: PublicTrip): string {
  return [trip.region, formatTripDates(trip), formatSeats(trip)]
    .filter(Boolean)
    .join(' · ');
}
