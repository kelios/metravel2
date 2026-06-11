import { fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { createQueryWrapper } from '../helpers/testQueryClient'
import PlacesScreen from '@/screens/tabs/PlacesScreen'
import { fetchPlacesCatalog } from '@/api/places'

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

const placesFixture = [
  {
    id: 'place-1',
    name: 'Парковка у озера',
    title: 'Парковка у озера',
    address: 'Минск, Беларусь',
    categoryName: 'Парковка',
    category: 'Парковка',
    countryName: 'Беларусь',
    country: 'Беларусь',
    coord: '53.9,27.56',
    latNumber: 53.9,
    lngNumber: 27.56,
    urlTravel: '/travels/parking',
    searchText: 'парковка у озера минск беларусь парковка беларусь',
  },
  {
    id: 'place-2',
    name: 'Старый замок',
    title: 'Старый замок',
    address: 'Гродно, Беларусь',
    categoryName: 'Замок',
    category: 'Замок',
    countryName: 'Беларусь',
    country: 'Беларусь',
    coord: '53.68,23.83',
    latNumber: 53.68,
    lngNumber: 23.83,
    urlTravel: '/travels/castle',
    searchText: 'старый замок гродно беларусь замок беларусь',
  },
]

describe('PlacesScreen category search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockParams = { category: '' }
    ;(Platform as any).OS = 'web'
    mockedFetchPlacesCatalog.mockResolvedValue(placesFixture as any)
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

  it('shows an empty state when no category matches the query', async () => {
    const { findByTestId } = render(<PlacesScreen />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    fireEvent.changeText(await findByTestId('places-category-search-input'), 'аэродром')

    expect(await findByTestId('places-category-search-empty')).toBeTruthy()
  })
})
