import { loadTravelOfflineAdapter } from '@/services/offline/loadTravelOfflineAdapter'

let pending: Promise<typeof import('./TravelOfflineReader.web')> | undefined

export function loadTravelOfflineReader() {
  pending ??= Promise.all([
    import('./TravelOfflineReader.web'),
    loadTravelOfflineAdapter(),
  ]).then(([reader]) => reader).catch((error: unknown) => {
    pending = undefined
    throw error
  })
  return pending
}
