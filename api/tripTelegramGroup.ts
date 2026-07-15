// api/tripTelegramGroup.ts
// Telegram-группа поездки «Поехали со мной» (Sprint 15 / блок 6, FE-423).
// Контракт (тикет #420/#423), auth Authorization: Token <token> (apiClient):
//   GET  /api/trips/{id}/telegram-group/              -> TelegramGroupDto
//   POST /api/trips/{id}/telegram-group/  {enabled, group_url?, invite_url?} -> TelegramGroupDto (owner-only)
//   POST /api/trips/{id}/telegram-group/invite-link/  -> { url, text } (owner/participant)
// Production contract verified by board #919. 404/405/501 remains a safe typed
// unavailable state; network/mock fallback is development-only.
// Важно: fallback НЕ должен генерировать fake t.me invite/group links.

import { apiClient, ApiError } from '@/api/client';
import { resolveDevMockFlag } from '@/utils/devMockFlags';
import { devWarn } from '@/utils/logger';
import { translate as i18nT } from '@/i18n';

// ── Доменные типы (camelCase) ──────────────────────────────────────────────

export interface TripTelegramGroup {
  tripId: number;
  isAvailable: boolean;
  unavailableReason: string | null;
  enabled: boolean;
  groupUrl: string | null;
  inviteUrl: string | null;
  shareText: string;
  createdBy: number | null;
  createdAt: string | null;
}

export interface TripInviteLink {
  isAvailable: boolean;
  unavailableReason: string | null;
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
  isAvailable: true,
  unavailableReason: null,
  enabled: dto.enabled,
  groupUrl: dto.group_url,
  inviteUrl: dto.invite_url,
  shareText: dto.share_text ?? '',
  createdBy: dto.created_by ?? null,
  createdAt: dto.created_at ?? null,
});

const mapInvite = (dto: InviteLinkDto): TripInviteLink => ({
  isAvailable: Boolean(dto.url),
  unavailableReason: dto.url ? null : getTelegramGroupUnavailableReason(),
  url: dto.url ?? '',
  text: dto.text ?? '',
});

// ── Безопасный фолбэк (FE-guard: снять после верификации BE на проде + regression) ──

const USE_MOCK = resolveDevMockFlag({
  name: 'EXPO_PUBLIC_TRIPS_MOCK',
  value: process.env.EXPO_PUBLIC_TRIPS_MOCK,
});
export const getTelegramGroupUnavailableReason = (): string =>
  i18nT('errorsStatic:tripTelegram.unavailable');

const ENDPOINT_UNAVAILABLE_STATUSES = [404, 405, 501];

/** Missing production endpoints are a supported disabled state, not a create prompt. */
const shouldReturnUnavailable = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!(error instanceof ApiError)) return false;
  return ENDPOINT_UNAVAILABLE_STATUSES.includes(error.status) || (__DEV__ && error.status === 0);
};

const unavailableGroup = (tripId: number): TripTelegramGroup => ({
  tripId,
  isAvailable: false,
  unavailableReason: getTelegramGroupUnavailableReason(),
  enabled: false,
  groupUrl: null,
  inviteUrl: null,
  shareText: '',
  createdBy: null,
  createdAt: null,
});

const unavailableInvite = (): TripInviteLink => ({
  isAvailable: false,
  unavailableReason: getTelegramGroupUnavailableReason(),
  url: '',
  text: '',
});

// ── Публичные функции ───────────────────────────────────────────────────────

export async function fetchTripTelegramGroup(
  tripId: number,
): Promise<TripTelegramGroup> {
  if (USE_MOCK) return unavailableGroup(tripId);
  try {
    const dto = await apiClient.get<TelegramGroupDto>(`/trips/${tripId}/telegram-group/`);
    return mapGroup(dto);
  } catch (error) {
    if (shouldReturnUnavailable(error)) {
      devWarn('[trip-telegram] group → unavailable fallback');
      return unavailableGroup(tripId);
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
  if (USE_MOCK) return unavailableGroup(input.tripId);
  try {
    const dto = await apiClient.post<TelegramGroupDto>(
      `/trips/${input.tripId}/telegram-group/`,
      body,
    );
    return mapGroup(dto);
  } catch (error) {
    if (shouldReturnUnavailable(error)) {
      devWarn('[trip-telegram] create → unavailable fallback');
      return unavailableGroup(input.tripId);
    }
    throw error;
  }
}

export async function fetchTripInviteLink(tripId: number): Promise<TripInviteLink> {
  if (USE_MOCK) return unavailableInvite();
  try {
    const dto = await apiClient.post<InviteLinkDto>(
      `/trips/${tripId}/telegram-group/invite-link/`,
    );
    return mapInvite(dto);
  } catch (error) {
    if (shouldReturnUnavailable(error)) {
      devWarn('[trip-telegram] invite-link → unavailable fallback');
      return unavailableInvite();
    }
    throw error;
  }
}
