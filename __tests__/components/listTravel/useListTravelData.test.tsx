import React, { forwardRef, useImperativeHandle } from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useListTravelData } from '@/components/listTravel/hooks/useListTravelData';
import { fetchTravels } from '@/src/api/travels';

jest.mock('@/src/api/travels', () => ({
  fetchTravels: jest.fn(),
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
});
