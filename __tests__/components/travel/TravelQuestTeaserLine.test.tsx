import type { ReactNode } from 'react'
import { View } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient'
import type { ApiQuestMeta } from '@/api/quests'
import QuestForCitySection from '@/components/travel/details/sections/QuestForCitySection'
import TravelQuestTeaserLine from '@/components/travel/details/sections/TravelQuestTeaserLine'
import type { Travel } from '@/types/types'
import { trackQuestCardClicked } from '@/utils/growthFunnelAnalytics'

const mockFetchQuestsNearLocation = jest.fn()

jest.mock('@/api/quests', () => ({
  fetchQuestsNearLocation: (...args: unknown[]) => mockFetchQuestsNearLocation(...args),
  fetchQuestsList: jest.fn(() => Promise.resolve([])),
}))
jest.mock('@/utils/growthFunnelAnalytics', () => ({ trackQuestCardClicked: jest.fn() }))
jest.mock('@/components/travel/details/sections/QuestForCityMatches', () => ({
  QuestForCityMatches: ({ matches }: { matches: unknown[] }) => {
    const { Text } = require('react-native')
    return <Text testID="full-quest-block">{`cards:${matches.length}`}</Text>
  },
}))
jest.mock('expo-router', () => {
  const mockReact = require('react')
  return {
    router: { push: jest.fn() },
    Link: ({ href, asChild, children, ...props }: any) => (asChild
      ? mockReact.cloneElement(mockReact.Children.only(children), { ...props, href })
      : mockReact.createElement('a', { ...props, href }, children)),
  }
})

const apiQuest = (questId: string, overrides: Partial<ApiQuestMeta> = {}): ApiQuestMeta => ({
  id: 1,
  quest_id: questId,
  title: questId,
  points: '9',
  city_id: '11',
  city_name: 'Гродно',
  city_alias: 'grodno',
  country_id: null,
  country_name: 'Беларусь',
  country_code: 'by',
  lat: '53.67',
  lng: '23.83',
  duration_min: 90,
  difficulty: 'easy',
  tags: null,
  pet_friendly: true,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
  ...overrides,
} as ApiQuestMeta)

const nearLocation = (quests: ApiQuestMeta[]) => quests.map((quest) => ({ quest, score: 160, distance_km: 0.4 }))

const travel = {
  id: 42,
  slug: 'grodno-za-1-den',
  cityName: 'Гродно',
  countryName: 'Беларусь',
  countryCode: 'BY',
  travelAddress: [{ coord: '53.6694,23.8131' }],
} as unknown as Travel

const renderWithClient = (ui: ReactNode) => {
  const queryClient = createTestQueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

// Вариант приложения: подбора в загрузчике нет, строка читает тот же запрос,
// что и полный блок квестов под текстом.
describe('TravelQuestTeaserLine в приложении (#3221)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shares one request with the full quest block instead of making its own', async () => {
    mockFetchQuestsNearLocation.mockResolvedValue(nearLocation([apiQuest('grodno-royal'), apiQuest('grodno-castles')]))

    await renderWithClient(
      <View>
        <TravelQuestTeaserLine travel={travel} />
        <QuestForCitySection travel={travel} styles={{}} />
      </View>,
    )

    expect(await screen.findByText('Гродно: 2 бесплатных квеста-прогулки')).toBeTruthy()
    expect(screen.getByTestId('full-quest-block').props.children).toBe('cards:2')
    expect(screen.getByTestId('travel-quest-teaser').props.href).toBe('/quests/grodno')
    expect(mockFetchQuestsNearLocation).toHaveBeenCalledTimes(1)
  })

  // #3327: когда выдача знает число квестов всего города, приложение пишет его.
  it('states the city total once the response carries city_quest_count', async () => {
    mockFetchQuestsNearLocation.mockResolvedValue(nearLocation([apiQuest('grodno-royal', { city_quest_count: 8 })]))

    await renderWithClient(<TravelQuestTeaserLine travel={travel} />)

    expect(await screen.findByText('Гродно: 8 бесплатных квестов-прогулок')).toBeTruthy()
    expect(screen.getByTestId('travel-quest-teaser').props.href).toBe('/quests/grodno')
  })

  // У большинства статей квестов рядом нет: резерв на время запроса сдвигал бы
  // их текст при каждом открытии (#2772), поэтому до ответа строка места не занимает.
  it('takes no space while the request is in flight and appears only with quests', async () => {
    let resolveRequest: (value: unknown) => void = () => {}
    mockFetchQuestsNearLocation.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))

    const view = await renderWithClient(<TravelQuestTeaserLine travel={travel} />)

    await waitFor(() => expect(mockFetchQuestsNearLocation).toHaveBeenCalledTimes(1))
    expect(view.toJSON()).toBeNull()

    resolveRequest(nearLocation([apiQuest('grodno-royal')]))

    expect(await screen.findByText('Гродно: 1 бесплатный квест-прогулка')).toBeTruthy()
    expect(screen.getByTestId('travel-quest-teaser').props.href).toBe('/quests/11/grodno-royal')
  })

  it('renders nothing at any point for an article without quests nearby', async () => {
    mockFetchQuestsNearLocation.mockResolvedValue([])

    const view = await renderWithClient(<TravelQuestTeaserLine travel={travel} />)

    expect(view.toJSON()).toBeNull()
    await waitFor(() => expect(mockFetchQuestsNearLocation).toHaveBeenCalledTimes(1))
    expect(view.toJSON()).toBeNull()
  })

  it('renders nothing when the request fails', async () => {
    mockFetchQuestsNearLocation.mockRejectedValue(new Error('network'))

    const view = await renderWithClient(<TravelQuestTeaserLine travel={travel} />)

    await waitFor(() => expect(mockFetchQuestsNearLocation).toHaveBeenCalled())
    expect(view.toJSON()).toBeNull()
  })

  it('reserves nothing and asks nothing for an article without a location', async () => {
    const view = await renderWithClient(
      <TravelQuestTeaserLine travel={{ id: 7, slug: 'bez-mesta' } as unknown as Travel} />,
    )

    expect(view.toJSON()).toBeNull()
    expect(mockFetchQuestsNearLocation).not.toHaveBeenCalled()
  })

  it('states no number when the selection is full and reports the top-line click source', async () => {
    mockFetchQuestsNearLocation.mockResolvedValue(
      nearLocation(Array.from({ length: 6 }, (_, index) => apiQuest(`grodno-${index}`, { id: index + 1 }))),
    )

    await renderWithClient(<TravelQuestTeaserLine travel={travel} />)

    expect(await screen.findByText('Гродно: бесплатные квесты-прогулки')).toBeTruthy()
    fireEvent.press(screen.getByTestId('travel-quest-teaser'))
    expect(trackQuestCardClicked).toHaveBeenCalledWith({
      source: 'travel_detail_top',
      questId: undefined,
      cityId: '11',
      contextId: 42,
    })
  })
})
