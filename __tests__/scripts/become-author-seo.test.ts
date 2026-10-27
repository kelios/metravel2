import { resources } from '@/i18n/resources'

const { STATIC_PAGES, injectMeta } = require('@/scripts/postprocess-route-shells')

describe('become-author static metadata', () => {
  it('registers crawlable, self-canonical metadata with the same RU copy as the screen', () => {
    const page = STATIC_PAGES.find((item: { route: string }) => item.route === '/become-author')
    expect(page).toBeDefined()
    expect(page.title).toBe(resources.ru.seoStatic['root.becomeAuthor.title'])
    expect(page.description).toBe(resources.ru.seoStatic['root.becomeAuthor.description'])
    expect(page.robots ?? '').not.toMatch(/noindex/)
    // Expo/Helmet provides the title that injectMeta replaces; OG and canonical
    // tags may be absent from the exported shell.
    const shell = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title data-rh="true">MeTravel</title><meta name="description" content="default description"/></head><body><div id="root"></div></body></html>'
    const html = injectMeta(shell, {
      ...page, canonical: 'https://metravel.by/become-author', image: 'https://metravel.by/og-default.jpg',
    })
    const document = new DOMParser().parseFromString(html, 'text/html')
    expect(document.title).toBe(page.title)
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://metravel.by/become-author')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(page.description)
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(page.title)
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain('https://metravel.by/')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '').not.toMatch(/noindex/)
  })

  it.each(Object.keys(resources) as Array<keyof typeof resources>)('keeps %s metadata in the required length budgets', (locale) => {
    const strings = resources[locale].seoStatic
    expect(strings['root.becomeAuthor.title'].length).toBeLessThanOrEqual(60)
    expect(strings['root.becomeAuthor.description'].length).toBeGreaterThanOrEqual(120)
    expect(strings['root.becomeAuthor.description'].length).toBeLessThanOrEqual(160)
  })
})
