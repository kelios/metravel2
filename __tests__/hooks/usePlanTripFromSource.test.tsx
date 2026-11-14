/**
 * #3295: действие «организовать поездку по материалу» — общее для страницы статьи и карточки под ответом
 * ассистента. Гейт ревью поезда: с намерением `create-book` гость после входа попадал в форму новой
 * статьи, а не в план поездки.
 */
import { act, renderHook } from '@testing-library/react-native'

const mockPush = jest.fn()
const authState: { isAuthenticated: boolean; authReady?: boolean } = { isAuthenticated: true, authReady: true }

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

import { PLAN_TRIP_AUTH_INTENT, usePlanTripFromSource } from '@/hooks/usePlanTripFromSource'
import { resolvePostAuthPath } from '@/utils/authNavigation'
import { buildTripPlanCreateHrefFromQuest } from '@/utils/tripPlanLinks'

const href = buildTripPlanCreateHrefFromQuest({ title: 'Квест по Гродно', url: 'https://metravel.by/quests/11/grodno-royal', description: 'Городской квест' })

describe('usePlanTripFromSource (#3295)', () => {
  beforeEach(() => {
    mockPush.mockClear()
    authState.isAuthenticated = true
    authState.authReady = true
  })

  it('вошедший — сразу в форму новой поездки', async () => {
    const { result } = await renderHook(() => usePlanTripFromSource())
    let started = false
    await act(async () => {
      started = result.current.planTrip(href)
    })
    expect(started).toBe(true)
    expect(mockPush).toHaveBeenCalledWith(href)
  })

  it('гость — на вход с намерением «план поездки» и возвратом в ту же форму, а не в форму новой статьи', async () => {
    authState.isAuthenticated = false
    const { result } = await renderHook(() => usePlanTripFromSource())
    let started = true
    await act(async () => {
      started = result.current.planTrip(href)
    })
    expect(started).toBe(false)
    expect(mockPush).toHaveBeenCalledTimes(1)
    const login = String(mockPush.mock.calls[0][0])
    expect(login).toMatch(/^\/(login|registration)\?/)
    const params = new URLSearchParams(login.split('?')[1])
    expect(params.get('intent')).toBe(PLAN_TRIP_AUTH_INTENT)
    expect(params.get('redirect')).toBe(href)
    // После входа — та же форма поездки с подставленным квестом.
    expect(resolvePostAuthPath({ redirect: params.get('redirect') ?? undefined, intent: params.get('intent') ?? undefined })).toBe(href)
    expect(resolvePostAuthPath({ redirect: href, intent: 'create-book' })).toBe('/travel/new')
  })

  it('пока сессия восстанавливается, на вход не уводит; пустая ссылка — ничего не делает', async () => {
    authState.isAuthenticated = false
    authState.authReady = false
    const { result } = await renderHook(() => usePlanTripFromSource())
    await act(async () => {
      expect(result.current.planTrip(href)).toBe(false)
      expect(result.current.planTrip('')).toBe(false)
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
