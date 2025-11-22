import React from 'react'
import { act, render, type RenderAPI } from '@testing-library/react-native'
import Slider, { type SliderImage } from '@/components/travel/Slider'

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
})
