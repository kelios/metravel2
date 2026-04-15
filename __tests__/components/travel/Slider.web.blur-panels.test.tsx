/**
 * @jest-environment jsdom
 */

import renderer, { act } from 'react-test-renderer'
import { Platform } from 'react-native'

import SliderWeb from '@/components/travel/Slider.web'

const images = Array.from({ length: 6 }, (_, index) => ({
  id: `img-${index + 1}`,
  url: `https://example.com/img-${index + 1}.jpg`,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
}))

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: jest.fn(() => ({ width: 1200, height: 900, scale: 1, fontScale: 1 })),
  }
})

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')

  return {
    __esModule: true,
    isIOSSafariUserAgent: (userAgent: string, maxTouchPoints = 0) => {
      const normalizedUserAgent = String(userAgent || '')
      const isIOSDevice = /iPad|iPhone|iPod/i.test(normalizedUserAgent) || (
        /Macintosh/i.test(normalizedUserAgent) && maxTouchPoints > 1
      )
      const isSafari = /Safari/i.test(normalizedUserAgent) && !/(Chrome|CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|Chromium|Firefox)/i.test(normalizedUserAgent)
      return isIOSDevice && isSafari
    },
    prefetchImage: jest.fn(() => Promise.resolve()),
    default: (props: any) =>
      React.createElement('mock-image-card-media', {
        ...props,
        ...(props?.imageProps || {}),
        fetchPriority: props?.priority === 'high' ? 'high' : 'auto',
      }),
  }
})

describe('Slider (web) blur background', () => {
  const originalPlatform = Platform.OS
  const originalUserAgent = window.navigator.userAgent
  const originalMaxTouchPoints = window.navigator.maxTouchPoints
  const reactNative = jest.requireMock('react-native')
  const useWindowDimensionsMock = reactNative.useWindowDimensions as jest.Mock

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    useWindowDimensionsMock.mockReturnValue({ width: 1200, height: 900, scale: 1, fontScale: 1 })
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    })
  })

  it('renders slider with blurBackground prop passed to Slide component', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={[{ id: 'img-1', url: 'https://example.com/img.jpg' }] as any}
          showArrows={false}
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground
        />,
      )
    })

    // Verify slider renders with slide content
    expect(tree.root.findByProps({ testID: 'slider-stack' })).toBeTruthy()
    expect(tree.root.findByProps({ testID: 'slider-wrapper' })).toBeTruthy()
    const firstImage = tree.root.findByProps({ testID: 'slider-image-0' })
    expect(firstImage).toBeTruthy()
    expect(firstImage.props.blurBackground).toBe(true)
    expect(firstImage.props.allowCriticalWebBlur).toBe(true)
  })

  it('renders slider without blur when blurBackground is disabled', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={[{ id: 'img-1', url: 'https://example.com/img.jpg' }] as any}
          showArrows={false}
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground={false}
        />,
      )
    })

    // Verify slider renders correctly
    expect(tree.root.findByProps({ testID: 'slider-stack' })).toBeTruthy()
    expect(tree.root.findByProps({ testID: 'slider-image-0' })).toBeTruthy()
  })

  it('keeps slide 0 rendered after navigating to index 2 on web', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={images as any}
          showArrows
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground={false}
        />,
      )
    })

    const nextButton = tree.root.findByProps({ accessibilityLabel: 'Next slide' })

    await act(async () => {
      nextButton.props.onPress()
    })

    await act(async () => {
      nextButton.props.onPress()
    })

    expect(tree.root.findByProps({ testID: 'slider-image-0' })).toBeTruthy()
    expect(tree.root.findByProps({ testID: 'slider-image-2' })).toBeTruthy()
  })

  it('keeps all slides mounted on web to avoid blank gaps during fast swipes', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={images as any}
          showArrows
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground={false}
        />,
      )
    })

    expect(tree.root.findByProps({ testID: 'slider-image-0' })).toBeTruthy()
    expect(tree.root.findByProps({ testID: 'slider-image-3' })).toBeTruthy()
    expect(tree.root.findByProps({ testID: 'slider-image-5' })).toBeTruthy()
  })

  it('keeps non-first slides lazy before web prefetch is enabled', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={images as any}
          showArrows={false}
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground={false}
        />,
      )
    })

    const firstImage = tree.root.findByProps({ testID: 'slider-image-0' })
    const secondImage = tree.root.findByProps({ testID: 'slider-image-1' })

    expect(firstImage.props.loading).toBe('eager')
    expect(firstImage.props.fetchPriority).toBe('high')
    expect(secondImage.props.loading).toBe('lazy')
    expect(secondImage.props.fetchPriority).toBe('auto')
  })

  it('raises preload count on mobile viewport widths for faster swipe response', async () => {
    useWindowDimensionsMock.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 })

    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={images as any}
          showArrows={false}
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground={false}
        />,
      )
    })

    const secondImage = tree.root.findByProps({ testID: 'slider-image-1' })
    expect(secondImage.props.loading).toBe('eager')
    expect(secondImage.props.fetchPriority).toBe('high')
  })

  it('keeps blur rendering inside slide media instead of a separate shared backdrop track', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={images as any}
          showArrows={false}
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground
        />,
      )
    })

    const separateBackdrop = tree.root.findAllByProps({ testID: 'slider-shared-blur-backdrop' })
    expect(separateBackdrop).toHaveLength(0)

    const firstImage = tree.root.findByProps({ testID: 'slider-image-0' })
    expect(firstImage.props.blurBackground).toBe(true)
  })

  it('passes a per-slide recycling key so web blur backdrop remounts on slide change', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={images as any}
          showArrows
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground
        />,
      )
    })

    const firstImage = tree.root.findByProps({ testID: 'slider-image-0' })
    expect(firstImage.props.recyclingKey).toContain('slider-slide-0-')
    expect(firstImage.props.recyclingKey).toContain('img-1.jpg')

    const nextButton = tree.root.findByProps({ accessibilityLabel: 'Next slide' })

    await act(async () => {
      nextButton.props.onPress()
    })

    const secondImage = tree.root.findByProps({ testID: 'slider-image-1' })
    expect(secondImage.props.recyclingKey).toContain('slider-slide-1-')
    expect(secondImage.props.recyclingKey).toContain('img-2.jpg')
  })

  it('keeps slide blur surround enabled on iPhone Safari mobile web', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={[{ id: 'img-1', url: 'https://example.com/img.jpg' }] as any}
          showArrows={false}
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground
        />,
      )
    })

    const firstImage = tree.root.findByProps({ testID: 'slider-image-0' })
    expect(firstImage.props.blurBackground).toBe(true)
    expect(firstImage.props.allowCriticalWebBlur).toBe(true)
  })

  it('keeps only the in-track previous frame after navigating without duplicating overlay media', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={images as any}
          showArrows
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground={false}
          firstImagePreloaded
        />,
      )
    })

    const nextButton = tree.root.findByProps({ accessibilityLabel: 'Next slide' })

    await act(async () => {
      nextButton.props.onPress()
    })

    const previousFrameInstances = tree.root.findAll(
      (node: any) =>
        node.type === 'mock-image-card-media' &&
        typeof node.props?.src === 'string' &&
        node.props.src.includes('img-1.jpg'),
    )

    expect(previousFrameInstances).toHaveLength(1)
  })

  it('does not add a duplicate previous-frame overlay when blur background mode is enabled', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={images as any}
          showArrows
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground
          firstImagePreloaded
        />,
      )
    })

    const nextButton = tree.root.findByProps({ accessibilityLabel: 'Next slide' })

    await act(async () => {
      nextButton.props.onPress()
    })

    const previousFrameInstances = tree.root.findAll(
      (node: any) =>
        node.type === 'mock-image-card-media' &&
        typeof node.props?.src === 'string' &&
        node.props.src.includes('img-1.jpg'),
    )

    expect(previousFrameInstances).toHaveLength(1)
  })

  it('does not report the first slide as loaded before the actual image onLoad fires', async () => {
    const onFirstImageLoad = jest.fn()

    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        <SliderWeb
          images={[{ id: 'img-1', url: 'https://example.com/img.jpg' }] as any}
          showArrows={false}
          showDots={false}
          autoPlay={false}
          preloadCount={0}
          blurBackground={false}
          firstImagePreloaded
          onFirstImageLoad={onFirstImageLoad}
        />,
      )
    })

    expect(onFirstImageLoad).not.toHaveBeenCalled()

    const firstSlideImage = tree.root.findByProps({ testID: 'slider-image-0' })

    await act(async () => {
      firstSlideImage.props.onLoad()
    })

    expect(onFirstImageLoad).toHaveBeenCalledTimes(1)
  })
})
