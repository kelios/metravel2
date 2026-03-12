import { renderHook } from '@testing-library/react-native';

import { useTravelRouteFiles } from '@/hooks/useTravelRouteFiles';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

const { useQuery } = jest.requireMock('@tanstack/react-query') as {
  useQuery: jest.Mock;
};

describe('useTravelRouteFiles', () => {
  beforeEach(() => {
    useQuery.mockClear();
  });

  it('disables the query when explicit enabled=false is passed', () => {
    renderHook(() => useTravelRouteFiles(503, { enabled: false }));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it('keeps the query enabled by default when travel id exists', () => {
    renderHook(() => useTravelRouteFiles(503));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    );
  });
});
