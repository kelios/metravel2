'use strict'

const { getAccessToken } = require('./google-token')
const { query } = require('../fetch-gsc-stats')
const { runReport, allRows } = require('../fetch-ga4-stats')
const { readOptionalSecretToken } = require('./yandex-token')
const { EVENTS } = require('./metrics-summary')
const { sourceReportRequests } = require('./ga4-source-breakdown')
const { readStoreReports } = require('./store-download-reports')

const ORIGIN = 'https://metravel.by'
const DEADLINE_MS = 30000
const MAX_PAGES = 100

function failure(code) {
  return Object.assign(new Error(code), { code })
}

// Upstream error bodies may contain credentials or request details. Only allow
// bounded, known diagnostic categories into the durable owner report.
function safeFailure(error) {
  if (error?.status && /^\d{3}$/.test(String(error.status))) return `HTTP ${error.status}`
  const status = /failed \((\d{3})\)/.exec(String(error?.message || ''))
  if (status) return `HTTP ${status[1]}`
  if (['TIMEOUT', 'UNCONFIGURED', 'INVALID_RESPONSE', 'INCOMPLETE', 'PAGINATION_LOOP', 'UNSAFE_NEXT', 'OUTSIDE_RETENTION'].includes(error?.code)) return error.code
  if (['AbortError', 'TimeoutError'].includes(error?.name)) return 'TIMEOUT'
  if (error?.name === 'SyntaxError') return 'INVALID_RESPONSE'
  if (error?.name === 'TypeError') return 'NETWORK_OR_INVALID_RESPONSE'
  return 'UNAVAILABLE'
}

async function bounded(operation, timeoutMs = DEADLINE_MS) {
  const controller = new AbortController()
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(failure('TIMEOUT'))
        }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(url, signal, headers = {}) {
  const response = await fetch(url, { signal, headers, redirect: 'error' })
  if (!response.ok) throw Object.assign(new Error('HTTP failure'), { status: response.status })
  return response.json()
}

function paginationUrl(value, firstUrl) {
  let next
  try { next = new URL(value, firstUrl) } catch { throw failure('UNSAFE_NEXT') }
  if (next.origin !== firstUrl.origin || next.pathname !== firstUrl.pathname || next.username || next.password || next.hash) throw failure('UNSAFE_NEXT')
  // Pagination may change page, never the published-content selection.
  for (const [key, value] of firstUrl.searchParams) {
    if (key !== 'page' && next.searchParams.get(key) !== value) throw failure('UNSAFE_NEXT')
  }
  const page = next.searchParams.get('page')
  if (!/^[1-9]\d*$/.test(page || '')) throw failure('UNSAFE_NEXT')
  next.searchParams.sort()
  return next
}

// Strict completeness is essential: a missing historical article can fabricate
// a new author in a later month. Partial catalogues are invalid as a whole.
async function readCatalog(first, signal) {
  const firstUrl = new URL(first)
  const rows = []
  const ids = new Set()
  const visited = new Set()
  let expectedCount = null
  let url = paginationUrl(firstUrl.href, firstUrl)
  for (let index = 0; index < MAX_PAGES; index++) {
    if (visited.has(url.href)) throw failure('PAGINATION_LOOP')
    visited.add(url.href)
    const response = await fetchJson(url, signal)
    const bare = Array.isArray(response)
    const pageRows = bare ? response : response?.results ?? response?.data
    if (!Array.isArray(pageRows)) throw failure('INVALID_RESPONSE')
    const count = bare ? undefined : response.count ?? response.total
    if (count !== undefined && count !== null) {
      if (!Number.isInteger(count) || count < 0 || (expectedCount !== null && count !== expectedCount)) throw failure('INCOMPLETE')
      expectedCount = count
    }
    for (const row of pageRows) {
      const id = row?.id ?? row?.quest_id
      if (!['number', 'string'].includes(typeof id) || String(id).trim() === '') throw failure('INVALID_RESPONSE')
      if (ids.has(String(id))) throw failure('PAGINATION_LOOP')
      ids.add(String(id))
      rows.push(row)
    }
    if (expectedCount !== null && rows.length > expectedCount) throw failure('INCOMPLETE')
    const hasNext = !bare && ('next' in response || 'next_page_url' in response)
    const next = bare ? null : response.next ?? response.next_page_url
    if (hasNext && next) {
      if (!pageRows.length || (expectedCount !== null && rows.length >= expectedCount)) throw failure('INCOMPLETE')
      url = paginationUrl(next, firstUrl)
      continue
    }
    if (hasNext || (expectedCount !== null && rows.length === expectedCount) || (!pageRows.length && expectedCount === null)) {
      if (expectedCount !== null && rows.length !== expectedCount) throw failure('INCOMPLETE')
      return rows
    }
    if (!pageRows.length) throw failure('INCOMPLETE')
    // Bare-array/legacy API: only an empty page proves the end without metadata.
    // A server may cap page size below the requested 100 records.
    // Count-bearing responses instead continue until their promised total.
    url = new URL(url)
    url.searchParams.set('page', String(Number(url.searchParams.get('page')) + 1))
    url = paginationUrl(url.href, firstUrl)
  }
  throw failure('INCOMPLETE')
}

function gscStart(window, now) {
  // Retention is rolling 16 months. Conservatively discard the oldest partial
  // month, leaving only full months wholly inside that retention window.
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const field = (name) => Number(parts.find((part) => part.type === name).value)
  const cutoff = new Date(Date.UTC(field('year'), field('month') - 1 - 15, 1)).toISOString().slice(0, 10)
  return window.comparisonFrom > cutoff ? window.comparisonFrom : cutoff
}

function gscEnd(window, now) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const field = (name) => Number(parts.find((part) => part.type === name).value)
  const finalized = new Date(Date.UTC(field('year'), field('month') - 1, field('day') - 3)).toISOString().slice(0, 10)
  return window.to < finalized ? window.to : finalized
}

async function collectGa4(window, property, source, provenance) {
  const deadline = Date.now() + DEADLINE_MS
  const accessToken = await source('ga4', async (signal) => {
    const token = await getAccessToken('https://www.googleapis.com/auth/analytics.readonly', undefined, { signal })
    if (signal.aborted) throw failure('TIMEOUT')
    if (!token || typeof token.accessToken !== 'string' || !token.accessToken) throw failure('INVALID_RESPONSE')
    return token.accessToken
  })
  if (!accessToken) return null
  const dateRanges = [{ startDate: window.comparisonFrom, endDate: window.to }]
  const collect = async (signal, dimensions, metrics, extra = {}) => {
    const pageSignatures = new Set()
    let pages = 0
    let expectedRows = null
    const result = await allRows(async (body) => {
      if (++pages > MAX_PAGES) throw failure('INCOMPLETE')
      const response = await runReport(accessToken, property, body, { signal })
      if (!response || typeof response !== 'object' || (response.rows !== undefined && !Array.isArray(response.rows))) throw failure('INVALID_RESPONSE')
      const rows = response.rows || []
      const count = response.rowCount ?? (rows.length ? NaN : 0)
      if (!Number.isInteger(count) || count < 0) throw failure('INVALID_RESPONSE')
      if ((expectedRows !== null && expectedRows !== count) || rows.length + body.offset > count) throw failure('INCOMPLETE')
      expectedRows = count
      const signature = JSON.stringify(rows)
      if (rows.length && pageSignatures.has(signature)) throw failure('PAGINATION_LOOP')
      pageSignatures.add(signature)
      return { ...response, rowCount: count }
    }, {
      dateRanges,
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      orderBys: dimensions.map((dimensionName) => ({ dimension: { dimensionName } })),
      ...extra,
    })
    if (!result.complete) throw failure('INCOMPLETE')
    return result
  }
  const reports = provenance.ga4.reports = {}
  const report = (name, dimensions, metrics, extra) => source(`ga4.${name}`,
    (signal) => collect(signal, dimensions, metrics, extra), reports[name] = {}, Math.max(1, deadline - Date.now()))
  const sourceRequests = sourceReportRequests(true)
  const sourceReport = (name, request) => report(name, request.dimensions.map((d) => d.name), request.metrics.map((m) => m.name), request.dimensionFilter ? { dimensionFilter: request.dimensionFilter } : {})
  const [totals, channels, events, sourceSessions, sourceEvents] = await Promise.all([
    report('totals', ['yearMonth'], ['activeUsers', 'sessions', 'bounceRate']),
    report('channels', ['yearMonth', 'sessionDefaultChannelGroup'], ['activeUsers', 'sessions']),
    report('events', ['yearMonth', 'eventName'], ['eventCount'], {
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS, caseSensitive: true } } },
    }),
    sourceReport('sourceSessions', sourceRequests.sessions),
    sourceReport('sourceEvents', sourceRequests.events),
  ])
  const available = [totals, channels, events, sourceSessions, sourceEvents].filter(Boolean)
  provenance.ga4.status = available.length === 5 ? 'collected' : available.length ? 'partial' : 'unavailable'
  provenance.ga4.timeZone = available.flatMap((result) => result.metadata).find((metadata) => metadata.timeZone)?.timeZone ?? null
  return { totals, channels, events, sourceSessions, sourceEvents }
}

async function collectSources({ window, now = new Date(), property = '362328641', site = 'sc-domain:metravel.by', storeReportsDir }) {
  const gaps = []
  const provenance = {
    collectedAt: now.toISOString(),
    gsc: { site, calendar: 'America/Los_Angeles', dataState: 'final', type: 'web', aggregationType: 'byProperty' },
    ga4: { property, from: window.comparisonFrom, to: window.to, calendar: 'returned property metadata.timeZone', nonAdditiveUsers: true },
    metrika: { counter: process.env.EXPO_PUBLIC_METRIKA_ID || '62803912', from: window.comparisonFrom, to: window.to },
    travels: { endpoint: `${ORIGIN}/api/travels/`, selection: 'publish=1, moderation=1; all history; current snapshot' },
    quests: { endpoint: `${ORIGIN}/api/quests/`, selection: 'public, lang=ru; all history; current snapshot' },
  }
  const source = async (name, operation, metadata = provenance[name], timeoutMs = DEADLINE_MS) => {
    try {
      const result = await bounded(operation, timeoutMs)
      metadata.status = 'collected'
      return result
    } catch (error) {
      const reason = safeFailure(error)
      const explanation = {
        UNCONFIGURED: 'доступ не настроен: токен отсутствует',
        TIMEOUT: 'источник не ответил за отведённое время',
        INCOMPLETE: 'выгрузка неполна или общее число записей изменилось',
        INVALID_RESPONSE: 'источник вернул неподдерживаемый ответ',
        PAGINATION_LOOP: 'страницы или записи повторяются',
        UNSAFE_NEXT: 'адрес следующей страницы нарушает границы источника',
        OUTSIDE_RETENTION: 'окно за пределами доступной истории',
        NETWORK_OR_INVALID_RESPONSE: 'сетевая ошибка или неподдерживаемый ответ',
        UNAVAILABLE: 'нет доступа или источник недоступен',
      }[reason]
      gaps.push(`${name}: ${explanation ? `${explanation} (${reason})` : reason}`)
      metadata.status = 'unavailable'
      metadata.reason = reason
      return null
    }
  }
  const [gsc, ga4, metrika, travels, quests] = await Promise.all([
    source('gsc', async (signal) => {
      const from = gscStart(window, now)
      const to = gscEnd(window, now)
      if (from > to) throw failure('OUTSIDE_RETENTION')
      const { accessToken } = await getAccessToken('https://www.googleapis.com/auth/webmasters.readonly', undefined, { signal })
      if (signal.aborted) throw failure('TIMEOUT')
      const response = await query(accessToken, site, {
        startDate: from, endDate: to, dimensions: ['date'], rowLimit: 25000,
        dataState: 'final', type: 'web', aggregationType: 'byProperty',
      }, { signal })
      if (!response || typeof response !== 'object' || (response.rows !== undefined && !Array.isArray(response.rows))) throw failure('INVALID_RESPONSE')
      provenance.gsc.from = from
      provenance.gsc.to = to
      return { rows: response.rows || [], from, to }
    }),
    collectGa4(window, property, source, provenance),
    source('metrika', async (signal) => {
      const token = readOptionalSecretToken()
      if (!token) throw failure('UNCONFIGURED')
      const params = new URLSearchParams({
        ids: provenance.metrika.counter, metrics: 'ym:s:users,ym:s:visits,ym:s:pageviews',
        date1: window.comparisonFrom, date2: window.to, group: 'month', accuracy: 'full',
      })
      const response = await fetchJson(`https://api-metrika.yandex.net/stat/v1/data/bytime?${params}`, signal, { Authorization: `OAuth ${token}` })
      if (!Array.isArray(response?.time_intervals) || !Array.isArray(response?.data)) throw failure('INVALID_RESPONSE')
      provenance.metrika.timeZone = response.query?.timezone ?? null
      return { response }
    }),
    source('travels', (signal) => {
      const params = new URLSearchParams({ where: JSON.stringify({ publish: 1, moderation: 1 }), page: '1', perPage: '100' })
      return readCatalog(`${ORIGIN}/api/travels/?${params}`, signal)
    }),
    source('quests', (signal) => readCatalog(`${ORIGIN}/api/quests/?lang=ru&page=1&page_size=100`, signal)),
  ])
  const storeDownloads = readStoreReports(storeReportsDir)
  provenance.storeDownloads = storeDownloads.sources
  return { gsc, ga4, metrika, travels, quests, storeDownloads, gaps: [...gaps, ...storeDownloads.gaps].sort(), provenance }
}

module.exports = { collectSources, readCatalog, safeFailure, gscStart, gscEnd, EVENTS }
