import React, { Suspense } from 'react'
import { ActivityIndicator, Platform, View, Text } from 'react-native'

import type { Travel } from '@/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'

const EXCURSION_CONTAINER_STYLE = { marginTop: 12 } as const
const EXCURSION_FALLBACK_STYLE = { minHeight: 160, paddingVertical: 16, alignItems: 'center' as const }

const LazyBelkrajWidget = React.lazy(() => import('@/components/belkraj/BelkrajWidget'))

const BelkrajWidgetComponent =
  Platform.OS === 'web' ? LazyBelkrajWidget : ((() => null) as React.ComponentType<any>)

const Fallback = () => (
  <View style={EXCURSION_FALLBACK_STYLE}>
    <ActivityIndicator size="small" accessibilityLabel="Загрузка экскурсий" />
  </View>
)

const ExcursionsLazySection: React.FC<{ children: React.ReactNode; forceVisible?: boolean }> = ({
  children,
}) => {
  return <>{children}</>
}

export const ExcursionsSection: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  styles: any
  shouldForceRenderExcursions: boolean
}> = ({ travel, anchors, styles, shouldForceRenderExcursions }) => {
  if (Platform.OS !== 'web' || (travel.travelAddress?.length ?? 0) <= 0) return null

  return (
    <Suspense fallback={<Fallback />}>
      <ExcursionsLazySection forceVisible={shouldForceRenderExcursions}>
        <View
          ref={anchors.excursions}
          style={[styles.sectionContainer, styles.contentStable, styles.webOptionalDeferredSection]}
          collapsable={false}
          accessibilityLabel="Экскурсии"
          accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
          data-section-key="excursions"
        >
          <Text
            style={styles.sectionHeaderText}
            accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
            aria-level={2 as any}
          >Экскурсии</Text>
          <Text style={styles.sectionSubtitle}>Покажем экскурсии рядом с точками маршрута</Text>

          <View style={[EXCURSION_CONTAINER_STYLE, styles.excursionsWidgetCard]}>
            <BelkrajWidgetComponent
              countryCode={travel.countryCode}
              points={travel.travelAddress as any}
              cardsCount={6}
            />
          </View>
        </View>
      </ExcursionsLazySection>
    </Suspense>
  )
}

export default React.memo(ExcursionsSection)
