import { useEffect, useMemo } from 'react'
import { useIsFocused, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'

import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelsApi'
import { queryKeys } from '@/api/queryKeys'
import { ResponsiveContainer } from '@/components/layout'
import ListTravel from '@/components/listTravel/ListTravelBase'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { buildLoginHref } from '@/utils/authNavigation'

export default function ExportScreen() {
  const isFocused = useIsFocused()
  const router = useRouter()
  const { isAuthenticated, userId } = useAuth()

  useEffect(() => {
    if (!isFocused) return
    sendAnalyticsEvent('ExportViewed')
  }, [isFocused])

  const isCountQueryEnabled = Boolean(isAuthenticated && userId)
  const {
    data: myTravelsPayload,
    isFetched: isMyTravelsFetched,
    isError: isMyTravelsError,
  } = useQuery({
    queryKey: queryKeys.exportMyTravelsCount(userId),
    queryFn: () =>
      fetchMyTravels({
        user_id: userId as any,
        includeDrafts: true,
        perPage: 1,
        throwOnError: true,
      }),
    enabled: isCountQueryEnabled,
    staleTime: 60_000,
  })

  const travelsCount = useMemo(() => {
    return unwrapMyTravelsPayload(myTravelsPayload).total
  }, [myTravelsPayload])

  const shouldShowEmptyState =
    isCountQueryEnabled && isMyTravelsFetched && !isMyTravelsError && travelsCount <= 0

  useEffect(() => {
    if (!isFocused) return
    if (!shouldShowEmptyState) return
    sendAnalyticsEvent('ExportEmptyStateShown')
  }, [isFocused, shouldShowEmptyState])

  if (!isAuthenticated) {
    return (
      <ResponsiveContainer maxWidth="lg" padding>
        <EmptyState
          icon="lock"
          title="Войдите, чтобы собрать PDF‑книгу"
          description="Экспорт в PDF доступен после авторизации."
          action={{
            label: 'Войти',
            onPress: () => router.push(buildLoginHref({ redirect: '/export', intent: 'build-pdf' }) as any),
          }}
          secondaryAction={{
            label: 'Открыть Поиск',
            onPress: () => router.push('/search' as any),
          }}
          variant="empty"
        />
      </ResponsiveContainer>
    )
  }

  if (shouldShowEmptyState) {
    return (
      <ResponsiveContainer maxWidth="lg" padding>
        <EmptyState
          icon="file-text"
          title="Чтобы собрать PDF‑книгу, добавьте хотя бы одно путешествие"
          description="Добавьте первое путешествие — и сможете собрать книгу и сохранить её в PDF."
          action={{
            label: 'Добавить путешествие',
            onPress: () => router.push('/travel/new' as any),
          }}
          secondaryAction={{
            label: 'Открыть Поиск',
            onPress: () => router.push('/search' as any),
          }}
          variant="empty"
        />
      </ResponsiveContainer>
    )
  }

  return <ListTravel />
}
