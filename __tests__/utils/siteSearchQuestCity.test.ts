import { normalizeSiteSearchText } from '@/utils/siteSearchQuestCity'

describe('normalizeSiteSearchText', () => {
  it('normalizes case, ё/е, diacritics, hyphens and spaces', () => {
    expect(normalizeSiteSearchText('  Ёлки-Палки  ')).toBe('елки палки')
    expect(normalizeSiteSearchText('Kraków')).toBe('krakow')
    expect(normalizeSiteSearchText(' — (   ) ')).toBe('')
  })
})
