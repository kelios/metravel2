import { act, cleanup, renderHook } from '@testing-library/react-native/pure';
import { useRoulette } from '@/components/roulette/useRoulette';

let mockOwner: string | null = '242';
let mockTravels = [{ id: 1, userIds: '1' }, { id: 2, userIds: '2' }];
jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => mockOwner }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { countries: [], facets: {}, total: 2 }, isLoading: false }) }));
jest.mock('@/api/miscOptimized', () => ({ fetchAllFiltersOptimized: jest.fn() }));
jest.mock('@/api/travelListQueries', () => ({ fetchTravelFacets: jest.fn() }));
jest.mock('@/components/listTravel/hooks/useListTravelFilters', () => ({
  useListTravelFilters: () => ({ filter: {}, queryParams: {}, resetFilters: jest.fn(), onSelect: jest.fn() }),
}));
jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  useRandomTravelData: () => ({ data: mockTravels, refetch: async () => ({ data: { pages: [{ data: mockTravels, total: mockTravels.length }] } }) }),
}));

beforeEach(() => {
  mockOwner = '242';
  mockTravels = [{ id: 1, userIds: '1' }, { id: 2, userIds: '2' }];
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
});
afterEach(async () => {
  jest.useRealTimers();
  await cleanup();
});

it('derives spun cards from the guarded query so blocking cannot leave a stale selected card', async () => {
  const { result, rerender } = await renderHook(() => useRoulette());
  await act(async () => result.current.handleSpin());
  await act(() => jest.advanceTimersByTime(900));
  expect(result.current.result).toHaveLength(2);
  mockTravels = [{ id: 2, userIds: '2' }];
  await rerender({});
  expect(result.current.result.map((travel) => travel.id)).toEqual([2]);
  mockTravels = [];
  await rerender({});
  expect(result.current.result).toEqual([]);
});

it('does not carry a previous owner selection into a new session', async () => {
  const { result, rerender } = await renderHook(() => useRoulette());
  await act(async () => result.current.handleSpin());
  await act(() => jest.advanceTimersByTime(900));
  expect(result.current.result).toHaveLength(2);
  mockOwner = null;
  await rerender({});
  expect(result.current.result).toEqual([]);
});
