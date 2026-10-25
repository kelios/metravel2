/**
 * @jest-environment jsdom
 */
// #2740: Expo SDK 58 writes the exported head from generateMetadata (no data-rh);
// helmet appends its own data-rh twins after hydration. The first LazyInstantSEO
// mount must leave exactly one tag per helmet-owned key.
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Platform } from 'react-native'
import LazyInstantSEO from '@/components/seo/LazyInstantSEO'

// null: helmet commits in the same effect pass; a number: after that many ms,
// like react-helmet-async's deferred (requestAnimationFrame) client update.
let mockHelmetDelayMs: number | null = null

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => {
    const mockReact = require('react') as typeof React
    // Emulate helmet: materialize meta/link children into <head> with data-rh.
    mockReact.useEffect(() => {
      const nodes: Element[] = []
      const commit = () => mockReact.Children.forEach(children as React.ReactNode, (child) => {
        if (!mockReact.isValidElement(child) || typeof child.type !== 'string' || child.type === 'title') return
        const el = globalThis.document.createElement(child.type)
        el.setAttribute('data-rh', 'true')
        for (const [name, value] of Object.entries(child.props as Record<string, unknown>)) {
          if (name !== 'children' && name !== 'key' && typeof value === 'string') el.setAttribute(name, value)
        }
        globalThis.document.head.appendChild(el)
        nodes.push(el)
      })
      const timer = mockHelmetDelayMs === null ? (commit(), undefined) : setTimeout(commit, mockHelmetDelayMs)
      return () => {
        if (timer !== undefined) clearTimeout(timer)
        nodes.forEach((el) => el.parentNode?.removeChild(el))
      }
    }, [children])
    return null
  },
}))

describe('LazyInstantSEO static head twins after hydration (#2740)', () => {
  const originalPlatform = Platform.OS
  let root: Root | null

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })
  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })
  beforeEach(() => {
    mockHelmetDelayMs = null
    document.head.innerHTML = ''
    document.head.removeAttribute('data-static-head-deduped')
    document.body.innerHTML = '<div id="root"></div>'
    root = createRoot(document.getElementById('root') as HTMLElement)
  })
  afterEach(async () => {
    await act(async () => {
      root?.unmount()
    })
  })

  it('keeps one description/canonical/og tag per key and leaves build-owned robots', async () => {
    document.head.insertAdjacentHTML('beforeend', [
      '<meta name="description" content="Export description">',
      '<meta name="robots" content="noindex, follow">',
      '<link rel="canonical" href="https://metravel.by/quests">',
      '<meta property="og:title" content="Export title">',
      '<meta property="og:locale" content="ru_RU">',
      '<meta name="twitter:site" content="@metravel_by">',
    ].join(''))

    await act(async () => {
      root?.render(
        <LazyInstantSEO title="Квесты | Metravel" description="Live description" canonical="https://metravel.by/quests" />,
      )
    })

    const contents = (selector: string) =>
      Array.from(document.head.querySelectorAll(selector)).map((node) => node.getAttribute('content') ?? node.getAttribute('href'))
    expect(contents('meta[name="description"]')).toEqual(['Live description'])
    expect(contents('link[rel="canonical"]')).toEqual(['https://metravel.by/quests'])
    expect(contents('meta[property="og:title"]')).toEqual(['Квесты | Metravel'])
    expect(contents('meta[property="og:locale"]')).toHaveLength(1)
    expect(contents('meta[name="twitter:site"]')).toEqual(['@metravel_by'])
    expect(contents('meta[name="robots"]')).toEqual(['noindex, follow'])
    expect(document.head.getAttribute('data-static-head-deduped')).toBe('true')
  })

  const contentsOf = (selector: string) =>
    Array.from(document.head.querySelectorAll(selector)).map((node) => node.getAttribute('content') ?? node.getAttribute('href'))
  const flushDeferredHelmet = () => act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  it('dedupes a non-SSG route whose head has no data-rh until helmet commits later', async () => {
    mockHelmetDelayMs = 5
    document.head.insertAdjacentHTML('beforeend', [
      '<meta name="description" content="Export description">',
      '<link rel="canonical" href="https://metravel.by/calendar">',
      '<meta property="og:title" content="Export title">',
      '<meta property="og:locale" content="ru_RU">',
    ].join(''))

    await act(async () => {
      root?.render(<LazyInstantSEO title="Календарь | Metravel" description="Live description" />)
    })
    expect(contentsOf('meta[name="description"]')).toEqual(['Export description'])

    await flushDeferredHelmet()

    expect(contentsOf('meta[name="description"]')).toEqual(['Live description'])
    expect(contentsOf('meta[property="og:title"]')).toEqual(['Календарь | Metravel'])
    expect(contentsOf('meta[property="og:locale"]')).toHaveLength(1)
  })

  it('also catches keys helmet adds after the SSG data-rh tags were already in the HTML', async () => {
    mockHelmetDelayMs = 5
    document.head.insertAdjacentHTML('beforeend', [
      '<meta data-rh="true" name="description" content="SSG description" data-ssg-description="true">',
      '<meta property="og:locale" content="ru_RU">',
      '<meta property="og:locale" content="ru_RU">',
      '<meta property="og:image:width" content="1200">',
    ].join(''))

    await act(async () => {
      root?.render(
        <LazyInstantSEO title="Главная | Metravel" description="SSG description" image="https://metravel.by/og-home.jpg" imageWidth={1200} />,
      )
    })
    await flushDeferredHelmet()

    expect(contentsOf('meta[property="og:locale"]')).toHaveLength(1)
    expect(contentsOf('meta[property="og:image:width"]')).toEqual(['1200'])
    expect(document.head.querySelector('meta[property="og:image:width"]')?.getAttribute('data-rh')).toBe('true')
  })

  it('leaves non-data-rh copies that appear during the window after an SPA navigation (#1613)', async () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="description" content="Export description">')

    await act(async () => {
      root?.render(<LazyInstantSEO title="Главная | Metravel" description="Live description" />)
    })
    await act(async () => {
      document.head.insertAdjacentHTML(
        'beforeend',
        '<meta data-owner="destination" name="description" content="Destination copy"><meta data-rh="true" name="description" content="Destination">',
      )
      await Promise.resolve()
    })

    expect(contentsOf('meta[name="description"]')).toEqual(['Live description', 'Destination copy', 'Destination'])
  })
})
