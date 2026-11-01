import { act, renderHook } from '@testing-library/react-native';
import { useMapAnalytics } from '@/hooks/map/useMapAnalytics';
import {
  trackMapFilterChanged,
  trackMapOpened,
  trackMapRouteBuilt,
} from '@/utils/mapAnalytics';

jest.mock('@/utils/mapAnalytics', () => ({
  trackMapOpened: jest.fn(),
  trackMapFilterChanged: jest.fn(),
  trackMapRouteBuilt: jest.fn(),
}));

const opened = trackMapOpened as jest.Mock;
const filterChanged = trackMapFilterChanged as jest.Mock;
const routeBuilt = trackMapRouteBuilt as jest.Mock;

type Props = Parameters<typeof useMapAnalytics>[0];

const baseProps = (overrides: Partial<Props> = {}): Props => ({
  isFocused: true,
  isMobile: false,
  hasUrlPlace: false,
  hasUrlCoordinates: false,
  handleFilterChangeForPanel: jest.fn(),
  resetFilters: jest.fn(),
  transportMode: 'car',
  routePointsCount: 0,
  routeDistance: null,
  ...overrides,
});

describe('useMapAnalytics (#2908)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports an open on every focus of the kept-alive tab, not on re-renders', async () => {
    const { rerender } = await renderHook((props: Props) => useMapAnalytics(props), {
      initialProps: baseProps({ hasUrlPlace: true, isMobile: true }),
    });
    await rerender(baseProps({ hasUrlPlace: true, isMobile: false }));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenLastCalledWith({ entry: 'place_link', isMobile: true });

    await rerender(baseProps({ isFocused: false }));
    await rerender(baseProps({ isFocused: true, hasUrlCoordinates: true }));
    expect(opened).toHaveBeenCalledTimes(2);
    expect(opened).toHaveBeenLastCalledWith({ entry: 'coords_link', isMobile: false });
  });

  it('does not report a route restored from storage, only routes built afterwards', async () => {
    const { rerender } = await renderHook((props: Props) => useMapAnalytics(props), {
      initialProps: baseProps({ routePointsCount: 2, routeDistance: null }),
    });
    await rerender(baseProps({ routePointsCount: 2, routeDistance: 9_000 }));
    expect(routeBuilt).not.toHaveBeenCalled();
    await rerender(baseProps({ routePointsCount: 3, routeDistance: 12_000 }));
    expect(routeBuilt).toHaveBeenCalledTimes(1);
  });

  it('reports the first build after the user edits a restored route that never got a distance', async () => {
    const { rerender } = await renderHook((props: Props) => useMapAnalytics(props), {
      initialProps: baseProps({ routePointsCount: 2, routeDistance: null }),
    });
    await rerender(baseProps({ routePointsCount: 3, routeDistance: 7_000 }));
    expect(routeBuilt).toHaveBeenCalledTimes(1);
  });

  it('forwards every filter change but reports only discrete filters and reset', async () => {
    const props = baseProps();
    const { result } = await renderHook(() => useMapAnalytics(props));

    await act(async () => {
      result.current.trackedFilterChange('categories', ['1', '2']);
      result.current.trackedFilterChange('radius', '60');
      result.current.trackedFilterChange('searchQuery', 'Нес');
      result.current.trackedFilterChange('address', 'Минск');
      result.current.trackedResetFilters();
    });

    expect(props.handleFilterChangeForPanel).toHaveBeenCalledTimes(4);
    expect(props.resetFilters).toHaveBeenCalledTimes(1);
    expect(filterChanged.mock.calls).toEqual([
      [{ filter: 'categories', valueCount: 2 }],
      [{ filter: 'radius', radiusKm: 60 }],
      [{ filter: 'reset' }],
    ]);
  });

  it('reports a built route once per distinct route, not per recalculation', async () => {
    const { rerender } = await renderHook((props: Props) => useMapAnalytics(props), {
      initialProps: baseProps({ routePointsCount: 1, routeDistance: null }),
    });
    expect(routeBuilt).not.toHaveBeenCalled();

    await rerender(baseProps({ routePointsCount: 2, routeDistance: 15_200.4 }));
    await rerender(baseProps({ routePointsCount: 2, routeDistance: 15_200.4 }));
    expect(routeBuilt).toHaveBeenCalledTimes(1);
    expect(routeBuilt).toHaveBeenCalledWith({ transportMode: 'car', pointsCount: 2, distanceMeters: 15_200.4 });

    await rerender(baseProps({ transportMode: 'foot', routePointsCount: 2, routeDistance: 14_000 }));
    expect(routeBuilt).toHaveBeenCalledTimes(2);

    // Сброс маршрута и тот же маршрут заново — новое построение.
    await rerender(baseProps({ routePointsCount: 0, routeDistance: null }));
    await rerender(baseProps({ transportMode: 'foot', routePointsCount: 2, routeDistance: 14_000 }));
    expect(routeBuilt).toHaveBeenCalledTimes(3);
  });
});
