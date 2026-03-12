import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import RootWebDeferredChrome from '@/components/layout/RootWebDeferredChrome'

jest.mock('@/components/layout/SkipLinks', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="skip-links">skip-links</Text>
  },
}))

jest.mock('@/components/ui/NetworkStatus', () => ({
  __esModule: true,
  NetworkStatus: () => {
    const { Text } = require('react-native')
    return <Text testID="network-status">network-status</Text>
  },
}))

jest.mock('@/components/layout/Footer', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="footer">footer</Text>
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
      expect(getByTestId('footer')).toBeTruthy()
      expect(getByTestId('runtime-effects')).toBeTruthy()
    })

    expect(getByTestId('footer')).toBeTruthy()
    expect(getByTestId('runtime-effects')).toBeTruthy()
  })

})
