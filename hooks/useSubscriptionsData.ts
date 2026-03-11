// hooks/useSubscriptionsData.ts
// D1: Data-fetching hook extracted from subscriptions.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { fetchMySubscriptions, fetchMySubscribers, unsubscribeFromUser, type UserProfileDto } from '@/api/user';
import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelUserQueries';
import { ApiError } from '@/api/client';
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

export function useSubscriptionsData() {
  const { isAuthenticated, authReady } = useAuth();
  const queryClient = useQueryClient();

  const retryFn = useCallback(
    (failureCount: number, error: Error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
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

  useEffect(() => {
    if (!subscriptions.length) return;

    subscriptions.forEach((profile) => {
      const userId = profile.user ?? profile.id;

      setAuthorTravels((prev) => {
        if (prev[userId] && !prev[userId].loading) return prev;
        if (prev[userId]?.loading) return prev;
        return {
          ...prev,
          [userId]: {
            travels: prev[userId]?.travels ?? [],
            total: prev[userId]?.total ?? 0,
            loading: true,
          },
        };
      });

      fetchMyTravels({ user_id: userId, perPage: SUBSCRIPTION_TRAVELS_PREVIEW_LIMIT })
        .then((result) => {
          const { items: list, total } = unwrapMyTravelsPayload(result);
          const normalizedTravels = list.map(normalizeTravelPreview);
          setAuthorTravels((prev) => ({
            ...prev,
            [userId]: {
              travels: normalizedTravels,
              total: total || normalizedTravels.length,
              loading: false,
            },
          }));
        })
        .catch(() => {
          setAuthorTravels((prev) => ({
            ...prev,
            [userId]: { travels: [], total: 0, loading: false },
          }));
        });
    });
  }, [subscriptions]);

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
