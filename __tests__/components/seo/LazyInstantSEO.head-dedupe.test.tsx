/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Platform } from 'react-native'
import LazyInstantSEO from '@/components/seo/LazyInstantSEO'

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

const appendHeadSet = (title: string, description: string, expoManaged = false) => {
  const marker = expoManaged ? ' data-rh="true"' : ''
  document.head.insertAdjacentHTML('beforeend', [
    `<title${marker}>${title}</title>`,
    `<meta${marker} name="description" content="${description}">`,
    `<meta${marker} property="og:title" content="${title}">`,
    `<meta${marker} property="og:description" content="${description}">`,
    `<meta${marker} name="twitter:title" content="${title}">`,
    `<meta${marker} name="twitter:description" content="${description}">`,
  ].join(''))
}

const expectSingleLocalizedHead = (title: string, description: string) => {
  expect(document.head.querySelectorAll('title')).toHaveLength(1)
  expect(document.title).toBe(title)

  for (const selector of META_SELECTORS) {
    const nodes = document.head.querySelectorAll(selector)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].getAttribute('content')).toBe(selector.includes('title') ? title : description)
  }
}

describe('LazyInstantSEO hydrated head ownership', () => {
  const originalPlatform = Platform.OS
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })

  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('automatically removes late Expo Head copies after hydration and a locale change', async () => {
    const ru = {
      title: 'Квесты и маршруты на выходные по Беларуси | Metravel',
      description: 'Русское описание главной',
    }
    const be = {
      title: 'Квэсты і маршруты на выходныя па Беларусі | Metravel',
      description: 'Беларускае апісанне галоўнай',
    }
    const en = {
      title: 'Belarus City Quests and Weekend Routes | Metravel',
      description: 'English home description',
    }

    appendHeadSet(ru.title, ru.description)
    await act(async () => {
      root.render(<LazyInstantSEO {...be} syncHydratedMetadataForPath="/" />)
    })
    expectSingleLocalizedHead(be.title, be.description)

    await act(async () => {
      appendHeadSet(be.title, be.description, true)
      await Promise.resolve()
    })
    expectSingleLocalizedHead(be.title, be.description)

    await act(async () => {
      root.render(<LazyInstantSEO {...en} syncHydratedMetadataForPath="/" />)
    })
    expectSingleLocalizedHead(en.title, en.description)

    await act(async () => {
      appendHeadSet(en.title, en.description, true)
      await Promise.resolve()
    })
    expectSingleLocalizedHead(en.title, en.description)

    await act(async () => {
      const titleText = document.head.querySelector('title')?.firstChild
      if (titleText) titleText.nodeValue = 'Late stale title | Metravel'
      await Promise.resolve()
    })
    expectSingleLocalizedHead(en.title, en.description)

    await act(async () => {
      root.render(<LazyInstantSEO title="Trips | Metravel" syncHydratedMetadataForPath="/" />)
    })
    expect(document.title).toBe('Trips | Metravel')
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(0)
    expect(document.head.querySelectorAll('meta[property="og:description"]')).toHaveLength(0)
    expect(document.head.querySelectorAll('meta[name="twitter:description"]')).toHaveLength(0)
  })

  it('does not alter static and runtime metadata without the home opt-in', async () => {
    const staticDescription = 'Quest catalogue static description'
    const runtimeDescription = 'Quest catalogue runtime description'

    appendHeadSet('Quest catalogue static | Metravel', staticDescription)
    appendHeadSet('Quest catalogue runtime | Metravel', runtimeDescription, true)

    await act(async () => {
      root.render(
        <LazyInstantSEO
          title="Quest catalogue runtime | Metravel"
          description={runtimeDescription}
        />,
      )
    })

    expect(Array.from(document.head.querySelectorAll('meta[name="description"]')).map(
      (node) => node.getAttribute('content'),
    )).toEqual([staticDescription, runtimeDescription])
    expect(document.head.querySelectorAll('title')).toHaveLength(2)
  })

  it('keeps Expo-managed home nodes and does not rewrite the destination route during navigation', async () => {
    appendHeadSet('Static home | Metravel', 'Static home description')

    await act(async () => {
      root.render(
        <LazyInstantSEO
          title="Localized home | Metravel"
          description="Localized home description"
          syncHydratedMetadataForPath="/"
        />,
      )
    })

    await act(async () => {
      appendHeadSet('Localized home | Metravel', 'Localized home description', true)
      await Promise.resolve()
    })

    expect(document.head.querySelector('title')?.getAttribute('data-rh')).toBe('true')
    for (const selector of META_SELECTORS) {
      expect(document.head.querySelector(selector)?.getAttribute('data-rh')).toBe('true')
    }

    window.history.pushState(null, '', '/quests')
    const questTitle = 'Quest catalogue runtime | Metravel'
    const questDescription = 'Quest catalogue runtime description'
    await act(async () => {
      appendHeadSet(questTitle, questDescription, true)
      await Promise.resolve()
    })

    expect(document.head.querySelectorAll('title').item(1).textContent).toBe(questTitle)
    expect(document.head.querySelectorAll('meta[name="description"]').item(1).getAttribute('content')).toBe(
      questDescription,
    )
  })
})
