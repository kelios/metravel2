import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { fetchCompactSocialPage, fetchMySubscribers, type AuthorWithTravels, type SocialListKind } from '@/api/user';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/context/AuthContext';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import { useSubscriptionMutation } from '@/hooks/useSubscription';
import { translate as i18nT } from '@/i18n';
import { confirmAction } from '@/utils/confirmAction';
import { readRetryTwice } from '@/utils/queryRetryPolicy';

export type SubscriptionTab = SocialListKind;

type UseSubscriptionsDataOptions = {
  enabled?: boolean;
  readSubscriptions?: boolean;
  readSubscribers?: boolean;
};

const EMPTY_ROWS: AuthorWithTravels[] = [];
const EMPTY_INVITE_SUBSCRIBERS: Awaited<ReturnType<typeof fetchMySubscribers>> = [];

export function useInviteSubscribers(enabled: boolean) {
  const owner = useQueryOwner();
  const query = useQuery({
    queryKey: queryKeys.mySubscribers(owner),
    queryFn: fetchMySubscribers,
    enabled: enabled && owner !== null,
    staleTime: 5 * 60 * 1000,
    retry: readRetryTwice,
  });
  return { subscribers: query.data ?? EMPTY_INVITE_SUBSCRIBERS, subscribersLoading: query.isLoading };
}

function useSocialPage(kind: SocialListKind, owner: string | null, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.compactSocialPage(owner, kind),
    queryFn: ({ pageParam, signal }) => fetchCompactSocialPage(kind, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (page, _pages, pageNumber) => page.hasNext ? pageNumber + 1 : undefined,
    enabled,
    subscribed: enabled,
    staleTime: 5 * 60 * 1000,
    retry: readRetryTwice,
  });
  const pages = query.data?.pages;
  const rows = useMemo(() => pages?.flatMap((page) => page.results) ?? EMPTY_ROWS, [pages]);
  const count = pages?.at(-1)?.count ?? (query.isError ? null : undefined);
  const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, isLoading, refetch } = query;
  const pageControls = useMemo(() => ({
    canLoadMore: hasNextPage,
    isFetching,
    hasError: (!pages?.length && (query.isError || query.isPaused)) || isFetchNextPageError,
    loadMore: () => { if (hasNextPage && !isFetching) void fetchNextPage({ cancelRefetch: false }); },
    retry: () => { if (isFetchNextPageError) void fetchNextPage({ cancelRefetch: false }); else void refetch(); },
  }), [fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, pages, query.isError, query.isPaused, refetch]);

  return { rows, count, isLoading, dataUpdatedAt: query.dataUpdatedAt, pageControls };
}

export type SubscriptionPageControls = ReturnType<typeof useSocialPage>['pageControls'];

export function useSubscriptionsData({
  enabled = true,
  readSubscriptions = true,
  readSubscribers = true,
}: UseSubscriptionsDataOptions = {}) {
  const { isAuthenticated, authReady } = useAuth();
  const owner = useQueryOwner();
  const canRead = authReady && isAuthenticated && owner !== null && enabled;
  const subscriptions = useSocialPage('subscriptions', owner, canRead && readSubscriptions);
  const subscribers = useSocialPage('subscribers', owner, canRead && readSubscribers);
  const { mutateAsync, isPending } = useSubscriptionMutation();

  const handleUnsubscribe = useCallback(async (target: number) => {
    if (!owner || isPending) return;
    const confirmed = await confirmAction({
      title: i18nT('shared:hooks.useSubscriptionsData.otpisatsya_b4c7f63a'),
      message: i18nT('shared:hooks.useSubscriptionsData.vy_uvereny_chto_hotite_otpisatsya_ot_etogo_a_68da60cc'),
      confirmText: i18nT('shared:hooks.useSubscriptionsData.otpisatsya_b4c7f63a'),
      cancelText: i18nT('common:action.cancel'),
    });
    if (!confirmed) return;
    try {
      await mutateAsync({ owner, target, subscribe: false });
    } catch {
      // Keep the current list when the server rejects the mutation.
    }
  }, [isPending, mutateAsync, owner]);

  return {
    isAuthenticated,
    authReady,
    authors: subscriptions.rows,
    subscribers: subscribers.rows,
    subscriptionsCount: subscriptions.count,
    subscribersCount: subscribers.count,
    subscriptionsDataUpdatedAt: subscriptions.dataUpdatedAt,
    subscribersDataUpdatedAt: subscribers.dataUpdatedAt,
    subscriptionsLoading: subscriptions.isLoading,
    subscribersLoading: subscribers.isLoading,
    subscriptionsPage: subscriptions.pageControls,
    subscribersPage: subscribers.pageControls,
    handleUnsubscribe,
  };
}
