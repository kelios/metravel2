/**
 * @jest-environment jsdom
 */

import { PixelRatio, Platform } from 'react-native'

import { buildUriNative } from '@/components/travel/sliderParts/utils'

const widthOf = (src: string) => {
  const m = src.match(/[?&]w=(\d+)/)
  return m ? Number(m[1]) : NaN
}

const qualityOf = (src: string) => {
  const m = src.match(/[?&]q=(\d+)/)
  return m ? Number(m[1]) : NaN
}

describe('sliderParts/utils buildUriNative (native)', () => {
  const originalPlatform = Platform.OS
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL

  beforeEach(() => {
    ;(Platform as any).OS = 'ios'
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
    ;(window as any).devicePixelRatio = 3
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl
  })

  const img = {
    id: 'n-1',
    url: 'https://metravel.by/gallery/123/photo.jpg',
    width: 1600,
    height: 900,
  } as any

  const imgWithoutDimensions = {
    id: 'n-2',
    url: 'https://metravel.by/gallery/124/photo.jpg',
  } as any

  it('caps neighbour slide width below the active slide on a retina phone', () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3)
    const first = buildUriNative(img, 390, 812, true)
    const neighbour = buildUriNative(img, 390, 812, false)

    // 390×3 = 1170: активный слайд упирается в потолок 1024 (следующая ступень
    // «лестницы» 1280 весит почти как оригинал), сосед — в 800.
    expect(widthOf(first)).toBe(1024)
    expect(widthOf(neighbour)).toBe(800)
    // q квантуется прокси шагом 10; было 75/70 — на оригинале 1080×1080 это
    // экономило меньше 20% веса.
    expect(qualityOf(first)).toBe(60)
    expect(qualityOf(neighbour)).toBe(60)
  })

  it('sizes the URL even when the gallery payload has no width/height', () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3)
    const first = buildUriNative(imgWithoutDimensions, 390, 812, true)

    // Раньше эта ветка отдавала версионированный оригинал (≈325 КБ на фото) —
    // gallery-пейлоад бэка не содержит width/height ни для одного путешествия.
    expect(widthOf(first)).toBe(1024)
    expect(first).toContain('q=60')
  })

  it('follows the real device DPR instead of window.devicePixelRatio', () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(2)
    const first = buildUriNative(img, 390, 812, true)

    // 390×2 = 780 → ступень 800; window.devicePixelRatio (3 в jsdom) не участвует.
    expect(widthOf(first)).toBe(800)
  })
})
