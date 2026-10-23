import { act, fireEvent, render } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

import BecomeAuthorScreen from '@/components/author/BecomeAuthorScreen'
import { BECOME_AUTHOR_LAYOUT } from '@/components/author/becomeAuthorLayout'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { buildBreakpointLayoutCss } from '@/utils/breakpointLayout'
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder'

const mockPush = jest.fn()
let mockIsMobile = true
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/hooks/useResponsive', () => ({
  ...jest.requireActual('@/hooks/useResponsive'),
  useResponsive: () => ({ isMobile: mockIsMobile }),
}))
jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }))
jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn(), sendAnalyticsEvent: jest.fn() }))

const mockAuthStore = useAuthStore as unknown as jest.Mock
const mockQueue = queueAnalyticsEvent as jest.Mock
const label = 'Рассказать о поездке'

describe('BecomeAuthorScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    mockIsMobile = true
    await i18n.changeLanguage('ru')
    mockAuthStore.mockImplementation((select) => select({ authReady: true, isAuthenticated: false }))
  })

  afterEach(async () => { await act(async () => { await i18n.changeLanguage('ru') }) })

  it('ships desktop geometry in critical CSS while preserving the same mobile and desktop nodes', () => {
    const originalPlatform = Platform.OS
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    try {
      const screen = render(<BecomeAuthorScreen />)
      const cards = screen.getAllByTestId('author-benefit-card')
      const actions = screen.getAllByTestId('author-create-action')
      expect(cards).toHaveLength(4)
      for (const card of cards) {
        expect(card.props.dataSet).toEqual({ bpLayout: 'become-author-card' })
        expect(StyleSheet.flatten(card.props.style).flexBasis).toBe('100%')
      }
      for (const action of actions) {
        expect(action.props.dataSet).toEqual({ bpLayout: 'become-author-action' })
        expect(StyleSheet.flatten(action.props.style).alignItems).toBe('stretch')
      }
      const firstFrameCSS = buildBreakpointLayoutCss(BECOME_AUTHOR_LAYOUT)
      expect(buildCriticalCSS()).toContain(firstFrameCSS)
      expect(firstFrameCSS).toContain('@media (min-width:768px)')
      expect(firstFrameCSS).toContain('flex-basis:46% !important')
      expect(firstFrameCSS).toContain('align-items:flex-start !important')

      mockIsMobile = false
      screen.rerender(<BecomeAuthorScreen />)
      expect(screen.getAllByTestId('author-benefit-card')).toEqual(cards)
      for (const card of cards) expect(StyleSheet.flatten(card.props.style).flexBasis).toBe('46%')
      for (const action of actions) expect(StyleSheet.flatten(action.props.style).alignItems).toBe('flex-start')
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
    }
  })

  it('explains four real author benefits without a contest or store promotion', () => {
    const screen = render(<BecomeAuthorScreen />)
    for (const title of ['Ваши поездки на карте', 'PDF-книга о путешествии', 'Значки и ранги', 'Читатели и подписчики']) {
      expect(screen.getByText(title)).toBeTruthy()
    }
    expect(screen.queryByText(/конкурс|приз|App Store|Google Play/i)).toBeNull()
    expect(screen.getAllByRole('button', { name: label })).toHaveLength(2)
    expect(mockQueue).not.toHaveBeenCalled()
  })

  it('takes a guest through registration with a safe creation return and records the intent once', () => {
    const screen = render(<BecomeAuthorScreen />)
    fireEvent.press(screen.getAllByRole('button', { name: label })[0])
    const url = new URL(mockPush.mock.calls[0][0], 'https://metravel.by')
    expect(url.pathname).toBe('/registration')
    expect(url.searchParams.get('redirect')).toBe('/travel/new')
    expect(url.searchParams.get('intent')).toBe('create-travel')
    expect(mockQueue.mock.calls.filter(([event]) => event === 'content_create_cta_click')).toEqual([
      ['content_create_cta_click', { content_type: 'route', source: 'become_author_page', auth_state: 'guest', intent: 'create-travel', action: 'register' }],
    ])
    expect(mockQueue).toHaveBeenCalledWith('cta_register_click', {
      source: 'become_author_page', auth_state: 'guest', intent: 'create-travel',
    })
  })

  it('takes a signed-in author directly to creation from the lower CTA', () => {
    mockAuthStore.mockImplementation((select) => select({ authReady: true, isAuthenticated: true }))
    const screen = render(<BecomeAuthorScreen />)
    fireEvent.press(screen.getAllByRole('button', { name: label })[1])
    expect(mockPush).toHaveBeenCalledWith('/travel/new')
    expect(mockQueue).toHaveBeenCalledTimes(1)
    expect(mockQueue).toHaveBeenCalledWith('content_create_cta_click', {
      content_type: 'route', source: 'become_author_page', auth_state: 'authenticated', intent: 'create-travel', action: 'create',
    })
  })

  it('waits for auth restoration before deciding registration versus creation', () => {
    mockAuthStore.mockImplementation((select) => select({ authReady: false, isAuthenticated: false }))
    const screen = render(<BecomeAuthorScreen />)
    fireEvent.press(screen.getAllByRole('button', { name: label })[0])
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockQueue).not.toHaveBeenCalled()
    expect(screen.getByText('Ваши поездки на карте')).toBeTruthy()
  })

  it('updates the page and action when the language changes', async () => {
    const screen = render(<BecomeAuthorScreen />)
    await act(async () => { await i18n.changeLanguage('en') })
    expect(screen.getByText('Your trips on the map')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Share a trip' })).toHaveLength(2)
    expect(screen.queryByText('Ваши поездки на карте')).toBeNull()
  })
})
