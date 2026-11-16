import React, { lazy, Suspense, useEffect, useState, type ComponentProps } from 'react'
import { View } from 'react-native'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import { useThemedColors } from '@/hooks/useTheme'

const MapRenderer = lazy(() => import('@/components/quests/QuestFullMap'))
type Props = ComponentProps<typeof MapRenderer> & { deferUntilVisible?: boolean }

function DeferredMapSession({ deferUntilVisible = false, height = 520, ...props }: Props) {
  const colors = useThemedColors()
  const [activated, setActivated] = useState(!deferUntilVisible)
  const { shouldLoad, setElementRef } = useProgressiveLoad({
    priority: 'low', rootMargin: '200px', disableFallbackOnWeb: true,
    enabled: deferUntilVisible && !activated,
  })
  const showMap = activated || shouldLoad || !deferUntilVisible
  useEffect(() => { if (showMap && !activated) setActivated(true) }, [activated, showMap])
  const placeholder = <View testID="quest-map-placeholder" style={{ height, borderRadius: 16, backgroundColor: colors.backgroundSecondary }} />
  return (
    <View ref={setElementRef} style={{ height }} testID="quest-map-deferred-slot">
      <Suspense fallback={placeholder}>
        {showMap ? <MapRenderer {...props} height={height} /> : placeholder}
      </Suspense>
    </View>
  )
}

export default function QuestFullMapLazy({ deferUntilVisible = false, ...props }: Props) {
  const [deferredSession] = useState(deferUntilVisible)
  return deferredSession
    ? <DeferredMapSession {...props} deferUntilVisible={deferUntilVisible} />
    : <MapRenderer {...props} />
}
