import { useState, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTravels, fetchRandomTravels } from '@/src/api/travels';
import type { Travel } from '@/src/types/types';
import {
  PER_PAGE,
  STALE_TIME,
  GC_TIME,
  QUERY_CONFIG,
} from '../utils/listTravelConstants';
import { normalizeApiResponse, deduplicateTravels } from '../utils/listTravelHelpers';
import { safeJsonParseString } from '@/src/utils/safeJsonParse';

export interface UseListTravelDataProps {
  queryParams: Record<string, any>;
  search: string;
  isQueryEnabled: boolean;
}

export interface UseListTravelDataReturn {
  data: Travel[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  status: string;
  isInitialLoading: boolean;
  isNextPageLoading: boolean;
  isEmpty: boolean;
  refetch: () => Promise<any>;
  handleEndReached: () => void;
  handleRefresh: () => void;
  isRefreshing: boolean;
}

const countLoadedItems = (pages: Array<{ data?: Travel[] }>): number => {
  if (!Array.isArray(pages)) {
    return 0;
  }
  return pages.reduce((sum, page) => {
    if (Array.isArray(page?.data)) {
      return sum + page.data.length;
    }
    if (Array.isArray((page as any)?.items)) {
      return sum + (page as any).items.length;
    }
    return sum;
  }, 0);
};

export function useListTravelData({
  queryParams,
  search,
  isQueryEnabled,
}: UseListTravelDataProps): UseListTravelDataReturn {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryParamsStringified = useMemo(() => {
    const sorted = Object.keys(queryParams)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = queryParams[key];
        return acc;
      }, {});
    return JSON.stringify(sorted);
  }, [queryParams]);

  const queryKey = useMemo(
    () => [
      'travels',
      {
        perPage: PER_PAGE,
        search: search.trim(),
        params: queryParamsStringified,
      },
    ],
    [search, queryParamsStringified],
  );

  const queryParamsForFetch = useMemo(
    () => safeJsonParseString(queryParamsStringified, {}),
    [queryParamsStringified],
  );

  const {
    data,
    status,
    isFetching,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0, signal }) =>
      fetchTravels(pageParam, PER_PAGE, search.trim(), queryParamsForFetch, { signal }),
    enabled: isQueryEnabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const total = typeof lastPage?.total === 'number' ? lastPage.total : 0;
      if (!total) {
        return undefined;
      }
      const loaded = countLoadedItems(allPages as any);
      if (loaded >= total) {
        return undefined;
      }
      return allPages.length;
    },
    staleTime: STALE_TIME.TRAVELS,
    gcTime: GC_TIME.TRAVELS,
    refetchOnMount: QUERY_CONFIG.REFETCH_ON_MOUNT,
    refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,
  });

  const normalizedPages = useMemo(() => {
    if (!data?.pages?.length) {
      return [];
    }
    return data.pages.map((page) => normalizeApiResponse(page));
  }, [data]);

  const combinedTravels = useMemo(() => {
    if (!normalizedPages.length) {
      return [];
    }
    const flattened = normalizedPages.flatMap((page) => page.items);
    return deduplicateTravels(flattened);
  }, [normalizedPages]);

  const total = normalizedPages.length > 0 ? normalizedPages[0].total : 0;
  const hasAnyItems = combinedTravels.length > 0;
  const hasMore = Boolean(hasNextPage);

  const isInitialLoading = isLoading && !hasAnyItems;
  const isNextPageLoading = isFetchingNextPage;
  const isEmpty =
    isQueryEnabled &&
    status === 'success' &&
    !isFetching &&
    !isLoading &&
    !isFetchingNextPage &&
    !hasAnyItems;

  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    if (isFetchingNextPage) return;
    if (isFetching && !hasAnyItems) return;
    fetchNextPage();
  }, [hasMore, isFetchingNextPage, fetchNextPage, isFetching, hasAnyItems]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey });
    await refetch();
    setIsRefreshing(false);
  }, [queryClient, queryKey, refetch]);

  return {
    data: combinedTravels,
    total,
    hasMore,
    isLoading,
    isFetching,
    isError: status === 'error',
    status,
    isInitialLoading,
    isNextPageLoading,
    isEmpty,
    refetch,
    handleEndReached,
    handleRefresh,
    isRefreshing,
  };
}

export function useRandomTravelData({
  queryParams,
  search,
  isQueryEnabled,
}: UseListTravelDataProps): UseListTravelDataReturn {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryParamsStringified = useMemo(() => {
    const sorted = Object.keys(queryParams)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = queryParams[key];
        return acc;
      }, {});
    return JSON.stringify(sorted);
  }, [queryParams]);

  const queryKey = useMemo(
    () => [
      'random-travels',
      {
        perPage: PER_PAGE,
        search: search.trim(),
        params: queryParamsStringified,
      },
    ],
    [search, queryParamsStringified],
  );

  const queryParamsForFetch = useMemo(
    () => safeJsonParseString(queryParamsStringified, {}),
    [queryParamsStringified],
  );

  const {
    data,
    status,
    isFetching,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0, signal }) =>
      fetchRandomTravels(pageParam, PER_PAGE, search.trim(), queryParamsForFetch, { signal }),
    enabled: isQueryEnabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const total = typeof lastPage?.total === 'number' ? lastPage.total : 0;
      if (!total) {
        return undefined;
      }
      const loaded = countLoadedItems(allPages as any);
      if (loaded >= total) {
        return undefined;
      }
      return allPages.length;
    },
    staleTime: STALE_TIME.TRAVELS,
    gcTime: GC_TIME.TRAVELS,
    refetchOnMount: QUERY_CONFIG.REFETCH_ON_MOUNT,
    refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,
  });

  const normalizedPages = useMemo(() => {
    if (!data?.pages?.length) {
      return [];
    }
    return data.pages.map((page) => normalizeApiResponse(page));
  }, [data]);

  const combinedTravels = useMemo(() => {
    if (!normalizedPages.length) {
      return [];
    }
    const flattened = normalizedPages.flatMap((page) => page.items);
    return deduplicateTravels(flattened);
  }, [normalizedPages]);

  const total = normalizedPages.length > 0 ? normalizedPages[0].total : 0;
  const hasAnyItems = combinedTravels.length > 0;
  const hasMore = Boolean(hasNextPage);

  const isInitialLoading = isLoading && !hasAnyItems;
  const isNextPageLoading = isFetchingNextPage;
  const isEmpty =
    isQueryEnabled &&
    status === 'success' &&
    !isFetching &&
    !isLoading &&
    !isFetchingNextPage &&
    !hasAnyItems;

  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    if (isFetchingNextPage) return;
    if (isFetching && !hasAnyItems) return;
    fetchNextPage();
  }, [hasMore, isFetchingNextPage, fetchNextPage, isFetching, hasAnyItems]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey });
    await refetch();
    setIsRefreshing(false);
  }, [queryClient, queryKey, refetch]);

  return {
    data: combinedTravels,
    total,
    hasMore,
    isLoading,
    isFetching,
    isError: status === 'error',
    status,
    isInitialLoading,
    isNextPageLoading,
    isEmpty,
    refetch,
    handleEndReached,
    handleRefresh,
    isRefreshing,
  };
}
