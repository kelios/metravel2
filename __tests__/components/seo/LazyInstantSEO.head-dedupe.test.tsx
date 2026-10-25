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
import LazyInstantSEO from '@/components/seo/LazyInstantSEO'
import { resetHeadManagerForTests } from '@/utils/webHeadManager'

const mockUseIsFocused = jest.fn(() => true)

jest.mock('expo-router', () => ({
  useIsFocused: () => mockUseIsFocused(),
}))

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: () => null,
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
  let container: HTMLDivElement
  let root: Root | null

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  afterAll(() => {
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
    appendExportHead('Квесты и маршруты | Metravel', 'Русское описание главной')
    const be = { title: 'Квэсты і маршруты | Metravel', description: 'Беларускае апісанне галоўнай' }
    const en = { title: 'City Quests and Routes | Metravel', description: 'English home description' }

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
    appendExportHead('Static home | Metravel', 'Static home description')
    await act(async () => {
      root?.render(<LazyInstantSEO key="home" title="Home | Metravel" description="Home description" />)
    })

    window.history.pushState(null, '', '/quests')
    await act(async () => {
      root?.render(
        <LazyInstantSEO
          key="quests"
          title="Квесты | Metravel"
          description="Quest catalogue description"
          canonical="https://metravel.by/quests"
        />,
      )
    })

    expectSingleHead('Квесты | Metravel', 'Quest catalogue description')
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://metravel.by/quests')
    // og:image объявлял только экспорт главной.
    expect(document.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(0)
    expect(document.head.innerHTML).not.toContain('Home description')
    expect(document.head.innerHTML).not.toContain('Static home')
  })

  it('экран не в фокусе не пишет head; возврат фокуса возвращает его значения', async () => {
    await act(async () => {
      root?.render(<LazyInstantSEO title="Article | Metravel" description="Article description" />)
    })
    mockUseIsFocused.mockReturnValue(false)
    await act(async () => {
      root?.render(<LazyInstantSEO title="Article v2 | Metravel" description="Article description" />)
    })
    expect(document.title).toBe('Article | Metravel')

    mockUseIsFocused.mockReturnValue(true)
    await act(async () => {
      root?.render(<LazyInstantSEO title="Article v2 | Metravel" description="Article description" />)
    })
    expectSingleHead('Article v2 | Metravel', 'Article description')
  })

  it('ключ без значения снимается: страница без description не оставляет чужой', async () => {
    await act(async () => {
      root?.render(<LazyInstantSEO title="Home | Metravel" description="Home description" />)
    })
    await act(async () => {
      root?.render(<LazyInstantSEO title="Trips | Metravel" />)
    })
    expect(document.title).toBe('Trips | Metravel')
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      expect(document.head.querySelectorAll(selector)).toHaveLength(0)
    }
  })
})
