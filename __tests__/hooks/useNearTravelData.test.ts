import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useNearTravelData } from '@/hooks/useNearTravelData';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;

const responseWithJson = (payload: unknown): Response => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: jest.fn(async () => JSON.stringify(payload)),
} as unknown as Response);

const travelCard = (id: number) => ({
  id,
  title: `Travel ${id}`,
  url: `/travels/travel-${id}`,
  slug: `travel-${id}`,
  countryName: 'Polska',
  cityName: 'Kraków',
  year: 2026,
  rating: 4.8,
  media: {
    cover: {
      id,
      src: `/travel-image/${id}/`,
    },
  },
});

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
};

describe('useNearTravelData canonical /near/ adapter path', () => {
  beforeEach(() => {
    mockedFetchWithTimeout.mockReset();
  });

  it('unwraps the canonical envelope, normalizes card fields, and exposes at most six items', async () => {
    mockedFetchWithTimeout.mockResolvedValueOnce(responseWithJson({
      count: 59,
      next: '/api/travels/384/near/?page=2&perPage=6',
      previous: null,
      results: Array.from({ length: 8 }, (_, index) => travelCard(index + 1)),
    }));

    const { result } = renderHook(
      () => useNearTravelData(384),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.travelsNear).toHaveLength(6);
    expect(result.current.displayedTravels).toHaveLength(6);
    expect(result.current.travelsNear[0]).toMatchObject({
      id: 1,
      name: 'Travel 1',
      slug: 'travel-1',
      countryName: 'Polska',
      cityName: 'Kraków',
      year: 2026,
      rating: 4.8,
      travel_image_thumb_url: '/travel-image/1/',
      travel_image_thumb_small_url: '/travel-image/1/',
      media: { cover: { id: 1, src: '/travel-image/1/' } },
    });
    expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/travels/384/near/?page=1&perPage=6'),
      expect.objectContaining({ signal: expect.any(Object) }),
      expect.any(Number),
    );
  });

  it('keeps a valid empty envelope as the empty state', async () => {
    mockedFetchWithTimeout.mockResolvedValueOnce(responseWithJson({
      count: 0,
      next: null,
      previous: null,
      results: [],
    }));

    const { result } = renderHook(
      () => useNearTravelData(384),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.travelsNear).toEqual([]);
    expect(result.current.displayedTravels).toEqual([]);
  });

  it('builds a map marker from representative compact-card coordinates', async () => {
    mockedFetchWithTimeout.mockResolvedValueOnce(responseWithJson({
      count: 1,
      next: null,
      previous: null,
      results: [{ ...travelCard(1), lat: 50.061, lng: 19.938 }],
    }));

    const { result } = renderHook(
      () => useNearTravelData(384),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.mapPoints).toEqual([
      expect.objectContaining({ id: '1-0', coord: '50.061,19.938', address: 'Travel 1' }),
    ]);
  });

  it.each([
    ['a bare results array', []],
    ['an envelope with malformed results', {
      count: 59,
      next: null,
      previous: null,
      results: null,
    }],
    ['an inconsistent empty envelope', {
      count: 59,
      next: '/api/travels/384/near/?page=2&perPage=6',
      previous: null,
      results: [],
    }],
    ['an envelope with an unsafe nullable card field', {
      count: 1,
      next: null,
      previous: null,
      results: [{ ...travelCard(1), countryName: null }],
    }],
    ['an envelope with a malformed cover source', {
      count: 1,
      next: null,
      previous: null,
      results: [{ ...travelCard(1), media: { cover: { src: 42 } } }],
    }],
  ])('surfaces %s as a query error instead of an empty list', async (_case, payload) => {
    mockedFetchWithTimeout.mockResolvedValueOnce(responseWithJson(payload));

    const { result } = renderHook(
      () => useNearTravelData(384),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({
      status: 502,
      data: { code: 'INVALID_NEAR_TRAVELS_RESPONSE' },
    });
    expect(result.current.travelsNear).toEqual([]);
  });

  it('surfaces a transport error instead of an empty list', async () => {
    const transportError = new TypeError('Network request failed');
    mockedFetchWithTimeout.mockRejectedValueOnce(transportError);

    const { result } = renderHook(
      () => useNearTravelData(384),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(transportError);
    expect(result.current.travelsNear).toEqual([]);
  });
});
