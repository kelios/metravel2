import { CLUSTER_DISABLE_ZOOM, getClusterZoomFitBoundsOptions } from '@/components/MapPage/Map/clusterFitBounds';

describe('getClusterZoomFitBoundsOptions', () => {
  it('keeps mobile cluster fit zoom aligned with the cluster disable threshold', () => {
    const mobile = getClusterZoomFitBoundsOptions({ width: 375, height: 667 });

    expect(mobile.maxZoom).toBe(CLUSTER_DISABLE_ZOOM);
  });

  it('keeps desktop cluster fit zoom aligned with the cluster disable threshold', () => {
    const desktop = getClusterZoomFitBoundsOptions({ width: 1280, height: 900 });

    expect(desktop.maxZoom).toBe(CLUSTER_DISABLE_ZOOM);
  });
});
