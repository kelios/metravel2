import { lazyWithRetry } from '@/utils/chunkReload'

// On web the mobile section picker is mounted only once the article is ready.
// The header stores an early open request until the picker has mounted.
export default lazyWithRetry(() => import('@/components/travel/TravelSectionsSheet'), {
  name: 'TravelSectionsSheet',
})
