// hooks/useAchievementsApi.ts
// React Query хуки системы достижений. Серверный стейт — только через React Query
// (docs/ACHIEVEMENTS_DESIGN.md §8).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchBadgeCatalog,
  fetchMyAchievements,
  fetchPeerBadgeCatalog,
  fetchRareAwardCatalog,
  fetchMyRareAwards,
  fetchTravelPeerBadges,
  fetchUserAchievements,
  fetchUserRareAwards,
  grantPeerBadge,
  grantRareAward,
  type Badge,
  type GrantInput,
  type GrantRareAwardInput,
  type GrantResult,
  type MyAchievements,
  type PeerBadge,
  type PeerBadgeReceived,
  type PublicAchievements,
  type RareAward,
  type RareAwardCatalogItem,
  type RareAwardGrant,
} from '@/api/achievements';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';

const STALE_TIME = 5 * 60 * 1000;

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

// Не ретраим отмену И таймаут: эти секции (автор/достижения/peer-badges) deferred,
// а повтор зависшего бэка лишь утраивает мёртвое ожидание под спиннером (~33с вместо
// ~10с). Таймаут fetchWithTimeout — это name='TimeoutError', не 'AbortError'.
const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && !isAbortError(error) && !isTimeoutError(error) && failureCount < 2;

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
export function useMyAchievements(options: { enabled?: boolean } = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<MyAchievements>({
    queryKey: queryKeys.achievementsMe(),
    queryFn: fetchMyAchievements,
    enabled: isAuthenticated && (options.enabled ?? true),
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

// ── Редкие награды (Sprint 11 / блок B) ──────────────────────────────────────

/** Редкие награды текущего пользователя (своя зона профиля). */
export function useMyRareAwards() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();
  // Живой /achievements/me/ отдаёт rare_awards top-level — засеваемся из него и
  // отдельный /rare-awards/me/ дёргаем только когда поля в ответе не оказалось.
  const { data: ach, isSuccess: achSuccess, isFetching: achFetching } =
    useMyAchievements({ enabled: isAuthenticated });
  const consolidatedHasRare = ach?.rareAwards != null;
  const needsSeparateFetch = achSuccess && !consolidatedHasRare;

  const query = useQuery<RareAward[]>({
    queryKey: queryKeys.achievementsRareMe(),
    queryFn: fetchMyRareAwards,
    enabled: isAuthenticated && needsSeparateFetch,
    staleTime: STALE_TIME,
    retry,
    initialData: () => {
      const cached = qc.getQueryData<MyAchievements>(queryKeys.achievementsMe());
      return cached?.rareAwards ?? undefined;
    },
    initialDataUpdatedAt: () =>
      qc.getQueryState(queryKeys.achievementsMe())?.dataUpdatedAt ?? 0,
  });

  const isFetching = query.isFetching || (!query.data && achFetching);
  return { ...query, isFetching };
}

/** Публичные редкие награды автора. */
export function useUserRareAwards(userId: string | number | null | undefined) {
  const qc = useQueryClient();
  // /user/{id}/ отдаёт rare_awards top-level → сеемся из него, отдельный
  // /user/{id}/rare-awards/ только как fallback, когда поля не было.
  const { data: ach, isSuccess: achSuccess, isFetching: achFetching } =
    useUserAchievements(userId);
  const consolidatedHasRare = ach?.rareAwards != null;
  const needsSeparateFetch = achSuccess && !consolidatedHasRare;

  const query = useQuery<RareAward[]>({
    queryKey: queryKeys.achievementsRareUser(userId),
    queryFn: () => fetchUserRareAwards(userId as string | number),
    enabled: userId != null && userId !== '' && needsSeparateFetch,
    staleTime: STALE_TIME,
    retry,
    initialData: () => {
      const cached = qc.getQueryData<PublicAchievements>(
        queryKeys.achievementsUser(userId),
      );
      return cached?.rareAwards ?? undefined;
    },
    initialDataUpdatedAt: () =>
      qc.getQueryState(queryKeys.achievementsUser(userId))?.dataUpdatedAt ?? 0,
  });

  const isFetching = query.isFetching || (!query.data && achFetching);
  return { ...query, isFetching };
}

/** Каталог редких наград для админ-пикера выдачи (staff-only). */
export function useRareAwardCatalog(enabled = true) {
  return useQuery<RareAwardCatalogItem[]>({
    queryKey: queryKeys.achievementsRareCatalog(),
    queryFn: fetchRareAwardCatalog,
    enabled,
    staleTime: STALE_TIME,
    retry,
  });
}

/** Мутация выдачи редкой награды админом. Инвалидирует зону наград получателя. */
export function useGrantRareAward() {
  const qc = useQueryClient();
  return useMutation<RareAwardGrant, unknown, GrantRareAwardInput>({
    mutationFn: grantRareAward,
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.achievementsRareUser(input.userId) });
      qc.invalidateQueries({ queryKey: queryKeys.achievementsRareMe() });
    },
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
