import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import QuestsMapSection from '@/screens/tabs/QuestsMapSection'
import type { QuestMeta } from '@/utils/questAdapters'

const mockWebMap = jest.fn((_props: Record<string, unknown>) => null)
const mockNativeMap = jest.fn((_props: Record<string, unknown>) => null)
const mockRouterPush = jest.fn()

jest.mock('@expo/vector-icons/Feather', () => 'Feather')
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockRouterPush }) }))
// One `Map` import serves both platforms (Metro resolves it to Map.web on web);
// the mock records which platform rendered it.
jest.mock('@/components/MapPage/Map', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    require('react-native').Platform.OS === 'web' ? mockWebMap(props) : mockNativeMap(props),
}))

const colors = {
  primary: '#222',
  textOnPrimary: '#fff',
  warning: '#d97706',
} as never

const makeQuest = (id: string, lat: number, lng: number): QuestMeta => ({
  id,
  numericId: 1,
  title: `Quest ${id}`,
  points: 3,
  cityId: 'warsaw',
  cityName: 'Warsaw',
  lat,
  lng,
  durationMin: 60,
  difficulty: 'easy',
  cover: `https://cdn.example.com/${id}.jpg`,
  ratingAvg: null,
  ratingCount: 0,
  completionsCount: 0,
  viewsCount: 0,
  isCompletedByMe: false,
  firstCompleter: null,
  contentLocale: 'ru',
  availableLocales: ['ru'],
})

const makeProps = (): React.ComponentProps<typeof QuestsMapSection> => ({
  loadingStyle: {},
  colors,
  screenWidth: 1440,
  screenHeight: 900,
  dataLoaded: true,
  quests: [makeQuest('old-town', 52.25, 21.01)],
  cities: [{ id: 'warsaw', name: 'Warsaw', lat: 52.23, lng: 21.0 }],
  selectedCityId: 'warsaw',
  searchTerm: '',
  centerOnQuests: false,
  userLoc: null,
  activeMapAreaCenter: null,
  showMapAreaSearch: false,
  onSearchMapArea: () => {},
  onUserLocationChange: () => {},
  onMapMove: () => {},
})

const lastMapProps = () => mockWebMap.mock.calls[mockWebMap.mock.calls.length - 1]?.[0]

describe('QuestsMapSection', () => {
  beforeEach(() => {
    ;(Platform as { OS: string }).OS = 'web'
    mockWebMap.mockClear()
    mockNativeMap.mockClear()
    mockRouterPush.mockClear()
  })

  it('turns the quests into map points and centres on the selected city', async () => {
    await render(<QuestsMapSection {...makeProps()} />)

    await waitFor(() => expect(mockWebMap).toHaveBeenCalled())
    expect(lastMapProps()).toEqual(
      expect.objectContaining({
        coordinates: { latitude: 52.23, longitude: 21.0 },
        userLocation: null,
        showRadiusCircle: false,
        travel: {
          data: [
            expect.objectContaining({
              id: 'old-town',
              coord: '52.25,21.01',
              categoryName: 'Квест',
              urlTravel: expect.stringContaining('/quests/warsaw/old-town'),
              questMeta: expect.objectContaining({ id: 'old-town', cityId: 'warsaw' }),
            }),
          ],
        },
      }),
    )
  })

  it('centres a slice without its own city on the average of its quests', async () => {
    await render(
      <QuestsMapSection
        {...makeProps()}
        selectedCityId="__kids__"
        centerOnQuests
        quests={[makeQuest('a', 52, 21), makeQuest('b', 54, 23)]}
      />,
    )

    await waitFor(() => expect(mockWebMap).toHaveBeenCalled())
    expect(lastMapProps()).toEqual(
      expect.objectContaining({ coordinates: { latitude: 53, longitude: 22 } }),
    )
  })

  it('shows a geolocation-disabled banner for «nearby» without a location', async () => {
    const { getByTestId, getByText } = await render(
      <QuestsMapSection {...makeProps()} selectedCityId="__nearby__" />,
    )

    expect(getByTestId('quests-geo-banner')).toBeTruthy()
    expect(getByText('Геолокация отключена. Показываем все квесты на карте.')).toBeTruthy()
    await waitFor(() => expect(mockWebMap).toHaveBeenCalled())
  })

  it('passes the real user location marker to the map', async () => {
    const { queryByTestId } = await render(
      <QuestsMapSection {...makeProps()} selectedCityId="__nearby__" userLoc={{ lat: 53.91, lng: 27.57 }} />,
    )

    expect(queryByTestId('quests-geo-banner')).toBeNull()
    await waitFor(() => expect(mockWebMap).toHaveBeenCalled())
    expect(lastMapProps()).toEqual(
      expect.objectContaining({
        userLocation: { latitude: 53.91, longitude: 27.57 },
        showRadiusCircle: false,
      }),
    )
  })

  it('keeps the map mounted with zero results', async () => {
    await render(
      <QuestsMapSection
        {...makeProps()}
        quests={[]}
        activeMapAreaCenter={{ latitude: 52.2, longitude: 21.0 }}
      />,
    )

    await waitFor(() => expect(mockWebMap).toHaveBeenCalled())
    expect(lastMapProps()).toEqual(
      expect.objectContaining({
        travel: { data: [] },
        coordinates: { latitude: 52.2, longitude: 21.0 },
      }),
    )
  })

  it('shows the search-this-area action and forwards map moves', async () => {
    const onMapMove = jest.fn()
    const onSearchMapArea = jest.fn()
    const { getByTestId } = await render(
      <QuestsMapSection
        {...makeProps()}
        showMapAreaSearch
        onMapMove={onMapMove}
        onSearchMapArea={onSearchMapArea}
      />,
    )

    await fireEvent.press(getByTestId('quests-map-search-area'))
    expect(onSearchMapArea).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockWebMap).toHaveBeenCalled())
    expect(lastMapProps()).toEqual(expect.objectContaining({ onMapMove }))
  })

  it('renders the native map without the web chunk and opens a quest from its marker', async () => {
    ;(Platform as { OS: string }).OS = 'android'
    await render(<QuestsMapSection {...makeProps()} />)

    expect(mockWebMap).not.toHaveBeenCalled()
    const nativeProps = mockNativeMap.mock.calls[mockNativeMap.mock.calls.length - 1]?.[0] as {
      onMarkerSelect: (point?: { questMeta?: { id: string; cityId: string } }) => void
    }
    nativeProps.onMarkerSelect({ questMeta: { id: 'old-town', cityId: 'warsaw' } })
    expect(mockRouterPush).toHaveBeenCalledWith('/quests/warsaw/old-town')

    nativeProps.onMarkerSelect({})
    expect(mockRouterPush).toHaveBeenCalledTimes(1)
  })

  it('shows only the loader until the catalog is loaded', async () => {
    const { queryByTestId } = await render(
      <QuestsMapSection {...makeProps()} dataLoaded={false} selectedCityId="__nearby__" />,
    )

    expect(queryByTestId('quests-geo-banner')).toBeNull()
    expect(mockWebMap).not.toHaveBeenCalled()
  })
})
