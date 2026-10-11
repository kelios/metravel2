import { HOME_BOOK_GEOMETRY, resolveHomeBookGeometry } from '@/components/home/homeBookGeometry'

describe('home book viewport capacity', () => {
  it.each([
    [2048, 900, 1360, 720], [2560, 640, 1520, 460],
    [1440, 900, 1200, 720], [1280, 900, 1200, 720],
  ])('fits %sx%s with bounded readable text and positive paper capacity', (width, height, expectedWidth, expectedHeight) => {
    const book = resolveHomeBookGeometry(width, height)
    expect(book.width).toBe(expectedWidth)
    expect(book.height).toBe(expectedHeight)
    expect(book.topInset + book.usableHeight + book.bottomInset).toBeCloseTo(book.height)
    expect(book.titleSize).toBeGreaterThanOrEqual(24)
    expect(book.subtitleSize).toBeGreaterThanOrEqual(12)
    expect(book.usableHeight).toBeGreaterThan(44 * 2)
  })

  it('responds to a height-only resize and restores capacity without width changes', () => {
    const tall = resolveHomeBookGeometry(2048, 900)
    const short = resolveHomeBookGeometry(2048, 640)
    expect(short.width).toBe(tall.width)
    expect(short.height).toBeLessThan(tall.height)
    expect(short.titleSize).toBeLessThan(tall.titleSize)
    expect(resolveHomeBookGeometry(2048, 900)).toEqual(tall)
  })

  it('uses the actual wrapper width for aspect limiting', () => {
    expect(resolveHomeBookGeometry(1440, 1800, 1000).height).toBeCloseTo(1000 * 765 / 1040)
  })

  it('retains a positive scrollable paper when chrome exceeds the window', () => {
    const book = resolveHomeBookGeometry(2560, 120)
    expect(book.height).toBe(HOME_BOOK_GEOMETRY.minHeight)
    expect(book.usableHeight).toBeGreaterThan(44 * 2)
    expect(resolveHomeBookGeometry(0, 0).height).toBe(0)
  })
})
