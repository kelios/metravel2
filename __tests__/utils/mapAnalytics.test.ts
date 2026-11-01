import { Platform } from 'react-native';
import { queueAnalyticsEvent } from '@/utils/analytics';
import {
  resolveMapMarkerKind,
  trackMapFilterChanged,
  trackMapMarkerOpened,
  trackMapOpened,
  trackMapRouteBuilt,
  reportMapScreenMarkerOpened,
} from '@/utils/mapAnalytics';

jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn(), sendAnalyticsEvent: jest.fn() }));

const mockQueue = queueAnalyticsEvent as jest.Mock;

describe('mapAnalytics (#2908)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    mockQueue.mockClear();
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
  });

  it('classifies markers by place id, then travel link', () => {
    expect(resolveMapMarkerKind({ placeId: 12, urlTravel: '/travels/x' })).toBe('place');
    expect(resolveMapMarkerKind({ urlTravel: '/travels/x' })).toBe('travel_point');
    expect(resolveMapMarkerKind({ travelId: 5 })).toBe('travel_point');
    expect(resolveMapMarkerKind({ placeId: '  ', travelId: null })).toBe('point');
    expect(resolveMapMarkerKind(null)).toBe('point');
  });

  it('sends only enumerable params: no coordinates, addresses or query text', () => {
    trackMapOpened({ entry: 'place_link', isMobile: true });
    trackMapFilterChanged({ filter: 'categories', valueCount: 2 });
    trackMapFilterChanged({ filter: 'reset' });
    trackMapMarkerOpened({ point: { placeId: 3 }, surface: 'card' });
    trackMapRouteBuilt({ transportMode: 'bike', pointsCount: 2, distanceMeters: 12_640 });

    expect(mockQueue.mock.calls).toEqual([
      ['map_open', { entry: 'place_link', layout: 'mobile' }],
      ['map_filter_change', { filter: 'categories', value_count: 2 }],
      ['map_filter_change', { filter: 'reset' }],
      ['map_marker_open', { kind: 'place', surface: 'card' }],
      ['map_route_build', { transport_mode: 'bike', points_count: 2, distance_km: 13 }],
    ]);
  });

  it('reports a /map marker tap through the screen callback', () => {
    reportMapScreenMarkerOpened({ urlTravel: '/travels/x' }, 'popup');
    expect(mockQueue).toHaveBeenCalledWith('map_marker_open', { kind: 'travel_point', surface: 'popup' });
  });

  it('stays silent on native, where the map has its own telemetry', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
    trackMapOpened({ entry: 'direct', isMobile: true });
    trackMapMarkerOpened({ point: null, surface: 'popup' });
    expect(mockQueue).not.toHaveBeenCalled();
  });
});
