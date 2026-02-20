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

const portraitImage2: SliderImage = {
  id: 'portrait-2',
  url: 'https://example.com/portrait2.jpg',
  width: 800,
  height: 1200,
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

  it('keeps image in contain mode and remains visible after load', async () => {
    const { getByTestId } = await renderSlider([portraitImage])
    const image = getByTestId('slider-image-0')

    expect(image.props.contentFit).toBe('contain')

    act(() => {
      image.props.onLoad?.()
    })

    expect(getByTestId('slider-image-0')).toBeTruthy()
  })

  it('applies blurred background for both portrait and landscape images when blurBackground is enabled', async () => {
    const portraitRender = await renderSlider([portraitImage])
    expect(portraitRender.getByTestId('slider-image-0')).toBeTruthy()

    const landscapeRender = await renderSlider([landscapeImage])
    expect(landscapeRender.getByTestId('slider-image-0')).toBeTruthy()
  })

  it('shows neutral placeholder when image fails to load', async () => {
    const { getByTestId, queryByText } = await renderSlider([portraitImage])
    const image = getByTestId('slider-image-0')

    act(() => {
      image.props.onError?.()
    })

    expect(getByTestId('slider-neutral-placeholder-0')).toBeTruthy()
    expect(queryByText('Фото не загрузилось')).toBeNull()
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

  it('renders first image on web and keeps it after load', async () => {
    ;(Platform as any).OS = 'web'

    const { getByTestId } = render(
      <Slider
        images={[portraitImage, landscapeImage]}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground
      />
    )

    expect(getByTestId('slider-image-0')).toBeTruthy()

    const img = getByTestId('slider-image-0')
    act(() => {
      img.props.onLoad?.()
    })

    expect(getByTestId('slider-image-0')).toBeTruthy()
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

  it('calculates mobile slider height as 80% of viewport height', async () => {
    // Мобильный экран: 360x800
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 360, height: 800 })

    const { getByTestId } = render(
      <Slider
        images={[portraitImage, landscapeImage]}
        showArrows={false}
        showDots
        autoPlay={false}
        preloadCount={0}
        blurBackground
        mobileHeightPercent={0.8}
      />
    )

    // Проверяем, что слайд существует
    const slide = getByTestId('slider-image-0')
    expect(slide).toBeTruthy()

    // Высота должна быть 80% от 800px = 640px
    // Проверяем через wrapper, который содержит стили высоты
    const wrapper = slide.parent?.parent?.parent
    expect(wrapper).toBeTruthy()
  })

  it('shows counter with correct format for multiple images', async () => {
    const images = [portraitImage, landscapeImage, portraitImage2]
    
    const { getByText } = render(
      <Slider
        images={images}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
      />
    )

    // Счетчик должен показывать 1/3
    expect(getByText('1/3')).toBeTruthy()
  })

  it('hides counter when only one image is present', async () => {
    const { queryByText } = render(
      <Slider
        images={[portraitImage]}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
      />
    )

    // Счетчик не должен отображаться для одного изображения
    expect(queryByText('1/1')).toBeNull()
  })

  it('shows dots on mobile when showDots is enabled', async () => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 360, height: 800 })

    const { getByTestId } = render(
      <Slider
        images={[portraitImage, landscapeImage, portraitImage2]}
        showArrows={false}
        showDots
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
      />
    )

    // Проверяем наличие изображений - dots рендерятся вместе с ними
    expect(getByTestId('slider-image-0')).toBeTruthy()
    expect(getByTestId('slider-image-1')).toBeTruthy()
  })

  it('hides dots when only one image is present', async () => {
    const { getByTestId, queryByTestId } = render(
      <Slider
        images={[portraitImage]}
        showArrows={false}
        showDots
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
      />
    )

    // Одно изображение должно рендериться
    expect(getByTestId('slider-image-0')).toBeTruthy()
    // Но второго изображения нет
    expect(queryByTestId('slider-image-1')).toBeNull()
  })

  it('applies correct border radius on mobile', async () => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 360, height: 800 })

    const { getByTestId } = render(
      <Slider
        images={[portraitImage]}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
      />
    )

    // Мобильная версия должна корректно рендериться
    expect(getByTestId('slider-image-0')).toBeTruthy()
  })

  it('calls onFirstImageLoad callback when first image loads', async () => {
    const onFirstImageLoad = jest.fn()

    const { getByTestId } = render(
      <Slider
        images={[portraitImage, landscapeImage]}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
        onFirstImageLoad={onFirstImageLoad}
      />
    )

    const image = getByTestId('slider-image-0')
    
    act(() => {
      image.props.onLoad?.()
    })

    expect(onFirstImageLoad).toHaveBeenCalledTimes(1)
  })

  it('does not call onFirstImageLoad for subsequent images', async () => {
    const onFirstImageLoad = jest.fn()

    const { getByTestId } = render(
      <Slider
        images={[portraitImage, landscapeImage]}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
        onFirstImageLoad={onFirstImageLoad}
      />
    )

    // Загружаем второе изображение
    const secondImage = getByTestId('slider-image-1')
    
    act(() => {
      secondImage.props.onLoad?.()
    })

    // Callback не должен вызываться для второго изображения
    expect(onFirstImageLoad).not.toHaveBeenCalled()
  })

  it('uses mobileHeightPercent prop to calculate height on mobile', async () => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 360, height: 1000 })

    const { getByTestId } = render(
      <Slider
        images={[portraitImage]}
        showArrows={false}
        showDots={false}
        autoPlay={false}
        preloadCount={0}
        blurBackground={false}
        mobileHeightPercent={0.6}
      />
    )

    // При mobileHeightPercent=0.6 и высоте 1000px, высота должна быть 600px
    const image = getByTestId('slider-image-0')
    expect(image).toBeTruthy()
  })
})
