import {
  buildNativeLoopData,
  getNativeLoopPageOffset,
  shouldEnableNativeLoop,
  toNativeLoopRawIndex,
  toNativeLoopRealIndex,
} from '@/components/travel/sliderParts/nativeLoop'
import {
  IOS_TOUCH_END_OPTIONS,
  IOS_TOUCH_MOVE_OPTIONS,
  IOS_TOUCH_START_OPTIONS,
} from '@/components/travel/sliderParts/useSliderPointerDrag'
import type { SliderImage } from '@/components/travel/sliderParts/types'

const images: SliderImage[] = [
  { id: 'one', url: 'https://example.com/one.jpg' },
  { id: 'two', url: 'https://example.com/two.jpg' },
  { id: 'three', url: 'https://example.com/three.jpg' },
]

describe('native slider loop helpers', () => {
  it('keeps loop disabled on web and in tests but enabled for production native multi-image sliders', () => {
    expect(shouldEnableNativeLoop({ isWeb: true, isTestEnv: false, imagesLength: 3 })).toBe(false)
    expect(shouldEnableNativeLoop({ isWeb: false, isTestEnv: true, imagesLength: 3 })).toBe(false)
    expect(shouldEnableNativeLoop({ isWeb: false, isTestEnv: false, imagesLength: 1 })).toBe(false)
    expect(shouldEnableNativeLoop({ isWeb: false, isTestEnv: false, imagesLength: 3 })).toBe(true)
  })

  it('builds native loop data with edge clones around the real slides', () => {
    expect(buildNativeLoopData(images, false)).toBe(images)
    expect(buildNativeLoopData(images, true).map((image) => image.id)).toEqual([
      'three',
      'one',
      'two',
      'three',
      'one',
    ])
  })

  it('maps raw and real indices so the first real slide starts at one page width', () => {
    expect(toNativeLoopRawIndex(0, true)).toBe(1)
    expect(toNativeLoopRealIndex(1, images.length, true)).toBe(0)
    expect(toNativeLoopRealIndex(0, images.length, true)).toBe(2)
    expect(toNativeLoopRealIndex(4, images.length, true)).toBe(0)

    expect(
      getNativeLoopPageOffset({
        realIndex: 0,
        pageWidth: 390,
        loopEnabled: true,
      }),
    ).toBe(390)
  })
})

describe('iOS web slider touch listener options', () => {
  it('claims move events as non-passive and captures touch completion before nested media can swallow it', () => {
    expect(IOS_TOUCH_START_OPTIONS).toEqual({ passive: true, capture: true })
    expect(IOS_TOUCH_MOVE_OPTIONS).toEqual({ passive: false, capture: true })
    expect(IOS_TOUCH_END_OPTIONS).toEqual({ passive: true, capture: true })
  })
})
