import { act, renderHook, waitFor } from '@testing-library/react-native'
import { AppState, Platform, type AppStateStatus } from 'react-native'

import { useSliderCore } from '@/components/travel/sliderParts/useSliderCore'
import { prefetchImage } from '@/components/ui/ImageCardMedia'
import type { SliderImage } from '@/components/travel/sliderParts/types'

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: () => null,
  prefetchImage: jest.fn(() => Promise.resolve()),
}))

const images: SliderImage[] = [
  { id: 'first', url: 'https://example.com/first.jpg', width: 1600, height: 900 },
  { id: 'second', url: 'https://example.com/second.jpg', width: 1600, height: 900 },
  { id: 'third', url: 'https://example.com/third.jpg', width: 1600, height: 900 },
  { id: 'fourth', url: 'https://example.com/fourth.jpg', width: 1600, height: 900 },
]

describe('useSliderCore native prefetch', () => {
  const originalOS = Platform.OS
  const RN = require('react-native')

  beforeEach(() => {
    ;(Platform as any).OS = 'android'
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({
      width: 360,
      height: 800,
      scale: 1,
      fontScale: 1,
    })
    ;(prefetchImage as jest.Mock).mockClear()
  })

  afterEach(() => {
    ;(Platform as any).OS = originalOS
  })

  it('does not duplicate the mounted native neighbor request on initial warmup', async () => {
    const { result } = renderHook(() =>
      useSliderCore({
        images,
        autoPlay: false,
        preloadCount: 1,
        buildUri: (image, width, height) => `${image.url}?w=${width}&h=${height}`,
      }),
    )

    act(() => {
      result.current.setContainerWidth(360)
    })

    await waitFor(() => expect(prefetchImage).not.toHaveBeenCalled())
  })

  it('prefetches only the unmounted second neighbor during wider native warmup', async () => {
    const { result } = renderHook(() =>
      useSliderCore({
        images,
        autoPlay: false,
        preloadCount: 2,
        buildUri: (image, width, height) => `${image.url}?w=${width}&h=${height}`,
      }),
    )

    act(() => {
      result.current.setContainerWidth(360)
    })

    await waitFor(() => {
      expect(prefetchImage).toHaveBeenCalledWith(
        expect.stringContaining('third.jpg?w=360'),
      )
    })
  })

  it('handles a native state change before the initial AppState is available', () => {
    const initialState = AppState.currentState
    let onChange: ((state: AppStateStatus) => void) | undefined
    const remove = jest.fn()
    const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'change') onChange = handler as (state: AppStateStatus) => void
      return { remove }
    })
    AppState.currentState = null
    try {
      const { unmount } = renderHook(() => useSliderCore({ images, autoPlay: false, buildUri: (image) => image.url }))
      expect(onChange).toBeDefined()
      expect(() => act(() => onChange?.('background'))).not.toThrow()
      expect(() => act(() => onChange?.('active'))).not.toThrow()
      unmount()
      expect(remove).toHaveBeenCalled()
    } finally {
      AppState.currentState = initialState
      subscription.mockRestore()
    }
  })

})
