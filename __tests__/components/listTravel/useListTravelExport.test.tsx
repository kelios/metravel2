import { act, renderHook } from '@testing-library/react-native';

import { useListTravelExport } from '@/components/listTravel/hooks/useListTravelExport';

const travelA = {
  id: 1,
  slug: 'travel-a',
  name: 'Travel A',
  countryName: 'Poland',
  year: '2024',
} as any;

const travelB = {
  id: 2,
  slug: 'travel-b',
  name: 'Travel B',
  countryName: 'Georgia',
  year: '2023',
} as any;

const travelC = {
  id: 3,
  slug: 'travel-c',
  name: 'Travel C',
  countryName: 'Spain',
  year: '2022',
} as any;

describe('useListTravelExport', () => {
  it('keeps selected travels when current filtered list changes', () => {
    const { result, rerender } = renderHook(
      ({ travels }) => useListTravelExport(travels),
      {
        initialProps: { travels: [travelA, travelB] },
      }
    );

    act(() => {
      result.current.toggleSelect(travelA);
    });

    rerender({ travels: [travelB] });

    expect(result.current.selected.map((item) => item.id)).toEqual([1]);
    expect(result.current.isSelected(1)).toBe(true);
  });

  it('toggles all only for currently visible travels and preserves hidden selection', () => {
    const { result, rerender } = renderHook(
      ({ travels }) => useListTravelExport(travels),
      {
        initialProps: { travels: [travelA] },
      }
    );

    act(() => {
      result.current.toggleSelect(travelA);
    });

    rerender({ travels: [travelB, travelC] });

    act(() => {
      result.current.toggleSelectAll();
    });

    expect(result.current.selected.map((item) => item.id)).toEqual([1, 2, 3]);

    act(() => {
      result.current.toggleSelectAll();
    });

    expect(result.current.selected.map((item) => item.id)).toEqual([1]);
  });

  it('moves selected travels up and down in manual order', () => {
    const { result } = renderHook(() => useListTravelExport([travelA, travelB, travelC]));

    act(() => {
      result.current.toggleSelect(travelA);
      result.current.toggleSelect(travelB);
      result.current.toggleSelect(travelC);
    });

    act(() => {
      result.current.moveSelected(3, 'up');
    });

    expect(result.current.selected.map((item) => item.id)).toEqual([1, 3, 2]);

    act(() => {
      result.current.moveSelected(1, 'down');
    });

    expect(result.current.selected.map((item) => item.id)).toEqual([3, 1, 2]);
  });
});
