/** @jest-environment jsdom */
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => 'u-1' }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: true, userId: 'u-1' }) },
}));
jest.mock('@/api/travelsApi', () => ({
  fetchMyTravels: jest.fn(),
  deleteTravel: jest.fn(),
  unwrapMyTravelsPayload: jest.requireActual('@/api/travelUserQueries').unwrapMyTravelsPayload,
}));
jest.mock('@/utils/toast', () => ({ showToastMessage: jest.fn() }));

import { fetchMyTravels } from '@/api/travelsApi';
import { queryKeys } from '@/api/queryKeys';
import { useMyTravels } from '@/hooks/useMyTravels';

const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;
const authorKey = queryKeys.authorTravels('u-1', 'u-1', { perPage: 20, includeDrafts: true });
const childKey = ['subscription-probe', 'favorite', 1] as const;

type Payload = Awaited<ReturnType<typeof fetchMyTravels>>;

// Real useQuery creates its QueryObserver while this child renders. The child
// has no network request and never calls a parent setter or cache.notify().
function FavoriteButtonFixture() {
  const favorite = useQuery({
    queryKey: childKey,
    queryFn: async () => false,
    initialData: false,
    enabled: false,
  });
  return <button type="button">{favorite.data ? 'Saved' : 'Save'}</button>;
}

function ProfileScreenFixture() {
  const { load, myTravels, isLoading } = useMyTravels({
    userId: 'u-1', perPage: 20, includeDrafts: true, probeDraftsCount: false,
  });
  useEffect(() => { void load(); }, [load]);
  return <section aria-busy={isLoading}>
    {myTravels.map(travel => <FavoriteButtonFixture key={travel.id} />)}
  </section>;
}

let client: QueryClient;
let root: Root;
let container: HTMLDivElement;
let errors: string[];
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  errors = [];
  errorSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  client.clear();
  container.remove();
  errorSpy.mockRestore();
});

it('does not notify the profile during a newly loaded card QueryObserver render', async () => {
  let resolveFirstPage!: (payload: Payload) => void;
  const firstPage = new Promise<Payload>(resolve => { resolveFirstPage = resolve; });
  mockFetchMyTravels.mockReturnValueOnce(firstPage);
  let childObserverEvents = 0;
  const unsubscribe = client.getQueryCache().subscribe(event => {
    if (event.type === 'observerResultsUpdated' && event.query.queryKey[0] === childKey[0]) {
      childObserverEvents += 1;
    }
  });
  try {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><ProfileScreenFixture /></QueryClientProvider>);
    });
    // load() invalidated the author query; its pending state has committed.
    expect(mockFetchMyTravels).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(authorKey)?.isInvalidated).toBe(true);
    expect(container.querySelector('button')).toBeNull();
    expect(errors.filter(message => message.includes('Cannot update a component'))).toEqual([]);

    await act(async () => {
      resolveFirstPage({
        data: [{ id: 1, name: 'Route', slug: 'subscription-route', url: '/travels/subscription-route' }],
        total: 1,
      } as Payload);
      await firstPage;
    });
    expect(client.getQueryState(authorKey)?.isInvalidated).toBe(false);
    expect(container.querySelector('button')?.textContent).toBe('Save');
    expect(childObserverEvents).toBeGreaterThan(0);
    expect(errors.filter(message => message.includes('Cannot update a component'))).toEqual([]);
  } finally {
    unsubscribe();
  }
});
