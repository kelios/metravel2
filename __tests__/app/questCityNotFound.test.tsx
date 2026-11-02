/**
 * #2896: `/quests/<slug>` с неизвестным сегментом. До правки роут вызывал
 * `router.replace('/quests')`, который на web не доезжал, и экран оставался
 * пустым. Теперь: неизвестный сегмент — терминальный экран «Квест не найден»;
 * сегмент, равный alias квеста без id, — переход на канонический адрес; маркер
 * `notFound` от SSR-loader'а рисует экран, не дожидаясь каталога.
 * #2914: упавший каталог (обрыв сети) — ошибка с «Повторить», не «не найдено».
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

const mockReplace = jest.fn()
const mockPush = jest.fn()
let mockCityParam = 'this-quest-does-not-exist-123'
let mockLoading = false
let mockIsFocused = true
let mockError: string | null = null
let mockKeepDataOnError = false
const mockRefetch = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ city: mockCityParam }),
  useNavigation: () => ({ setOptions: jest.fn() }),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useIsFocused: () => mockIsFocused,
  Stack: { Screen: () => null },
  Link: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/screens/tabs/QuestsScreenRoute', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/seo/LazyInstantSEO', () => () => null)
jest.mock('@/components/quests/QuestCityLandingSections', () => () => null)
jest.mock('@/components/quests/TravelsForQuestSection', () => () => null)
jest.mock('@/hooks/useQuestCityWalk', () => ({ useQuestCityWalk: () => ({ walk: null, settled: true }) }))
jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ isMobile: false, width: 1280 }),
  useResponsive: () => ({ isMobile: false }),
}))
jest.mock('@/components/quests/QuestNotFoundScreen', () => {
  const { createElement } = jest.requireActual('react')
  const { Text: RNText } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: ({ kind, segment }: { kind: string; segment: string }) =>
      createElement(RNText, { testID: 'quest-not-found' }, `${kind}:${segment}`),
  }
})
jest.mock('@/components/quests/QuestLandingLoadError', () => {
  const { createElement } = jest.requireActual('react')
  const { Pressable } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: ({ onRetry }: { onRetry: () => void }) =>
      createElement(Pressable, { testID: 'quest-landing-load-error', onPress: onRetry }),
  }
})
jest.mock('@/hooks/useQuestsApi', () => {
  const quest = (id: string, cityId: string, cityName: string) => ({
    id, numericId: 1, title: id, cityId, cityName, countryCode: 'BY', lat: 53.9, lng: 27.56,
    points: 3, durationMin: 60, difficulty: 'easy', ratingAvg: null, ratingCount: 0,
    completionsCount: 0, viewsCount: 0, isCompletedByMe: false, firstCompleter: null,
    contentLocale: 'ru', availableLocales: ['ru'],
  })
  const quests = [quest('grodno-royal', '11', 'Гродно'), quest('minsk-loshitsa', '4', 'Минск')]
  // Как настоящий хук: при ошибке первого запроса каталог пуст и loading=false;
  // сбой фонового обновления оставляет данные кеша (react-query).
  return {
    useQuestsList: () => ({
      quests: mockError && !mockKeepDataOnError ? [] : quests,
      loading: mockLoading,
      error: mockError,
      refetch: mockRefetch,
    }),
  }
})

import QuestsByCityScreen, { findQuestByAliasSegment } from '@/app/(tabs)/quests/[city]/index'

beforeEach(() => {
  mockReplace.mockClear()
  mockPush.mockClear()
  mockLoading = false
  mockIsFocused = true
  mockError = null
  mockKeepDataOnError = false
  mockRefetch.mockClear()
})

it('неизвестный сегмент рисует экран «Квест не найден» и не уводит в каталог', async () => {
  mockCityParam = 'this-quest-does-not-exist-123'
  // Экран «не найдено» — ленивый чанк (#2896, ROUTE-BUNDLE-001): ждём его появления.
  const { findByTestId } = await render(<QuestsByCityScreen />)
  expect((await findByTestId('quest-not-found')).props.children).toBe('city:this-quest-does-not-exist-123')
  expect(mockReplace).not.toHaveBeenCalled()
})

it('alias квеста без id уходит на канонический /quests/<cityId>/<alias>', async () => {
  mockCityParam = 'Grodno-Royal'
  const { queryByTestId } = await render(<QuestsByCityScreen />)
  expect(mockReplace).toHaveBeenCalledWith('/quests/11/grodno-royal')
  expect(queryByTestId('quest-not-found')).toBeNull()
})

// #2090 / #2931: скрытый (ещё смонтированный) экран таба не уводит пользователя —
// редирект alias → канонический адрес только когда экран в фокусе.
it('alias квеста на скрытом экране не уходит, пока экран не получит фокус', async () => {
  mockIsFocused = false
  mockCityParam = 'grodno-royal'
  const screen = await render(<QuestsByCityScreen />)
  expect(mockReplace).not.toHaveBeenCalled()

  mockIsFocused = true
  await screen.rerender(<QuestsByCityScreen />)
  expect(mockReplace).toHaveBeenCalledWith('/quests/11/grodno-royal')
})

it('известный город не считается не найденным', async () => {
  mockCityParam = '11'
  const { queryByTestId } = await render(<QuestsByCityScreen />)
  expect(queryByTestId('quest-not-found')).toBeNull()
  expect(mockReplace).not.toHaveBeenCalled()
})

it('маркер notFound от SSR-loader рисует экран, пока каталог ещё грузится', async () => {
  mockCityParam = 'nope'
  mockLoading = true
  const { findByTestId } = await render(<QuestsByCityScreen notFound />)
  expect((await findByTestId('quest-not-found')).props.children).toBe('city:nope')
})

it('маркер notFound не накрывает город, который каталог разрешил: публикация и каталог — разные источники', async () => {
  mockCityParam = '11'
  const { queryByTestId } = await render(<QuestsByCityScreen notFound />)
  expect(queryByTestId('quest-not-found')).toBeNull()
  expect(mockReplace).not.toHaveBeenCalled()
})

it('ошибка загрузки каталога у валидного города — ошибка с повтором, не «не найдено» (#2914)', async () => {
  mockCityParam = 'minsk'
  mockError = 'Network request failed'
  const { findByTestId, queryByTestId } = await render(<QuestsByCityScreen />)
  const errorState = await findByTestId('quest-landing-load-error')
  expect(queryByTestId('quest-not-found')).toBeNull()
  expect(mockReplace).not.toHaveBeenCalled()
  await fireEvent.press(errorState)
  expect(mockRefetch).toHaveBeenCalledTimes(1)
})

it('ответ SSR-loader «нет такого адреса» остаётся в силе и при упавшем каталоге', async () => {
  mockCityParam = 'nope'
  mockError = 'Network request failed'
  const { findByTestId, queryByTestId } = await render(<QuestsByCityScreen notFound />)
  expect((await findByTestId('quest-not-found')).props.children).toBe('city:nope')
  expect(queryByTestId('quest-landing-load-error')).toBeNull()
})

it('сбой фонового обновления при каталоге в кеше не прячет «не найдено» (#2914)', async () => {
  mockCityParam = 'nope'
  mockError = 'Network request failed'
  mockKeepDataOnError = true
  const { findByTestId, queryByTestId } = await render(<QuestsByCityScreen />)
  expect((await findByTestId('quest-not-found')).props.children).toBe('city:nope')
  expect(queryByTestId('quest-landing-load-error')).toBeNull()
})

it('findQuestByAliasSegment: регистр и пробелы не мешают, пустой сегмент — null', () => {
  const quests = [{ id: 'grodno-royal', cityId: '11' }]
  expect(findQuestByAliasSegment(' GRODNO-royal ', quests)).toEqual(quests[0])
  expect(findQuestByAliasSegment('', quests)).toBeNull()
  expect(findQuestByAliasSegment('other', quests)).toBeNull()
})
