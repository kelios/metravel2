// api/telegramLink.ts
// Слой привязки Telegram к профилю (Sprint 15 / блок 6, FE-421).
// Production contract verified by board #919:
//   получить    GET   /api/user/me/telegram/
//   обновить    PATCH /api/user/me/telegram/        { telegram_username?, preferred_messenger? }
//   старт авторизации POST /api/user/me/telegram/auth/start/   -> { deeplink, expires_at }
//   подтвердить POST /api/user/me/telegram/auth/confirm/ { token } -> { telegram_verified }
// Explicit mock and missing-endpoint fallback are development-only.

import { apiClient, ApiError } from '@/api/client';
import { resolveDevMockFlag } from '@/utils/devMockFlags';
import { devWarn } from '@/utils/logger';

// ── Доменные типы (camelCase) ──────────────────────────────────────────────

export type PreferredMessenger = 'telegram' | 'whatsapp' | 'other';

export interface TelegramLink {
  telegramUsername: string | null;
  telegramUserId: string | null;
  telegramVerified: boolean;
  preferredMessenger: PreferredMessenger | null;
}

export interface UpdateTelegramLinkInput {
  telegramUsername?: string | null;
  preferredMessenger?: PreferredMessenger | null;
}

export interface TelegramAuthStart {
  deeplink: string;
  expiresAt: string;
}

// ── DTO (snake_case с бэка) ─────────────────────────────────────────────────

interface TelegramLinkDto {
  telegram_username: string | null;
  telegram_user_id: string | null;
  telegram_verified: boolean;
  preferred_messenger: PreferredMessenger | null;
}

interface TelegramAuthStartDto {
  deeplink: string;
  expires_at: string;
}

interface TelegramAuthConfirmDto {
  telegram_verified: boolean;
}

// ── Хелперы маппинга ────────────────────────────────────────────────────────

const mapLink = (dto: TelegramLinkDto): TelegramLink => ({
  telegramUsername: dto.telegram_username ?? null,
  telegramUserId: dto.telegram_user_id ?? null,
  telegramVerified: Boolean(dto.telegram_verified),
  preferredMessenger: dto.preferred_messenger ?? null,
});

// ── Мок-фолбэк (FE-guard: снять после верификации BE на проде + regression) ──

const USE_MOCK = resolveDevMockFlag({
  name: 'EXPO_PUBLIC_TRIPS_MOCK',
  value: process.env.EXPO_PUBLIC_TRIPS_MOCK,
});

/** Бэкенд недоступен → 404/501/0. В DEV или под флагом отдаём мок. */
const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

// In-memory мок-стейт: PATCH/confirm видимо обновляют результат GET в DEV.
const mockState: TelegramLinkDto = {
  telegram_username: null,
  telegram_user_id: null,
  telegram_verified: false,
  preferred_messenger: 'telegram',
};

const normalizeUsername = (raw?: string | null): string | null => {
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/^@/, '');
  return trimmed.length > 0 ? trimmed : null;
};

// ── Публичные fetch/мутации ──────────────────────────────────────────────────

export async function fetchMyTelegramLink(): Promise<TelegramLink> {
  if (USE_MOCK) return mapLink(mockState);
  try {
    const dto = await apiClient.get<TelegramLinkDto>('/user/me/telegram/');
    return mapLink(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[telegram-link] get → mock fallback');
      return mapLink(mockState);
    }
    throw error;
  }
}

export async function updateTelegramLink(
  input: UpdateTelegramLinkInput,
): Promise<TelegramLink> {
  const body: { telegram_username?: string | null; preferred_messenger?: PreferredMessenger | null } = {};
  if ('telegramUsername' in input) body.telegram_username = normalizeUsername(input.telegramUsername);
  if ('preferredMessenger' in input) body.preferred_messenger = input.preferredMessenger ?? null;

  const applyMock = (): TelegramLink => {
    if (body.telegram_username !== undefined) {
      // Смена username сбрасывает верификацию — её надо подтвердить заново.
      if (body.telegram_username !== mockState.telegram_username) {
        mockState.telegram_verified = false;
        mockState.telegram_user_id = null;
      }
      mockState.telegram_username = body.telegram_username;
    }
    if (body.preferred_messenger !== undefined) {
      mockState.preferred_messenger = body.preferred_messenger;
    }
    return mapLink(mockState);
  };

  if (USE_MOCK) return applyMock();
  try {
    const dto = await apiClient.patch<TelegramLinkDto>('/user/me/telegram/', body);
    return mapLink(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[telegram-link] update → mock fallback');
      return applyMock();
    }
    throw error;
  }
}

export async function startTelegramAuth(): Promise<TelegramAuthStart> {
  const mockResult = (): TelegramAuthStart => ({
    // Детерминированный мок-deeplink: проходит allowlist openExternalUrl.
    deeplink: `https://t.me/metravel_bot?start=mock-${Date.now()}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  if (USE_MOCK) return mockResult();
  try {
    const dto = await apiClient.post<TelegramAuthStartDto>('/user/me/telegram/auth/start/');
    return { deeplink: dto.deeplink, expiresAt: dto.expires_at };
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[telegram-link] auth start → mock fallback');
      return mockResult();
    }
    throw error;
  }
}

export async function confirmTelegramAuth(token: string): Promise<{ telegramVerified: true }> {
  const applyMock = (): { telegramVerified: true } => {
    mockState.telegram_verified = true;
    if (!mockState.telegram_user_id) mockState.telegram_user_id = `mock-${Date.now()}`;
    return { telegramVerified: true };
  };
  if (USE_MOCK) return applyMock();
  try {
    await apiClient.post<TelegramAuthConfirmDto>(
      '/user/me/telegram/auth/confirm/',
      { token },
    );
    return { telegramVerified: true };
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[telegram-link] auth confirm → mock fallback');
      return applyMock();
    }
    throw error;
  }
}
