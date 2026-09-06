/**
 * #1794: пройденный квест было видно только бейджем на карточке каталога.
 * Полосы коллекций рядом (#1484) отвечают на другой вопрос — «сколько осталось
 * в городе», — поэтому истории прохождений у игрока не было нигде.
 *
 * Тест сторожит границы секции: она не рендерится без прохождений, режет
 * список до порога с явным выходом в каталог и ведёт этот выход в тот же срез
 * «Пройденные», что и сайдбар каталога (#1791). Данные берутся из уже
 * загруженного каталога — своего запроса секция не заводит.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import ProfileCompletedQuests from '@/components/profile/ProfileCompletedQuests'
import { COMPLETED_FILTER_ID, STORAGE_PENDING_CATALOG_SELECTION } from '@/utils/questCatalogSelection'
import { PROFILE_COMPLETED_QUESTS_LIMIT, selectCompletedQuests } from '@/utils/questCityCollection'
import type { QuestMeta } from '@/utils/questAdapters'

const mockPush = jest.fn()
let mockCompleted: QuestMeta[] = []

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@expo/vector-icons/Feather', () => 'Feather')
jest.mock('@/components/quests/QuestForCityCard', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return function MockQuestForCityCard({ quest, eyebrow }: { quest: { id: string }; eyebrow?: string }) {
    return React.createElement(Text, { testID: `completed-quest-${quest.id}`, accessibilityLabel: eyebrow }, quest.id)
  }
})
jest.mock('@/hooks/useQuestCityCollection', () => ({
  useQuestCityCollections: () => ({ collections: [], completedQuests: mockCompleted, loading: false }),
}))

const quest = (id: string, cityName: string, title = id): QuestMeta => ({
  id,
  numericId: id.length,
  title,
  cityId: cityName.toLowerCase(),
  cityName,
  countryCode: 'BY',
  lat: 53.9,
  lng: 27.56,
  points: 3,
  durationMin: 60,
  difficulty: 'easy',
  ratingAvg: null,
  ratingCount: 0,
  completionsCount: 1,
  viewsCount: 0,
  isCompletedByMe: true,
  firstCompleter: null,
})

beforeEach(async () => {
  mockCompleted = []
  mockPush.mockClear()
  await AsyncStorage.clear()
})

it('не рендерится у игрока без прохождений', () => {
  const { queryByTestId } = render(<ProfileCompletedQuests />)
  expect(queryByTestId('profile-completed-quests')).toBeNull()
})

it('показывает пройденные квесты и обходится без «показать все», пока список короткий', () => {
  mockCompleted = [quest('a', 'Минск'), quest('b', 'Брест')]

  const { getByTestId, queryByTestId } = render(<ProfileCompletedQuests />)

  expect(getByTestId('profile-completed-quests')).toBeTruthy()
  expect(getByTestId('completed-quest-a')).toBeTruthy()
  expect(getByTestId('completed-quest-b')).toBeTruthy()
  expect(queryByTestId('profile-completed-quests-show-all')).toBeNull()
})

it('режет список до порога и уводит остаток в срез «Пройденные» каталога', async () => {
  mockCompleted = Array.from({ length: PROFILE_COMPLETED_QUESTS_LIMIT + 2 }, (_, i) => quest(`q${i}`, 'Минск'))

  const { getByTestId, queryByTestId } = render(<ProfileCompletedQuests />)

  expect(getByTestId(`completed-quest-q${PROFILE_COMPLETED_QUESTS_LIMIT - 1}`)).toBeTruthy()
  expect(queryByTestId(`completed-quest-q${PROFILE_COMPLETED_QUESTS_LIMIT}`)).toBeNull()

  const showAll = getByTestId('profile-completed-quests-show-all')
  expect(showAll.props.accessibilityLabel).toBe(
    `Показать все пройденные квесты, ${PROFILE_COMPLETED_QUESTS_LIMIT + 2}`,
  )
  fireEvent.press(showAll)

  // Срез передаётся одноразовым ключом и до навигации: каталог забирает его на
  // фокусе, поэтому уже открытая вкладка тоже переключается.
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    STORAGE_PENDING_CATALOG_SELECTION,
    COMPLETED_FILTER_ID,
  ))
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/quests'))
})

it('открывает каталог даже когда хранилище недоступно', async () => {
  mockCompleted = Array.from({ length: PROFILE_COMPLETED_QUESTS_LIMIT + 1 }, (_, i) => quest(`q${i}`, 'Минск'))
  ;(AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('quota'))

  const { getByTestId } = render(<ProfileCompletedQuests />)
  fireEvent.press(getByTestId('profile-completed-quests-show-all'))

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/quests'))
})

describe('selectCompletedQuests', () => {
  it('берёт только пройденные и раскладывает их по городу и названию', () => {
    const catalog: QuestMeta[] = [
      { ...quest('minsk-b', 'Минск', 'Броня') },
      { ...quest('brest-a', 'Брест', 'Алмаз') },
      { ...quest('open', 'Минск', 'Аврора'), isCompletedByMe: false },
      { ...quest('minsk-a', 'Минск', 'Аврора') },
    ]

    expect(selectCompletedQuests(catalog).map((entry) => entry.id)).toEqual([
      'brest-a',
      'minsk-a',
      'minsk-b',
    ])
  })

  it('не падает на квестах без города и названия', () => {
    const bare = { ...quest('bare', ''), cityName: undefined, title: '' } as QuestMeta
    expect(selectCompletedQuests([bare]).map((entry) => entry.id)).toEqual(['bare'])
  })
})
