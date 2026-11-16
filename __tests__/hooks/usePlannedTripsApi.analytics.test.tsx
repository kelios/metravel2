import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CreateTripInput, PlannedTrip, RoutePoint } from '@/api/plannedTrips';
import { useCreateTrip, useUpdateTripRoute } from '@/hooks/usePlannedTripsApi';
import { beginTripPlannerEntry, trackTripPlannerForm } from '@/utils/tripPlannerAnalytics';
import { trackRoutePointAdded } from '@/utils/tripAnalytics';

const mockCreate = jest.fn();
const mockUpdateRoute = jest.fn();
const mockSend = jest.fn();
jest.mock('@/api/plannedTrips', () => ({
  ...jest.requireActual('@/api/plannedTrips'),
  createTrip: (...args: unknown[]) => mockCreate(...args),
  updateTripRoute: (...args: unknown[]) => mockUpdateRoute(...args),
}));
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: (...args: unknown[]) => mockSend(...args) }));
jest.mock('@/utils/consent', () => ({ readConsent: () => ({ analytics: true }) }));

const point: RoutePoint = { id: 'p1', type: 'custom', name: 'Private name', coordinates: [27, 53], placeId: null, description: 'Private note' };
const trip = (route: RoutePoint[] = []) => ({ id: 123, transport: 'foot', visibility: 'private', route }) as PlannedTrip;
const input: CreateTripInput = { title: 'Private title', description: '', startDate: '2026-11-20', transport: 'foot', visibility: 'private', seatsTotal: 1, startPoint: null };
const events = (name: string, outcome?: string) => mockSend.mock.calls.filter(([event, params]) => event === name && (!outcome || params.outcome === outcome));
const originalOs = Platform.OS;
let entryId: string;
let client: QueryClient;
const Wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  window.sessionStorage.clear();
  mockSend.mockClear();
  mockCreate.mockReset();
  mockUpdateRoute.mockReset();
  const href = beginTripPlannerEntry('/trips/plan/create?source=quest', false);
  entryId = trackTripPlannerForm(href, true, true);
  client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
});

test('failed creation and rejected route save do not count results; successful retry counts first persisted point once', async () => {
  mockCreate.mockRejectedValueOnce(new Error('create rejected')).mockResolvedValue(trip());
  mockUpdateRoute.mockRejectedValueOnce(new Error('route rejected')).mockResolvedValue(trip([point]));
  const { result } = await renderHook(() => ({ create: useCreateTrip(entryId), route: useUpdateTripRoute() }), { wrapper: Wrapper });
  await act(async () => { await expect(result.current.create.mutateAsync(input)).rejects.toThrow('create rejected'); });
  expect(events('trip_created')).toHaveLength(0);
  expect(events('trip_create_failed')).toHaveLength(1);
  await act(async () => { await result.current.create.mutateAsync(input); });
  expect(events('trip_created')).toHaveLength(1);
  trackRoutePointAdded(123, 'custom');
  expect(events('route_point_added', 'first_saved')).toHaveLength(0);
  await act(async () => { await expect(result.current.route.mutateAsync({ tripId: 123, route: [point] })).rejects.toThrow('route rejected'); });
  expect(events('route_point_added', 'first_saved')).toHaveLength(0);
  await act(async () => { await result.current.route.mutateAsync({ tripId: 123, route: [point] }); });
  await act(async () => { await result.current.route.mutateAsync({ tripId: 123, route: [point] }); });
  await waitFor(() => expect(events('route_point_added', 'first_saved')).toHaveLength(1));
  expect(events('route_point_added', 'first_saved')[0][1]).toMatchObject({ auth_state: 'guest', source: 'quest' });
  expect(JSON.stringify(mockSend.mock.calls)).not.toContain('Private');
});

test('a nonempty creation response counts the start point, while later nonempty input with empty response does not', async () => {
  mockCreate.mockResolvedValueOnce(trip()).mockResolvedValueOnce({ ...trip([point]), id: 124 });
  mockUpdateRoute.mockResolvedValue(trip());
  const { result } = await renderHook(() => ({ create: useCreateTrip(entryId), route: useUpdateTripRoute() }), { wrapper: Wrapper });
  await act(async () => { await result.current.create.mutateAsync(input); });
  await act(async () => { await result.current.route.mutateAsync({ tripId: 123, route: [point] }); });
  expect(events('route_point_added', 'first_saved')).toHaveLength(0);
  await act(async () => { await result.current.create.mutateAsync({ ...input, startPoint: point }); });
  expect(events('route_point_added', 'first_saved')).toHaveLength(1);
});
