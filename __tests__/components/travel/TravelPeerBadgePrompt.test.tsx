import { act, fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import TravelPeerBadgePrompt from '@/components/travel/details/sections/TravelPeerBadgePrompt'
import PeerBadgePickerSheet from '@/components/achievements/PeerBadgePickerSheet'
import { useUserAchievements } from '@/hooks/useAchievementsApi'
import { useAuthStore } from '@/stores/authStore'
import { i18n } from '@/i18n'
import type { Travel } from '@/types/types'
import { queueAnalyticsEvent, sendAnalyticsEvent } from '@/utils/analytics'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({
    authReady: true, isAuthenticated: false, userId: null,
  })),
}))
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => require('@/stores/authStore').useAuthStore(),
}))
jest.mock('@/hooks/useAchievementsApi', () => ({ useUserAchievements: jest.fn() }))
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => require('@/constants/modernMattePalette').MODERN_MATTE_PALETTE,
}))
jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn(), sendAnalyticsEvent: jest.fn() }))
jest.mock('@/components/achievements/PeerBadgePickerSheet', () => {
  const { Text } = require('react-native')
  return function Picker({ visible, recipientId }: { visible: boolean; recipientId?: number }) {
    return visible ? <Text testID="test-peer-picker">{recipientId}</Text> : null
  }
})

const mockRead = jest.mocked(useUserAchievements)
const mockQueue = jest.mocked(queueAnalyticsEvent)
const mockSend = jest.mocked(sendAnalyticsEvent)
const mockRetry = jest.fn()
const article = { id: 42, slug: 'article-slug', userIds: '7', description: '<p>Article</p>' } as Travel
const query = () => ({
  isSuccess: true, isError: false, isFetching: false,
  data: { peerReceived: [] }, refetch: mockRetry,
})
const renderPrompt = (travel = article, hasArticleText = true) => render(
  <TravelPeerBadgePrompt travel={travel} isMobile hasArticleText={hasArticleText} />,
)
const signIn = (id = '8') => useAuthStore.setState({ authReady: true, isAuthenticated: true, userId: id })

describe('TravelPeerBadgePrompt', () => {
  const initialPlatform = Platform.OS
  beforeEach(async () => {
    jest.clearAllMocks()
    await i18n.changeLanguage('ru')
    useAuthStore.setState({ authReady: true, isAuthenticated: false, userId: null })
    mockRead.mockReturnValue(query() as ReturnType<typeof useUserAchievements>)
    window.history.replaceState({}, '', '/')
  })
  afterEach(async () => {
    Object.defineProperty(Platform, 'OS', { value: initialPlatform, configurable: true })
    await act(async () => { await i18n.changeLanguage('ru') })
    window.history.replaceState({}, '', '/')
  })

  it('shows the guest invitation without reading author awards or granting automatically', () => {
    const screen = renderPrompt()
    expect(screen.getByText('Понравилась статья? Наградите автора значком')).toBeTruthy()
    expect(mockRead).toHaveBeenLastCalledWith(null)
    expect(screen.queryByTestId('test-peer-picker')).toBeNull()
    expect(mockQueue).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('preserves the full guest return pathname, query and fragment and sends the click first', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    window.history.replaceState({}, '', '/travels/article-slug?source=read#description')
    mockPush.mockImplementationOnce(() => {
      expect(mockSend).toHaveBeenCalledWith('peer_badge_prompt_click', { travel_id: '42' })
    })
    const screen = renderPrompt()
    fireEvent.press(screen.getByTestId('travel-peer-badge-prompt-action'))
    const url = new URL(mockPush.mock.calls[0][0], window.location.origin)
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('redirect')).toBe('/travels/article-slug?source=read#description')
    expect(url.searchParams.get('intent')).toBe('peer-badge')
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockQueue).not.toHaveBeenCalled()
  })

  it('uses the slug as the fallback return address when no browser path exists', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    const screen = renderPrompt()
    fireEvent.press(screen.getByTestId('travel-peer-badge-prompt-action'))
    const url = new URL(mockPush.mock.calls[0][0], 'https://metravel.by')
    expect(url.searchParams.get('redirect')).toBe('/travels/article-slug')
  })

  it('opens the existing picker for the author using known server awards and no travel target', () => {
    signIn()
    const screen = renderPrompt()
    expect(mockRead).toHaveBeenLastCalledWith(7)
    expect(screen.queryByTestId('test-peer-picker')).toBeNull()
    fireEvent.press(screen.getByTestId('travel-peer-badge-prompt-action'))
    expect(screen.getByTestId('test-peer-picker')).toBeTruthy()
    expect(screen.UNSAFE_getByType(PeerBadgePickerSheet).props).toMatchObject({
      target: 'user', recipientId: 7, received: [], visible: true,
    })
    expect(screen.UNSAFE_getByType(PeerBadgePickerSheet).props.travelId).toBeUndefined()
    expect(mockSend).toHaveBeenCalledWith('peer_badge_prompt_click', { travel_id: '42' })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it.each([
    ['owner', { authReady: true, isAuthenticated: true, userId: '007' }, article, true],
    ['pending auth', { authReady: false, isAuthenticated: false, userId: null }, article, true],
    ['unresolved viewer', { authReady: true, isAuthenticated: true, userId: null }, article, true],
    ['missing recipient', { authReady: true, isAuthenticated: false, userId: null }, { ...article, userIds: '' }, true],
    ['invalid recipient', { authReady: true, isAuthenticated: false, userId: null }, { ...article, userIds: '-1' }, true],
    ['invalid travel', { authReady: true, isAuthenticated: false, userId: null }, { ...article, id: 0 }, true],
    ['no article text', { authReady: true, isAuthenticated: false, userId: null }, article, false],
  ])('hides the invitation and events for %s', (_case, state, travel, hasText) => {
    useAuthStore.setState(state)
    const screen = renderPrompt(travel as Travel, hasText)
    expect(screen.queryByTestId('travel-peer-badge-prompt')).toBeNull()
    expect(mockRead).toHaveBeenLastCalledWith(null)
    expect(mockQueue).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('does not expose the giver while author awards load or fail, and retries a failed read', () => {
    signIn()
    mockRead.mockReturnValue({ ...query(), data: undefined, isSuccess: false } as ReturnType<typeof useUserAchievements>)
    const screen = renderPrompt()
    expect(screen.getByTestId('travel-peer-badge-prompt-loading')).toBeTruthy()
    expect(screen.queryByTestId('travel-peer-badge-prompt-action')).toBeNull()
    mockRead.mockReturnValue({ ...query(), isSuccess: false, isError: true } as ReturnType<typeof useUserAchievements>)
    screen.rerender(<TravelPeerBadgePrompt travel={{ ...article }} isMobile hasArticleText />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByTestId('travel-peer-badge-prompt-action')).toBeNull()
    fireEvent.press(screen.getByTestId('travel-peer-badge-prompt-retry'))
    expect(mockRetry).toHaveBeenCalledTimes(1)
    mockRead.mockReturnValue(query() as ReturnType<typeof useUserAchievements>)
    screen.rerender(<TravelPeerBadgePrompt travel={{ ...article }} isMobile hasArticleText />)
    expect(screen.getByTestId('travel-peer-badge-prompt-action')).toBeTruthy()
  })

  it('closes the prior picker when the article, recipient or authenticated session changes', () => {
    signIn()
    const screen = renderPrompt()
    fireEvent.press(screen.getByTestId('travel-peer-badge-prompt-action'))
    screen.rerender(<TravelPeerBadgePrompt travel={{ ...article, id: 43, userIds: '9' }} isMobile hasArticleText />)
    expect(screen.queryByTestId('test-peer-picker')).toBeNull()
    fireEvent.press(screen.getByTestId('travel-peer-badge-prompt-action'))
    act(() => { useAuthStore.setState({ isAuthenticated: false, userId: null }) })
    expect(screen.queryByTestId('test-peer-picker')).toBeNull()
    act(() => { signIn('10') })
    expect(screen.queryByTestId('test-peer-picker')).toBeNull()
  })

  it('counts exposure once per travel across rerenders and auth changes, then re-arms for another article', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    const screen = renderPrompt()
    expect(mockQueue).not.toHaveBeenCalled()
    fireEvent(screen.getByTestId('travel-peer-badge-prompt'), 'layout')
    fireEvent(screen.getByTestId('travel-peer-badge-prompt'), 'layout')
    act(() => { signIn() })
    screen.rerender(<TravelPeerBadgePrompt travel={{ ...article }} isMobile hasArticleText />)
    fireEvent(screen.getByTestId('travel-peer-badge-prompt'), 'layout')
    expect(mockQueue).toHaveBeenCalledTimes(1)
    expect(mockQueue).toHaveBeenLastCalledWith('peer_badge_prompt_impression', { travel_id: '42' })
    screen.rerender(<TravelPeerBadgePrompt travel={{ ...article, id: 43 }} isMobile hasArticleText />)
    fireEvent(screen.getByTestId('travel-peer-badge-prompt'), 'layout')
    expect(mockQueue).toHaveBeenCalledTimes(2)
    expect(mockQueue).toHaveBeenLastCalledWith('peer_badge_prompt_impression', { travel_id: '43' })
  })

  it('updates both labels in every current locale without remounting', async () => {
    const screen = renderPrompt()
    for (const locale of ['be', 'uk', 'pl', 'en', 'ru']) {
      await act(async () => { await i18n.changeLanguage(locale) })
      expect(screen.getByText(i18n.t('travel:peerBadgePrompt.title'))).toBeTruthy()
      expect(screen.getByRole('button', { name: i18n.t('travel:peerBadgePrompt.action') })).toBeTruthy()
    }
    expect(mockQueue).not.toHaveBeenCalled()
  })
})
