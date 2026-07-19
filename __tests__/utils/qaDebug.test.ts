import { QueryClient } from '@tanstack/react-query'
import { installQaDebug } from '@/utils/qaDebug'
import { resetAuthStoreForTests, useAuthStore } from '@/stores/authStore'
import { queryKeys } from '@/api/queryKeys'
import { setActiveQueryClient } from '@/api/activeQueryClient'

(globalThis as { __DEV__?: boolean }).__DEV__ = true

jest.mock('@/api/apiConfig', () => ({
  API_BASE_URL: 'https://metravel.by/api',
}))

jest.mock('@/stores/favoritesStore', () => ({
  useFavoritesStore: {
    getState: () => ({ favorites: ['travel-1'] }),
  },
}))

describe('qaDebug', () => {
  let infoSpy: jest.SpyInstance

  beforeEach(() => {
    resetAuthStoreForTests()
    delete (globalThis as { __QA__?: () => void }).__QA__
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined)

    // history теперь читается из RQ-кэша (#994): сидируем 2 записи для user 104.
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.viewHistory('104'), ['travel-1', 'travel-2'])
    setActiveQueryClient(qc)
  })

  afterEach(() => {
    infoSpy.mockRestore()
    setActiveQueryClient(null)
  })

  it('waits for authReady before logging route state', () => {
    installQaDebug('/')

    expect(infoSpy).not.toHaveBeenCalled()

    useAuthStore.setState({
      authReady: true,
      isAuthenticated: true,
      userId: '104',
      username: 'Сергей',
    })

    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).toHaveBeenCalledWith(
      '[QA-STATE]',
      JSON.stringify({
        reason: 'route',
        route: '/',
        authReady: true,
        isAuthenticated: true,
        userId: '104',
        favorites: 1,
        history: 2,
        apiUrl: 'https://metravel.by/api',
      }),
    )
  })

  it('uses the latest route when auth becomes ready after navigation', () => {
    installQaDebug('/')
    installQaDebug('/profile')

    useAuthStore.setState({ authReady: true })

    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy.mock.calls[0][1]).toContain('"route":"/profile"')
  })
})
