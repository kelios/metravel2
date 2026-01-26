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

describe('Slider (web) side blur panels', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('renders side blur panels when blurBackground is enabled and image dimensions are missing (fallback)', async () => {
    const tree = renderer.create(
      <SliderWeb
        images={[{ id: 'img-1', url: 'https://example.com/img.jpg' }] as any}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground
      />,
    )

    await act(async () => {})

    expect(tree.root.findByProps({ testID: 'slider-side-blur-left-0' })).toBeTruthy()
    expect(tree.root.findByProps({ testID: 'slider-side-blur-right-0' })).toBeTruthy()
  })

  it('does not render side blur panels when blurBackground is disabled', async () => {
    const tree = renderer.create(
      <SliderWeb
        images={[{ id: 'img-1', url: 'https://example.com/img.jpg' }] as any}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
      />,
    )

    await act(async () => {})

    const left = tree.root.findAllByProps({ testID: 'slider-side-blur-left-0' })
    const right = tree.root.findAllByProps({ testID: 'slider-side-blur-right-0' })
    expect(left.length).toBe(0)
    expect(right.length).toBe(0)
  })
})
