import { loadTravelOfflineReader } from '@/components/travel/details/loadTravelOfflineReader.web'

export async function prepareTravelOfflineOpen(): Promise<void> {
  // Resolve the actual route module too; router navigation must not fetch code offline.
  await Promise.all([
    import('@/app/(tabs)/travels/[param].web'),
    loadTravelOfflineReader(),
  ])
}
