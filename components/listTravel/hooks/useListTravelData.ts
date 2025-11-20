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
import { safeJsonParseString } from '@/src/utils/safeJsonParse';

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
  const hasRequestedFirstPageRef = useRef(false);
  const prevQueryKeyStringRef = useRef<string>('');
  
  // ✅ ИСПРАВЛЕНИЕ: Стабильная функция для сравнения queryParams
  const queryParamsStringified = useMemo(() => {
    // Сортируем ключи для стабильного сравнения
    const sorted = Object.keys(queryParams)
      .sort()
      .reduce((acc, key) => {
        acc[key] = queryParams[key];
        return acc;
      }, {} as Record<string, any>);
    return JSON.stringify(sorted);
  }, [queryParams]);

  // ✅ ИСПРАВЛЕНИЕ: Отслеживаем предыдущие значения для определения изменений
  const prevQueryParamsStringRef = useRef<string>(queryParamsStringified);
  const prevSearchRef = useRef<string>(search.trim());
  const prevQueryKeyRef = useRef<string>('');

  // ✅ АРХИТЕКТУРА: Query key с useMemo и стабильными параметрами
  const queryKey = useMemo(() => [
    "travels",
    { 
      page: currentPage, 
      perPage: PER_PAGE, 
      search: search.trim(), // ✅ ИСПРАВЛЕНИЕ: Убираем пробелы для стабильности
      params: queryParamsStringified // ✅ ИСПРАВЛЕНИЕ: Используем строку вместо объекта
    },
  ], [currentPage, search, queryParamsStringified]);
  
  // ✅ ИСПРАВЛЕНИЕ: Восстанавливаем queryParams из строки для queryFn
  // ✅ FIX-010: Используем безопасный парсинг JSON
  const queryParamsForFetch = useMemo(() => {
    return safeJsonParseString(queryParamsStringified, {});
  }, [queryParamsStringified]);

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
      const [, { page, perPage, search }] = queryKey as any;
      // ✅ ИСПРАВЛЕНИЕ: Используем восстановленные queryParams
      return fetchTravels(page, perPage, search, queryParamsForFetch, { signal });
    },
    enabled: isQueryEnabled,
    staleTime: STALE_TIME.TRAVELS,
    gcTime: GC_TIME.TRAVELS,
    refetchOnMount: QUERY_CONFIG.REFETCH_ON_MOUNT,
    refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,
    keepPreviousData: true, // ✅ ИСПРАВЛЕНИЕ: Включаем keepPreviousData чтобы показывать старые данные во время загрузки новых
  });

  // ✅ АРХИТЕКТУРА: Нормализация ответа API
  const { items, total } = useMemo(() => {
    return normalizeApiResponse(rawData);
  }, [rawData]);

  const hasMore = (currentPage + 1) * PER_PAGE < total;
  const hasAnyItems = accumulatedData.length > 0;

  // ✅ АРХИТЕКТУРА: Накопление данных для infinite scroll
  useEffect(() => {
    // ✅ ИСПРАВЛЕНИЕ: Обрабатываем только успешные запросы и когда есть данные
    if (!isQueryEnabled) {
      return;
    }

    // ✅ ИСПРАВЛЕНИЕ: Проверяем, изменился ли queryKey
    // Если queryKey изменился, нужно обновить данные, даже если rawData еще от старого запроса
    const currentQueryKeyString = JSON.stringify(queryKey);
    const queryKeyChanged = currentQueryKeyString !== prevQueryKeyRef.current;
    
    // ✅ ИСПРАВЛЕНИЕ: Обрабатываем данные когда status === "success"
    // Или когда есть rawData и queryKey не изменился (keepPreviousData)
    if (status !== "success" && !rawData) {
      return;
    }
    
    // ✅ ИСПРАВЛЕНИЕ: Если queryKey изменился и status не success, не обрабатываем старые данные
    if (queryKeyChanged && status !== "success") {
      return;
    }

    // ✅ ИСПРАВЛЕНИЕ: normalizeApiResponse уже возвращает массив в items
    // items всегда массив Travel[] после нормализации
    const chunk: Travel[] = Array.isArray(items) ? items : [];

    // ✅ ИСПРАВЛЕНИЕ: При currentPage === 0 всегда заменяем данные (даже если пусто)
    // Это важно для отображения пустого состояния при изменении фильтров
    if (currentPage === 0) {
      // ✅ ИСПРАВЛЕНИЕ: Если queryKey изменился, всегда заменяем данные
      // Если queryKey не изменился, но status === "success", также обновляем
      if (queryKeyChanged || status === "success") {
        setAccumulatedData(chunk); // ✅ ИСПРАВЛЕНИЕ: Упростил логику - просто заменяем данные
        // Отмечаем, что данные для первой страницы получены
        if (status === "success") {
          hasRequestedFirstPageRef.current = true;
        }
      }
    } else {
      // Добавляем данные для пагинации с защитой от дубликатов
      // Только если есть новые данные
      if (chunk.length > 0) {
        setAccumulatedData((prev) => {
          const deduplicated = deduplicateTravels([...prev, ...chunk]);
          return deduplicated;
        });
      }
    }
    
    // Обновляем prevQueryKeyRef
    prevQueryKeyRef.current = currentQueryKeyString;
    isLoadingMoreRef.current = false;
  }, [isQueryEnabled, status, items, currentPage, rawData, queryKey]);

  // ✅ ИСПРАВЛЕНИЕ: Объединенный эффект для сброса данных и управления запросами
  // Предотвращает множественные запросы при изменении фильтров
  useEffect(() => {
    // ✅ ИСПРАВЛЕНИЕ: Используем стабильную проверку изменений через queryParamsStringified
    const queryParamsChanged = queryParamsStringified !== prevQueryParamsStringRef.current;
    const searchChanged = prevSearchRef.current !== search.trim();
    
    // ✅ ИСПРАВЛЕНИЕ: Выполняем сброс только при реальных изменениях
    if (queryParamsChanged || searchChanged) {
      // Сначала очищаем накопленные данные
      setAccumulatedData([]);
      isLoadingMoreRef.current = false;
      hasRequestedFirstPageRef.current = false;
      
      // Сбрасываем страницу на первую
      setCurrentPage(0);
      
      // Обновляем refs для следующего сравнения
      prevQueryParamsStringRef.current = queryParamsStringified;
      prevSearchRef.current = search.trim();
      prevQueryKeyStringRef.current = '';
      prevQueryKeyRef.current = ''; // ✅ ИСПРАВЛЕНИЕ: Сбрасываем prevQueryKeyRef чтобы эффект обновления данных сработал
      
      // ✅ ИСПРАВЛЕНИЕ: Не отменяем и не инвалидируем запросы здесь
      // React Query автоматически отменит старые запросы и выполнит новый
      // при изменении queryKey через useQuery
      // Это предотвращает AbortError и гарантирует выполнение запроса
    }
  }, [search, queryParamsStringified, setCurrentPage, queryClient, queryKey]);

  // ✅ АРХИТЕКТУРА: Prefetch следующей страницы
  useEffect(() => {
    if (!isQueryEnabled) return;
    if (!hasMore) return;
    if (isFetching) return;
    if (currentPage !== 0) return; // ✅ ИСПРАВЛЕНИЕ: Prefetch только на первой странице

    const nextPage = currentPage + 1;
    queryClient.prefetchQuery({
      queryKey: [
        "travels",
        { page: nextPage, perPage: PER_PAGE, search: search.trim(), params: queryParamsStringified },
      ],
      queryFn: ({ signal }) =>
        fetchTravels(nextPage, PER_PAGE, search.trim(), queryParamsForFetch, { signal }),
      staleTime: STALE_TIME.TRAVELS,
    });
  }, [isQueryEnabled, hasMore, isFetching, currentPage, search, queryParamsStringified, queryParamsForFetch, queryClient]);

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

