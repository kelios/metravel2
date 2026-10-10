import { withLazy } from '../TravelDetailsLazy'

// Web-only async boundary (#2360 / class #1499): a sync import of these lists
// kept them inside TravelDetailsSidebarSection even when wrapped in withLazy.
// `Promise.resolve` normalizes Metro's async-require thenable, as in the
// sibling withLazy boundaries of TravelDetailsDeferred.
export const NearTravelListComponent = withLazy(() =>
  Promise.resolve(import('@/components/travel/NearTravelList')).then((module) => ({
    default: module.default,
  })),
)

export const PopularTravelListComponent = withLazy(() =>
  Promise.resolve(import('@/components/travel/PopularTravelList')).then((module) => ({
    default: module.default,
  })),
)
