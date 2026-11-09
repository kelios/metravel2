import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/api/external/osrm', () => ({ osrmRoute: jest.fn() }))

const { osrmRoute } = require('@/api/external/osrm')
const mockOsrm = osrmRoute as jest.Mock

import { useDriveInfoQuery } from '@/components/UserPoints/useDriveInfoQuery'

const okResponse = (distance: number, duration: number) => ({ json: async () => ({ routes: [{ distance, duration }] }) })

const renderWith = (client: QueryClient) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return wrapper
}

describe('useDriveInfoQuery (#3135)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOsrm.mockResolvedValue(okResponse(12_540, 1_190))
  })

  it('карточка и попап одной точки делят один запрос OSRM и получают км/мин', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = renderWith(client)
    const from = { lat: 50.05924, lng: 19.93941 }
    const to = { lat: 50.0614, lng: 19.9366 }
    const card = await renderHook(() => useDriveInfoQuery({ from, to }), { wrapper })
    const popup = await renderHook(() => useDriveInfoQuery({ from: { lat: 50.05921, lng: 19.93938 }, to }), { wrapper })
    expect(['loading', 'ok']).toContain(card.result.current?.status)
    await waitFor(() => expect(card.result.current).toEqual({ status: 'ok', distanceKm: 12.5, durationMin: 20 }))
    await waitFor(() => expect(popup.result.current).toEqual({ status: 'ok', distanceKm: 12.5, durationMin: 20 }))
    // Геолокация отличается на метры — ключ один (4 знака), запрос один.
    expect(mockOsrm).toHaveBeenCalledTimes(1)
    expect(mockOsrm.mock.calls[0][0]).toEqual({ coords: [[from.lng, from.lat], [to.lng, to.lat]] })
  })

  it('без геолокации или выключенный — null и без запроса; ошибка OSRM → status error', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = renderWith(client)
    const to = { lat: 50, lng: 20 }
    const noFrom = await renderHook(() => useDriveInfoQuery({ from: null, to }), { wrapper })
    const disabled = await renderHook(() => useDriveInfoQuery({ from: { lat: 1, lng: 2 }, to, enabled: false }), { wrapper })
    expect(noFrom.result.current).toBeNull()
    expect(disabled.result.current).toBeNull()
    expect(mockOsrm).not.toHaveBeenCalled()

    mockOsrm.mockResolvedValueOnce({ json: async () => ({ routes: [] }) })
    const broken = await renderHook(() => useDriveInfoQuery({ from: { lat: 1, lng: 2 }, to }), { wrapper })
    await waitFor(() => expect(broken.result.current).toEqual({ status: 'error' }))
  })
})
