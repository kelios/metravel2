import React, { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentProps } from 'react'
import { View } from 'react-native'
import { useThemedColors } from '@/hooks/useTheme'

// TS selects the native sibling; this wrapper's runtime target is the web map.
type WebMapModule = typeof import('@/components/quests/QuestFullMap') & {
  QuestMapVisibilityGate: React.ComponentType<{
    containerRef: React.RefObject<unknown>
    enabled: boolean
    onActivate: () => void
  }>
}
const loadMapModule = () => import('@/components/quests/QuestFullMap') as Promise<WebMapModule>
const MapRenderer = lazy(loadMapModule)
const VisibilityGate = lazy(() => loadMapModule().then((module) => ({ default: module.QuestMapVisibilityGate })))
type Props = ComponentProps<typeof MapRenderer> & { deferUntilVisible?: boolean }

function DeferredMapSession({ deferUntilVisible = false, height = 520, ...props }: Props) {
  const colors = useThemedColors()
  const containerRef = useRef<React.ElementRef<typeof View>>(null)
  const [activated, setActivated] = useState(!deferUntilVisible)
  const activate = useCallback(() => setActivated(true), [])
  const showMap = activated || !deferUntilVisible
  useEffect(() => { if (showMap && !activated) setActivated(true) }, [activated, showMap])
  const placeholder = <View testID="quest-map-placeholder" style={{ height, borderRadius: 16, backgroundColor: colors.backgroundSecondary }} />
  return (
    <View ref={containerRef} style={{ height }} testID="quest-map-deferred-slot">
      <Suspense fallback={null}>
        {deferUntilVisible && !activated
          ? <VisibilityGate containerRef={containerRef} enabled onActivate={activate} />
          : null}
      </Suspense>
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
