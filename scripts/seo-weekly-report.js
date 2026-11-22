#!/usr/bin/env node
// Compare two complete Monday–Sunday periods using finalized Search Console data.
const { parseCliArgs, runCli } = require('./lib/cli-contract')
const { getAccessToken } = require('./lib/google-token')
const { query } = require('./fetch-gsc-stats')
const { runReport } = require('./fetch-ga4-stats')
const { queries, questions } = require('./seo-weekly-panel.json')

const DAY = 86400000
const SITE = 'sc-domain:metravel.by'
const PROPERTY = '362328641'
const SOURCES = ['chatgpt.com', 'perplexity.ai']
const CLI_SPEC = {
  name: 'seo-weekly-report',
  usage: 'npm run stats:seo:weekly -- [--week-end YYYY-MM-DD] [--json]',
  selection: 'none', // One report for the fixed property and panel, with no selectable items.
  flags: { 'week-end': { type: 'string', valueName: 'YYYY-MM-DD' }, json: { type: 'boolean' } },
}
const iso = (date) => date.toISOString().slice(0, 10)
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function weeks(end, today = new Date()) {
  // Use the reporting date in California, where GSC assigns search activity.
  const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles' }).format(today)
  const cutoff = new Date(Date.parse(calendar) - 3 * DAY)
  const latest = iso(new Date(cutoff.getTime() - cutoff.getUTCDay() * DAY))
  const date = new Date(end ?? latest)
  if (!Number.isFinite(+date) || (end !== undefined && iso(date) !== end) || date.getUTCDay() !== 0 || iso(date) > latest) {
    throw new Error('Окончание недели должно быть воскресеньем YYYY-MM-DD с учётом задержки GSC в три дня.')
  }
  return [7, 0].map(offset => ({
    startDate: iso(new Date(+date - (offset + 6) * DAY)),
    endDate: iso(new Date(+date - offset * DAY)),
  }))
}

async function fetchWeek(period, gsc, ga4) {
  const [days, fixed, sessions] = await Promise.all([
    gsc({ ...period, dimensions: ['date'], dataState: 'final' }),
    gsc({ ...period, dimensions: ['query'], dataState: 'final', rowLimit: queries.length,
      dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'includingRegex',
        expression: '^(' + queries.map(escapeRegex).join('|') + ')$' }] }],
    }),
    ga4({ dateRanges: [period], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }],
      dimensionFilter: { filter: { fieldName: 'sessionSource', stringFilter: {
        matchType: 'FULL_REGEXP', value: '([a-z0-9-]+\\.)*(' + SOURCES.map(escapeRegex).join('|') + ')', caseSensitive: false,
      } } },
    }),
  ])
  if (days.rows?.length !== 7) throw new Error('GSC: нет семи дней финальных данных за ' + period.endDate)
  const rows = sessions.rows || []
  if (rows.length !== (sessions.rowCount || 0) || sessions.metadata?.dataLossFromOtherRow ||
      sessions.metadata?.samplingMetadatas?.length) throw new Error('GA4: неполный отчёт за ' + period.endDate)
  const thresholding = Boolean(sessions.metadata?.subjectToThresholding)
  const ai = Object.fromEntries(SOURCES.map(host => [host, thresholding ? null : 0]))
  for (const row of rows) {
    const host = row.dimensionValues[0].value.toLowerCase()
    const source = SOURCES.find(domain => host === domain || host.endsWith('.' + domain))
    const count = Number(row.metricValues[0].value)
    if (!source || !Number.isSafeInteger(count) || count < 0) throw new Error('GA4: неожиданная строка источника')
    ai[source] = (ai[source] ?? 0) + count
  }
  const byQuery = new Map((fixed.rows || []).map(row => [row.keys[0], row]))
  return { period, ai, thresholding,
    rows: queries.map(term => {
      const row = byQuery.get(term)
      return { query: term, position: row?.position ?? null, ctr: row ? 100 * row.ctr : null,
        clicks: row?.clicks ?? 0, impressions: row?.impressions ?? 0 }
    }),
  }
}

function format([previous, current]) {
  const range = w => w.period.startDate + ' — ' + w.period.endDate
  const lines = ['# Еженедельный отчёт о поиске', '',
    'Сравнение за ' + range(previous) + ' и ' + range(current) + '. В каждой паре слева предыдущая неделя, справа текущая.', '',
    '## Google Search Console', '', 'Ресурс `' + SITE + '`. Только финальные данные веб-поиска. Прочерк означает, что GSC не вернул строку по запросу. Нули учитывают только показанные GSC данные.', '',
    '| Запрос | Позиция | CTR, % | Клики | Показы |', '|---|---:|---:|---:|---:|']
  const cell = (a, b, digits = 0) => [a, b].map(x => x == null ? '—' : x.toFixed(digits)).join(' → ')
  current.rows.forEach((r, i) => {
    const p = previous.rows[i]
    lines.push('| ' + [r.query, cell(p.position, r.position, 1), cell(p.ctr, r.ctr, 2),
      cell(p.clicks, r.clicks), cell(p.impressions, r.impressions)].join(' | ') + ' |')
  })
  lines.push('', '## Сессии из AI-поиска в GA4', '', 'Ресурс `' + PROPERTY + '`, измерение `sessionSource`, включая поддомены. Периоды по календарю ресурса.', '',
    '| Источник | Сессии | Изменение |', '|---|---:|---:|')
  for (const host of SOURCES) {
    const counts = [previous, current].map(week => {
      const count = week.ai[host]
      if (count === null) return 'нет данных'
      return (week.thresholding ? '≥' : '') + count
    })
    const delta = previous.thresholding || current.thresholding ? null : current.ai[host] - previous.ai[host]
    const change = delta === null ? '—' : (delta > 0 ? '+' : '') + delta
    lines.push('| ' + host + ' | ' + counts.join(' → ') + ' | ' + change + ' |')
  }
  for (const week of [previous, current]) {
    if (week.thresholding) lines.push('', 'GA4 пометил ' + range(week) + ' как период с возможным применением порога конфиденциальности. Показана сумма доступных строк как нижняя граница.')
  }
  lines.push('', '## Проверка ответов Brave Ask', '', '| № | Вопрос | Упоминание в ответе | Домен в источниках | Свидетельство |',
    '|---:|---|---|---|---|')
  questions.forEach((q, i) => lines.push('| ' + (i + 1) + ' | ' + q + ' | не проверено | не проверено | — |'))
  return lines.join('\n')
}

async function main() {
  const values = parseCliArgs(process.argv, CLI_SPEC)
  const periods = weeks(values.weekEnd ?? undefined)
  if (queries.length !== 50 || questions.length !== 10) throw new Error('Ожидается 50 запросов и 10 вопросов')
  const { accessToken } = await getAccessToken([
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly',
  ])
  const result = await Promise.all(periods.map(p => fetchWeek(p,
    body => query(accessToken, SITE, body), body => runReport(accessToken, PROPERTY, body))))
  console.log(values.json ? JSON.stringify({ site: SITE, property: PROPERTY, weeks: result, questions }, null, 2) : format(result))
}

if (require.main === module) runCli(main, CLI_SPEC)
module.exports = { weeks, fetchWeek, format }

