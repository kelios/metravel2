import type { TravelAddressItem } from '@/types/types'
import type { RouteTask } from './gamesMedia'

export function matchRouteTaskStops(tasks: RouteTask[], points: TravelAddressItem[] | undefined) {
  const stopNames = new Map<number, string>()
  for (const point of points ?? []) {
    if (!point || typeof point !== 'object') continue
    const address = 'address' in point && typeof point.address === 'string' ? point.address.trim() : ''
    const name = address || (typeof point.name === 'string' ? point.name.trim() : '')
    if (name) stopNames.set(point.id, name)
  }
  return tasks.flatMap(task => {
    const stopName = stopNames.get(task.pointId)
    return stopName ? [{ ...task, stopName }] : []
  })
}
