import { getBottomSheetControlsOffset, useBottomSheetStore } from '@/stores/bottomSheetStore';

describe('bottomSheetStore', () => {
  beforeEach(() => {
    useBottomSheetStore.setState({
      state: 'collapsed',
      heightPx: 0,
      collapseNonce: 0,
    });
  });

  it('increments collapseNonce when collapse is requested', () => {
    const initial = useBottomSheetStore.getState().collapseNonce;

    useBottomSheetStore.getState().requestCollapse();
    useBottomSheetStore.getState().requestCollapse();

    expect(useBottomSheetStore.getState().collapseNonce).toBe(initial + 2);
  });

  it('uses actual sheet height when calculating mobile-safe offsets', () => {
    expect(getBottomSheetControlsOffset('collapsed', 0)).toBe(120);
    expect(getBottomSheetControlsOffset('quarter', 180)).toBe(196);
    expect(getBottomSheetControlsOffset('half', 420)).toBe(436);
    expect(getBottomSheetControlsOffset('full', 640)).toBe(656);
  });
});
