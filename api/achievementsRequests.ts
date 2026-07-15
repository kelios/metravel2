// Request ownership for achievements. Keep endpoints, retry behavior and dev fallbacks here.

import { apiClient, ApiError } from '@/api/client';
import { resolveDevMockFlag } from '@/utils/devMockFlags';
import { devWarn } from '@/utils/logger';
import {
  MOCK_BADGES,
  MOCK_MY_ACHIEVEMENTS,
  MOCK_PUBLIC_ACHIEVEMENTS,
  MOCK_PEER_CATALOG,
  MOCK_TRAVEL_PEER_RECEIVED,
  MOCK_RARE_AWARDS,
  MOCK_RARE_AWARD_CATALOG,
} from '@/api/achievementsMock';
import type {
  GrantInput,
  GrantRareAwardInput,
  GrantResult,
  MyAchievements,
  PeerBadge,
  PeerBadgeReceived,
  PublicAchievements,
  RareAward,
  RareAwardCatalogItem,
  RareAwardGrant,
  Badge,
} from '@/api/achievementsTypes';
import type {
  BadgeDto,
  GrantResponseDto,
  MyAchievementsDto,
  PeerBadgeDto,
  PublicAchievementsDto,
  RareAwardCatalogItemDto,
  RareAwardDto,
  RareAwardGrantDto,
  TravelPeerBadgesDto,
} from '@/api/achievementsNormalizers';
import {
  mapBadge,
  mapMy,
  mapPeerBadge,
  mapPeerReceived,
  mapPublic,
  mapRareAward,
  mapRareCatalogItem,
  mapRareGrant,
} from '@/api/achievementsNormalizers';

// ── Мок-фолбэк (до готовности BE-A4) ────────────────────────────────────────

const USE_MOCK = resolveDevMockFlag({
  name: 'EXPO_PUBLIC_ACHIEVEMENTS_MOCK',
  value: process.env.EXPO_PUBLIC_ACHIEVEMENTS_MOCK,
});

// #721 закэшировал summary на бэке: /achievements/me/ больше не пересчитывает ранг
// на каждый запрос (rank отдаётся из кэша, recomputed_at в payload). Возвращаем
// умеренный запас вместо прежних 25с — тяжёлого пересчёта под спиннером больше нет,
// но держим чуть выше дефолта на случай холодного кэша/первого пересчёта.
const MY_ACHIEVEMENTS_TIMEOUT = 15000;

/** Бэкенд ещё не задеплоен → 404/501/0. В DEV или под флагом отдаём мок. */
const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

/**
 * Peer-награды (§10) — фича на mock-fallback до деплоя BE-эндпоинтов
 * /achievements/peer-badges/*. Fallback срабатывает только в __DEV__ или под
 * флагом EXPO_PUBLIC_ACHIEVEMENTS_MOCK, чтобы не маскировать ошибки в проде.
 * Когда BE задеплоит эндпоинты — убрать флаг и проверить реальный ответ.
 */
const shouldFallbackPeerToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

// ── Публичные fetch-функции ─────────────────────────────────────────────────

export async function fetchBadgeCatalog(): Promise<Badge[]> {
  if (USE_MOCK) return MOCK_BADGES;
  try {
    const dto = await apiClient.get<BadgeDto[]>('/achievements/badges/');
    return (dto ?? []).map(mapBadge);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] badges catalog → mock fallback');
      return MOCK_BADGES;
    }
    throw error;
  }
}

export async function fetchMyAchievements(): Promise<MyAchievements> {
  if (USE_MOCK) return MOCK_MY_ACHIEVEMENTS;
  try {
    const dto = await apiClient.get<MyAchievementsDto>(
      '/achievements/me/',
      MY_ACHIEVEMENTS_TIMEOUT,
    );
    return mapMy(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] me → mock fallback');
      return MOCK_MY_ACHIEVEMENTS;
    }
    throw error;
  }
}

export async function fetchUserAchievements(
  userId: string | number,
): Promise<PublicAchievements> {
  if (USE_MOCK) return MOCK_PUBLIC_ACHIEVEMENTS;
  try {
    const dto = await apiClient.get<PublicAchievementsDto>(
      `/achievements/user/${userId}/`,
      undefined,
      { skipAuth: true },
    );
    return mapPublic(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] user → mock fallback');
      return MOCK_PUBLIC_ACHIEVEMENTS;
    }
    throw error;
  }
}

// ── Peer-awarded badges (§10) ───────────────────────────────────────────────

/** Каталог grantable peer-значков (для пикера выдачи). */
export async function fetchPeerBadgeCatalog(): Promise<PeerBadge[]> {
  if (USE_MOCK) return MOCK_PEER_CATALOG;
  try {
    const dto = await apiClient.get<PeerBadgeDto[]>('/achievements/peer-badges/');
    const mapped = (dto ?? []).map(mapPeerBadge);
    // BE задеплоил эндпоинт, но каталог пуст (200 + []) → пикер «Наградить»
    // открывался без вариантов (#577). В DEV отдаём мок-каталог чтобы выдача
    // наград работала при разработке. В проде возвращаем пустой массив как есть,
    // чтобы не маскировать реальное состояние бэка. Снять, когда BE засидит
    // реальные значки (см. контракт #555/§10).
    if (mapped.length === 0 && __DEV__) {
      devWarn('[achievements] peer catalog empty → mock fallback (dev only)');
      return MOCK_PEER_CATALOG;
    }
    return mapped;
  } catch (error) {
    if (shouldFallbackPeerToMock(error)) {
      devWarn('[achievements] peer catalog → mock fallback');
      return MOCK_PEER_CATALOG;
    }
    throw error;
  }
}

/** Peer-значки, полученные конкретным travel (для travel-detail). */
export async function fetchTravelPeerBadges(
  travelId: string | number,
): Promise<PeerBadgeReceived[]> {
  if (USE_MOCK) return MOCK_TRAVEL_PEER_RECEIVED;
  try {
    const dto = await apiClient.get<TravelPeerBadgesDto>(
      `/achievements/travel/${travelId}/`,
      undefined,
      { skipAuth: true },
    );
    return (dto?.peer_received ?? []).map(mapPeerReceived);
  } catch (error) {
    if (shouldFallbackPeerToMock(error)) {
      devWarn('[achievements] travel peer → mock fallback');
      return MOCK_TRAVEL_PEER_RECEIVED;
    }
    throw error;
  }
}

/** Toggle-выдача peer-значка (дал/забрал). Возвращает новое состояние + счётчик. */
export async function grantPeerBadge(input: GrantInput): Promise<GrantResult> {
  const body = {
    badge_slug: input.badgeSlug,
    ...(input.recipientId != null ? { recipient_id: input.recipientId } : {}),
    ...(input.travelId != null ? { travel_id: input.travelId } : {}),
  };
  try {
    const dto = await apiClient.post<GrantResponseDto>(
      '/achievements/peer-badges/grant/',
      body,
    );
    return { granted: Boolean(dto?.granted), count: dto?.count ?? 0 };
  } catch (error) {
    // Каталог сейчас мок (BE вернул пустой список, #577) — slug мок-значка
    // неизвестен бэку, grant вернёт 400/404. Плюс случай «эндпоинта нет»
    // (501/0). Во всех этих случаях симулируем «выдал», чтобы UI-toggle работал;
    // реальные сетевые/5xx-сбои по-прежнему всплывают.
    const isMockableGrant =
      shouldFallbackPeerToMock(error) ||
      (error instanceof ApiError && error.status === 400);
    if (isMockableGrant) {
      devWarn('[achievements] grant → mock simulate');
      return { granted: true, count: 1 };
    }
    throw error;
  }
}

/** Редкие награды текущего пользователя. */
export async function fetchMyRareAwards(): Promise<RareAward[]> {
  if (USE_MOCK) return MOCK_RARE_AWARDS;
  try {
    const dto = await apiClient.get<RareAwardDto[]>('/achievements/rare-awards/me/');
    return (dto ?? []).map(mapRareAward);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] rare-awards me → mock fallback');
      return MOCK_RARE_AWARDS;
    }
    throw error;
  }
}

/** Публичные редкие награды автора. */
export async function fetchUserRareAwards(
  userId: string | number,
): Promise<RareAward[]> {
  if (USE_MOCK) return MOCK_RARE_AWARDS;
  try {
    const dto = await apiClient.get<RareAwardDto[]>(
      `/achievements/user/${userId}/rare-awards/`,
      undefined,
      { skipAuth: true },
    );
    return (dto ?? []).map(mapRareAward);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] rare-awards user → mock fallback');
      return MOCK_RARE_AWARDS;
    }
    throw error;
  }
}

/** Каталог редких наград для админ-пикера выдачи (staff-only эндпоинт). */
export async function fetchRareAwardCatalog(): Promise<RareAwardCatalogItem[]> {
  if (USE_MOCK) return MOCK_RARE_AWARD_CATALOG;
  try {
    const dto = await apiClient.get<RareAwardCatalogItemDto[]>(
      '/achievements/rare-awards/catalog/',
    );
    return (dto ?? []).map(mapRareCatalogItem);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] rare-awards catalog → mock fallback');
      return MOCK_RARE_AWARD_CATALOG;
    }
    throw error;
  }
}

/** Выдача редкой награды админом/модератором. 400/403/404/409 пробрасываем в UI. */
export async function grantRareAward(
  input: GrantRareAwardInput,
): Promise<RareAwardGrant> {
  const body = {
    user_id: input.userId,
    award_slug: input.awardSlug,
    reason: input.reason,
  };
  try {
    const dto = await apiClient.post<RareAwardGrantDto>(
      '/achievements/rare-awards/grants/',
      body,
    );
    return mapRareGrant(dto);
  } catch (error) {
    // Без бэка (mock/DEV-404) — симулируем выдачу, чтобы превью работало.
    // Ролевые/валидационные ошибки (400/403/404/409) пробрасываем как есть.
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] rare grant → mock simulate');
      return {
        id: Date.now(),
        userId: Number(input.userId) || 0,
        awardSlug: input.awardSlug,
        category: 'other',
        title: input.awardSlug,
        level: 'legendary',
        reason: input.reason,
        grantedAt: new Date().toISOString(),
        grantedBy: null,
        journalEventId: null,
      };
    }
    throw error;
  }
}
