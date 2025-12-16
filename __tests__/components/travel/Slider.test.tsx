import React from 'react'
import { act, fireEvent, render, type RenderAPI } from '@testing-library/react-native'
import { Platform } from 'react-native'
import Slider, { type SliderImage } from '@/components/travel/Slider'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
}))

const portraitImage: SliderImage = {
  id: 'portrait',
  url: 'https://example.com/portrait.jpg',
  width: 800,
  height: 1200,
}

const landscapeImage: SliderImage = {
  id: 'landscape',
  url: 'https://example.com/landscape.jpg',
  width: 1600,
  height: 900,
}

const renderSlider = async (images: SliderImage[]): Promise<RenderAPI> => {
  const api = render(
    <Slider
      images={images}
      showArrows={false}
      showDots={false}
      autoPlay={false}
      preloadCount={0}
      blurBackground
    />
  )

  await act(async () => {})
  return api
}

describe('Slider', () => {
  const originalPlatform = Platform.OS
  const RN = require('react-native')

  beforeEach(() => {
    // jest.clearAllMocks() runs globally in __tests__/setup.ts and wipes the mock implementation.
    // Re-apply a safe default so Slider can render.
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 })
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('keeps image in contain mode and hides loader after load', async () => {
    const { getByTestId, queryByTestId } = await renderSlider([portraitImage])
    const image = getByTestId('slider-image-0')

    expect(image.props.contentFit).toBe('contain')
    expect(getByTestId('slider-loading-overlay-0')).toBeTruthy()

    act(() => {
      image.props.onLoad?.()
    })

    expect(queryByTestId('slider-loading-overlay-0')).toBeNull()
  })

  it('applies blurred background for both portrait and landscape images when blurBackground is enabled', async () => {
    const portraitRender = await renderSlider([portraitImage])
    expect(portraitRender.getByTestId('slider-blur-bg-0')).toBeTruthy()

    const landscapeRender = await renderSlider([landscapeImage])
    expect(landscapeRender.getByTestId('slider-blur-bg-0')).toBeTruthy()
  })

  it('shows placeholder when image fails to load', async () => {
    const { getByTestId, getByText, queryByTestId } = await renderSlider([portraitImage])
    const image = getByTestId('slider-image-0')

    act(() => {
      image.props.onError?.()
    })

    expect(getByTestId('slider-placeholder-0')).toBeTruthy()
    expect(getByText('Фото не загрузилось')).toBeTruthy()
    expect(queryByTestId('slider-loading-overlay-0')).toBeNull()
  })

  it('renders arrows on desktop when enabled and hides them on mobile when hideArrowsOnMobile is true', async () => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 900 })

    const apiDesktop = render(
      <Slider
        images={[portraitImage, landscapeImage]}
        showArrows
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
      />
    )

    expect(apiDesktop.getByLabelText('Previous slide')).toBeTruthy()
    expect(apiDesktop.getByLabelText('Next slide')).toBeTruthy()

    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 360, height: 800 })

    const apiMobile = render(
      <Slider
        images={[portraitImage, landscapeImage]}
        showArrows
        showDots={false}
        hideArrowsOnMobile
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
      />
    )

    expect(apiMobile.queryByLabelText('Previous slide')).toBeNull()
    expect(apiMobile.queryByLabelText('Next slide')).toBeNull()
  })

  it('uses flat background for web first slide while not loaded, then shows blur background after load', async () => {
    ;(Platform as any).OS = 'web'

    const { getByTestId, queryByTestId } = render(
      <Slider
        images={[portraitImage, landscapeImage]}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground
      />
    )

    // Web + first slide + status=loading => shouldRenderBlurBg=false
    expect(getByTestId('slider-flat-bg-0')).toBeTruthy()
    expect(queryByTestId('slider-blur-bg-0')).toBeNull()

    const img = getByTestId('slider-image-0')
    act(() => {
      img.props.onLoad?.()
    })

    expect(queryByTestId('slider-flat-bg-0')).toBeNull()
    expect(getByTestId('slider-blur-bg-0')).toBeTruthy()
  })

  it('updates counter when navigating to the next slide via arrow', async () => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 900 })

    const { getByLabelText, getByText } = render(
      <Slider
        images={[portraitImage, landscapeImage]}
        showArrows
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
      />
    )

    expect(getByText('1/2')).toBeTruthy()
    fireEvent.press(getByLabelText('Next slide'))
    expect(getByText('2/2')).toBeTruthy()
  })
})
