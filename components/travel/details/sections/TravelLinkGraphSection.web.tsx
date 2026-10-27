import React, { Suspense } from 'react'
import type { Travel } from '@/types/types'
import { useTravelLoaderPayload } from '../travelLoaderData'
import { lazyWithRetry } from '@/utils/chunkReload'

const SelectedTravelLinks = lazyWithRetry(() => import('./TravelSelectedLinks.web'), { name: 'TravelSelectedLinks' })

export default function TravelLinkGraphSection({ travel, styles }: { travel: Travel; styles: any }) {
  const graph = useTravelLoaderPayload()?.linkGraph
  if (!graph) return null
  return (
    <section data-travel-link-graph={graph.state} aria-busy={graph.state === 'pending'}
      {...(graph.state !== 'available' ? { 'data-travel-graph-error': graph.errorCode } : {})}>
      {graph.state === 'available' ? <Suspense fallback={null}><SelectedTravelLinks travel={travel} styles={styles} graph={graph} /></Suspense> : null}
    </section>
  )
}
