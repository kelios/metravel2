import { classifyDarkBottomPixels, type BottomPixelImage } from '../../e2e/helpers/darkBottomPixels'

const image = (width = 390, height = 68): BottomPixelImage => {
  const data = new Uint8ClampedArray(width * height * 4).fill(26)
  for (let index = 3; index < data.length; index += 4) data[index] = 255
  return { width, height, data }
}
const fill = (img: BottomPixelImage, left: number, top: number, width: number, height: number, channel: number) => {
  const pixels = img.data as Uint8ClampedArray
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      pixels.set([channel, channel, channel, 255], (y * img.width + x) * 4)
    }
  }
}
const geometry = (width = 390) => ({
  dock: { left: 0, right: width, top: 12, bottom: 68 }, darkSurfaceChannel: 42,
})

describe('dark dock screenshot classifier (#2298)', () => {
  it.each([390, 402])('accepts dark composited panel, cards and sparse white labels @ %s', (width) => {
    const img = image(width)
    fill(img, 0, 0, width, 12, 46) // dark elevated card above dock
    fill(img, 0, 12, width, 56, 38) // rgba(42,42,42,.75) over background26
    fill(img, 50, 30, 30, 12, 255) // visible dock label/icon
    const result = classifyDarkBottomPixels(img, geometry(width))
    expect(result.matchesThemeBackground).toBe(true)
    expect(result.rowsChecked).toBeGreaterThan(68)
  })

  it.each([390, 402])('rejects actual white underlay composited through unchanged frost @ %s', (width) => {
    const img = image(width)
    fill(img, 0, 12, width, 56, Math.round(42 * 0.75 + 255 * 0.25))
    const result = classifyDarkBottomPixels(img, geometry(width))
    expect(result.matchesThemeBackground).toBe(false)
    expect(result.failures).toContainEqual({ x: 0, y: 14, zone: 'dock', brightFraction: 1 })
  })

  it('rejects a one-pixel light stripe below the dock', () => {
    const img = image(390, 72)
    fill(img, 0, 71, 390, 1, 255)
    expect(classifyDarkBottomPixels(img, geometry()).failures).toContainEqual({ x: 0, y: 71, zone: 'outside', brightFraction: 1 })
  })

  it('accepts a contrasting hairline border in the first two dock rows', () => {
    const img = image()
    fill(img, 0, 12, 390, 2, 85) // above dark surface +32, below white-stripe ceiling
    expect(classifyDarkBottomPixels(img, geometry()).matchesThemeBackground).toBe(true)
  })

  it.each([12, 13])('rejects a one-pixel white stripe in top dock row %s', (y) => {
    const img = image()
    fill(img, 0, y, 390, 1, 255)
    expect(classifyDarkBottomPixels(img, geometry()).failures).toContainEqual({ x: 0, y, zone: 'dock', brightFraction: 1 })
  })

  it('rejects exposed bright rounded corners even if the panel is dark', () => {
    const img = image()
    fill(img, 0, 14, 6, 8, 255)
    expect(classifyDarkBottomPixels(img, geometry()).failures.some((failure) => failure.zone === 'edge')).toBe(true)
  })

  it('rejects a white row without a dock and a light theme masquerading as dark', () => {
    const img = image(390, 24)
    fill(img, 0, 23, 390, 1, 255)
    expect(classifyDarkBottomPixels(img, { dock: null, darkSurfaceChannel: 26 }).matchesThemeBackground).toBe(false)
    expect(classifyDarkBottomPixels(image(), { dock: null, darkSurfaceChannel: 255 }).matchesThemeBackground).toBe(false)
  })

  it('fails closed if no screenshot pixels can be inspected', () => {
    expect(() => classifyDarkBottomPixels({ width: 390, height: 68, data: [] }, geometry())).toThrow('Invalid bottom screenshot')
  })
})
