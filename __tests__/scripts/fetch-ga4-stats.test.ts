/** @jest-environment node */
const { parseArgs, allRows, resolvedPeriod, collectStats, formatBreakdown } = require('@/scripts/fetch-ga4-stats')

const row = (dimensions: string[], metrics: number[]) => ({
  dimensionValues: dimensions.map((value) => ({ value })),
  metricValues: metrics.map((value) => ({ value: String(value) })),
})

describe('GA4 attribution diagnostics', () => {
  it('uses exactly N complete property days, including across DST and year boundaries', () => {
    const args = parseArgs(['node', 'stats', '--days', '7', '--channel-breakdown'])
    expect(args.channelBreakdown).toBe(true)
    expect(resolvedPeriod(args, 'Europe/Minsk', new Date('2026-10-18T23:30:00Z'))).toEqual({
      days: 7, startDate: '2026-10-12', endDate: '2026-10-18', timeZone: 'Europe/Minsk',
    })
    expect(resolvedPeriod(args, 'Europe/Warsaw', new Date('2026-10-27T12:00:00Z'))).toMatchObject({
      startDate: '2026-10-20', endDate: '2026-10-26',
    })
    expect(resolvedPeriod(args, 'Europe/Minsk', new Date('2026-01-02T12:00:00Z'))).toMatchObject({
      startDate: '2025-12-26', endDate: '2026-01-01',
    })
  })

  it('supports reproducible fixed windows and rejects invalid or partial arguments', () => {
    expect(parseArgs(['node', 'stats', '--start-date', '2026-10-20', '--end-date', '2026-10-26'])).toMatchObject({ days: 7 })
    for (const flags of [['--days', '0'], ['--days', '7oops'], ['--property', 'bad'], ['--start-date', '2026-02-30', '--end-date', '2026-03-02'], ['--end-date', '2026-10-26'], ['--unknown']]) {
      expect(() => parseArgs(['node', 'stats', ...flags])).toThrow()
    }
    for (const flag of ['--days', '--property', '--start-date', '--end-date']) {
      expect(() => parseArgs(['node', 'stats', flag])).toThrow(`${flag} requires a value`)
      expect(() => parseArgs(['node', 'stats', flag, '--json'])).toThrow(`${flag} requires a value`)
    }
  })

  it('paginates beyond a full page and preserves quality flags from every page', async () => {
    const report = jest.fn()
      .mockResolvedValueOnce({ rows: [row(['a'], [1]), row(['b'], [2])], rowCount: 3, metadata: { subjectToThresholding: true } })
      .mockResolvedValueOnce({ rows: [row(['c'], [3])], rowCount: 3, metadata: { dataLossFromOtherRow: true } })
    const result = await allRows(report, { dimensions: [{ name: 'sessionSource' }] }, 2)
    expect(result).toMatchObject({ complete: true, rowCount: 3, rows: expect.any(Array), metadata: [{ subjectToThresholding: true }, { dataLossFromOtherRow: true }] })
    expect(result.rows).toHaveLength(3)
    expect(report.mock.calls[1][0]).toMatchObject({ limit: 2, offset: 2 })
    const incomplete = await allRows(jest.fn().mockResolvedValue({ rows: [], rowCount: 3 }), {}, 2)
    expect(incomplete.complete).toBe(false)
  })

  const fixtureReport = (total = 516) => jest.fn(async (body: any) => {
    const dimensions = body.dimensions?.map((d: any) => d.name) || []
    if (!dimensions.length) return { rows: [row([], [329, 1200, total, 300, 0.3])], metadata: { timeZone: 'Europe/Minsk' } }
    if (dimensions[0] === 'sessionDefaultChannelGroup') return { rows: [row(['Unassigned'], [67, 169]), row(['Organic Search'], [238, 287])], rowCount: 2 }
    expect(body.dimensionFilter.filter).toEqual({ fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Unassigned' } })
    if (dimensions.length === 2) return { rows: [row(['quest_detail', '(not set)'], [33, 20])], rowCount: 1 }
    return { rows: [row(['quest_detail', '(not set)', '/', 'desktop', 'web', 'metravel - GA4'], [171, 67])], rowCount: 1, metadata: { subjectToThresholding: true } }
  })

  it('uses independent channel sessions for the KPI, not the nonadditive detail sum', async () => {
    const report = fixtureReport()
    const result = await collectStats({ days: 30, property: '362328641', channelBreakdown: true, json: true }, report)
    expect(result.channelBreakdown).toMatchObject({ sessions: 169, sharePct: 32.75, nonAdditive: true })
    expect(result.channelBreakdown.rows[0]).toEqual({ sessionSource: 'quest_detail', sessionMedium: '(not set)', landingPage: '/', deviceCategory: 'desktop', platform: 'web', streamName: 'metravel - GA4', sessions: 171, users: 67 })
    expect(result.channelBreakdown.sources[0].sessions).toBe(33)
    const text = formatBreakdown(result.channelBreakdown)
    expect(text).toContain('169 сессий (32.75%)')
    expect(text).toContain('171 | 67 | quest_detail | (not set) | / | desktop | web | metravel - GA4')
    expect(text).toContain('subjectToThresholding')
    expect(report.mock.calls[0][0].dateRanges).toEqual([{ startDate: '30daysAgo', endDate: 'yesterday' }])
  })

  it('does not claim 0% or success when there are no sessions', async () => {
    const result = await collectStats({ days: 7, channelBreakdown: true, json: true }, fixtureReport(0))
    expect(result.channelBreakdown.sharePct).toBeNull()
  })
})
