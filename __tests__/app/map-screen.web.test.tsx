import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'

import MapRoute from '@/app/(tabs)/map.web'

const mockUseWebHydrationGate = jest.fn()

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
  default: function MockMapScreen() {
    return (
      <div data-testid="map-route-runtime">
        <img
          data-testid="leaflet-runtime-tile"
          className="leaflet-tile leaflet-tile-loaded"
          alt=""
        />
      </div>
    )
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

  const setTileLoaded = (tile: HTMLImageElement, decode: () => Promise<void>) => {
    Object.defineProperty(tile, 'complete', { configurable: true, value: true })
    Object.defineProperty(tile, 'naturalWidth', { configurable: true, value: 256 })
    Object.defineProperty(tile, 'decode', { configurable: true, value: decode })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    ensureRoot()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    document.getElementById('root')?.remove()
    document
      .querySelectorAll('h1[data-ssg-travel-h1="true"]')
      .forEach((heading) => heading.remove())
  })

  it('waits for a loaded and decoded Leaflet tile before marking the route ready', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(false)

    const view = render(<MapRoute />, { container: root })

    expect(root.getAttribute('data-map-route-ready')).toBeNull()
    expect(view.queryByTestId('map-route-runtime')).toBeNull()

    mockUseWebHydrationGate.mockReturnValue(true)
    view.rerender(<MapRoute />)

    const tile = (await view.findByTestId('leaflet-runtime-tile')) as HTMLImageElement
    let resolveDecode: (() => void) | undefined
    const decodePromise = new Promise<void>((resolve) => {
      resolveDecode = resolve
    })
    setTileLoaded(tile, jest.fn(() => decodePromise))

    fireEvent.load(tile)
    await act(async () => {
      await Promise.resolve()
    })
    expect(root.getAttribute('data-map-route-ready')).toBeNull()

    await act(async () => {
      resolveDecode?.()
      await decodePromise
    })

    await waitFor(() => {
      expect(root.getAttribute('data-map-route-ready')).toBe('true')
    })
  })

  it('replaces the static SSG heading with one visible runtime heading after hydration (#1640)', async () => {
    const root = ensureRoot()
    const ssgHeading = document.createElement('h1')
    ssgHeading.setAttribute('data-ssg-travel-h1', 'true')
    ssgHeading.style.position = 'absolute'
    ssgHeading.style.width = '1px'
    ssgHeading.style.height = '1px'
    ssgHeading.textContent = 'Карта маршрутов и достопримечательностей Беларуси | Metravel'
    root.before(ssgHeading)
    mockUseWebHydrationGate.mockReturnValue(false)

    const view = render(<MapRoute />, { container: root })
    expect(root.querySelectorAll('h1')).toHaveLength(0)
    expect(document.querySelectorAll('h1')).toHaveLength(1)

    mockUseWebHydrationGate.mockReturnValue(true)
    view.rerender(<MapRoute />)

    await waitFor(() => {
      expect(document.querySelector('h1[data-ssg-travel-h1="true"]')).toBeNull()
      expect(document.querySelectorAll('h1')).toHaveLength(1)
    })

    const runtimeHeading = view.getByRole('heading', { level: 1 })
    expect(runtimeHeading.textContent).toBe(
      'Карта маршрутов и достопримечательностей Беларуси',
    )
    expect(runtimeHeading.style.position).not.toBe('absolute')
    expect(runtimeHeading.style.width).not.toBe('1px')
    expect(runtimeHeading.style.height).not.toBe('1px')
    expect(runtimeHeading.style.flexGrow).toBe('0')
    expect(runtimeHeading.style.flexBasis).toBe('auto')
    expect(runtimeHeading.style.fontSize).toBe('24px')
    expect(runtimeHeading.style.lineHeight).toBe('30px')
    expect(runtimeHeading.style.paddingTop).toBe('8px')
    expect(runtimeHeading.style.paddingRight).toBe('16px')
  })

  it('does not accept an incomplete Leaflet tile load event', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(true)

    const view = render(<MapRoute />, { container: root })
    const tile = (await view.findByTestId('leaflet-runtime-tile')) as HTMLImageElement
    const decode = jest.fn(() => Promise.resolve())
    Object.defineProperty(tile, 'complete', { configurable: true, value: false })
    Object.defineProperty(tile, 'naturalWidth', { configurable: true, value: 0 })
    Object.defineProperty(tile, 'decode', { configurable: true, value: decode })

    fireEvent.load(tile)
    await act(async () => {
      await Promise.resolve()
    })

    expect(decode).not.toHaveBeenCalled()
    expect(root.getAttribute('data-map-route-ready')).toBeNull()
  })

  it('detects a tile that becomes ready through a Leaflet class mutation', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(true)

    const view = render(<MapRoute />, { container: root })
    const tile = (await view.findByTestId('leaflet-runtime-tile')) as HTMLImageElement
    tile.classList.remove('leaflet-tile-loaded')
    const decode = jest.fn(() => Promise.resolve())
    setTileLoaded(tile, decode)

    tile.classList.add('leaflet-tile-loaded')

    await waitFor(() => {
      expect(decode).toHaveBeenCalledTimes(1)
      expect(root.getAttribute('data-map-route-ready')).toBe('true')
    })
  })

  it('keeps the shell when the loaded tile cannot be decoded', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(true)

    const view = render(<MapRoute />, { container: root })
    const tile = (await view.findByTestId('leaflet-runtime-tile')) as HTMLImageElement
    const decode = jest.fn(() => Promise.reject(new Error('decode failed')))
    setTileLoaded(tile, decode)

    fireEvent.load(tile)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(decode).toHaveBeenCalledTimes(1)
    expect(root.getAttribute('data-map-route-ready')).toBeNull()
  })

  it('re-decodes the current tile source when src changes during decode', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(true)

    const view = render(<MapRoute />, { container: root })
    const tile = (await view.findByTestId('leaflet-runtime-tile')) as HTMLImageElement
    let resolveFirstDecode: (() => void) | undefined
    const firstDecode = new Promise<void>((resolve) => {
      resolveFirstDecode = resolve
    })
    const decode = jest
      .fn<Promise<void>, []>()
      .mockReturnValueOnce(firstDecode)
      .mockResolvedValueOnce()
    setTileLoaded(tile, decode)
    tile.src = '/proxy/tiles/osm/11/1180/658.png'
    fireEvent.load(tile)

    await act(async () => {
      await Promise.resolve()
    })
    expect(decode).toHaveBeenCalledTimes(1)

    tile.src = '/proxy/tiles/osm/11/1181/658.png'
    await act(async () => {
      resolveFirstDecode?.()
      await firstDecode
    })

    await waitFor(() => {
      expect(decode).toHaveBeenCalledTimes(2)
      expect(root.getAttribute('data-map-route-ready')).toBe('true')
    })
  })

  it('re-decodes a replacement source when the superseded decode rejects', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(true)

    const view = render(<MapRoute />, { container: root })
    const tile = (await view.findByTestId('leaflet-runtime-tile')) as HTMLImageElement
    let rejectFirstDecode: ((reason?: unknown) => void) | undefined
    const firstDecode = new Promise<void>((_resolve, reject) => {
      rejectFirstDecode = reject
    })
    const decode = jest
      .fn<Promise<void>, []>()
      .mockReturnValueOnce(firstDecode)
      .mockResolvedValueOnce()
    setTileLoaded(tile, decode)
    tile.src = '/proxy/tiles/osm/11/1180/658.png'
    fireEvent.load(tile)

    await act(async () => {
      await Promise.resolve()
    })
    expect(decode).toHaveBeenCalledTimes(1)

    tile.src = '/proxy/tiles/osm/11/1181/658.png'
    await act(async () => {
      rejectFirstDecode?.(new Error('superseded source'))
      await firstDecode.catch(() => undefined)
    })

    await waitFor(() => {
      expect(decode).toHaveBeenCalledTimes(2)
      expect(root.getAttribute('data-map-route-ready')).toBe('true')
    })
  })

  it('cleans the route-ready marker on unmount', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(true)

    const view = render(<MapRoute />, { container: root })
    const tile = (await view.findByTestId('leaflet-runtime-tile')) as HTMLImageElement
    setTileLoaded(tile, jest.fn(() => Promise.resolve()))
    fireEvent.load(tile)

    await waitFor(() => {
      expect(root.getAttribute('data-map-route-ready')).toBe('true')
    })

    view.unmount()

    expect(root.getAttribute('data-map-route-ready')).toBeNull()
  })

  it('does not mark the route ready when decode settles after unmount', async () => {
    const root = ensureRoot()
    mockUseWebHydrationGate.mockReturnValue(true)

    const view = render(<MapRoute />, { container: root })
    const tile = (await view.findByTestId('leaflet-runtime-tile')) as HTMLImageElement
    let resolveDecode: (() => void) | undefined
    const decodePromise = new Promise<void>((resolve) => {
      resolveDecode = resolve
    })
    setTileLoaded(tile, jest.fn(() => decodePromise))
    fireEvent.load(tile)

    await act(async () => {
      await Promise.resolve()
    })
    view.unmount()

    await act(async () => {
      resolveDecode?.()
      await decodePromise
    })

    expect(root.getAttribute('data-map-route-ready')).toBeNull()
  })
})
