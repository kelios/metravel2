import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'

import MapRoute from '@/app/(tabs)/map.web'

const mockUseWebHydrationGate = jest.fn()
let mapScreenSuspension: Promise<void> | null = null

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

// #1640 — the runtime <h1> is owned by the map screen tree (MapPageHeading),
// not by the route file. The mock mirrors that so the route suite exercises the
// real handoff: static heading in, runtime heading out.
jest.mock('@/screens/tabs/MapScreen', () => {
  const { MapPageHeading } = jest.requireActual('@/components/MapPage/MapPageHeading')
  return {
    __esModule: true,
    default: function MockMapScreen() {
      // Lets a test hold the deferred map chunk unresolved and observe what the
      // document looks like while nothing of the map tree has mounted yet.
      if (mapScreenSuspension) throw mapScreenSuspension
      return (
        <div data-testid="map-route-runtime">
          <MapPageHeading anchor="map-corner" styles={{}} />
          <img
            data-testid="leaflet-runtime-tile"
            className="leaflet-tile leaflet-tile-loaded"
            alt=""
          />
        </div>
      )
    },
  }
})

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
    mapScreenSuspension = null
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

  const mountStaticHeading = (root: HTMLElement) => {
    const ssgHeading = document.createElement('h1')
    ssgHeading.setAttribute('data-ssg-travel-h1', 'true')
    ssgHeading.style.position = 'absolute'
    ssgHeading.style.width = '1px'
    ssgHeading.style.height = '1px'
    ssgHeading.textContent = 'Карта маршрутов и достопримечательностей Беларуси | Metravel'
    root.before(ssgHeading)
    return ssgHeading
  }

  it('hands the heading over from the static node to the runtime one (#1640)', async () => {
    const root = ensureRoot()
    mountStaticHeading(root)
    mockUseWebHydrationGate.mockReturnValue(false)

    const view = render(<MapRoute />, { container: root })
    // Before hydration the route itself owns no heading — the static node does.
    expect(root.querySelectorAll('h1')).toHaveLength(0)
    expect(document.querySelectorAll('h1')).toHaveLength(1)

    mockUseWebHydrationGate.mockReturnValue(true)
    view.rerender(<MapRoute />)

    await waitFor(() => {
      expect(view.queryByTestId('map-route-runtime')).not.toBeNull()
    })

    // The static node is gone only because a runtime heading took over, and the
    // document never holds more than one.
    expect(document.querySelector('h1[data-ssg-travel-h1="true"]')).toBeNull()
    expect(document.querySelectorAll('h1')).toHaveLength(1)

    const runtimeHeading = view.getByRole('heading', { level: 1 })
    expect(runtimeHeading.textContent).toBe(
      'Карта маршрутов и достопримечательностей Беларуси',
    )
    // The band is gone: the heading is no longer a full-width centred strip.
    expect(runtimeHeading.style.width).not.toBe('100%')
    expect(runtimeHeading.style.textAlign).not.toBe('center')
  })

  it('keeps exactly one heading while the map screen chunk is still unresolved (#1640)', async () => {
    // Regression guard for the lazy-chunk gap. Removing the static heading on
    // `hydrationReady` alone left the document with zero <h1> until the deferred
    // map chunk resolved — and forever when it failed to load.
    const root = ensureRoot()
    mountStaticHeading(root)
    let resolveChunk: (() => void) | undefined
    mapScreenSuspension = new Promise<void>((resolve) => {
      resolveChunk = () => resolve()
    })
    mockUseWebHydrationGate.mockReturnValue(true)

    const view = render(<MapRoute />, { container: root })

    expect(view.queryByTestId('map-route-runtime')).toBeNull()
    expect(view.queryByTestId('map-route-skeleton')).not.toBeNull()
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(document.querySelector('h1[data-ssg-travel-h1="true"]')).not.toBeNull()

    mapScreenSuspension = null
    await act(async () => {
      resolveChunk?.()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(view.queryByTestId('map-route-runtime')).not.toBeNull()
    })
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(document.querySelector('h1[data-ssg-travel-h1="true"]')).toBeNull()
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
