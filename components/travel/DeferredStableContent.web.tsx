import React, { Suspense } from 'react'

import type { DeferredStableContentProps } from '@/components/travel/DeferredStableContent.types'

// Start fetching the rich-text renderer with the travel route, but keep its
// parsing/effects outside the route chunk and outside first interaction.
const stableContentImport = Promise.resolve(import('@/components/travel/StableContent'))
const StableContent = React.lazy(() =>
  stableContentImport.then((module) => ({ default: module.default }))
)

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
