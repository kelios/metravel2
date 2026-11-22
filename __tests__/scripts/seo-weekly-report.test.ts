const { weeks, fetchWeek, format } = require('../../scripts/seo-weekly-report')
const { queries, questions } = require('../../scripts/seo-weekly-panel.json')

describe('weekly search visibility', () => {
  const period = { startDate: '2026-11-09', endDate: '2026-11-15' }
  const now = new Date('2026-11-22T12:00:00Z')

  it('pins complete adjacent weeks and rejects partial or malformed periods', () => {
    expect(weeks(undefined, now)).toEqual([{ startDate: '2026-11-02', endDate: '2026-11-08' }, period])
    for (const end of ['2026-11-22', '2026-11-14', '2026-02-30', 'n/a', '']) {
      expect(() => weeks(end, now)).toThrow()
    }
  })

  it('keeps absent queries distinct from a measured zero CTR and groups AI hosts', async () => {
    expect(new Set(queries).size).toBe(50)
    expect(new Set(questions).size).toBe(10)
    expect(queries).toHaveLength(50)
    expect(questions).toHaveLength(10)
    const gsc = jest.fn(async (body: any) => {
      if (body.dimensions[0] === 'date') return { rows: Array(7).fill({}) }
      const regex = new RegExp(body.dimensionFilterGroups[0].filters[0].expression)
      expect(queries.every((q: string) => regex.test(q))).toBe(true)
      expect(regex.test('extra ' + queries[0])).toBe(false)
      return { rows: [{ keys: [queries[1]], position: 2, ctr: 0, clicks: 0, impressions: 5 }] }
    })
    const ga4 = jest.fn(async (body: any) => {
      const regex = new RegExp('^(?:' + body.dimensionFilter.filter.stringFilter.value + ')$', 'i')
      expect(regex.test('www.perplexity.ai')).toBe(true)
      expect(regex.test('chatgptXcom')).toBe(false)
      expect(regex.test('evilchatgpt.com')).toBe(false)
      return { rowCount: 1, rows: [{ dimensionValues: [{ value: 'WWW.Perplexity.AI' }], metricValues: [{ value: '3' }] }] }
    })
    const result = await fetchWeek(period, gsc, ga4)
    expect(result.rows).toHaveLength(50)
    expect(result.rows[0]).toMatchObject({ position: null, ctr: null })
    expect(result.rows[1]).toMatchObject({ position: 2, ctr: 0 })
    expect(result.ai).toEqual({ 'chatgpt.com': 0, 'perplexity.ai': 3 })
    expect(format([result, result])).toContain('— → —')
    const limited = await fetchWeek(period, gsc, async (body: any) => ({
      ...await ga4(body), metadata: { subjectToThresholding: true },
    }))
    expect(limited.ai).toEqual({ 'chatgpt.com': null, 'perplexity.ai': 3 })
    const markdown = format([result, limited])
    expect(markdown).toContain('| chatgpt.com | 0 → нет данных | — |')
    expect(markdown).toContain('| perplexity.ai | 3 → ≥3 | — |')
    await expect(fetchWeek(period, gsc, async () => ({ rowCount: 2 }))).rejects.toThrow('GA4')
    await expect(fetchWeek(period, async () => ({}), ga4)).rejects.toThrow('GSC')
  })
})
