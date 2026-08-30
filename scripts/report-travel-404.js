#!/usr/bin/env node
// Регулярный отчёт «404 на /travels/* в проде».
//
// Зачем он есть
// -------------
// Мёртвые адреса статей всплывали четырьмя волнами подряд (problem key
// SEO-SSR-001: #1083 → #1186 → #1197 → #1249), и каждый раз их находил человек:
// шёл на прод-хост, тянул JSON access-лог nginx и глазами отделял настоящие
// старые адреса от проб e2e и negative controls. Точечная доливка алиасов
// семейство не закрывает — в #1197 это записано прямо. Скрипт делает ровно тот
// разбор, чтобы следующая волна находилась сама и в тот же день.
//
// Что отчёт разделяет
// -------------------
//   regression  — слаг обещан манифестом редиректов, а прод отдаёт 404
//                 (сломан сам механизм — это важнее любых новых адресов);
//   candidate   — новый мёртвый адрес, которого нет ни в манифесте, ни в
//                 известном шуме: кандидат на ручную сверку по смыслу заголовка;
//   draft       — слаг занят черновиком автора (publish=0): статья не
//                 опубликована, 404 честный и редиректа не требует;
//   malformed   — склейки и обрезки ссылок (класс #1185), не редирект;
//   id-url      — обращения по числовому id вместо слага;
//   expected    — адреса, которым осознанно оставлен честный 404;
//   noise       — пробы, e2e-фикстуры и negative controls.
//
// Почему черновики отдельной корзиной (#1255)
// -------------------------------------------
// Четвёртая волна SEO-SSR-001 — 61 мёртвый адрес — целиком оказалась
// черновиками автора: `where={"publish":0}` со staff-токеном отдаёт ровно эти
// слаги. Анонимно их не видно ни в списке, ни в `by-slug` (404), поэтому по
// одному лишь прод-ответу они неотличимы от потерянных адресов живых статей.
// Список черновиков тянется живьём, а не хранится в файле: автор заводит новые
// черновики постоянно, а статический список ещё и маскировал бы будущую
// регрессию того же слага после публикации.
//
// Usage:
//   node scripts/report-travel-404.js                  # сутки прод-лога, человекочитаемо
//   node scripts/report-travel-404.js --since 48h
//   node scripts/report-travel-404.js --json           # для агента/крона
//   node scripts/report-travel-404.js --log-file dump.log   # офлайн-разбор снятого лога
//   node scripts/report-travel-404.js --exit-zero      # не сигналить кодом возврата
//   node scripts/report-travel-404.js --no-drafts      # не спрашивать API о черновиках
//
// Токен для проверки черновиков: env METRAVEL_TOKEN, иначе .secrets/mcp_token.json,
// иначе ~/.metravel_token. Без токена черновики не проверяются — отчёт об этом
// говорит вслух и оставляет адреса кандидатами (молча прятать их нельзя).
//
// Код возврата 1 = есть находки, требующие человека (regression или candidate).
// Это сигнал для крона; всё остальное — код 0.
//
// Прод читается строго read-only: `docker logs` без записи на хост.
const fs = require('fs')
const path = require('path')
const https = require('https')
const { execFileSync } = require('child_process')

const DEFAULT_ORIGIN = 'https://metravel.by'
// 'auto' = резолвить имя на проде. Compose v2 при пересоздании переименовал
// контейнеры с подчёркиваний на дефисы (metravel_nginx_1 → metravel-nginx-1),
// и захардкоженное имя роняло отчёт с 'No such container'. Явный --container
// по-прежнему проходит проверку SAFE_CONTAINER.
const DEFAULT_CONTAINER = 'auto'
const DEFAULT_SINCE = '24h'
const MANIFEST_FILE = path.join(__dirname, 'seo-redirects.json')
const KNOWN_FILE = path.join(__dirname, 'seo-404-known.json')
const SECRETS_TOKEN_FILE = path.join(__dirname, '..', '.secrets', 'mcp_token.json')
const HOME_TOKEN_FILE = path.join(process.env.HOME || '', '.metravel_token')

// Аргументы контейнера и окна уходят в удалённый shell, поэтому допускаем
// только заведомо безопасный алфавит вместо экранирования.
const SAFE_CONTAINER = /^[A-Za-z0-9_.-]+$/
const SAFE_SINCE = /^[A-Za-z0-9_:+.-]+$/

function parseArgs(argv) {
  const args = {
    since: DEFAULT_SINCE,
    container: DEFAULT_CONTAINER,
    origin: DEFAULT_ORIGIN,
    logFile: '',
    json: false,
    exitZero: false,
    verify: true,
    drafts: true,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = true
    else if (a === '--exit-zero') args.exitZero = true
    else if (a === '--no-verify') args.verify = false
    else if (a === '--no-drafts') args.drafts = false
    else if (a === '--since') args.since = String(argv[++i] || '')
    else if (a === '--container') args.container = String(argv[++i] || '')
    else if (a === '--origin') args.origin = String(argv[++i] || '').replace(/\/+$/, '')
    else if (a === '--log-file') args.logFile = String(argv[++i] || '')
    else if (a === '--all') args.since = ''
  }
  return args
}

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn(`  ⚠️  Не прочитан ${path.basename(filePath)}: ${e.message}`)
    }
    return fallback
  }
}

/**
 * Достаёт слаг из строки запроса nginx: "GET /travels/foo?x=1 HTTP/2.0" → foo.
 * Возвращает null для чужих маршрутов (`/api/travels/…` обслуживает бэкенд и
 * своим 404 не отвечает за SEO-адрес) и для не-GET методов.
 * Флаги `nested`/`undecodable` поднимаются наверх: это уже признак битой ссылки.
 */
function extractTravelSlug(request) {
  const m = /^(GET|HEAD)\s+(\S+)/.exec(String(request || ''))
  if (!m) return null
  const pathname = m[2].split('#')[0].split('?')[0]
  if (!pathname.startsWith('/travels/')) return null

  const rest = pathname.slice('/travels/'.length).replace(/\/+$/, '')
  if (!rest) return null

  const segments = rest.split('/')
  let slug = segments[0]
  let undecodable = false
  try {
    slug = decodeURIComponent(slug)
  } catch {
    undecodable = true
  }
  if (!slug) return null
  return { slug, nested: segments.length > 1, undecodable }
}

/**
 * Склейка двух ссылок подряд: начало слага повторяется дальше по строке.
 * Так выглядел `dvorets-moniushko-…-dvorets-moniushko-…-odn` из #1249.
 * Возвращает первый адрес — именно он в том случае и оказался настоящим
 * мёртвым слагом, ради которого стоило заводить редирект.
 */
function gluedPrefix(slug) {
  const tokens = slug.split('-').filter(Boolean)
  if (tokens.length < 8) return null
  const maxHead = Math.min(6, Math.floor(tokens.length / 2))
  for (let k = maxHead; k >= 3; k--) {
    const head = tokens.slice(0, k).join('-')
    const repeatAt = tokens.slice(k).join('-').indexOf(head)
    if (repeatAt === -1) continue
    // head + '-' + rest: обрезаем по дефису, которым склеены два адреса.
    return slug.slice(0, head.length + repeatAt)
  }
  return null
}

function buildKnownMatchers(known) {
  const patterns = []
  for (const raw of known.noisePatterns || []) {
    try {
      patterns.push(new RegExp(raw))
    } catch (e) {
      console.warn(`  ⚠️  Пропущен битый noisePattern "${raw}": ${e.message}`)
    }
  }
  return {
    noiseSlugs: new Set((known.noiseSlugs || []).map((s) => String(s).toLowerCase())),
    noisePatterns: patterns,
    intentional: new Map((known.intentional404 || []).map((r) => [r.slug, r])),
  }
}

/**
 * Раскладывает мёртвый адрес по корзинам. Порядок проверок — это приоритет
 * сигнала: сломанный редирект важнее того, что адрес заодно похож на склейку.
 */
function classifySlug(entry, ctx) {
  const { slug, nested, undecodable } = entry
  if (ctx.redirectFrom.has(slug)) {
    return { bucket: 'regression', note: `манифест обещает → ${ctx.redirectFrom.get(slug)}` }
  }
  if (/^\d+$/.test(slug)) {
    return { bucket: 'id-url', note: 'обращение по числовому id вместо слага' }
  }
  const lower = slug.toLowerCase()
  if (ctx.known.noiseSlugs.has(lower) || ctx.known.noisePatterns.some((re) => re.test(lower))) {
    return { bucket: 'noise', note: 'проба / e2e-фикстура / negative control' }
  }
  const intentional = ctx.known.intentional.get(slug)
  if (intentional) {
    const ticket = intentional.ticket ? `#${intentional.ticket}: ` : ''
    return { bucket: 'expected', note: `${ticket}${intentional.reason || 'оставлен честный 404'}` }
  }
  if (undecodable) return { bucket: 'malformed', note: 'битое percent-кодирование' }
  if (nested) return { bucket: 'malformed', note: 'лишний сегмент пути' }
  if (/(\.{3}|…)/.test(slug)) return { bucket: 'malformed', note: 'ссылка обрезана многоточием' }
  const glued = gluedPrefix(slug)
  if (glued) {
    const covered = ctx.redirectFrom.has(glued)
    return {
      bucket: 'malformed',
      note: covered
        ? `склейка двух ссылок; первый адрес уже в манифесте → ${ctx.redirectFrom.get(glued)}`
        : `склейка двух ссылок; первый адрес — ${glued} — проверь его отдельно`,
    }
  }
  return { bucket: 'candidate', note: 'нет ни в манифесте, ни в известном шуме' }
}

const DIGEST_PREFIX = { hit: 'HIT\t', total: 'TOTAL\t', first: 'FIRST\t', last: 'LAST\t' }

/**
 * Свод сырого лога к тому же виду, что отдаёт удалённый awk: только строки с
 * 404 по /travels/ плюс границы окна. Локальный и прод-режимы дальше идут
 * одним кодом.
 */
function digestRawLog(raw) {
  const out = []
  let total = 0
  let first = ''
  let last = ''
  for (const line of String(raw).split('\n')) {
    if (!line.trim()) continue
    total++
    if (!first) first = line
    last = line
    if (line.includes('"status":404') && line.includes('GET /travels/')) {
      out.push(DIGEST_PREFIX.hit + line)
    }
  }
  out.push(DIGEST_PREFIX.total + total, DIGEST_PREFIX.first + first, DIGEST_PREFIX.last + last)
  return out.join('\n')
}

function parseTime(line) {
  const m = /"time":"([^"]+)"/.exec(line || '')
  return m ? m[1] : ''
}

function parseDigest(text) {
  const hits = []
  let total = 0
  let first = ''
  let last = ''
  for (const line of String(text).split('\n')) {
    if (line.startsWith(DIGEST_PREFIX.hit)) hits.push(line.slice(DIGEST_PREFIX.hit.length))
    else if (line.startsWith(DIGEST_PREFIX.total)) total = parseInt(line.slice(DIGEST_PREFIX.total.length), 10) || 0
    else if (line.startsWith(DIGEST_PREFIX.first)) first = line.slice(DIGEST_PREFIX.first.length)
    else if (line.startsWith(DIGEST_PREFIX.last)) last = line.slice(DIGEST_PREFIX.last.length)
  }
  return { hits, total, windowFrom: parseTime(first), windowTo: parseTime(last) }
}

/** Часы между границами окна; 0, если время не распознано. */
function windowHours(from, to) {
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return (b - a) / 3600000
}

/** `24h`/`90m`/`2d` → часы. Абсолютные даты не переводим: вернём 0. */
function requestedHours(since) {
  const m = /^(\d+(?:\.\d+)?)([hmd])$/.exec(String(since || ''))
  if (!m) return 0
  const value = parseFloat(m[1])
  return m[2] === 'h' ? value : m[2] === 'm' ? value / 60 : value * 24
}

function buildReport(digestText, ctx) {
  const { hits, total, windowFrom, windowTo } = parseDigest(digestText)
  const byslug = new Map()

  for (const line of hits) {
    const m = /"request":"([^"]*)"/.exec(line)
    const entry = m ? extractTravelSlug(m[1]) : null
    if (!entry) continue
    const seen = byslug.get(entry.slug)
    if (seen) {
      seen.count++
      seen.lastSeen = parseTime(line) || seen.lastSeen
      continue
    }
    const { bucket, note } = classifySlug(entry, ctx)
    byslug.set(entry.slug, {
      slug: entry.slug,
      bucket,
      note,
      count: 1,
      firstSeen: parseTime(line),
      lastSeen: parseTime(line),
    })
  }

  const rows = [...byslug.values()].sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
  const buckets = {}
  for (const row of rows) (buckets[row.bucket] = buckets[row.bucket] || []).push(row)

  const hours = windowHours(windowFrom, windowTo)
  const wanted = requestedHours(ctx.since)
  return {
    window: {
      from: windowFrom,
      to: windowTo,
      hours: Math.round(hours * 10) / 10,
      requestedHours: wanted,
      // docker logs отдаёт только с момента пересоздания контейнера, поэтому
      // короткое окно — не ошибка, но знаменатель у частоты уже другой.
      truncated: wanted > 0 && hours > 0 && hours < wanted * 0.95,
      totalRequests: total,
    },
    total404: rows.reduce((sum, r) => sum + r.count, 0),
    buckets,
    rows,
    needsHuman: (buckets.regression || []).length > 0 || (buckets.candidate || []).length > 0,
  }
}

function probeStatus(url) {
  return new Promise((resolve) => {
    const req = https.request(
      url,
      { method: 'HEAD', timeout: 15000, headers: { 'User-Agent': 'metravel-404-report' } },
      (res) => {
        res.resume()
        resolve(res.statusCode || 0)
      }
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', () => resolve(0))
    req.end()
  })
}

const VERIFIED_BUCKETS = ['regression', 'candidate']

/**
 * Лог показывает прошлое, а вопрос всегда про настоящее, поэтому обе корзины,
 * которые зовут человека, переспрашиваем у живого прода.
 *
 * Без этого шага отчёт врёт в обе стороны: «сломанный редирект» неотличим от
 * ещё не выкаченного, а переименование статьи даёт пачку ложных находок —
 * во время rename её новый адрес секунду отдаёт 404, и обходчик успевает это
 * поймать (поймано на батче #1234: два живых слага пришли как «мёртвые»).
 */
async function verifyLive(report, { origin, probe = probeStatus } = {}) {
  const alive = []
  for (const bucket of VERIFIED_BUCKETS) {
    const rows = report.buckets[bucket] || []
    if (!rows.length) continue

    const stillDead = []
    for (const row of rows) {
      const status = await probe(`${origin}/travels/${encodeURIComponent(row.slug)}`)
      if (status >= 200 && status < 400) {
        alive.push({
          ...row,
          liveStatus: status,
          note:
            bucket === 'regression'
              ? `${row.note}; сейчас отвечает ${status} — запросы были до выката`
              : `сейчас отвечает ${status} — адрес живой, 404 был кратким (выкат или переименование)`,
        })
      } else {
        stillDead.push({
          ...row,
          liveStatus: status,
          note:
            bucket === 'regression'
              ? `${row.note}; прод по-прежнему ${status || 'недоступен'} — редирект не выкачен либо сломан`
              : `${row.note}; прод отвечает ${status || 'недоступен'} и сейчас`,
        })
      }
    }

    if (stillDead.length) report.buckets[bucket] = stillDead
    else delete report.buckets[bucket]
  }

  if (alive.length) report.buckets.stale = [...(report.buckets.stale || []), ...alive]
  const byslug = new Map()
  for (const bucket of [...VERIFIED_BUCKETS, 'stale']) {
    for (const row of report.buckets[bucket] || []) byslug.set(row.slug, row)
  }
  report.rows = report.rows.map((row) => byslug.get(row.slug) || row)
  report.needsHuman = VERIFIED_BUCKETS.some((b) => (report.buckets[b] || []).length > 0)
  report.verified = true
  return report
}

/**
 * Токен для списка черновиков. Порядок тот же, что у seo-edit.js, плюс
 * .secrets/mcp_token.json — там лежит рабочий staff-токен этой машины.
 * Значение никогда не печатается: наружу уходит только источник.
 */
function readToken({ env = process.env, readFile = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  const fromEnv = String(env.METRAVEL_TOKEN || '').trim()
  if (fromEnv) return { token: fromEnv, source: 'env METRAVEL_TOKEN' }
  try {
    const parsed = JSON.parse(readFile(SECRETS_TOKEN_FILE))
    const token = String(parsed.token || '').trim()
    if (token) return { token, source: '.secrets/mcp_token.json' }
  } catch {
    /* нет файла или он не JSON — пробуем следующий источник */
  }
  try {
    const token = String(readFile(HOME_TOKEN_FILE)).trim()
    if (token) return { token, source: '~/.metravel_token' }
  } catch {
    /* источников больше нет */
  }
  return null
}

/** Слаги неопубликованных статей из ответа `/api/travels/?where={"publish":0}`. */
function collectDraftSlugs(payload) {
  const items = (payload && (payload.items || payload.results || payload.data)) || []
  const drafts = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    const slug = item && typeof item.slug === 'string' ? item.slug : ''
    if (slug) drafts.set(slug, { id: item.id })
  }
  return drafts
}

function getJson(url, { token, timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'metravel-404-report', Accept: 'application/json' }
    if (token) headers.Authorization = `Token ${token}`
    const req = https.request(url, { method: 'GET', timeout, headers }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          reject(new Error(`ответ не JSON: ${e.message}`))
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

/**
 * Черновики видны только авторизованному: анонимно список отдаёт лишь
 * publish=1, а `by-slug` для черновика — тот же 404, что и для несуществующего
 * адреса. Поэтому единственный способ отличить одно от другого — спросить API
 * с токеном.
 */
async function fetchDrafts({ origin, token, fetchJson = getJson, perPage = 200, maxPages = 20 } = {}) {
  const drafts = new Map()
  for (let page = 1; page <= maxPages; page++) {
    const query = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      where: JSON.stringify({ publish: 0 }),
    })
    const payload = await fetchJson(`${origin}/api/travels/?${query}`, { token })
    const pageDrafts = collectDraftSlugs(payload)
    for (const [slug, meta] of pageDrafts) drafts.set(slug, meta)
    // Страницу добираем до конца списка: недобрать черновики значит вернуть их
    // в кандидаты и снова звать человека сверять уже разобранное.
    const total = Number(payload && (payload.total || payload.count))
    if (!pageDrafts.size || !Number.isFinite(total) || drafts.size >= total) break
  }
  return drafts
}

/**
 * Переносит кандидатов, чей слаг занят черновиком, в отдельную корзину.
 * Кандидат — единственная корзина, которую это касается: regression должен
 * оставаться громким даже если цель редиректа сейчас черновик.
 */
function annotateDrafts(report, drafts) {
  const candidates = report.buckets.candidate || []
  if (!candidates.length || !drafts || !drafts.size) return report

  const stillCandidates = []
  const asDrafts = []
  for (const row of candidates) {
    const draft = drafts.get(row.slug)
    if (!draft) {
      stillCandidates.push(row)
      continue
    }
    const id = draft.id ? ` (travel id ${draft.id})` : ''
    asDrafts.push({
      ...row,
      note: `черновик автора${id}: publish=0, статья не опубликована — 404 честный, редирект не нужен`,
    })
  }

  if (stillCandidates.length) report.buckets.candidate = stillCandidates
  else delete report.buckets.candidate
  if (asDrafts.length) report.buckets.draft = [...(report.buckets.draft || []), ...asDrafts]

  const byslug = new Map(asDrafts.map((row) => [row.slug, row]))
  report.rows = report.rows.map((row) => byslug.get(row.slug) || row)
  report.needsHuman = (report.buckets.regression || []).length > 0 || (report.buckets.candidate || []).length > 0
  return report
}

/**
 * Полные адреса манифеста, обрывком которых может оказаться этот слаг.
 *
 * Граница строго по дефису отсекает случайные совпадения символов
 * (`tropa-vedm-harze` не считается началом `tropa-vedm-harzer-…`), но сама по
 * себе от ложного срабатывания не спасает: канонический адрес вполне может быть
 * дефисным началом более длинного старого — см. `canonicalTargets` ниже.
 */
function truncationSources(slug, redirectFrom) {
  if (!slug || !redirectFrom) return []
  const prefix = `${slug}-`
  return [...redirectFrom.keys()].filter((from) => from.startsWith(prefix))
}

/**
 * Живые цели манифеста — адреса, на которые редиректят, а не с которых.
 *
 * Ретайтл часто укорачивает слаг, поэтому `to` регулярно оказывается дефисным
 * началом своего же `from`: `vena-za-1-den-i-venskii-les-chto-posmotret` — это
 * цель пары `vena-za-1-den-…-kak-doekhat-legendy-i-skrytye-mesta`, и такая цель
 * в манифесте не одна. Если такая цель однажды сама начнёт отдавать 404
 * (переименовали без алиаса — ровно класс SEO-SSR-001, ради которого отчёт и
 * написан), правило по одной префиксности объявило бы её «обрывком, редирект
 * не нужен» и сняло бы тревогу. Поэтому цели исключаются из правила целиком.
 */
function canonicalTargets(redirectFrom) {
  return new Set(redirectFrom ? [...redirectFrom.values()] : [])
}

/**
 * Переносит из кандидатов адреса, которые на самом деле являются обрывком уже
 * заведённой пары.
 *
 * Обрывок — не потерянный адрес: его никогда не существовало, и 301 на него
 * заводить нельзя (правило #1186). Явную обрезку многоточием ловит
 * `classifySlug`, но обрыв по длине маркера не оставляет — слаг выглядит
 * валидным и уходит в 🆕, где зря зовёт человека (#1257).
 *
 * Ни одного из трёх условий не хватает поодиночке:
 * 1) слаг — дефисный префикс какого-то `from` манифеста;
 * 2) слаг сам НЕ является живой целью манифеста (иначе глушим настоящую
 *    потерю канонического адреса, см. `canonicalTargets`);
 * 3) полный адрес переспрошен у прода и ответил 3xx — значит пара заведена и
 *    работает, а в лог попал обрезанный вариант.
 *
 * Прод не ответил — адрес остаётся кандидатом: молча прятать находки запрещено,
 * иначе контроль слепнет ровно там, где должен звать (тот же принцип, что у
 * корзины черновиков в #1255).
 */
async function annotateTruncated(report, { redirectFrom, origin, probe = probeStatus } = {}) {
  const candidates = report.buckets.candidate || []
  if (!candidates.length || !redirectFrom || !redirectFrom.size) return report

  const targets = canonicalTargets(redirectFrom)
  const stillCandidates = []
  const truncated = []
  for (const row of candidates) {
    if (targets.has(row.slug)) {
      stillCandidates.push(row)
      continue
    }
    let matched = null
    let matchedStatus = 0
    for (const source of truncationSources(row.slug, redirectFrom)) {
      const status = await probe(`${origin}/travels/${encodeURIComponent(source)}`)
      if (status >= 300 && status < 400) {
        matched = source
        matchedStatus = status
        break
      }
    }
    if (!matched) {
      stillCandidates.push(row)
      continue
    }
    truncated.push({
      ...row,
      // Статус — измеренный, цель — обещание манифеста: проба читает только код
      // ответа и Location не разбирает, поэтому выдавать цель за проверенную
      // нельзя.
      note:
        `обрывок ссылки: полный адрес ${matched} живой (${matchedStatus}), манифест ведёт его → ` +
        `${redirectFrom.get(matched)}; этот 404 честный, редирект не нужен`,
    })
  }

  if (stillCandidates.length) report.buckets.candidate = stillCandidates
  else delete report.buckets.candidate
  if (truncated.length) report.buckets.malformed = [...(report.buckets.malformed || []), ...truncated]

  const byslug = new Map(truncated.map((row) => [row.slug, row]))
  report.rows = report.rows.map((row) => byslug.get(row.slug) || row)
  report.needsHuman =
    (report.buckets.regression || []).length > 0 || (report.buckets.candidate || []).length > 0
  return report
}

// Тело резолва имени контейнера берётся из scripts/deploy-target.sh, чтобы
// регулярка `^metravel[-_]<service>[-_]1$` существовала в одном экземпляре:
// раньше её копии разъехались по шести местам и при смене схемы имён ломали
// случайное подмножество инструментов (#1636, борд #733).
let containerResolverSnippetCache = null
function containerResolverSnippet() {
  if (containerResolverSnippetCache === null) {
    containerResolverSnippetCache = execFileSync(
      'bash',
      ['-c', `source "${path.join(__dirname, 'deploy-target.sh')}"; metravel_container_remote_snippet`],
      { encoding: 'utf8' },
    ).trimEnd()
  }
  return containerResolverSnippetCache
}

function readProdLog({ container, since }) {
  if (!SAFE_CONTAINER.test(container)) throw new Error(`Недопустимое имя контейнера: ${container}`)
  if (since && !SAFE_SINCE.test(since)) throw new Error(`Недопустимое значение --since: ${since}`)

  // awk фильтрует на стороне сервера: за сутки лог весит десятки мегабайт, и
  // тянуть его целиком ради сотни строк незачем.
  const sinceArg = since ? `--since ${since}` : ''
  // При 'auto' имя ищется на проде по обоим разделителям — так же, как в
  // scripts/fix-prod.sh.
  //
  // Существование контейнера проверяется ОТДЕЛЬНО и для явного `--container`.
  // Без этой проверки несуществующее имя давало ложное зелёное: `docker logs`
  // пишет 'No such container' в stderr, который здесь уходит в /dev/null,
  // `pipefail` не выставлен, поэтому код возврата берётся от awk и равен нулю →
  // parseDigest отдаёт total=0 → buildReport не поднимает флаг усечения (там
  // нужен hours > 0) → отчёт печатает «мёртвых адресов нет» и выходит с 0.
  // Скрипт кронится через `npm run seo:404`, то есть регрессия была бы тихой.
  // Само `2>/dev/null` снимать нельзя — оно отделяет access-лог на stdout от
  // error-лога, который иначе попадёт в awk как данные.
  const explicitContainer = container === 'auto' ? '' : container
  // Регулярка имени контейнера не дублируется здесь: её тело приезжает из
  // scripts/deploy-target.sh — единственного места, где она живёт (#1636).
  // Резолвер сам печатает диагностику и возвращает ненулевой код, а `|| exit 1`
  // не даёт пустому имени пройти дальше и снова родить ложное зелёное.
  const remote = `set -u
${containerResolverSnippet()}
ctr="$(metravel_resolve_container nginx '${explicitContainer}')" || exit 1
docker logs ${sinceArg} "$ctr" 2>/dev/null | awk '
    NR==1 { first = $0 }
    { last = $0 }
    /"status":404/ { if (index($0, "GET /travels/")) print "HIT\\t" $0 }
    END { print "TOTAL\\t" NR; print "FIRST\\t" first; print "LAST\\t" last }
  '`
  const local = [
    `source "${path.join(__dirname, 'deploy-target.sh')}"`,
    'require_deploy_target >/dev/null',
    'exec ssh -o ConnectTimeout=20 -o BatchMode=yes "$PROD_SSH_TARGET" bash -s',
  ].join('; ')

  return execFileSync('bash', ['-c', local], {
    input: remote,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

const BUCKET_VIEW = [
  ['regression', '🚨 Обещанные редиректы, которые не сработали', true],
  ['candidate', '🆕 Новые мёртвые адреса — нужна ручная сверка', true],
  ['draft', '📝 Слаг занят черновиком автора: 404 — норма (#1255)', false],
  ['stale', '🕒 Сейчас адрес работает: 404 в логе был кратким', false],
  ['malformed', '🧩 Битые, склеенные и обрезанные ссылки (класс #1185)', false],
  ['id-url', '🔢 Обращения по числовому id', false],
  ['expected', '✅ Осознанно оставленный 404', false],
  ['noise', '🤫 Пробы и negative controls', false],
]

function formatReport(report, ctx) {
  const lines = []
  const w = report.window
  lines.push('📊 404 на /travels/* — ' + (ctx.source || 'production'))
  lines.push(
    `   Окно лога: ${w.from || '?'} → ${w.to || '?'}` +
      (w.hours ? ` (${w.hours} ч, записей в логе: ${w.totalRequests.toLocaleString('ru-RU')})` : '')
  )
  if (w.truncated) {
    lines.push(
      `   ⚠️  Окно короче запрошенных ${ctx.since}: контейнер пересоздавался — раньше лога физически нет.`
    )
  }
  lines.push(`   Всего 404 по /travels/*: ${report.total404} (уникальных адресов: ${report.rows.length})`)
  if (report.draftCheck && !report.draftCheck.ok) {
    lines.push(
      `   ⚠️  Черновики не проверены (${report.draftCheck.reason}): часть кандидатов ниже может быть`,
      '       неопубликованными статьями. Токен: env METRAVEL_TOKEN / .secrets/mcp_token.json.'
    )
  }

  for (const [bucket, title, always] of BUCKET_VIEW) {
    const rows = report.buckets[bucket] || []
    if (!rows.length) {
      if (always) lines.push(`\n${title}: нет`)
      continue
    }
    lines.push(`\n${title} — ${rows.length}:`)
    for (const row of rows) {
      lines.push(`   ${String(row.count).padStart(3)} × ${row.slug}`)
      lines.push(`       ${row.note}`)
    }
  }

  if (report.needsHuman) {
    lines.push(
      '\n➡️  Дальше: сверить каждый адрес с живой статьёй ПО СМЫСЛУ ЗАГОЛОВКА (матчинг по токенам',
      '    на этом классе ошибается), подтвердить цель `GET /api/travels/by-slug/<to>/` → 200,',
      '    спорные оставить честным 404 и записать их в scripts/seo-404-known.json с причиной.'
    )
  } else {
    lines.push('\n✅ Новых мёртвых адресов и сломанных редиректов нет.')
  }
  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv)
  const manifest = loadJson(MANIFEST_FILE, { redirects: [] })
  const known = loadJson(KNOWN_FILE, {})
  const ctx = {
    since: args.since,
    source: args.logFile ? path.basename(args.logFile) : 'production',
    redirectFrom: new Map((manifest.redirects || []).map((r) => [r.from, r.to])),
    known: buildKnownMatchers(known),
  }

  let digest
  try {
    digest = args.logFile
      ? digestRawLog(fs.readFileSync(args.logFile, 'utf8'))
      : readProdLog({ container: args.container, since: args.since })
  } catch (e) {
    const detail = (e.stderr && e.stderr.toString().trim()) || e.message
    console.error(`❌ Не удалось получить лог: ${detail}`)
    process.exit(2)
  }

  const report = buildReport(digest, ctx)
  if (args.verify) await verifyLive(report, { origin: args.origin })
  if (args.drafts && (report.buckets.candidate || []).length) {
    const auth = readToken()
    if (!auth) {
      report.draftCheck = { ok: false, reason: 'нет токена' }
    } else {
      try {
        annotateDrafts(report, await fetchDrafts({ origin: args.origin, token: auth.token }))
        report.draftCheck = { ok: true, source: auth.source }
      } catch (e) {
        report.draftCheck = { ok: false, reason: `API не ответил: ${e.message}` }
      }
    }
  }
  // После черновиков: черновик — более точный диагноз, и его слаг существует,
  // поэтому обрывком он быть не может. Живая проба обязательна, так что без
  // --verify шаг пропускается вместе с ней.
  if (args.verify && (report.buckets.candidate || []).length) {
    await annotateTruncated(report, { redirectFrom: ctx.redirectFrom, origin: args.origin })
  }
  if (args.json) {
    console.log(JSON.stringify({ source: ctx.source, since: args.since, ...report }, null, 2))
  } else {
    console.log(formatReport(report, ctx))
  }
  process.exit(!args.exitZero && report.needsHuman ? 1 : 0)
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ ${e.message}`)
    process.exit(2)
  })
}

module.exports = {
  parseArgs,
  verifyLive,
  readToken,
  collectDraftSlugs,
  fetchDrafts,
  annotateDrafts,
  truncationSources,
  canonicalTargets,
  annotateTruncated,
  extractTravelSlug,
  gluedPrefix,
  buildKnownMatchers,
  classifySlug,
  digestRawLog,
  parseDigest,
  buildReport,
  formatReport,
  requestedHours,
  windowHours,
}
