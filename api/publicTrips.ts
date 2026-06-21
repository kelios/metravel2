// api/publicTrips.ts
// Слой каталога публичных поездок «Поехали со мной» (роадмап блок 7, Sprint 14).
// Пути и shape сверены с задеплоенным бэком (openapi schema, /api/schema/):
//   каталог            GET   /api/public-trips/            (paginated)
//   деталь             GET   /api/public-trips/{id}/
//   заявки (scoped)    GET   /api/trip-applications/       (paginated)
//   подать заявку      POST  /api/trip-applications/        {trip, message, instagram, facebook, telegram}
//   решение/отмена     PATCH /api/trip-applications/{id}/   {status: approved|rejected|canceled}
//   нотификации        GET   /api/trip-notifications/      (paginated)
//   пометить прочит.   PATCH /api/trip-notifications/{id}/  {is_read}
// До верификации BE на проде сохранён мок-фолбэк (EXPO_PUBLIC_TRIPS_MOCK=true или 404/501/0 в DEV).

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
  /** Продвигается ли карточка (featured/boosted, #463 — поля ещё нет в BE-сериализаторе). */
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

// ── DTO (snake_case с бэка, сверено с openapi) ─────────────────────────────

/** Обёртка DRF-пагинации. */
interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** BE отдаёт *_profile вложенным объектом (хотя в openapi помечен как string). */
interface ProfileObject {
  id?: number;
  name?: string | null;
  avatar?: string | null;
}
type ProfileField = ProfileObject | string | null;

/** PublicTripCatalog (GET /api/public-trips/). */
interface PublicTripDto {
  id: number;
  owner: number;
  owner_profile?: ProfileField;
  title: string;
  description?: string | null;
  start_at: string;
  transport_mode?: string | null;
  is_public?: boolean;
  seats_count?: number;
  start_point_name?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  meeting_point_hidden?: string | null;
  status?: 'planned' | 'active' | 'completed';
  catalog_status?: string | null;
  going_participants_count?: number | string | null;
  available_seats?: number | string | null;
  featured?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** TripApplication (GET/POST /api/trip-applications/). */
interface TripApplicationDto {
  id: number;
  trip: number;
  trip_title?: string | null;
  applicant?: number | null;
  applicant_profile?: ProfileField;
  message?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  telegram?: string | null;
  status: 'new' | 'reviewing' | 'approved' | 'rejected' | 'canceled';
  status_display?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

/** TripNotification (GET /api/trip-notifications/). */
interface TripNotificationDto {
  id: number;
  notification_type?: string | null;
  title?: string | null;
  body?: string | null;
  trip?: number | null;
  trip_title?: string | null;
  application?: number | null;
  application_status?: string | null;
  applicant?: number | null;
  applicant_profile?: ProfileField;
  is_read?: boolean;
  read_at?: string | null;
  created_at: string;
  updated_at?: string;
}

// ── Хелперы маппинга ────────────────────────────────────────────────────────

const unwrap = <T>(res: Paginated<T> | T[] | null | undefined): T[] =>
  Array.isArray(res) ? res : (res?.results ?? []);

const toNum = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n as number) ? (n as number) : 0;
};

const isProfileObject = (p: ProfileField | undefined): p is ProfileObject =>
  typeof p === 'object' && p !== null;

const profileName = (p: ProfileField | undefined, fallbackId?: number | null): string => {
  if (isProfileObject(p) && p.name?.trim()) return p.name.trim();
  if (typeof p === 'string' && p.trim()) return p.trim();
  return fallbackId != null ? `#${fallbackId}` : 'Участник';
};

const profileAvatar = (p: ProfileField | undefined): string | null =>
  isProfileObject(p) ? (p.avatar ?? null) : null;

const profileId = (p: ProfileField | undefined, fallback: number): number =>
  isProfileObject(p) && typeof p.id === 'number' ? p.id : fallback;

/** BE StatusBd5Enum → доменный ApplicationStatus. */
const APPLICATION_STATUS: Record<string, ApplicationStatus> = {
  new: 'new',
  reviewing: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  canceled: 'cancelled',
};

const mapApplicationStatus = (s?: string | null): ApplicationStatus =>
  (s && APPLICATION_STATUS[s]) || 'new';

/** Доменный статус карточки из BE status + available_seats. */
const mapTripStatus = (dto: PublicTripDto): PublicTripStatus => {
  if (dto.status === 'completed' || dto.catalog_status === 'completed') return 'completed';
  if (toNum(dto.available_seats) <= 0 && dto.seats_count != null) return 'full';
  return 'open';
};

const mapTrip = (dto: PublicTripDto): PublicTrip => {
  const seatsTotal = toNum(dto.seats_count);
  const seatsTaken = dto.going_participants_count != null
    ? toNum(dto.going_participants_count)
    : Math.max(0, seatsTotal - toNum(dto.available_seats));
  return {
    id: dto.id,
    slug: String(dto.id),
    title: dto.title,
    // BE-каталог не отдаёт обложку — рендерим без неё (плейсхолдер на UI).
    coverUrl: null,
    region: dto.start_point_name ?? '',
    tripType: dto.transport_mode ?? null,
    startDate: dto.start_at,
    endDate: null,
    organizer: {
      id: profileId(dto.owner_profile, dto.owner),
      name: profileName(dto.owner_profile, dto.owner),
      avatarUrl: profileAvatar(dto.owner_profile),
    },
    seatsTotal,
    seatsTaken,
    status: mapTripStatus(dto),
    description: dto.description ?? '',
    // #463: featured приходит из PublicTripCatalog-сериализатора BE (commit 3d7f4f2).
    featured: dto.featured ?? false,
    // Каталог не возвращает статус заявки/владение — определяется на детальном экране.
    myApplicationStatus: null,
    isOwner: false,
    meetingPoint: null,
    contactNote: null,
  };
};

const buildSocialLinks = (dto: TripApplicationDto): string[] =>
  [dto.instagram, dto.facebook, dto.telegram].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );

const mapApplication = (dto: TripApplicationDto): TripApplication => ({
  id: dto.id,
  tripId: dto.trip,
  tripTitle: dto.trip_title ?? '',
  applicant: {
    id: profileId(dto.applicant_profile, dto.applicant ?? 0),
    name: profileName(dto.applicant_profile, dto.applicant ?? null),
    avatarUrl: profileAvatar(dto.applicant_profile),
    activitySummary: null,
    badges: [],
  },
  message: dto.message ?? '',
  socialLinks: buildSocialLinks(dto),
  status: mapApplicationStatus(dto.status),
  createdAt: dto.created_at,
});

const mapNotification = (dto: TripNotificationDto): TripNotification => ({
  id: dto.id,
  kind: dto.notification_type === 'application_created' ? 'new_application' : 'status_change',
  tripId: dto.trip ?? 0,
  tripTitle: dto.trip_title ?? '',
  applicationId: dto.application ?? null,
  status: dto.application_status ? mapApplicationStatus(dto.application_status) : null,
  message: dto.body ?? dto.title ?? '',
  createdAt: dto.created_at,
  read: dto.is_read ?? false,
});

/** Разложить произвольные соц-ссылки заявки по полям BE (instagram/facebook/telegram). */
const splitSocialLinks = (
  links: string[],
): { instagram?: string; facebook?: string; telegram?: string } => {
  const out: { instagram?: string; facebook?: string; telegram?: string } = {};
  for (const link of links) {
    const l = link.toLowerCase();
    if (!out.instagram && l.includes('instagram')) out.instagram = link;
    else if (!out.facebook && (l.includes('facebook') || l.includes('fb.'))) out.facebook = link;
    else if (!out.telegram && (l.includes('t.me') || l.includes('telegram'))) out.telegram = link;
    else if (!out.telegram) out.telegram = link;
  }
  return out;
};

// ── Мок-фолбэк (FE-guard: снять после верификации BE на проде + regression) ──

const USE_MOCK = process.env.EXPO_PUBLIC_TRIPS_MOCK === 'true';

/** Бэкенд недоступен → 404/501/0. В DEV или под флагом отдаём мок. */
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

// BE-каталог поддерживает только page/perPage; доменные фильтры применяем на клиенте.
const PAGE_QUERY = '?perPage=100';

// ── Публичные fetch-функции ─────────────────────────────────────────────────

export async function fetchPublicTrips(
  filters?: PublicTripsFilters,
): Promise<PublicTrip[]> {
  if (USE_MOCK) return MOCK_PUBLIC_TRIPS.filter((t) => matchesFilters(t, filters));
  try {
    const res = await apiClient.get<Paginated<PublicTripDto>>(
      `/public-trips/${PAGE_QUERY}`,
      undefined,
      { skipAuth: true },
    );
    return unwrap(res).map(mapTrip).filter((t) => matchesFilters(t, filters));
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
      `/public-trips/${tripId}/`,
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

/** Заявки текущего пользователя (BE queryset уже scoped по applicant). */
export async function fetchMyApplications(): Promise<TripApplication[]> {
  if (USE_MOCK) return MOCK_MY_APPLICATIONS;
  try {
    const res = await apiClient.get<Paginated<TripApplicationDto>>(
      `/trip-applications/${PAGE_QUERY}`,
    );
    return unwrap(res).map(mapApplication);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[public-trips] my applications → mock fallback');
      return MOCK_MY_APPLICATIONS;
    }
    throw error;
  }
}

/** Заявки на конкретную поездку (для организатора): BE отдаёт заявки на его трипы,
 *  фильтруем по trip на клиенте. */
export async function fetchTripApplications(
  tripId: number | string,
): Promise<TripApplication[]> {
  if (USE_MOCK) {
    return MOCK_TRIP_APPLICATIONS.filter((a) => String(a.tripId) === String(tripId));
  }
  try {
    const res = await apiClient.get<Paginated<TripApplicationDto>>(
      `/trip-applications/?trip=${tripId}&perPage=100`,
    );
    return unwrap(res)
      .map(mapApplication)
      .filter((a) => String(a.tripId) === String(tripId));
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
    const res = await apiClient.get<Paginated<TripNotificationDto>>(
      `/trip-notifications/${PAGE_QUERY}`,
    );
    return unwrap(res).map(mapNotification);
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
  const social = splitSocialLinks(input.socialLinks);
  const body = {
    trip: input.tripId,
    message: input.message,
    ...social,
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
    const dto = await apiClient.post<TripApplicationDto>('/trip-applications/', body);
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
    await apiClient.patch(`/trip-applications/${applicationId}/`, { status: 'canceled' });
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
  const beStatus = input.decision === 'approve' ? 'approved' : 'rejected';
  if (USE_MOCK) return { id: input.applicationId, status };
  try {
    await apiClient.patch(`/trip-applications/${input.applicationId}/`, { status: beStatus });
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error;
    devWarn('[public-trips] decide → mock fallback');
  }
  return { id: input.applicationId, status };
}
