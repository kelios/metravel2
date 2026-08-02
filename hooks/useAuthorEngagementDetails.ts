import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { ApiError, isTimeoutError } from '@/api/client'
import {
  fetchAuthorEngagementDetails,
  type AuthorEngagementItem,
  type AuthorEngagementMetric,
  type AuthorEngagementPage,
} from '@/api/authorEngagement'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/context/AuthContext'

/**
 * Детализация «кто и какой маршрут» по одной метрике автора (#1192).
 * Данные приватные и author-only, поэтому запрос идёт только для
 * аутентифицированного пользователя и кэш scoped по его id.
 */
export function useAuthorEngagementDetails(metric: AuthorEngagementMetric | null) {
  const { isAuthenticated, userId } = useAuth()

  const query = useInfiniteQuery<AuthorEngagementPage>({
    queryKey: queryKeys.authorEngagementDetails(userId ? String(userId) : null, metric ?? 'none'),
    queryFn: ({ pageParam }) =>
      fetchAuthorEngagementDetails(metric as AuthorEngagementMetric, (pageParam as number) ?? 1),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    enabled: Boolean(metric) && isAuthenticated,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
      if (isTimeoutError(error)) return false
      return failureCount < 2
    },
  })

  const items: AuthorEngagementItem[] = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  )

  return useMemo(
    () => ({
      items,
      total: query.data?.pages?.[0]?.total ?? items.length,
      isLoading: query.isLoading,
      isError: query.isError,
      hasNextPage: Boolean(query.hasNextPage),
      isFetchingNextPage: query.isFetchingNextPage,
      fetchNextPage: query.fetchNextPage,
      refetch: query.refetch,
    }),
    [
      items,
      query.data,
      query.isLoading,
      query.isError,
      query.hasNextPage,
      query.isFetchingNextPage,
      query.fetchNextPage,
      query.refetch,
    ],
  )
}
