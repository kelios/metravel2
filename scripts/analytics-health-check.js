#!/usr/bin/env node
'use strict'

// Read-only analytics and production entry health check.
//
// It answers three questions in one place:
//   1. Did GA4 and GSC both see a traffic drop?
//   2. Does Yandex Metrika, when an OAuth token is configured, agree?
//   3. Do production pages still open for a normal Google referral and Googlebot?
//
// Yandex token is optional. Put it in YANDEX_METRIKA_TOKEN or in one of:
//   .secrets/yandex-metrika-token
//   .secrets/yandex-metrika-token.txt

const fs = require('fs')
const path = require('path')
const { getAccessToken } = require('./lib/google-token')

const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const DEFAULT_SITE = 'sc-domain:metravel.by'
const DEFAULT_METRIKA_ID = process.env.EXPO_PUBLIC_METRIKA_ID || '62803912'
const DEFAULT_URLS = [
  'https://metravel.by/',
  'https://metravel.by/search',
  'https://metravel.by/travels/zakshuvek-biriuzovyi-karer-dlia-kupaniia-v-krakove',
  'https://metravel.by/travels/ozero-glubokoe-samoe-prozrachnoe-ozero-v-belarusi',
  'https://metravel.by/travels/park-grudek-v-iavozhno-polskie-maldivy',
]

function parseArgs(argv) {
  const args = {
    days: 4,
    json: false,
    site: DEFAULT_SITE,
    property: process.env.GA4_PROPERTY_ID || '',
    metrikaId: DEFAULT_METRIKA_ID,
    urls: [],
    failOnProd: false,
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = true
    else if (a === '--days') args.days = parseInt(argv[++i], 10) || args.days
    else if (a === '--site') args.site = argv[++i]
    else if (a === '--property') args.property = argv[++i]
    else if (a === '--metrika-id') args.metrikaId = argv[++i]
    else if (a === '--url') args.urls.push(argv[++i])
    else if (a === '--fail-on-prod') args.failOnProd = true
  }

  if (!args.urls.length) args.urls = DEFAULT_URLS
  if (args.days < 2) args.days = 2
  return args
}

function repoRoot() {
  return path.resolve(__dirname, '..')
}

function ymd(date) {
  return date.toISOString().slice(0, 10)
}

function todayYmd() {
  return ymd(new Date())
}

function dateRange(days) {
  const end = new Date()
  const start = new Date(end.getTime() - (days - 1) * 86400000)
  return { startDate: ymd(start), endDate: ymd(end) }
}

function compactDate(yyyymmdd) {
  return String(yyyymmdd).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
}

function readOptionalSecretToken() {
  if (process.env.YANDEX_METRIKA_TOKEN) return process.env.YANDEX_METRIKA_TOKEN.trim()
  for (const rel of ['.secrets/yandex-metrika-token', '.secrets/yandex-metrika-token.txt']) {
    const p = path.join(repoRoot(), rel)
    try {
      if (fs.existsSync(p)) {
        const token = fs.readFileSync(p, 'utf8').trim()
        if (token) return token
      }
    } catch {
      // ignore
    }
  }
  return ''
}

async function fetchJson(url, options = {}) {
  const timeoutMs = options.timeoutMs || 20000
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`)
    }
    return JSON.parse(text)
  } finally {
    clearTimeout(timeout)
  }
}

async function discoverGa4Property(token) {
  const j = await fetchJson('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
    headers: { Authorization: `Bearer ${token}` },
  })
  for (const acc of j.accountSummaries || []) {
    for (const p of acc.propertySummaries || []) {
      if (p.property) return p.property.replace('properties/', '')
    }
  }
  return ''
}

async function ga4RunReport(token, propertyId, body) {
  return fetchJson(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function pullGa4(args, startDate, endDate) {
  const { accessToken } = await getAccessToken(GA_SCOPE)
  const propertyId = args.property || (await discoverGa4Property(accessToken))
  if (!propertyId) throw new Error('GA4 property id not found')

  const report = await ga4RunReport(accessToken, propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }, { name: 'sessionSourceMedium' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }, { metric: { metricName: 'sessions' }, desc: true }],
    limit: 500,
  })

  const totalsByDate = {}
  const googleByDate = {}
  const rows = (report.rows || []).map((r) => {
    const row = {
      date: compactDate(r.dimensionValues[0].value),
      channel: r.dimensionValues[1].value,
      sourceMedium: r.dimensionValues[2].value,
      activeUsers: Number(r.metricValues[0].value || 0),
      sessions: Number(r.metricValues[1].value || 0),
      pageViews: Number(r.metricValues[2].value || 0),
      eventCount: Number(r.metricValues[3].value || 0),
    }
    addMetrics(totalsByDate, row.date, row)
    if (row.sourceMedium.toLowerCase().startsWith('google /')) addMetrics(googleByDate, row.date, row)
    return row
  })

  return { propertyId, totalsByDate, googleByDate, rows }
}

async function gscQuery(token, site, body) {
  return fetchJson(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

async function pullGsc(args, startDate, endDate) {
  const { accessToken } = await getAccessToken(GSC_SCOPE)
  const daily = await gscQuery(accessToken, args.site, {
    startDate,
    endDate,
    dimensions: ['date'],
    dataState: 'all',
    rowLimit: args.days + 5,
  })
  const pages = await gscQuery(accessToken, args.site, {
    startDate,
    endDate,
    dimensions: ['date', 'page'],
    dataState: 'all',
    rowLimit: 300,
  })

  const dailyRows = (daily.rows || []).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctrPct: +(r.ctr * 100).toFixed(2),
    position: +r.position.toFixed(1),
  }))

  const pageRows = (pages.rows || []).map((r) => ({
    date: r.keys[0],
    page: r.keys[1],
    clicks: r.clicks,
    impressions: r.impressions,
    position: +r.position.toFixed(1),
  }))

  return { dailyRows, pageRows }
}

function addMetrics(target, date, row) {
  target[date] ||= { activeUsers: 0, sessions: 0, pageViews: 0, eventCount: 0 }
  target[date].activeUsers += row.activeUsers || 0
  target[date].sessions += row.sessions || 0
  target[date].pageViews += row.pageViews || 0
  target[date].eventCount += row.eventCount || 0
}

async function pullMetrika(args, startDate, endDate) {
  const token = readOptionalSecretToken()
  if (!token) {
    return {
      configured: false,
      note:
        'Set YANDEX_METRIKA_TOKEN or .secrets/yandex-metrika-token to include Yandex Metrika in this check.',
    }
  }

  const params = new URLSearchParams({
    ids: args.metrikaId,
    metrics: 'ym:s:users,ym:s:visits,ym:s:pageviews',
    date1: startDate,
    date2: endDate,
    group: 'day',
    accuracy: 'full',
  })
  const data = await fetchJson(`https://api-metrika.yandex.net/stat/v1/data/bytime?${params}`, {
    headers: { Authorization: `OAuth ${token}` },
  })

  const intervals = data.time_intervals || []
  const metricRows = data.data && data.data[0] && data.data[0].metrics ? data.data[0].metrics : []
  const rows = intervals.map((interval, index) => ({
    date: Array.isArray(interval) ? interval[0] : String(interval),
    users: Number(metricRows[0] && metricRows[0][index] ? metricRows[0][index] : 0),
    visits: Number(metricRows[1] && metricRows[1][index] ? metricRows[1][index] : 0),
    pageViews: Number(metricRows[2] && metricRows[2][index] ? metricRows[2][index] : 0),
  }))

  return { configured: true, counterId: args.metrikaId, rows }
}

async function probeUrl(url, label, headers, metrikaId) {
  const started = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(url, { redirect: 'follow', headers, signal: controller.signal })
    const text = await res.text()
    const title = normalizeText(matchOne(text, /<title[^>]*>([\s\S]*?)<\/title>/i))
    const canonical =
      matchOne(text, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i) ||
      matchOne(text, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i) ||
      ''
    const robotsMeta = matchOne(text, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i)
    const h1Count = (text.match(/<h1[\s>]/gi) || []).length
    const pCount = (text.match(/<p[\s>]/gi) || []).length
    const hasMetrika = text.includes(String(metrikaId)) && text.includes('mc.yandex.ru/metrika/tag.js')
    const ok =
      res.ok &&
      !/noindex/i.test(robotsMeta || '') &&
      !/noindex/i.test(res.headers.get('x-robots-tag') || '') &&
      text.length > 10000

    return {
      label,
      url,
      finalUrl: res.url,
      status: res.status,
      ok,
      ms: Date.now() - started,
      contentLength: text.length,
      title,
      canonical,
      robotsMeta: robotsMeta || '',
      xRobotsTag: res.headers.get('x-robots-tag') || '',
      h1Count,
      pCount,
      hasMetrika,
    }
  } catch (error) {
    return { label, url, ok: false, error: error.message, ms: Date.now() - started }
  } finally {
    clearTimeout(timeout)
  }
}

function matchOne(text, regex) {
  const m = text.match(regex)
  return m ? m[1] : ''
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

async function probeProduction(urls, metrikaId) {
  const chromeUa =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
  const googlebotUa = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  const out = []
  for (const url of urls) {
    out.push(
      await probeUrl(
        url,
        'chrome-google-referrer',
        {
          'user-agent': chromeUa,
          referer: 'https://www.google.com/',
          'accept-language': 'ru,en;q=0.9',
        },
        metrikaId
      )
    )
    out.push(
      await probeUrl(
        url,
        'googlebot',
        {
          'user-agent': googlebotUa,
          'accept-language': 'en-US,en;q=0.9',
        },
        metrikaId
      )
    )
  }
  return out
}

function summarizeDrop(valuesByDate, metric) {
  const dates = Object.keys(valuesByDate).sort()
  if (dates.length < 2) return null
  const prev = dates[dates.length - 2]
  const latest = dates[dates.length - 1]
  const prevValue = Number(valuesByDate[prev] && valuesByDate[prev][metric] ? valuesByDate[prev][metric] : 0)
  const latestValue = Number(valuesByDate[latest] && valuesByDate[latest][metric] ? valuesByDate[latest][metric] : 0)
  const delta = latestValue - prevValue
  const pct = prevValue > 0 ? +((delta / prevValue) * 100).toFixed(1) : null
  return { prev, latest, prevValue, latestValue, delta, pct }
}

function completeDatesOnly(valuesByDate) {
  const today = todayYmd()
  return Object.fromEntries(Object.entries(valuesByDate).filter(([date]) => date < today))
}

function mapGscByDate(rows) {
  const out = {}
  for (const r of rows) {
    out[r.date] = { clicks: r.clicks, impressions: r.impressions, ctrPct: r.ctrPct, position: r.position }
  }
  return out
}

function buildAlerts(result) {
  const alerts = []
  const gaGoogleDrop = summarizeDrop(completeDatesOnly(result.ga4.googleByDate), 'sessions')
  if (gaGoogleDrop && gaGoogleDrop.prevValue > 0 && gaGoogleDrop.latestValue <= gaGoogleDrop.prevValue * 0.6) {
    alerts.push(
      `GA4 google sessions dropped ${gaGoogleDrop.prevValue} -> ${gaGoogleDrop.latestValue} (${gaGoogleDrop.pct}%)`
    )
  }

  const gscDrop = summarizeDrop(completeDatesOnly(mapGscByDate(result.gsc.dailyRows)), 'clicks')
  if (gscDrop && gscDrop.prevValue > 0 && gscDrop.latestValue <= gscDrop.prevValue * 0.6) {
    alerts.push(`GSC clicks dropped ${gscDrop.prevValue} -> ${gscDrop.latestValue} (${gscDrop.pct}%)`)
  }

  if (result.metrika.configured) {
    const byDate = {}
    for (const row of result.metrika.rows) byDate[row.date] = row
    const metrikaDrop = summarizeDrop(completeDatesOnly(byDate), 'users')
    if (metrikaDrop && metrikaDrop.prevValue > 0 && metrikaDrop.latestValue === 0) {
      alerts.push(`Metrika users dropped ${metrikaDrop.prevValue} -> 0`)
    }
  }

  const failedProbes = result.production.filter((p) => !p.ok)
  if (failedProbes.length) alerts.push(`${failedProbes.length} production Google-entry probes failed`)
  const missingMetrika = result.production.filter((p) => p.ok && !p.hasMetrika)
  if (missingMetrika.length) alerts.push(`${missingMetrika.length} production probes did not find Metrika tag`)

  return alerts
}

function printHuman(result) {
  console.log('\nAnalytics health check')
  console.log(`Generated: ${result.generatedAt}`)
  console.log(`Window: ${result.period.startDate} .. ${result.period.endDate}`)

  console.log('\nGA4 totals by date:')
  for (const [date, row] of Object.entries(result.ga4.totalsByDate).sort()) {
    const google = result.ga4.googleByDate[date] || { sessions: 0, activeUsers: 0, pageViews: 0 }
    console.log(
      `  ${date}: sessions=${row.sessions}, users=${row.activeUsers}, views=${row.pageViews}; google sessions=${google.sessions}, google users=${google.activeUsers}`
    )
  }
  console.log('  Note: the current day is partial.')

  console.log('\nGSC daily:')
  for (const row of result.gsc.dailyRows) {
    console.log(
      `  ${row.date}: clicks=${row.clicks}, impressions=${row.impressions}, ctr=${row.ctrPct}%, position=${row.position}`
    )
  }
  console.log('  Note: GSC newest 2-3 days may be incomplete.')

  console.log('\nYandex Metrika:')
  if (!result.metrika.configured) {
    console.log(`  skipped: ${result.metrika.note}`)
  } else {
    for (const row of result.metrika.rows) {
      console.log(`  ${row.date}: users=${row.users}, visits=${row.visits}, views=${row.pageViews}`)
    }
  }

  console.log('\nProduction Google-entry probes:')
  for (const p of result.production) {
    const status = p.ok ? 'OK' : 'FAIL'
    const metrika = typeof p.hasMetrika === 'boolean' ? ` metrika=${p.hasMetrika ? 'yes' : 'no'}` : ''
    console.log(`  ${status} ${p.label} ${p.status || '-'} ${p.url} (${p.ms}ms)${metrika}`)
    if (!p.ok && p.error) console.log(`    ${p.error}`)
  }

  if (result.alerts.length) {
    console.log('\nAlerts:')
    for (const alert of result.alerts) console.log(`  - ${alert}`)
  } else {
    console.log('\nAlerts: none')
  }
  console.log('')
}

async function main() {
  const args = parseArgs(process.argv)
  const { startDate, endDate } = dateRange(args.days)

  const [ga4, gsc, metrika, production] = await Promise.all([
    pullGa4(args, startDate, endDate),
    pullGsc(args, startDate, endDate),
    pullMetrika(args, startDate, endDate),
    probeProduction(args.urls, args.metrikaId),
  ])

  const result = {
    source: 'metravel-analytics-health',
    generatedAt: new Date().toISOString(),
    period: { startDate, endDate, days: args.days },
    ga4,
    gsc,
    metrika,
    production,
  }
  result.alerts = buildAlerts(result)

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else {
    printHuman(result)
  }

  if (args.failOnProd && production.some((p) => !p.ok)) process.exit(2)
}

main().catch((error) => {
  console.error(`analytics-health-check failed: ${error.message}`)
  process.exit(1)
})
