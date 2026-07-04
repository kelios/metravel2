// hooks/useSubscriptionsData.ts
// D1: Data-fetching hook extracted from subscriptions.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { fetchMySubscriptions, fetchMySubscribers, unsubscribeFromUser, type UserProfileDto } from '@/api/user';
import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelUserQueries';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/queryKeys';
import { confirmAction } from '@/utils/confirmAction';
import { normalizeTravelPreview, type TravelPreview } from '@/utils/subscriptionsHelpers';

export type SubscriptionTab = 'subscriptions' | 'subscribers';

export type AuthorWithTravels = {
  profile: UserProfileDto;
  travels: TravelPreview[];
  travelsTotal: number;
  isLoadingTravels: boolean;
};

const SUBSCRIPTION_TRAVELS_PREVIEW_LIMIT = 10;
const AUTHOR_TRAVELS_FETCH_CONCURRENCY = 4;

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const pump = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  };
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => pump());
  await Promise.all(runners);
}

interface UseSubscriptionsDataOptions {
  /**
   * Подгружать превью путешествий по каждому автору подписки (N запросов).
   * Нужно только экрану подписок, который рендерит карточки авторов. Шапке профиля
   * и пикеру приглашений нужны лишь счётчики/списки — для них держим false,
   * чтобы не плодить N+1 фетчей при заходе в профиль (тикет #473 — дешёвый BE-счётчик).
   */
  includeAuthorTravels?: boolean;
}

export function useSubscriptionsData(options: UseSubscriptionsDataOptions = {}) {
  const { includeAuthorTravels = false } = options;
  const { isAuthenticated, authReady } = useAuth();
  const queryClient = useQueryClient();

  const retryFn = useCallback(
    (failureCount: number, error: Error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
      if (isTimeoutError(error)) return false;
      return failureCount < 2;
    },
    []
  );

  const subscriptionsQuery = useQuery<UserProfileDto[]>({
    queryKey: queryKeys.mySubscriptions(),
    queryFn: fetchMySubscriptions,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: retryFn,
  });

  const subscribersQuery = useQuery<UserProfileDto[]>({
    queryKey: queryKeys.mySubscribers(),
    queryFn: fetchMySubscribers,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: retryFn,
  });

  const subscriptions = useMemo(() => subscriptionsQuery.data ?? [], [subscriptionsQuery.data]);
  const subscribers = useMemo(() => subscribersQuery.data ?? [], [subscribersQuery.data]);

  // Author travels loading
  const [authorTravels, setAuthorTravels] = useState<
    Record<number, { travels: TravelPreview[]; total: number; loading: boolean }>
  >({});
  const authorTravelsRef = useRef(authorTravels);
  authorTravelsRef.current = authorTravels;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!includeAuthorTravels) return;
    if (!subscriptions.length) return;

    let cancelled = false;

    const pending = subscriptions.filter((profile) => {
      const userId = profile.user ?? profile.id;
      const entry = authorTravelsRef.current[userId];
      return !entry || (!entry.loading && entry.travels.length === 0 && entry.total === 0);
    });
    if (!pending.length) return;

    const commit = (
      updater: (
        prev: Record<number, { travels: TravelPreview[]; total: number; loading: boolean }>
      ) => Record<number, { travels: TravelPreview[]; total: number; loading: boolean }>
    ) => {
      if (cancelled || !mountedRef.current) return;
      setAuthorTravels(updater);
    };

    commit((prev) => {
      const next = { ...prev };
      pending.forEach((profile) => {
        const userId = profile.user ?? profile.id;
        next[userId] = {
          travels: prev[userId]?.travels ?? [],
          total: prev[userId]?.total ?? 0,
          loading: true,
        };
      });
      return next;
    });

    void runWithConcurrency(pending, AUTHOR_TRAVELS_FETCH_CONCURRENCY, async (profile) => {
      if (cancelled || !mountedRef.current) return;
      const userId = profile.user ?? profile.id;
      try {
        const result = await fetchMyTravels({
          user_id: userId,
          perPage: SUBSCRIPTION_TRAVELS_PREVIEW_LIMIT,
        });
        const { items: list, total } = unwrapMyTravelsPayload(result);
        const normalizedTravels = list.map(normalizeTravelPreview);
        commit((prev) => ({
          ...prev,
          [userId]: {
            travels: normalizedTravels,
            total: total || normalizedTravels.length,
            loading: false,
          },
        }));
      } catch {
        commit((prev) => ({
          ...prev,
          [userId]: { travels: [], total: 0, loading: false },
        }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [subscriptions, includeAuthorTravels]);

  const authors: AuthorWithTravels[] = useMemo(
    () =>
      subscriptions.map((profile) => {
        const userId = profile.user ?? profile.id;
        const entry = authorTravels[userId];
        return {
          profile,
          travels: entry?.travels ?? [],
          travelsTotal: entry?.total ?? 0,
          isLoadingTravels: entry?.loading ?? true,
        };
      }),
    [subscriptions, authorTravels]
  );

  const getFullName = useCallback((p: UserProfileDto) => {
    const first = String(p.first_name ?? '').trim();
    const last = String(p.last_name ?? '').trim();
    return `${first} ${last}`.trim().toLowerCase();
  }, []);

  const handleUnsubscribe = useCallback(
    async (userId: number) => {
      const confirmed = await confirmAction({
        title: 'Отписаться',
        message: 'Вы уверены, что хотите отписаться от этого автора?',
        confirmText: 'Отписаться',
        cancelText: 'Отмена',
      });
      if (!confirmed) return;

      try {
        await unsubscribeFromUser(userId);
        queryClient.invalidateQueries({ queryKey: queryKeys.mySubscriptions() });
      } catch {
        // silent
      }
    },
    [queryClient]
  );

  return {
    isAuthenticated,
    authReady,
    subscriptions,
    subscribers,
    authors,
    subscriptionsLoading: subscriptionsQuery.isLoading,
    subscribersLoading: subscribersQuery.isLoading,
    getFullName,
    handleUnsubscribe,
  };
}
