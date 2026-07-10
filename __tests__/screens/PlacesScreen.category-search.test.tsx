import { fireEvent, render, within } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { createQueryWrapper } from '../helpers/testQueryClient'
import PlacesScreen from '@/screens/tabs/PlacesScreen'
import { fetchPlacesCatalog } from '@/api/places'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'

const mockPush = jest.fn()
const mockSetParams = jest.fn()
let mockParams: Record<string, string | undefined> = {}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    push: mockPush,
    setParams: mockSetParams,
  }),
  useIsFocused: () => true,
}))

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
}))

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/common/ContributionBanner', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(() => Promise.resolve(true)),
}))

jest.mock('@/ui/paper', () => {
  const React = require('react')
  const { View, Text, Pressable } = require('react-native')

  const Menu = ({ children, anchor }: any) => (
    <View>
      {anchor}
      {children}
    </View>
  )

  Menu.Item = ({ title, onPress }: any) => (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  )

  return { Menu }
})

const mockedFetchPlacesCatalog = fetchPlacesCatalog as jest.MockedFunction<typeof fetchPlacesCatalog>

const makePlace = (over: Partial<PlacesCatalogPage['places'][number]>): PlacesCatalogPage['places'][number] => ({
  id: 'place-x',
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
  urlTravel: '/travels/x',
  searchText: 'место',
  ...over,
})

const catalogPage: PlacesCatalogPage = {
  count: 2,
  places: [
    makePlace({
      id: 'place-1',
      title: 'Парковка у озера',
      category: 'Парковка',
      categoryName: 'Парковка',
      address: 'Минск, Беларусь',
      coord: '53.9,27.56',
      lat: '53.9',
      lng: '27.56',
      latNumber: 53.9,
      lngNumber: 27.56,
      urlTravel: '/travels/parking',
    }),
    makePlace({
      id: 'place-2',
      title: 'Старый замок',
      category: 'Замок',
      categoryName: 'Замок',
      address: 'Гродно, Беларусь',
      coord: '53.68,23.83',
      lat: '53.68',
      lng: '23.83',
      latNumber: 53.68,
      lngNumber: 23.83,
      urlTravel: '/travels/castle',
    }),
  ],
  categoryFacets: [
    { id: 10, name: 'Парковка', count: 1 },
    { id: 43, name: 'Замок', count: 1 },
  ],
  countryFacets: [{ id: null, name: 'Беларусь', count: 2 }],
}

describe('PlacesScreen category search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockParams = { category: '' }
    ;(Platform as any).OS = 'web'
    mockedFetchPlacesCatalog.mockResolvedValue(catalogPage)
  })

  it('filters manual category chips and keeps selection working', async () => {
    const { findByTestId, queryByTestId } = render(<PlacesScreen />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    expect(await findByTestId('places-category-chip-Парковка')).toBeTruthy()
    expect(await findByTestId('places-category-chip-Замок')).toBeTruthy()

    fireEvent.changeText(await findByTestId('places-category-search-input'), 'зам')

    const castleChip = await findByTestId('places-category-chip-Замок')
    expect(castleChip).toBeTruthy()
    expect(queryByTestId('places-category-chip-Парковка')).toBeNull()

    fireEvent.press(castleChip)

    expect(mockSetParams).toHaveBeenCalledWith({ category: 'Замок' })
  })

  it('toggles multiple category chips into a CSV category param (OR multi-select)', async () => {
    const { findByTestId } = render(<PlacesScreen />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    fireEvent.press(await findByTestId('places-category-chip-Замок'))
    expect(mockSetParams).toHaveBeenLastCalledWith({ category: 'Замок' })

    fireEvent.press(await findByTestId('places-category-chip-Парковка'))
    expect(mockSetParams).toHaveBeenLastCalledWith({ category: 'Замок,Парковка' })

    // The catalog list request carries both categories, not just the last one.
    const multiCall = mockedFetchPlacesCatalog.mock.calls.find(
      ([params]) =>
        Array.isArray(params.categories) &&
        params.categories.includes('Замок') &&
        params.categories.includes('Парковка'),
    )
    expect(multiCall).toBeTruthy()
  })

  it('renders the "Интересные подборки" collections and selects one', async () => {
    const { findByTestId } = render(<PlacesScreen />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    const featured = await findByTestId('places-collection-nature')
    fireEvent.press(featured)

    const lastCall = mockSetParams.mock.calls.at(-1)?.[0]
    expect(String(lastCall?.category)).toContain('Озеро')
    expect(String(lastCall?.category)).toContain('Река')
  })

  it('shows an empty state when no category matches the query', async () => {
    const { findByTestId } = render(<PlacesScreen />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    fireEvent.changeText(await findByTestId('places-category-search-input'), 'аэродром')

    expect(await findByTestId('places-category-search-empty')).toBeTruthy()
  })

  it('opens selected place on map and exposes navigator actions on the card', async () => {
    const { findAllByLabelText, findByTestId } = render(<PlacesScreen />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    const placeCard = await findByTestId('places-card-place-1')
    fireEvent.press(placeCard)

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/map',
      params: {
        lat: '53.9',
        lng: '27.56',
        radius: '5',
        categories: 'Парковка',
        placeId: 'place-1',
        placeTitle: 'Парковка у озера',
        placeAddress: 'Минск, Беларусь',
        placeCategory: 'Парковка',
        placeTravelUrl: '/travels/parking',
        placeImageUrl: '',
      },
    })

    mockPush.mockClear()
    expect(within(placeCard).getByText('На карте')).toBeTruthy()
    fireEvent.press(within(placeCard).getByLabelText('Открыть место на карте'))

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/map',
      params: {
        lat: '53.9',
        lng: '27.56',
        radius: '5',
        categories: 'Парковка',
        placeId: 'place-1',
        placeTitle: 'Парковка у озера',
        placeAddress: 'Минск, Беларусь',
        placeCategory: 'Парковка',
        placeTravelUrl: '/travels/parking',
        placeImageUrl: '',
      },
    })

    // На компактной карточке navigator-действия живут за overflow-шитом
    // «Навигация и действия» — открываем его для этой карточки перед проверкой.
    fireEvent.press(within(placeCard).getByLabelText('Навигация и действия'))

    const organicButtons = await findAllByLabelText('Открыть точку в Organic Maps')
    fireEvent.press(organicButtons[0])

    expect(openExternalUrlInNewTab).toHaveBeenCalledWith(
      'https://omaps.app/map?v=1&ll=53.9,27.56&n=%D0%9F%D0%B0%D1%80%D0%BA%D0%BE%D0%B2%D0%BA%D0%B0%20%D1%83%20%D0%BE%D0%B7%D0%B5%D1%80%D0%B0',
    )
  })
})
