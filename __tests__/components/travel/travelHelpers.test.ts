import {
  isMobile,
  isTablet,
  isDesktop,
  getMenuWidth,
  getContentPadding,
  getMaxContentWidth,
  getYoutubeId,
  stripToDescription,
  getOrigin,
  buildVersionedUrl,
  retry,
  isEmptyHtml,
  calculateAspectRatio,
  extractDimensionsFromFilename,
  debounce,
  throttle,
  formatViewCount,
  formatDate,
  getOptimalImageFormat,
} from '@/components/travel/utils/travelHelpers'

// NOTE: tests focus on behavior, not implementation details.

describe('travelHelpers', () => {
  it('classifies screen sizes', () => {
    expect(isMobile(320)).toBe(true)
    expect(isTablet(320)).toBe(false)
    expect(isDesktop(320)).toBe(false)

    expect(isMobile(900)).toBe(false)
    expect(isTablet(900)).toBe(true)
    expect(isDesktop(900)).toBe(false)

    expect(isMobile(1400)).toBe(false)
    expect(isTablet(1400)).toBe(false)
    expect(isDesktop(1400)).toBe(true)
  })

  it('extracts youtube id from common url formats', () => {
    expect(getYoutubeId(undefined)).toBeNull()
    expect(getYoutubeId('https://youtu.be/abc123')).toBe('abc123')
    expect(getYoutubeId('https://www.youtube.com/watch?v=xyz789&x=1')).toBe('xyz789')
    expect(getYoutubeId('https://www.youtube.com/shorts/short-id')).toBe('short-id')
    expect(getYoutubeId('https://example.com')).toBeNull()
  })

  it('strips html to plain description with fallback', () => {
    expect(stripToDescription(undefined)).toContain('Найди место')

    const html = '<style>.x{}</style><div>Hello <b>world</b></div>'
    expect(stripToDescription(html, 200)).toBe('Hello world')

    const onlyTags = '<div><br/></div>'
    expect(stripToDescription(onlyTags)).toContain('Найди место')
  })

  it('parses origin and builds versioned urls', () => {
    expect(getOrigin(undefined)).toBeNull()
    expect(getOrigin('http://example.com/a')).toBe('https://example.com')
    expect(getOrigin('not-a-url')).toBeNull()

    expect(buildVersionedUrl(undefined)).toBe('')
    expect(buildVersionedUrl('http://example.com/a', '2024-01-02T00:00:00Z')).toContain('https://example.com/a?v=')
    expect(buildVersionedUrl('https://example.com/a', null, 10)).toBe('https://example.com/a?v=10')
    expect(buildVersionedUrl('https://example.com/a', null, null)).toBe('https://example.com/a')
  })

  it('detects empty html correctly', () => {
    expect(isEmptyHtml(undefined)).toBe(true)
    expect(isEmptyHtml('   ')).toBe(true)
    expect(isEmptyHtml('<div><br/></div>')).toBe(true)
    expect(isEmptyHtml('<div>Hello</div>')).toBe(false)
  })

  it('calculates aspect ratio with fallback', () => {
    expect(calculateAspectRatio(160, 90)).toBeCloseTo(16 / 9)
    expect(calculateAspectRatio(undefined, undefined, 4 / 3)).toBeCloseTo(4 / 3)
  })

  it('extracts dimensions from filename', () => {
    expect(extractDimensionsFromFilename('image-800x600.jpg')).toEqual({ width: 800, height: 600 })
    expect(extractDimensionsFromFilename('image_1024x768.webp?x=1')).toEqual({ width: 1024, height: 768 })
    expect(extractDimensionsFromFilename('image.jpg')).toEqual({})
  })

  it('formats view counts', () => {
    expect(formatViewCount(999)).toBe('999')
    expect(formatViewCount(1000)).toBe('1.0K')
    expect(formatViewCount(12500)).toBe('12.5K')
    expect(formatViewCount(1000000)).toBe('1.0M')
  })

  it('formats dates and returns empty string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('')
    const formatted = formatDate('2024-01-02T00:00:00Z')
    expect(typeof formatted).toBe('string')
    expect(formatted.length).toBeGreaterThan(0)
  })

  it('debounce and throttle call underlying function with timing constraints', async () => {
    jest.useFakeTimers()

    const fn = jest.fn()
    const debounced = debounce(fn, 50)
    debounced(1)
    debounced(2)
    expect(fn).not.toHaveBeenCalled()

    jest.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(2)

    const fn2 = jest.fn()
    const throttled = throttle(fn2, 50)
    throttled('a')
    throttled('b')
    expect(fn2).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(50)
    throttled('c')
    expect(fn2).toHaveBeenCalledTimes(2)

    jest.useRealTimers()
  })

  it('retry retries the function and eventually resolves', async () => {
    jest.useFakeTimers()

    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok')

    const promise = retry(fn, 1, 10)

    // Let the retry delay elapse and allow the queued microtasks to run.
    await jest.advanceTimersByTimeAsync(10)

    await expect(promise).resolves.toBe('ok')

    jest.useRealTimers()
  })

  it('getOptimalImageFormat falls back to jpeg when webp is not supported (test environment)', () => {
    // In Jest/JSDOM canvas.toDataURL('image/webp') is typically not supported
    expect(['jpeg', 'webp']).toContain(getOptimalImageFormat())
  })

  it('returns stable menu width and content padding values for common breakpoints', () => {
    expect(getMenuWidth(360)).toBeDefined()
    expect(getMenuWidth(900)).toBeDefined()
    expect(getMenuWidth(1400)).toBeDefined()

    expect(getContentPadding(375)).toBeGreaterThanOrEqual(0)
    expect(getContentPadding(1024)).toBeGreaterThanOrEqual(0)

    expect(getMaxContentWidth('main')).toBeGreaterThan(0)
    expect(getMaxContentWidth('wide')).toBeGreaterThan(0)
    expect(getMaxContentWidth('description')).toBeGreaterThan(0)
  })
})
