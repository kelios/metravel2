#!/usr/bin/env node
// Fetch Google Search Console stats for the monthly growth review.
// Usage:
//   node scripts/fetch-gsc-stats.js                 # last 28 days, human summary
//   node scripts/fetch-gsc-stats.js --json          # machine-readable
//   node scripts/fetch-gsc-stats.js --days 90       # custom window
//   node scripts/fetch-gsc-stats.js --site sc-domain:metravel.by
//
// Needs a service-account key (see scripts/lib/google-auth.js) whose email is
// added as a user on the GSC property. Scope: webmasters.readonly.
const { getAccessToken } = require('./lib/google-token')

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

function parseArgs(argv) {
  const args = { json: false, days: 28, site: 'sc-domain:metravel.by' }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = true
    else if (a === '--days') args.days = parseInt(argv[++i], 10)
    else if (a === '--site') args.site = argv[++i]
  }
  return args
}

// GSC data lags ~2-3 days; end the window 3 days back for stable numbers.
function dateRange(days) {
  const end = new Date(Date.now() - 3 * 86400000)
  const start = new Date(end.getTime() - (days - 1) * 86400000)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { startDate: fmt(start), endDate: fmt(end) }
}

async function query(token, site, body) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    site
  )}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GSC query failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function main() {
  const args = parseArgs(process.argv)
  const { startDate, endDate } = dateRange(args.days)
  const { accessToken } = await getAccessToken(SCOPE)

  // Totals for the window.
  const totals = await query(accessToken, args.site, { startDate, endDate, dataState: 'all' })
  const t = (totals.rows && totals.rows[0]) || { clicks: 0, impressions: 0, ctr: 0, position: 0 }

  // Opportunity queries: ranking on the cusp of page 1 (position 4-15) by impressions.
  const byQuery = await query(accessToken, args.site, {
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: 100,
    dataState: 'all',
  })
  const opportunities = (byQuery.rows || [])
    .map((r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: +(r.ctr * 100).toFixed(2),
      position: +r.position.toFixed(1),
    }))
    .filter((r) => r.position >= 4 && r.position <= 15)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20)

  // Top pages by clicks.
  const byPage = await query(accessToken, args.site, {
    startDate,
    endDate,
    dimensions: ['page'],
    rowLimit: 15,
    dataState: 'all',
  })
  const topPages = (byPage.rows || []).map((r) => ({
    page: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: +r.position.toFixed(1),
  }))

  const result = {
    source: 'google-search-console',
    site: args.site,
    period: { startDate, endDate, days: args.days },
    totals: {
      clicks: t.clicks,
      impressions: t.impressions,
      ctr: +(t.ctr * 100).toFixed(2),
      position: +t.position.toFixed(1),
    },
    opportunities,
    topPages,
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }

  console.log(`\n📊 Google Search Console — ${args.site}`)
  console.log(`   Период: ${startDate} … ${endDate} (${args.days} дн.)\n`)
  console.log(`   Клики:    ${result.totals.clicks}`)
  console.log(`   Показы:   ${result.totals.impressions}`)
  console.log(`   CTR:      ${result.totals.ctr}%`)
  console.log(`   Позиция:  ${result.totals.position}`)
  console.log(`\n🎯 Запросы на грани топа (позиция 4-15, по показам) — куда докручивать SEO:`)
  if (!opportunities.length) console.log('   (нет данных)')
  for (const o of opportunities) {
    console.log(
      `   поз ${String(o.position).padStart(4)} | показы ${String(o.impressions).padStart(
        5
      )} | клики ${String(o.clicks).padStart(3)} | CTR ${String(o.ctr).padStart(5)}% | ${o.query}`
    )
  }
  console.log(`\n📄 Топ страниц по кликам:`)
  for (const p of topPages.slice(0, 10)) {
    console.log(`   клики ${String(p.clicks).padStart(3)} | поз ${String(p.position).padStart(4)} | ${p.page}`)
  }
  console.log('')
}

main().catch((err) => {
  console.error('Ошибка:', err.message)
  process.exit(1)
})
