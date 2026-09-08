import React, { type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ApiError } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { TripGearItem } from '@/api/plannedTripsGear'
import {
  useApplyTripGearTemplate,
  useDeleteTripGearItem,
  useTripGear,
  useUpdateTripGearItem,
} from '@/hooks/useTripGearApi'

const mockFetchTripGear = jest.fn()
const mockApplyTripGearTemplate = jest.fn()
const mockUpdateTripGearItem = jest.fn()
const mockDeleteTripGearItem = jest.fn()

jest.mock('@/api/plannedTripsGear', () => ({
  ...jest.requireActual('@/api/plannedTripsGear'),
  fetchTripGear: (...args: unknown[]) => mockFetchTripGear(...args),
  applyTripGearTemplate: (...args: unknown[]) => mockApplyTripGearTemplate(...args),
  updateTripGearItem: (...args: unknown[]) => mockUpdateTripGearItem(...args),
  deleteTripGearItem: (...args: unknown[]) => mockDeleteTripGearItem(...args),
}))

const item = (overrides: Partial<TripGearItem> = {}): TripGearItem => ({
  id: 1,
  title: 'Паспорт',
  category: 'documents',
  status: 'buy',
  sortOrder: 0,
  ...overrides,
})

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

const wrapperFor = (client: QueryClient) =>
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useTripGear (#1839)', () => {
  it('не ходит в сеть, пока читать нельзя', () => {
    const client = makeClient()
    renderHook(() => useTripGear(8001, false), { wrapper: wrapperFor(client) })

    expect(mockFetchTripGear).not.toHaveBeenCalled()
  })

  it('не повторяет запрос, которому отказано в доступе', async () => {
    mockFetchTripGear.mockRejectedValue(new ApiError(403, 'forbidden'))
    // Дефолт клиента здесь ни при чём: свой `retry` хука перебивает его, и
    // единственный вызов доказывает именно предикат хука.
    const client = makeClient()
    const { result } = renderHook(() => useTripGear(8001), { wrapper: wrapperFor(client) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mockFetchTripGear).toHaveBeenCalledTimes(1)
  })
})

describe('useUpdateTripGearItem — оптимистичный статус', () => {
  it('перекрашивает чип до ответа сервера и оставляет ответ сервера в кэше', async () => {
    const client = makeClient()
    const key = queryKeys.plannedTripGear(8001)
    client.setQueryData<TripGearItem[]>(key, [item({ id: 7, status: 'owned' })])
    let resolveServer: (value: TripGearItem) => void = () => {}
    mockUpdateTripGearItem.mockReturnValue(
      new Promise<TripGearItem>((resolve) => {
        resolveServer = resolve
      }),
    )

    const { result } = renderHook(() => useUpdateTripGearItem(), { wrapper: wrapperFor(client) })

    act(() => {
      result.current.mutate({ tripId: 8001, itemId: 7, status: 'packed' })
    })

    await waitFor(() =>
      expect(client.getQueryData<TripGearItem[]>(key)?.[0].status).toBe('packed'),
    )

    await act(async () => {
      resolveServer(item({ id: 7, status: 'packed', title: 'Паспорт / ID' }))
    })

    await waitFor(() =>
      expect(client.getQueryData<TripGearItem[]>(key)?.[0].title).toBe('Паспорт / ID'),
    )
  })

  it('возвращает прежний статус, если сервер отказал', async () => {
    const client = makeClient()
    const key = queryKeys.plannedTripGear(8001)
    client.setQueryData<TripGearItem[]>(key, [item({ id: 7, status: 'owned' })])
    mockUpdateTripGearItem.mockRejectedValue(new ApiError(500, 'boom'))

    const { result } = renderHook(() => useUpdateTripGearItem(), { wrapper: wrapperFor(client) })

    act(() => {
      result.current.mutate({ tripId: 8001, itemId: 7, status: 'packed' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryData<TripGearItem[]>(key)?.[0].status).toBe('owned')
  })
})

describe('useApplyTripGearTemplate', () => {
  it('дописывает только созданные позиции', async () => {
    const client = makeClient()
    const key = queryKeys.plannedTripGear(8001)
    client.setQueryData<TripGearItem[]>(key, [item({ id: 1 })])
    mockApplyTripGearTemplate.mockResolvedValue([item({ id: 2, title: 'Дождевик', category: 'clothing' })])

    const { result } = renderHook(() => useApplyTripGearTemplate(), { wrapper: wrapperFor(client) })

    act(() => {
      result.current.mutate({ tripId: 8001 })
    })

    await waitFor(() => expect(client.getQueryData<TripGearItem[]>(key)).toHaveLength(2))
  })

  it('на повторе шаблона не трогает список: бэк вернул пусто, дублировать нечего', async () => {
    const client = makeClient()
    const key = queryKeys.plannedTripGear(8001)
    const before = [item({ id: 1 })]
    client.setQueryData<TripGearItem[]>(key, before)
    mockApplyTripGearTemplate.mockResolvedValue([])

    const { result } = renderHook(() => useApplyTripGearTemplate(), { wrapper: wrapperFor(client) })

    act(() => {
      result.current.mutate({ tripId: 8001 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryData<TripGearItem[]>(key)).toBe(before)
  })
})

describe('useDeleteTripGearItem', () => {
  it('убирает строку сразу и возвращает её, если удаление не прошло', async () => {
    const client = makeClient()
    const key = queryKeys.plannedTripGear(8001)
    client.setQueryData<TripGearItem[]>(key, [item({ id: 1 }), item({ id: 2 })])
    mockDeleteTripGearItem.mockRejectedValue(new ApiError(500, 'boom'))

    const { result } = renderHook(() => useDeleteTripGearItem(), { wrapper: wrapperFor(client) })

    act(() => {
      result.current.mutate({ tripId: 8001, itemId: 2 })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryData<TripGearItem[]>(key)).toHaveLength(2)
  })
})
