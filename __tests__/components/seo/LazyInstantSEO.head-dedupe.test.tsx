/**
 * @jest-environment jsdom
 */

/**
 * #2756: SEO-теги пишет менеджер head (`utils/webHeadManager`), а не helmet-копии
 * рядом с тегами экспорта. Здесь — контракты экрана поверх него: локализация
 * главной поверх RU-экспорта (#1613), один тег на ключ после SPA-перехода и
 * то, что значения главной не утекают на другие страницы.
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Platform } from 'react-native'
import { HelmetProvider } from 'expo-router/vendor/react-helmet-async/lib'
import LazyInstantSEO from '@/components/seo/LazyInstantSEO'
import { resetHeadManagerForTests } from '@/utils/webHeadManager'

const mockUseIsFocused = jest.fn(() => true)

jest.mock('expo-router', () => ({
  useIsFocused: () => mockUseIsFocused(),
}))

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => {
    const { Helmet, HelmetProvider } = require('expo-router/vendor/react-helmet-async/lib')
    return <HelmetProvider><Helmet defer={false}>{children}</Helmet></HelmetProvider>
  },
}))

const META_SELECTORS = [
  'meta[name="description"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
]

const appendExportHead = (title: string, description: string) => {
  document.head.insertAdjacentHTML('beforeend', [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    '<link rel="canonical" href="https://metravel.by/">',
    '<meta property="og:image" content="https://metravel.by/og/home.jpg">',
  ].join(''))
}

const expectSingleHead = (title: string, description: string) => {
  expect(document.head.querySelectorAll('title')).toHaveLength(1)
  expect(document.title).toBe(title)
  for (const selector of META_SELECTORS) {
    const nodes = document.head.querySelectorAll(selector)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].getAttribute('content')).toBe(selector.includes('title') ? title : description)
  }
}

describe('LazyInstantSEO head ownership (#2756)', () => {
  const originalPlatform = Platform.OS
  const originalCanUseDOM = HelmetProvider.canUseDOM
  let container: HTMLDivElement
  let root: Root | null

  beforeAll(() => {
    HelmetProvider.canUseDOM = true
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  afterAll(() => {
    HelmetProvider.canUseDOM = originalCanUseDOM
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })

  beforeEach(() => {
    mockUseIsFocused.mockReturnValue(true)
    resetHeadManagerForTests()
    window.history.replaceState(null, '', '/')
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root?.unmount()
    })
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('пишет локализованные значения главной в теги RU-экспорта и следует за сменой языка', async () => {
    appendExportHead('Квесты и маршруты | MeTravel', 'Русское описание главной')
    const be = { title: 'Квэсты і маршруты | MeTravel', description: 'Беларускае апісанне галоўнай' }
    const en = { title: 'City Quests and Routes | MeTravel', description: 'English home description' }

    await act(async () => {
      root?.render(<LazyInstantSEO {...be} canonical="https://metravel.by/" />)
    })
    expectSingleHead(be.title, be.description)

    await act(async () => {
      root?.render(<LazyInstantSEO {...en} canonical="https://metravel.by/" />)
    })
    expectSingleHead(en.title, en.description)
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
  })

  it('после SPA-перехода по одному тегу каждого ключа, значения главной не утекают (#1613)', async () => {
    appendExportHead('Static home | MeTravel', 'Static home description')
    await act(async () => {
      root?.render(<LazyInstantSEO key="home" title="Home | MeTravel" description="Home description" />)
    })

    window.history.pushState(null, '', '/quests')
    await act(async () => {
      root?.render(
        <LazyInstantSEO
          key="quests"
          title="Квесты | MeTravel"
          description="Quest catalogue description"
          canonical="https://metravel.by/quests"
        />,
      )
    })

    expectSingleHead('Квесты | MeTravel', 'Quest catalogue description')
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://metravel.by/quests')
    // og:image объявлял только экспорт главной.
    expect(document.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(0)
    expect(document.head.innerHTML).not.toContain('Home description')
    expect(document.head.innerHTML).not.toContain('Static home')
  })

  it('экран не в фокусе не пишет head; возврат фокуса возвращает его значения', async () => {
    await act(async () => {
      root?.render(<LazyInstantSEO title="Article | MeTravel" description="Article description" />)
    })
    mockUseIsFocused.mockReturnValue(false)
    await act(async () => {
      root?.render(<LazyInstantSEO title="Article v2 | MeTravel" description="Article description" />)
    })
    expect(document.title).toBe('Article | MeTravel')

    mockUseIsFocused.mockReturnValue(true)
    await act(async () => {
      root?.render(<LazyInstantSEO title="Article v2 | MeTravel" description="Article description" />)
    })
    expectSingleHead('Article v2 | MeTravel', 'Article description')
  })

  it('ключ без значения снимается: страница без description не оставляет чужой', async () => {
    await act(async () => {
      root?.render(<LazyInstantSEO title="Home | MeTravel" description="Home description" />)
    })
    await act(async () => {
      root?.render(<LazyInstantSEO title="Trips | MeTravel" />)
    })
    expect(document.title).toBe('Trips | MeTravel')
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      expect(document.head.querySelectorAll(selector)).toHaveLength(0)
    }
  })

  it.each(['/quests/subotica', '/quests/217/subotica'])('сохраняет build-owned noindex на %s после обновлений Helmet (#3444)', async (path) => {
    window.history.replaceState(null, '', path)
    document.head.innerHTML = '<meta name="robots" content="noindex, follow">'
    // Временный SSR-документ объявляет robots до передачи клиентскому экрану,
    // который не может вычислить вердикт по всей прозовой когорте сборки.
    await act(async () => {
      root?.render(<LazyInstantSEO key="ssr" title="Server quest page" robots="noindex, follow" />)
    })
    for (const revision of [1, 2]) {
      await act(async () => {
        root?.render(<LazyInstantSEO key="client" title={`Quest page ${revision}`} additionalTags={
          <script type="application/ld+json">{JSON.stringify({ '@type': 'WebPage', name: `Revision ${revision}` })}</script>
        } />)
      })
      expect(document.head.querySelectorAll('script[data-rh="true"]')).toHaveLength(1)
      const robots = document.head.querySelectorAll('meta[name="robots"]')
      expect(robots).toHaveLength(1)
      expect(robots[0].getAttribute('content')).toBe('noindex, follow')
      expect(robots[0].hasAttribute('data-rh')).toBe(false)
    }
    window.history.pushState(null, '', '/quests')
    await act(async () => {
      root?.render(<LazyInstantSEO key="catalog" title="Quest catalog" />)
    })
    const { siteDefaultRobots } = require('@/utils/seo')
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(siteDefaultRobots())
  })

  it('возвращает исходный robots после временного noindex на том же URL (#3444)', async () => {
    window.history.replaceState(null, '', '/quests/217/subotica')
    document.head.innerHTML = '<meta name="robots" content="index, follow">'
    await act(async () => {
      root?.render(<LazyInstantSEO key="ssr" title="Server quest" robots="index, follow" />)
    })
    await act(async () => {
      root?.render(<LazyInstantSEO key="offline" title="Temporarily unavailable" robots="noindex, follow" />)
    })
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow')
    await act(async () => {
      root?.render(<LazyInstantSEO key="client" title="Available quest" />)
    })
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow')
  })
})
