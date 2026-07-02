// hooks/useGamification.ts
// React Query хуки геймификации-2 (Sprint 10). Серверный стейт — только через
// React Query. Мутация выбора пути инвалидирует состояние персонажа и шлёт аналитику.

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  chooseCharacterPath,
  fetchMyCharacter,
  fetchMyGamificationProgress,
  fetchMyPlaceFirstBadges,
  fetchUserCharacter,
  fetchUserGamificationProgress,
  fetchUserPlaceFirstBadges,
  mapCharacter,
  mapProgress,
  type CharacterState,
  type ChoosePathInput,
  type GamificationProgress,
  type PlaceFirstBadge,
} from '@/api/gamification';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { trackPathChosen } from '@/utils/gamificationAnalytics';
import { useMyAchievements } from '@/hooks/useAchievementsApi';

const STALE_TIME = 5 * 60 * 1000;

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && !isTimeoutError(error) && failureCount < 2;

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
  const qc = useQueryClient();
  // Подписываемся на консолидированный /achievements/me/ (дедуп — тот же кэш),
  // чтобы переоценивать `enabled`, когда он зарезолвится (#588).
  const { data: ach, isSuccess: achSuccess, isFetching: achFetching } =
    useMyAchievements({ enabled: isAuthenticated });

  // Пока achievements ещё грузится — НЕ дёргаем /progression/me/: дождёмся
  // консолидированного payload'а и засеемся из него. Отдельный запрос делаем
  // только если achievements зарезолвился, но прогрессии в нём не оказалось.
  const consolidatedHasProgression = ach?.progressionDto != null;
  const needsSeparateFetch = achSuccess && !consolidatedHasProgression;

  const query = useQuery<GamificationProgress>({
    queryKey: queryKeys.gamificationProgressMe(),
    queryFn: fetchMyGamificationProgress,
    enabled: isAuthenticated && needsSeparateFetch,
    staleTime: STALE_TIME,
    retry,
    initialData: () => {
      const cached = qc.getQueryData<{ progressionDto?: unknown }>(
        queryKeys.achievementsMe(),
      ) as { progressionDto?: Parameters<typeof mapProgress>[0] } | undefined;
      if (cached?.progressionDto == null) return undefined;
      return mapProgress(cached.progressionDto);
    },
    initialDataUpdatedAt: () =>
      qc.getQueryState(queryKeys.achievementsMe())?.dataUpdatedAt ?? 0,
  });

  const isFetching = query.isFetching || (!query.data && achFetching);
  return { ...query, isFetching };
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
  const qc = useQueryClient();
  const { data: ach, isSuccess: achSuccess, isFetching: achFetching } =
    useMyAchievements({ enabled: isAuthenticated });

  const consolidatedHasCharacter = ach?.characterDto != null;
  const needsSeparateFetch = achSuccess && !consolidatedHasCharacter;

  const query = useQuery<CharacterState>({
    queryKey: queryKeys.gamificationCharacterMe(),
    queryFn: fetchMyCharacter,
    // #588: консолидированный /achievements/me/ уже содержит персонажа — отдельный
    // /character/me/ дёргаем только если его там не оказалось.
    enabled: isAuthenticated && needsSeparateFetch,
    staleTime: STALE_TIME,
    retry,
    initialData: () => {
      const cached = qc.getQueryData(queryKeys.achievementsMe()) as
        | { characterDto?: Parameters<typeof mapCharacter>[0] | null }
        | undefined;
      if (cached?.characterDto == null) return undefined;
      return mapCharacter(cached.characterDto);
    },
    initialDataUpdatedAt: () =>
      qc.getQueryState(queryKeys.achievementsMe())?.dataUpdatedAt ?? 0,
  });

  // Пока консолидированный запрос грузится, показываем его loading-состояние,
  // чтобы вкладка «Ваш путь» не мигала пустотой.
  const isFetching =
    query.isFetching || (!query.data && achFetching);
  return { ...query, isFetching };
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

// ── Засев кэшей из консолидированного /achievements/me/ (#588) ────────────────

/**
 * Консолидированный `/achievements/me/` уже возвращает состояние персонажа и
 * линейки прогрессии. Этот хук засевает их в кэши gamification, как только
 * achievements-запрос резолвится, чтобы вкладка «Ваш путь» рендерилась сразу,
 * без двух отдельных медленных запросов `/character/me/` и `/progression/me/`.
 *
 * Вызывать на вкладке «Обзор», где `useMyAchievements` всё равно активен.
 */
export function useSeedGamificationFromAchievements(enabled = true): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();
  const { data } = useMyAchievements({ enabled: enabled && isAuthenticated });

  const updatedAt = qc.getQueryState(queryKeys.achievementsMe())?.dataUpdatedAt;

  useEffect(() => {
    if (!data) return;

    if (data.characterDto != null) {
      const state = qc.getQueryState(queryKeys.gamificationCharacterMe());
      if (state?.data == null) {
        qc.setQueryData(
          queryKeys.gamificationCharacterMe(),
          mapCharacter(data.characterDto),
          { updatedAt },
        );
      }
    }

    if (data.progressionDto != null) {
      const state = qc.getQueryState(queryKeys.gamificationProgressMe());
      if (state?.data == null) {
        qc.setQueryData(
          queryKeys.gamificationProgressMe(),
          mapProgress(data.progressionDto),
          { updatedAt },
        );
      }
    }
  }, [data, qc, updatedAt]);
}
