import { toSitePath } from '@/api/aiPicks'

// #2459: карточки подбора навигируют `router.push(path)`; путь берётся из абсолютного `url` службы.
describe('toSitePath (#2459)', () => {
  it('keeps the site path and query of an absolute url on web', () => {
    expect(toSitePath('https://metravel.by/travels/ojcow?from=ai', 'web')).toBe('/travels/ojcow?from=ai')
    expect(toSitePath('https://metravel.by/en/quests/12/krakow-family', 'web')).toBe('/en/quests/12/krakow-family')
  })

  it('opens a locale quest version by its RU route on native, where /<locale>/quests is not routed', () => {
    expect(toSitePath('https://metravel.by/en/quests/12/krakow-family', 'android')).toBe('/quests/12/krakow-family')
    expect(toSitePath('https://metravel.by/pl/quests/12/krakow-family/', 'ios')).toBe('/quests/12/krakow-family')
    expect(toSitePath('https://metravel.by/quests/12/krakow-family', 'ios')).toBe('/quests/12/krakow-family')
    expect(toSitePath('https://metravel.by/travels/ojcow', 'android')).toBe('/travels/ojcow')
  })

  it('falls back to a relative path or the root for a malformed url', () => {
    expect(toSitePath('/travels/x', 'web')).toBe('/travels/x')
    expect(toSitePath('not a url', 'web')).toBe('/')
  })
})
