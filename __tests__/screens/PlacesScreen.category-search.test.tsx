import { act } from 'react'
import { fireEvent, render, within } from '@testing-library/react-native'
import { createRootRegistry } from '../helpers/rawRootLifecycle'
import { Platform } from 'react-native'
import { createQueryWrapper } from '../helpers/testQueryClient'
import PlacesScreen from '@/screens/tabs/PlacesScreen'
import { fetchPlacesCatalog } from '@/api/places'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'
import { useAuthStore } from '@/stores/authStore'

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
  useFocusEffect: () => undefined,
}))

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
  fetchPlacesCatalogCategoryGroups: jest.fn(async () => ({})),
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
  travelId: null,
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
      // #1960: deep-link «На карте» берёт id статьи из `travelId`. `relatedTravelId`
      // карточки здесь не задаём — стек ♥/статуса не предмет этого набора.
      travelId: 646,
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

// Web owns an actual HTML heading; native cases continue through strict RNTL.
const webRoots = createRootRegistry()
const webQueryClients: ReturnType<typeof createQueryWrapper>['queryClient'][] = []
const renderWebScreen = async () => {
  const root = webRoots.createRoot()
  const { Wrapper, queryClient } = createQueryWrapper()
  webQueryClients.push(queryClient)
  await act(() => root.render(<Wrapper><PlacesScreen /></Wrapper>))
  return root
}
afterEach(async () => {
  await webRoots.cleanup()
  webQueryClients.splice(0).forEach((client) => client.clear())
})

describe('PlacesScreen category search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockParams = { category: '' }
    ;(Platform as any).OS = 'web'
    mockedFetchPlacesCatalog.mockResolvedValue(catalogPage)
  })

  it('filters manual category chips and keeps selection working', async () => {
    const root = await renderWebScreen()
    const { findByTestId, queryByTestId } = within(root.container)

    expect(await findByTestId('places-category-chip-Парковка')).toBeTruthy()
    expect(await findByTestId('places-category-chip-Замок')).toBeTruthy()

    const categoryInput = await findByTestId('places-category-search-input')
    await act(() => categoryInput.props.onChangeText('зам'))

    const castleChip = await findByTestId('places-category-chip-Замок')
    expect(castleChip).toBeTruthy()
    expect(queryByTestId('places-category-chip-Парковка')).toBeNull()

    await act(() => castleChip.props.onPress())

    expect(mockSetParams).toHaveBeenCalledWith({ category: 'Замок' })
  })

  it('toggles multiple category chips into a CSV category param (OR multi-select)', async () => {
    const root = await renderWebScreen()
    const { findByTestId } = within(root.container)

    const castle = await findByTestId('places-category-chip-Замок')
    await act(() => castle.props.onPress())
    expect(mockSetParams).toHaveBeenLastCalledWith({ category: 'Замок' })

    const parking = await findByTestId('places-category-chip-Парковка')
    await act(() => parking.props.onPress())
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
    const root = await renderWebScreen()
    const { findByTestId } = within(root.container)

    const featured = await findByTestId('places-collection-nature')
    await act(() => featured.props.onPress())

    const lastCall = mockSetParams.mock.calls.at(-1)?.[0]
    expect(String(lastCall?.category)).toContain('Озеро')
    expect(String(lastCall?.category)).toContain('Река')
  })

  it('restores the Read action on place cards and keeps the internal article route', async () => {
    const root = await renderWebScreen()
    const { findAllByText, getAllByLabelText, queryByText } = within(root.container)
    const readActions = await findAllByText('Прочитать')
    expect(queryByText('Статья')).toBeNull()
    expect(readActions.length).toBeGreaterThan(0)
    const readControl = getAllByLabelText('Открыть статью')[0]
    await act(() => readControl.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/travels/parking')
  })

  it('shows an empty state when no category matches the query', async () => {
    const root = await renderWebScreen()
    const { findByTestId } = within(root.container)

    const categoryInput = await findByTestId('places-category-search-input')
    await act(() => categoryInput.props.onChangeText('аэродром'))

    expect(await findByTestId('places-category-search-empty')).toBeTruthy()
  })

  // #2778: у гостя «Сохранить» активна и ведёт на вход; на native после входа —
  // обратно в каталог `/places`, а не на главную.
  it('sends a guest from «Сохранить» to login and back to /places', async () => {
    ;(Platform as any).OS = 'ios'
    const prev = useAuthStore.getState()
    useAuthStore.setState({ isAuthenticated: false, authReady: true } as any)
    try {
      const { findByTestId } = await render(<PlacesScreen />, {
        wrapper: createQueryWrapper().Wrapper,
      })
      const placeCard = await findByTestId('places-card-place-1')
      await fireEvent.press(within(placeCard).getByLabelText('Сохранить'))
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Fplaces&intent=save-point')
    } finally {
      useAuthStore.setState({ isAuthenticated: prev.isAuthenticated, authReady: prev.authReady } as any)
    }
  })

  it('opens selected place on map and exposes navigator actions on the card', async () => {
    const root = await renderWebScreen()
    const { findAllByLabelText, findByLabelText, findByTestId } = within(root.container)

    const placeCard = await findByTestId('places-card-place-1')
    await act(() => placeCard.props.onClick())

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/map',
      params: {
        lat: '53.9',
        lng: '27.56',
        radius: '5',
        focusPlace: '1',
        placeId: 'place-1',
        placeTitle: 'Парковка у озера',
        placeAddress: 'Минск, Беларусь',
        placeCategory: 'Парковка',
        placeTravelUrl: '/travels/parking',
        // #1960: id статьи идёт в deep-link рядом с url, карта не запрашивает её по slug.
        placeTravelId: '646',
        placeImageUrl: '',
      },
    })

    mockPush.mockClear()
    // Карточка называет МЕСТО (головной сегмент адреса), а не статью, из которой
    // точка пришла: иначе все точки одного путешествия выглядят одинаково.
    expect(within(placeCard).getByText('Минск')).toBeTruthy()
    expect(within(placeCard).queryByText('Парковка у озера')).toBeNull()
    // #2778: в ряду три плитки — «Прочитать», «Сохранить», «Навигация»; «На
    // карте» (то же, что тап по карточке) — пункт листа «Навигация и действия».
    expect(within(placeCard).getByText('Прочитать')).toBeTruthy()
    expect(within(placeCard).getByText('Сохранить')).toBeTruthy()
    expect(within(placeCard).queryByText('На карте')).toBeNull()
    const navigationControl = within(placeCard).getByLabelText('Навигация и действия')
    await act(() => navigationControl.props.onPress())
    const openMapControl = await findByLabelText('Открыть место на карте')
    await act(() => openMapControl.props.onPress())

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/map',
      params: {
        lat: '53.9',
        lng: '27.56',
        radius: '5',
        focusPlace: '1',
        placeId: 'place-1',
        placeTitle: 'Парковка у озера',
        placeAddress: 'Минск, Беларусь',
        placeCategory: 'Парковка',
        placeTravelUrl: '/travels/parking',
        // #1960: id статьи идёт в deep-link рядом с url, карта не запрашивает её по slug.
        placeTravelId: '646',
        placeImageUrl: '',
      },
    })

    // На компактной карточке navigator-действия живут за overflow-шитом
    // «Навигация и действия» — открываем его для этой карточки перед проверкой.
    await act(() => navigationControl.props.onPress())

    const organicButtons = await findAllByLabelText('Открыть точку в Organic Maps')
    await act(() => organicButtons[0].props.onPress())

    expect(openExternalUrlInNewTab).toHaveBeenCalledWith(
      'https://omaps.app/map?v=1&ll=53.9,27.56&n=%D0%9F%D0%B0%D1%80%D0%BA%D0%BE%D0%B2%D0%BA%D0%B0%20%D1%83%20%D0%BE%D0%B7%D0%B5%D1%80%D0%B0',
    )
  })
})
