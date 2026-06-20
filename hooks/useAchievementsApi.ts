// hooks/useAchievementsApi.ts
// React Query хуки системы достижений. Серверный стейт — только через React Query
// (docs/ACHIEVEMENTS_DESIGN.md §8).

import { useQuery } from '@tanstack/react-query';

import {
  fetchBadgeCatalog,
  fetchMyAchievements,
  fetchUserAchievements,
  type Badge,
  type MyAchievements,
  type PublicAchievements,
} from '@/api/achievements';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';

const STALE_TIME = 5 * 60 * 1000;

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && failureCount < 2;

/** Справочник всех значков (галерея, в т.ч. ещё не полученных). */
export function useBadgeCatalog() {
  return useQuery<Badge[]>({
    queryKey: queryKeys.achievementsBadges(),
    queryFn: fetchBadgeCatalog,
    staleTime: STALE_TIME,
    retry,
  });
}

/** Достижения текущего пользователя: значки + ранг + прогресс к незакрытым. */
export function useMyAchievements() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<MyAchievements>({
    queryKey: queryKeys.achievementsMe(),
    queryFn: fetchMyAchievements,
    enabled: isAuthenticated,
    staleTime: STALE_TIME,
    retry,
  });
}

/** Публичные достижения автора (только earned + ранг). */
export function useUserAchievements(userId: string | number | null | undefined) {
  return useQuery<PublicAchievements>({
    queryKey: queryKeys.achievementsUser(userId),
    queryFn: () => fetchUserAchievements(userId as string | number),
    enabled: userId != null && userId !== '',
    staleTime: STALE_TIME,
    retry,
  });
}
