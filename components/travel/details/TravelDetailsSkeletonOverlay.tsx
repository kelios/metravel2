import React from 'react'
import { View } from 'react-native'

type TravelDetailsSkeletonOverlayProps = {
  skeletonFallback: React.ReactNode
  skeletonPhase: 'loading' | 'fading' | 'hidden'
}

export default function TravelDetailsSkeletonOverlay({
  skeletonFallback,
  skeletonPhase,
}: TravelDetailsSkeletonOverlayProps) {
  return (
    <View
      testID="travel-details-skeleton-overlay"
      collapsable={false}
      style={{
        position: 'absolute',
        inset: 0,
        // Only sit on top while fully opaque (loading). The moment data is
        // ready (fading/hidden) drop behind the real content so a
        // half-transparent skeleton can never overlap the text underneath.
        zIndex: skeletonPhase === 'loading' ? 50 : -1,
        opacity: skeletonPhase === 'loading' ? 1 : 0,
        visibility: skeletonPhase === 'hidden' ? 'hidden' : 'visible',
        transition: 'opacity 200ms ease-out',
        contain: 'strict',
        pointerEvents: 'none',
      } as any}
      // @ts-ignore - web-only inert attribute
      inert={skeletonPhase === 'loading' ? true : undefined}
    >
      {skeletonPhase !== 'hidden' ? skeletonFallback : null}
    </View>
  )
}
