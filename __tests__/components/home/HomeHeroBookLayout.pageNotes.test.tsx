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
  { title: 'У воды', icon: 'droplet', filters: {}, route: '/search' },
  { title: 'Замки', icon: 'flag', filters: {}, route: '/search' },
]

const renderBook = (overrides: Partial<React.ComponentProps<typeof HomeHeroBookLayout>> = {}) => {
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
  return { ...render(<HomeHeroBookLayout {...props} />), props }
}

const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height } } })

const measure = (utils: ReturnType<typeof renderBook>, frame: number, content: number) => {
  const frameNode = utils.getByTestId('home-hero-left-frame')
  act(() => {
    fireEvent(frameNode, 'layout', layout(frame))
    fireEvent(frameNode.children[0] as any, 'layout', layout(content))
  })
}

describe('HomeHeroBookLayout page notes fit the left page', () => {
  it('keeps the notes while the page content fits its frame', () => {
    const utils = renderBook()
    measure(utils, 500, 480)
    expect(utils.queryByText('У воды')).toBeTruthy()
  })

  it('drops the notes when the measured content overflows the frame', () => {
    const utils = renderBook()
    measure(utils, 500, 526)
    expect(utils.queryByText('У воды')).toBeNull()
    // Without the notes the content shrinks; they must not come back for the same layout.
    measure(utils, 500, 380)
    expect(utils.queryByText('У воды')).toBeNull()
  })

  it('retries the notes after the book size changes', () => {
    const utils = renderBook()
    measure(utils, 500, 526)
    expect(utils.queryByText('У воды')).toBeNull()
    utils.rerender(<HomeHeroBookLayout {...utils.props} bookHeight={1000} />)
    expect(utils.queryByText('У воды')).toBeTruthy()
    // The taller book fits them: a fresh measurement keeps them.
    measure(utils, 640, 600)
    expect(utils.queryByText('У воды')).toBeTruthy()
  })

  it('waits for the resized frame when content is measured first', () => {
    const utils = renderBook()
    measure(utils, 500, 526)
    utils.rerender(<HomeHeroBookLayout {...utils.props} bookHeight={1000} />)

    const frame = utils.getByTestId('home-hero-left-frame')
    fireEvent(frame.children[0] as any, 'layout', layout(600))
    expect(utils.queryByText('У воды')).toBeTruthy()
    fireEvent(frame, 'layout', layout(640))
    expect(utils.queryByText('У воды')).toBeTruthy()
  })

  it.each([
    { width: 2300 },
    { heroSubtitle: 'Real routes through Belarus and Europe' },
  ])('retries after width or translated content changes: %p', (overrides) => {
    const utils = renderBook()
    measure(utils, 500, 526)
    utils.rerender(<HomeHeroBookLayout {...utils.props} {...overrides} />)
    expect(utils.queryByText('У воды')).toBeTruthy()
    measure(utils, 500, 480)
    expect(utils.queryByText('У воды')).toBeTruthy()
    measure(utils, 500, 526)
    expect(utils.queryByText('У воды')).toBeNull()
  })

  it('keeps layout observers attached before the notes become enabled', () => {
    const utils = renderBook({ bookHeight: 720 })
    const frame = utils.getByTestId('home-hero-left-frame')
    expect(frame.props.onLayout).toEqual(expect.any(Function))
    expect((frame.children[0] as any).props.onLayout).toEqual(expect.any(Function))
    utils.rerender(<HomeHeroBookLayout {...utils.props} bookHeight={820} />)
    measure(utils, 500, 526)
    expect(utils.queryByText('У воды')).toBeNull()
  })

  it('never shows the notes on a book shorter than the notes threshold', () => {
    const utils = renderBook({ bookHeight: 720 })
    expect(utils.queryByText('У воды')).toBeNull()
  })
})
