import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import TravelQuestTeaserLine from '@/components/travel/details/sections/TravelQuestTeaserLine.web'
import { TravelLoaderDataContext, type TravelLoaderPayload } from '@/components/travel/details/travelLoaderData'
import { trackQuestCardClicked } from '@/utils/growthFunnelAnalytics'

jest.mock('@/utils/growthFunnelAnalytics', () => ({ trackQuestCardClicked: jest.fn() }))
jest.mock('expo-router', () => {
  const mockReact = require('react')
  return {
    router: { push: jest.fn() },
    Link: ({ href, asChild, children, ...props }: any) => (asChild
      ? mockReact.cloneElement(mockReact.Children.only(children), { ...props, href })
      : mockReact.createElement('a', { ...props, href }, children)),
  }
})

const quest = (questId: string, overrides: Record<string, unknown> = {}) => ({
  quest: { id: 1, quest_id: questId, title: questId, city_id: '11', city_name: 'Гродно', city_alias: 'grodno', ...overrides },
  score: 160,
  distance_km: 0.4,
})

const payload = (linkGraph: unknown): TravelLoaderPayload => ({
  travel: { id: 42, slug: 'grodno-za-1-den' },
  routeKey: 'grodno-za-1-den',
  mediaPartial: false,
  serverDescriptionSanitized: true,
  linkGraph,
} as unknown as TravelLoaderPayload)

const availableGraph = (quests: unknown[]) => ({ state: 'available', quests, related: [] })

const renderLine = (value: TravelLoaderPayload) => render(
  <TravelQuestTeaserLine travel={{ id: 42, slug: 'grodno-za-1-den' } as any} />,
  { wrapper: ({ children }: { children: ReactNode }) => (
    <TravelLoaderDataContext.Provider value={value}>{children}</TravelLoaderDataContext.Provider>
  ) },
)

// Вариант сайта: подбор приходит с серверным загрузчиком статьи, запросов нет.
describe('TravelQuestTeaserLine на сайте (#3221)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('names the city and the number of its quests and links to the city page', async () => {
    await renderLine(payload(availableGraph([quest('grodno-royal'), quest('grodno-castles'), quest('grodno-legends')])))

    const link = screen.getByTestId('travel-quest-teaser')
    expect(link.props.href).toBe('/quests/grodno')
    expect(screen.getByText('Гродно: 3 бесплатных квеста-прогулки')).toBeTruthy()
    // Текст ссылки понятен без окружения: он же её доступное имя.
    expect(link.props.accessibilityLabel).toBe('Гродно: 3 бесплатных квеста-прогулки')
  })

  it('uses the singular form and opens the quest itself when the city has one', async () => {
    await renderLine(payload(availableGraph([quest('grodno-royal')])))

    expect(screen.getByTestId('travel-quest-teaser').props.href).toBe('/quests/11/grodno-royal')
    expect(screen.getByText('Гродно: 1 бесплатный квест-прогулка')).toBeTruthy()
  })

  it('states no number when the selection is full', async () => {
    await renderLine(payload(availableGraph(Array.from({ length: 6 }, (_, index) => quest(`grodno-${index}`)))))

    expect(screen.getByText('Гродно: бесплатные квесты-прогулки')).toBeTruthy()
  })

  it('renders nothing for an article without quests, without a loader graph or with a failed one', async () => {
    const empty = await renderLine(payload(availableGraph([])))
    expect(empty.toJSON()).toBeNull()

    const noGraph = await renderLine(payload(undefined))
    expect(noGraph.toJSON()).toBeNull()

    const failed = await renderLine(payload({ state: 'error', errorCode: 'refresh_failed', retryAfterSeconds: 5, sourceCheckedAt: null, sourceAgeSeconds: null }))
    expect(failed.toJSON()).toBeNull()

    const noPayload = await renderLine(null)
    expect(noPayload.toJSON()).toBeNull()
  })

  it('reports the click with the top-line source, not the source of the full block', async () => {
    await renderLine(payload(availableGraph([quest('grodno-royal'), quest('grodno-castles')])))

    fireEvent.press(screen.getByTestId('travel-quest-teaser'), { preventDefault: jest.fn() })

    expect(trackQuestCardClicked).toHaveBeenCalledTimes(1)
    expect(trackQuestCardClicked).toHaveBeenCalledWith({
      source: 'travel_detail_top',
      questId: undefined,
      cityId: '11',
      contextId: 42,
    })
  })
})
