const {
  filterRecentSitemapEntries,
  parseRecentDays,
  parseSitemapEntries,
  parseUrlsFile,
  parseUrlsFileContent,
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

// Daily batches after the retitle wave (#1326): the queue is submitted ten URLs
// at a time, so the script has to accept an explicit list instead of rebuilding
// the whole site from the API.
describe('IndexNow explicit batch file', () => {
  it('reads the path from --urls-file', () => {
    expect(parseUrlsFile(['node', 'script', '--urls-file', 'batch.txt'])).toBe('batch.txt')
    expect(parseUrlsFile(['node', 'script'])).toBeNull()
    expect(() => parseUrlsFile(['node', 'script', '--urls-file'])).toThrow('expects a path')
    expect(() => parseUrlsFile(['node', 'script', '--urls-file', '--dry-run'])).toThrow('expects a path')
  })

  it('reads one URL per line, ignoring comments, blanks and duplicates', () => {
    const text = [
      '# batch 1 — 2026-08-08',
      'https://metravel.by/travels/a',
      '',
      '  https://metravel.by/travels/b  ',
      'https://metravel.by/travels/a',
      'https://metravel.by/ # home',
    ].join('\n')

    expect(parseUrlsFileContent(text)).toEqual([
      'https://metravel.by/travels/a',
      'https://metravel.by/travels/b',
      'https://metravel.by/',
    ])
  })

  it('refuses a batch containing a foreign host', () => {
    const text = ['https://metravel.by/travels/a', 'https://example.com/x'].join('\n')

    expect(() => parseUrlsFileContent(text)).toThrow('outside https://metravel.by')
  })

  it('returns an empty list for an empty file instead of throwing', () => {
    expect(parseUrlsFileContent('')).toEqual([])
    expect(parseUrlsFileContent('# only a comment\n')).toEqual([])
  })
})
