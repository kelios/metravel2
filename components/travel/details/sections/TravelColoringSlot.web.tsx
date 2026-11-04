import { lazy, Suspense } from 'react'

import ErrorBoundary from '@/components/ui/ErrorBoundary'

const TravelColoringSheets = lazy(() => import('@/components/games/TravelColoringSheets'))

export default function TravelColoringSlot({ travelId }: { travelId: number }) {
  return (
    <ErrorBoundary fallback={<></>}>
      <Suspense fallback={null}>
        <TravelColoringSheets travelId={travelId} />
      </Suspense>
    </ErrorBoundary>
  )
}
