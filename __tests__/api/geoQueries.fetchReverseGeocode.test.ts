// LC-2: императивный геокод (`fetchReverseGeocode`) работает через ТОТ ЖЕ
// клиент, что смонтирован в React-дереве, а не через отдельный модульный
// синглтон: иначе хук и императивный вызов геокодили одну точку дважды, а
// кэш синглтона не чистился на смене владельца сессии.

import { QueryClient } from '@tanstack/react-query'
import { setActiveQueryClient } from '@/api/activeQueryClient'
import { queryKeys } from '@/api/queryKeys'
import { __resetGeoQueryClientForTests, fetchReverseGeocode } from '@/api/geoQueries'
import { nominatimReverse } from '@/api/external/nominatim'
import { getActiveLocale } from '@/i18n'

jest.mock('@/api/external/nominatim', () => ({
  nominatimReverse: jest.fn(),
  nominatimSearch: jest.fn(),
}))
jest.mock('@/api/external/bigdatacloud', () => ({
  bigDataCloudReverse: jest.fn(),
}))

const mockedNominatim = nominatimReverse as jest.Mock

const jsonResponse = (payload: unknown) => ({ ok: true, json: async () => payload }) as Response

describe('fetchReverseGeocode uses the mounted QueryClient (LC-2)', () => {
  beforeEach(() => {
    mockedNominatim.mockReset()
    mockedNominatim.mockResolvedValue(jsonResponse({ name: 'Zadział', address: { country: 'Polska' } }))
    setActiveQueryClient(null)
    __resetGeoQueryClientForTests()
  })

  afterEach(() => {
    setActiveQueryClient(null)
    __resetGeoQueryClientForTests()
  })

  it('writes into the mounted client cache under the hook key', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    setActiveQueryClient(client)

    const result = await fetchReverseGeocode(49.1, 19.1)

    expect(result).toMatchObject({ name: 'Zadział' })
    expect(client.getQueryData(queryKeys.reverseGeocode(49.1, 19.1, getActiveLocale()))).toMatchObject({
      name: 'Zadział',
    })
  })

  it('dedupes with data the mounted client already holds: no second network call', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    setActiveQueryClient(client)
    client.setQueryData(queryKeys.reverseGeocode(49.2, 19.2, getActiveLocale()), {
      name: 'Cached',
      address: {},
    })

    const result = await fetchReverseGeocode(49.2, 19.2)

    expect(result).toMatchObject({ name: 'Cached' })
    expect(mockedNominatim).not.toHaveBeenCalled()
  })

  it('falls back to a lazy client before the layout mounts, without a static prefetch', async () => {
    const originalRequestIdleCallback = (window as any).requestIdleCallback
    const requestIdleCallback = jest.fn(() => 1)
    ;(window as any).requestIdleCallback = requestIdleCallback
    try {
      await expect(fetchReverseGeocode(49.3, 19.3)).resolves.toMatchObject({ name: 'Zadział' })
      expect(requestIdleCallback).not.toHaveBeenCalled()
    } finally {
      if (originalRequestIdleCallback === undefined) delete (window as any).requestIdleCallback
      else (window as any).requestIdleCallback = originalRequestIdleCallback
    }
  })
})
