import { getClusterZoomFitBoundsOptions } from '@/components/MapPage/Map/MapWebCanvas';

describe('getClusterZoomFitBoundsOptions', () => {
  it('keeps balanced padding on desktop viewports', () => {
    expect(getClusterZoomFitBoundsOptions({ width: 1280, height: 900 })).toEqual({
      animate: true,
      paddingTopLeft: [30, 34],
      paddingBottomRight: [30, 34],
      maxZoom: 16,
    });
  });

  it('adds extra top and bottom safe area on narrow mobile viewports', () => {
    expect(getClusterZoomFitBoundsOptions({ width: 390, height: 844 })).toEqual({
      animate: true,
      paddingTopLeft: [16, 104],
      paddingBottomRight: [16, 224],
      maxZoom: 16,
    });
  });

  it('reduces bottom padding slightly on very short mobile screens', () => {
    expect(getClusterZoomFitBoundsOptions({ width: 390, height: 680 })).toEqual({
      animate: true,
      paddingTopLeft: [16, 104],
      paddingBottomRight: [16, 188],
      maxZoom: 16,
    });
  });
});
