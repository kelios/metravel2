import type React from 'react'

/**
 * #3218: в сыром HTML хабов есть видимые ссылки `<a href>` на контент.
 * Серверная разметка собирается тем же `renderToString`, что и SSR, без
 * выполнения эффектов: так страницу видит краулер без JS.
 */
let createElement: typeof import('react').createElement
let renderToString: typeof import('react-dom/server').renderToString

const hrefsOf = (html: string) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1])

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-router', () => ({
    router: { push: () => {} },
    useRouter: () => ({ push: () => {} }),
    Link: ({ href, asChild, children, ...props }: { href: string; asChild?: boolean; children: React.ReactNode }) => {
      const React = require('react')
      return asChild ? React.cloneElement(React.Children.only(children), { ...props, href })
        : React.createElement('a', { ...props, href }, children)
    },
  }))
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  jest.doMock('@/components/ui/ImageCardMedia', () => ({ alt }: { alt: string }) => require('react').createElement('img', { alt }))
  ;({ createElement } = require('react'))
  ;({ renderToString } = require('react-dom/server.node'))
})

describe('home: «Популярные маршруты»', () => {
  it('renders every popular card as a link to the canonical article address', () => {
    const { BOOK_IMAGES } = require('@/components/home/homeHeroContent')
    const { getThemedColors } = require('@/constants/designSystem')
    const PopularSection = require('@/components/home/HomeHeroPopularSection').default
    const redirectMirror = require('@/scripts/seo-redirects.json')
    const renamed = new Set(redirectMirror.redirects.map((pair: { from: string }) => pair.from))

    const html = renderToString(createElement(PopularSection, {
      bookImages: BOOK_IMAGES,
      colors: getThemedColors(false),
      onOpenArticle: () => {},
      responsiveWeb: true,
      styles: {},
      isWeb: true,
      useMobileGrid: true,
      popularCardWidth: 180,
      popularCardHeight: 120,
    }))
    const travelHrefs = hrefsOf(html).filter((href) => href.startsWith('/travels/'))

    // Мобильная сетка: «маршрут недели» и четыре карточки — все пять слайдов набора.
    expect(travelHrefs).toEqual(BOOK_IMAGES.map((image: { href?: string }) => image.href))
    expect(travelHrefs).toHaveLength(5)
    // Адрес относительный, без параметров и без редиректа: ровно то, что стоит в sitemap.
    for (const href of travelHrefs) {
      expect(href).toMatch(/^\/travels\/[a-z0-9-]+$/)
      expect(renamed.has(href.slice('/travels/'.length))).toBe(false)
    }
    expect(html).not.toMatch(/<div[^>]*data-home-popular-card/)
  })
})

describe('/quests: указатель каталога', () => {
  const countries = [
    { title: 'Беларусь', path: '/quests/country/by' },
    { title: 'Польша', path: '/quests/country/pl' },
  ]
  const cities = [
    { title: 'Минск', path: '/quests/minsk' },
    { title: 'Краков', path: '/quests/krakow' },
    { title: 'Гродно', path: '/quests/grodno' },
  ]
  const quests = Array.from({ length: 30 }, (_, index) => ({
    id: `quest-${index + 1}`,
    cityId: index % 2 ? 'krakow' : 'minsk',
    title: `Квест ${index + 1}`,
  }))

  it('puts links to every country and city and to the first catalogue page into server HTML', () => {
    const Directory = require('@/screens/tabs/QuestsCatalogDirectory.web').default
    const { QUEST_DIRECTORY_QUEST_LIMIT } = require('@/screens/tabs/QuestsCatalogDirectory.web')

    const html = renderToString(createElement(Directory, { countries, cities, quests }))
    const hrefs = hrefsOf(html)

    expect(hrefs).toEqual(expect.arrayContaining([...countries, ...cities].map((link) => link.path)))
    const questHrefs = hrefs.filter((href) => /^\/quests\/[^/]+\/quest-\d+$/.test(href))
    expect(questHrefs).toHaveLength(QUEST_DIRECTORY_QUEST_LIMIT)
    expect(questHrefs[0]).toBe('/quests/minsk/quest-1')
    expect(html).toContain('Минск')
    // Ссылки видимые: никакого скрытого индекса (#2817 — клоакинг).
    expect(html).not.toMatch(/aria-hidden|\binert\b|display:\s*none|visibility:\s*hidden/)
    expect(html).toMatch(/<nav[^>]*data-quests-directory/)
  })

  it('renders nothing without data and skips a quest that has no address', () => {
    const Directory = require('@/screens/tabs/QuestsCatalogDirectory.web').default

    expect(renderToString(createElement(Directory, { countries: [], cities: [], quests: [] }))).toBe('')

    const html = renderToString(createElement(Directory, {
      countries: [],
      cities: [],
      quests: [{ id: 'no-city', cityId: '', title: 'Без города' }, { id: 'ok', cityId: 'minsk', title: 'С адресом' }],
    }))
    expect(hrefsOf(html)).toEqual(['/quests/minsk/ok'])
  })
})

describe('/quests: одна цифра каталога', () => {
  it('writes the loader-known catalogue size into the count placeholder instead of a nominal number', () => {
    const { QuestsCountPlaceholder } = require('@/screens/tabs/QuestsCatalogPlaceholders')
    const render = (count?: number) => renderToString(
      createElement(QuestsCountPlaceholder, { styles: {}, withSortChip: false, count }),
    )

    expect(render(340)).toContain('340')
    expect(render(340)).not.toContain('100')
    expect(render(undefined)).toContain('100')
    expect(render(0)).toContain('100')
  })

  it('states the whole catalogue size in JSON-LD while listing only its head', () => {
    const { createQuestCatalogStructuredData } = require('@/utils/discoverySeo')
    const data = createQuestCatalogStructuredData({
      canonical: 'https://metravel.by/quests',
      title: 'Квесты',
      description: 'Каталог',
      quests: Array.from({ length: 340 }, (_, index) => ({ id: `q${index}`, cityId: 'minsk', title: `Квест ${index}` })),
    })
    const itemList = data['@graph'].find((node: { '@type': string }) => node['@type'] === 'ItemList')

    expect(itemList.numberOfItems).toBe(340)
    expect(itemList.itemListElement).toHaveLength(50)
  })
})
