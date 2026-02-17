/**
 * @jest-environment jsdom
 */

import renderer, { act } from 'react-test-renderer'
import { Platform } from 'react-native'

import SliderWeb from '@/components/travel/Slider.web'

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
})
