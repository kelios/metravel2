import React from 'react'
import { View } from 'react-native'

import ErrorDisplay from '@/components/ui/ErrorDisplay'
import { getUserFriendlyNetworkError } from '@/utils/networkErrorHandler'

import { ROOT_MAP_PROPS } from './shared'
import { translate as i18nT } from '@/i18n'


type MapScreenErrorProps = {
  styles: any
  seoBlock: React.ReactNode
  /**
   * The page `<h1>`. This branch replaces MapScreenShell entirely, so neither
   * regular anchor mounts here and the page would otherwise show no visible
   * heading at all (#1640).
   */
  pageHeading?: React.ReactNode
  mapError: unknown
  mapErrorDetails: unknown
  isConnected: boolean
  invalidateTravelsQuery: () => void
  refetchMapData: () => void
}

export function MapScreenError({
  styles,
  seoBlock,
  pageHeading,
  mapError,
  mapErrorDetails,
  isConnected,
  invalidateTravelsQuery,
  refetchMapData,
}: MapScreenErrorProps) {
  const friendly = getUserFriendlyNetworkError(mapErrorDetails || mapError)
  const friendlyMessage = (friendly as any)?.message ?? String(friendly || '')
  const offlineMessage =
    i18nT('map:components.MapPage.MapScreenParts.MapScreenError.net_podklyucheniya_k_internetu_karta_zagruzi_66006fb0')
  const effectiveMessage = !isConnected
    ? offlineMessage
    : friendlyMessage || i18nT('map:components.MapPage.MapScreenParts.MapScreenError.checkConnection')
  return (
    <View style={styles.container} {...ROOT_MAP_PROPS}>
      {seoBlock}
      {pageHeading}
      <ErrorDisplay
        title={!isConnected ? i18nT('map:components.MapPage.MapScreenParts.MapScreenError.net_podklyucheniya_f79eecc2') : i18nT('map:components.MapPage.MapScreenParts.MapScreenError.ne_udalos_zagruzit_kartu_989682c9')}
        message={effectiveMessage}
        isNetworkError={!isConnected}
        onRetry={() => {
          invalidateTravelsQuery()
          refetchMapData()
        }}
      />
    </View>
  )
}
