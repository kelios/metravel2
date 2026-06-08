#!/usr/bin/env node
// Fetch Google Analytics 4 stats for the monthly growth review.
// Usage:
//   GA4_PROPERTY_ID=123456789 node scripts/fetch-ga4-stats.js
//   node scripts/fetch-ga4-stats.js --property 123456789 --days 28 --json
//
// Find the numeric property ID in GA4: Admin → Property settings → "Идентификатор ресурса".
// Needs the service-account email added to the GA4 property (Admin → Property Access
// Management → add as Viewer). Enable "Google Analytics Data API" in the GCP project.
// Note: GA4 undercounts metravel traffic (consent banner + adblockers) — treat as secondary.
const { getAccessToken } = require('./lib/google-token')

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
    if (a === '--json') args.json = true
    else if (a === '--days') args.days = parseInt(argv[++i], 10)
    else if (a === '--property') args.property = argv[++i]
  }
  return args
}

async function runReport(token, propertyId, body) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
  const res = await fetch(url, {
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

async function main() {
  const args = parseArgs(process.argv)
  const { accessToken } = await getAccessToken(SCOPE)
  if (!args.property) {
    args.property = await discoverPropertyId(accessToken)
    if (!args.property) {
      throw new Error(
        'GA4 property id not found. Pass --property <id>, set GA4_PROPERTY_ID, ' +
          'or ensure the account has a GA4 property and Analytics Admin API is enabled.'
      )
    }
    if (!args.json) console.log(`(авто-определён GA4 property: ${args.property})`)
  }
  const dateRanges = [{ startDate: `${args.days}daysAgo`, endDate: 'today' }]

  // Headline totals.
  const totals = await runReport(accessToken, args.property, {
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

  // Traffic by channel.
  const byChannel = await runReport(accessToken, args.property, {
    dateRanges,
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  })
  const channels = (byChannel.rows || []).map((r) => ({
    channel: r.dimensionValues[0].value,
    users: +r.metricValues[0].value,
    sessions: +r.metricValues[1].value,
  }))

  const result = {
    source: 'google-analytics-4',
    property: args.property,
    period: { days: args.days },
    totals: {
      activeUsers: num(0),
      pageViews: num(1),
      sessions: num(2),
      avgSessionSec: num(3),
      bounceRatePct: +(num(4) * 100).toFixed(2),
    },
    channels,
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }

  console.log(`\n📈 Google Analytics 4 — property ${args.property}`)
  console.log(`   Период: последние ${args.days} дн.\n`)
  console.log(`   Active users:   ${result.totals.activeUsers}`)
  console.log(`   Просмотры:      ${result.totals.pageViews}`)
  console.log(`   Сессии:         ${result.totals.sessions}`)
  console.log(`   Ср. сессия:     ${result.totals.avgSessionSec} с`)
  console.log(`   Bounce rate:    ${result.totals.bounceRatePct}%`)
  console.log(`\n   Каналы (по сессиям):`)
  for (const c of result.channels) {
    console.log(`     ${c.sessions.toString().padStart(5)} сессий | ${c.users} польз. | ${c.channel}`)
  }
  console.log('\n   ⚠️  GA4 недосчитывает реальный трафик (consent + адблоки). GSC — точнее по organic.\n')
}

main().catch((err) => {
  console.error('Ошибка:', err.message)
  process.exit(1)
})
