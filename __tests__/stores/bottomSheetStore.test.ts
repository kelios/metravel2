import { getBottomSheetControlsOffset, useBottomSheetStore } from '@/stores/bottomSheetStore';

describe('bottomSheetStore', () => {
  beforeEach(() => {
    useBottomSheetStore.setState({
      state: 'collapsed',
      heightPx: 0,
    });
  });

  it('uses actual sheet height when calculating mobile-safe offsets', () => {
    expect(getBottomSheetControlsOffset('collapsed', 0)).toBe(120);
    expect(getBottomSheetControlsOffset('quarter', 180)).toBe(196);
    expect(getBottomSheetControlsOffset('half', 420)).toBe(436);
    expect(getBottomSheetControlsOffset('full', 640)).toBe(656);
  });
});
