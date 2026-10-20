/** @jest-environment node */
const { parseArgs, allRows, resolvedPeriod, collectStats, formatBreakdown, formatSourceBreakdown } = require('@/scripts/fetch-ga4-stats')
const { SOURCE_EVENTS, buildSourceBreakdown } = require('@/scripts/lib/ga4-source-breakdown')

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
    if (!body.dimensionFilter || dimensions.includes('eventName')) return { rows: [], rowCount: 0 }
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

  const sourceFixture = (sessions: any, events: any) => {
    const baseline = fixtureReport()
    return jest.fn(async (body: any) => {
      const dimensions = body.dimensions?.map((d: any) => d.name) || []
      if (dimensions[0] === 'sessionSource' && (!body.dimensionFilter || dimensions.includes('eventName'))) {
        const response = dimensions.includes('eventName') ? events : sessions
        if (response instanceof Error) throw response
        return response
      }
      return baseline(body)
    })
  }

  it('adds native source and separate filtered event reports without changing the Unassigned measurement', async () => {
    const report = sourceFixture({ rows: [
      row(['instagram', 'social'], [12]), row(['l.instagram.com', 'referral'], [5]),
      row(['facebook', 'social'], [20]), row(['evilinstagram.com', 'referral'], [3]),
    ], rowCount: 4 }, { rows: [
      row(['instagram', 'social', 'registration_complete'], [2]),
      row(['instagram', 'social', 'travel_publish'], [0]),
      row(['facebook', 'social', 'route_create_started'], [7]),
      row(['www.instagram.com', 'referral', 'travel_publish'], [1]),
    ], rowCount: 4 })
    const result = await collectStats({ days: 7, property: '362328641', channelBreakdown: true, json: true,
      startDate: '2026-10-20', endDate: '2026-10-26' }, report)
    expect(result.totals.sessions).toBe(516)
    expect(result.channelBreakdown).toMatchObject({ sessions: 169, sharePct: 32.75 })
    const calls = report.mock.calls.map((call: any[]) => call[0])
    const sessions = calls.find((body: any) => !body.dimensionFilter && body.dimensions?.[0]?.name === 'sessionSource')
    expect(sessions).toMatchObject({ dateRanges: [{ startDate: '2026-10-20', endDate: '2026-10-26' }],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }], metrics: [{ name: 'sessions' }] })
    const events = calls.find((body: any) => body.dimensions?.[2]?.name === 'eventName')
    expect(events).toMatchObject({ dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: SOURCE_EVENTS, caseSensitive: true } } } })
    const unassigned = calls.filter((body: any) => body.dimensionFilter?.filter?.fieldName === 'sessionDefaultChannelGroup')
    expect(unassigned).toHaveLength(2)
    expect(unassigned.every((body: any) => body.dimensionFilter.filter.stringFilter.value === 'Unassigned')).toBe(true)
    const rows = result.sourceBreakdown.rows
    expect(rows.find((r: any) => r.sessionSource === 'instagram')).toMatchObject({ channel: 'instagram', sessions: 12,
      events: { registration_complete: 2, route_create_started: null, travel_publish: 0 } })
    expect(rows.find((r: any) => r.sessionSource === 'l.instagram.com')).toMatchObject({ channel: 'instagram', sessions: 5 })
    expect(rows.find((r: any) => r.sessionSource === 'www.instagram.com')).toMatchObject({ channel: 'instagram', sessions: null, events: { travel_publish: 1 }, status: { sessions: 'not_observed' } })
    expect(rows.find((r: any) => r.sessionSource === 'facebook').channel).toBe('other')
    expect(rows.find((r: any) => r.sessionSource === 'evilinstagram.com').channel).toBe('other')
    expect(rows).toHaveLength(5)
    expect(formatSourceBreakdown(result.sourceBreakdown)).toContain('не зафиксировано')
    expect(formatSourceBreakdown(result.sourceBreakdown)).toContain('не уникальные пользователи')
  })

  it('shows an Instagram placeholder with unknown counts when no source has been observed', async () => {
    const result = await collectStats({ days: 7, channelBreakdown: true }, sourceFixture({ rows: [], rowCount: 0 }, { rows: [], rowCount: 0 }))
    expect(result.sourceBreakdown.rows).toEqual([expect.objectContaining({ sessionSource: 'instagram', sessionMedium: null,
      placeholder: true, sessions: null, events: Object.fromEntries(SOURCE_EVENTS.map((event: string) => [event, null])),
      status: { sessions: 'not_observed', events: Object.fromEntries(SOURCE_EVENTS.map((event: string) => [event, 'not_observed'])) } })])
    expect(result.sourceBreakdown.status).toBe('collected')
  })

  it('isolates failed source event requests, sanitizes errors and preserves measured sessions', async () => {
    const result = await collectStats({ days: 7, channelBreakdown: true }, sourceFixture(
      { rows: [row(['instagram', 'social'], [4])], rowCount: 1 }, new Error('GA4 runReport failed (403): token=private-canary')))
    expect(result.channelBreakdown.sessions).toBe(169)
    expect(result.sourceBreakdown).toMatchObject({ status: 'partial', quality: { events: { status: 'unavailable', reason: 'HTTP 403' } } })
    expect(result.sourceBreakdown.rows[0]).toMatchObject({ sessions: 4, events: { travel_publish: null }, status: { events: { travel_publish: 'unavailable' } } })
    expect(JSON.stringify(result)).not.toContain('private-canary')
  })

  it('aborts stalled new diagnostics after their shared deadline and preserves completed sessions and legacy totals', async () => {
    jest.useFakeTimers()
    const baseline = sourceFixture({ rows: [row(['instagram', 'social'], [4])], rowCount: 1 }, { rows: [], rowCount: 0 })
    const signals: AbortSignal[] = []
    const report = jest.fn(async (body: any, options?: { signal: AbortSignal }) => {
      if (body.dimensions?.[2]?.name === 'eventName') {
        signals.push(options!.signal)
        return new Promise(() => {})
      }
      return baseline(body)
    })
    try {
      const pending = collectStats({ days: 7, channelBreakdown: true }, report)
      await jest.advanceTimersByTimeAsync(30000)
      const result = await pending
      expect(signals).toHaveLength(1)
      expect(signals[0].aborted).toBe(true)
      expect(result.totals.sessions).toBe(516)
      expect(result.channelBreakdown.sessions).toBe(169)
      expect(result.sourceBreakdown.rows[0]).toMatchObject({ sessions: 4, events: { travel_publish: null } })
      expect(result.sourceBreakdown.quality.events).toMatchObject({ status: 'unavailable', reason: 'TIMEOUT' })
      expect(report.mock.calls[0][1]).toBeUndefined()
    } finally { jest.useRealTimers() }
  })

  it('paginates source sessions and retains restrictive metadata from the last page', async () => {
    const baseline = sourceFixture({ rows: [], rowCount: 0 }, { rows: [], rowCount: 0 })
    const report = jest.fn(async (body: any) => {
      if (body.dimensions?.[0]?.name === 'sessionSource' && !body.dimensionFilter) return body.offset === 0
        ? { rows: Array.from({ length: 10000 }, (_, i) => row([`source${i}`, 'referral'], [1])), rowCount: 10001, metadata: { timeZone: 'Europe/Minsk' } }
        : { rows: [row(['instagram.com', 'referral'], [3])], rowCount: 10001, metadata: { subjectToThresholding: true } }
      return baseline(body)
    })
    const result = await collectStats({ days: 7, channelBreakdown: true }, report)
    expect(report.mock.calls.map((call: any[]) => call[0])).toEqual(expect.arrayContaining([expect.objectContaining({ offset: 10000, limit: 10000 })]))
    expect(result.sourceBreakdown.quality.sessions).toMatchObject({ status: 'thresholded', complete: true, rowCount: 10001,
      metadata: [{ timeZone: 'Europe/Minsk' }, { subjectToThresholding: true }] })
    expect(result.sourceBreakdown.rows.find((r: any) => r.sessionSource === 'instagram.com')).toMatchObject({ sessions: null, status: { sessions: 'thresholded' } })
  })

  it.each([
    [{ complete: false }, 'incomplete'],
    [{ metadata: [{ samplingMetadatas: [{}] }] }, 'sampled'],
    [{ metadata: [{ dataLossFromOtherRow: true }] }, 'data_loss'],
  ])('withholds unqualified counts and never sums duplicate source rows (%j)', (quality, status) => {
    const report = { rows: [row(['instagram', 'social'], [2])], complete: true, metadata: [], ...quality }
    const result = buildSourceBreakdown({ sessions: report, events: null })
    expect(result.rows[0]).toMatchObject({ sessions: null, status: { sessions: status } })
    const duplicate = buildSourceBreakdown({ sessions: { rows: [...report.rows, ...report.rows], complete: true, metadata: [] } })
    expect(duplicate.rows[0]).toMatchObject({ sessions: null, status: { sessions: 'duplicate' } })
  })
})
