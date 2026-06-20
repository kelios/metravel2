// api/publicTrips.ts
// Слой каталога публичных поездок «Поехали со мной» (роадмап блок 7, Sprint 14).
// Контракт зеркалит docs/features/social-trips-gamification-backlog.md. Пока бэкенд
// (BE-public-trips-catalog #407, BE-trip-applications #408) не задеплоен — fetch/мутации
// отдают моки под флагом EXPO_PUBLIC_TRIPS_MOCK=true (или при 404/501/0 в DEV).

import { apiClient, ApiError } from '@/api/client';
import { devWarn } from '@/utils/logger';
import {
  MOCK_PUBLIC_TRIPS,
  MOCK_MY_APPLICATIONS,
  MOCK_TRIP_APPLICATIONS,
  MOCK_TRIP_NOTIFICATIONS,
} from '@/api/publicTripsMock';

// ── Доменные типы (camelCase) ──────────────────────────────────────────────

/** Статус карточки в каталоге. */
export type PublicTripStatus = 'open' | 'full' | 'completed';

/** Статус заявки участника (BE-trip-applications). */
export type ApplicationStatus =
  | 'new'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface TripOrganizer {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface PublicTrip {
  id: number;
  slug: string;
  title: string;
  coverUrl: string | null;
  region: string;
  tripType: string | null;
  /** ISO-дата старта. */
  startDate: string;
  /** ISO-дата окончания (опц.). */
  endDate: string | null;
  organizer: TripOrganizer;
  seatsTotal: number;
  seatsTaken: number;
  status: PublicTripStatus;
  description: string;
  /** Продвигается ли карточка (featured/boosted, #463). */
  featured: boolean;
  /** Статус заявки текущего пользователя на эту поездку (если подавал). */
  myApplicationStatus: ApplicationStatus | null;
  /** Является ли текущий пользователь организатором. */
  isOwner: boolean;
  /** Раскрывается только участнику с одобренной заявкой (BE-post-approval-reveal). */
  meetingPoint: string | null;
  contactNote: string | null;
}

export interface TripApplicant {
  id: number;
  name: string;
  avatarUrl: string | null;
  /** Краткая сводка активности (кол-во поездок/квестов) для решения организатора. */
  activitySummary: string | null;
  /** Бейджи заявителя (slug-и) для панели организатора. */
  badges: string[];
}

export interface TripApplication {
  id: number;
  tripId: number;
  tripTitle: string;
  applicant: TripApplicant;
  message: string;
  socialLinks: string[];
  status: ApplicationStatus;
  createdAt: string;
}

export type TripNotificationKind = 'new_application' | 'status_change';

export interface TripNotification {
  id: number;
  kind: TripNotificationKind;
  tripId: number;
  tripTitle: string;
  applicationId: number | null;
  /** Для status_change — новый статус заявки. */
  status: ApplicationStatus | null;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface PublicTripsFilters {
  region?: string;
  tripType?: string;
  status?: PublicTripStatus;
}

export interface SubmitApplicationInput {
  tripId: number;
  message: string;
  socialLinks: string[];
}

export interface ApplicationDecisionInput {
  applicationId: number;
  tripId: number;
  decision: 'approve' | 'reject';
}

// ── DTO (snake_case с бэка) ─────────────────────────────────────────────────

interface OrganizerDto {
  id: number;
  name: string;
  avatar?: string | null;
}

interface PublicTripDto {
  id: number;
  slug?: string;
  title: string;
  cover_url?: string | null;
  region?: string;
  trip_type?: string | null;
  start_date: string;
  end_date?: string | null;
  organizer: OrganizerDto;
  seats_total: number;
  seats_taken: number;
  status: PublicTripStatus;
  description?: string;
  featured?: boolean;
  my_application_status?: ApplicationStatus | null;
  is_owner?: boolean;
  meeting_point?: string | null;
  contact_note?: string | null;
}

interface ApplicantDto {
  id: number;
  name: string;
  avatar?: string | null;
  activity_summary?: string | null;
  badges?: string[];
}

interface TripApplicationDto {
  id: number;
  trip_id: number;
  trip_title: string;
  applicant: ApplicantDto;
  message?: string;
  social_links?: string[];
  status: ApplicationStatus;
  created_at: string;
}

interface TripNotificationDto {
  id: number;
  kind: TripNotificationKind;
  trip_id: number;
  trip_title: string;
  application_id?: number | null;
  status?: ApplicationStatus | null;
  message: string;
  created_at: string;
  read?: boolean;
}

// ── Мапперы ─────────────────────────────────────────────────────────────────

const mapOrganizer = (dto: OrganizerDto): TripOrganizer => ({
  id: dto.id,
  name: dto.name,
  avatarUrl: dto.avatar ?? null,
});

const mapTrip = (dto: PublicTripDto): PublicTrip => ({
  id: dto.id,
  slug: dto.slug ?? String(dto.id),
  title: dto.title,
  coverUrl: dto.cover_url ?? null,
  region: dto.region ?? '',
  tripType: dto.trip_type ?? null,
  startDate: dto.start_date,
  endDate: dto.end_date ?? null,
  organizer: mapOrganizer(dto.organizer),
  seatsTotal: dto.seats_total,
  seatsTaken: dto.seats_taken,
  status: dto.status,
  description: dto.description ?? '',
  featured: dto.featured ?? false,
  myApplicationStatus: dto.my_application_status ?? null,
  isOwner: dto.is_owner ?? false,
  meetingPoint: dto.meeting_point ?? null,
  contactNote: dto.contact_note ?? null,
});

const mapApplicant = (dto: ApplicantDto): TripApplicant => ({
  id: dto.id,
  name: dto.name,
  avatarUrl: dto.avatar ?? null,
  activitySummary: dto.activity_summary ?? null,
  badges: dto.badges ?? [],
});

const mapApplication = (dto: TripApplicationDto): TripApplication => ({
  id: dto.id,
  tripId: dto.trip_id,
  tripTitle: dto.trip_title,
  applicant: mapApplicant(dto.applicant),
  message: dto.message ?? '',
  socialLinks: dto.social_links ?? [],
  status: dto.status,
  createdAt: dto.created_at,
});

const mapNotification = (dto: TripNotificationDto): TripNotification => ({
  id: dto.id,
  kind: dto.kind,
  tripId: dto.trip_id,
  tripTitle: dto.trip_title,
  applicationId: dto.application_id ?? null,
  status: dto.status ?? null,
  message: dto.message,
  createdAt: dto.created_at,
  read: dto.read ?? false,
});

// ── Мок-фолбэк (до готовности BE #407/#408/#409) ───────────────────────────

const USE_MOCK = process.env.EXPO_PUBLIC_TRIPS_MOCK === 'true';

/** Бэкенд ещё не задеплоен → 404/501/0. В DEV или под флагом отдаём мок. */
const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

const matchesFilters = (trip: PublicTrip, filters?: PublicTripsFilters): boolean => {
  if (!filters) return true;
  if (filters.region && trip.region !== filters.region) return false;
  if (filters.tripType && trip.tripType !== filters.tripType) return false;
  if (filters.status && trip.status !== filters.status) return false;
  return true;
};

const buildQuery = (filters?: PublicTripsFilters): string => {
  const params = new URLSearchParams();
  if (filters?.region) params.set('region', filters.region);
  if (filters?.tripType) params.set('trip_type', filters.tripType);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

// ── Публичные fetch-функции ─────────────────────────────────────────────────

export async function fetchPublicTrips(
  filters?: PublicTripsFilters,
): Promise<PublicTrip[]> {
  if (USE_MOCK) return MOCK_PUBLIC_TRIPS.filter((t) => matchesFilters(t, filters));
  try {
    const dto = await apiClient.get<PublicTripDto[]>(
      `/trips/public/${buildQuery(filters)}`,
      undefined,
      { skipAuth: true },
    );
    return (dto ?? []).map(mapTrip);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[public-trips] catalog → mock fallback');
      return MOCK_PUBLIC_TRIPS.filter((t) => matchesFilters(t, filters));
    }
    throw error;
  }
}

export async function fetchPublicTrip(tripId: number | string): Promise<PublicTrip> {
  if (USE_MOCK) {
    const trip = MOCK_PUBLIC_TRIPS.find((t) => String(t.id) === String(tripId));
    if (!trip) throw new ApiError(404, 'Trip not found');
    return trip;
  }
  try {
    const dto = await apiClient.get<PublicTripDto>(
      `/trips/public/${tripId}/`,
      undefined,
      { skipAuth: true },
    );
    return mapTrip(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      const trip = MOCK_PUBLIC_TRIPS.find((t) => String(t.id) === String(tripId));
      if (trip) {
        devWarn('[public-trips] detail → mock fallback');
        return trip;
      }
    }
    throw error;
  }
}

/** Заявки текущего пользователя (его собственные «Хочу поехать»). */
export async function fetchMyApplications(): Promise<TripApplication[]> {
  if (USE_MOCK) return MOCK_MY_APPLICATIONS;
  try {
    const dto = await apiClient.get<TripApplicationDto[]>('/trips/applications/me/');
    return (dto ?? []).map(mapApplication);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[public-trips] my applications → mock fallback');
      return MOCK_MY_APPLICATIONS;
    }
    throw error;
  }
}

/** Заявки на конкретную поездку (для организатора). */
export async function fetchTripApplications(
  tripId: number | string,
): Promise<TripApplication[]> {
  if (USE_MOCK) {
    return MOCK_TRIP_APPLICATIONS.filter((a) => String(a.tripId) === String(tripId));
  }
  try {
    const dto = await apiClient.get<TripApplicationDto[]>(
      `/trips/public/${tripId}/applications/`,
    );
    return (dto ?? []).map(mapApplication);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[public-trips] trip applications → mock fallback');
      return MOCK_TRIP_APPLICATIONS.filter((a) => String(a.tripId) === String(tripId));
    }
    throw error;
  }
}

export async function fetchTripNotifications(): Promise<TripNotification[]> {
  if (USE_MOCK) return MOCK_TRIP_NOTIFICATIONS;
  try {
    const dto = await apiClient.get<TripNotificationDto[]>('/trips/notifications/');
    return (dto ?? []).map(mapNotification);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[public-trips] notifications → mock fallback');
      return MOCK_TRIP_NOTIFICATIONS;
    }
    throw error;
  }
}

// ── Мутации ─────────────────────────────────────────────────────────────────

export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<TripApplication> {
  const body = {
    trip_id: input.tripId,
    message: input.message,
    social_links: input.socialLinks,
  };
  const mockResult = (): TripApplication => ({
    id: Date.now(),
    tripId: input.tripId,
    tripTitle: MOCK_PUBLIC_TRIPS.find((t) => t.id === input.tripId)?.title ?? '',
    applicant: { id: 0, name: 'Вы', avatarUrl: null, activitySummary: null, badges: [] },
    message: input.message,
    socialLinks: input.socialLinks,
    status: 'new',
    createdAt: new Date().toISOString(),
  });
  if (USE_MOCK) return mockResult();
  try {
    const dto = await apiClient.post<TripApplicationDto>('/trips/applications/', body);
    return mapApplication(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[public-trips] submit → mock fallback');
      return mockResult();
    }
    throw error;
  }
}

export async function cancelApplication(
  applicationId: number,
): Promise<{ id: number; status: ApplicationStatus }> {
  if (USE_MOCK) return { id: applicationId, status: 'cancelled' };
  try {
    await apiClient.post(`/trips/applications/${applicationId}/cancel/`, {});
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error;
    devWarn('[public-trips] cancel → mock fallback');
  }
  return { id: applicationId, status: 'cancelled' };
}

export async function decideApplication(
  input: ApplicationDecisionInput,
): Promise<{ id: number; status: ApplicationStatus }> {
  const status: ApplicationStatus =
    input.decision === 'approve' ? 'approved' : 'rejected';
  if (USE_MOCK) return { id: input.applicationId, status };
  try {
    await apiClient.post(
      `/trips/applications/${input.applicationId}/${input.decision}/`,
      {},
    );
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error;
    devWarn('[public-trips] decide → mock fallback');
  }
  return { id: input.applicationId, status };
}
