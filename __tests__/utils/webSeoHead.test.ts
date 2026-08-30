/**
 * @jest-environment jsdom
 */

import {
  ensureSingleTitleTag,
  removeOwnedWebSeoMetadata,
  syncWebSeoMetadata,
} from '@/utils/seo'

describe('ensureSingleTitleTag', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    document.title = ''
  })

  it('creates a title element when the head does not have one', () => {
    const titleElement = ensureSingleTitleTag('Travel page | Metravel')

    expect(titleElement).not.toBeNull()
    expect(document.title).toBe('Travel page | Metravel')
    expect(document.head.querySelectorAll('title')).toHaveLength(1)
    expect(document.head.querySelector('title')?.textContent).toBe('Travel page | Metravel')
  })

  it('deduplicates multiple title elements and keeps the requested title', () => {
    document.head.innerHTML = [
      '<title>Old title</title>',
      '<meta name="description" content="desc">',
      '<title data-rh="true">Another title</title>',
    ].join('')

    const titleElement = ensureSingleTitleTag('Travel SEO title | Metravel')

    expect(titleElement).not.toBeNull()
    expect(document.title).toBe('Travel SEO title | Metravel')
    expect(document.head.querySelectorAll('title')).toHaveLength(1)
    expect(document.head.querySelector('title')?.textContent).toBe('Travel SEO title | Metravel')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('desc')
  })
})

describe('syncWebSeoMetadata', () => {
  const META_SELECTORS = [
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
  ]

  beforeEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

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
      const expected = selector.includes('title') ? title : description
      expect(nodes[0].getAttribute('content')).toBe(expected)
    }
  }

  it('replaces the static RU set with one active-locale set across hydration and locale changes', () => {
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
    appendHeadSet(be.title, be.description, true)
    const latestTitle = document.head.querySelectorAll('title')[1]
    const latestMeta = META_SELECTORS.map((selector) => document.head.querySelectorAll(selector)[1])
    appendHeadSet('Late unmanaged title | Metravel', 'Late unmanaged description')
    syncWebSeoMetadata(be)
    expectSingleLocalizedHead(be.title, be.description)
    expect(document.head.querySelector('title')).toBe(latestTitle)
    META_SELECTORS.forEach((selector, index) => {
      expect(document.head.querySelector(selector)).toBe(latestMeta[index])
      expect(latestMeta[index].getAttribute('data-rh')).toBe('true')
    })

    appendHeadSet(en.title, en.description, true)
    syncWebSeoMetadata(en)
    expectSingleLocalizedHead(en.title, en.description)
  })

  it('preserves unrelated head tags while deduplicating the managed selectors', () => {
    document.head.innerHTML = [
      '<meta name="theme-color" content="#ffffff">',
      '<meta name="twitter:site" content="@metravel_by">',
    ].join('')

    syncWebSeoMetadata({
      title: 'Home | Metravel',
      description: 'Home description',
    })

    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#ffffff')
    expect(document.head.querySelector('meta[name="twitter:site"]')?.getAttribute('content')).toBe('@metravel_by')
  })

  it('removes stale description metadata when the focused route has no description', () => {
    appendHeadSet('Previous page | Metravel', 'Previous page description')

    syncWebSeoMetadata({ title: 'Trips | Metravel' })

    expect(document.title).toBe('Trips | Metravel')
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(0)
    expect(document.head.querySelectorAll('meta[property="og:description"]')).toHaveLength(0)
    expect(document.head.querySelectorAll('meta[name="twitter:description"]')).toHaveLength(0)
  })

  it('normalizes surrounding whitespace consistently across title and description tags', () => {
    syncWebSeoMetadata({
      title: '  Home | Metravel  ',
      description: '  Home description  ',
    })

    expectSingleLocalizedHead('Home | Metravel', 'Home description')
  })

  it('removes only captured home nodes and preserves equal-value destination duplicates', () => {
    const home = { title: 'Home | Metravel', description: 'Home description' }
    appendHeadSet(home.title, home.description, true)
    const homeNodes = syncWebSeoMetadata(home)
    appendHeadSet(home.title, home.description, true)
    document.head.insertAdjacentHTML('beforeend', [
      `<meta data-owner="quest-copy" name="description" content="${home.description}">`,
      `<meta data-owner="quest-copy" property="og:title" content="${home.title}">`,
      `<meta data-owner="quest-copy" property="og:description" content="${home.description}">`,
      `<meta data-owner="quest-copy" name="twitter:title" content="${home.title}">`,
      `<meta data-owner="quest-copy" name="twitter:description" content="${home.description}">`,
    ].join(''))
    const destinationNodes = META_SELECTORS.map((selector) => (
      Array.from(document.head.querySelectorAll(selector)).filter((node) => (
        !homeNodes.has(node)
      ))
    ))
    const destinationTitle = Array.from(document.head.querySelectorAll('title')).find((node) => !homeNodes.has(node))

    removeOwnedWebSeoMetadata(home, homeNodes)

    expect(document.head.querySelectorAll('title')).toHaveLength(1)
    expect(document.head.querySelector('title')).toBe(destinationTitle)
    expect(document.title).toBe(home.title)
    META_SELECTORS.forEach((selector, index) => {
      const nodes = Array.from(document.head.querySelectorAll(selector))
      expect(nodes).toEqual(destinationNodes[index])
      expect(nodes).toHaveLength(2)
      expect(nodes[1].getAttribute('data-owner')).toBe('quest-copy')
    })
  })

  it('preserves captured nodes that the destination has already reused with new values', () => {
    const home = { title: 'Home | Metravel', description: 'Home description' }
    const quests = { title: 'Quests | Metravel', description: 'Quest description' }
    appendHeadSet(home.title, home.description, true)
    const homeNodes = syncWebSeoMetadata(home)

    for (const node of homeNodes) {
      if (node.matches('title')) {
        node.textContent = quests.title
      } else {
        node.setAttribute('content', node.getAttribute('name')?.includes('title')
          || node.getAttribute('property')?.includes('title')
          ? quests.title
          : quests.description)
      }
    }

    removeOwnedWebSeoMetadata(home, homeNodes)

    expect(Array.from(homeNodes).every((node) => node.isConnected)).toBe(true)
    expect(document.title).toBe(quests.title)
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      quests.description,
    )
  })
})
