import {
  getHomeBookLeftPagePaddingShares,
  HOME_BOOK_GEOMETRY,
  resolveHomeBookGeometry,
} from '@/components/home/homeBookGeometry'

// Inner page frame of open-book-bg(-dark).webp, measured on the 1536×1024 art.
const ARTWORK_FRAME = { left: 196 / 1536, gutterLeft: 738 / 1536, right: 1340 / 1536, top: 98 / 1024, bottom: 796 / 1024 }

describe('home book content sits inside the drawn page frame', () => {
  it.each([0.5, 0.49])('keeps the left page content off the frame lines (page share %s)', (pageShare) => {
    const padding = getHomeBookLeftPagePaddingShares(pageShare)
    expect(padding.start).toBeGreaterThan(ARTWORK_FRAME.left + 0.01)
    expect(pageShare - padding.end).toBeLessThan(ARTWORK_FRAME.gutterLeft - 0.01)
    expect(pageShare - padding.end - padding.start).toBeGreaterThan(0.25)
  })

  it('starts content below the top frame line and ends it above the bottom one', () => {
    expect(HOME_BOOK_GEOMETRY.topInsetShare).toBeGreaterThan(ARTWORK_FRAME.top + 0.01)
    expect(1 - HOME_BOOK_GEOMETRY.bottomInsetShare).toBeLessThan(ARTWORK_FRAME.bottom - 0.01)
    expect(1 - HOME_BOOK_GEOMETRY.pageNumberBottomShare).toBeLessThan(ARTWORK_FRAME.bottom)
    expect(1 - HOME_BOOK_GEOMETRY.rightPageEndShare).toBeLessThan(ARTWORK_FRAME.right)
  })
})

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
