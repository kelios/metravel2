import { arePropsEqual } from '@/components/MapPage/Map.web';

const baseProps = () => ({
  travel: { data: [{ id: 1, coord: '53.9,27.5', address: 'Minsk', travelImageThumbUrl: '', categoryName: '' }] },
  coordinates: { latitude: 53.9006, longitude: 27.559 },
  routePoints: [[27.559, 53.9006]] as [number, number][],
  fullRouteCoords: [] as [number, number][],
  setRoutePoints: jest.fn(),
  onMapClick: jest.fn(),
  mode: 'radius' as const,
  transportMode: 'car' as const,
  setRouteDistance: jest.fn(),
  setFullRouteCoords: jest.fn(),
  radius: '30',
});

describe('Map.web arePropsEqual comparator', () => {
  it('returns true for identical props', () => {
    const a = baseProps();
    expect(arePropsEqual(a, a)).toBe(true);
  });

  it('returns false when coordinates change beyond epsilon', () => {
    const a = baseProps();
    const b = { ...a, coordinates: { latitude: 54.0, longitude: 27.559 } };
    expect(arePropsEqual(a, b)).toBe(false);
  });

  it('returns true when coordinates change within epsilon', () => {
    const a = baseProps();
    const b = { ...a, coordinates: { latitude: 53.90065, longitude: 27.559 } };
    expect(arePropsEqual(a, b)).toBe(true);
  });

  it('returns false when mode changes', () => {
    const a = baseProps();
    const b = { ...a, mode: 'route' as const };
    expect(arePropsEqual(a, b)).toBe(false);
  });

  it('returns false when routePoints length changes', () => {
    const a = baseProps();
    const b = { ...a, routePoints: [[27.559, 53.9006], [27.57, 53.91]] as [number, number][] };
    expect(arePropsEqual(a, b)).toBe(false);
  });

  it('returns false when fullRouteCoords changes', () => {
    const a = { ...baseProps(), fullRouteCoords: [[27.559, 53.9006], [27.5601, 53.9007]] as [number, number][] };
    const b = { ...a, fullRouteCoords: [[27.559, 53.9006], [27.5601, 53.9007], [27.5612, 53.9008]] as [number, number][] };
    expect(arePropsEqual(a, b)).toBe(false);
  });

  it('returns false when travel data length changes', () => {
    const a = baseProps();
    const b = { ...a, travel: { data: [] } };
    expect(arePropsEqual(a, b)).toBe(false);
  });

  it('returns false when radius changes', () => {
    const a = baseProps();
    const b = { ...a, radius: '60' };
    expect(arePropsEqual(a, b)).toBe(false);
  });

  it('returns false when transportMode changes', () => {
    const a = baseProps();
    const b = { ...a, transportMode: 'bike' as const };
    expect(arePropsEqual(a, b)).toBe(false);
  });
});
