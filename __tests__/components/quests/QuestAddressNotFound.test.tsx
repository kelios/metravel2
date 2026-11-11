/**
 * #3227: «Квест не найден» для экрана самого квеста — тот же `QuestNotFoundScreen`,
 * что у лендингов города и страны, с каталогом и стилями раздела, взятыми на месте.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

const mockReplace = jest.fn()
let mockSeoProps: Record<string, unknown> | null = null
let mockQuests: unknown[] = []

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
jest.mock('@/components/layout/bottomChromeInset', () => ({
  ...jest.requireActual('@/components/layout/bottomChromeInset'),
  useDockReservePx: () => 0,
}))
jest.mock('@/hooks/useQuestsApi', () => ({
  useQuestsList: () => ({ quests: mockQuests, loading: false, failed: false }),
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

import QuestAddressNotFound from '@/components/quests/QuestAddressNotFound'

const quest = (id: string, completionsCount: number) => ({
  id, numericId: 1, title: id, points: 5, cityId: 'minsk', cityName: 'Минск', contentLocale: 'ru',
  availableLocales: ['ru'], countryCode: 'BY', lat: 53.9, lng: 27.56, ratingAvg: null, ratingCount: 0,
  completionsCount, viewsCount: completionsCount, isCompletedByMe: false, firstCompleter: null,
})

beforeEach(() => {
  mockReplace.mockClear()
  mockSeoProps = null
  mockQuests = [quest('q1', 1), quest('q2', 9)]
})

it('рисует экран «не найдено» с адресом, выходом в каталог, популярными квестами и noindex', async () => {
  const { getByText, getByTestId } = await render(<QuestAddressNotFound segment="no-such-quest-xyz" />)

  expect(getByTestId('quest-not-found')).toBeTruthy()
  expect(getByText('Такого квеста нет')).toBeTruthy()
  expect(getByText(/no-such-quest-xyz/)).toBeTruthy()
  expect(getByTestId('popular-grid').props.children).toBe('q2,q1')
  expect(mockSeoProps?.robots).toBe('noindex, nofollow')

  await fireEvent.press(getByTestId('quest-not-found-catalog'))
  expect(mockReplace).toHaveBeenLastCalledWith('/quests')
})

it('каталог ещё не пришёл — экран уже показан, без блока популярных', async () => {
  mockQuests = []
  const { getByTestId, queryByTestId } = await render(<QuestAddressNotFound segment="no-such-quest-xyz" />)
  expect(getByTestId('quest-not-found-catalog')).toBeTruthy()
  expect(queryByTestId('quest-not-found-popular')).toBeNull()
})
