import React from 'react'
import { act, render, waitFor } from '@testing-library/react'

import MapRoute from '@/app/(tabs)/map.web'

const mockUseWebHydrationGate = jest.fn()
const mockPendingFirstFrameSignals: Array<() => void> = []

jest.mock('expo-router', () => ({
  usePathname: () => '/map',
  useIsFocused: () => true,
}))

jest.mock('@/hooks/useWebHydrationGate', () => ({
  useWebHydrationGate: (...args: unknown[]) => mockUseWebHydrationGate(...args),
}))

jest.mock('@/utils/ensureLeafletCss', () => ({
  ensureLeafletCss: jest.fn(),
}))

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/MapPage/MapPageSkeleton', () => ({
  MapPageSkeleton: () => <div data-testid="map-route-skeleton" />,
}))

jest.mock('@/screens/tabs/MapScreen', () => ({
  __esModule: true,
  default: function MockMapScreen({ onFirstWebFrame }: { onFirstWebFrame?: () => void }) {
    const ReactRuntime = require('react') as typeof import('react')
    ReactRuntime.useEffect(() => {
      if (onFirstWebFrame) {
        mockPendingFirstFrameSignals.push(onFirstWebFrame)
      }
    }, [onFirstWebFrame])
    return <div data-testid="map-route-runtime">Map runtime</div>
  },
}))

describe('map.web route hydration shell signal', () => {
  const ensureRoot = () => {
    let root = document.getElementById('root') as HTMLDivElement | null
    if (!root) {
      root = document.createElement('div')
      root.id = 'root'
      document.body.appendChild(root)
    }
    root.removeAttribute('data-map-route-ready')
    root.innerHTML = ''
    return root
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockPendingFirstFrameSignals.length = 0
    ensureRoot()
  })

  afterEach(() => {
    const root = document.getElementById('root')
    root?.remove()
  })

  it('does not mark #root ready until the real map screen reports its first frame', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(false)

    const view = render(<MapRoute />, { container: root })

    expect(root.getAttribute('data-map-route-ready')).toBeNull()
    expect(view.queryByTestId('map-route-runtime')).toBeNull()

    mockUseWebHydrationGate.mockReturnValue(true)
    view.rerender(<MapRoute />)

    await waitFor(() => {
      expect(view.queryByTestId('map-route-runtime')).not.toBeNull()
    })

    expect(root.getAttribute('data-map-route-ready')).toBeNull()
    expect(mockPendingFirstFrameSignals).toHaveLength(1)

    act(() => {
      mockPendingFirstFrameSignals[0]()
    })

    await waitFor(() => {
      expect(root.getAttribute('data-map-route-ready')).toBe('true')
    })
  })

  it('cleans the route-ready marker on unmount', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(true)

    const view = render(<MapRoute />, { container: root })

    await waitFor(() => {
      expect(mockPendingFirstFrameSignals).toHaveLength(1)
    })

    act(() => {
      mockPendingFirstFrameSignals[0]()
    })

    await waitFor(() => {
      expect(root.getAttribute('data-map-route-ready')).toBe('true')
    })

    view.unmount()

    expect(root.getAttribute('data-map-route-ready')).toBeNull()
  })
})
