import React, { type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { PlannedTrip } from '@/api/plannedTrips'
import { queryKeys } from '@/api/queryKeys'
import {
  useMyPlannedTrips,
  usePlannedTrip,
  useUpdateTripTransport,
} from '@/hooks/usePlannedTripsApi'
import { useAuthStore } from '@/stores/authStore'

const mockFetchMyPlannedTrips = jest.fn()
const mockUpdatePlannedTripTransport = jest.fn()
const mockFetchPlannedTrip = jest.fn()

jest.mock('@/api/plannedTrips', () => ({
  ...jest.requireActual('@/api/plannedTrips'),
  fetchMyPlannedTrips: (...args: unknown[]) => mockFetchMyPlannedTrips(...args),
  fetchPlannedTrip: (...args: unknown[]) => mockFetchPlannedTrip(...args),
  updatePlannedTripTransport: (...args: unknown[]) => mockUpdatePlannedTripTransport(...args),
}))

const makeTrip = (): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Updated trip',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'bike',
  bikeType: 'regular',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [],
  routeGeometry: [[27.56, 53.9], [27.4, 53.8]],
  routeSummary: {
    distanceKm: 18.5,
    durationMin: 52,
    elevationGainM: 140,
    stopsCount: 1,
    provider: 'ors',
  },
  routingState: {
    provider: 'ors',
    isOptimal: true,
    fallbackReason: null,
    warnings: [],
  },
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-08-08T08:00:00Z',
})

describe('planned trip hooks', () => {
  beforeEach(() => {
    mockFetchMyPlannedTrips.mockReset()
    mockFetchPlannedTrip.mockReset()
    mockUpdatePlannedTripTransport.mockReset()
    useAuthStore.setState({
      authReady: true,
      isAuthenticated: false,
      userId: null,
    })
  })

  it('re-derives ownership when auth identity changes without refetching a fresh cached trip', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
    })
    queryClient.setQueryData(queryKeys.plannedTrip(42), {
      ...makeTrip(),
      isOwner: false,
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => usePlannedTrip(42), { wrapper })

    expect(result.current.data?.isOwner).toBe(false)
    expect(mockFetchPlannedTrip).not.toHaveBeenCalled()

    act(() => {
      useAuthStore.setState({
        authReady: true,
        isAuthenticated: true,
        userId: '7',
      })
    })

    await waitFor(() => expect(result.current.data?.isOwner).toBe(true))
    expect(mockFetchPlannedTrip).not.toHaveBeenCalled()

    act(() => {
      useAuthStore.setState({ userId: '8' })
    })

    await waitFor(() => expect(result.current.data?.isOwner).toBe(false))
    expect(mockFetchPlannedTrip).not.toHaveBeenCalled()
  })

  it('writes the complete response to detail cache and invalidates all transport consumers', async () => {
    const updatedTrip = makeTrip()
    mockUpdatePlannedTripTransport.mockResolvedValue(updatedTrip)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useUpdateTripTransport(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ tripId: 42, transport: 'bike' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockUpdatePlannedTripTransport.mock.calls[0][0]).toEqual({
      tripId: 42,
      transport: 'bike',
    })
    expect(queryClient.getQueryData(queryKeys.plannedTrip(42))).toEqual(updatedTrip)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.plannedTripsAll() })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.plannedTripsMine() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.publicTripsAll() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.communityTripsAll() })
  })

  it('refetches an active planned-trip collection only once after transport success', async () => {
    const updatedTrip = makeTrip()
    mockFetchMyPlannedTrips.mockResolvedValue([updatedTrip])
    mockUpdatePlannedTripTransport.mockResolvedValue(updatedTrip)
    useAuthStore.setState({ isAuthenticated: true, userId: '7' })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () => ({ trips: useMyPlannedTrips(), updateTransport: useUpdateTripTransport() }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.trips.isSuccess).toBe(true))
    expect(mockFetchMyPlannedTrips).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.updateTransport.mutateAsync({ tripId: 42, transport: 'bike' })
    })

    await waitFor(() => expect(mockFetchMyPlannedTrips).toHaveBeenCalledTimes(2))
  })
})
