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

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: 1200,
    height: 900,
    isPhone: false,
    isLargePhone: false,
  }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')

  return {
    __esModule: true,
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

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
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
    expect(tree.root.findByProps({ testID: 'slider-image-0' })).toBeTruthy()
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

  it('renders a shared blur backdrop layer on web when blurBackground is enabled', async () => {
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

    const sharedBackdrop = tree.root.findByProps({ testID: 'slider-shared-blur-backdrop' })
    expect(sharedBackdrop).toBeTruthy()
    expect(sharedBackdrop.props.blurOnly).toBe(true)
    expect(sharedBackdrop.props.allowCriticalWebBlur).toBe(true)
  })

  it('shows the previous loaded frame as overlay while the next slide is not loaded yet', async () => {
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

    expect(previousFrameInstances.length).toBeGreaterThan(1)
  })

  it('does not keep a sharp previous-frame overlay when blur background mode is enabled', async () => {
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

    expect(previousFrameInstances.length).toBe(2)
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
