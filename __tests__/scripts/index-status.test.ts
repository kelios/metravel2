/**
 * Regression tests for scripts/index-status.js
 *
 * The indexing monitor read the travel list as `res.data || res.items || res.rows`
 * while `/api/travels/` answers `{count, next, results}`. The list came back empty,
 * the report printed "Всего проверено: 0" and exited 0 — a green report that had
 * checked nothing. It stayed invisible while indexing fell 291/306 → 203/306.
 */

const { pickListRows, parseArgs, classify } = require('@/scripts/index-status')

describe('pickListRows', () => {
  it('reads the current API envelope {count, next, results}', () => {
    const rows = pickListRows({
      count: 306,
      next: 'https://metravel.by/api/travels/?page=2',
      previous: null,
      results: [{ id: 1 }, { id: 2 }],
    })
    expect(rows).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('still reads the legacy shapes', () => {
    expect(pickListRows({ data: [{ id: 3 }] })).toEqual([{ id: 3 }])
    expect(pickListRows({ items: [{ id: 4 }] })).toEqual([{ id: 4 }])
    expect(pickListRows({ rows: [{ id: 5 }] })).toEqual([{ id: 5 }])
    expect(pickListRows([{ id: 6 }])).toEqual([{ id: 6 }])
  })

  it('prefers results over the legacy keys when both are present', () => {
    expect(pickListRows({ results: [{ id: 7 }], data: [{ id: 8 }] })).toEqual([{ id: 7 }])
  })

  it('returns an empty list for unknown or malformed payloads', () => {
    expect(pickListRows({ count: 0 })).toEqual([])
    expect(pickListRows({ results: 'nope' })).toEqual([])
    expect(pickListRows(null)).toEqual([])
    expect(pickListRows('')).toEqual([])
  })
})

describe('parseArgs', () => {
  it('defaults to the owner author and the production property', () => {
    const args = parseArgs(['node', 'index-status.js'])
    expect(args.userId).toBe('1')
    expect(args.site).toBe('sc-domain:metravel.by')
    expect(args.json).toBe(false)
    expect(args.limit).toBe(0)
  })

  it('reads the flags used by the SEO routine', () => {
    const args = parseArgs(['node', 'index-status.js', '--json', '--only-problems', '--limit', '5'])
    expect(args.json).toBe(true)
    expect(args.onlyProblems).toBe(true)
    expect(args.limit).toBe(5)
  })
})

describe('classify', () => {
  it('maps an indexed URL inspection result', () => {
    const info = classify({
      inspectionResult: {
        indexStatusResult: {
          verdict: 'PASS',
          coverageState: 'Страница отправлена и проиндексирована',
          lastCrawlTime: '2026-08-04T00:00:00Z',
        },
      },
    })
    expect(info.verdict).toBe('PASS')
    expect(info.coverageState).toBe('Страница отправлена и проиндексирована')
  })

  it('falls back to UNKNOWN on an empty response instead of throwing', () => {
    expect(classify({}).verdict).toBe('UNKNOWN')
    expect(classify(null).coverageState).toBe('Unknown')
  })
})
