import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query'
import type { ApiQuestMeta } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'
import { setActiveQueryClient } from '@/api/activeQueryClient'
import { QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'
import { questsListQueryOptions } from '@/hooks/questsListQuery'
import { refreshQuestsCatalogIdentity, waitForQuestsCatalogCredentials } from '@/api/questsCatalogInvalidation'

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
jest.mock('@/services/pushRegistration', () => ({ unregisterPushBeforeLogout: jest.fn().mockResolvedValue(undefined) }))

const { useAuthStore, resetAuthStoreForTests } = require('@/stores/authStore') as typeof import('@/stores/authStore')
const { logoutApi } = require('@/api/auth') as { logoutApi: jest.Mock }
const { fetchQuestsList } = require('@/api/quests') as { fetchQuestsList: jest.Mock }
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const meta = (completed: boolean): ApiQuestMeta[] => [{ quest_id: 'q', is_completed_by_me: completed, user_rating: 5, title: 'Quest' } as ApiQuestMeta]

describe('auth identity → exact quests catalog', () => {
  let client: QueryClient
  let unsubscribe: (() => void) | undefined
  beforeEach(() => {
    setActiveQueryClient(null)
    resetAuthStoreForTests()
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    setActiveQueryClient(client)
    jest.clearAllMocks()
    logoutApi.mockResolvedValue(undefined)
  })
  afterEach(() => {
    unsubscribe?.()
    unsubscribe = undefined
    setActiveQueryClient(null)
    client.unmount()
    client.clear()
    onlineManager.setOnline(true)
    jest.restoreAllMocks()
  })
  const observe = (queryFn: () => Promise<ApiQuestMeta[]>) => {
    const observer = new QueryObserver(client, { queryKey: queryKeys.quests(), queryFn, staleTime: QUESTS_LIST_STALE_TIME })
    unsubscribe = observer.subscribe(() => undefined)
  }

  it('guest→A refreshes once; profile/auth-ready changes do not refresh; other keys stay fresh', async () => {
    client.setQueryData(queryKeys.quests(), meta(false))
    client.setQueryData(queryKeys.questsPreview(2), meta(false))
    client.setQueryData(queryKeys.userPointsAll(), ['point'])
    const fetchCatalog = jest.fn().mockResolvedValue(meta(true))
    observe(fetchCatalog)

    await expect(useAuthStore.getState().login('test@example.test', 'test-password')).resolves.toBe(true)
    await tick()
    useAuthStore.getState().setUserAvatar('avatar')
    useAuthStore.getState().triggerProfileRefresh()
    useAuthStore.setState({ authReady: true })
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()

    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(queryKeys.quests())).toEqual(meta(true))
    expect(client.getQueryState(queryKeys.questsPreview(2))?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.userPointsAll())?.isInvalidated).toBe(false)
  })

  it('A→B immediately removes personal fields while B request is pending', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    client.setQueryData(queryKeys.quests(), meta(true))
    let resolveB!: (data: ApiQuestMeta[]) => void
    const fetchCatalog = jest.fn(() => new Promise<ApiQuestMeta[]>((resolve) => { resolveB = resolve }))
    observe(fetchCatalog)

    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'B' })
    const pending = client.getQueryData<ApiQuestMeta[]>(queryKeys.quests())![0]
    expect(pending).not.toHaveProperty('is_completed_by_me')
    expect(pending).not.toHaveProperty('user_rating')
    expect(pending.title).toBe('Quest')
    await tick()
    resolveB(meta(false))
    await tick()
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(queryKeys.quests())).toEqual(meta(false))
  })

  it('cancelled in-flight guest response cannot overwrite signed-in data', async () => {
    let resolveGuest!: (data: ApiQuestMeta[]) => void
    const fetchCatalog = jest.fn()
      .mockImplementationOnce(() => new Promise<ApiQuestMeta[]>((resolve) => { resolveGuest = resolve }))
      .mockResolvedValueOnce(meta(true))
    observe(fetchCatalog)
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    resolveGuest(meta(false))
    await tick()
    expect(fetchCatalog).toHaveBeenCalledTimes(2)
    expect(client.getQueryData(queryKeys.quests())).toEqual(meta(true))
  })

  it('logout does not refresh until server logout and credential cleanup finish', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    client.setQueryData(queryKeys.quests(), meta(true))
    const fetchCatalog = jest.fn().mockResolvedValue(meta(false))
    observe(fetchCatalog)
    let resolveLogout!: () => void
    logoutApi.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveLogout = resolve }))

    const logout = useAuthStore.getState().logout()
    await tick()
    expect(fetchCatalog).not.toHaveBeenCalled()
    expect(client.getQueryData<ApiQuestMeta[]>(queryKeys.quests())![0]).not.toHaveProperty('is_completed_by_me')
    resolveLogout()
    await logout
    await tick()
    expect(fetchCatalog).toHaveBeenCalledTimes(1)
  })

  it('inactive catalog is only invalidated and absent catalog is not created', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    expect(client.getQueryState(queryKeys.quests())).toBeUndefined()
    client.setQueryData(queryKeys.quests(), meta(true))
    const fetch = jest.spyOn(client, 'fetchQuery')
    useAuthStore.getState().invalidateAuthState()
    await tick()
    expect(client.getQueryState(queryKeys.quests())?.isInvalidated).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([true, false])('catalog mounting during logout waits for credentials (cached=%s)', async (cached) => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    if (cached) client.setQueryData(queryKeys.quests(), meta(true))
    let resolveLogout!: () => void
    logoutApi.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveLogout = resolve }))
    fetchQuestsList.mockResolvedValue(meta(false))

    const logout = useAuthStore.getState().logout()
    await tick()
    const observer = new QueryObserver(client, questsListQueryOptions())
    unsubscribe = observer.subscribe(() => undefined)
    await tick()
    expect(fetchQuestsList).not.toHaveBeenCalled()
    resolveLogout()
    await logout
    await tick()
    expect(fetchQuestsList).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(queryKeys.quests())).toEqual(meta(false))
  })

  it('reconnect during logout cannot bypass the credentials barrier', async () => {
    useAuthStore.getState().applyConfirmedAccountSession({ userId: 'A' })
    await tick()
    client.setQueryData(queryKeys.quests(), meta(true))
    client.mount()
    let resolveLogout!: () => void
    logoutApi.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveLogout = resolve }))
    fetchQuestsList.mockResolvedValue(meta(false))
    const observer = new QueryObserver(client, questsListQueryOptions())
    unsubscribe = observer.subscribe(() => undefined)
    onlineManager.setOnline(false)
    const logout = useAuthStore.getState().logout()
    await tick()
    onlineManager.setOnline(true)
    await tick()
    expect(fetchQuestsList).not.toHaveBeenCalled()
    resolveLogout()
    await logout
    await tick()
    expect(fetchQuestsList).toHaveBeenCalledTimes(1)
  })

  it('aborting a credential wait settles immediately and unmount never sends transport later', async () => {
    let resolveCredentials!: () => void
    const ready = new Promise<void>((resolve) => { resolveCredentials = resolve })
    const refresh = refreshQuestsCatalogIdentity(client, () => true, ready)
    const controller = new AbortController()
    const wait = waitForQuestsCatalogCredentials(client, controller.signal)
    controller.abort()
    await expect(wait).rejects.toMatchObject({ name: 'AbortError' })

    const observer = new QueryObserver(client, questsListQueryOptions())
    unsubscribe = observer.subscribe(() => undefined)
    await tick()
    unsubscribe()
    unsubscribe = undefined
    resolveCredentials()
    await refresh
    await tick()
    expect(fetchQuestsList).not.toHaveBeenCalled()
  })

  it('an old identity barrier cannot refetch or block a newer identity', async () => {
    let resolveOld!: () => void
    let identity = 'old'
    const old = refreshQuestsCatalogIdentity(client, () => identity === 'old', new Promise<void>((resolve) => { resolveOld = resolve }))
    const observer = new QueryObserver(client, questsListQueryOptions())
    unsubscribe = observer.subscribe(() => undefined)
    await tick()
    expect(fetchQuestsList).not.toHaveBeenCalled()

    identity = 'new'
    fetchQuestsList.mockResolvedValue(meta(false))
    await refreshQuestsCatalogIdentity(client, () => identity === 'new')
    expect(fetchQuestsList).toHaveBeenCalledTimes(1)
    resolveOld()
    await old
    await tick()
    expect(fetchQuestsList).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(queryKeys.quests())).toEqual(meta(false))
  })
})
