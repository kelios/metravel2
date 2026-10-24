import { render, waitFor } from '@testing-library/react-native'

import RootWebDeferredChrome from '@/components/layout/RootWebDeferredChrome'

jest.mock('@/components/ui/NetworkStatus', () => ({
  __esModule: true,
  NetworkStatus: ({ position }: { position: string }) => {
    const { Text } = require('react-native')
    return <Text testID="network-status" accessibilityHint={position}>network-status</Text>
  },
}))

jest.mock('@/components/layout/Footer', () => ({
  __esModule: true,
  default: ({ webDockManagedByRoot }: any) => {
    const { Text } = require('react-native')
    return <Text testID="footer" accessibilityHint={String(webDockManagedByRoot)}>footer</Text>
  },
}))

jest.mock('@/components/layout/ConsentBanner', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="consent-banner">consent-banner</Text>
  },
}))

jest.mock('@/components/layout/WebAppRuntimeEffects', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="runtime-effects">runtime-effects</Text>
  },
}))

jest.mock('@/components/layout/WebServiceWorkerCleanup', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="sw-cleanup">sw-cleanup</Text>
  },
}))

jest.mock('@/components/layout/AppInstallBar', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="app-install-bar-chunk">app-install-bar</Text>
  },
}))

jest.mock('@/utils/consent', () => ({
  __esModule: true,
  readConsent: jest.fn(() => null),
}))

describe('RootWebDeferredChrome', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame
  const originalCancelAnimationFrame = global.cancelAnimationFrame

  beforeAll(() => {
    global.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 0)) as typeof requestAnimationFrame
    global.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame
  })

  afterAll(() => {
    global.requestAnimationFrame = originalRequestAnimationFrame
    global.cancelAnimationFrame = originalCancelAnimationFrame
  })

  afterEach(() => {
    jest.useRealTimers()
    document.documentElement.classList.remove('app-hydrated')
  })

  it('renders travel deferred chrome without waiting for interaction', async () => {
    const { getByTestId } = render(
      <RootWebDeferredChrome
        isMobile={false}
        pathname="/travels/test-route"
        showFooter
        isTravelPerformanceRoute
        setDockHeight={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(getByTestId('footer').props.accessibilityHint).toBe('true')
      expect(getByTestId('runtime-effects')).toBeTruthy()
    })

    expect(getByTestId('footer').props.accessibilityHint).toBe('true')
    expect(getByTestId('runtime-effects')).toBeTruthy()
  })

  it('loads the map footer controller with visible chrome managed by the root', async () => {
    const { getByTestId } = render(
      <RootWebDeferredChrome
        isMobile={false}
        pathname="/map"
        showFooter
        isTravelPerformanceRoute={false}
        setDockHeight={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(getByTestId('footer').props.accessibilityHint).toBe('true')
    })
  })

  it.each(['/quests/35/istanbul', '/pl/quests/35/istanbul', '/map'])(
    'keeps the global network status away from top navigation on %s', async pathname => {
      const view = render(<RootWebDeferredChrome isMobile pathname={pathname} showFooter={false} isTravelPerformanceRoute={false} setDockHeight={jest.fn()} />)
      await waitFor(() => expect(view.getByTestId('network-status').props.accessibilityHint).toBe('bottom'))
    },
  )

  // #2655: плашка установки адресована и iPhone — гейт монтирования чанка
  // обязан пропускать тот же набор телефонов, что и сама плашка.
  it.each([
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', true],
    ['Android phone', 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', true],
    ['desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', false],
  ])('mounts the app install bar chunk for %s: %s', async (_name, userAgent, expected) => {
    const uaSpy = jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent)
    try {
      const { getByTestId, queryByTestId } = render(
        <RootWebDeferredChrome
          isMobile
          pathname="/travels/test-route"
          showFooter
          isTravelPerformanceRoute
          setDockHeight={jest.fn()}
        />
      )

      // Плашка относится к idle-слою (1 с): ждём его маркер — чистку SW.
      await waitFor(() => {
        expect(getByTestId('sw-cleanup')).toBeTruthy()
      }, { timeout: 3000 })
      if (expected) {
        await waitFor(() => {
          expect(getByTestId('app-install-bar-chunk')).toBeTruthy()
        })
      } else {
        expect(queryByTestId('app-install-bar-chunk')).toBeNull()
      }
    } finally {
      uaSpy.mockRestore()
    }
  })
})
