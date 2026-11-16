/**
 * #3295: действие «организовать поездку по материалу» — общее для страницы статьи и карточки под ответом
 * ассистента. Гейт ревью поезда: с намерением `create-book` гость после входа попадал в форму новой
 * статьи, а не в план поездки.
 */
import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

const mockAnalytics = jest.fn()
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: (...args: unknown[]) => mockAnalytics(...args) }))

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
import { trackTripPlannerForm, trackPlannerTripCreated } from '@/utils/tripPlannerAnalytics'
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
      started = await result.current.planTrip(href)
    })
    expect(started).toBe(true)
    expect(mockPush).toHaveBeenCalledWith(href)
  })

  it('гость — на вход с намерением «план поездки» и возвратом в ту же форму, а не в форму новой статьи', async () => {
    authState.isAuthenticated = false
    const { result } = await renderHook(() => usePlanTripFromSource())
    let started = true
    await act(async () => {
      started = await result.current.planTrip(href)
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
      expect(await result.current.planTrip(href)).toBe(false)
      expect(await result.current.planTrip('')).toBe(false)
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})


describe('web planner attribution across login', () => {
  const originalOs = Platform.OS
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    mockPush.mockClear()
    mockAnalytics.mockClear()
    authState.isAuthenticated = false
    authState.authReady = true
  })
  afterEach(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs }))

  it('assistant quest keeps assistant source and initial guest cohort through the login redirect', async () => {
    const { result } = await renderHook(() => usePlanTripFromSource('assistant'))
    await act(async () => { await result.current.planTrip(href) })
    const login = new URLSearchParams(String(mockPush.mock.calls[0][0]).split('?')[1])
    const redirect = login.get('redirect')!
    expect(new URLSearchParams(redirect.split('?')[1]).get('planner_source')).toBe('assistant')
    expect(redirect).not.toContain('planner_entry')
    expect(new URLSearchParams(redirect.split('?')[1]).get('sourceTravelTitle')).toBe('Квест по Гродно')
    expect(resolvePostAuthPath({ redirect, intent: login.get('intent')! })).toBe(redirect)
    const entry = trackTripPlannerForm(redirect, true, true)
    expect(redirect).not.toContain(entry)
    trackPlannerTripCreated(entry, 200, 'foot')
    expect(mockAnalytics.mock.calls.map(([name, params]) => [name, params.source, params.auth_state, params.outcome])).toEqual([
      ['trip_planner_entry', 'assistant', 'guest', 'auth_required'],
      ['trip_planner_form_view', 'assistant', 'guest', 'ready'],
      ['trip_created', 'assistant', 'guest', 'success'],
    ])
  })

  it('restoring auth does not record or navigate even if the cached authenticated flag is true', async () => {
    authState.authReady = false
    authState.isAuthenticated = true
    const { result } = await renderHook(() => usePlanTripFromSource('travel'))
    await act(async () => { expect(await result.current.planTrip(href)).toBe(false) })
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockAnalytics).not.toHaveBeenCalled()
  })

  it('keeps the planner/login destination functional when attribution fails to load or run', async () => {
    const failure = jest.spyOn(require('@/utils/tripPlannerAnalytics'), 'beginTripPlannerEntry')
      .mockImplementationOnce(() => { throw new Error('analytics unavailable') })
    const { result } = await renderHook(() => usePlanTripFromSource('assistant'))
    await act(async () => { expect(await result.current.planTrip(href)).toBe(false) })
    expect(new URLSearchParams(String(mockPush.mock.calls[0][0]).split('?')[1]).get('redirect')).toBe(href)
    expect(mockAnalytics).not.toHaveBeenCalled()
    failure.mockRestore()
  })
})
