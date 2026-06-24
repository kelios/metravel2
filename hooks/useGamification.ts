// hooks/useGamification.ts
// React Query хуки геймификации-2 (Sprint 10). Серверный стейт — только через
// React Query. Мутация выбора пути инвалидирует состояние персонажа и шлёт аналитику.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  chooseCharacterPath,
  fetchMyCharacter,
  fetchMyGamificationProgress,
  fetchMyPlaceFirstBadges,
  fetchUserCharacter,
  fetchUserGamificationProgress,
  fetchUserPlaceFirstBadges,
  type CharacterState,
  type ChoosePathInput,
  type GamificationProgress,
  type PlaceFirstBadge,
} from '@/api/gamification';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { trackPathChosen } from '@/utils/gamificationAnalytics';

const STALE_TIME = 5 * 60 * 1000;

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && failureCount < 2;

const hasId = (userId: string | number | null | undefined): boolean =>
  userId != null && userId !== '';

// ── Бейджи первооткрывателя места ───────────────────────────────────────────

export function useMyPlaceFirstBadges(options: { enabled?: boolean } = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<PlaceFirstBadge[]>({
    queryKey: queryKeys.gamificationPlaceBadgesMe(),
    queryFn: fetchMyPlaceFirstBadges,
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useUserPlaceFirstBadges(userId: string | number | null | undefined) {
  return useQuery<PlaceFirstBadge[]>({
    queryKey: queryKeys.gamificationPlaceBadgesUser(userId),
    queryFn: () => fetchUserPlaceFirstBadges(userId as string | number),
    enabled: hasId(userId),
    staleTime: STALE_TIME,
    retry,
  });
}

// ── Линейки прогрессии / типы активности ────────────────────────────────────

export function useMyGamificationProgress() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<GamificationProgress>({
    queryKey: queryKeys.gamificationProgressMe(),
    queryFn: fetchMyGamificationProgress,
    enabled: isAuthenticated,
    staleTime: STALE_TIME,
    retry,
  });
}

export function useUserGamificationProgress(
  userId: string | number | null | undefined,
) {
  return useQuery<GamificationProgress>({
    queryKey: queryKeys.gamificationProgressUser(userId),
    queryFn: () => fetchUserGamificationProgress(userId as string | number),
    enabled: hasId(userId),
    staleTime: STALE_TIME,
    retry,
  });
}

// ── Персонажи + выбор пути ──────────────────────────────────────────────────

export function useMyCharacter() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<CharacterState>({
    queryKey: queryKeys.gamificationCharacterMe(),
    queryFn: fetchMyCharacter,
    enabled: isAuthenticated,
    staleTime: STALE_TIME,
    retry,
  });
}

export function useUserCharacter(userId: string | number | null | undefined) {
  return useQuery<CharacterState>({
    queryKey: queryKeys.gamificationCharacterUser(userId),
    queryFn: () => fetchUserCharacter(userId as string | number),
    enabled: hasId(userId),
    staleTime: STALE_TIME,
    retry,
  });
}

/** Мутация выбора пути: обновляет кэш персонажа и шлёт path_chosen. */
export function useChooseCharacterPath() {
  const qc = useQueryClient();
  return useMutation<CharacterState, unknown, ChoosePathInput>({
    mutationFn: chooseCharacterPath,
    onSuccess: (next, input) => {
      qc.setQueryData<CharacterState>(queryKeys.gamificationCharacterMe(), next);
      trackPathChosen({ pathSlug: input.pathSlug, characterLevel: next.level });
    },
  });
}
