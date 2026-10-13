import { useState, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTravels, fetchRandomTravels } from '@/api/travelListQueries';
import { queryKeys } from '@/api/queryKeys';
import { blockHiddenCount, isLastPageEmptiedByBlock, servedPageLength } from '@/api/blockSensitiveShapes';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import type { Travel } from '@/types/types';
import {
  PER_PAGE,
  STALE_TIME,
  GC_TIME,
  QUERY_CONFIG,
} from '../utils/listTravelConstants';
import { normalizeApiResponse, deduplicateTravels } from '../utils/listTravelHelpers';
import { safeJsonParseString } from '@/utils/safeJsonParse';
import {
  getPublicStalePayloadMeta,
  type PublicStalePayloadMeta,
} from '@/utils/publicStaleCache';

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
  staleContentMeta: PublicStalePayloadMeta | null;
  refetch: () => Promise<any>;
  handleEndReached: () => void;
  handleRefresh: () => void;
  isRefreshing: boolean;
}

const resolveStableTotal = (pages: unknown[]): number => {
  if (!Array.isArray(pages)) return 0;
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const page = pages[index];
    const rawTotal = page && typeof page === 'object' ? (page as { total?: unknown }).total : undefined;
    const total = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal);
    if (Number.isFinite(total) && total >= 0) return total + blockHiddenCount(page);
  }
  return 0;
};

type FetchFn = (
  page: number,
  perPage: number,
  search: string,
  params: Record<string, any>,
  options: { signal?: AbortSignal },
) => Promise<any>;

interface BaseTravelDataConfig {
  queryKeyPrefix: string;
  fetchFn: FetchFn;
}

function useBaseTravelData(
  { queryParams, search, isQueryEnabled }: UseListTravelDataProps,
  { queryKeyPrefix, fetchFn }: BaseTravelDataConfig,
): UseListTravelDataReturn {
  const queryClient = useQueryClient();
  const owner = useQueryOwner();
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
      queryKeyPrefix,
      {
        perPage: PER_PAGE,
        search: search.trim(),
        params: queryParamsStringified,
        owner,
      },
    ],
    [queryKeyPrefix, search, queryParamsStringified, owner],
  );

  const queryParamsForFetch = useMemo(
    () => safeJsonParseString(queryParamsStringified, {}),
    [queryParamsStringified],
  );

  const {
    data,
    status,
    fetchStatus,
    isFetching,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0, signal }) =>
      fetchFn(pageParam, PER_PAGE, search.trim(), queryParamsForFetch, { signal }),
    enabled: isQueryEnabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const total = resolveStableTotal(allPages as unknown[]);
      if (!total) return undefined;
      const loaded = allPages.reduce((sum, page) => sum + servedPageLength(page), 0);
      if (loaded >= total) return undefined;
      // Пустой ответ сервера — конец выдачи; пустая после блокировки автора
      // страница — нет (`servedPageLength` считает и вырезанное).
      if (servedPageLength(lastPage) === 0) return undefined;
      return allPages.length;
    },
    staleTime: STALE_TIME.TRAVELS,
    gcTime: GC_TIME.TRAVELS,
    refetchOnMount: QUERY_CONFIG.REFETCH_ON_MOUNT,
    refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,
  });

  const normalizedPages = useMemo(() => {
    if (!data?.pages?.length) return [];
    return data.pages.map((page) => normalizeApiResponse(page));
  }, [data]);

  const combinedTravels = useMemo(() => {
    if (!normalizedPages.length) return [];
    const flattened = normalizedPages.flatMap((page) => page.items);
    return deduplicateTravels(flattened);
  }, [normalizedPages]);

  const hiddenCount = data?.pages.reduce((sum, page) => sum + blockHiddenCount(page), 0) ?? 0;
  const total = hiddenCount > 0
    ? hasNextPage
      ? Math.max(combinedTravels.length, resolveStableTotal(data?.pages ?? []) - hiddenCount)
      : combinedTravels.length
    : normalizedPages.length > 0 ? normalizedPages[0].total : 0;
  const staleContentMeta = useMemo(() => {
    if (!data?.pages?.length) return null;
    for (const page of data.pages) {
      const meta = getPublicStalePayloadMeta(page);
      if (meta) return meta;
    }
    return null;
  }, [data?.pages]);
  const hasAnyItems = combinedTravels.length > 0;
  const hasMore = Boolean(hasNextPage);
  // Без сети первый запрос не падает, а паркуется (`networkMode: 'online'`,
  // utils/reactQueryConfig.ts): status остаётся 'pending', fetchStatus —
  // 'paused', и isLoading/isError/isEmpty все ложны — экран показывал
  // «0 путешествий» над пустотой. Пауза без данных — сбой загрузки: UI отдаёт
  // «Нет подключения» с «Повторить», а запрос сам доедет, когда сеть вернётся.
  // Это также относится к догрузке страницы после блока без видимых карточек.
  // Завершённый пустой ответ при паузе рефетча остаётся честным «пусто».
  const isLoadPaused = fetchStatus === 'paused' && !hasAnyItems && (status === 'pending' || hasMore);

  // Страницы без видимых карточек при `hasNextPage` — блокировка автора
  // вырезала всё загруженное, и слой блокировок уже догружает следующую.
  const isInitialLoading = !isLoadPaused && !hasAnyItems && (isLoading || (status === 'success' && hasMore));
  const isNextPageLoading = isFetchingNextPage;
  // «Пусто» — факт завершённого запроса: успех без единого элемента. Признак
  // `isQueryEnabled` сюда не входит (#2375): рулетка держит запрос выключенным и
  // запускает его `refetch()` по кнопке, и с `isQueryEnabled && …` её пустая выдача
  // была недостижима. Выключенный запрос без данных остаётся `pending` и сам по
  // себе «пусто» не даёт; ошибка (`status === 'error'`) — тоже не пусто.
  const isEmpty =
    status === 'success' &&
    !isFetching &&
    !isLoading &&
    !isFetchingNextPage &&
    !hasMore &&
    !hasAnyItems;

  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    if (isFetchingNextPage) return;
    if (isFetching && !hasAnyItems) return;
    fetchNextPage();
  }, [hasMore, isFetchingNextPage, fetchNextPage, isFetching, hasAnyItems]);

  // Рулетка запускает выключенный запрос вручную. Guard не догружает фоновые
  // ленты, поэтому ручной вызов сам ждёт замену вырезанных страниц перед тем,
  // как вернуть карточки вызывающему (в том числе при гостевом fallback).
  const refetchVisiblePages = useCallback(async () => {
    let result = await refetch();
    while (result.isSuccess && result.hasNextPage && isLastPageEmptiedByBlock(result.data)) {
      result = await fetchNextPage({ cancelRefetch: false });
    }
    return result;
  }, [refetch, fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey });
      await refetchVisiblePages();
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, queryKey, refetchVisiblePages]);

  return {
    data: combinedTravels,
    total,
    hasMore,
    isLoading,
    isFetching,
    isError: status === 'error' || isLoadPaused,
    status,
    isInitialLoading,
    isNextPageLoading,
    isEmpty,
    staleContentMeta,
    refetch: refetchVisiblePages,
    handleEndReached,
    handleRefresh,
    isRefreshing,
  };
}

export function useListTravelData(props: UseListTravelDataProps): UseListTravelDataReturn {
  return useBaseTravelData(props, {
    queryKeyPrefix: queryKeys.travels()[0],
    fetchFn: fetchTravels,
  });
}

export function useRandomTravelData(props: UseListTravelDataProps): UseListTravelDataReturn {
  return useBaseTravelData(props, {
    queryKeyPrefix: queryKeys.randomTravels()[0],
    fetchFn: fetchRandomTravels,
  });
}
