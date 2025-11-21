import React, { forwardRef, useImperativeHandle, useState } from 'react'
import { act, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useListTravelData } from '@/components/listTravel/hooks/useListTravelData'
import { fetchTravels } from '@/src/api/travels'

jest.mock('@/src/api/travels', () => ({
  fetchTravels: jest.fn(),
}))

const createTravels = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, idx) => ({
    id: `${prefix}-${idx}`,
    title: `Travel ${prefix}-${idx}`,
  }))

type HarnessProps = {
  queryParams: Record<string, any>
  search?: string
  isQueryEnabled?: boolean
}

const TestHarness = forwardRef<any, HarnessProps>(
  ({ queryParams, search = '', isQueryEnabled = true }, ref) => {
    const [page, setPage] = useState(0)
    const hook = useListTravelData({
      currentPage: page,
      setCurrentPage: setPage,
      queryParams,
      search,
      isQueryEnabled,
    })

    useImperativeHandle(ref, () => ({ ...hook, page }))
    return null
  },
)

TestHarness.displayName = 'UseListTravelDataHarness'

const renderWithClient = (
  props: HarnessProps,
  options: { onClientReady?: (client: QueryClient) => void } = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  options.onClientReady?.(queryClient)

  const ref = React.createRef<any>()
  const ui = (
    <QueryClientProvider client={queryClient}>
      <TestHarness ref={ref} {...props} />
    </QueryClientProvider>
  )
  const utils = render(ui)

  return {
    ref,
    queryClient,
    ...utils,
    rerender(newProps: HarnessProps) {
      utils.rerender(
        <QueryClientProvider client={queryClient}>
          <TestHarness ref={ref} {...newProps} />
        </QueryClientProvider>,
      )
    },
  }
}

describe('useListTravelData pagination safety', () => {
  beforeEach(() => {
    ;(fetchTravels as jest.Mock).mockReset()
  })

  it('keeps the current page at zero while filtered data is pending', async () => {
    ;(fetchTravels as jest.Mock).mockResolvedValueOnce({
      total: 24,
      data: createTravels('initial', 12),
    })

    let resolveFiltered: ((value: { total: number; data: any[] }) => void) | null = null
    const filteredPromise = new Promise<{ total: number; data: any[] }>((resolve) => {
      resolveFiltered = resolve
    })

    ;(fetchTravels as jest.Mock).mockImplementationOnce(() => filteredPromise)

    let prefetchSpy: jest.SpyInstance | undefined
    const { ref, rerender, queryClient, unmount } = renderWithClient(
      { queryParams: {} },
      {
        onClientReady: (client) => {
          prefetchSpy = jest
            .spyOn(client, 'prefetchQuery')
            .mockImplementation(() => Promise.resolve(undefined))
        },
      },
    )

    await waitFor(() => expect(ref.current?.isInitialLoading).toBe(false))
    expect(ref.current?.data).toHaveLength(12)
    expect(ref.current?.page).toBe(0)

    rerender({ queryParams: { countries: [1] } })

    // данные очищаются синхронно после смены фильтров
    await waitFor(() => expect(ref.current?.data).toHaveLength(0))

    act(() => {
      ref.current?.handleEndReached()
    })

    expect(ref.current?.page).toBe(0)

    act(() => {
      resolveFiltered?.({ total: 18, data: createTravels('filtered', 12) })
    })

    await waitFor(() => expect(ref.current?.data).toHaveLength(12))

    prefetchSpy?.mockRestore()
    unmount()
    queryClient.clear()
  })

  it('still loads the next page when a filter is active', async () => {
    ;(fetchTravels as jest.Mock)
      .mockResolvedValueOnce({ total: 30, data: createTravels('filtered-page-0', 12) })
      .mockResolvedValueOnce({ total: 30, data: createTravels('filtered-page-1', 6) })

    let prefetchSpy: jest.SpyInstance | undefined
    const { ref, queryClient, unmount } = renderWithClient(
      { queryParams: { countries: [1] } },
      {
        onClientReady: (client) => {
          prefetchSpy = jest
            .spyOn(client, 'prefetchQuery')
            .mockImplementation(() => Promise.resolve(undefined))
        },
      },
    )

    await waitFor(() => expect(ref.current?.data).toHaveLength(12))
    expect(ref.current?.page).toBe(0)

    act(() => {
      ref.current?.handleEndReached()
    })

    await waitFor(() => expect(ref.current?.page).toBe(1))
    await waitFor(() => expect(ref.current?.data).toHaveLength(18))

    const lastCall = (fetchTravels as jest.Mock).mock.calls.at(-1)
    expect(lastCall?.[0]).toBe(1)

    prefetchSpy?.mockRestore()
    unmount()
    queryClient.clear()
  })

  it('requests filtered data when query params change', async () => {
    ;(fetchTravels as jest.Mock)
      .mockResolvedValueOnce({ total: 30, data: createTravels('initial', 12) })
      .mockResolvedValueOnce({ total: 4, data: createTravels('filtered', 4) })

    let prefetchSpy: jest.SpyInstance | undefined
    const { ref, rerender, queryClient, unmount } = renderWithClient(
      { queryParams: {} },
      {
        onClientReady: (client) => {
          prefetchSpy = jest
            .spyOn(client, 'prefetchQuery')
            .mockImplementation(() => Promise.resolve(undefined))
        },
      },
    )

    await waitFor(() => expect(ref.current?.data).toHaveLength(12))

    rerender({
      queryParams: {
        countries: [20],
        moderation: 1,
        publish: 1,
      },
    })

    await waitFor(() => {
      const calls = (fetchTravels as jest.Mock).mock.calls
      expect(calls).toHaveLength(2)
      const [, , , params] = calls[1]
      expect(params.countries).toEqual([20])
      expect(params.moderation).toBe(1)
      expect(params.publish).toBe(1)
    })

    await waitFor(() => expect(ref.current?.data).toHaveLength(4))
    prefetchSpy?.mockRestore()
    unmount()
    queryClient.clear()
  })
})
