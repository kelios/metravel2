// hooks/useAchievementsApi.ts
// React Query хуки системы достижений. Серверный стейт — только через React Query
// (docs/ACHIEVEMENTS_DESIGN.md §8).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchBadgeCatalog,
  fetchMyAchievements,
  fetchPeerBadgeCatalog,
  fetchTravelPeerBadges,
  fetchUserAchievements,
  grantPeerBadge,
  type Badge,
  type GrantInput,
  type GrantResult,
  type MyAchievements,
  type PeerBadge,
  type PeerBadgeReceived,
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

/** Публичные достижения автора (earned + ранг + peer-награды от сообщества). */
export function useUserAchievements(userId: string | number | null | undefined) {
  return useQuery<PublicAchievements>({
    queryKey: queryKeys.achievementsUser(userId),
    queryFn: () => fetchUserAchievements(userId as string | number),
    enabled: userId != null && userId !== '',
    staleTime: STALE_TIME,
    retry,
  });
}

// ── Peer-awarded badges (§10) ───────────────────────────────────────────────

/** Каталог grantable peer-значков (для пикера выдачи). */
export function usePeerBadgeCatalog() {
  return useQuery<PeerBadge[]>({
    queryKey: queryKeys.achievementsPeerCatalog(),
    queryFn: fetchPeerBadgeCatalog,
    staleTime: STALE_TIME,
    retry,
  });
}

/** Peer-награды конкретного travel. */
export function useTravelPeerBadges(travelId: string | number | null | undefined) {
  return useQuery<PeerBadgeReceived[]>({
    queryKey: queryKeys.achievementsTravelPeer(travelId),
    queryFn: () => fetchTravelPeerBadges(travelId as string | number),
    enabled: travelId != null && travelId !== '',
    staleTime: STALE_TIME,
    retry,
  });
}

/** Toggle counts/grantedByMe для значка с заданным slug в списке peer-наград. */
const togglePeer = (
  list: PeerBadgeReceived[],
  badgeSlug: string,
  catalog: PeerBadge[] | undefined,
): PeerBadgeReceived[] => {
  const idx = list.findIndex((r) => r.badge.slug === badgeSlug);
  if (idx >= 0) {
    const item = list[idx];
    const grantedByMe = !item.grantedByMe;
    const next = [...list];
    next[idx] = {
      ...item,
      grantedByMe,
      count: Math.max(0, item.count + (grantedByMe ? 1 : -1)),
    };
    return next;
  }
  const badge = catalog?.find((b) => b.slug === badgeSlug);
  return badge ? [...list, { badge, count: 1, grantedByMe: true }] : list;
};

const applyServerCount = (
  list: PeerBadgeReceived[],
  badgeSlug: string,
  result: GrantResult,
): PeerBadgeReceived[] =>
  list.map((r) =>
    r.badge.slug === badgeSlug
      ? { ...r, grantedByMe: result.granted, count: result.count }
      : r,
  );

interface GrantContext {
  isTravel: boolean;
  travelKey: ReturnType<typeof queryKeys.achievementsTravelPeer>;
  userKey: ReturnType<typeof queryKeys.achievementsUser>;
  prevTravel?: PeerBadgeReceived[];
  prevUser?: PublicAchievements;
}

/** Мутация выдачи peer-значка с оптимистичным toggle. */
export function useGrantPeerBadge() {
  const qc = useQueryClient();
  return useMutation<GrantResult, unknown, GrantInput, GrantContext>({
    mutationFn: grantPeerBadge,
    onMutate: async (input) => {
      const catalog = qc.getQueryData<PeerBadge[]>(queryKeys.achievementsPeerCatalog());
      const ctx: GrantContext = {
        isTravel: input.travelId != null,
        travelKey: queryKeys.achievementsTravelPeer(input.travelId),
        userKey: queryKeys.achievementsUser(input.recipientId),
      };
      if (ctx.isTravel) {
        await qc.cancelQueries({ queryKey: ctx.travelKey });
        ctx.prevTravel = qc.getQueryData<PeerBadgeReceived[]>(ctx.travelKey);
        qc.setQueryData<PeerBadgeReceived[]>(ctx.travelKey, (old) =>
          togglePeer(old ?? [], input.badgeSlug, catalog),
        );
      } else {
        await qc.cancelQueries({ queryKey: ctx.userKey });
        ctx.prevUser = qc.getQueryData<PublicAchievements>(ctx.userKey);
        qc.setQueryData<PublicAchievements>(ctx.userKey, (old) =>
          old
            ? { ...old, peerReceived: togglePeer(old.peerReceived, input.badgeSlug, catalog) }
            : old,
        );
      }
      return ctx;
    },
    onError: (_err, _input, ctx) => {
      if (!ctx) return;
      if (ctx.isTravel) qc.setQueryData(ctx.travelKey, ctx.prevTravel);
      else qc.setQueryData(ctx.userKey, ctx.prevUser);
    },
    onSuccess: (result, input, ctx) => {
      if (!ctx) return;
      if (ctx.isTravel) {
        qc.setQueryData<PeerBadgeReceived[]>(ctx.travelKey, (old) =>
          old ? applyServerCount(old, input.badgeSlug, result) : old,
        );
      } else {
        qc.setQueryData<PublicAchievements>(ctx.userKey, (old) =>
          old
            ? { ...old, peerReceived: applyServerCount(old.peerReceived, input.badgeSlug, result) }
            : old,
        );
      }
    },
  });
}
