/** @jest-environment node */
const { parseArgs, collectStats } = require('@/scripts/fetch-ga4-stats')
const { PLANNER_DIMENSIONS, tripPlannerRequest, buildTripPlannerReport, formatTripPlannerReport } = require('@/scripts/lib/trip-planner-funnel')

const plannerRow = (event: string, source: string, auth: string, outcome: string, count: number) => ({
  dimensionValues: [event, source, auth, outcome].map((value) => ({ value })),
  metricValues: [{ value: String(count) }],
})
const plannerPeriod = { startDate: '2026-11-16', endDate: '2026-11-22', timeZone: 'Europe/Minsk', days: 7 }
const completePlannerReport = (rows: any[], metadata: any[] = []) => ({ rows, rowCount: rows.length, metadata, complete: true })

describe('trip planner source and entry-auth report', () => {
  it('queries only the planner contract using existing dimensions and event counts', () => {
    const request = tripPlannerRequest()
    expect(request.dimensions.map((d: any) => d.name)).toEqual(PLANNER_DIMENSIONS)
    expect(request.metrics).toEqual([{ name: 'eventCount' }])
    expect(request.dimensionFilter.andGroup.expressions).toEqual([
      { filter: { fieldName: 'customEvent:event_category', stringFilter: { matchType: 'EXACT', value: 'trip_planner' } } },
      { filter: { fieldName: 'eventName', inListFilter: { values: ['trip_planner_impression', 'trip_planner_entry', 'trip_planner_form_view', 'trip_created', 'trip_create_failed', 'route_point_added'], caseSensitive: true } } },
    ])
  })

  it('keeps the guest entry cohort after login, one denominator, and retry errors as attempts', () => {
    const report = buildTripPlannerReport(completePlannerReport([
      plannerRow('trip_planner_entry', 'travel', 'guest', 'auth_required', 2),
      plannerRow('trip_planner_form_view', 'travel', 'guest', 'auth_required', 2),
      plannerRow('trip_planner_form_view', 'travel', 'guest', 'ready', 1),
      plannerRow('trip_created', 'travel', 'guest', 'success', 1),
      plannerRow('trip_create_failed', 'travel', 'guest', 'error', 3),
      plannerRow('route_point_added', 'travel', 'guest', 'draft', 9),
      plannerRow('route_point_added', 'travel', 'guest', 'first_saved', 1),
      plannerRow('trip_planner_entry', 'navigation', 'authenticated', 'opened', 1),
    ]), plannerPeriod)
    expect(report.rows).toHaveLength(10)
    expect(report.rows.find((r: any) => r.source === 'travel' && r.authState === 'guest')).toMatchObject({
      entries: 2, authRequired: 2, formReady: 1, created: 1, firstSavedPoint: 1, failedAttempts: 3,
      entryRates: { authRequired: 1, formReady: 0.5, created: 0.5, firstSavedPoint: 0.5 },
    })
    expect(report.totals).toMatchObject({ entries: 3, formReady: 1, created: 1, firstSavedPoint: 1, failedAttempts: 3 })
    expect(report.totals.entryRates.created).toBeCloseTo(1 / 3)
    expect(report.excludedEventCount).toBe(11)
    expect(report.period).toEqual(plannerPeriod)
  })

  it('exposes unknown dimensions without attributing or printing private upstream values', () => {
    const report = buildTripPlannerReport(completePlannerReport([
      plannerRow('trip_planner_entry', 'private trip title', 'guest', 'opened', 2),
      plannerRow('trip_created', 'travel', '(not set)', 'success', 1),
      plannerRow('route_point_added', 'quest', 'guest', '(not set)', 4),
    ]), plannerPeriod)
    expect(report.unknownEventCount).toBe(7)
    expect(report.unknownRows).toEqual([
      { source: '(unknown)', authState: 'guest', event: 'trip_planner_entry', reasons: ['unknown_source'], count: 2 },
      { source: 'travel', authState: '(unknown)', event: 'trip_created', reasons: ['unknown_auth_state'], count: 1 },
      { source: 'quest', authState: 'guest', event: 'route_point_added', reasons: ['unknown_outcome'], count: 4 },
    ])
    expect(report.totals.entries).toBe(0)
    expect(report.totals.entryRates.created).toBeNull()
    expect(JSON.stringify(report)).not.toContain('private trip title')
  })

  it('keeps partial button impressions distinct from common-entry stage ratios and missing coverage', () => {
    const report = buildTripPlannerReport(completePlannerReport([
      plannerRow('trip_planner_impression', 'travel', 'authenticated', 'visible', 4),
      plannerRow('trip_planner_entry', 'travel', 'authenticated', 'opened', 2),
      plannerRow('trip_created', 'travel', 'authenticated', 'success', 1),
      plannerRow('trip_planner_impression', 'assistant', 'guest', 'visible', 3),
    ]), plannerPeriod)
    expect(report.rows.find((r: any) => r.source === 'travel' && r.authState === 'authenticated')).toMatchObject({
      impressions: 4, impressionCoverage: 'partial', entryPerImpression: 0.5, entryRates: { created: 0.5 },
    })
    expect(report.rows.find((r: any) => r.source === 'assistant' && r.authState === 'guest')).toMatchObject({
      impressions: 3, impressionCoverage: 'partial', entryPerImpression: 0,
    })
    for (const source of ['quest', 'navigation', 'direct']) {
      expect(report.rows.filter((r: any) => r.source === source)).toEqual([
        expect.objectContaining({ impressions: null, impressionCoverage: 'not_instrumented', entryPerImpression: null }),
        expect.objectContaining({ impressions: null, impressionCoverage: 'not_instrumented', entryPerImpression: null }),
      ])
    }
    expect(report.rows.find((r: any) => r.source === 'travel' && r.authState === 'guest').impressions).toBeNull()
    expect(report.totals).toMatchObject({ impressions: null, entryPerImpression: null, impressionCoverage: 'partial_sources' })
  })

  it.each([
    [{ complete: false }, 'incomplete'],
    [{ metadata: [{ subjectToThresholding: true }] }, 'thresholded'],
    [{ metadata: [{ samplingMetadatas: [{}] }] }, 'sampled'],
    [{ metadata: [{ dataLossFromOtherRow: true }] }, 'data_loss'],
    [{ unavailable: true, reason: 'HTTP 403' }, 'unavailable'],
  ])('withholds counts and rates for unreliable source data (%j)', (flags, status) => {
    const report = buildTripPlannerReport({ ...completePlannerReport([plannerRow('trip_planner_entry', 'direct', 'guest', 'opened', 1)]), ...flags }, plannerPeriod)
    expect(report.quality.status).toBe(status)
    expect(report.totals.entries).toBeNull()
    expect(report.rows.every((r: any) => r.entries === null && r.entryRates.created === null)).toBe(true)
    expect(report.unknownEventCount).toBeNull()
  })

  it('rejects invalid metrics and duplicate aggregate rows instead of overstating totals', () => {
    const valid = plannerRow('trip_planner_entry', 'direct', 'guest', 'opened', 1)
    const invalid = { ...valid, metricValues: [{ value: '1x' }] }
    expect(buildTripPlannerReport(completePlannerReport([invalid]), plannerPeriod)).toMatchObject({ quality: { status: 'invalid', reason: 'INVALID_EVENT_COUNT' }, totals: { entries: null } })
    expect(buildTripPlannerReport(completePlannerReport([valid, valid]), plannerPeriod)).toMatchObject({ quality: { status: 'invalid', reason: 'DUPLICATE_DIMENSION_ROW' }, totals: { entries: null } })
  })

  it('does not cap window-boundary ratios or invent a rate for a missing denominator', () => {
    const report = buildTripPlannerReport(completePlannerReport([
      plannerRow('trip_planner_entry', 'direct', 'guest', 'opened', 1),
      plannerRow('trip_created', 'direct', 'guest', 'success', 2),
      plannerRow('trip_created', 'assistant', 'authenticated', 'success', 1),
    ]), plannerPeriod)
    expect(report.rows.find((r: any) => r.source === 'direct' && r.authState === 'guest').entryRates.created).toBe(2)
    expect(report.rows.find((r: any) => r.source === 'assistant' && r.authState === 'authenticated').entryRates.created).toBeNull()
    expect(formatTripPlannerReport(report)).toContain('200.0%')
    expect(report.caveats).toContain('window_event_counts_not_closed_cohort')
    expect(report.caveats).toContain('journey_expires_after_30_minutes')
    expect(formatTripPlannerReport(report)).toContain('Контекст входа действует 30 минут')
  })

  it('keeps all source cohorts visible when no events were observed without claiming no usage', () => {
    const report = buildTripPlannerReport(completePlannerReport([]), plannerPeriod)
    expect(report.rows).toHaveLength(10)
    expect(report.totals.entries).toBe(0)
    expect(report.totals.entryRates.created).toBeNull()
    expect(formatTripPlannerReport(report)).toContain('это не доказывает отсутствие действий')
  })

  it('integrates the flag with the resolved property period and paginated report transport', async () => {
    const args = parseArgs(['node', 'stats', '--trip-planner', '--start-date', plannerPeriod.startDate, '--end-date', plannerPeriod.endDate])
    expect(args.tripPlanner).toBe(true)
    const report = jest.fn(async (body: any) => {
      const dims = body.dimensions?.map((d: any) => d.name) || []
      if (!dims.length) return { rows: [{ metricValues: ['0', '0', '0', '0', '0'].map((value) => ({ value })) }], metadata: { timeZone: plannerPeriod.timeZone } }
      if (dims[0] === 'eventName') {
        expect(body).toMatchObject({ ...tripPlannerRequest(), dateRanges: [{ startDate: plannerPeriod.startDate, endDate: plannerPeriod.endDate }], limit: 10000, offset: 0 })
        return { rows: [plannerRow('trip_planner_entry', 'quest', 'authenticated', 'opened', 2)], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })
    const stats = await collectStats(args, report)
    expect(stats.tripPlanner.period).toEqual(plannerPeriod)
    expect(stats.tripPlanner.totals.entries).toBe(2)
    expect(stats.tripPlanner.quality.complete).toBe(true)
  })
})
