'use strict'

const { SOURCE_EVENTS, reportQuality, buildSourceBreakdown, sourceMetricCell } = require('./ga4-source-breakdown')

const EVENTS = ['quest_start', 'quest_finish', 'registration_view', 'registration_complete', 'Affiliate_Impression', 'Affiliate_Click', 'app_download_click']
const monthAt = (year, month) => new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7)
const shiftMonth = (month, offset) => monthAt(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + offset)
const monthEnd = (month) => new Date(Date.parse(`${shiftMonth(month, 1)}-01`) - 86400000).toISOString().slice(0, 10)
const runDate = (now) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

function reportingWindow(now = new Date(), endMonth = shiftMonth(runDate(now).slice(0, 7), -1)) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth) || endMonth >= runDate(now).slice(0, 7) || endMonth < '2001-01') {
    throw new Error('Последний месяц должен быть завершённым, в формате YYYY-MM (не ранее 2001-01)')
  }
  return { from: `${shiftMonth(endMonth, -11)}-01`, to: monthEnd(endMonth), comparisonFrom: `${shiftMonth(endMonth, -23)}-01`, comparisonTo: monthEnd(shiftMonth(endMonth, -12)) }
}

function validMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null
  const date = value.slice(0, 10)
  const stamp = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== date || !Number.isFinite(Date.parse(value))) return null
  return date.slice(0, 7)
}

const number = (value) => ['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
const ratio = (part, total) => part !== null && total > 0 ? part / total : null

function authorIds(article) {
  const raw = article.userIds ?? article.user_ids ?? article.user?.id
  const ids = Array.isArray(raw) ? raw : String(raw ?? '').split(',')
  if (!ids.length || ids.some((id) => !/^\d+$/.test(String(id).trim()) || Number(id) < 1)) return []
  return [...new Set(ids.map((id) => String(Number(String(id).trim()))))]
}

function communityStats(travels, months, gaps) {
  const empty = () => Object.fromEntries(months.map((m) => [m, { newAuthors: null, publicationsNotAuthor1: null, dateSource: null }]))
  if (!travels) return { content: { articles: null, author1Share: null, authors: null }, monthly: empty() }
  const articles = travels.filter((t) => t.publication_status === 'published' || ((t.publish === true || t.publish === 1) && (t.moderation === true || t.moderation === 1)))
  const monthly = Object.fromEntries(months.map((m) => [m, { newAuthors: 0, publicationsNotAuthor1: 0, dateSource: null }]))
  const first = new Map()
  const uncertain = new Set()
  const authors = new Set()
  const dateSources = new Set()
  const hasPublicationField = articles.some((article) => Object.hasOwn(article, 'published_at'))
  let ownerArticles = 0, missingAuthor = 0, missingDate = 0, unknownNonOwnerMonth = false
  for (const article of articles) {
    const ids = authorIds(article)
    const month = validMonth(hasPublicationField ? article.published_at : article.created_at)
    const dateSource = hasPublicationField ? 'published_at' : 'created_at_trip_date'
    if (month) dateSources.add(dateSource)
    else missingDate++
    if (!ids.length) { missingAuthor++; continue }
    for (const id of ids) {
      authors.add(id)
      if (!month) uncertain.add(id)
      else if (!first.has(id) || month < first.get(id)) first.set(id, month)
    }
    if (ids.includes('1')) ownerArticles++
    else if (!month) unknownNonOwnerMonth = true
    else if (monthly[month]) monthly[month].publicationsNotAuthor1++
  }
  for (const [id, month] of first) if (!uncertain.has(id) && monthly[month]) monthly[month].newAuthors++
  const source = hasPublicationField ? 'published_at' : 'created_at_trip_date'
  for (const m of Object.values(monthly)) {
    m.dateSource = source
    // Without identity/date the missing article could change any month's count.
    if (missingAuthor || missingDate) m.newAuthors = null
    if (missingAuthor || unknownNonOwnerMonth) m.publicationsNotAuthor1 = null
  }
  if (dateSources.has('created_at_trip_date')) gaps.push('нет даты публикации в travels API для части или всех статей; created_at — по дате поездки, не по дате публикации')
  if (missingDate) gaps.push(`travels: без достоверной даты ${missingDate} статей; месяц первого появления автора не определён, месячные значения с неопределённостью не вычислены`)
  if (missingAuthor) gaps.push(`travels: у ${missingAuthor} статей нет стабильного ID автора; доля автора 1, число авторов и месячные значения не вычислены`)
  return { content: { articles: articles.length, author1Articles: missingAuthor ? null : ownerArticles, author1Share: missingAuthor ? null : ratio(ownerArticles, articles.length), authors: missingAuthor ? null : authors.size, missingAuthor, missingDate }, monthly }
}

function aggregateGsc(source, months, gaps) {
  const result = {}
  for (const month of months) {
    const rows = source?.rows?.filter((r) => validMonth(r.keys?.[0]) === month) || []
    if (!source || `${month}-01` < source.from || monthEnd(month) > source.to || !rows.length) {
      result[month] = null
      continue
    }
    const valid = rows.every((r) => ['clicks', 'impressions', 'position'].every((k) => number(r[k]) !== null))
    if (!valid) { gaps.push(`GSC ${month}: некорректные метрики`); result[month] = null; continue }
    const clicks = rows.reduce((sum, r) => sum + Number(r.clicks), 0)
    const impressions = rows.reduce((sum, r) => sum + Number(r.impressions), 0)
    result[month] = { clicks, impressions, ctr: ratio(clicks, impressions), position: ratio(rows.reduce((sum, r) => sum + Number(r.position) * Number(r.impressions), 0), impressions) }
  }
  if (months.some((m) => !result[m])) gaps.push('GSC: часть месяцев не имеет наблюдений или полного покрытия (в том числе ограничение хранения истории); отсутствующее не равно нулю')
  return result
}

function qualifiedRows(report, label, gaps) {
  if (!report) return []
  if (reportQuality(report).status !== 'collected') {
    gaps.push(`GA4 ${label}: неполная выгрузка, thresholding, sampling или data loss; значения не используются`)
    return []
  }
  return report.rows || []
}

function aggregateGa4(source, months, gaps) {
  const totals = qualifiedRows(source?.totals, 'итоги', gaps)
  const channels = qualifiedRows(source?.channels, 'каналы', gaps)
  const events = qualifiedRows(source?.events, 'события', gaps)
  const byMonth = (rows, month) => rows.filter((r) => r.dimensionValues?.[0]?.value === month.replace('-', ''))
  const values = (row) => (row?.metricValues || []).map((v) => number(v.value))
  const monthly = {}
  for (const month of months) {
    const rows = byMonth(totals, month)
    const nums = values(rows[0])
    let ga4 = rows.length === 1 && nums.length === 3 && nums.every((n) => n !== null) && nums[2] <= 1
      ? { activeUsers: nums[0], sessions: nums[1], bounceRate: nums[2] } : null
    const channelRows = byMonth(channels, month).map((r) => {
      const n = values(r)
      return { channel: r.dimensionValues[1]?.value, activeUsers: n[0] ?? null, sessions: n[1] ?? null }
    })
    if (!ga4 && channelRows.length) ga4 = { activeUsers: null, sessions: null, bounceRate: null }
    if (ga4) ga4.channels = channelRows
    const eventRows = byMonth(events, month)
    const funnels = Object.fromEntries(EVENTS.map((event) => {
      const matches = eventRows.filter((r) => r.dimensionValues[1]?.value === event)
      return [event, matches.length === 1 ? values(matches[0])[0] ?? null : null]
    }))
    const sourceBreakdown = buildSourceBreakdown({ sessions: source?.sourceSessions, events: source?.sourceEvents }, month)
    monthly[month] = { ga4, funnels, sourceBreakdown }
  }
  if (months.some((m) => monthly[m].ga4?.activeUsers == null)) gaps.push('GA4: часть месяцев не имеет подтверждённых месячных итогов; недостающие данные не заменяются нулями')
  if (months.some((m) => EVENTS.some((e) => monthly[m].funnels[e] === null))) gaps.push('GA4: отсутствующая строка события означает «не зафиксировано за месяц», причина (нет действий, измерения или истории) неизвестна; это не число регистраций/уникальных прохождений')
  if (months.some((m) => monthly[m].ga4 && !monthly[m].ga4.channels.length)) gaps.push('GA4: для части месяцев нет достоверного разреза по каналам')
  if (months.some((m) => monthly[m].sourceBreakdown.status !== 'collected')) gaps.push('GA4 источники: часть запросов недоступна, неполна или ограничена thresholding/sampling/data loss; качество сохранено, неподтверждённые значения не используются')
  if (months.some((m) => monthly[m].sourceBreakdown.rows.some((r) => r.sessions === null || SOURCE_EVENTS.some((e) => r.events[e] === null)))) gaps.push('GA4 источники: отсутствующая строка означает «не зафиксировано», а не ноль; события — eventCount, не уникальные пользователи и не conversion rate. Instagram aliases и medium не суммируются')
  return monthly
}

function aggregateMetrika(source, gaps) {
  const response = source?.response
  if (!response) return {}
  if (response.sampled || response.contains_sensitive_data || response.total_rows_rounded) {
    gaps.push('Яндекс.Метрика: выборка или скрытые/округлённые данные; значения не используются')
    return {}
  }
  return Object.fromEntries((response.time_intervals || []).map((interval, index) => {
    const metrics = response.data?.[0]?.metrics || response.totals || []
    const nums = metrics.slice(0, 3).map((r) => number(r[index]))
    return [String(interval[0]).slice(0, 7), nums.length === 3 && nums.every((n) => n !== null) ? { users: nums[0], visits: nums[1], pageViews: nums[2] } : null]
  }))
}

function compare(current, previous, mode = 'percent') {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) return { current, previous, change: null, unit: mode, reason: 'нет сопоставимых данных' }
  if (mode === 'percent' && previous === 0) return { current, previous, change: null, unit: mode, reason: 'нулевая база' }
  return { current, previous, change: mode === 'percent' ? (current - previous) / previous * 100 : mode === 'pp' ? (current - previous) * 100 : current - previous, unit: mode }
}

const YOY_METRICS = { 'gsc.clicks': 'percent', 'gsc.impressions': 'percent', 'gsc.ctr': 'pp', 'gsc.position': 'delta', 'ga4.activeUsers': 'percent', 'ga4.sessions': 'percent', 'ga4.bounceRate': 'pp', 'metrika.users': 'percent', 'metrika.visits': 'percent', 'community.newAuthors': 'percent', 'community.publicationsNotAuthor1': 'percent', ...Object.fromEntries(EVENTS.map((e) => [`funnels.${e}`, 'percent'])) }
const field = (row, key) => key.split('.').reduce((v, k) => v?.[k], row) ?? null

function buildSummary(sources, { now = new Date(), window = reportingWindow(now) } = {}) {
  const gaps = [...(sources.gaps || [])]
  const months = Array.from({ length: 24 }, (_, i) => shiftMonth(window.comparisonFrom.slice(0, 7), i))
  const community = communityStats(sources.travels, months, gaps)
  const gsc = aggregateGsc(sources.gsc, months, gaps)
  const ga4 = aggregateGa4(sources.ga4, months, gaps)
  const metrika = aggregateMetrika(sources.metrika, gaps)
  const history = months.map((month) => ({ month, gsc: gsc[month], ...ga4[month], metrika: metrika[month] || null, community: community.monthly[month] }))
  const current = history.slice(12)
  const completions = sources.quests?.map((q) => number(q.completions_count))
  if (completions?.some((n) => n === null)) gaps.push('quests: часть completions_count отсутствует или некорректна; сумма не вычислена')
  gaps.push('Контент: текущий публичный каталог не содержит удалённые/скрытые статьи и историю модерации; месяцы первых авторов и публикаций являются приближением, не датами регистрации')
  if (sources.metrika && current.some((r) => !r.metrika)) gaps.push('Яндекс.Метрика: часть месяцев не имеет достоверных наблюдений')
  return {
    window, generatedAt: now.toISOString(), runDate: runDate(now),
    sources: sources.provenance || {}, months: current,
    yoy: current.map((row, i) => ({ month: row.month, previousMonth: history[i].month, metrics: Object.fromEntries(Object.entries(YOY_METRICS).map(([key, mode]) => [key, compare(field(row, key), field(history[i], key), mode)])) })),
    content: { ...community.content, quests: sources.quests?.length ?? null, completions: completions && completions.every((n) => n !== null) ? completions.reduce((sum, n) => sum + n, 0) : null },
    gaps: [...new Set(gaps)],
  }
}

const cell = (value) => String(value ?? 'нет данных').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
const fmt = (value, percent = false) => value === null || value === undefined ? 'нет данных' : `${Number((value * (percent ? 100 : 1)).toFixed(2))}${percent ? '%' : ''}`
const table = (headers, rows) => [`| ${headers.map(cell).join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n')

function renderMarkdown(report) {
  const lines = ['# Сводка метрик за 12 месяцев', '', `Дата запуска: ${report.runDate} (Europe/Warsaw). Создано: ${report.generatedAt}.`, `Основное окно: **${report.window.from} — ${report.window.to}**.`, `База год к году: ${report.window.comparisonFrom} — ${report.window.comparisonTo}.`, '', '## Источники и трактовка', '',
    '- GSC: sc-domain:metravel.by, web, final, календарь America/Los_Angeles; CTR = клики / показы, позиция взвешена по показам. История ограничена доступностью источника.',
    `- GA4: property ${cell(report.sources.ga4?.property || '362328641')}; календарь ${cell(report.sources.ga4?.timeZone || 'не получен')}. Месячные пользователи и разрезы каналов неаддитивны; события — срабатывания, не уникальные люди. Consent/adblock могут уменьшать охват.`,
    `- Яндекс.Метрика: stat/v1/data/bytime, счётчик ${cell(report.sources.metrika?.counter || '62803912')}, календарь ${cell(report.sources.metrika?.timeZone || 'часовой пояс счётчика (не получен)')}. Отсутствие доступа отмечается ниже.`,
    '- Контент: https://metravel.by/api/travels/ (publish=1, moderation=1), https://metravel.by/api/quests/; текущий публичный снимок на момент запуска, не исторический размер каталога.', '',
    '## Помесячные показатели', '', table(['Месяц', 'GSC клики', 'Показы', 'CTR', 'Позиция', 'GA4 пользователи', 'Сессии', 'Bounce', 'Метрика пользователи', 'Визиты'], report.months.map((r) => [r.month, fmt(r.gsc?.clicks), fmt(r.gsc?.impressions), fmt(r.gsc?.ctr, true), fmt(r.gsc?.position), fmt(r.ga4?.activeUsers), fmt(r.ga4?.sessions), fmt(r.ga4?.bounceRate, true), fmt(r.metrika?.users), fmt(r.metrika?.visits)])), '',
    '## События GA4', '', table(['Месяц', ...EVENTS], report.months.map((r) => [r.month, ...EVENTS.map((e) => fmt(r.funnels[e]))])), '',
    '## Каналы GA4', '', table(['Месяц', 'Канал', 'Пользователи', 'Сессии'], report.months.flatMap((r) => r.ga4?.channels?.length ? r.ga4.channels.map((c) => [r.month, c.channel, fmt(c.activeUsers), fmt(c.sessions)]) : [[r.month, 'нет данных', 'нет данных', 'нет данных']])), '',
    '## Источники GA4 / Instagram', '',
    'Нативные sessionSource / sessionMedium. Instagram: instagram, instagram.com, l.instagram.com, www.instagram.com; остальные источники показаны отдельно. Исходные source/medium сохранены, aliases и строки не складываются. Сессии запрошены отдельно от eventName; события — eventCount, не уникальные пользователи и не conversion rate. «Не зафиксировано» означает отсутствие строки при доступном качественном отчёте; недоступность или ограничения качества отмечены отдельно.', '',
    table(['Месяц', 'Источник', 'Medium', 'Группа', 'Сессии', ...SOURCE_EVENTS], report.months.flatMap((r) => r.sourceBreakdown.rows.map((s) => [r.month, s.sessionSource, s.sessionMedium ?? 'не зафиксировано', s.channel, sourceMetricCell(s.sessions, s.status.sessions), ...SOURCE_EVENTS.map((e) => sourceMetricCell(s.events[e], s.status.events[e]))]))), '',
    table(['Месяц', 'Качество сессий', 'Качество событий', 'Metadata'], report.months.map((r) => [r.month, r.sourceBreakdown.quality.sessions.status, r.sourceBreakdown.quality.events.status, JSON.stringify(r.sourceBreakdown.quality)])), '',
    '## Контент и сообщество', '',
    `Текущий снимок: статей ${fmt(report.content.articles)}, доля статей с автором 1 ${fmt(report.content.author1Share, true)}, авторов ${fmt(report.content.authors)}, квестов ${fmt(report.content.quests)}, сумма completions_count ${fmt(report.content.completions)}.`,
    'Месячные значения ниже — первые наблюдения среди ныне опубликованных статей. created_at: **по дате поездки, не по дате публикации**. Публикации не автора 1 — статьи, в списке авторов которых нет ID 1. Идентификаторы авторов не выводятся.', '',
    table(['Месяц', 'Новые авторы (приближение)', 'Публикации не автора 1 (приближение)', 'Источник даты'], report.months.map((r) => [r.month, fmt(r.community.newAuthors), fmt(r.community.publicationsNotAuthor1), r.community.dateSource])), '',
    '## Год к году', '', 'Изменения счётчиков — %, CTR/bounce — процентные пункты (п.п.), позиции — абсолютная разница (меньше лучше). При нулевой базе процент роста не вычисляется.', '',
    table(['Месяц', 'Месяц базы', 'Метрика', 'Сейчас', 'Год назад', 'Изменение'], report.yoy.flatMap((r) => Object.entries(r.metrics).map(([key, m]) => [r.month, r.previousMonth, key, fmt(m.current, m.unit === 'pp'), fmt(m.previous, m.unit === 'pp'), m.change === null ? `нет данных: ${m.reason}` : `${fmt(m.change)}${m.unit === 'pp' ? ' п.п.' : m.unit === 'percent' ? '%' : ''}`]))), '',
    '## Ограничения данных', '', ...report.gaps.map((gap) => `- instrumentation gap: ${cell(gap)}`), '',
  ]
  return lines.join('\n')
}

module.exports = { EVENTS, reportingWindow, shiftMonth, monthEnd, validMonth, authorIds, communityStats, aggregateGsc, aggregateGa4, compare, buildSummary, renderMarkdown, runDate }
