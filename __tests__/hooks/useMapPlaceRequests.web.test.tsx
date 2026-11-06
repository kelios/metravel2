import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { ApiError } from '@/api/client'
import { fetchPlaceRequest, fetchPlaceRequests, type PlaceRequest } from '@/api/placeRequests'
import { useMapPlaceRequests } from '@/hooks/map/useMapPlaceRequests.web'
import { isPlaceRequestsPilotEnabled } from '@/utils/placeRequestsConfig'

jest.mock('@/api/placeRequests', () => ({
  fetchPlaceRequest: jest.fn(),
  fetchPlaceRequests: jest.fn(),
}))
jest.mock('@/utils/placeRequestsConfig', () => ({ isPlaceRequestsPilotEnabled: jest.fn() }))
jest.mock('@/i18n/LocaleProvider', () => ({
  useLocale: () => ({ locale: 'ru' }),
  useTranslation: () => ({ t: (key: string) => key }),
}))

const invitation: PlaceRequest = {
  id: '89b3aaf4-7590-5e29-af5a-ecb918dd96f1', status: 'open',
  placeId: 'c380f3b9-340f-5cfc-8995-29608ed38f29', name: 'Жиличи', address: 'Жиличи',
  countryId: 1, region: 'mogilev', categoryId: 1, categoryName: 'Усадьба',
  lat: 53.48, lng: 29.69, prompt: 'Поделитесь своим фото.', preview: null, publicTravelUrl: null,
}
const fulfilled: PlaceRequest = { ...invitation, status: 'fulfilled', publicTravelUrl: '/travels/zhilichi' }

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(isPlaceRequestsPilotEnabled).mockReturnValue(true)
  jest.mocked(fetchPlaceRequests).mockResolvedValue([invitation])
  jest.mocked(fetchPlaceRequest).mockResolvedValue(invitation)
})

it('stays off on ordinary entry, fetches when toggled, and drops a closed marker after its detail read', async () => {
  jest.mocked(fetchPlaceRequest).mockResolvedValue(fulfilled)
  const { result, rerender } = await renderHook(({ focused }) => useMapPlaceRequests(focused, null), {
    initialProps: { focused: true }, wrapper: createWrapper(),
  })
  expect(result.current.overlay?.enabled).toBe(false)
  expect(result.current.layer).toBeUndefined()
  expect(fetchPlaceRequests).not.toHaveBeenCalled()
  expect(fetchPlaceRequest).not.toHaveBeenCalled()

  await act(async () => { result.current.overlay?.toggle(true) })
  await waitFor(() => expect(result.current.layer?.markers).toEqual([invitation]))
  expect(fetchPlaceRequests).toHaveBeenCalledTimes(1)
  expect(fetchPlaceRequest).not.toHaveBeenCalled()

  await act(async () => { result.current.openRequest(invitation.id) })
  await waitFor(() => expect(result.current.detailData).toEqual(fulfilled))
  expect(result.current.layer?.focus).toBeNull()
  expect(result.current.layer?.markers).toEqual([])
  await act(async () => { result.current.close() })
  expect(result.current.layer?.markers).toEqual([])

  await rerender({ focused: false })
  await rerender({ focused: true })
  expect(result.current.overlay?.enabled).toBe(false)
  expect(result.current.layer).toBeUndefined()
})

it('opens a valid link with the canonical detail coordinates', async () => {
  const canonical = { ...invitation, lat: 53.479157, lng: 29.690125 }
  jest.mocked(fetchPlaceRequest).mockResolvedValue(canonical)
  const { result } = await renderHook(() => useMapPlaceRequests(true, invitation.id), { wrapper: createWrapper() })

  expect(result.current.overlay?.enabled).toBe(true)
  expect(result.current.panel).toEqual({ requestId: invitation.id })
  await waitFor(() => expect(result.current.layer?.focus).toEqual(canonical))
  expect(fetchPlaceRequest).toHaveBeenCalledWith(invitation.id, 'ru', expect.any(AbortSignal))
  expect(result.current.layer?.markers).toEqual([canonical])

  await act(async () => { result.current.overlay?.toggle(false) })
  expect(result.current.layer).toBeUndefined()
  expect(result.current.panel).toBeNull()
})

it('discards a collection read older than a closed detail even after the card closes', async () => {
  let resolveOldList!: (items: PlaceRequest[]) => void
  let oldSignal: AbortSignal | undefined
  const oldList = new Promise<PlaceRequest[]>((resolve) => { resolveOldList = resolve })
  jest.mocked(fetchPlaceRequests)
    .mockImplementationOnce((_locale, signal) => {
      oldSignal = signal
      return oldList
    })
    .mockResolvedValueOnce([])
  jest.mocked(fetchPlaceRequest).mockResolvedValue(fulfilled)
  const { result } = await renderHook(() => useMapPlaceRequests(true, invitation.id), { wrapper: createWrapper() })

  await waitFor(() => expect(result.current.detailData).toEqual(fulfilled))
  await waitFor(() => expect(fetchPlaceRequests).toHaveBeenCalledTimes(2))
  expect(oldSignal?.aborted).toBe(true)
  await act(async () => { result.current.close() })
  await act(async () => { resolveOldList([invitation]) })
  expect(result.current.layer?.markers).toEqual([])
})

it('keeps an error in the campaign layer and retries only that list', async () => {
  jest.mocked(fetchPlaceRequests).mockRejectedValueOnce(new ApiError(403, 'Unavailable'))
  const { result } = await renderHook(() => useMapPlaceRequests(true, null), { wrapper: createWrapper() })
  await act(async () => { result.current.overlay?.toggle(true) })
  await waitFor(() => expect(result.current.listError).toBe(true))
  await act(async () => { await result.current.retryList() })
  await waitFor(() => expect(result.current.layer?.markers).toEqual([invitation]))
  expect(fetchPlaceRequests).toHaveBeenCalledTimes(2)
  expect(fetchPlaceRequest).not.toHaveBeenCalled()
})

it('keeps both reads idle when the pilot is off', async () => {
  jest.mocked(isPlaceRequestsPilotEnabled).mockReturnValue(false)
  const { result } = await renderHook(() => useMapPlaceRequests(true, invitation.id), { wrapper: createWrapper() })
  expect(result.current.overlay).toBeUndefined()
  expect(result.current.layer).toBeUndefined()
  expect(fetchPlaceRequests).not.toHaveBeenCalled()
  expect(fetchPlaceRequest).not.toHaveBeenCalled()
})
