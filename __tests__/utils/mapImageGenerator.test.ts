import * as mapImageGenerator from '@/src/utils/mapImageGenerator'
import { generateMapImageFromDOM, generateStaticMapUrl, generateLeafletRouteSnapshot } from '@/src/utils/mapImageGenerator'

const mockMapRemove = jest.fn()
const mockFitBounds = jest.fn()
const mockTileLayerOn = jest.fn()

const mockLeaflet = {
  map: jest.fn(() => ({
    fitBounds: mockFitBounds,
    remove: mockMapRemove,
  })),
  tileLayer: jest.fn(() => {
    const layer: any = {
      addTo: jest.fn().mockReturnThis(),
      on: mockTileLayerOn.mockImplementation((event: string, cb: () => void) => {
        if (event === 'load') {
          cb()
        }
        return layer
      }),
    }
    return layer
  }),
  latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
  latLngBounds: jest.fn((coords: any[]) => ({ coords })),
  divIcon: jest.fn((icon: any) => icon),
  marker: jest.fn(() => ({ addTo: jest.fn() })),
}

jest.mock('leaflet', () => ({
  __esModule: true,
  default: mockLeaflet,
  ...mockLeaflet,
}))

describe('generateStaticMapUrl', () => {
  const points = [
    { name: 'Moscow', lat: 55.75, lng: 37.61 },
    { name: 'SPB', lat: 59.93, lng: 30.31 },
  ]

  it('returns empty string when no points provided', () => {
    expect(generateStaticMapUrl([], {})).toBe('')
  })

  it('falls back to OSM URL when apiKey is missing', () => {
    const url = generateStaticMapUrl(points, { width: 400, height: 300, zoom: 10 })
    expect(url).toContain('staticmap.openstreetmap.fr')
    expect(url).toContain('55.75')
    expect(url).toContain('400x300')
  })

  it('builds Google Static Maps URL when apiKey is provided', () => {
    const url = generateStaticMapUrl(points, { apiKey: 'demo-key', zoom: 8 })
    expect(url).toContain('maps.googleapis.com/maps/api/staticmap')
    expect(url).toContain('key=demo-key')
    expect(url).toContain('markers=color:green|label:1')
    expect(url).toContain('path=color:0xff9f5a')
  })
})

describe('generateMapImageFromDOM', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: jest.fn(() => ({
        fillStyle: '',
        fillRect: jest.fn(),
        font: '',
        measureText: jest.fn(() => ({ width: 10 })),
        fillText: jest.fn(),
      })),
      writable: true,
    })

    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      value: jest.fn(() => 'data:image/png;base64,fallback'),
      writable: true,
    })
  })

  afterEach(() => {
    delete (window as any).html2canvas
  })

  it('returns fallback image when html2canvas fails to render', async () => {
    const html2canvasMock = jest.fn(() => Promise.reject(new Error('boom')))
    ;(window as any).html2canvas = html2canvasMock

    const container = document.createElement('div')
    const dataUrl = await generateMapImageFromDOM(container, 200, 100)

    expect(html2canvasMock).toHaveBeenCalled()
    expect(dataUrl.startsWith('data:image/png')).toBe(true)
  })
})

describe('generateLeafletRouteSnapshot', () => {
  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllTimers()
    mockMapRemove.mockClear()
    mockFitBounds.mockClear()
    mockTileLayerOn.mockClear()
    delete (window as any).html2canvas
    delete (window as any).L
  })

  it('returns null when no points provided', async () => {
    expect(await generateLeafletRouteSnapshot([])).toBeNull()
  })

  it('creates off-screen map snapshot and cleans up DOM', async () => {
    jest.useFakeTimers()
    ;(window as any).L = mockLeaflet
    ;(window as any).html2canvas = jest.fn(() =>
      Promise.resolve({
        toDataURL: () => 'data:image/png;base64,leaflet',
      })
    )

    const promise = generateLeafletRouteSnapshot(
      [
        { lat: 10, lng: 20 },
        { lat: 11, lng: 22 },
      ],
      { width: 320, height: 180, zoom: 9 }
    )

    jest.runAllTimers()
    const result = await promise

    expect(result).toBe('data:image/png;base64,leaflet')
    expect(mockLeaflet.map).toHaveBeenCalled()
    expect(mockMapRemove).toHaveBeenCalled()
    expect(document.getElementById('metravel-map-snapshot')).toBeNull()
  })
})
