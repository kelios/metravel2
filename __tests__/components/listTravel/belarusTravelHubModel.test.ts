import {
  BELARUS_TRAVEL_CITY_LINKS,
  BELARUS_TRAVEL_THEME_LINKS,
} from '@/components/listTravel/belarusTravelHubModel'
import { ruResources } from '@/i18n/locales/ru'
import redirectMirror from '@/scripts/seo-redirects.json'

describe('Belarus travel SEO hub', () => {
  it('keeps one crawlable set of canonical internal links', () => {
    const links = [...BELARUS_TRAVEL_THEME_LINKS, ...BELARUS_TRAVEL_CITY_LINKS]
    const hrefs = links.map((item) => item.href)

    expect(BELARUS_TRAVEL_THEME_LINKS).toHaveLength(4)
    expect(BELARUS_TRAVEL_CITY_LINKS).toHaveLength(5)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(hrefs.every((href) => href.startsWith('/travels/'))).toBe(true)
    expect(hrefs.every((href) => !href.includes('?'))).toBe(true)
    expect(hrefs).toContain('/travels/zamki-i-usadby-belarusi-19-marshrutov-iz-minska')
  })

  it('links straight to live slugs: none of the addresses answers with a redirect (#3242)', () => {
    const renamed = new Set(redirectMirror.redirects.map((pair: { from: string }) => pair.from))
    const slugs = [...BELARUS_TRAVEL_THEME_LINKS, ...BELARUS_TRAVEL_CITY_LINKS].map((item) =>
      item.href.slice('/travels/'.length),
    )

    expect(slugs.filter((slug) => renamed.has(slug))).toEqual([])
  })

  it('targets the broad Belarus discovery intent in the page metadata and heading', () => {
    expect(ruResources.seoStatic['root.travelsBy.title']).toContain(
      'Что посмотреть в Беларуси',
    )
    expect(ruResources.sharedStatic['travelsByHub.title']).toBe(
      'Что посмотреть в Беларуси',
    )
  })
})

