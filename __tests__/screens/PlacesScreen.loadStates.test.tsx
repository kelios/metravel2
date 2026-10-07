/**
 * #2184: что видит человек, когда каталог мест не ответил. Повтор запроса —
 * только ручная кнопка: молчаливые повторы после таймаута множили нагрузку на
 * бэкенд, который брошенный запрос всё равно досчитывает.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { act } from '@testing-library/react-native'
import { StyleSheet, Platform } from 'react-native'
import { createQueryWrapper } from '../helpers/testQueryClient'
import PlacesScreen from '@/screens/tabs/PlacesScreen'
import { fetchPlacesCatalog } from '@/api/places'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useIsFocused: () => true,
  useFocusEffect: () => undefined,
}))

jest.mock('@/api/places', () => ({
  fetchPlacesCatalogCategoryGroups: jest.fn(async () => ({})),
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

const mockedFetch = fetchPlacesCatalog as jest.MockedFunction<typeof fetchPlacesCatalog>

const makePlace = (index: number): PlacesCatalogPage['places'][number] => ({
  id: `place-${index}`,
  travelId: null,
  relatedTravelId: null,
  title: `Место ${index}`,
  category: 'Замок',
  categoryId: 43,
  country: 'Беларусь',
  countryCode: 'by',
  latNumber: 53.9,
  lngNumber: 27.56,
  coord: '53.9,27.56',
  lat: '53.9',
  lng: '27.56',
  address: `Минск ${index}, Беларусь`,
  categoryName: 'Замок',
  travelImageThumbUrl: '',
  urlTravel: '/travels/x',
  searchText: 'место',
  rating: null,
  placeholderColor: null,
  placeholderBlurhash: null,
})

const makePage = (from: number, size: number): PlacesCatalogPage => ({
  count: 4,
  places: Array.from({ length: size }, (_, index) => makePlace(from + index)),
  categoryFacets: [{ id: 43, name: 'Замок', count: 4 }],
  countryFacets: [{ id: null, name: 'Беларусь', count: 4 }],
})

const timeoutError = () =>
  Object.assign(new Error('Превышено время ожидания (15000ms). Попробуйте позже.'), { name: 'TimeoutError' })

const renderScreen = () => render(<PlacesScreen />, { wrapper: createQueryWrapper().Wrapper })

describe('PlacesScreen — состояния загрузки каталога (#2184)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Platform as any).OS = 'web'
  })

  it('таймаут первой загрузки: блок ошибки с честным текстом и ручным «Повторить»', async () => {
    mockedFetch.mockRejectedValueOnce(timeoutError())
    mockedFetch.mockResolvedValue(makePage(1, 4))

    const { findByText, findByLabelText, findByTestId, getByText } = renderScreen()

    expect(await findByText('Не удалось загрузить места')).toBeTruthy()
    expect(getByText(/Сервер не отвечает/)).toBeTruthy()
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    const meta = await findByTestId('places-results-meta')
    expect(meta.props.children).toBe('\u00a0')
    expect(meta.props.numberOfLines).toBe(1)
    const metaStyle = StyleSheet.flatten(meta.props.style)
    expect(metaStyle.minHeight).toBe(metaStyle.lineHeight)

    fireEvent.press(await findByLabelText('Повторить'))

    expect(await findByTestId('places-card-place-1')).toBeTruthy()
    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect((await findByTestId('places-results-meta')).props.children).toBe('4 места')
    expect(StyleSheet.flatten((await findByTestId('places-results-meta')).props.style)).toEqual(metaStyle)
  })

  it('сбой дозагрузки: карточки остаются, подвал показывает ошибку и «Повторить»', async () => {
    mockedFetch.mockImplementation(async (params) => {
      if (params.page === 1) return makePage(1, 2)
      throw timeoutError()
    })

    const { findByText, findByTestId, getByTestId, queryByTestId, queryByText } = renderScreen()

    expect(await findByTestId('places-card-place-2')).toBeTruthy()
    fireEvent.press(await findByText('Показать ещё'))

    expect(await findByText('Повторить')).toBeTruthy()
    expect(getByTestId('places-load-more')).toBeTruthy()
    expect(queryByText('Не удалось загрузить места')).toBeTruthy()
    // Загруженные карточки не заменяются блоком ошибки на весь список.
    expect(getByTestId('places-card-place-1')).toBeTruthy()
    expect(mockedFetch).toHaveBeenCalledTimes(2)

    mockedFetch.mockImplementation(async () => makePage(3, 2))
    fireEvent.press(await findByText('Повторить'))

    expect(await findByTestId('places-card-place-4')).toBeTruthy()
    // Повторилась одна несостоявшаяся страница, первая заново не запрашивалась.
    expect(mockedFetch).toHaveBeenCalledTimes(3)
    expect(mockedFetch.mock.calls[2][0]).toMatchObject({ page: 2 })
    await waitFor(() => expect(queryByTestId('places-load-more')).toBeNull())
  })
})


it('loading, legitimate empty success and refreshing keep the same reserved meta line without stale counts', async () => {
  mockedFetch.mockReset()
  ;(Platform as any).OS = 'web'
  jest.useFakeTimers()
  let resolve!: (page: PlacesCatalogPage) => void
  mockedFetch.mockReturnValueOnce(new Promise((res) => { resolve = res }))
  const screen = renderScreen()
  const initial = screen.getByTestId('places-results-meta')
  const geometry = StyleSheet.flatten(initial.props.style)
  expect(initial.props.children).toBe('Загружаем подборку...')
  try {
    await act(async () => { resolve({ ...makePage(1, 0), count: 0 }); await jest.advanceTimersByTimeAsync(1) })
    await act(async () => { await jest.advanceTimersByTimeAsync(1) })
    expect(screen.getByTestId('places-results-meta').props.children).toBe('0 мест')
    mockedFetch.mockReturnValue(new Promise(() => undefined))
    fireEvent.changeText(screen.getAllByLabelText('Найти место')[0], 'замок')
    expect(screen.getByTestId('places-results-meta').props.children).toBe('Загружаем подборку...')
    expect(screen.getByTestId('places-results-meta').props.numberOfLines).toBe(1)
    expect(StyleSheet.flatten(screen.getByTestId('places-results-meta').props.style)).toEqual(geometry)
    expect(geometry.minHeight).toBe(geometry.lineHeight)
  } finally { screen.unmount(); jest.useRealTimers() }
})
