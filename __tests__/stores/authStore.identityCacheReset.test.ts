// #1829: на общем устройстве следующий вошедший видел данные предыдущего — кэш
// React Query не сбрасывался ни на выходе, ни на смене пользователя, а часть
// личных ключей не несёт владельца. Набор держит сам сброс: что он сносит, что
// обязан сохранить и почему повторный проход не может задеть уже нового
// вошедшего.

import { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { setActiveQueryClient } from '@/api/activeQueryClient'
import { survivesIdentityChange } from '@/api/identityQueryCache'

jest.mock('@/api/quests', () => ({ fetchQuestsList: jest.fn() }))
jest.mock('@/api/auth', () => ({
  logoutApi: jest.fn().mockResolvedValue(undefined),
  loginApi: jest.fn().mockResolvedValue({ id: 'A', token: 'test-token', refresh: 'test-refresh' }),
}))
jest.mock('@/api/user', () => ({ fetchUserProfile: jest.fn().mockResolvedValue(null) }))
jest.mock('@/utils/authTokenStore', () => ({
  clearSessionTokens: jest.fn().mockResolvedValue(undefined),
  getSessionWriteMark: jest.fn().mockReturnValue(0),
  persistSessionTokens: jest.fn().mockResolvedValue('persisted'),
}))
jest.mock('@/utils/storageBatch', () => ({
  removeStorageBatch: jest.fn().mockResolvedValue(undefined),
  setStorageBatch: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/services/pushRegistration', () => ({
  unregisterPushBeforeLogout: jest.fn().mockResolvedValue(undefined),
}))

const { useAuthStore, resetAuthStoreForTests } =
  require('@/stores/authStore') as typeof import('@/stores/authStore')
const { logoutApi } = require('@/api/auth') as { logoutApi: jest.Mock }

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// По одному представителю каждого класса, который карточка называет утекающим.
// #1831 перевёл все эти ключи на владельца, но сброс обязан сносить их и так:
// он устроен от запрета и не зависит от полноты ревизии ключей.
const seedPersonalCache = (client: QueryClient, owner: string) => {
  client.setQueryData(queryKeys.privacySettings(owner), { matrix: owner })
  client.setQueryData(queryKeys.userPointsAll(owner), [`point-of-${owner}`])
  client.setQueryData(queryKeys.mySubscriptions(owner), [{ id: `sub-of-${owner}` }])
  client.setQueryData(queryKeys.myTelegramLink(owner), { handle: `@${owner}` })
  client.setQueryData(queryKeys.tripChatMessages(owner, 7), [{ id: 1, text: `secret of ${owner}` }])
  client.setQueryData(queryKeys.favorites(owner), [{ id: 1 }])
}

const personalCacheSnapshot = (client: QueryClient, owner: string) => ({
  privacySettings: client.getQueryData(queryKeys.privacySettings(owner)),
  userPointsAll: client.getQueryData(queryKeys.userPointsAll(owner)),
  mySubscriptions: client.getQueryData(queryKeys.mySubscriptions(owner)),
  myTelegramLink: client.getQueryData(queryKeys.myTelegramLink(owner)),
  tripChatMessages: client.getQueryData(queryKeys.tripChatMessages(owner, 7)),
  favorites: client.getQueryData(queryKeys.favorites(owner)),
})

const EMPTY_SNAPSHOT = {
  privacySettings: undefined,
  userPointsAll: undefined,
  mySubscriptions: undefined,
  myTelegramLink: undefined,
  tripChatMessages: undefined,
  favorites: undefined,
}

describe('#1829 смена владельца сессии сбрасывает кэш', () => {
  let client: QueryClient

  beforeEach(() => {
    setActiveQueryClient(null)
    resetAuthStoreForTests()
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    setActiveQueryClient(client)
    jest.clearAllMocks()
    logoutApi.mockResolvedValue(undefined)
  })

  afterEach(() => {
    setActiveQueryClient(null)
    client.unmount()
    client.clear()
  })

  it('A → B: ни один личный ключ не отдаёт данные предыдущего пользователя', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    seedPersonalCache(client, 'A')

    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'B' })

    expect(personalCacheSnapshot(client, 'A')).toEqual(EMPTY_SNAPSHOT)
  })

  it('выход стирает личный кэш, не дожидаясь входа следующего', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    seedPersonalCache(client, 'A')

    useAuthStore.getState().invalidateAuthState()

    expect(personalCacheSnapshot(client, 'A')).toEqual(EMPTY_SNAPSHOT)
  })

  // Холодный старт — тоже смена личности (null → пользователь), но сбрасывать
  // там нечего, а восстановленный офлайн-персист сброс бы снёс.
  it('холодный старт не трогает восстановленный офлайн-персист', async () => {
    const offline = {
      favorites: [{ id: 1 }],
      viewHistory: [{ id: 2 }],
      recommendations: [{ id: 3 }],
      travelStatus: { 4: 'visited' },
    }
    client.setQueryData(queryKeys.favorites('A'), offline.favorites)
    client.setQueryData(queryKeys.viewHistory('A'), offline.viewHistory)
    client.setQueryData(queryKeys.recommendations('A'), offline.recommendations)
    client.setQueryData(queryKeys.travelStatus('A'), offline.travelStatus)

    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()

    expect({
      favorites: client.getQueryData(queryKeys.favorites('A')),
      viewHistory: client.getQueryData(queryKeys.viewHistory('A')),
      recommendations: client.getQueryData(queryKeys.recommendations('A')),
      travelStatus: client.getQueryData(queryKeys.travelStatus('A')),
    }).toEqual(offline)
  })

  // У каталога квестов свой механизм смены личности: он держит публичную часть
  // на экране и снимает только личные поля. Сброс не имеет права его ломать.
  it('каталог квестов переживает смену владельца', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    client.setQueryData(queryKeys.quests(), [{ quest_id: 'q', title: 'Quest' }])

    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'B' })

    expect(client.getQueryData(queryKeys.quests())).toEqual([{ quest_id: 'q', title: 'Quest' }])
  })

  // Механизм каталога бьёт по ТОЧНОМУ ключу ['quests'] (`catalogFilter` там
  // `exact: true`), поэтому срезы под тем же корнем он не чистит — а личные поля
  // `is_completed_by_me`/`user_rating` в них лежат. Под исключение они попадать
  // не имеют права.
  it('срезы под корнем quests исключением не прикрыты', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    const personal = [{ quest_id: 'q', title: 'Quest', is_completed_by_me: true, user_rating: 5 }]
    client.setQueryData(queryKeys.questsPreview(2), personal)
    client.setQueryData(queryKeys.questsCompactCatalog('A'), personal)
    client.setQueryData(queryKeys.questProgressAll('A'), { q: 'done' })

    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'B' })

    expect({
      preview: client.getQueryData(queryKeys.questsPreview(2)),
      compact: client.getQueryData(queryKeys.questsCompactCatalog('A')),
      progress: client.getQueryData(queryKeys.questProgressAll('A')),
    }).toEqual({ preview: undefined, compact: undefined, progress: undefined })
  })

  it('исключение — ровно один точный ключ, а не префикс', () => {
    expect(survivesIdentityChange(queryKeys.quests())).toBe(true)
    expect(survivesIdentityChange(queryKeys.questsPreview(2))).toBe(false)
    expect(survivesIdentityChange(queryKeys.questsCompactCatalog('A'))).toBe(false)
    expect(survivesIdentityChange(queryKeys.privacySettings('A'))).toBe(false)
  })

  // Между сбросом на выходе и входом следующего ответ старой сессии мог лечь в
  // кэш: вход обязан сбросить его, а не унаследовать.
  it('вход следующего пользователя сбрасывает то, что легло после выхода', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    useAuthStore.getState().invalidateAuthState()
    await tick()
    client.setQueryData(queryKeys.privacySettings('A'), { matrix: 'A' })

    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'B' })

    expect(client.getQueryData(queryKeys.privacySettings('A'))).toBeUndefined()
  })

  it('ответ, долетевший со старой сессией после сброса, снимается вторым проходом', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    let resolveLogout!: () => void
    logoutApi.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveLogout = resolve }))

    const logout = useAuthStore.getState().logout()
    await tick()
    // Запрос, стартовавший до выхода, приносит данные ушедшего пользователя.
    client.setQueryData(queryKeys.privacySettings('A'), { matrix: 'A' })

    resolveLogout()
    await logout
    await tick()

    expect(client.getQueryData(queryKeys.privacySettings('A'))).toBeUndefined()
  })

  it('второй проход не трогает данные уже вошедшего следующего пользователя', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    let resolveLogout!: () => void
    logoutApi.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveLogout = resolve }))

    const logout = useAuthStore.getState().logout()
    await tick()
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'B' })
    await tick()
    client.setQueryData(queryKeys.privacySettings('B'), { matrix: 'B' })

    resolveLogout()
    await logout
    await tick()

    expect(client.getQueryData(queryKeys.privacySettings('B'))).toEqual({ matrix: 'B' })
  })
})
