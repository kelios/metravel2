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

const appendHeadSet = (title: string, description: string) => {
  document.head.insertAdjacentHTML('beforeend', [
    `<title data-rh="true">${title}</title>`,
    `<meta data-rh="true" name="description" content="${description}">`,
    `<meta data-rh="true" property="og:title" content="${title}">`,
    `<meta data-rh="true" property="og:description" content="${description}">`,
    `<meta data-rh="true" name="twitter:title" content="${title}">`,
    `<meta data-rh="true" name="twitter:description" content="${description}">`,
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
      root.render(<LazyInstantSEO {...be} />)
    })
    expectSingleLocalizedHead(be.title, be.description)

    await act(async () => {
      appendHeadSet(be.title, be.description)
      await Promise.resolve()
    })
    expectSingleLocalizedHead(be.title, be.description)

    await act(async () => {
      root.render(<LazyInstantSEO {...en} />)
    })
    expectSingleLocalizedHead(en.title, en.description)

    await act(async () => {
      appendHeadSet(en.title, en.description)
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
      root.render(<LazyInstantSEO title="Trips | Metravel" />)
    })
    expect(document.title).toBe('Trips | Metravel')
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(0)
    expect(document.head.querySelectorAll('meta[property="og:description"]')).toHaveLength(0)
    expect(document.head.querySelectorAll('meta[name="twitter:description"]')).toHaveLength(0)
  })
})
