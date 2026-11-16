'use strict'

const { reportQuality } = require('./ga4-source-breakdown')

const PLANNER_SOURCES = ['travel', 'quest', 'assistant', 'navigation', 'direct']
const PLANNER_AUTH_STATES = ['guest', 'authenticated']
const PLANNER_EVENTS = ['trip_planner_impression', 'trip_planner_entry', 'trip_planner_form_view', 'trip_created', 'trip_create_failed', 'route_point_added']
const PLANNER_DIMENSIONS = ['eventName', 'customEvent:event_label', 'customEvent:auth_state', 'customEvent:outcome']
const COUNT_FIELDS = ['impressions', 'entries', 'authRequired', 'formReady', 'created', 'firstSavedPoint', 'failedAttempts']
const OUTCOMES = {
  trip_planner_impression: { visible: 'impressions' },
  trip_planner_entry: { opened: 'entries', auth_required: 'entries' },
  trip_planner_form_view: { ready: 'formReady', auth_required: null },
  trip_created: { success: 'created' },
  trip_create_failed: { error: 'failedAttempts' },
  route_point_added: { first_saved: 'firstSavedPoint', draft: null },
}

function tripPlannerRequest() {
  return {
    dimensions: PLANNER_DIMENSIONS.map((name) => ({ name })),
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: { andGroup: { expressions: [
      { filter: { fieldName: 'customEvent:event_category', stringFilter: { matchType: 'EXACT', value: 'trip_planner' } } },
      { filter: { fieldName: 'eventName', inListFilter: { values: PLANNER_EVENTS, caseSensitive: true } } },
    ] } },
    orderBys: PLANNER_DIMENSIONS.map((dimensionName) => ({ dimension: { dimensionName } })),
  }
}

const newCounts = (value) => Object.fromEntries(COUNT_FIELDS.map((name) => [name, value]))
const impressionCoverage = (source, authState) => source === 'assistant' || (source === 'travel' && authState === 'authenticated') ? 'partial' : 'not_instrumented'
const withRatios = (counts) => ({
  ...counts,
  entryPerImpression: counts.impressions > 0 && counts.entries !== null ? counts.entries / counts.impressions : null,
  // Errors count attempts, including retries; they never become a conversion rate.
  entryRates: Object.fromEntries(['authRequired', 'formReady', 'created', 'firstSavedPoint'].map((name) => [
    name, counts.entries > 0 && counts[name] !== null ? counts[name] / counts.entries : null,
  ])),
})

function buildTripPlannerReport(report, period) {
  let quality = reportQuality(report)
  const parsed = (report?.rows || []).map((raw) => {
    const [event, source, authState, outcome] = PLANNER_DIMENSIONS.map((_, i) => raw.dimensionValues?.[i]?.value)
    const metric = raw.metricValues?.[0]?.value
    const count = typeof metric === 'string' && /^\d+$/.test(metric) ? Number(metric) : NaN
    return { event, source, authState, outcome, count }
  })
  if (quality.status === 'collected' && parsed.some((r) => !Number.isSafeInteger(r.count) || r.count < 0)) {
    quality = { ...quality, status: 'invalid', reason: 'INVALID_EVENT_COUNT' }
  }
  const dimensionKeys = parsed.map(({ event, source, authState, outcome }) => JSON.stringify([event, source, authState, outcome]))
  if (quality.status === 'collected' && new Set(dimensionKeys).size !== dimensionKeys.length) {
    quality = { ...quality, status: 'invalid', reason: 'DUPLICATE_DIMENSION_ROW' }
  }
  const usable = quality.status === 'collected'
  const groups = new Map(PLANNER_SOURCES.flatMap((source) => PLANNER_AUTH_STATES.map((authState) => [
    `${source}:${authState}`, {
      source, authState, ...newCounts(usable ? 0 : null),
      impressionCoverage: impressionCoverage(source, authState),
      impressions: usable && impressionCoverage(source, authState) === 'partial' ? 0 : null,
    },
  ])))
  const unknownRows = []
  let unknownEventCount = usable ? 0 : null
  let excludedEventCount = usable ? 0 : null
  if (usable) {
    for (const row of parsed) {
      const { event, source, authState, outcome, count } = row
      const knownEvent = Object.hasOwn(OUTCOMES, event)
      const reasons = [
        !PLANNER_SOURCES.includes(source) && 'unknown_source',
        !PLANNER_AUTH_STATES.includes(authState) && 'unknown_auth_state',
        !knownEvent && 'unknown_event',
        knownEvent && !Object.hasOwn(OUTCOMES[event], outcome) && 'unknown_outcome',
      ].filter(Boolean)
      if (reasons.length) {
        // Unknown dimensions could contain an accidental private value. Retain the
        // gap and its size without echoing unbounded upstream strings.
        unknownRows.push({
          source: PLANNER_SOURCES.includes(source) ? source : '(unknown)',
          authState: PLANNER_AUTH_STATES.includes(authState) ? authState : '(unknown)',
          event: knownEvent ? event : '(unknown)', reasons, count,
        })
        unknownEventCount += count
        continue
      }
      const field = OUTCOMES[event][outcome]
      if (!field) {
        excludedEventCount += count
        continue
      }
      const group = groups.get(`${source}:${authState}`)
      group[field] = (group[field] ?? 0) + count
      if (event === 'trip_planner_entry' && outcome === 'auth_required') group.authRequired += count
    }
  }
  const rows = [...groups.values()].map((group) => ({
    ...withRatios(group),
    hasObservations: usable && COUNT_FIELDS.some((field) => group[field] > 0),
  }))
  const totals = newCounts(usable ? 0 : null)
  if (usable) for (const row of rows) for (const field of COUNT_FIELDS) totals[field] += row[field]
  // Entry coverage includes navigation/direct paths with no impression emitter.
  // A sitewide impression sum/ratio would imply coverage those paths do not have.
  totals.impressions = null
  return {
    period, quality,
    metric: 'eventCount', denominator: 'trip_planner_entry', authCohort: 'entry',
    rows, totals: { ...withRatios(totals), impressionCoverage: 'partial_sources' }, unknownRows, unknownEventCount, excludedEventCount,
    hasObservations: usable && parsed.length > 0,
    caveats: ['window_event_counts_not_closed_cohort', 'consent_can_change_mid_journey', 'journey_expires_after_30_minutes', 'automation_excluded', 'partial_impression_coverage', 'unknown_rows_excluded_from_attributed_totals'],
  }
}

function formatTripPlannerReport(report) {
  const number = (value) => value === null ? 'нет данных' : String(value)
  const rate = (value) => value === null ? '—' : `${(value * 100).toFixed(1)}%`
  const lines = [
    '\n   Планировщик поездки: события по источнику и состоянию аккаунта при входе.',
    '   Источник | вход | показы / покрытие | переходы / к показам | нужен вход | форма готова | создано | первая точка сохранена | ошибки (попытки)',
  ]
  for (const row of report.rows) lines.push(`   ${row.source} | ${row.authState} | ${number(row.impressions)} / ${row.impressionCoverage} | ${number(row.entries)} / ${rate(row.entryPerImpression)} | ${number(row.authRequired)} (${rate(row.entryRates.authRequired)}) | ${number(row.formReady)} (${rate(row.entryRates.formReady)}) | ${number(row.created)} (${rate(row.entryRates.created)}) | ${number(row.firstSavedPoint)} (${rate(row.entryRates.firstSavedPoint)}) | ${number(row.failedAttempts)}`)
  const t = report.totals
  lines.push(`   Итого (известные источники и состояния): ${number(t.entries)} переходов; ${number(t.formReady)} форм; ${number(t.created)} созданий; ${number(t.firstSavedPoint)} первых точек; ${number(t.failedAttempts)} ошибочных попыток.`)
  lines.push(`   Событий с неизвестной атрибуцией: ${number(report.unknownEventCount)}; исключено черновиков/гостевых показов формы: ${number(report.excludedEventCount)}.`)
  if (!report.hasObservations && report.quality.status === 'collected') lines.push('   Событий за окно не зафиксировано; это не доказывает отсутствие действий.')
  lines.push(`   Качество: ${JSON.stringify(report.quality)}`)
  lines.push('   Показы размечены частично: статья — для вошедших, помощник — видимые кнопки плана. Для quest/navigation/direct и гостевой статьи покрытия нет; null не означает нулевую видимость. Переходы/показы — отдельная диагностическая доля, не замкнутая когортная конверсия.')
  lines.push('   Доли этапов делятся на переходы своей строки. Это отношения событий за окно, не точные конверсии: вход и сохранение могут оказаться по разные стороны границы периода или согласия. Значения выше 100% не обрезаются. Автоматические проверки в счётчики не попадают.')
  lines.push('   Контекст входа действует 30 минут: более поздние результаты могут остаться без атрибуции и не войти в эту воронку.')
  return lines.join('\n')
}

module.exports = { PLANNER_SOURCES, PLANNER_AUTH_STATES, PLANNER_EVENTS, PLANNER_DIMENSIONS, tripPlannerRequest, buildTripPlannerReport, formatTripPlannerReport }
