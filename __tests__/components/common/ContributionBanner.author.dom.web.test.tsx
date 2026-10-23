import type React from 'react'
import type { Root } from 'react-dom/client'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let ContributionBanner: React.ComponentType<{ variant: 'author-home' | 'author-catalog' }>
const mockNavigate = jest.fn()
const mockTrack = jest.fn()

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  // Keep the real Expo Link/Slot and RNW Pressable event composition. Only the
  // final router side effect is replaced, so a browser reload cannot pass.
  jest.doMock('expo-router/build/global-state/routing', () => ({ linkTo: mockNavigate }))
  jest.doMock('expo-router/build/domComponents/emitDomEvent', () => ({ emitDomLinkEvent: () => false }))
  jest.doMock('expo-router/build/fork/getPathFromState-forks', () => ({ appendBaseUrl: (path: string) => path }))
  jest.doMock('expo-router/build/Prefetch', () => ({ Prefetch: () => null }))
  jest.doMock('expo-router', () => ({
    Link: jest.requireActual('expo-router/build/link/BaseExpoRouterLink').BaseExpoRouterLink,
    useRouter: () => ({ push: jest.fn() }),
  }))
  jest.doMock('@/stores/authStore', () => ({
    useAuthStore: (select: (state: { isAuthenticated: boolean }) => unknown) => select({ isAuthenticated: false }),
  }))
  jest.doMock('@/utils/growthFunnelAnalytics', () => ({
    trackContentCreateCtaClicked: mockTrack,
    trackRegisterCtaClicked: jest.fn(),
  }))
  jest.doMock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isMobile: true }) }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({}) }))
  jest.doMock('@/components/layout', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  }))
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  jest.doMock('@/i18n/LocaleProvider', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ContributionBanner = require('@/components/common/ContributionBanner').default
})

describe('author promotion with the real Expo Link and React Native Web', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mockNavigate.mockClear()
    mockTrack.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it.each([
    ['author-home', 'home', 1],
    ['author-catalog', 'travelsby', 0],
  ] as const)('navigates %s in the app and records one activation', async (variant, source, detail) => {
    await act(async () => root.render(createElement(ContributionBanner, { variant })))
    const link = container.querySelector<HTMLAnchorElement>('a[href="/become-author"]')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('role')).toBe('link')
    expect(link?.getAttribute('tabindex')).toBe('0')
    expect(container.querySelector('[role="button"]')).toBeNull()

    // Browsers dispatch detail=0 clicks when an anchor is activated by keyboard.
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail })
    await act(async () => { link!.dispatchEvent(click) })
    expect(click.defaultPrevented).toBe(true)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate.mock.calls[0][0]).toBe('/become-author')
    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith({
      contentType: 'route', source, authState: 'guest', intent: 'create-travel', action: 'learn_more', variant,
    })
  })
})
