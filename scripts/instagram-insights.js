// scripts/instagram-insights.js
// Weekly Instagram statistics of @metravelby via the Meta Graph API — replaces reading
// the owner's browser session for the instagram-editor `review` mode.
//
// Usage:
//   node scripts/instagram-insights.js --auth-url
//   pbpaste | node scripts/instagram-insights.js --exchange-code
//       one-time: open the printed consent URL, approve, copy the address the browser
//       lands on (the site answers 400 there — expected, the code stays unused) and pipe
//       it in; the code becomes a non-expiring Page token in .secrets/instagram-token.json.
//   node scripts/instagram-insights.js --exchange
//       same, starting from a short-lived Graph API Explorer token already saved to
//       .secrets/instagram-token.json. App id/secret come from
//       .secrets/metravel-instagram.env. Nothing secret is printed.
//   node scripts/instagram-insights.js [--since YYYY-MM-DD --until YYYY-MM-DD]
//       statistics for the window (default: previous Monday–Sunday), Markdown summary
//       to stdout, raw data to .cache/instagram/insights-<since>_<until>.json.
//
// Required token permissions: instagram_basic, instagram_manage_insights,
// pages_show_list, pages_read_engagement. A metric Meta refuses is recorded under
// `errors` and printed as «нет данных», never guessed.

const fs = require('fs')
const path = require('path')
const {
  GRAPH,
  GRAPH_VERSION,
  discoverIgAccount,
  gget,
  graphUrl,
  loadAppCredentials,
  loadToken,
  redact,
  saveToken,
} = require('./lib/instagramGraph')

const OUT_DIR = path.join(process.cwd(), '.cache', 'instagram')
const DAY_MS = 86400000
const ACCOUNT_METRICS = ['views', 'reach', 'accounts_engaged', 'total_interactions', 'profile_views', 'website_clicks']
const MEDIA_METRICS = ['views', 'reach', 'saved', 'shares', 'likes', 'comments', 'total_interactions']

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

/** Previous Monday–Sunday relative to `now` (UTC calendar dates). */
function previousWeekWindow(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const sinceMonday = (today.getUTCDay() + 6) % 7
  const thisMonday = new Date(today.getTime() - sinceMonday * DAY_MS)
  return {
    since: isoDate(new Date(thisMonday.getTime() - 7 * DAY_MS)),
    until: isoDate(new Date(thisMonday.getTime() - DAY_MS)),
  }
}

function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2)
}

/** Leader = views at least 2× the median of the week's reels; outsider = fewest views. */
function pickLeaderAndOutsider(reels) {
  const withViews = reels.filter((r) => Number.isFinite(r.views))
  const med = median(withViews.map((r) => r.views))
  if (!withViews.length) return { median: med, leader: null, outsider: null }
  const sorted = [...withViews].sort((a, b) => b.views - a.views)
  const top = sorted[0]
  return {
    median: med,
    leader: med && top.views >= 2 * med ? top : null,
    outsider: sorted.length > 1 ? sorted[sorted.length - 1] : null,
  }
}

function parseArgs(argv) {
  const args = {
    exchange: argv.includes('--exchange'),
    exchangeCode: argv.includes('--exchange-code'),
    authUrl: argv.includes('--auth-url'),
  }
  for (const key of ['since', 'until']) {
    const i = argv.indexOf(`--${key}`)
    if (i >= 0) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(argv[i + 1] || '')) throw new Error(`--${key} expects YYYY-MM-DD`)
      args[key] = argv[i + 1]
    }
  }
  return args
}

const REQUIRED_PERMISSIONS = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  // the Page is owned through Business Manager: without it /me/accounts comes back empty
  'business_management',
]
// Consent is asked for the site's publish grant set too, so re-consent never narrows it.
const AUTH_SCOPES = [...REQUIRED_PERMISSIONS, 'instagram_content_publish']

function buildAuthUrl({ appId, redirectUri }) {
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: AUTH_SCOPES.join(','),
  })}`
}

/** Accepts the redirect address (…/callback/?code=…#_=_), any text containing it, or the bare code. */
function extractCode(input) {
  const text = String(input || '').trim()
  if (!text) throw new Error('Nothing on stdin — copy the redirect address first.')
  const m = text.match(/[?&]code=([^&#\s"'<>]+)/)
  if (m) return decodeURIComponent(m[1])
  if (/\s|^https?:\/\//.test(text)) throw new Error('The text has no ?code= parameter — approve the consent dialog first.')
  return text
}

async function persistPageToken(userToken) {
  const { appId, appSecret } = loadAppCredentials()
  const longLived = await gget(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: userToken,
    })}`
  )
  const perms = await gget(graphUrl('me/permissions', {}, longLived.access_token))
  const granted = (perms.data || []).filter((p) => p.status === 'granted').map((p) => p.permission)
  console.log(`Granted: ${granted.join(', ') || 'none'}`)
  // Keep the user token first: a failed Page lookup stays diagnosable without a new consent.
  saveToken({ access_token: longLived.access_token, token_kind: 'user', obtained_at: new Date().toISOString() })
  const account = await discoverIgAccount(longLived.access_token)
  if (!account.pageToken) throw new Error('Page access token missing — the token needs pages_show_list.')
  saveToken({
    access_token: account.pageToken,
    ig_user_id: account.id,
    token_kind: 'page',
    obtained_at: new Date().toISOString(),
    granted_permissions: granted,
  })
  const missing = REQUIRED_PERMISSIONS.filter((p) => !granted.includes(p))
  console.log(`Saved non-expiring Page token for @${account.username} (ig id ${account.id}).`)
  console.log(missing.length ? `MISSING permissions: ${missing.join(', ')}` : 'All required permissions granted.')
}

async function exchangeCode() {
  const { appId, appSecret, redirectUri } = loadAppCredentials()
  const code = extractCode(fs.readFileSync(0, 'utf8'))
  const j = await gget(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    })}`
  )
  await persistPageToken(j.access_token)
}

async function tryGet(errors, label, url) {
  try {
    return await gget(url)
  } catch (e) {
    if (e.code === 190) throw e
    errors[label] = redact(e.message).slice(0, 200)
    return null
  }
}

function totalValue(entry) {
  return entry && entry.total_value ? entry.total_value.value : null
}

function breakdownShares(entry) {
  const results = entry?.total_value?.breakdowns?.[0]?.results || []
  const total = results.reduce((s, r) => s + (r.value || 0), 0)
  const out = {}
  for (const r of results) out[(r.dimension_values || []).join('/')] = total ? Math.round((1000 * r.value) / total) / 10 : 0
  return out
}

function toWarsawHours(day) {
  if (!day) return null
  const dayStart = Date.parse(day.end_time) - DAY_MS
  const hourOf = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Warsaw' })
  const out = {}
  for (const [h, value] of Object.entries(day.value)) out[Number(hourOf.format(dayStart + Number(h) * 3600000))] = value
  return out
}

async function collect(window) {
  const { token, igUserId: savedId } = loadToken()
  const igId = savedId || (await discoverIgAccount(token)).id
  const errors = {}
  const since = Math.floor(Date.parse(`${window.since}T00:00:00Z`) / 1000)
  const until = Math.floor(Date.parse(`${window.until}T00:00:00Z`) / 1000) + 86400

  const profile = await gget(graphUrl(igId, { fields: 'username,followers_count,media_count' }, token))

  const account = {}
  for (const metric of ACCOUNT_METRICS) {
    const j = await tryGet(
      errors,
      `account.${metric}`,
      graphUrl(`${igId}/insights`, { metric, metric_type: 'total_value', period: 'day', since, until }, token)
    )
    account[metric] = totalValue(j?.data?.[0])
  }
  const breakdowns = {}
  for (const breakdown of ['follow_type', 'media_product_type']) {
    const j = await tryGet(
      errors,
      `views.${breakdown}`,
      graphUrl(
        `${igId}/insights`,
        { metric: 'views', metric_type: 'total_value', period: 'day', breakdown, since, until },
        token
      )
    )
    breakdowns[breakdown] = j ? breakdownShares(j.data?.[0]) : null
  }
  const audience = {}
  for (const breakdown of ['country', 'city']) {
    const j = await tryGet(
      errors,
      `audience.${breakdown}`,
      graphUrl(
        `${igId}/insights`,
        { metric: 'follower_demographics', metric_type: 'total_value', period: 'lifetime', timeframe: 'this_month', breakdown },
        token
      )
    )
    const results = j?.data?.[0]?.total_value?.breakdowns?.[0]?.results || []
    audience[breakdown] = results
      .map((r) => ({ name: (r.dimension_values || []).join('/'), value: r.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }
  // The newest days come back empty, and hour keys count from the Pacific midnight the day
  // starts at — take the latest filled day and re-key it to Europe/Warsaw hours.
  const now = Math.floor(Date.now() / 1000)
  const online = await tryGet(
    errors,
    'audience.online_followers',
    graphUrl(`${igId}/insights`, { metric: 'online_followers', period: 'lifetime', since: now - 6 * 86400, until: now - 86400 }, token)
  )
  audience.online_followers_by_hour = toWarsawHours(
    (online?.data?.[0]?.values || []).filter((v) => Object.keys(v.value || {}).length).at(-1)
  )

  const media = []
  let url = graphUrl(
    `${igId}/media`,
    { fields: 'id,caption,permalink,timestamp,media_type,media_product_type,like_count,comments_count', limit: 50 },
    token
  )
  while (url) {
    const page = await gget(url)
    const items = page.data || []
    for (const m of items) {
      const ts = Date.parse(m.timestamp) / 1000
      if (ts >= since && ts < until) media.push(m)
    }
    const oldest = items.length ? Date.parse(items[items.length - 1].timestamp) / 1000 : 0
    url = oldest >= since && page.paging?.next ? page.paging.next : ''
  }
  for (const m of media) {
    const j = await tryGet(
      errors,
      `media.${m.id}`,
      graphUrl(`${m.id}/insights`, { metric: MEDIA_METRICS.join(',') }, token)
    )
    for (const entry of j?.data || []) m[entry.name] = entry.values?.[0]?.value ?? totalValue(entry)
    if (m.likes == null) m.likes = m.like_count
    if (m.comments == null) m.comments = m.comments_count
  }
  return { window, fetched_at: new Date().toISOString(), profile, account, breakdowns, audience, media, errors }
}

const fmt = (v) => (v == null ? 'нет данных' : typeof v === 'number' ? v.toLocaleString('ru-RU') : String(v))

function renderMarkdown(data) {
  const { window, profile, account, breakdowns, audience, media, errors } = data
  const reels = media.filter((m) => m.media_product_type === 'REELS')
  const { median: med, leader, outsider } = pickLeaderAndOutsider(reels)
  const followerShare = breakdowns.follow_type?.FOLLOWER ?? breakdowns.follow_type?.FOLLOWERS
  const storyShare = breakdowns.media_product_type ? breakdowns.media_product_type.STORY ?? 0 : null
  const title = (m) => (m.caption || '').split('\n')[0].slice(0, 60)
  const lines = [
    `## Instagram @${profile.username}: ${window.since} … ${window.until}`,
    '',
    '| Метрика | Значение |',
    '| --- | --- |',
    `| Просмотры | ${fmt(account.views)} |`,
    `| Охват (зрители) | ${fmt(account.reach)} |`,
    `| Доля подписчиков в просмотрах | ${followerShare == null ? 'нет данных' : `${followerShare}%`} |`,
    `| Взаимодействия | ${fmt(account.total_interactions)} |`,
    `| Вовлечённые аккаунты | ${fmt(account.accounts_engaged)} |`,
    `| Визиты профиля | ${fmt(account.profile_views)} |`,
    `| Клики на внешнюю ссылку | ${fmt(account.website_clicks)} |`,
    `| Доля историй в просмотрах | ${storyShare == null ? 'нет данных' : `${storyShare}%`} |`,
    `| Подписчики | ${fmt(profile.followers_count)} |`,
    `| Медиана ролика | ${fmt(med)} (${reels.length} шт.) |`,
    '',
    '| Дата | Тип | Публикация | Просмотры | Охват | Лайки | Комм. | Сохр. | Репосты |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...media
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(
        (m) =>
          `| ${m.timestamp.slice(0, 10)} | ${m.media_product_type} | [${title(m) || m.id}](${m.permalink}) | ${fmt(m.views)} | ${fmt(m.reach)} | ${fmt(m.likes)} | ${fmt(m.comments)} | ${fmt(m.saved)} | ${fmt(m.shares)} |`
      ),
    '',
    `Лидер (≥2× медианы): ${leader ? `${title(leader)} — ${fmt(leader.views)}` : 'нет'}`,
    `Аутсайдер: ${outsider ? `${title(outsider)} — ${fmt(outsider.views)}` : 'нет'}`,
    '',
    `Топ стран: ${audience.country.map((r) => `${r.name} ${r.value}`).join(', ') || 'нет данных'}`,
    `Топ городов: ${audience.city.map((r) => `${r.name} ${r.value}`).join(', ') || 'нет данных'}`,
  ]
  if (audience.online_followers_by_hour) {
    const hours = Object.entries(audience.online_followers_by_hour).sort((a, b) => b[1] - a[1])
    const list = (items) => items.map(([h, v]) => `${h}:00 — ${v}`).join(', ')
    lines.push(`Пик онлайна подписчиков (час по Варшаве): ${list(hours.slice(0, 4))}`)
    lines.push(`Провал онлайна (час по Варшаве): ${list(hours.slice(-4).reverse())}`)
  }
  if (Object.keys(errors).length) {
    lines.push('', 'Meta не отдала:', ...Object.entries(errors).map(([k, v]) => `- ${k}: ${v}`))
  }
  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.authUrl) return console.log(buildAuthUrl(loadAppCredentials()))
  if (args.exchangeCode) return exchangeCode()
  if (args.exchange) return persistPageToken(loadToken().token)
  const window = args.since && args.until ? { since: args.since, until: args.until } : previousWeekWindow()
  const data = await collect(window)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outPath = path.join(OUT_DIR, `insights-${window.since}_${window.until}.json`)
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
  console.log(renderMarkdown(data))
  console.log(`\nRaw data → ${path.relative(process.cwd(), outPath)}`)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('\nERROR:', redact(e.message))
    process.exitCode = 1
  })
}

module.exports = { buildAuthUrl, toWarsawHours, extractCode, median, parseArgs, pickLeaderAndOutsider, previousWeekWindow, renderMarkdown }
