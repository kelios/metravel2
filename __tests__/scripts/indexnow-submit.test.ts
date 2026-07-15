const {
  filterRecentSitemapEntries,
  parseRecentDays,
  parseSitemapEntries,
} = require('../../scripts/indexnow-submit')

describe('IndexNow sitemap freshness filter', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset>',
    '<url><loc>https://metravel.by/quests/1/fresh</loc><lastmod>2026-07-15</lastmod></url>',
    '<url><loc>https://metravel.by/quests/1/yesterday</loc><lastmod>2026-07-14T17:00:00Z</lastmod></url>',
    '<url><loc>https://metravel.by/quests/1/old</loc><lastmod>2026-07-10</lastmod></url>',
    '<url><loc>https://metravel.by/quests/1/unknown</loc></url>',
    '</urlset>',
  ].join('')

  it('parses loc and lastmod from sitemap URL entries', () => {
    expect(parseSitemapEntries(xml)).toEqual([
      { loc: 'https://metravel.by/quests/1/fresh', lastmod: '2026-07-15' },
      {
        loc: 'https://metravel.by/quests/1/yesterday',
        lastmod: '2026-07-14T17:00:00Z',
      },
      { loc: 'https://metravel.by/quests/1/old', lastmod: '2026-07-10' },
      { loc: 'https://metravel.by/quests/1/unknown', lastmod: '' },
    ])
  })

  it('keeps only URLs changed during the requested UTC date window', () => {
    const entries = parseSitemapEntries(xml)
    expect(
      filterRecentSitemapEntries(entries, 2, new Date('2026-07-15T09:00:00Z')),
    ).toEqual([
      { loc: 'https://metravel.by/quests/1/fresh', lastmod: '2026-07-15' },
      {
        loc: 'https://metravel.by/quests/1/yesterday',
        lastmod: '2026-07-14T17:00:00Z',
      },
    ])
  })

  it('requires a positive integer for --recent-days', () => {
    expect(parseRecentDays(['node', 'script', '--recent-days', '2'])).toBe(2)
    expect(() =>
      parseRecentDays(['node', 'script', '--recent-days', '0']),
    ).toThrow('--recent-days expects a positive integer')
  })
})
