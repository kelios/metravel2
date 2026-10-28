import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useAddressListItemActions } from '@/hooks/useAddressListItemActions'
import type { TravelCoords } from '@/types/types'

// #1960: точка, сохранённая из списка карты, несёт id статьи рядом со ссылкой,
// чтобы попап «Моих точек» не разбирал url и не запрашивал статью по slug.

const mockCreatePoint = jest.fn()

let mockIsAuthenticated = true
const mockRouterPush = jest.fn()

jest.mock('@/context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated, authReady: true }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }),
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
  const { result } = await renderHook(() => useAddressListItemActions(travel))
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

// #2778: у гостя «Сохранить» не серая и не тост — ведёт ко входу с возвратом.
describe('useAddressListItemActions guest save (#2778)', () => {
  afterEach(() => {
    mockIsAuthenticated = true
    mockRouterPush.mockClear()
    mockCreatePoint.mockClear()
  })

  it('sends a guest to login with the save intent and creates nothing', async () => {
    mockIsAuthenticated = false
    await savePoint(baseTravel)
    expect(mockCreatePoint).not.toHaveBeenCalled()
    // На native возврат — на карту (`fallbackRedirect`), на web — текущий адрес.
    expect(mockRouterPush).toHaveBeenCalledWith(
      Platform.OS === 'web'
        ? expect.stringMatching(/^\/login\?redirect=.*&intent=save-point$/)
        : '/login?redirect=%2Fmap&intent=save-point',
    )
  })
})
