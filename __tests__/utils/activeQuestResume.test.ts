/**
 * Возврат в начатый квест после того, как ОС выгрузила приложение.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  ACTIVE_QUEST_RESUME_TTL_MS,
  ACTIVE_QUEST_ROUTE_KEY,
  buildActiveQuestHref,
  forgetActiveQuestRoute,
  isActiveQuestHref,
  readActiveQuestRouteForResume,
  rememberActiveQuestRoute,
} from '@/utils/activeQuestResume'

const NOW = 1_800_000_000_000

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('buildActiveQuestHref', () => {
  it('builds the quest route from city and quest ids', () => {
    expect(buildActiveQuestHref('minsk', 'minsk-cmok')).toBe('/quests/minsk/minsk-cmok')
    expect(buildActiveQuestHref(3, 'a b')).toBe('/quests/3/a%20b')
  })

  it('returns null without both ids', () => {
    expect(buildActiveQuestHref('', 'minsk-cmok')).toBeNull()
    expect(buildActiveQuestHref('minsk', undefined)).toBeNull()
  })
})

describe('isActiveQuestHref', () => {
  it('accepts only a quest detail route', () => {
    expect(isActiveQuestHref('/quests/minsk/minsk-cmok')).toBe(true)
    expect(isActiveQuestHref('/quests/minsk')).toBe(false)
    expect(isActiveQuestHref('/travels/x')).toBe(false)
    expect(isActiveQuestHref('/quests/minsk/q?print=1')).toBe(false)
    expect(isActiveQuestHref(null)).toBe(false)
  })
})

describe('active quest route storage', () => {
  it('returns a remembered quest within the TTL', async () => {
    await rememberActiveQuestRoute('/quests/minsk/minsk-cmok', NOW)
    await expect(
      readActiveQuestRouteForResume(NOW + ACTIVE_QUEST_RESUME_TTL_MS),
    ).resolves.toBe('/quests/minsk/minsk-cmok')
  })

  it('drops an expired record', async () => {
    await rememberActiveQuestRoute('/quests/minsk/minsk-cmok', NOW)
    await expect(
      readActiveQuestRouteForResume(NOW + ACTIVE_QUEST_RESUME_TTL_MS + 1),
    ).resolves.toBeNull()
    await expect(AsyncStorage.getItem(ACTIVE_QUEST_ROUTE_KEY)).resolves.toBeNull()
  })

  it('drops a record from the future and a corrupt record', async () => {
    await rememberActiveQuestRoute('/quests/minsk/minsk-cmok', NOW)
    await expect(readActiveQuestRouteForResume(NOW - 1)).resolves.toBeNull()

    await AsyncStorage.setItem(ACTIVE_QUEST_ROUTE_KEY, '{oops')
    await expect(readActiveQuestRouteForResume(NOW)).resolves.toBeNull()
    await expect(AsyncStorage.getItem(ACTIVE_QUEST_ROUTE_KEY)).resolves.toBeNull()
  })

  it('ignores a non-quest href', async () => {
    await rememberActiveQuestRoute('/travels/x', NOW)
    await expect(readActiveQuestRouteForResume(NOW)).resolves.toBeNull()
  })

  it('forgets only its own quest', async () => {
    await rememberActiveQuestRoute('/quests/minsk/b', NOW)
    await forgetActiveQuestRoute('/quests/minsk/a')
    await expect(readActiveQuestRouteForResume(NOW)).resolves.toBe('/quests/minsk/b')

    await forgetActiveQuestRoute('/quests/minsk/b')
    await expect(readActiveQuestRouteForResume(NOW)).resolves.toBeNull()
  })

  it('keeps quest B when leaving A for B without awaiting', async () => {
    await rememberActiveQuestRoute('/quests/minsk/a', NOW)
    void forgetActiveQuestRoute('/quests/minsk/a')
    void rememberActiveQuestRoute('/quests/minsk/b', NOW)
    await expect(readActiveQuestRouteForResume(NOW)).resolves.toBe('/quests/minsk/b')
  })
})
