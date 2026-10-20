'use strict'

const SOURCE_EVENTS = ['registration_complete', 'route_create_started', 'travel_publish']
const INSTAGRAM_SOURCES = new Set(['instagram', 'instagram.com', 'l.instagram.com', 'www.instagram.com'])

// Session metrics and event metrics require separate reports. Adding eventName
// to the session report would change its aggregation grain.
function sourceReportRequests(monthly = false) {
  const dimensions = [...(monthly ? ['yearMonth'] : []), 'sessionSource', 'sessionMedium']
  const request = (names, metric) => ({
    dimensions: names.map((name) => ({ name })),
    metrics: [{ name: metric }],
    orderBys: names.map((dimensionName) => ({ dimension: { dimensionName } })),
  })
  return {
    sessions: request(dimensions, 'sessions'),
    events: {
      ...request([...dimensions, 'eventName'], 'eventCount'),
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: SOURCE_EVENTS, caseSensitive: true } } },
    },
  }
}

function reportQuality(report) {
  const metadata = report?.metadata || []
  const status = !report || report.unavailable ? 'unavailable'
    : !report.complete ? 'incomplete'
      : metadata.some((m) => m.subjectToThresholding) ? 'thresholded'
        : metadata.some((m) => m.samplingMetadatas?.length) ? 'sampled'
          : metadata.some((m) => m.dataLossFromOtherRow) ? 'data_loss' : 'collected'
  return { status, complete: report?.complete ?? false, rowCount: report?.rowCount ?? null, metadata,
    ...(report?.reason ? { reason: report.reason } : {}) }
}

function buildSourceBreakdown(reports, month = null) {
  const quality = { sessions: reportQuality(reports?.sessions), events: reportQuality(reports?.events) }
  const rows = new Map()
  const missing = (name) => quality[name].status === 'collected' ? 'not_observed' : quality[name].status
  const newRow = (sessionSource, sessionMedium, placeholder = false) => ({
    sessionSource, sessionMedium,
    channel: INSTAGRAM_SOURCES.has(sessionSource.trim().toLowerCase()) ? 'instagram' : 'other',
    ...(placeholder ? { placeholder: true } : {}),
    sessions: null,
    events: Object.fromEntries(SOURCE_EVENTS.map((event) => [event, null])),
    status: { sessions: missing('sessions'), events: Object.fromEntries(SOURCE_EVENTS.map((event) => [event, missing('events')])) },
  })
  const offset = month ? 1 : 0
  for (const name of ['sessions', 'events']) {
    for (const raw of reports?.[name]?.rows || []) {
      if (month && raw.dimensionValues?.[0]?.value !== month.replace('-', '')) continue
      const source = raw.dimensionValues?.[offset]?.value
      const medium = raw.dimensionValues?.[offset + 1]?.value
      const event = raw.dimensionValues?.[offset + 2]?.value
      if (typeof source !== 'string' || typeof medium !== 'string' || (name === 'events' && !SOURCE_EVENTS.includes(event))) continue
      const key = JSON.stringify([source, medium])
      if (!rows.has(key)) rows.set(key, newRow(source, medium))
      const row = rows.get(key)
      if (quality[name].status !== 'collected') continue
      const value = raw.metricValues?.[0]?.value
      const valid = ['string', 'number'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
      const previous = name === 'sessions' ? row.status.sessions : row.status.events[event]
      const status = previous !== 'not_observed' ? 'duplicate' : valid ? 'observed' : 'invalid'
      if (name === 'sessions') {
        row.sessions = status === 'observed' ? Number(value) : null
        row.status.sessions = status
      } else {
        row.events[event] = status === 'observed' ? Number(value) : null
        row.status.events[event] = status
      }
    }
  }
  // Keep Instagram visible even when neither query returned an observation.
  // This placeholder is not an aggregate of Instagram aliases or mediums.
  if (![...rows.values()].some((row) => row.channel === 'instagram')) rows.set('instagram-placeholder', newRow('instagram', null, true))
  const statuses = Object.values(quality).map((q) => q.status)
  return {
    status: statuses.every((status) => status === 'collected') ? 'collected' : statuses.every((status) => status === 'unavailable') ? 'unavailable' : 'partial',
    rows: [...rows.values()], quality,
    nonAdditive: true,
    eventMetric: 'eventCount',
  }
}

function sourceMetricCell(value, status) {
  return value !== null && value !== undefined ? String(value)
    : status === 'not_observed' ? 'не зафиксировано' : `нет данных (${status || 'unavailable'})`
}

module.exports = { SOURCE_EVENTS, sourceReportRequests, reportQuality, buildSourceBreakdown, sourceMetricCell }
