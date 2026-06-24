import { renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelDetailsHeroCompositionModel } from '@/components/travel/details/hooks/useTravelDetailsHeroCompositionModel'

describe('useTravelDetailsHeroCompositionModel', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
  })

  const renderModel = (webHeroLoaded: boolean) =>
    renderHook(() =>
      useTravelDetailsHeroCompositionModel({
        firstImg: { url: 'https://example.com/hero.jpg' },
        heroContainerWidth: 720,
        heroSliderImages: [{ url: 'https://example.com/hero.jpg' }, { url: 'https://example.com/second.jpg' }],
        isMobile: false,
        renderSlider: true,
        setHeroContainerWidth: jest.fn(),
        sliderUpgradeAllowed: true,
        webHeroLoaded,
      }),
    )

  it('does not mount the web slider under the LCP overlay before the LCP image loads', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })

    const { result } = renderModel(false)

    expect(result.current.shouldRenderWebOptimizedHero).toBe(true)
    expect(result.current.shouldRenderWebSlider).toBe(false)
  })

  it('allows the web slider after the LCP image has loaded', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })

    const { result } = renderModel(true)

    expect(result.current.shouldRenderWebSlider).toBe(true)
  })
})
