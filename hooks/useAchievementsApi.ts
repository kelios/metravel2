import { readRetryTwice } from '@/utils/queryRetryPolicy';
// hooks/useAchievementsApi.ts
// React Query хуки системы достижений. Серверный стейт — только через React Query
// (docs/ACHIEVEMENTS_DESIGN.md §8).

import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import { useEffect } from 'react';

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

import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import { useLocaleRevision } from '@/i18n/useLocaleRevision';
import type { SupportedLocale } from '@/i18n/config';

const STALE_TIME = 5 * 60 * 1000;

// Не ретраим отмену И таймаут: эти секции (автор/достижения/peer-badges) deferred,
// а повтор зависшего бэка лишь утраивает мёртвое ожидание под спиннером (~33с вместо
// ~10с). Таймаут fetchWithTimeout — это name='TimeoutError', не 'AbortError'.

/** Справочник всех значков (галерея, в т.ч. ещё не полученных). */
export function useBadgeCatalog() {
  const locale = useLocaleRevision();
  return useQuery<Badge[]>({
    queryKey: queryKeys.achievementsBadges(locale),
    queryFn: () => fetchBadgeCatalog(locale),
    staleTime: STALE_TIME,
    retry: readRetryTwice,
  });
}

/** Достижения текущего пользователя: значки + ранг + прогресс к незакрытым. */
export function useMyAchievements(options: { enabled?: boolean } = {}) {
  const locale = useLocaleRevision();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const owner = useQueryOwner();
  return useQuery<MyAchievements>({
    queryKey: queryKeys.achievementsMe(owner, locale),
    queryFn: () => fetchMyAchievements(locale),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: STALE_TIME,
    retry: readRetryTwice,
  });
}

/** Публичные достижения автора (earned + ранг + peer-награды от сообщества). */
export function useUserAchievements(userId: string | number | null | undefined) {
  const locale = useLocaleRevision();
  const authReady = useAuthStore((s) => s.authReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const viewer = useQueryOwner();
  return useQuery<PublicAchievements>({
    queryKey: queryKeys.achievementsUser(userId, viewer, locale),
    queryFn: () => fetchUserAchievements(userId as string | number, locale, { authenticated: viewer != null }),
    enabled: authReady && (!isAuthenticated || !!viewer) && userId != null && userId !== '',
    staleTime: STALE_TIME,
    retry: readRetryTwice,
  });
}

// ── Peer-awarded badges (§10) ───────────────────────────────────────────────

/** Каталог grantable peer-значков (для пикера выдачи). */
export function usePeerBadgeCatalog() {
  return useQuery<PeerBadge[]>({
    queryKey: queryKeys.achievementsPeerCatalog(),
    queryFn: fetchPeerBadgeCatalog,
    staleTime: STALE_TIME,
    retry: readRetryTwice,
  });
}

/** Peer-награды конкретного travel. */
export function useTravelPeerBadges(travelId: string | number | null | undefined) {
  const authReady = useAuthStore((s) => s.authReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const viewer = useQueryOwner();
  return useQuery<PeerBadgeReceived[]>({
    queryKey: queryKeys.achievementsTravelPeer(travelId, viewer),
    queryFn: () => fetchTravelPeerBadges(travelId as string | number, { authenticated: viewer != null }),
    enabled: authReady && (!isAuthenticated || !!viewer) && travelId != null && travelId !== '',
    staleTime: STALE_TIME,
    retry: readRetryTwice,
  });
}

// ── Редкие награды (Sprint 11 / блок B) ──────────────────────────────────────

/** Редкие награды текущего пользователя (своя зона профиля). */
export function useMyRareAwards() {
  const locale = useLocaleRevision();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const owner = useQueryOwner();
  const qc = useQueryClient();
  // Живой /achievements/me/ отдаёт rare_awards top-level — засеваемся из него и
  // отдельный /rare-awards/me/ дёргаем только когда поля в ответе не оказалось.
  const { data: ach, isSuccess: achSuccess, isFetching: achFetching } =
    useMyAchievements({ enabled: isAuthenticated });
  const consolidatedHasRare = ach?.rareAwards != null;
  const needsSeparateFetch = achSuccess && !consolidatedHasRare;

  const query = useQuery<RareAward[]>({
    queryKey: queryKeys.achievementsRareMe(owner, locale),
    queryFn: fetchMyRareAwards,
    enabled: isAuthenticated && needsSeparateFetch,
    staleTime: STALE_TIME,
    retry: readRetryTwice,
    initialData: () => {
      const cached = qc.getQueryData<MyAchievements>(queryKeys.achievementsMe(owner, locale));
      return cached?.rareAwards ?? undefined;
    },
    initialDataUpdatedAt: () =>
      qc.getQueryState(queryKeys.achievementsMe(owner, locale))?.dataUpdatedAt ?? 0,
  });

  const updatedAt = qc.getQueryState(queryKeys.achievementsMe(owner, locale))?.dataUpdatedAt;
  useEffect(() => {
    if (ach?.rareAwards == null || !isAuthenticated || currentOwner() !== owner) return;
    if (qc.getQueryData(queryKeys.achievementsMe(owner, locale)) !== ach) return;
    qc.setQueryData(queryKeys.achievementsRareMe(owner, locale), ach.rareAwards, { updatedAt });
  }, [ach, isAuthenticated, locale, owner, qc, updatedAt]);

  const isFetching = query.isFetching || (!query.data && achFetching);
  return { ...query, isFetching };
}

/** Публичные редкие награды автора. */
export function useUserRareAwards(userId: string | number | null | undefined) {
  const locale = useLocaleRevision();
  const viewer = useQueryOwner();
  const qc = useQueryClient();
  // /user/{id}/ отдаёт rare_awards top-level → сеемся из него, отдельный
  // /user/{id}/rare-awards/ только как fallback, когда поля не было.
  const { data: ach, isSuccess: achSuccess, isFetching: achFetching } =
    useUserAchievements(userId);
  const consolidatedHasRare = ach?.rareAwards != null;
  const needsSeparateFetch = achSuccess && !consolidatedHasRare;

  const query = useQuery<RareAward[]>({
    queryKey: queryKeys.achievementsRareUser(userId, locale),
    queryFn: () => fetchUserRareAwards(userId as string | number),
    enabled: userId != null && userId !== '' && needsSeparateFetch,
    staleTime: STALE_TIME,
    retry: readRetryTwice,
    initialData: () => {
      const cached = qc.getQueryData<PublicAchievements>(
        queryKeys.achievementsUser(userId, viewer, locale),
      );
      return cached?.rareAwards ?? undefined;
    },
    initialDataUpdatedAt: () =>
      qc.getQueryState(queryKeys.achievementsUser(userId, viewer, locale))?.dataUpdatedAt ?? 0,
  });

  const updatedAt = qc.getQueryState(queryKeys.achievementsUser(userId, viewer, locale))?.dataUpdatedAt;
  useEffect(() => {
    if (ach?.rareAwards == null) return;
    if (qc.getQueryData(queryKeys.achievementsUser(userId, viewer, locale)) !== ach) return;
    qc.setQueryData(queryKeys.achievementsRareUser(userId, locale), ach.rareAwards, { updatedAt });
  }, [ach, locale, qc, updatedAt, userId, viewer]);

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
    retry: readRetryTwice,
  });
}

/** Мутация выдачи редкой награды админом. Инвалидирует зону наград получателя. */
export function useGrantRareAward() {
  const qc = useQueryClient();
  const owner = useQueryOwner();
  return useMutation<RareAwardGrant, unknown, GrantRareAwardInput, { owner: string | null }>({
    mutationFn: grantRareAward,
    onMutate: () => ({ owner }),
    onSuccess: (_result, input, ctx) => {
      void qc.invalidateQueries({ queryKey: queryKeys.achievementsRareUserAll(input.userId) });
      void qc.invalidateQueries({ queryKey: queryKeys.achievementsUserAll(input.userId) });
      if (ctx?.owner != null) {
        void qc.invalidateQueries({ queryKey: queryKeys.achievementsRareMeAll(ctx.owner) });
        void qc.invalidateQueries({ queryKey: queryKeys.achievementsMeAll(ctx.owner) });
      }
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

const restorePeerBadge = (
  list: PeerBadgeReceived[],
  badgeSlug: string,
  previous: PeerBadgeReceived[] | undefined,
): PeerBadgeReceived[] => {
  const original = previous?.find((item) => item.badge.slug === badgeSlug);
  return original
    ? list.map((item) => item.badge.slug === badgeSlug ? original : item)
    : list.filter((item) => item.badge.slug !== badgeSlug);
};

interface GrantContext {
  isTravel: boolean;
  owner: string | null;
  locale: SupportedLocale;
  query?: Query;
  travelKey: ReturnType<typeof queryKeys.achievementsTravelPeer>;
  userKey: ReturnType<typeof queryKeys.achievementsUser>;
  prevTravel?: PeerBadgeReceived[];
  prevUser?: PublicAchievements;
}

const currentOwner = (): string | null => {
  const state = useAuthStore.getState();
  return state.isAuthenticated ? state.userId : null;
};

// Removed/recreated queries belong to a new cache lifetime, even after a same-user login.
const isOriginalMutationCache = (
  ctx: GrantContext,
  qc: ReturnType<typeof useQueryClient>,
): boolean => ctx.query != null && currentOwner() === ctx.owner &&
  qc.getQueryCache().find({ queryKey: ctx.isTravel ? ctx.travelKey : ctx.userKey, exact: true }) === ctx.query;

/** Мутация выдачи peer-значка с оптимистичным toggle. */
export function useGrantPeerBadge() {
  const locale = useLocaleRevision();
  const owner = useQueryOwner();
  const qc = useQueryClient();
  return useMutation<GrantResult, unknown, GrantInput, GrantContext>({
    mutationFn: grantPeerBadge,
    onMutate: async (input) => {
      const catalog = qc.getQueryData<PeerBadge[]>(queryKeys.achievementsPeerCatalog());
      const ctx: GrantContext = {
        isTravel: input.travelId != null,
        owner,
        locale,
        travelKey: queryKeys.achievementsTravelPeer(input.travelId, owner),
        userKey: queryKeys.achievementsUser(input.recipientId, owner, locale),
      };
      const key = ctx.isTravel ? ctx.travelKey : ctx.userKey;
      ctx.query = qc.getQueryCache().find({ queryKey: key, exact: true });
      await qc.cancelQueries({ queryKey: key });
      if (!isOriginalMutationCache(ctx, qc)) return ctx;
      if (ctx.isTravel) {
        ctx.prevTravel = qc.getQueryData<PeerBadgeReceived[]>(ctx.travelKey);
        qc.setQueryData<PeerBadgeReceived[]>(ctx.travelKey, (old) =>
          togglePeer(old ?? [], input.badgeSlug, catalog),
        );
      } else {
        ctx.prevUser = qc.getQueryData<PublicAchievements>(ctx.userKey);
        qc.setQueryData<PublicAchievements>(ctx.userKey, (old) =>
          old
            ? { ...old, peerReceived: togglePeer(old.peerReceived, input.badgeSlug, catalog) }
            : old,
        );
      }
      return ctx;
    },
    onError: (_err, input, ctx) => {
      if (!ctx || !isOriginalMutationCache(ctx, qc)) return;
      if (ctx.isTravel) {
        qc.setQueryData<PeerBadgeReceived[]>(ctx.travelKey, (old) =>
          old ? restorePeerBadge(old, input.badgeSlug, ctx.prevTravel) : old,
        );
      } else {
        qc.setQueryData<PublicAchievements>(ctx.userKey, (old) =>
          old ? { ...old, peerReceived: restorePeerBadge(old.peerReceived, input.badgeSlug, ctx.prevUser?.peerReceived) } : old,
        );
      }
    },
    onSuccess: (result, input, ctx) => {
      if (!ctx || !isOriginalMutationCache(ctx, qc)) return;
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
    onSettled: (_result, _error, input, ctx) => {
      if (!ctx) return;
      if (ctx.isTravel) {
        void qc.invalidateQueries({ queryKey: queryKeys.achievementsTravelPeerAll(input.travelId) });
      }
      if (input.recipientId != null) {
        void qc.invalidateQueries({ queryKey: queryKeys.achievementsUserAll(input.recipientId) });
        void qc.invalidateQueries({ queryKey: queryKeys.achievementsRareUserAll(input.recipientId) });
      }
      if (ctx.owner != null && currentOwner() === ctx.owner) {
        void qc.invalidateQueries({ queryKey: queryKeys.achievementsMeAll(ctx.owner) });
        void qc.invalidateQueries({ queryKey: queryKeys.achievementsRareMeAll(ctx.owner) });
      }
    },
  });
}
