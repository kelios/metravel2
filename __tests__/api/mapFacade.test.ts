import * as map from '@/api/map';
import * as discovery from '@/api/map/discoveryQueries';
import * as nearby from '@/api/map/nearbyMapPoints';
import * as radius from '@/api/map/radiusQueries';
import * as clusters from '@/api/map/clusterQueries';
import * as sources from '@/api/map/placeSources';
import * as filters from '@/api/map/filters';

// The facade remains the single caller/mock boundary after the extraction.
// Keep the runtime export surface captured from the pre-split map API.
const originalExports = [
  'fetchAllMapPlaceSources',
  'fetchFiltersMap',
  'fetchMapClusters',
  'fetchMapPlaceSources',
  'fetchNearbyTravelMapPoints',
  'fetchTravelsForMap',
  'fetchTravelsNear',
  'fetchTravelsNearRoute',
  'fetchTravelsOfMonth',
  'fetchTravelsPopular',
  'fetchTravelsRandom',
  'serializeMapClusterBBox',
];

describe('public map API facade', () => {
  it('preserves the original public exports without leaking internal adapters', () => {
    expect(Object.keys(map).sort()).toEqual(originalExports);
  });

  it('re-exports the leaf implementations without wrappers or new function identities', () => {
    const implementations = { ...discovery, ...nearby, ...radius, ...clusters, ...sources, ...filters };
    for (const name of originalExports) {
      expect(map[name as keyof typeof map]).toBe(implementations[name as keyof typeof implementations]);
    }
  });
});
