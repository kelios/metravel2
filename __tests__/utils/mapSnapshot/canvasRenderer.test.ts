const mockLoadCrossOriginImage = jest.fn((_url: string) =>
  Promise.reject(new Error('tile unavailable')),
)

jest.mock('@/utils/mapSnapshot/shared', () => ({
  ...jest.requireActual('@/utils/mapSnapshot/shared'),
  loadCrossOriginImage: (url: string) => mockLoadCrossOriginImage(url),
}))

import { generateCanvasMapSnapshot } from '@/utils/mapSnapshot/canvasRenderer'

describe('generateCanvasMapSnapshot provider compliance', () => {
  const fillText = jest.fn()
  const context = {
    arc: jest.fn(),
    beginPath: jest.fn(),
    ellipse: jest.fn(),
    fill: jest.fn(),
    fillRect: jest.fn(),
    fillStyle: '',
    fillText,
    font: '',
    lineCap: '',
    lineJoin: '',
    lineTo: jest.fn(),
    lineWidth: 0,
    moveTo: jest.fn(),
    stroke: jest.fn(),
    strokeStyle: '',
    textAlign: '',
    textBaseline: '',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any)
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,map')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('uses only the MeTravel OSM proxy and prints static-image attribution', async () => {
    await expect(
      generateCanvasMapSnapshot([{ lat: 53.9, lng: 27.56 }], {
        width: 320,
        height: 180,
        showLabels: false,
      }),
    ).resolves.toBe('data:image/png;base64,map')

    expect(mockLoadCrossOriginImage).toHaveBeenCalled()
    for (const [url] of mockLoadCrossOriginImage.mock.calls) {
      expect(url).toContain('/proxy/tiles/osm/')
      expect(url).not.toMatch(/carto/i)
    }
    expect(fillText).toHaveBeenCalledWith(
      '© OpenStreetMap contributors',
      314,
      176,
    )
  })
})
