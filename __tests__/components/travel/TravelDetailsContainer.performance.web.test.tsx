import { fireEvent, render } from '@testing-library/react'

jest.mock('expo-image', () => {
  const React = require('react')
  return {
    Image: ({ source }: { source?: { blurhash?: string } }) =>
      React.createElement('img', {
        'aria-hidden': 'true',
        'data-local-blurhash': source?.blurhash || '',
      }),
  }
})

describe('TravelDetailsContainer performance (web)', () => {
  let __testables: any

  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: any) => obj.web || obj.default

    // Important: require AFTER Platform.OS is set, and do not reset modules.
    __testables = require('@/components/travel/details/TravelDetailsHero').__testables
  })

  beforeEach(() => {
    document.head.innerHTML = ''
    ;(window as any).innerWidth = 1200
    ;(window as any).devicePixelRatio = 1
  })

  it('OptimizedLCPHero renders an eager high-priority LCP image', () => {
    const { container } = render(
      <__testables.OptimizedLCPHero
        img={{
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        }}
        alt='Hero image'
        isMobile={false}
        height={600}
      />,
    )

    const lcpImg = container.querySelector('img[data-lcp]') as HTMLImageElement | null
    expect(lcpImg).toBeTruthy()
    expect(lcpImg?.getAttribute('loading')).toBe('eager')
    expect(lcpImg?.getAttribute('fetchpriority')).toBe('high')
    expect(lcpImg?.getAttribute('alt')).toBe('Hero image')
    expect(lcpImg?.style.objectFit).toBe('contain')
  })

  it('shows the first photo caption while the optimized hero owns the visible image', () => {
    const { getByTestId, getByText } = render(
      <__testables.OptimizedLCPHero
        img={{
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          id: 1,
        }}
        caption="Закат над Браславскими озёрами"
        alt="Закат над Браславскими озёрами"
        isMobile={false}
        height={600}
      />,
    )

    expect(getByTestId('travel-hero-caption')).toBeTruthy()
    expect(getByText('Закат над Браславскими озёрами')).toBeTruthy()
  })

  // #1208: hero на web рисует ОДИН растр. Второго изображения (размытой копии
  // того же фото в полях letterbox) быть не должно ни в каком виде: ни вторым
  // `<img>`, ни CSS `background-image`.
  it('renders exactly one raster: no blur backdrop layers and no second image URL', () => {
    const { container } = render(
      <__testables.OptimizedLCPHero
        img={{
          url: 'https://metravel.by/gallery/540/gallery/79641dcc63dc476bb89dd66a9faa8527.JPG',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        }}
        alt='Hero image'
        isMobile={false}
        height={600}
      />,
    )

    const lcpImg = container.querySelector('img[data-lcp]') as HTMLImageElement | null

    expect(lcpImg).toBeTruthy()
    expect(lcpImg?.getAttribute('src')).toContain('w=1280')
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelectorAll('[data-hero-backdrop-segment="true"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-hero-backdrop-layer="true"]')).toHaveLength(0)
    // Ни один элемент не тянет картинку фоном — прежняя подложка жила именно так.
    expect(container.innerHTML).not.toContain('background-image')
    // Прежняя подложка просила отдельную ступень `w=96` — её быть не должно
    // (`w=960` из srcSet под это не попадает).
    expect(container.innerHTML).not.toMatch(/w=96(?!\d)/)

    if (lcpImg) {
      fireEvent.load(lcpImg)
    }

    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  // #1208: поля letterbox заливает `dominant_color` из манифеста. Blurhash на web
  // в слой не идёт — expo-image декодирует его в `blob:`-PNG, то есть это снова
  // второй растр (то же решение, что в `ImageCardMedia`).
  it('fills hero letterbox from dominant_color and never rasterizes blurhash on web', () => {
    const { container } = render(
      <__testables.OptimizedLCPHero
        img={{
          url: 'https://metravel.by/gallery/540/gallery/photo.jpg',
          width: 1200,
          height: 800,
          id: 7,
        }}
        media={{
          id: 7,
          blurhash: 'LEHL6nWB2yk8pyo0adR*.7kCMdnj',
          dominant_color: '#123456',
          lqip_url: 'https://metravel.by/gallery/540/gallery/photo-lqip.jpg',
        }}
        alt="Hero image"
        isMobile={false}
        height={600}
      />,
    )

    const fillLayer = container.querySelector('[data-hero-data-placeholder="true"]')

    expect(fillLayer).toBeTruthy()
    expect(fillLayer?.innerHTML).not.toContain('data-local-blurhash')
    expect(container.querySelectorAll('[data-hero-backdrop-segment="true"]')).toHaveLength(0)
    expect(container.innerHTML).not.toContain('photo-lqip.jpg')
    expect(container.querySelectorAll('img[data-lcp]')).toHaveLength(1)
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('keeps mobile hero URL preload-friendly on high-DPR web devices', () => {
    ;(window as any).innerWidth = 390
    ;(window as any).devicePixelRatio = 3

    const { container } = render(
      <__testables.OptimizedLCPHero
        img={{
          url: 'https://metravel.by/gallery/540/gallery/79641dcc63dc476bb89dd66a9faa8527.JPG',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        }}
        alt='Hero image'
        isMobile
        height={520}
      />,
    )

    const lcpImg = container.querySelector('img[data-lcp]') as HTMLImageElement | null
    expect(lcpImg).toBeTruthy()
    // #1170: слот 390 CSS на высоком DPR даёт запрос 720 — ступень 720 вернули в
    // лестницу, и она больше не округляется вверх до 800. SSG-зеркало лестницы
    // (`scripts/generate-seo-pages.js`) обновлено тем же коммитом, поэтому preload и
    // `<img>` по-прежнему просят один URL (инвариант #1146).
    expect(lcpImg?.getAttribute('src')).toContain('w=720')
    expect(lcpImg?.getAttribute('src')).not.toContain('dpr=')
    expect(lcpImg?.getAttribute('srcset')).toContain('w=640')
    // #1170: верхний кандидат мобильного hero — 720. SSG объявляет мобильные ширины
    // ровно [320,480,640,720] (`scripts/generate-seo-pages.js`), и теперь они
    // отображаются один-в-один вместо прежнего округления 720 → 800.
    expect(lcpImg?.getAttribute('srcset')).toContain('w=720')
    expect(lcpImg?.getAttribute('srcset')).not.toContain('dpr=')
  })

  it('renders a neutral hero placeholder without visible text when the LCP image fails', () => {
    const { container, queryByText } = render(
      <__testables.OptimizedLCPHero
        img={{
          url: 'https://cdn.example.com/missing.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        }}
        alt='Hero image'
        isMobile={false}
        height={600}
      />,
    )

    const lcpImg = container.querySelector('img[data-lcp]') as HTMLImageElement | null
    expect(lcpImg).toBeTruthy()

    if (lcpImg) {
      fireEvent.error(lcpImg)
    }

    const placeholder = container.querySelector(
      '[data-testid="travel-hero-neutral-placeholder"]',
    ) as HTMLDivElement | null

    expect(placeholder).toBeTruthy()
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true')
    expect(placeholder?.getAttribute('role')).toBeNull()
    expect(placeholder?.getAttribute('aria-label')).toBeNull()
    expect(queryByText('Фото недоступно')).toBeNull()
    expect(placeholder?.textContent).toBe('')
  })

  // useLCPPreload was removed — preloading is handled by the inline script in +html.tsx
})
