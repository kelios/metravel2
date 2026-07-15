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
import { translate as i18nT } from '@/i18n'


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
          title={i18nT('export:app.tabs.export.voydite_chtoby_sobrat_pdf_knigu_03c34a03')}
          description={i18nT('export:app.tabs.export.eksport_v_pdf_dostupen_posle_avtorizatsii_ab9dcd89')}
          action={{
            label: i18nT('export:app.tabs.export.voyti_c0048a7c'),
            onPress: () => router.push(buildLoginHref({ redirect: '/export', intent: 'build-pdf' }) as any),
          }}
          secondaryAction={{
            label: i18nT('export:app.tabs.export.otkryt_poisk_45548088'),
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
          title={i18nT('export:app.tabs.export.chtoby_sobrat_pdf_knigu_dobavte_hotya_by_odn_fa3a25bc')}
          description={i18nT('export:app.tabs.export.dobavte_pervoe_puteshestvie_i_smozhete_sobra_1745dc75')}
          action={{
            label: i18nT('export:app.tabs.export.dobavit_puteshestvie_7414bbc8'),
            onPress: () => router.push('/travel/new' as any),
          }}
          secondaryAction={{
            label: i18nT('export:app.tabs.export.otkryt_poisk_45548088'),
            onPress: () => router.push('/search' as any),
          }}
          variant="empty"
        />
      </ResponsiveContainer>
    )
  }

  return <ListTravel />
}
