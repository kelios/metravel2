import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

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

  it('prefetches neighboring native slides on initial slider warmup', async () => {
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

    await waitFor(() => {
      expect(prefetchImage).toHaveBeenCalledWith(
        expect.stringContaining('second.jpg?w=360'),
      )
    })
  })

  it('prefetches the second neighbor when native slider asks for wider warmup', async () => {
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
        expect.stringContaining('second.jpg?w=360'),
      )
      expect(prefetchImage).toHaveBeenCalledWith(
        expect.stringContaining('third.jpg?w=360'),
      )
    })
  })
})
