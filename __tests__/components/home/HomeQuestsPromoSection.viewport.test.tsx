/**
 * #1475 — мобильная ветка промо-блока квестов на главной.
 *
 * Контракт: desktop показывает 6 карточек, mobile — ровно 4, и оба варианта
 * строятся из реального payload `/api/quests/?page_size=6` (`ApiQuestMeta`),
 * который проходит через настоящие `useQuestsPreview` + `adaptMeta`. Приёмка
 * 20.08.2026 упала именно на mobile, поэтому мобильная ветка закрыта тестом.
 */

import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import HomeQuestsPromoSection from '@/components/home/HomeQuestsPromoSection'
import { queryKeys } from '@/api/queryKeys'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
  queueAnalyticsEvent: jest.fn(),
}))

const { sendAnalyticsEvent } = require('@/utils/analytics') as {
  sendAnalyticsEvent: jest.Mock
}
jest.mock('@/components/quests/QuestForCityCard', () => {
  const { Text } = require('react-native')
  return {
    __esModule: true,
    default: function MockQuestForCityCard({ quest }: { quest: { title: string } }) {
      return <Text>{quest.title}</Text>
    },
  }
})

let mockResponsive = { isPhone: false, isLargePhone: false, width: 1280 }
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}))

// Форма ответа снята с прод-API (`GET /api/quests/?page_size=6`).
const apiQuests = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  quest_id: `quest-${i + 1}`,
  title: `Квест номер ${i + 1}`,
  points: 9,
  city_id: '1',
  city_name: 'Краков',
  country_id: '160',
  country_name: 'Польша',
  country_code: 'pl',
  lat: 50.0617,
  lng: 19.9371,
  duration_min: 120,
  difficulty: 'easy',
  tags: { legend: true, citywalk: true },
  pet_friendly: true,
  cover_url: `https://metravel.by/quest-cover/quests/${i + 1}/main/cover.webp`,
}))

const renderSection = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(queryKeys.questsPreview(6), apiQuests)

  return render(
    <QueryClientProvider client={queryClient}>
      <HomeQuestsPromoSection />
    </QueryClientProvider>,
  )
}

describe('HomeQuestsPromoSection — сетка по вьюпорту (#1475)', () => {
  afterEach(() => {
    mockResponsive = { isPhone: false, isLargePhone: false, width: 1280 }
    jest.clearAllMocks()
  })

  it('на mobile 390 показывает ровно 4 карточки и подарочный CTA', () => {
    mockResponsive = { isPhone: true, isLargePhone: false, width: 390 }

    const { queryByText, getByText } = renderSection()

    expect(getByText('Квест номер 1')).toBeTruthy()
    expect(getByText('Квест номер 4')).toBeTruthy()
    expect(queryByText('Квест номер 5')).toBeNull()
    expect(queryByText('Квест номер 6')).toBeNull()

    // Секция не подменяется скрытым SSG-двойником: это живой React-узел
    // с подарочным входом и ссылкой на весь каталог.
    expect(getByText('Квест в подарок')).toBeTruthy()
    expect(getByText('Все квесты')).toBeTruthy()
  })

  it('на largePhone 480 тоже держит мобильную сетку из 4 карточек', () => {
    mockResponsive = { isPhone: false, isLargePhone: true, width: 480 }

    const { queryByText, getByText } = renderSection()

    expect(getByText('Квест номер 4')).toBeTruthy()
    expect(queryByText('Квест номер 5')).toBeNull()
  })

  it('на desktop 1280 показывает 6 карточек', () => {
    const { getByText } = renderSection()

    expect(getByText('Квест номер 1')).toBeTruthy()
    expect(getByText('Квест номер 6')).toBeTruthy()
  })

  it('на mobile клики размечены событиями контракта и ведут на нужные роуты', () => {
    mockResponsive = { isPhone: true, isLargePhone: false, width: 390 }

    const { getByText } = renderSection()

    fireEvent.press(getByText('Квест в подарок'))
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('HomeClick_QuestScenario', {
      source: 'home_quests',
    })
    expect(mockPush).toHaveBeenCalledWith('/quests/scenario')

    fireEvent.press(getByText('Все квесты'))
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('HomeClick_ViewAllQuests', { count: 4 })
    expect(mockPush).toHaveBeenCalledWith('/quests')
  })

  it('без данных секции нет вовсе — пустая выдача не ломает главную', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(queryKeys.questsPreview(6), [])

    const { queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <HomeQuestsPromoSection />
      </QueryClientProvider>,
    )

    expect(queryByText('Квест в подарок')).toBeNull()
  })
})
