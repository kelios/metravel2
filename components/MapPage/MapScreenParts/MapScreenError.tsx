import React from 'react'
import { View } from 'react-native'

import ErrorDisplay from '@/components/ui/ErrorDisplay'
import { getUserFriendlyNetworkError } from '@/utils/networkErrorHandler'

import { ROOT_MAP_PROPS } from './shared'

type MapScreenErrorProps = {
  styles: any
  seoBlock: React.ReactNode
  mapError: unknown
  mapErrorDetails: unknown
  isConnected: boolean
  invalidateTravelsQuery: () => void
  refetchMapData: () => void
}

export function MapScreenError({
  styles,
  seoBlock,
  mapError,
  mapErrorDetails,
  isConnected,
  invalidateTravelsQuery,
  refetchMapData,
}: MapScreenErrorProps) {
  const friendly = getUserFriendlyNetworkError(mapErrorDetails || mapError)
  const friendlyMessage = (friendly as any)?.message ?? String(friendly || '')
  const offlineMessage =
    'Нет подключения к интернету. Карта загрузится автоматически, как только соединение восстановится.'
  const effectiveMessage = !isConnected
    ? offlineMessage
    : friendlyMessage || 'Проверьте соединение и попробуйте ещё раз'
  return (
    <View style={styles.container} {...ROOT_MAP_PROPS}>
      {seoBlock}
      <ErrorDisplay
        title={!isConnected ? 'Нет подключения' : 'Не удалось загрузить карту'}
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
