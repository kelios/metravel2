import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import HomeHeroBookLayout from '@/components/home/HomeHeroBookLayout'

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/home/HomeHeroSearchBar', () => ({
  __esModule: true,
  default: () => null,
}))

const styles = new Proxy({}, { get: () => ({}) })
const slide = { source: { uri: 'https://example.test/a.jpg' }, alt: 'a', title: 'Озеро', subtitle: 'Италия' }
const moodCards = [
  { title: 'У воды', icon: 'droplet', meta: 'Озёра и реки', filters: {}, route: '/search' },
  { title: 'Замки', icon: 'flag', filters: {}, route: '/search' },
]

const renderBook = async (overrides: Partial<React.ComponentProps<typeof HomeHeroBookLayout>> = {}) => {
  const props = {
    colors: new Proxy({}, { get: () => '#000' }) as any,
    styles,
    isWeb: false,
    isNarrowLayout: false,
    isTabletLayout: false,
    bookHeight: 820,
    showSideSlider: true,
    width: 2200,
    sliderHeight: 300,
    sliderMediaWidth: 400,
    sliderIconColor: '#fff',
    disableHeroSliderBlur: true,
    heroSubtitle: 'Реальные маршруты',
    moodCards,
    heroHighlights: [],
    bookImages: [slide],
    currentSlide: slide,
    renderedSlideIndices: [0],
    visibleSlide: 0,
    loadedSlides: new Set<number>(),
    useStackedCtas: false,
    topWaveAnimatedStyle: {},
    bottomWaveAnimatedStyle: {},
    onQuickFilterPress: jest.fn(),
    onOpenArticle: jest.fn(),
    onOpenSearch: jest.fn(),
    onSearchSubmit: jest.fn(),
    isMobile: false,
    pendingAction: null,
    onPrevSlide: jest.fn(),
    onNextSlide: jest.fn(),
    onMarkSlideLoaded: jest.fn(),
    ...overrides,
  }
  return { ...await render(<HomeHeroBookLayout {...props} />), props }
}

const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height } } })

const measure = async (utils: Awaited<ReturnType<typeof renderBook>>, frame: number, content: number) => {
  const frameNode = utils.getByTestId('home-hero-left-frame')
  await act(async () => {
    await fireEvent(frameNode, 'layout', layout(frame))
    await fireEvent(frameNode.children[0] as any, 'layout', layout(content))
  })
}

const full = (utils: Awaited<ReturnType<typeof renderBook>>) => utils.queryByTestId('home-hero-page-notes')
const compact = (utils: Awaited<ReturnType<typeof renderBook>>) => utils.queryByTestId('home-hero-page-notes-compact')

describe('HomeHeroBookLayout page notes fit the left page', () => {
  it('keeps the notes while the page content fits its frame', async () => {
    const utils = await renderBook()
    await measure(utils, 500, 480)
    expect(full(utils)).toBeTruthy()
  })

  it('drops the notes when the measured content overflows the frame', async () => {
    const utils = await renderBook()
    await measure(utils, 500, 526)
    expect(full(utils)).toBeNull()
    // Without the notes the content shrinks; they must not come back for the same layout.
    await measure(utils, 500, 380)
    expect(full(utils)).toBeNull()
  })

  it('retries the notes after the book size changes', async () => {
    const utils = await renderBook()
    await measure(utils, 500, 526)
    expect(full(utils)).toBeNull()
    await utils.rerender(<HomeHeroBookLayout {...utils.props} bookHeight={1000} />)
    expect(full(utils)).toBeTruthy()
    // The taller book fits them: a fresh measurement keeps them.
    await measure(utils, 640, 600)
    expect(full(utils)).toBeTruthy()
  })

  it('waits for the resized frame when content is measured first', async () => {
    const utils = await renderBook()
    await measure(utils, 500, 526)
    await utils.rerender(<HomeHeroBookLayout {...utils.props} bookHeight={1000} />)

    const frame = utils.getByTestId('home-hero-left-frame')
    await fireEvent(frame.children[0] as any, 'layout', layout(600))
    expect(full(utils)).toBeTruthy()
    await fireEvent(frame, 'layout', layout(640))
    expect(full(utils)).toBeTruthy()
  })

  it.each([
    { width: 2300 },
    { heroSubtitle: 'Real routes through Belarus and Europe' },
  ])('retries after width or translated content changes: %p', async (overrides) => {
    const utils = await renderBook()
    await measure(utils, 500, 526)
    await utils.rerender(<HomeHeroBookLayout {...utils.props} {...overrides} />)
    expect(full(utils)).toBeTruthy()
    await measure(utils, 500, 480)
    expect(full(utils)).toBeTruthy()
    await measure(utils, 500, 526)
    expect(full(utils)).toBeNull()
  })

  it('keeps layout observers attached before the notes become enabled', async () => {
    const utils = await renderBook({ bookHeight: 720 })
    const frame = utils.getByTestId('home-hero-left-frame')
    expect(frame.props.onLayout).toEqual(expect.any(Function))
    expect((frame.children[0] as any).props.onLayout).toEqual(expect.any(Function))
    await utils.rerender(<HomeHeroBookLayout {...utils.props} bookHeight={820} />)
    await measure(utils, 500, 526)
    expect(full(utils)).toBeNull()
  })

  it('never shows the full notes on a book shorter than the notes threshold', async () => {
    const utils = await renderBook({ bookHeight: 720 })
    expect(full(utils)).toBeNull()
  })
})

// #2773: a laptop book is too low for the full notes; the quick ideas stay on
// the first screen as one compact row under the CTA while that row fits.
describe('HomeHeroBookLayout compact quick ideas', () => {
  it('shows a compact row without meta lines on a book below the notes threshold', async () => {
    const onPageNotesVisibilityChange = jest.fn()
    const utils = await renderBook({ bookHeight: 720, onPageNotesVisibilityChange })
    await measure(utils, 440, 400)
    expect(full(utils)).toBeNull()
    expect(compact(utils)).toBeTruthy()
    expect(utils.getByText('У воды')).toBeTruthy()
    expect(utils.queryByText('Озёра и реки')).toBeNull()
    expect(onPageNotesVisibilityChange).toHaveBeenLastCalledWith(true)
  })

  it('falls back to the compact row when the full notes overflow', async () => {
    const utils = await renderBook()
    await measure(utils, 500, 526)
    expect(full(utils)).toBeNull()
    expect(compact(utils)).toBeTruthy()
  })

  // The approved book spec (#2405) keeps the subtitle: when the compact row does
  // not fit, the quick ideas go to the rail below the book instead.
  it('drops the compact row on the lowest book but keeps the subtitle', async () => {
    const onPageNotesVisibilityChange = jest.fn()
    const utils = await renderBook({ bookHeight: 477, onPageNotesVisibilityChange })
    await measure(utils, 291, 354)
    expect(compact(utils)).toBeNull()
    expect(utils.queryByText('У воды')).toBeNull()
    expect(utils.getByTestId('home-hero-subtitle')).toBeTruthy()
    expect(onPageNotesVisibilityChange).toHaveBeenLastCalledWith(false)
  })
})
