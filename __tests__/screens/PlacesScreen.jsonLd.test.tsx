import { render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { createQueryWrapper } from '../helpers/testQueryClient'
import PlacesScreen from '@/screens/tabs/PlacesScreen'
import { fetchPlacesCatalog } from '@/api/places'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'

// #1960: клиентский ItemList `/places` отдавал краулеру `urlTravel` вместе с
// `?id=NNN` — источник URL-дублей статей в индексе (#1957).

const mockSeoProps = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useIsFocused: () => true,
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsiveWidth: () => 1280,
}))

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockSeoProps(props)
    return null
  },
}))
// ItemList строит сам экран из `visiblePlaces`; карточки (♥/статус, auth,
// брейкпоинты) к разметке отношения не имеют.
jest.mock('@/screens/tabs/PlacesScreen.parts', () => ({
  ...jest.requireActual('@/screens/tabs/PlacesScreen.parts'),
  PlaceCard: () => null,
}))
jest.mock('@/components/common/ContributionBanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/externalLinks', () => ({ openExternalUrlInNewTab: jest.fn() }))
jest.mock('@/ui/paper', () => {
  const { View } = require('react-native')
  const Menu = ({ anchor }: { anchor?: unknown }) => <View>{anchor as never}</View>
  Menu.Item = () => null
  return { Menu }
})

const makePlace = (
  over: Partial<PlacesCatalogPage['places'][number]>,
): PlacesCatalogPage['places'][number] => ({
  id: 'place-x',
  travelId: null,
  relatedTravelId: null,
  title: 'Место',
  category: 'Замок',
  categoryId: 43,
  country: 'Беларусь',
  countryCode: 'by',
  latNumber: 53.9,
  lngNumber: 27.56,
  coord: '53.9,27.56',
  lat: '53.9',
  lng: '27.56',
  address: 'Минск, Беларусь',
  categoryName: 'Замок',
  travelImageThumbUrl: '',
  urlTravel: '',
  searchText: 'место',
  rating: null,
  placeholderColor: null,
  placeholderBlurhash: null,
  ...over,
})

const catalogPage: PlacesCatalogPage = {
  count: 3,
  places: [
    makePlace({
      id: 'place-1',
      title: 'Форты Кракова',
      travelId: 435,
      relatedTravelId: 435,
      // Хост локального API и legacy `?id=` в ответе каталога.
      urlTravel: 'http://localhost:8000/travels/forty-krakova?id=435',
    }),
    makePlace({
      id: 'place-2',
      title: 'Минск за выходные',
      travelId: 646,
      relatedTravelId: 646,
      urlTravel: 'https://metravel.by/travels/minsk-za-vykhodnye?id=646#points',
    }),
    makePlace({ id: 'place-3', title: 'Без статьи', urlTravel: '' }),
  ],
  categoryFacets: [],
  countryFacets: [],
}

const readItemListJsonLd = (): string | null => {
  for (let index = mockSeoProps.mock.calls.length - 1; index >= 0; index -= 1) {
    const tags = (mockSeoProps.mock.calls[index]?.[0] as { additionalTags?: any })?.additionalTags
    const children = tags?.props?.children
    if (typeof children === 'string' && children.includes('ItemList')) return children
    const html = tags?.props?.dangerouslySetInnerHTML?.__html
    if (typeof html === 'string' && html.includes('ItemList')) return html
  }
  return null
}

describe('PlacesScreen JSON-LD (#1960)', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetchPlacesCatalog as jest.Mock).mockResolvedValue(catalogPage)
    ;(Platform as unknown as { OS: string }).OS = 'web'
  })

  afterAll(() => {
    ;(Platform as unknown as { OS: string }).OS = originalOS
  })

  it('lists canonical travel urls on the site host without ?id= or the API host', async () => {
    render(<PlacesScreen />, { wrapper: createQueryWrapper().Wrapper })

    await waitFor(() => {
      expect(readItemListJsonLd()).toContain('forty-krakova')
    })

    const html = readItemListJsonLd() ?? ''
    const data = JSON.parse(html) as { itemListElement: Array<{ url: string }> }

    expect(data.itemListElement.map((item) => item.url)).toEqual([
      'https://metravel.by/travels/forty-krakova',
      'https://metravel.by/travels/minsk-za-vykhodnye',
      'https://metravel.by/places',
    ])
    expect(html).not.toContain('?id=')
    expect(html).not.toContain('localhost')
  })

  it('declares the SSG robots verdict so Helmet keeps noindex after hydration (#1968)', async () => {
    render(<PlacesScreen />, { wrapper: createQueryWrapper().Wrapper })

    await waitFor(() => {
      expect(mockSeoProps).toHaveBeenCalled()
    })

    expect(mockSeoProps).toHaveBeenCalledWith(
      expect.objectContaining({ robots: 'noindex, follow' }),
    )
  })
})
