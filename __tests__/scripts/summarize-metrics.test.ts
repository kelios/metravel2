/** @jest-environment node */

import path from 'node:path'
import { makeTempDir, runCli } from './cli-test-utils'
import fs from 'node:fs'
import crypto from 'node:crypto'

jest.mock('@/scripts/lib/google-token', () => ({ getAccessToken: jest.fn() }))
jest.mock('@/scripts/fetch-gsc-stats', () => ({ query: jest.fn() }))
jest.mock('@/scripts/fetch-ga4-stats', () => ({ runReport: jest.fn(), allRows: jest.fn() }))
jest.mock('@/scripts/lib/yandex-token', () => ({ readOptionalSecretToken: jest.fn() }))

const {
  EVENTS, reportingWindow, monthEnd, validMonth, authorIds, communityStats,
  aggregateGsc, aggregateGa4, compare, buildSummary, renderMarkdown, runDate,
} = require('@/scripts/lib/metrics-summary')
const { readCatalog, collectSources, safeFailure, gscStart, gscEnd } = require('@/scripts/lib/metrics-summary-sources')
const { getAccessToken } = require('@/scripts/lib/google-token')
const { query } = require('@/scripts/fetch-gsc-stats')
const { runReport, allRows } = require('@/scripts/fetch-ga4-stats')
const { readOptionalSecretToken } = require('@/scripts/lib/yandex-token')
const { SOURCE_EVENTS } = require('@/scripts/lib/ga4-source-breakdown')

const NOW = new Date('2026-10-19T12:00:00Z')
const WINDOW = {
  from: '2025-10-01', to: '2026-09-30',
  comparisonFrom: '2024-10-01', comparisonTo: '2025-09-30',
}
const MONTHS = ['2025-10', '2025-11']
const published = (userIds: unknown, published_at?: string, extra = {}) => ({
  publication_status: 'published', userIds,
  ...(published_at === undefined ? {} : { published_at }), ...extra,
})
const gaRow = (dimensions: string[], metrics: number[]) => ({
  dimensionValues: dimensions.map((value) => ({ value })),
  metricValues: metrics.map((value) => ({ value: String(value) })),
})
const qualified = (rows: unknown[], extra = {}) => ({ rows, complete: true, metadata: [{}], ...extra })
const gscRow = (date: string, clicks: number, impressions: number, position: number) => ({
  keys: [date], clicks, impressions, position,
})
const emptySources = () => ({ travels: [], quests: [] })

describe('monthly metrics: completed calendar windows', () => {
  it('uses twelve completed months and a separate twelve-month YoY baseline', () => {
    expect(reportingWindow(NOW)).toEqual(WINDOW)
    const report = buildSummary(emptySources(), { now: NOW })
    expect(report.months.map((row: { month: string }) => row.month)).toEqual([
      '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ])
    expect(report.yoy.map((row: { previousMonth: string }) => row.previousMonth)).toEqual([
      '2024-10', '2024-11', '2024-12', '2025-01', '2025-02', '2025-03',
      '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
    ])
  })

  it('rolls the year and includes leap February without overlapping March', () => {
    expect(reportingWindow(new Date('2026-01-01T12:00:00Z'))).toEqual({
      from: '2025-01-01', to: '2025-12-31', comparisonFrom: '2024-01-01', comparisonTo: '2024-12-31',
    })
    expect(monthEnd('2024-02')).toBe('2024-02-29')
    expect(monthEnd('2025-02')).toBe('2025-02-28')
    expect(reportingWindow(NOW, '2024-02').to).toBe('2024-02-29')
  })

  it('defaults by the Europe/Warsaw calendar even before UTC month rollover', () => {
    const boundary = new Date('2026-09-30T22:30:00Z')
    expect(runDate(boundary)).toBe('2026-10-01')
    expect(reportingWindow(boundary)).toEqual(WINDOW)
    expect(runDate(new Date('2026-03-31T22:30:00Z'))).toBe('2026-04-01')
  })

  it.each(['2026-10', '2026-11', '2026-13', '2026-9', '2000-12', ''])('rejects incomplete or invalid end month %s', (month) => {
    expect(() => reportingWindow(NOW, month)).toThrow()
  })

  it('limits GSC requests to fully retained months while preserving the intended reporting window', () => {
    expect(gscStart(WINDOW, NOW)).toBe('2025-07-01')
    expect(gscStart({ ...WINDOW, comparisonFrom: '2026-01-01' }, NOW)).toBe('2026-01-01')
    expect(WINDOW.comparisonFrom).toBe('2024-10-01')
  })

  it('withholds the not-yet-final tail of GSC near month-start in its source calendar', () => {
    expect(gscEnd(WINDOW, NOW)).toBe('2026-09-30')
    expect(gscEnd(WINDOW, new Date('2026-10-01T00:30:00Z'))).toBe('2026-09-27')
  })
})

describe('monthly metrics: source arithmetic and qualification', () => {
  it('weights GSC position by impressions and recomputes CTR from totals', () => {
    const gaps: string[] = []
    const result = aggregateGsc({ from: '2025-10-01', to: '2025-10-31', rows: [
      { ...gscRow('2025-10-01', 10, 100, 2), ctr: 0.1 },
      { ...gscRow('2025-10-02', 0, 900, 10), ctr: 0 },
    ] }, ['2025-10'], gaps)['2025-10']
    expect(result).toMatchObject({ clicks: 10, impressions: 1000 })
    expect(result.ctr).toBeCloseTo(0.01)
    expect(result.position).toBeCloseTo(9.2)
    expect(gaps).toEqual([])
  })

  it('withholds empty and partially covered GSC months instead of fabricating zeros', () => {
    const gaps: string[] = []
    const result = aggregateGsc({ from: '2025-10-02', to: '2025-11-30', rows: [
      gscRow('2025-10-02', 1, 10, 3),
    ] }, MONTHS, gaps)
    expect(result).toEqual({ '2025-10': null, '2025-11': null })
    expect(gaps.join(' ')).toMatch(/покрытия|хранения/)
  })

  it('preserves measured zero counts but leaves ratios with zero impressions undefined', () => {
    const result = aggregateGsc({ from: '2025-10-01', to: '2025-10-31', rows: [
      gscRow('2025-10-01', 0, 0, 0),
    ] }, ['2025-10'], [])
    expect(result['2025-10']).toEqual({ clicks: 0, impressions: 0, ctr: null, position: null })
  })

  it('does not use malformed source metrics in definitive GSC totals', () => {
    const gaps: string[] = []
    const result = aggregateGsc({ from: '2025-10-01', to: '2025-10-31', rows: [
      { ...gscRow('2025-10-01', 1, 10, 3), impressions: 'not-a-number' },
    ] }, ['2025-10'], gaps)
    expect(result['2025-10']).toBeNull()
    expect(gaps.join(' ')).toContain('некорректные метрики')
  })

  it('uses independently queried monthly active users, never the sum of channel users', () => {
    const data = aggregateGa4({
      totals: qualified([gaRow(['202510'], [100, 150, 0.2]), gaRow(['202511'], [110, 170, 0.3])]),
      channels: qualified([gaRow(['202510', 'Organic Search'], [80, 90]), gaRow(['202510', 'Direct'], [60, 60])]),
      events: qualified([gaRow(['202510', 'quest_start'], [7]), gaRow(['202510', 'quest_finish'], [0])]),
    }, MONTHS, [])
    expect(data['2025-10'].ga4).toMatchObject({ activeUsers: 100, sessions: 150, bounceRate: 0.2 })
    expect(data['2025-10'].ga4.channels).toHaveLength(2)
    expect(data['2025-11'].ga4.activeUsers).toBe(110)
    expect(data['2025-10'].funnels).toMatchObject({ quest_start: 7, quest_finish: 0, registration_complete: null })
    expect(data['2025-11'].funnels.quest_start).toBeNull()
  })

  it.each([
    { complete: false },
    { metadata: [{ subjectToThresholding: true }] },
    { metadata: [{}, { samplingMetadatas: [{}] }] },
    { metadata: [{ dataLossFromOtherRow: true }] },
  ])('withholds GA4 headline totals with unqualified metadata %j', (quality) => {
    const gaps: string[] = []
    const result = aggregateGa4({
      totals: qualified([gaRow(['202510'], [100, 150, 0.2])], quality),
      channels: qualified([]), events: qualified([gaRow(['202510', 'quest_start'], [3])]),
    }, ['2025-10'], gaps)['2025-10']
    expect(result.ga4).toBeNull()
    expect(result.funnels.quest_start).toBe(3)
    expect(gaps.join(' ')).toContain('значения не используются')
  })

  it('qualifies channels and events independently of usable headline totals', () => {
    const gaps: string[] = []
    const result = aggregateGa4({
      totals: qualified([gaRow(['202510'], [100, 150, 0.2])]),
      channels: qualified([gaRow(['202510', 'Direct'], [100, 150])], { complete: false }),
      events: qualified([gaRow(['202510', 'quest_start'], [9])], { metadata: [{ subjectToThresholding: true }] }),
    }, ['2025-10'], gaps)['2025-10']
    expect(result.ga4.activeUsers).toBe(100)
    expect(result.ga4.channels).toEqual([])
    expect(result.funnels.quest_start).toBeNull()
    expect(gaps.join(' ')).toContain('GA4 каналы')
    expect(gaps.join(' ')).toContain('GA4 события')
  })

  it('retains independently qualified channels when headline totals are unavailable', () => {
    const gaps: string[] = []
    const result = aggregateGa4({
      totals: null,
      channels: qualified([gaRow(['202510', 'Direct'], [100, 150])]),
    }, ['2025-10'], gaps)['2025-10']
    expect(result.ga4).toEqual({
      activeUsers: null, sessions: null, bounceRate: null,
      channels: [{ channel: 'Direct', activeUsers: 100, sessions: 150 }],
    })
    expect(gaps.join(' ')).toContain('не имеет подтверждённых месячных итогов')
  })

  it('does not turn an absent or duplicate event row into a measured event count', () => {
    const gaps: string[] = []
    const result = aggregateGa4({ events: qualified([
      gaRow(['202510', 'quest_start'], [2]), gaRow(['202510', 'quest_start'], [3]),
      gaRow(['202510', 'affiliate_click'], [4]),
    ]) }, ['2025-10'], gaps)['2025-10']
    expect(Object.keys(result.funnels)).toEqual(EVENTS)
    expect(Object.values(result.funnels)).toEqual(EVENTS.map(() => null))
    expect(gaps.join(' ')).toContain('не число регистраций')
  })

  it('keeps monthly source sessions separate from event counts and preserves aliases and event-only rows', () => {
    const report = buildSummary({ ...emptySources(), ga4: {
      totals: qualified([gaRow(['202510'], [100, 150, 0.2])]),
      channels: qualified([gaRow(['202510', 'Organic Social'], [70, 80])]),
      events: qualified([gaRow(['202510', 'registration_complete'], [10])]),
      sourceSessions: qualified([
        gaRow(['202510', 'instagram', 'social'], [12]), gaRow(['202510', 'instagram.com', 'referral'], [5]),
        gaRow(['202510', 'facebook', 'social'], [20]), gaRow(['202511', 'instagram', 'social'], [8]),
      ]),
      sourceEvents: qualified([
        gaRow(['202510', 'instagram', 'social', 'registration_complete'], [2]),
        gaRow(['202510', 'instagram', 'social', 'travel_publish'], [0]),
        gaRow(['202510', 'l.instagram.com', 'referral', 'route_create_started'], [1]),
        gaRow(['202511', 'instagram', 'social', 'travel_publish'], [3]),
      ]),
    } }, { now: NOW })
    const october = report.months[0]
    expect(october.ga4.sessions).toBe(150)
    expect(october.funnels.registration_complete).toBe(10)
    expect(october.sourceBreakdown.rows.find((r: any) => r.sessionSource === 'instagram')).toMatchObject({
      sessions: 12, events: { registration_complete: 2, route_create_started: null, travel_publish: 0 },
    })
    expect(october.sourceBreakdown.rows.find((r: any) => r.sessionSource === 'instagram.com')).toMatchObject({ sessions: 5, channel: 'instagram' })
    expect(october.sourceBreakdown.rows.find((r: any) => r.sessionSource === 'l.instagram.com')).toMatchObject({ sessions: null, channel: 'instagram', events: { route_create_started: 1 } })
    expect(october.sourceBreakdown.rows.find((r: any) => r.sessionSource === 'facebook').channel).toBe('other')
    expect(report.months[1].sourceBreakdown.rows[0]).toMatchObject({ sessions: 8, events: { registration_complete: null, travel_publish: 3 } })
    expect(report.months[2].sourceBreakdown.rows[0]).toMatchObject({ placeholder: true, sessions: null, status: { sessions: 'not_observed' } })
    const markdown = renderMarkdown(report)
    expect(markdown).toContain('## Источники GA4 / Instagram')
    expect(markdown).toContain('| 2025-10 | instagram | social | instagram | 12 | 2 | не зафиксировано | 0 |')
    expect(markdown).toContain('| 2025-10 | l.instagram.com | referral | instagram | не зафиксировано | не зафиксировано | 1 | не зафиксировано |')
    expect(markdown).toContain('eventCount, не уникальные пользователи и не conversion rate')
  })

  it('distinguishes unavailable and thresholded source queries from unobserved months in Markdown', () => {
    const report = buildSummary({ ...emptySources(), ga4: {
      sourceSessions: null,
      sourceEvents: qualified([gaRow(['202510', 'instagram', 'social', 'travel_publish'], [4])], { metadata: [{ subjectToThresholding: true }] }),
    } }, { now: NOW })
    expect(report.months[0].sourceBreakdown.rows[0]).toMatchObject({ sessions: null, events: { travel_publish: null },
      status: { sessions: 'unavailable', events: { travel_publish: 'thresholded' } } })
    const markdown = renderMarkdown(report)
    expect(markdown).toContain('нет данных (unavailable)')
    expect(markdown).toContain('нет данных (thresholded)')
    expect(markdown).toContain('subjectToThresholding')
    expect(report.gaps.join(' ')).toContain('GA4 источники')
  })
})

describe('monthly metrics: CLI refuses unsupported work before source access', () => {
  const script = path.resolve(process.cwd(), 'scripts/summarize-metrics.js')
  const contract = path.resolve(process.cwd(), 'scripts/lib/cli-contract.js')
  const invoke = (args: string[], importOnly = false) => runCli(process.execPath, ['-e', `
    global.fetch = () => { throw new Error('UNEXPECTED_HTTP_CANARY') };
    process.argv = ${JSON.stringify(['node', script, ...args])};
    const cli = require(${JSON.stringify(script)});
    ${importOnly ? '' : `require(${JSON.stringify(contract)}).runCli(cli.main, cli.CLI_SPEC);`}
  `], { timeoutMs: 10000, env: { GA4_PROPERTY_ID: '362328641' } })

  it('can be imported without collecting data, writing reports or printing output', () => {
    const result = invoke([], true)
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })

  it('prints help without starting a source request', () => {
    const result = invoke(['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('--end-month YYYY-MM')
    expect(result.stdout).toContain('--property ID')
    expect(result.stdout).toContain('--store-reports-dir DIR')
    expect(result.stderr).toBe('')
  })

  it.each([
    ['--days', '365'], ['--end-month'], ['--property', 'not-a-number'],
    ['--store-reports-dir'], ['--end-month', '9999-01'], ['--end-month', '2025-13'], ['--json=false'],
  ])('rejects invalid arguments %j without fetching a source', (...args) => {
    const result = invoke(args)
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/stats:summary/)
    expect(result.stdout).not.toContain('Отчёт:')
    expect(`${result.stdout}${result.stderr}`).not.toContain('UNEXPECTED_HTTP_CANARY')
  })
})

describe('monthly metrics: public snapshot and community approximation', () => {
  it('uses all history before the window and counts an author first seen exactly at the window start', () => {
    const result = communityStats([
      published('2', '2020-03-15'), published('2', '2025-10-15'),
      published('3', '2025-10-01'), published('3', '2025-11-04'),
      published('4', '2025-11-01'),
      { ...published('5', '2025-10-01'), publication_status: 'draft' },
    ], MONTHS, [])
    expect(result.content).toMatchObject({ articles: 5, authors: 3 })
    expect(result.monthly['2025-10']).toMatchObject({ newAuthors: 1, publicationsNotAuthor1: 2 })
    expect(result.monthly['2025-11']).toMatchObject({ newAuthors: 1, publicationsNotAuthor1: 2 })
  })

  it('parses comma IDs, deduplicates coauthors and includes owner coauthorship in author-1 share', () => {
    expect(authorIds({ userIds: ' 1, 2, 2,003 ' })).toEqual(['1', '2', '3'])
    expect(authorIds({ user_ids: [2, 3] })).toEqual(['2', '3'])
    expect(authorIds({ user: { id: 4 } })).toEqual(['4'])
    const result = communityStats([
      published('1,2', '2025-10-01'), published('2,3', '2025-10-02'),
    ], MONTHS, [])
    expect(result.content).toMatchObject({ articles: 2, author1Articles: 1, author1Share: 0.5, authors: 3 })
    expect(result.monthly['2025-10']).toMatchObject({ newAuthors: 3, publicationsNotAuthor1: 1 })
  })

  it('labels created_at as a trip-date proxy when no publication timestamps are available', () => {
    const gaps: string[] = []
    const result = communityStats([published('2', undefined, { created_at: '2025-10-03' })], MONTHS, gaps)
    expect(result.monthly['2025-10']).toMatchObject({ newAuthors: 1, dateSource: 'created_at_trip_date' })
    expect(gaps.join(' ')).toContain('по дате поездки, не по дате публикации')
  })

  it('does not silently mix trip dates into a catalogue that advertises publication timestamps', () => {
    const gaps: string[] = []
    const result = communityStats([
      published('2', '2025-11-03', { created_at: '2025-10-01' }),
      published('3', undefined, { created_at: '2025-10-01' }),
    ], MONTHS, gaps)
    expect(result.content.missingDate).toBe(1)
    expect(result.monthly['2025-10'].newAuthors).toBeNull()
    expect(result.monthly['2025-10'].publicationsNotAuthor1).toBeNull()
    expect(gaps.join(' ')).toMatch(/дат/)
  })

  it('withholds first-author claims when the same author has an undated article', () => {
    const gaps: string[] = []
    const result = communityStats([published('2'), published('2', '2025-10-04')], MONTHS, gaps)
    expect(result.content).toMatchObject({ articles: 2, authors: 1, missingDate: 1 })
    expect(result.monthly['2025-10'].newAuthors).toBeNull()
    expect(result.monthly['2025-10'].publicationsNotAuthor1).toBeNull()
    expect(gaps.join(' ')).toContain('без достоверной даты')
  })

  it.each([undefined, '', '1,unknown', [], ['2', '']])('withholds identity-based totals for invalid author IDs %j', (ids) => {
    const gaps: string[] = []
    const result = communityStats([published(ids, '2025-10-03')], MONTHS, gaps)
    expect(result.content).toMatchObject({ articles: 1, authors: null, author1Share: null, missingAuthor: 1 })
    expect(result.monthly['2025-10']).toMatchObject({ newAuthors: null, publicationsNotAuthor1: null })
    expect(gaps.join(' ')).toContain('нет стабильного ID автора')
  })

  it.each(['2025-02-29', '2024-02-30', '2025-04-31', '2025-13-01', 'invalid', ''])('rejects impossible dates %s', (date) => {
    expect(validMonth(date)).toBeNull()
  })

  it('accepts a real leap day and a publication timestamp', () => {
    expect(validMonth('2024-02-29')).toBe('2024-02')
    expect(validMonth('2025-10-01T12:00:00Z')).toBe('2025-10')
  })

  it('distinguishes an empty measured public snapshot from unavailable catalogues', () => {
    const empty = buildSummary(emptySources(), { now: NOW })
    const missing = buildSummary({}, { now: NOW })
    expect(empty.content).toMatchObject({ articles: 0, authors: 0, author1Share: null, quests: 0, completions: 0 })
    expect(empty.months[0].community).toMatchObject({ newAuthors: 0, publicationsNotAuthor1: 0 })
    expect(missing.content).toMatchObject({ articles: null, authors: null, quests: null, completions: null })
    expect(missing.months[0].community).toMatchObject({ newAuthors: null, publicationsNotAuthor1: null })
  })

  it('withholds quest-completion totals when even one quest has no reliable counter', () => {
    const report = buildSummary({ travels: [], quests: [{ completions_count: 3 }, {}] }, { now: NOW })
    expect(report.content).toMatchObject({ quests: 2, completions: null })
    expect(report.gaps.join(' ')).toContain('сумма не вычислена')
  })
})

describe('monthly metrics: comparable YoY and safe readable output', () => {
  it('uses percent for counts, percentage points for rates and raw delta for positions', () => {
    expect(compare(150, 100)).toMatchObject({ change: 50, unit: 'percent' })
    expect(compare(0.12, 0.1, 'pp').change).toBeCloseTo(2)
    expect(compare(3, 5, 'delta')).toMatchObject({ change: -2, unit: 'delta' })
  })

  it.each([[5, 0], [0, 0], [5, null], [null, 5], [NaN, 5], [5, Infinity]])('does not invent percentage growth for %s / %s', (current, previous) => {
    expect(compare(current, previous)).toMatchObject({ change: null, reason: expect.any(String) })
  })

  it('pairs matching months, withholds missing baselines and retains rate/direction units', () => {
    const report = buildSummary({ ...emptySources(), gsc: {
      from: WINDOW.comparisonFrom, to: WINDOW.to,
      rows: [gscRow('2024-10-02', 10, 100, 5), gscRow('2025-10-02', 15, 100, 3)],
    } }, { now: NOW })
    const first = report.yoy[0]
    expect(first).toMatchObject({ month: '2025-10', previousMonth: '2024-10' })
    expect(first.metrics['gsc.clicks']).toMatchObject({ change: 50, unit: 'percent' })
    expect(first.metrics['gsc.ctr'].change).toBeCloseTo(5)
    expect(first.metrics['gsc.position']).toMatchObject({ change: -2, unit: 'delta' })
    expect(report.yoy[1].metrics['gsc.clicks'].change).toBeNull()
  })

  it('renders exactly twelve primary rows, source calendars, gaps and no raw article identity', () => {
    const canary = 'private-person@example.invalid'
    const report = buildSummary({
      travels: [published('987654321', '2025-10-01', { name: canary, email: canary })], quests: [],
      gaps: ['Источник временно недоступен | повторить\nпосле доступа'],
    }, { now: NOW })
    const markdown = renderMarkdown(report)
    const primary = markdown.split('## Помесячные показатели')[1].split('## События GA4')[0]
    expect(primary.split('\n').filter((line: string) => /^\| \d{4}-\d{2} \|/.test(line))).toHaveLength(12)
    expect(markdown).toContain('2025-10-01 — 2026-09-30')
    expect(markdown).toContain('2024-10-01 — 2025-09-30')
    expect(markdown).toContain('Europe/Warsaw')
    expect(markdown).toContain('America/Los_Angeles')
    expect(markdown).toContain('нет данных')
    expect(markdown).toContain('instrumentation gap: Источник временно недоступен \\| повторить после доступа')
    expect(markdown).toContain('по дате поездки, не по дате публикации')
    expect(markdown).toContain('меньше лучше')
    expect(markdown).not.toContain(canary)
    expect(markdown).not.toContain('987654321')
  })
})

describe('monthly metrics: bounded complete public catalogues', () => {
  const originalFetch = global.fetch
  const first = 'https://metravel.by/api/travels/?publish=1&page=1'
  let fetchMock: jest.Mock
  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock
  })
  afterEach(() => { global.fetch = originalFetch })
  const page = (body: unknown) => ({ ok: true, json: async () => body })
  const read = () => readCatalog(first, new AbortController().signal)

  it('follows same-origin results/next/count beyond a short first page', async () => {
    fetchMock.mockResolvedValueOnce(page({ count: 3, results: [{ id: 1 }], next: '?publish=1&page=2' }))
      .mockResolvedValueOnce(page({ count: 3, results: [{ id: 2 }, { id: 3 }], next: null }))
    expect(await read()).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('page=2')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' })
  })

  it('supports count-bearing legacy data envelopes without stopping at a short page', async () => {
    fetchMock.mockResolvedValueOnce(page({ total: 2, data: [{ id: 1 }] }))
      .mockResolvedValueOnce(page({ total: 2, data: [{ id: 2 }] }))
    expect(await read()).toEqual([{ id: 1 }, { id: 2 }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('probes beyond a short bare-array page until an empty page confirms the end', async () => {
    const rows = Array.from({ length: 100 }, (_, id) => ({ id }))
    fetchMock.mockResolvedValueOnce(page(rows)).mockResolvedValueOnce(page([{ id: 100 }])).mockResolvedValueOnce(page([]))
    expect(await read()).toHaveLength(101)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each(['array', 'data'])('does not mistake a server page-size cap for the end of a %s catalogue', async (format) => {
    const envelope = (rows: object[]) => page(format === 'array' ? rows : { data: rows })
    fetchMock.mockResolvedValueOnce(envelope([{ id: 1 }]))
      .mockResolvedValueOnce(envelope([{ id: 2 }]))
      .mockResolvedValueOnce(envelope([]))
    expect(await read()).toEqual([{ id: 1 }, { id: 2 }])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each([
    { count: 2, results: [{ id: 1 }], next: null },
    { count: 0, results: [{ id: 1 }], next: null },
    { count: -1, results: [], next: null },
    { count: 1, results: [], next: '?publish=1&page=2' },
  ])('rejects a truncated or inconsistent catalogue %j', async (response) => {
    fetchMock.mockResolvedValue(page(response))
    await expect(read()).rejects.toMatchObject({ code: 'INCOMPLETE' })
  })

  it('rejects a changing promised count', async () => {
    fetchMock.mockResolvedValueOnce(page({ count: 2, results: [{ id: 1 }], next: '?publish=1&page=2' }))
      .mockResolvedValueOnce(page({ count: 3, results: [{ id: 2 }], next: null }))
    await expect(read()).rejects.toMatchObject({ code: 'INCOMPLETE' })
  })

  it('rejects repeated IDs rather than counting a duplicated page as new publications', async () => {
    fetchMock.mockResolvedValueOnce(page({ count: 2, results: [{ id: 1 }], next: '?publish=1&page=2' }))
      .mockResolvedValueOnce(page({ count: 2, results: [{ id: 1 }], next: null }))
    await expect(read()).rejects.toMatchObject({ code: 'PAGINATION_LOOP' })
  })

  it('stops a cyclic next pointer before requesting the same page again', async () => {
    fetchMock.mockResolvedValue(page({ results: [{ id: 1 }], next: '?publish=1&page=1' }))
    await expect(read()).rejects.toMatchObject({ code: 'PAGINATION_LOOP' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    'https://attacker.invalid/api/travels/?publish=1&page=2',
    '//attacker.invalid/api/travels/?publish=1&page=2',
    'https://user:password@metravel.by/api/travels/?publish=1&page=2',
    '/api/quests/?publish=1&page=2', '?publish=0&page=2', '?page=2',
    '?publish=1&page=0', '?publish=1&page=2#fragment',
  ])('rejects unsafe pagination before fetching it: %s', async (next) => {
    fetchMock.mockResolvedValueOnce(page({ count: 2, results: [{ id: 1 }], next }))
    await expect(read()).rejects.toMatchObject({ code: 'UNSAFE_NEXT' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed envelopes and records without stable IDs', async () => {
    fetchMock.mockResolvedValueOnce(page({ results: 'not-an-array' }))
    await expect(read()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    fetchMock.mockResolvedValueOnce(page({ results: [{ title: 'no id' }], next: null }))
    await expect(read()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('keeps independent available sources and sanitizes a failed Google response', async () => {
    getAccessToken.mockResolvedValue({ accessToken: 'unit-test-token' })
    query.mockRejectedValue(new Error('GSC query failed (403): token=private-canary@example.invalid'))
    readOptionalSecretToken.mockReturnValue(null)
    runReport.mockResolvedValue({ rows: [], rowCount: 0, metadata: { timeZone: 'Europe/Warsaw' } })
    allRows.mockImplementation(async (request: (body: object) => Promise<{ rows: unknown[]; metadata: object }>, body: object) => {
      const response = await request(body)
      return { ...response, metadata: [response.metadata], complete: true }
    })
    fetchMock.mockImplementation(async (url: URL | string) => {
      const pathname = new URL(String(url)).pathname
      if (pathname === '/api/travels/') return page({ results: [{ id: 1 }], count: 1, next: null })
      if (pathname === '/api/quests/') return page({ results: [], count: 0, next: null })
      throw new Error('Unexpected mocked endpoint')
    })
    const sources = await collectSources({ window: WINDOW, now: NOW })
    expect(sources.gsc).toBeNull()
    expect(sources.ga4.totals.complete).toBe(true)
    expect(sources.travels).toEqual([{ id: 1 }])
    expect(sources.quests).toEqual([])
    expect(sources.gaps).toEqual(expect.arrayContaining(['gsc: HTTP 403', expect.stringMatching(/^metrika: .*\(UNCONFIGURED\)$/)]))
    expect(sources.provenance.gsc.status).toBe('unavailable')
    expect(sources.provenance.travels.status).toBe('collected')
    expect(JSON.stringify(sources)).not.toMatch(/private-canary|unit-test-token/)
    expect(getAccessToken.mock.calls).toEqual(expect.arrayContaining([
      ['https://www.googleapis.com/auth/analytics.readonly', undefined, { signal: expect.any(AbortSignal) }],
      ['https://www.googleapis.com/auth/webmasters.readonly', undefined, { signal: expect.any(AbortSignal) }],
    ]))
    expect(allRows.mock.calls.map((call: [unknown, { dimensions: { name: string }[] }]) => call[1].dimensions.map((d) => d.name))).toEqual(expect.arrayContaining([
      ['yearMonth'], ['yearMonth', 'sessionDefaultChannelGroup'], ['yearMonth', 'eventName'],
      ['yearMonth', 'sessionSource', 'sessionMedium'], ['yearMonth', 'sessionSource', 'sessionMedium', 'eventName'],
    ]))
    const sourceRequests = allRows.mock.calls.map((call: [unknown, any]) => call[1]).filter((body: any) => body.dimensions[1]?.name === 'sessionSource')
    expect(sourceRequests.find((body: any) => body.dimensions.length === 3)).toMatchObject({
      dateRanges: [{ startDate: WINDOW.comparisonFrom, endDate: WINDOW.to }], metrics: [{ name: 'sessions' }],
    })
    expect(sourceRequests.find((body: any) => body.dimensions.length === 3).dimensionFilter).toBeUndefined()
    expect(sourceRequests.find((body: any) => body.dimensions.length === 4)).toMatchObject({ metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: SOURCE_EVENTS, caseSensitive: true } } },
    })
  })

  it('aborts a stalled Google token exchange at the source deadline and retains other sources', async () => {
    jest.useFakeTimers()
    const signals: AbortSignal[] = []
    getAccessToken.mockImplementation((_scope: string, _keyPath: unknown, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      signals.push(options.signal)
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
    }))
    readOptionalSecretToken.mockReturnValue(null)
    fetchMock.mockResolvedValue(page({ results: [], count: 0, next: null }))
    try {
      const pending = collectSources({ window: WINDOW, now: NOW })
      await jest.advanceTimersByTimeAsync(30000)
      const sources = await pending
      expect(signals).toHaveLength(2)
      expect(signals.every((signal) => signal.aborted)).toBe(true)
      expect(sources.gsc).toBeNull()
      expect(sources.ga4).toBeNull()
      expect(sources.travels).toEqual([])
      expect(sources.provenance.gsc.reason).toBe('TIMEOUT')
      expect(sources.provenance.ga4.reason).toBe('TIMEOUT')
    } finally {
      jest.useRealTimers()
      getAccessToken.mockReset()
    }
  })

  it.each(['totals', 'channels'])('retains successful GA4 reports when %s fails independently', async (failedReport) => {
    getAccessToken.mockResolvedValue({ accessToken: 'unit-test-token' })
    query.mockResolvedValue({ rows: [] })
    readOptionalSecretToken.mockReturnValue(null)
    allRows.mockImplementation(jest.requireActual('@/scripts/fetch-ga4-stats').allRows)
    runReport.mockImplementation(async (_token: string, _property: string, body: { dimensions: { name: string }[] }) => {
      const dimension = body.dimensions[1]?.name
      const name = dimension === 'eventName' ? 'events' : dimension ? 'channels' : 'totals'
      if (name === failedReport) throw new Error('GA4 runReport failed (403): token=private-canary')
      const row = name === 'events' ? gaRow(['202510', 'quest_start'], [7])
        : name === 'channels' ? gaRow(['202510', 'Direct'], [100, 150])
          : gaRow(['202510'], [100, 150, 0.2])
      return { rows: [row], rowCount: 1, metadata: { timeZone: 'Europe/Warsaw' } }
    })
    fetchMock.mockResolvedValue(page({ results: [], count: 0, next: null }))
    const sources = await collectSources({ window: WINDOW, now: NOW })
    const report = buildSummary(sources, { now: NOW })
    expect(sources.ga4[failedReport]).toBeNull()
    expect(sources.ga4.events.complete).toBe(true)
    expect(sources.provenance.ga4.status).toBe('partial')
    expect(sources.provenance.ga4.reports[failedReport]).toEqual({ status: 'unavailable', reason: 'HTTP 403' })
    expect(sources.gaps).toContain(`ga4.${failedReport}: HTTP 403`)
    expect(report.months[0].funnels.quest_start).toBe(7)
    if (failedReport === 'totals') {
      expect(report.months[0].ga4.activeUsers).toBeNull()
      expect(renderMarkdown(report)).toContain('| 2025-10 | Direct | 100 | 150 |')
    } else {
      expect(report.months[0].ga4.activeUsers).toBe(100)
      expect(report.months[0].ga4.channels).toEqual([])
    }
    expect(JSON.stringify(sources)).not.toMatch(/private-canary|unit-test-token/)
  })

  it.each(['sourceSessions', 'sourceEvents'])('keeps the three original aggregates when %s fails independently', async (failedReport) => {
    getAccessToken.mockResolvedValue({ accessToken: 'unit-test-token' })
    query.mockResolvedValue({ rows: [] })
    readOptionalSecretToken.mockReturnValue(null)
    allRows.mockImplementation(jest.requireActual('@/scripts/fetch-ga4-stats').allRows)
    runReport.mockImplementation(async (_token: string, _property: string, body: { dimensions: { name: string }[] }) => {
      const dimensions = body.dimensions.map((d) => d.name)
      const name = dimensions[1] === 'sessionSource' ? dimensions.includes('eventName') ? 'sourceEvents' : 'sourceSessions'
        : dimensions[1] === 'eventName' ? 'events' : dimensions[1] ? 'channels' : 'totals'
      if (name === failedReport) throw new Error('GA4 runReport failed (403): token=private-canary')
      const row = name === 'sourceSessions' ? gaRow(['202510', 'instagram', 'social'], [12])
        : name === 'sourceEvents' ? gaRow(['202510', 'instagram', 'social', 'travel_publish'], [2])
          : name === 'events' ? gaRow(['202510', 'quest_start'], [7])
            : name === 'channels' ? gaRow(['202510', 'Direct'], [100, 150]) : gaRow(['202510'], [100, 150, 0.2])
      return { rows: [row], rowCount: 1, metadata: { timeZone: 'Europe/Warsaw' } }
    })
    fetchMock.mockResolvedValue(page({ results: [], count: 0, next: null }))
    const sources = await collectSources({ window: WINDOW, now: NOW })
    const report = buildSummary(sources, { now: NOW })
    expect(sources.ga4[failedReport]).toBeNull()
    expect(sources.provenance.ga4.reports[failedReport]).toEqual({ status: 'unavailable', reason: 'HTTP 403' })
    expect(report.months[0].ga4).toMatchObject({ activeUsers: 100, sessions: 150, channels: [{ channel: 'Direct' }] })
    expect(report.months[0].funnels.quest_start).toBe(7)
    const source = report.months[0].sourceBreakdown.rows[0]
    if (failedReport === 'sourceSessions') expect(source).toMatchObject({ sessions: null, events: { travel_publish: 2 }, status: { sessions: 'unavailable' } })
    else expect(source).toMatchObject({ sessions: 12, events: { travel_publish: null }, status: { events: { travel_publish: 'unavailable' } } })
    expect(JSON.stringify(sources)).not.toMatch(/private-canary|unit-test-token/)
  })

  it.each(['channels', 'sourceSessions', 'sourceEvents'])('cancels stalled %s within the same GA4 deadline without losing completed reports', async (stalledReport) => {
    jest.useFakeTimers()
    getAccessToken.mockResolvedValue({ accessToken: 'unit-test-token' })
    query.mockResolvedValue({ rows: [] })
    readOptionalSecretToken.mockReturnValue(null)
    allRows.mockImplementation(jest.requireActual('@/scripts/fetch-ga4-stats').allRows)
    const signals: AbortSignal[] = []
    runReport.mockImplementation(async (_token: string, _property: string, body: { dimensions: { name: string }[] }, options: { signal: AbortSignal }) => {
      const dimension = body.dimensions[1]?.name
      const name = dimension === 'sessionSource' ? body.dimensions.some((d) => d.name === 'eventName') ? 'sourceEvents' : 'sourceSessions'
        : dimension === 'sessionDefaultChannelGroup' ? 'channels' : dimension === 'eventName' ? 'events' : 'totals'
      if (name === stalledReport) return new Promise((_resolve, reject) => {
        signals.push(options.signal)
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
      })
      const row = dimension === 'eventName' ? gaRow(['202510', 'quest_start'], [7]) : gaRow(['202510'], [100, 150, 0.2])
      return { rows: [row], rowCount: 1, metadata: { timeZone: 'Europe/Warsaw' } }
    })
    fetchMock.mockResolvedValue(page({ results: [], count: 0, next: null }))
    try {
      const pending = collectSources({ window: WINDOW, now: NOW })
      await jest.advanceTimersByTimeAsync(30000)
      const sources = await pending
      expect(signals).toHaveLength(1)
      expect(signals[0].aborted).toBe(true)
      expect(sources.ga4[stalledReport]).toBeNull()
      expect(sources.ga4.totals.complete).toBe(true)
      expect(sources.ga4.events.complete).toBe(true)
      expect(sources.provenance.ga4.status).toBe('partial')
      expect(sources.provenance.ga4.reports[stalledReport].reason).toBe('TIMEOUT')
    } finally { jest.useRealTimers() }
  })

  it('exposes only bounded failure categories rather than upstream bodies', () => {
    expect(safeFailure(new Error('OAuth token=private-secret email=owner@example.invalid'))).toBe('UNAVAILABLE')
    expect(safeFailure({ status: 401, message: 'private-secret' })).toBe('HTTP 401')
    expect(safeFailure({ name: 'AbortError', message: 'private-secret' })).toBe('TIMEOUT')
    expect(safeFailure({ code: 'PAGINATION_LOOP' })).toBe('PAGINATION_LOOP')
  })
})

describe('monthly metrics: shared Google auth cancellation', () => {
  const tokenResolver = jest.requireActual('@/scripts/lib/google-token')
  const originalFetch = global.fetch

  it.each(['oauth', 'service-account'])('propagates cancellation to the %s token HTTP request', async (mode) => {
    const controller = new AbortController()
    const aborted = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchMock = jest.fn((_url: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(aborted), { once: true })
    }))
    global.fetch = fetchMock as typeof fetch
    const exists = jest.spyOn(fs, 'existsSync').mockImplementation((file) => mode === 'oauth' || !String(file).endsWith('google-oauth-token.json'))
    const read = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      installed: { client_id: 'test-id', client_secret: 'test-secret' }, refresh_token: 'test-refresh',
      client_email: 'unit@example.invalid', private_key: 'test-key', token_uri: 'https://oauth2.googleapis.com/token',
    }))
    const sign = jest.spyOn(crypto, 'createSign').mockReturnValue({ update: jest.fn(), sign: () => Buffer.from('test-signature') } as unknown as crypto.Sign)
    try {
      const pending = tokenResolver.getAccessToken('test-readonly', undefined, { signal: controller.signal })
      expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
      controller.abort()
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    } finally {
      exists.mockRestore()
      read.mockRestore()
      sign.mockRestore()
      global.fetch = originalFetch
    }
  })
})


describe('monthly metrics: official store downloads alongside click events', () => {
  const { readStoreReports } = require('@/scripts/lib/store-download-reports')
  let folder: string
  beforeEach(() => {
    const root = path.resolve('.codex-temp/store-summary-tests')
    folder = makeTempDir('report-', { root })
  })
  afterEach(() => { fs.rmSync(folder, { recursive: true, force: true }) })

  it('adds full-month store metrics and exact current periods without altering the existing 12-month window, clicks or YoY', () => {
    const apple = (units: number, from: string, to: string) => [
      'Apple Identifier\tProduct Type Identifier\tUnits\tBegin Date\tEnd Date',
      `6801264369\t1\t${units}\t${from}\t${to}`,
    ].join('\n')
    fs.writeFileSync(path.join(folder, 'september.txt'), apple(12, '09/01/2026', '09/30/2026'))
    fs.writeFileSync(path.join(folder, 'october.txt'), apple(3, '10/19/2026', '10/20/2026'))
    fs.writeFileSync(path.join(folder, 'play.csv'), [
      'Date,Package Name,Country,Daily Device Installs,Daily User Installs',
      '2026-09-30,by.metravel.app,PL,8,6',
    ].join('\n'))
    fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ schemaVersion: 1, reports: [
      { source: 'apple-sales-summary', file: 'september.txt', from: '2026-09-01', to: '2026-09-30', calendar: 'America/Los_Angeles', coverage: 'complete', appId: '6801264369' },
      { source: 'apple-sales-summary', file: 'october.txt', from: '2026-10-19', to: '2026-10-20', calendar: 'America/Los_Angeles', coverage: 'complete', appId: '6801264369' },
      { source: 'google-play-installs', file: 'play.csv', from: '2026-09-01', to: '2026-09-30', calendar: 'America/Los_Angeles', coverage: 'complete', packageName: 'by.metravel.app', dimension: 'country' },
    ] }))
    const sources = { ...emptySources(), ga4: { events: qualified([gaRow(['202609', 'app_download_click'], [42])]) } }
    const baseline = buildSummary(sources, { now: NOW })
    const report = buildSummary({ ...sources, storeDownloads: readStoreReports(folder) }, { now: NOW })
    expect(report.window).toEqual(WINDOW)
    expect(report.months.map((r: any) => r.month)).toEqual(baseline.months.map((r: any) => r.month))
    expect(report.yoy).toEqual(baseline.yoy)
    expect(report.months[11].funnels.app_download_click).toBe(42)
    expect(report.months[11].storeDownloads).toMatchObject({
      apple: { metrics: { firstTimeDownloads: 12, redownloads: 0 }, calendar: 'America/Los_Angeles' },
      googlePlay: { metrics: { deviceInstalls: 8, userInstalls: 6 }, calendar: 'America/Los_Angeles' },
    })
    expect(report.months[10].storeDownloads).toEqual({ apple: null, googlePlay: null })
    expect(report.storeDownloads.periods.find((p: any) => p.from === '2026-10-19')).toMatchObject({
      to: '2026-10-20', status: 'collected', metrics: { firstTimeDownloads: 3, redownloads: 0 },
    })
    const markdown = renderMarkdown(report)
    expect(markdown).toContain('## Скачивания и установки из магазинов')
    expect(markdown).toContain('| 2026-09 | 12 | 0 | 8 | 6 |')
    expect(markdown).toContain('| apple-sales-summary | 2026-10-19 | 2026-10-20 | America/Los_Angeles | complete | collected | 3 | 0 |')
    expect(markdown).toContain('нажатие ссылки на сайте, не скачивание')
  })

  it('renders unknown store metrics and actionable source gaps when optional exports are missing', () => {
    const report = buildSummary({ ...emptySources(), storeDownloads: readStoreReports(path.join(folder, 'missing')) }, { now: NOW })
    expect(report.months[11].storeDownloads).toEqual({ apple: null, googlePlay: null })
    expect(report.storeDownloads.periods).toEqual([])
    expect(report.gaps.join(' ')).toMatch(/apple-sales-summary.*MISSING_REPORT/)
    expect(report.gaps.join(' ')).toMatch(/google-play-installs.*MISSING_REPORT/)
    expect(renderMarkdown(report)).toContain('Отсутствующая выгрузка не равна нулю')
    expect(report.content).toMatchObject({ articles: 0, authors: 0, quests: 0 })
  })
})
