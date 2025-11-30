import React, { forwardRef, useImperativeHandle } from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useListTravelData, useRandomTravelData } from '@/components/listTravel/hooks/useListTravelData';
import { fetchTravels, fetchRandomTravels } from '@/src/api/travels';

jest.mock('@/src/api/travels', () => ({
  fetchTravels: jest.fn(),
  fetchRandomTravels: jest.fn(),
}));

const createTravels = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, idx) => ({
    id: `${prefix}-${idx}`,
    title: `Travel ${prefix}-${idx}`,
  }));

type HarnessProps = {
  queryParams: Record<string, any>;
  search?: string;
  isQueryEnabled?: boolean;
};

const TestHarness = forwardRef<any, HarnessProps>(
  ({ queryParams, search = '', isQueryEnabled = true }, ref) => {
    const hook = useListTravelData({
      queryParams,
      search,
      isQueryEnabled,
    });

    useImperativeHandle(ref, () => hook);
    return null;
  },
);

TestHarness.displayName = 'UseListTravelDataHarness';

const RandomHarness = forwardRef<any, HarnessProps>(
  ({ queryParams, search = '', isQueryEnabled = true }, ref) => {
    const hook = useRandomTravelData({
      queryParams,
      search,
      isQueryEnabled,
    });

    useImperativeHandle(ref, () => hook);
    return null;
  },
);

RandomHarness.displayName = 'UseRandomTravelDataHarness';

const renderWithClient = (props: HarnessProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const ref = React.createRef<any>();
  const ui = (
    <QueryClientProvider client={queryClient}>
      <TestHarness ref={ref} {...props} />
    </QueryClientProvider>
  );

  const utils = render(ui);

  return {
    ref,
    queryClient,
    ...utils,
    rerender(newProps: HarnessProps) {
      utils.rerender(
        <QueryClientProvider client={queryClient}>
          <TestHarness ref={ref} {...newProps} />
        </QueryClientProvider>,
      );
    },
  };
};

describe('useListTravelData with infinite query', () => {
  beforeEach(() => {
    (fetchTravels as jest.Mock).mockReset();
    (fetchRandomTravels as jest.Mock).mockReset();
  });

  it('loads the first page on mount', async () => {
    (fetchTravels as jest.Mock).mockResolvedValueOnce({
      total: 24,
      data: createTravels('initial', 12),
    });

    const { ref, queryClient, unmount } = renderWithClient({ queryParams: {} });

    await waitFor(() => expect(ref.current?.isInitialLoading).toBe(false));
    expect(ref.current?.data).toHaveLength(12);
    expect(fetchTravels).toHaveBeenCalledTimes(1);

    unmount();
    queryClient.clear();
  });

  it('fetches the next page when handleEndReached is called', async () => {
    (fetchTravels as jest.Mock)
      .mockResolvedValueOnce({
        total: 18,
        data: createTravels('page-0', 12),
      })
      .mockResolvedValueOnce({
        total: 18,
        data: createTravels('page-1', 6),
      });

    const { ref, queryClient, unmount } = renderWithClient({ queryParams: {} });

    await waitFor(() => expect(ref.current?.data).toHaveLength(12));

    act(() => {
      ref.current?.handleEndReached();
    });

    await waitFor(() => expect(ref.current?.data).toHaveLength(18));
    expect(fetchTravels).toHaveBeenCalledTimes(2);

    unmount();
    queryClient.clear();
  });

  it('refetches when query params change', async () => {
    (fetchTravels as jest.Mock)
      .mockResolvedValueOnce({
        total: 12,
        data: createTravels('initial', 12),
      })
      .mockResolvedValueOnce({
        total: 4,
        data: createTravels('filtered', 4),
      });

    const { ref, rerender, queryClient, unmount } = renderWithClient({ queryParams: {} });

    await waitFor(() => expect(ref.current?.data).toHaveLength(12));

    rerender({ queryParams: { countries: [3] } });

    await waitFor(() => expect(ref.current?.data).toHaveLength(4));
    expect(fetchTravels).toHaveBeenCalledTimes(2);

    unmount();
    queryClient.clear();
  });

  it('sets isEmpty when enabled and no items returned', async () => {
    (fetchTravels as jest.Mock).mockResolvedValueOnce({
      total: 0,
      data: [],
    });

    const { ref, queryClient, unmount } = renderWithClient({ queryParams: {} });

    await waitFor(() => expect(ref.current?.isInitialLoading).toBe(false));

    expect(ref.current?.data).toHaveLength(0);
    expect(ref.current?.isEmpty).toBe(true);

    unmount();
    queryClient.clear();
  });

  it('handleRefresh invalidates query and refetches data', async () => {
    (fetchTravels as jest.Mock)
      .mockResolvedValueOnce({
        total: 12,
        data: createTravels('initial', 12),
      })
      .mockResolvedValueOnce({
        total: 1,
        data: createTravels('refetched', 1),
      })
      .mockResolvedValueOnce({
        total: 1,
        data: createTravels('refetched', 1),
      });

    const { ref, queryClient, unmount } = renderWithClient({ queryParams: {} });

    await waitFor(() => expect(ref.current?.data).toHaveLength(12));

    await act(async () => {
      await ref.current?.handleRefresh();
    });

    await waitFor(() => expect(ref.current?.data).toHaveLength(1));
    expect(fetchTravels).toHaveBeenCalledTimes(3);

    unmount();
    queryClient.clear();
  });

  it('marks isError when fetchTravels rejects', async () => {
    (fetchTravels as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { ref, queryClient, unmount } = renderWithClient({ queryParams: {} });

    await waitFor(() => expect(ref.current?.status).toBe('error'));
    expect(ref.current?.isError).toBe(true);

    unmount();
    queryClient.clear();
  });
});

const renderRandomWithClient = (props: HarnessProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const ref = React.createRef<any>();
  const ui = (
    <QueryClientProvider client={queryClient}>
      <RandomHarness ref={ref} {...props} />
    </QueryClientProvider>
  );

  const utils = render(ui);

  return {
    ref,
    queryClient,
    ...utils,
  };
};

describe('useRandomTravelData', () => {
  beforeEach(() => {
    (fetchRandomTravels as jest.Mock).mockReset();
  });

  it('loads the first random page on mount', async () => {
    (fetchRandomTravels as jest.Mock).mockResolvedValueOnce({
      total: 3,
      data: createTravels('rnd', 3),
    });

    const { ref, queryClient, unmount } = renderRandomWithClient({ queryParams: {} });

    await waitFor(() => expect(ref.current?.isInitialLoading).toBe(false));
    expect(ref.current?.data).toHaveLength(3);
    expect(fetchRandomTravels).toHaveBeenCalledTimes(1);

    unmount();
    queryClient.clear();
  });

  it('sets isEmpty when backend returns no random items', async () => {
    (fetchRandomTravels as jest.Mock).mockResolvedValueOnce({
      total: 0,
      data: [],
    });

    const { ref, queryClient, unmount } = renderRandomWithClient({ queryParams: {} });

    await waitFor(() => expect(ref.current?.isInitialLoading).toBe(false));
    expect(ref.current?.data).toHaveLength(0);
    expect(ref.current?.isEmpty).toBe(true);

    unmount();
    queryClient.clear();
  });
});
