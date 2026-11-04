import React, { Suspense } from 'react'

import type { DeferredStableContentProps } from '@/components/travel/DeferredStableContent.types'

const StableContent = React.lazy(() => import('@/components/travel/StableContent'))

export default function DeferredStableContent({
  fallback = null,
  ...props
}: DeferredStableContentProps) {
  return (
    <Suspense fallback={fallback}>
      <StableContent {...props} />
    </Suspense>
  )
}
