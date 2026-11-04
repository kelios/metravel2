import { lazy, Suspense } from 'react'

import ErrorBoundary from '@/components/ui/ErrorBoundary'
import type { Travel } from '@/types/types'

const TravelRouteTasks = lazy(() => import('@/components/games/TravelRouteTasks'))

export default function TravelRouteTasksSlot({ travelId, points }: { travelId: number; points: Travel['travelAddress'] }) {
  return (
    <ErrorBoundary fallback={<></>}>
      <Suspense fallback={null}>
        <TravelRouteTasks travelId={travelId} points={points} />
      </Suspense>
    </ErrorBoundary>
  )
}
