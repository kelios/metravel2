import { act } from '@testing-library/react';

jest.mock('@/utils/routeValidator', () => ({
  RouteValidator: {
    canAddPoint: jest.fn(() => ({ valid: true })),
    getErrorMessage: jest.fn(() => 'error'),
  },
}));

import { useRouteStore } from '@/stores/routeStore';

const coord = (lat: number, lng: number) => ({ latitude: lat, longitude: lng });

beforeEach(() => {
  useRouteStore.setState({
    mode: 'radius',
    transportMode: 'car',
    points: [],
    route: null,
    isBuilding: false,
    error: null,
  });
});

describe('routeStore', () => {
  describe('initial state', () => {
    it('has correct defaults', () => {
      const s = useRouteStore.getState();
      expect(s.mode).toBe('radius');
      expect(s.transportMode).toBe('car');
      expect(s.points).toEqual([]);
      expect(s.route).toBeNull();
      expect(s.isBuilding).toBe(false);
      expect(s.error).toBeNull();
    });
  });

  describe('setMode', () => {
    it('switches mode', () => {
      act(() => useRouteStore.getState().setMode('route'));
      expect(useRouteStore.getState().mode).toBe('route');
    });
  });

  describe('setTransportMode', () => {
    it('changes transport and clears route', () => {
      useRouteStore.setState({ route: { distance: 100 } as any });
      act(() => useRouteStore.getState().setTransportMode('foot'));
      const s = useRouteStore.getState();
      expect(s.transportMode).toBe('foot');
      expect(s.route).toBeNull();
    });
  });

  describe('addPoint', () => {
    it('first point becomes start', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'Minsk'));
      const pts = useRouteStore.getState().points;
      expect(pts).toHaveLength(1);
      expect(pts[0].type).toBe('start');
      expect(pts[0].address).toBe('Minsk');
    });

    it('second point becomes end', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'A'));
      act(() => useRouteStore.getState().addPoint(coord(51, 31), 'B'));
      const pts = useRouteStore.getState().points;
      expect(pts).toHaveLength(2);
      expect(pts[0].type).toBe('start');
      expect(pts[1].type).toBe('end');
    });

    it('third point converts previous end to waypoint', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'A'));
      act(() => useRouteStore.getState().addPoint(coord(51, 31), 'B'));
      act(() => useRouteStore.getState().addPoint(coord(52, 32), 'C'));
      const pts = useRouteStore.getState().points;
      expect(pts).toHaveLength(3);
      expect(pts[1].type).toBe('waypoint');
    });

    it('clears route when adding point', () => {
      useRouteStore.setState({ route: { distance: 100 } as any });
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'X'));
      expect(useRouteStore.getState().route).toBeNull();
    });
  });

  describe('removePoint', () => {
    it('removes point and recalculates types', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'A'));
      act(() => useRouteStore.getState().addPoint(coord(51, 31), 'B'));
      act(() => useRouteStore.getState().addPoint(coord(52, 32), 'C'));

      const idToRemove = useRouteStore.getState().points[1].id;
      act(() => useRouteStore.getState().removePoint(idToRemove));

      const pts = useRouteStore.getState().points;
      expect(pts).toHaveLength(2);
      expect(pts[0].type).toBe('start');
      expect(pts[1].type).toBe('end');
    });
  });

  describe('updatePoint', () => {
    it('updates address of a point', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'Old'));
      const id = useRouteStore.getState().points[0].id;
      act(() => useRouteStore.getState().updatePoint(id, { address: 'New' }));
      expect(useRouteStore.getState().points[0].address).toBe('New');
    });
  });

  describe('swapStartEnd', () => {
    it('swaps first and last points', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'Start'));
      act(() => useRouteStore.getState().addPoint(coord(51, 31), 'End'));

      act(() => useRouteStore.getState().swapStartEnd());

      const pts = useRouteStore.getState().points;
      expect(pts[0].address).toBe('End');
      expect(pts[0].type).toBe('start');
      expect(pts[1].address).toBe('Start');
      expect(pts[1].type).toBe('end');
    });

    it('does nothing with fewer than 2 points', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'Solo'));
      act(() => useRouteStore.getState().swapStartEnd());
      expect(useRouteStore.getState().points).toHaveLength(1);
    });
  });

  describe('clearRoute', () => {
    it('resets all route state', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'A'));
      useRouteStore.setState({ route: { distance: 100 } as any, error: 'err', isBuilding: true });

      act(() => useRouteStore.getState().clearRoute());

      const s = useRouteStore.getState();
      expect(s.points).toEqual([]);
      expect(s.route).toBeNull();
      expect(s.error).toBeNull();
      expect(s.isBuilding).toBe(false);
    });
  });

  describe('computed getters', () => {
    it('getStartPoint returns first point', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'S'));
      act(() => useRouteStore.getState().addPoint(coord(51, 31), 'E'));
      expect(useRouteStore.getState().getStartPoint()?.address).toBe('S');
    });

    it('getEndPoint returns last point', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'S'));
      act(() => useRouteStore.getState().addPoint(coord(51, 31), 'E'));
      expect(useRouteStore.getState().getEndPoint()?.address).toBe('E');
    });

    it('getWaypoints returns middle points', () => {
      act(() => useRouteStore.getState().addPoint(coord(50, 30), 'A'));
      act(() => useRouteStore.getState().addPoint(coord(51, 31), 'B'));
      act(() => useRouteStore.getState().addPoint(coord(52, 32), 'C'));
      const wps = useRouteStore.getState().getWaypoints();
      expect(wps.length).toBeGreaterThanOrEqual(1);
      expect(wps.some(w => w.address === 'B')).toBe(true);
    });

    it('getStartPoint returns null for empty', () => {
      expect(useRouteStore.getState().getStartPoint()).toBeNull();
    });
  });

  describe('setRoute / setBuilding / setError', () => {
    it('setRoute stores route and clears isBuilding', () => {
      useRouteStore.setState({ isBuilding: true });
      act(() => useRouteStore.getState().setRoute({ distance: 42 } as any));
      expect(useRouteStore.getState().route).toEqual({ distance: 42 });
      expect(useRouteStore.getState().isBuilding).toBe(false);
    });

    it('setBuilding updates flag', () => {
      act(() => useRouteStore.getState().setBuilding(true));
      expect(useRouteStore.getState().isBuilding).toBe(true);
    });

    it('setError stores error and clears isBuilding', () => {
      useRouteStore.setState({ isBuilding: true });
      act(() => useRouteStore.getState().setError('fail'));
      expect(useRouteStore.getState().error).toBe('fail');
      expect(useRouteStore.getState().isBuilding).toBe(false);
    });
  });
});
