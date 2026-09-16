import { act, renderHook } from '@testing-library/react-native'

import { useAddressListItemActions } from '@/hooks/useAddressListItemActions'
import type { TravelCoords } from '@/types/types'

// #1960: точка, сохранённая из списка карты, несёт id статьи рядом со ссылкой,
// чтобы попап «Моих точек» не разбирал url и не запрашивал статью по slug.

const mockCreatePoint = jest.fn()

jest.mock('@/context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ isAuthenticated: true, authReady: true }),
}))

jest.mock('@/hooks/map/useSavedPointToggle', () => ({
  useSavedPointToggle: () => ({
    isSaved: false,
    isReady: true,
    removeSaved: jest.fn(),
    createPoint: (...args: unknown[]) => mockCreatePoint(...args),
  }),
}))

jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(),
  openExternalUrlInNewTab: jest.fn(),
}))

const baseTravel: TravelCoords = {
  address: 'Форты Кракова, Краков, Польша',
  categoryName: 'Крепость',
  coord: '50.0619,19.9368',
  lat: '50.0619',
  lng: '19.9368',
  travelImageThumbUrl: 'https://metravel.by/address-image/1/thumb.webp',
  urlTravel: 'https://metravel.by/travels/forty-krakova',
  articleUrl: 'https://metravel.by/travels/forty-krakova',
  primarySource: {
    sourceId: 'travel-address:1',
    pointId: 1,
    travelId: 435,
    articleTitle: 'Форты Кракова',
    articleUrl: 'https://metravel.by/travels/forty-krakova',
    thumbnailUrl: null,
    thumbnailWidth: null,
    thumbnailHeight: null,
  },
}

const savePoint = async (travel: TravelCoords) => {
  const { result } = renderHook(() => useAddressListItemActions(travel))
  await act(async () => {
    await result.current.handleAddPoint()
  })
  return mockCreatePoint.mock.calls.at(-1)?.[0] as { tags?: Record<string, unknown> } | undefined
}

describe('useAddressListItemActions save payload tags (#1960)', () => {
  beforeEach(() => {
    mockCreatePoint.mockReset()
    mockCreatePoint.mockResolvedValue({ id: 1 })
  })

  it('stores the API travel id next to the travel url', async () => {
    const payload = await savePoint(baseTravel)

    expect(payload?.tags).toEqual({
      travelUrl: 'https://metravel.by/travels/forty-krakova',
      travelId: 435,
      articleUrl: 'https://metravel.by/travels/forty-krakova',
    })
  })

  it('does not invent an id when the API gave none', async () => {
    const payload = await savePoint({ ...baseTravel, primarySource: null })

    expect(payload?.tags).toEqual({
      travelUrl: 'https://metravel.by/travels/forty-krakova',
      articleUrl: 'https://metravel.by/travels/forty-krakova',
    })
  })

  it('does not store a dangling id without a travel url', async () => {
    const payload = await savePoint({ ...baseTravel, urlTravel: '', articleUrl: undefined })

    expect(payload?.tags).toBeUndefined()
  })
})
