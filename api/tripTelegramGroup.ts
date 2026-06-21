// api/tripTelegramGroup.ts
// Telegram-группа поездки «Поехали со мной» (Sprint 15 / блок 6, FE-423).
// Контракт (тикет #420/#423), auth Authorization: Token <token> (apiClient):
//   GET  /api/trips/{id}/telegram-group/              -> TelegramGroupDto
//   POST /api/trips/{id}/telegram-group/  {enabled, group_url?, invite_url?} -> TelegramGroupDto (owner-only)
//   POST /api/trips/{id}/telegram-group/invite-link/  -> { url, text } (owner/participant)
// BE-эндпоинты ещё НЕ задеплоены → мок-фолбэк (EXPO_PUBLIC_TRIPS_MOCK=true или
// 0/404/501 в DEV), как в api/publicTrips.ts. Снять после верификации BE на проде.

import { apiClient, ApiError } from '@/api/client';
import { devWarn } from '@/utils/logger';

// ── Доменные типы (camelCase) ──────────────────────────────────────────────

export interface TripTelegramGroup {
  tripId: number;
  enabled: boolean;
  groupUrl: string | null;
  inviteUrl: string | null;
  shareText: string;
  createdBy: number | null;
  createdAt: string | null;
}

export interface TripInviteLink {
  url: string;
  text: string;
}

export interface CreateTripTelegramGroupInput {
  tripId: number;
  groupUrl?: string | null;
  inviteUrl?: string | null;
}

// ── DTO (snake_case с бэка) ─────────────────────────────────────────────────

interface TelegramGroupDto {
  trip: number;
  enabled: boolean;
  group_url: string | null;
  invite_url: string | null;
  share_text: string;
  created_by: number | null;
  created_at: string | null;
}

interface InviteLinkDto {
  url: string;
  text: string;
}

// ── Маппинг ─────────────────────────────────────────────────────────────────

const mapGroup = (dto: TelegramGroupDto): TripTelegramGroup => ({
  tripId: dto.trip,
  enabled: dto.enabled,
  groupUrl: dto.group_url,
  inviteUrl: dto.invite_url,
  shareText: dto.share_text ?? '',
  createdBy: dto.created_by ?? null,
  createdAt: dto.created_at ?? null,
});

const mapInvite = (dto: InviteLinkDto): TripInviteLink => ({
  url: dto.url,
  text: dto.text ?? '',
});

// ── Мок-фолбэк (FE-guard: снять после верификации BE на проде + regression) ──

const USE_MOCK = process.env.EXPO_PUBLIC_TRIPS_MOCK === 'true';

/** Бэкенд недоступен → 0/404/501. В DEV или под флагом отдаём мок. */
const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

// In-memory состояние группы по trip — чтобы «создать» визуально включило группу
// и выдало фейковый t.me invite в рамках сессии.
const mockGroups = new Map<number, TripTelegramGroup>();

const mockDisabled = (tripId: number): TripTelegramGroup => ({
  tripId,
  enabled: false,
  groupUrl: null,
  inviteUrl: null,
  shareText: '',
  createdBy: null,
  createdAt: null,
});

const mockGroupState = (tripId: number): TripTelegramGroup =>
  mockGroups.get(tripId) ?? mockDisabled(tripId);

const mockEnable = (input: CreateTripTelegramGroupInput): TripTelegramGroup => {
  const groupUrl = input.groupUrl?.trim() || `https://t.me/+metravel_trip_${input.tripId}`;
  const inviteUrl = input.inviteUrl?.trim() || groupUrl;
  const group: TripTelegramGroup = {
    tripId: input.tripId,
    enabled: true,
    groupUrl,
    inviteUrl,
    shareText: `Присоединяйтесь к Telegram-группе поездки в MeTravel: ${groupUrl}`,
    createdBy: 0,
    createdAt: new Date().toISOString(),
  };
  mockGroups.set(input.tripId, group);
  return group;
};

const mockInvite = (tripId: number): TripInviteLink => {
  const group = mockGroupState(tripId);
  const url = group.inviteUrl ?? group.groupUrl ?? `https://t.me/+metravel_trip_${tripId}`;
  return {
    url,
    text: `Присоединяйтесь к Telegram-группе поездки в MeTravel: ${url}`,
  };
};

// ── Публичные функции ───────────────────────────────────────────────────────

export async function fetchTripTelegramGroup(
  tripId: number,
): Promise<TripTelegramGroup> {
  if (USE_MOCK) return mockGroupState(tripId);
  try {
    const dto = await apiClient.get<TelegramGroupDto>(`/trips/${tripId}/telegram-group/`);
    return mapGroup(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[trip-telegram] group → mock fallback');
      return mockGroupState(tripId);
    }
    throw error;
  }
}

export async function createTripTelegramGroup(
  input: CreateTripTelegramGroupInput,
): Promise<TripTelegramGroup> {
  const body = {
    enabled: true,
    group_url: input.groupUrl ?? null,
    invite_url: input.inviteUrl ?? null,
  };
  if (USE_MOCK) return mockEnable(input);
  try {
    const dto = await apiClient.post<TelegramGroupDto>(
      `/trips/${input.tripId}/telegram-group/`,
      body,
    );
    return mapGroup(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[trip-telegram] create → mock fallback');
      return mockEnable(input);
    }
    throw error;
  }
}

export async function fetchTripInviteLink(tripId: number): Promise<TripInviteLink> {
  if (USE_MOCK) return mockInvite(tripId);
  try {
    const dto = await apiClient.post<InviteLinkDto>(
      `/trips/${tripId}/telegram-group/invite-link/`,
    );
    return mapInvite(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[trip-telegram] invite-link → mock fallback');
      return mockInvite(tripId);
    }
    throw error;
  }
}
