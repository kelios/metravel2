#!/usr/bin/env node
// Fetch Google Analytics 4 stats for the monthly growth review.
// Usage:
//   GA4_PROPERTY_ID=123456789 node scripts/fetch-ga4-stats.js
//   node scripts/fetch-ga4-stats.js --property 123456789 --days 28 --json
//   node scripts/fetch-ga4-stats.js --events --days 30   # воронка: сработавшие события
//   node scripts/fetch-ga4-stats.js --channel-breakdown --days 30 --json
//   node scripts/fetch-ga4-stats.js --channel-breakdown --start-date 2026-10-20 --end-date 2026-10-26
//   node scripts/fetch-ga4-stats.js --quest-search --days 7   # фразы поиска по каталогу квестов (#3183)
//
// Find the numeric property ID in GA4: Admin → Property settings → "Идентификатор ресурса".
// Needs the service-account email added to the GA4 property (Admin → Property Access
// Management → add as Viewer). Enable "Google Analytics Data API" in the GCP project.
// Note: GA4 undercounts metravel traffic (consent banner + adblockers) — treat as secondary.
const { getAccessToken } = require('./lib/google-token')
const { SOURCE_EVENTS, sourceReportRequests, buildSourceBreakdown, sourceMetricCell } = require('./lib/ga4-source-breakdown')

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

// Auto-discover the first GA4 property if none provided (needs Analytics Admin API).
async function discoverPropertyId(token) {
  const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return ''
  const j = await res.json()
  for (const acc of j.accountSummaries || []) {
    for (const p of acc.propertySummaries || []) {
      if (p.property) return p.property.replace('properties/', '')
    }
  }
  return ''
}

function parseArgs(argv) {
  const args = { json: false, days: 28, property: process.env.GA4_PROPERTY_ID || '' }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (['--days', '--property', '--start-date', '--end-date'].includes(a) &&
        (!argv[i + 1] || argv[i + 1].startsWith('--'))) {
      throw new Error(`${a} requires a value`)
    }
    if (a === '--json') args.json = true
    else if (a === '--events') args.events = true
    else if (a === '--channel-breakdown') args.channelBreakdown = true
    else if (a === '--quest-search') args.questSearch = true
    else if (a === '--days') args.days = Number(argv[++i])
    else if (a === '--property') args.property = argv[++i]
    else if (a === '--start-date') args.startDate = argv[++i]
    else if (a === '--end-date') args.endDate = argv[++i]
    else throw new Error(`Unknown argument: ${a}`)
  }
  if (!Number.isInteger(args.days) || args.days < 1) throw new Error('--days must be a positive integer')
  if (args.startDate || args.endDate) {
    if (argv.includes('--days')) throw new Error('--days cannot be combined with explicit dates')
    const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
    if (!validDate(args.startDate) || !validDate(args.endDate) || args.startDate > args.endDate) {
      throw new Error('Provide valid --start-date and --end-date (YYYY-MM-DD), start <= end')
    }
    args.days = Math.round((Date.parse(args.endDate) - Date.parse(args.startDate)) / 86400000) + 1
  }
  if (args.property && !/^\d+$/.test(args.property)) throw new Error('--property must be numeric')
  return args
}

async function runReport(token, propertyId, body, options = {}) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
  const res = await fetch(url, {
    signal: options.signal,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GA4 runReport failed (${res.status}): ${text}`)
  }
  return res.json()
}

// Preserve quality flags from every page; never turn an incomplete response into a KPI pass.
async function allRows(report, body, pageSize = 10000) {
  const rows = []
  const metadata = []
  let rowCount = 0
  do {
    const page = await report({ ...body, limit: pageSize, offset: rows.length })
    metadata.push(page.metadata || {})
    rowCount = Math.max(rowCount, page.rowCount || 0)
    const next = page.rows || []
    rows.push(...next)
    if (!next.length || next.length < pageSize) break
  } while (rows.length < rowCount)
  return { rows, rowCount, complete: rows.length >= rowCount, metadata }
}

function resolvedPeriod(args, timeZone, now = new Date()) {
  if (args.startDate) return { days: args.days, startDate: args.startDate, endDate: args.endDate, timeZone }
  if (!timeZone) return { days: args.days, startDate: `${args.days}daysAgo`, endDate: 'yesterday', timeZone: null }
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const field = (name) => parts.find((p) => p.type === name).value
  const today = Date.parse(`${field('year')}-${field('month')}-${field('day')}T00:00:00Z`)
  const before = (days) => new Date(today - days * 86400000).toISOString().slice(0, 10)
  return { days: args.days, startDate: before(args.days), endDate: before(1), timeZone }
}

const BREAKDOWN_DIMENSIONS = ['sessionSource', 'sessionMedium', 'landingPage', 'deviceCategory', 'platform', 'streamName']
const parseDimensionRows = (response, names) => response.rows.map((r) => ({
  ...Object.fromEntries(names.map((name, index) => [name, r.dimensionValues[index]?.value ?? '(not set)'])),
  sessions: Number(r.metricValues[0]?.value || 0),
  users: Number(r.metricValues[1]?.value || 0),
}))

// Поиск по каталогу квестов (#3183): событие `quest_search` с параметрами
// `search_term` (уже прошёл PII-фильтр `utils/analyticsSearchTerm.ts`) и
// `results_count`. Data API отдаёт их только как зарегистрированные
// event-scoped измерения — регистрация 09.11.2026, не ретроактивна; события
// раньше неё приходят с `(not set)` и считаются отдельно, а не как фраза.
// `(other)` — хвост, свёрнутый GA4 по лимиту кардинальности: тоже не фраза.
const QUEST_SEARCH_EVENT = 'quest_search'
const QUEST_SEARCH_DIMENSIONS = ['customEvent:search_term', 'customEvent:results_count']
const GA4_NOT_SET = '(not set)'
const GA4_OTHER = '(other)'

function buildQuestSearchReport(searchRows) {
  const byTerm = new Map()
  let notSet = 0
  let other = 0
  for (const r of searchRows.rows) {
    const term = r.dimensionValues[0]?.value ?? ''
    const resultsCount = r.dimensionValues[1]?.value ?? ''
    const count = Number(r.metricValues[0]?.value || 0)
    if (!term || term === GA4_NOT_SET) {
      notSet += count
      continue
    }
    if (term === GA4_OTHER) {
      other += count
      continue
    }
    const entry = byTerm.get(term) || { term, searches: 0, zeroResultSearches: 0 }
    entry.searches += count
    if (resultsCount === '0') entry.zeroResultSearches += count
    byTerm.set(term, entry)
  }
  const terms = [...byTerm.values()].sort((a, b) => b.searches - a.searches || a.term.localeCompare(b.term))
  return {
    terms,
    zeroResultTerms: terms.filter((t) => t.zeroResultSearches > 0)
      .sort((a, b) => b.zeroResultSearches - a.zeroResultSearches || a.term.localeCompare(b.term)),
    notSetSearches: notSet,
    otherSearches: other,
    dataLossFromOtherRow: searchRows.metadata.some((m) => m.dataLossFromOtherRow),
    complete: searchRows.complete,
    quality: searchRows.metadata,
  }
}

function formatQuestSearch(report, limit = 30) {
  const lines = [`\n   Поиск по каталогу квестов (${QUEST_SEARCH_EVENT}): ${report.terms.length} фраз`]
  for (const t of report.terms.slice(0, limit)) {
    lines.push(`     ${String(t.searches).padStart(5)} × ${t.term}${t.zeroResultSearches ? ` (без результата: ${t.zeroResultSearches})` : ''}`)
  }
  if (!report.terms.length) lines.push('     (фраз за окно нет)')
  lines.push('   Искали и не нашли (results_count = 0):')
  for (const t of report.zeroResultTerms) lines.push(`     ${String(t.zeroResultSearches).padStart(5)} × ${t.term}`)
  if (!report.zeroResultTerms.length) lines.push('     (нет)')
  if (report.notSetSearches) {
    lines.push(`   ${report.notSetSearches} событий без фразы ((not set)) — до регистрации измерений 09.11.2026 или без параметра`)
  }
  if (report.otherSearches || report.dataLossFromOtherRow) {
    lines.push(`   ⚠️  GA4 свернул часть фраз в (other): ${report.otherSearches} событий — топ и список «не нашли» неполные`)
  }
  if (!report.complete) lines.push('   ⚠️  Ответ неполный (пагинация) — счёт занижен')
  return lines.join('\n')
}

async function collectStats(args, report) {
  let dateRanges = [{ startDate: args.startDate || `${args.days}daysAgo`, endDate: args.endDate || 'yesterday' }]

  // Headline totals.
  const totals = await report({
    dateRanges,
    metrics: [
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
      { name: 'sessions' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
  })
  const row = (totals.rows && totals.rows[0] && totals.rows[0].metricValues) || []
  const num = (i) => (row[i] ? +(+row[i].value).toFixed(2) : 0)
  const period = resolvedPeriod(args, totals.metadata?.timeZone)
  dateRanges = [{ startDate: period.startDate, endDate: period.endDate }]

  // Traffic by channel.
  const byChannel = await allRows(report, {
    dateRanges,
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  })
  const channels = (byChannel.rows || []).map((r) => ({
    channel: r.dimensionValues[0].value,
    users: +r.metricValues[0].value,
    sessions: +r.metricValues[1].value,
  }))

  // Событийная воронка: --events. Берём ВСЕ события за окно, а не ожидаемый список:
  // отсутствие имени в ответе значит только «за окно не зафиксировано». Причину —
  // эмиттера нет в коде, эмиттер шипнут позже начала окна или действие никто не
  // совершал — определяет чтение кода, а не этот отчёт.
  const EVENT_NAME_LIMIT = 200
  let events = null
  let eventsTruncated = false
  if (args.events) {
    const byEvent = await report({
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: EVENT_NAME_LIMIT,
    })
    events = (byEvent.rows || []).map((r) => ({
      event: r.dimensionValues[0].value,
      count: +r.metricValues[0].value,
      users: +r.metricValues[1].value,
    }))
    // Сортировка по убыванию счётчика: при переполнении лимита отрезается хвост из
    // самых редких имён — ровно тех, ради которых режим и сделан. Молчать нельзя.
    eventsTruncated = (byEvent.rowCount || 0) > events.length
    if (eventsTruncated && !args.json) {
      console.log(
        `   ⚠️  Список событий обрезан лимитом ${EVENT_NAME_LIMIT} (всего в ресурсе: ${byEvent.rowCount ?? 'неизвестно'}). Редкие имена могли не попасть в отчёт.`
      )
    }
  }

  let questSearch
  if (args.questSearch) {
    questSearch = buildQuestSearchReport(await allRows(report, {
      dateRanges,
      dimensions: QUEST_SEARCH_DIMENSIONS.map((name) => ({ name })),
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: QUEST_SEARCH_EVENT } } },
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    }))
  }

  let channelBreakdown, sourceBreakdown
  if (args.channelBreakdown) {
    const common = {
      dateRanges,
      dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Unassigned' } } },
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }
    const sources = await allRows(report, { ...common, dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }] })
    const detail = await allRows(report, { ...common, dimensions: BREAKDOWN_DIMENSIONS.map((name) => ({ name })) })
    const sessions = channels.find((c) => c.channel === 'Unassigned')?.sessions || 0
    channelBreakdown = {
      channel: 'Unassigned', sessions,
      sharePct: num(2) > 0 ? +(sessions / num(2) * 100).toFixed(2) : null,
      sources: parseDimensionRows(sources, ['sessionSource', 'sessionMedium']),
      rows: parseDimensionRows(detail, BREAKDOWN_DIMENSIONS),
      // Session/user counts in dimension slices are not additive; use the channel total above.
      nonAdditive: true,
      quality: { sources: { ...sources, rows: undefined }, detail: { ...detail, rows: undefined } },
    }

    const requests = sourceReportRequests()
    const controller = new AbortController()
    let timer
    // Bound only the new diagnostics; the existing totals and Unassigned
    // measurement keep their established request lifecycle.
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(Object.assign(new Error('TIMEOUT'), { name: 'TimeoutError' }))
      }, 30000)
    })
    const collectSource = async (body) => {
      try {
        return await Promise.race([allRows((request) => report(request, { signal: controller.signal }), { dateRanges, ...body }), deadline])
      } catch (error) {
        // Additional diagnostics must neither discard the existing KPI nor leak
        // an upstream response body (which can contain credentials).
        const status = /failed \((\d{3})\)/.exec(String(error?.message || ''))
        const reason = ['AbortError', 'TimeoutError'].includes(error?.name) ? 'TIMEOUT' : status ? `HTTP ${status[1]}` : 'UNAVAILABLE'
        return { unavailable: true, reason }
      }
    }
    try {
      const [sessions, sourceEvents] = await Promise.all([collectSource(requests.sessions), collectSource(requests.events)])
      sourceBreakdown = buildSourceBreakdown({ sessions, events: sourceEvents })
    } finally { clearTimeout(timer) }
  }

  return {
    source: 'google-analytics-4',
    property: args.property,
    period,
    totals: {
      activeUsers: num(0),
      pageViews: num(1),
      sessions: num(2),
      avgSessionSec: num(3),
      bounceRatePct: +(num(4) * 100).toFixed(2),
    },
    channels,
    quality: { totals: totals.metadata || {}, channels: { ...byChannel, rows: undefined } },
    ...(events ? { events, eventsTruncated } : {}),
    ...(questSearch ? { questSearch } : {}),
    ...(channelBreakdown ? { channelBreakdown } : {}),
    ...(sourceBreakdown ? { sourceBreakdown } : {}),
  }
}

function formatBreakdown(breakdown) {
  const lines = [`\n   Unassigned: ${breakdown.sessions} сессий (${breakdown.sharePct ?? 'нет данных'}%)`,
    '   Разрезы неаддитивны: строки нельзя складывать для расчёта доли.',
    '   Источники (отдельная агрегация): sessions | users | source | medium']
  for (const r of breakdown.sources) lines.push(`   ${r.sessions} | ${r.users} | ${r.sessionSource} | ${r.sessionMedium}`)
  lines.push('   Детали: sessions | users | source | medium | landingPage | deviceCategory | platform | streamName')
  for (const r of breakdown.rows) {
    lines.push(`   ${r.sessions} | ${r.users} | ${BREAKDOWN_DIMENSIONS.map((name) => r[name]).join(' | ')}`)
  }
  if (!breakdown.rows.length) lines.push('   (строк Unassigned нет; качество и наличие данных проверять по quality)')
  lines.push(`   Качество разреза: ${JSON.stringify(breakdown.quality)}`)
  return lines.join('\n')
}

function formatSourceBreakdown(breakdown) {
  const lines = ['\n   Источники GA4 / Instagram (sessionSource / sessionMedium):',
    '   Сессии получены отдельным запросом; строки источников/medium не складываются.',
    '   События — eventCount, не уникальные пользователи и не conversion rate.',
    `   source | medium | группа | sessions | ${SOURCE_EVENTS.join(' | ')}`]
  for (const row of breakdown.rows) {
    lines.push(`   ${[row.sessionSource, row.sessionMedium ?? 'не зафиксировано', row.channel,
      sourceMetricCell(row.sessions, row.status.sessions),
      ...SOURCE_EVENTS.map((event) => sourceMetricCell(row.events[event], row.status.events[event]))].join(' | ')}`)
  }
  lines.push(`   Качество источников: ${JSON.stringify(breakdown.quality)}`)
  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv)
  const { accessToken } = await getAccessToken(SCOPE)
  if (!args.property) {
    args.property = await discoverPropertyId(accessToken)
    if (!args.property) throw new Error('GA4 property id not found. Pass --property <id> or set GA4_PROPERTY_ID.')
    if (!args.json) console.log(`(авто-определён GA4 property: ${args.property})`)
  }
  const result = await collectStats(args, (body, options) => runReport(accessToken, args.property, body, options))

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }

  console.log(`\n📈 Google Analytics 4 — property ${args.property}`)
  console.log(`   Период: ${result.period.startDate} — ${result.period.endDate} (${result.period.timeZone || 'часовой пояс не получен'}, ${args.days} полных дн.)\n`)
  console.log(`   Active users:   ${result.totals.activeUsers}`)
  console.log(`   Просмотры:      ${result.totals.pageViews}`)
  console.log(`   Сессии:         ${result.totals.sessions}`)
  console.log(`   Ср. сессия:     ${result.totals.avgSessionSec} с`)
  console.log(`   Bounce rate:    ${result.totals.bounceRatePct}%`)
  console.log(`\n   Каналы (по сессиям):`)
  for (const c of result.channels) {
    console.log(`     ${c.sessions.toString().padStart(5)} сессий | ${c.users} польз. | ${c.channel}`)
  }
  if (result.events) {
    const { events } = result
    console.log(`\n   События за ${args.days} дн. (всего ${events.length} имён):`)
    for (const e of events) {
      console.log(`     ${e.count.toString().padStart(7)} × ${e.event.padEnd(28)} | польз.: ${e.users}`)
    }
    if (!events.length) console.log('     (ни одного события за окно — проверить инициализацию GA4)')
  }
  if (result.questSearch) console.log(formatQuestSearch(result.questSearch))
  if (result.channelBreakdown) console.log(formatBreakdown(result.channelBreakdown))
  if (result.sourceBreakdown) console.log(formatSourceBreakdown(result.sourceBreakdown))
  console.log(`\n   Качество отчёта: ${JSON.stringify(result.quality)}`)
  console.log('\n   ⚠️  GA4 недосчитывает реальный трафик (consent + адблоки). GSC — точнее по organic.\n')
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Ошибка:', err.message)
    process.exitCode = 1
  })
}

module.exports = {
  parseArgs,
  allRows,
  resolvedPeriod,
  collectStats,
  buildQuestSearchReport,
  formatBreakdown,
  formatQuestSearch,
  formatSourceBreakdown,
  runReport,
}
