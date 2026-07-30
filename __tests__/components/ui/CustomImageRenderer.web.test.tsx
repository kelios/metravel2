/**
 * #1114: фото тела статьи не должно ни приезжать оригиналом, ни обходить ленивость.
 *
 * Пейлоад статьи с прода содержит `<img src=".../-detail_hd.jpg">` без атрибутов
 * width/height/srcset (37 штук на travel #…-zamki-belarusi). Раньше рендерер
 * безусловно создавал `new Image()` с СЫРЫМ src ради пропорций: `loading = 'lazy'`
 * на detached-объекте браузер игнорирует, поэтому все 37 оригиналов стартовали
 * одним залпом. Замер прода 2026-07-28: без параметров 219 996 B / TTFB 2.33 с,
 * `?w=800&q=75&fit=contain` → 77 346 B / TTFB 1.15 с.
 */
import React from 'react'
import { Platform } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'

import CustomImageRenderer from '@/components/ui/CustomImageRenderer'

const mockImageCardMedia = jest.fn((props: any) => {
  const ReactLocal = require('react')
  const { View } = require('react-native')
  return ReactLocal.createElement(View, { testID: 'body-image-media', ...props })
})

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ width: 390, height: 812, isMobile: true }),
}))

const DETAIL_HD =
  'https://metravel.by/gallery/3514/conversions/UEx4Q47U0LQBOYhC7zs2d2Kchu5JHYdogjYDNCC2-detail_hd.jpg'

const makeTnode = (attributes: Record<string, string>) => ({ attributes })

class ImmediateImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  decoding = 'auto'
  naturalWidth = 1600
  naturalHeight = 1200
  #src = ''

  set src(value: string) {
    this.#src = value
    ImmediateImage.requested.push(value)
    setTimeout(() => this.onload?.(), 0)
  }

  get src() {
    return this.#src
  }

  static requested: string[] = []
}

describe('CustomImageRenderer body photos (web)', () => {
  const originalPlatform = Platform.OS
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL
  const originalImage = (globalThis as any).Image
  const originalIO = (globalThis as any).IntersectionObserver

  beforeEach(() => {
    Platform.OS = 'web'
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
    mockImageCardMedia.mockClear()
    ImmediateImage.requested = []
    ;(globalThis as any).Image = ImmediateImage
    ;(window as any).Image = ImmediateImage
    // Без IntersectionObserver гейт открыт — это и есть путь по умолчанию в jsdom.
    delete (globalThis as any).IntersectionObserver
  })

  afterEach(() => {
    Platform.OS = originalPlatform
  })

  afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl
    ;(globalThis as any).Image = originalImage
    ;(globalThis as any).IntersectionObserver = originalIO
  })

  it('hands ImageCardMedia a resized variant instead of the raw detail_hd original', () => {
    render(
      <CustomImageRenderer
        tnode={makeTnode({ src: DETAIL_HD, alt: 'Замок' }) as any}
        contentWidth={358}
      />,
    )

    const src: string = mockImageCardMedia.mock.calls[0]?.[0]?.src
    expect(src).toContain('w=800')
    expect(src).toContain('q=70')
    expect(src).toContain('fit=contain')
    // 800 — и рамка компонента, и ступень whitelist прокси. Ширины вне whitelist
    // (1024/2048) прокси отдаёт оригиналом, поэтому их быть не должно.
    expect(src).not.toMatch(/w=(1024|1600|2048)\b/)
    // Высота в URL делала ссылку зависимой от измеренных пропорций → второй запрос.
    expect(src).not.toMatch(/[?&]h=/)
  })

  it('measures aspect ratio through the same URL it renders, never the original', async () => {
    render(
      <CustomImageRenderer
        tnode={makeTnode({ src: DETAIL_HD, alt: 'Замок' }) as any}
        contentWidth={358}
      />,
    )

    await waitFor(() => expect(ImmediateImage.requested.length).toBeGreaterThan(0))

    const rendered: string = mockImageCardMedia.mock.calls[0]?.[0]?.src
    expect(ImmediateImage.requested).toEqual([rendered])
    // Тот же URL, что и у <img> → браузер отдаёт его из кэша, второй загрузки нет.
    expect(ImmediateImage.requested).not.toContain(DETAIL_HD)
  })

  // iPhone WebKit дорисовывает прогрессивный JPEG поэтапно: фото статьи появлялось
  // мутным кадром и «дорезкивалось» уже на экране. Список путешествий закрывает это
  // тем же decode-гейтом (`TravelListItem`: `revealOnLoadOnly: IS_WEB`).
  it('waits for the sharp decode on iOS WebKit so no progressive frame is shown', () => {
    const originalUserAgent = window.navigator.userAgent
    const originalMaxTouchPoints = window.navigator.maxTouchPoints
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    try {
      render(
        <CustomImageRenderer
          tnode={makeTnode({ src: DETAIL_HD, alt: 'Замок' }) as any}
          contentWidth={358}
        />,
      )

      expect(mockImageCardMedia.mock.calls[0]?.[0]?.revealOnLoadOnly).toBe(true)
    } finally {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      })
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        value: originalMaxTouchPoints,
        configurable: true,
      })
    }
  })

  it('does not delay body photos on engines without the progressive frame', () => {
    render(
      <CustomImageRenderer
        tnode={makeTnode({ src: DETAIL_HD, alt: 'Замок' }) as any}
        contentWidth={358}
      />,
    )

    expect(mockImageCardMedia.mock.calls[0]?.[0]?.revealOnLoadOnly).toBe(false)
  })

  it('skips the measuring request entirely when the HTML already carries dimensions', () => {
    render(
      <CustomImageRenderer
        tnode={makeTnode({ src: DETAIL_HD, alt: 'Замок', width: '1600', height: '1200' }) as any}
        contentWidth={358}
      />,
    )

    expect(ImmediateImage.requested).toEqual([])
  })

  // Вьюпортный гейт измерения (IntersectionObserver вокруг рамки) здесь не
  // проверяется намеренно: react-test-renderer не отдаёт настоящий DOM-узел, а без
  // него хук по контракту размыкается в «показать» — то есть такой тест зелёный
  // независимо от логики гейта. Гейт верифицируется в браузере: см. Progress Log
  // #1114 (число запросов к /gallery/ до и после прокрутки к телу статьи).
})
