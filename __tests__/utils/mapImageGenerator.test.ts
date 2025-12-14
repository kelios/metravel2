import { generateMapImageFromDOM, generateStaticMapUrl } from '@/src/utils/mapImageGenerator'

describe('generateStaticMapUrl', () => {
  const points = [
    { lat: 55.75, lng: 37.61 },
    { lat: 59.93, lng: 30.31 },
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
