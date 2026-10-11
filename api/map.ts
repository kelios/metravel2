// Public map API facade. Keep callers and module mocks on this import path.
export { fetchTravelsNear, fetchTravelsPopular, fetchTravelsOfMonth, fetchTravelsRandom } from './map/discoveryQueries';
export { fetchNearbyTravelMapPoints } from './map/nearbyMapPoints';
export { fetchTravelsForMap, fetchTravelsNearRoute } from './map/radiusQueries';
export { serializeMapClusterBBox, fetchMapClusters } from './map/clusterQueries';
export { fetchMapPlaceSources, fetchAllMapPlaceSources } from './map/placeSources';
export { fetchFiltersMap } from './map/filters';
export type {
  NearbyTravelMapPoint,
  MapClusterBBox,
  MapClusterPoint,
  MapCluster,
  MapClustersResult,
  MapClustersFilters,
  MapFiltersResponse,
} from './map/contracts';
