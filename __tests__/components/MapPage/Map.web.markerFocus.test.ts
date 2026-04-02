import { getMarkerFocusPlan } from '@/components/MapPage/Map.web';

describe('getMarkerFocusPlan', () => {
  it('requests bottom sheet collapse when marker is focused with an open sheet', () => {
    expect(
      getMarkerFocusPlan({
        currentZoom: 11,
        maxZoom: 18,
        bottomSheetState: 'half',
      })
    ).toEqual({
      shouldCollapseSheet: true,
      targetZoom: 14,
      shouldSkipZoom: false,
    });
  });

  it('does not request collapse when sheet is already collapsed', () => {
    expect(
      getMarkerFocusPlan({
        currentZoom: 12,
        maxZoom: 18,
        bottomSheetState: 'collapsed',
      })
    ).toEqual({
      shouldCollapseSheet: false,
      targetZoom: 14,
      shouldSkipZoom: false,
    });
  });

  it('keeps high zoom level without extra zoom jump', () => {
    expect(
      getMarkerFocusPlan({
        currentZoom: 15,
        maxZoom: 18,
        bottomSheetState: 'full',
      })
    ).toEqual({
      shouldCollapseSheet: true,
      targetZoom: 17,
      shouldSkipZoom: true,
    });
  });
});
