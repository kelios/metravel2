/**
 * #2896: неизвестный адрес раздела квестов — терминальный экран со ссылками и
 * популярными квестами, а не пустота и не молчаливый редирект.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useIsFocused: () => true,
}))
jest.mock('@expo/vector-icons/Feather', () => 'Feather')
jest.mock('@/components/seo/LazyInstantSEO', () => (props: Record<string, unknown>) => {
  mockSeoProps = props
  return null
})
jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ isMobile: false, width: 1280 }),
  useResponsive: () => ({ isMobile: false }),
}))
jest.mock('@/components/quests/QuestLandingLayout', () => {
  const actual = jest.requireActual('@/components/quests/QuestLandingLayout')
  const { createElement } = jest.requireActual('react')
  const { Text } = jest.requireActual('react-native')
  return {
    ...actual,
    QuestLandingGrid: ({ quests }: { quests: Array<{ id: string }> }) =>
      createElement(Text, { testID: 'popular-grid' }, quests.map((quest) => quest.id).join(',')),
  }
})

let mockSeoProps: Record<string, unknown> | null = null

import QuestNotFoundScreen, {
  QUEST_NOT_FOUND_COUNTRY_ROUTE,
  QUEST_NOT_FOUND_POPULAR_LIMIT,
} from '@/components/quests/QuestNotFoundScreen'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { getThemedColors } from '@/constants/designSystem'
import type { QuestMeta } from '@/utils/questAdapters'

const styles = getStyles(getThemedColors(false), 1280, 900)

const quest = (id: string, completionsCount: number, countryCode = 'BY'): QuestMeta => ({
  id,
  numericId: Number.parseInt(id.replace(/\D/g, ''), 10) || 1,
  title: id,
  points: 5,
  cityId: 'minsk',
  cityName: 'Минск',
  contentLocale: 'ru',
  availableLocales: ['ru'],
  countryCode,
  lat: 53.9,
  lng: 27.56,
  ratingAvg: null,
  ratingCount: 0,
  completionsCount,
  viewsCount: completionsCount,
  isCompletedByMe: false,
  firstCompleter: null,
})

beforeEach(() => {
  mockReplace.mockClear()
  mockSeoProps = null
})

it('показывает заголовок, запрошенный адрес, ссылки и 4 популярных квеста, закрыт для роботов', async () => {
  const quests = [quest('q1', 1), quest('q2', 9), quest('q3', 3), quest('q4', 7), quest('q5', 5), quest('q6', 0)]
  const { getByText, getByTestId } = await render(
    <QuestNotFoundScreen kind="city" segment="this-quest-does-not-exist-123" quests={quests} styles={styles} />,
  )

  expect(getByText('Такого квеста нет')).toBeTruthy()
  expect(getByText(/this-quest-does-not-exist-123/)).toBeTruthy()
  expect(getByTestId('popular-grid').props.children).toBe('q2,q4,q5,q3')
  expect(QUEST_NOT_FOUND_POPULAR_LIMIT).toBe(4)
  expect(mockSeoProps?.robots).toBe('noindex, nofollow')

  await fireEvent.press(getByTestId('quest-not-found-catalog'))
  expect(mockReplace).toHaveBeenLastCalledWith('/quests')
  await fireEvent.press(getByTestId('quest-not-found-country'))
  expect(mockReplace).toHaveBeenLastCalledWith(QUEST_NOT_FOUND_COUNTRY_ROUTE)
})

it('страна: свой заголовок; без квестов Беларуси и без каталога — только ссылка на все квесты', async () => {
  const { getByText, queryByTestId } = await render(
    <QuestNotFoundScreen kind="country" segment="nope-xyz" quests={[]} styles={styles} />,
  )

  expect(getByText('Такой страны в каталоге нет')).toBeTruthy()
  expect(queryByTestId('quest-not-found-country')).toBeNull()
  expect(queryByTestId('quest-not-found-popular')).toBeNull()
})

it('ссылка на Беларусь появляется только при квестах с countryCode BY', async () => {
  const { queryByTestId } = await render(
    <QuestNotFoundScreen kind="city" segment="x" quests={[quest('pl1', 2, 'PL')]} styles={styles} />,
  )
  expect(queryByTestId('quest-not-found-country')).toBeNull()
})
