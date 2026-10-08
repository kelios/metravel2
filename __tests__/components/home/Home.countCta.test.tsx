import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from '@/components/home/Home'
import HomeFinalCTA from '@/components/home/HomeFinalCTA'
import { fetchMyTravels } from '@/api/travelUserQueries'
import { queryKeys } from '@/api/queryKeys'
import { i18n, translate } from '@/i18n'

let mockAuth = { isAuthenticated: true, userId: '101' }
const mockPush = jest.fn()
jest.mock('@/context/AuthContext', () => {
  const React = require('react')
  const context = React.createContext(null)
  return { useAuth: () => React.useContext(context), TestAuthProvider: context.Provider }
})
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => true }))
jest.mock('@/api/travelUserQueries', () => ({
  ...jest.requireActual('@/api/travelUserQueries'),
  fetchMyTravels: jest.fn(),
}))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn(), queueAnalyticsEvent: jest.fn() }))
jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({ shouldLoad: true, setElementRef: jest.fn() }),
}))
jest.mock('@/components/home/HomeHero', () => () => null)
jest.mock('@/components/home/HomeQuickActions', () => () => null)
jest.mock('@/components/common/EmailSubscriptionForm', () => () => null)
jest.mock('@/components/home/homeDeferredSections', () => ({
  EmailSubscriptionForm: jest.requireMock('@/components/common/EmailSubscriptionForm'),
  HomeBottomCtaSection: jest.requireActual('@/components/home/HomeBottomCtaSection').default,
  HomeAppPromoSection: () => null,
  HomeFAQSection: () => null,
  HomeInspirationSections: () => null,
  HomeNewRoutesSection: () => null,
  HomePopularRoutesSection: () => null,
  HomeQuestsPromoSection: () => null,
  HomeWeekendRoutesSection: () => null,
}))

const mockFetch = fetchMyTravels as jest.Mock
const AuthProvider = jest.requireMock('@/context/AuthContext').TestAuthProvider
const EMPTY = 'Добавить первую поездку'
const STARTED = 'Открыть мою книгу'
const UNKNOWN = 'Добавить путешествие'

describe('Home confirmed count CTA', () => {
  let client: QueryClient
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = { isAuthenticated: true, userId: '101' }
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => client.clear())
  const tree = () => <AuthProvider value={mockAuth}><QueryClientProvider client={client}><Home /></QueryClientProvider></AuthProvider>

  it('keeps unknown pending and failed reads neutral and enables throwOnError', async () => {
    let rejectRead!: (error: Error) => void
    mockFetch.mockImplementation(() => new Promise((_resolve, reject) => { rejectRead = reject }))
    const view = render(tree())
    expect(view.getByText(UNKNOWN)).toBeTruthy()
    expect(view.queryByText(EMPTY)).toBeNull()
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith({ user_id: '101', perPage: 1, throwOnError: true }))
    await act(async () => rejectRead(new Error('count unavailable')))
    await waitFor(() => expect(client.getQueryState(queryKeys.myTravelsCount('101'))?.status).toBe('error'))
    expect(view.getByText(UNKNOWN)).toBeTruthy()
    expect(view.queryByText(EMPTY)).toBeNull()
  })

  it.each([[0, EMPTY], [7, STARTED]])('uses confirmed %s and retains it after a failed refetch', async (total, label) => {
    mockFetch.mockResolvedValue({ data: [], total })
    const view = render(tree())
    await waitFor(() => expect(view.getByText(label)).toBeTruthy())
    mockFetch.mockRejectedValue(new Error('refetch unavailable'))
    await act(async () => { await client.refetchQueries({ queryKey: queryKeys.myTravelsCount('101') }) })
    expect(view.getByText(label)).toBeTruthy()
    expect(view.queryByText(UNKNOWN)).toBeNull()
  })

  it('does not carry a previous user count into another user or guest', async () => {
    mockFetch.mockResolvedValueOnce({ data: [], total: 7 }).mockImplementation(() => new Promise(() => {}))
    const view = render(tree())
    await waitFor(() => expect(view.getByText(STARTED)).toBeTruthy())
    mockAuth = { isAuthenticated: true, userId: '202' }
    view.rerender(tree())
    expect(view.getByText(UNKNOWN)).toBeTruthy()
    expect(view.queryByText(STARTED)).toBeNull()
    mockAuth = { isAuthenticated: false, userId: '' }
    view.rerender(tree())
    expect(view.getByText('Начать бесплатно')).toBeTruthy()
    expect(view.queryByText(EMPTY)).toBeNull()
  })

  it('uses a generic creation action for unknown and preserves confirmed destinations', () => {
    const cta = (count?: number) => <AuthProvider value={mockAuth}><HomeFinalCTA travelsCount={count} /></AuthProvider>
    const view = render(cta())
    fireEvent.press(view.getByText(UNKNOWN))
    expect(mockPush).toHaveBeenLastCalledWith('/travel/new')
    view.rerender(cta(0))
    fireEvent.press(view.getByText(EMPTY))
    expect(mockPush).toHaveBeenLastCalledWith('/travel/new')
    view.rerender(cta(7))
    fireEvent.press(view.getByText(STARTED))
    expect(mockPush).toHaveBeenLastCalledWith('/export')
  })

  it('updates the unknown action when the locale changes without new count data', async () => {
    const view = render(<AuthProvider value={mockAuth}><HomeFinalCTA /></AuthProvider>)
    expect(view.getByText(UNKNOWN)).toBeTruthy()
    try {
      await act(async () => { await i18n.changeLanguage('en') })
      expect(view.getByText(translate('navigationStatic:components.layout.AccountMenu.dobavit_puteshestvie_bebd3820'))).toBeTruthy()
      expect(view.queryByText(UNKNOWN)).toBeNull()
    } finally {
      view.unmount()
      await act(async () => { await i18n.changeLanguage('ru') })
    }
  })
})
