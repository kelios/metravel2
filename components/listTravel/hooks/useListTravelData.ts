/**
 * Кастомный хук для управления загрузкой и накоплением данных
 * Вынесена логика React Query и накопления данных для переиспользования и тестирования
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTravels } from '@/src/api/travels';
import type { Travel } from '@/src/types/types';
import { 
  PER_PAGE, 
  STALE_TIME, 
  GC_TIME, 
  QUERY_CONFIG,
  FLATLIST_CONFIG 
} from '../utils/listTravelConstants';
import { normalizeApiResponse, deduplicateTravels, calculateIsEmpty } from '../utils/listTravelHelpers';

export interface UseListTravelDataProps {
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
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
  refetch: () => void;
  handleEndReached: () => void;
  handleRefresh: () => void;
  isRefreshing: boolean;
  resetAccumulatedData: () => void;
}

/**
 * ✅ АРХИТЕКТУРА: Хук для управления загрузкой и накоплением данных
 * 
 * Логика:
 * - React Query запросы
 * - Накопление данных для infinite scroll
 * - Обработка разных форматов ответа API
 * - Защита от дубликатов
 * - Prefetch следующей страницы
 */
export function useListTravelData({
  currentPage,
  setCurrentPage,
  queryParams,
  search,
  isQueryEnabled,
}: UseListTravelDataProps): UseListTravelDataReturn {
  const queryClient = useQueryClient();
  const [accumulatedData, setAccumulatedData] = useState<Travel[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isLoadingMoreRef = useRef(false);

  // ✅ АРХИТЕКТУРА: Query key с useMemo
  const queryKey = useMemo(() => [
    "travels",
    { 
      page: currentPage, 
      perPage: PER_PAGE, 
      search, 
      params: queryParams 
    },
  ], [currentPage, search, queryParams]);

  // ✅ АРХИТЕКТУРА: React Query запрос
  const {
    data: rawData,
    status,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: ({ queryKey, signal }) => {
      const [, { page, perPage, search, params }] = queryKey as any;
      return fetchTravels(page, perPage, search, params, { signal });
    },
    enabled: isQueryEnabled,
    staleTime: STALE_TIME.TRAVELS,
    gcTime: GC_TIME.TRAVELS,
    refetchOnMount: QUERY_CONFIG.REFETCH_ON_MOUNT,
    refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,
    keepPreviousData: QUERY_CONFIG.KEEP_PREVIOUS_DATA,
  });

  // ✅ АРХИТЕКТУРА: Нормализация ответа API
  const { items, total } = useMemo(() => {
    return normalizeApiResponse(rawData);
  }, [rawData]);

  const hasMore = (currentPage + 1) * PER_PAGE < total;
  const hasAnyItems = accumulatedData.length > 0;

  // ✅ АРХИТЕКТУРА: Накопление данных для infinite scroll
  useEffect(() => {
    if (!isQueryEnabled || status !== "success" || !items || items.length === 0) {
      return;
    }

    // Нормализуем данные в массив
    let chunk: Travel[] = [];
    if (Array.isArray(items)) {
      chunk = items;
    } else if (items && typeof items === 'object') {
      if (Array.isArray((items as any).data)) {
        chunk = (items as any).data;
      } else if ((items as any).data && typeof (items as any).data === 'object') {
        chunk = [(items as any).data as Travel];
      }
    }

    // ✅ АРХИТЕКТУРА: При currentPage === 0 всегда заменяем данные
    if (currentPage === 0) {
      setAccumulatedData(chunk);
    } else {
      // Добавляем данные для пагинации с защитой от дубликатов
      setAccumulatedData((prev) => {
        const deduplicated = deduplicateTravels([...prev, ...chunk]);
        return deduplicated;
      });
    }
    
    isLoadingMoreRef.current = false;
  }, [isQueryEnabled, status, items, currentPage, queryParams, search]);

  // ✅ АРХИТЕКТУРА: Сброс накопленных данных при изменении фильтров или поиска
  useEffect(() => {
    setCurrentPage(0);
    isLoadingMoreRef.current = false;
    // Не очищаем accumulatedData сразу - это вызовет показ "Ничего не найдено"
    // React Query сам обновит данные при изменении queryParams
  }, [search, queryParams, setCurrentPage]);

  // ✅ АРХИТЕКТУРА: Prefetch следующей страницы
  useEffect(() => {
    if (!isQueryEnabled) return;
    if (!hasMore) return;
    if (isFetching) return;

    const nextPage = currentPage + 1;
    queryClient.prefetchQuery({
      queryKey: [
        "travels",
        { page: nextPage, perPage: PER_PAGE, search, params: queryParams },
      ],
      queryFn: ({ signal }) =>
        fetchTravels(nextPage, PER_PAGE, search, queryParams, { signal }),
      staleTime: STALE_TIME.TRAVELS,
    });
  }, [isQueryEnabled, hasMore, isFetching, currentPage, search, queryParams, queryClient]);

  // ✅ АРХИТЕКТУРА: Состояния загрузки
  const isInitialLoading = isLoading && !hasAnyItems;
  const isNextPageLoading = isFetching && hasAnyItems;

  // ✅ АРХИТЕКТУРА: Определение isEmpty
  const isEmpty = useMemo(() => {
    return calculateIsEmpty(
      isQueryEnabled,
      status,
      isFetching,
      isLoading,
      hasAnyItems,
      rawData
    );
  }, [isQueryEnabled, status, isFetching, isLoading, hasAnyItems, rawData]);

  // ✅ АРХИТЕКТУРА: Обработчик достижения конца списка
  const handleEndReached = useCallback(() => {
    const canLoadMore = !isNextPageLoading && hasMore;
    if (!canLoadMore || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setCurrentPage((p) => p + 1);
  }, [isNextPageLoading, hasMore, setCurrentPage]);

  // ✅ АРХИТЕКТУРА: Pull-to-Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setCurrentPage(0);
    setAccumulatedData([]);
    await refetch();
    setIsRefreshing(false);
  }, [refetch, setCurrentPage]);

  // ✅ АРХИТЕКТУРА: Сброс накопленных данных
  const resetAccumulatedData = useCallback(() => {
    setAccumulatedData([]);
  }, []);

  return {
    data: accumulatedData,
    total,
    hasMore,
    isLoading,
    isFetching,
    isError: status === "error",
    status,
    isInitialLoading,
    isNextPageLoading,
    isEmpty,
    refetch,
    handleEndReached,
    handleRefresh,
    isRefreshing,
    resetAccumulatedData,
  };
}

