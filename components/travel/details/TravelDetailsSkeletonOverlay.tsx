import React, { Suspense } from 'react'
import { View } from 'react-native'

type TravelDetailsSkeletonOverlayProps = {
  skeletonFallback: React.ReactNode
  skeletonPhase: 'loading' | 'fading' | 'hidden'
  travelDetailSkeleton: React.ReactNode
}

export default function TravelDetailsSkeletonOverlay({
  skeletonFallback,
  skeletonPhase,
  travelDetailSkeleton,
}: TravelDetailsSkeletonOverlayProps) {
  return (
    <View
      testID="travel-details-skeleton-overlay"
      collapsable={false}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: skeletonPhase === 'hidden' ? -1 : 50,
        opacity: skeletonPhase === 'loading' ? 1 : 0,
        visibility: skeletonPhase === 'hidden' ? 'hidden' : 'visible',
        transition: 'opacity 200ms ease-out',
        contain: 'strict',
        pointerEvents: 'none',
      } as any}
      // @ts-ignore - web-only inert attribute
      inert={skeletonPhase === 'loading' ? true : undefined}
    >
      {skeletonPhase !== 'hidden' && (
        <Suspense fallback={skeletonFallback}>{travelDetailSkeleton}</Suspense>
      )}
    </View>
  )
}
