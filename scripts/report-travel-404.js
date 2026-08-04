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
//   malformed   — склейки и обрезки ссылок (класс #1185), не редирект;
//   id-url      — обращения по числовому id вместо слага;
//   expected    — адреса, которым осознанно оставлен честный 404;
//   noise       — пробы, e2e-фикстуры и negative controls.
//
// Usage:
//   node scripts/report-travel-404.js                  # сутки прод-лога, человекочитаемо
//   node scripts/report-travel-404.js --since 48h
//   node scripts/report-travel-404.js --json           # для агента/крона
//   node scripts/report-travel-404.js --log-file dump.log   # офлайн-разбор снятого лога
//   node scripts/report-travel-404.js --exit-zero      # не сигналить кодом возврата
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
const DEFAULT_CONTAINER = 'metravel_nginx_1'
const DEFAULT_SINCE = '24h'
const MANIFEST_FILE = path.join(__dirname, 'seo-redirects.json')
const KNOWN_FILE = path.join(__dirname, 'seo-404-known.json')

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
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = true
    else if (a === '--exit-zero') args.exitZero = true
    else if (a === '--no-verify') args.verify = false
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

function readProdLog({ container, since }) {
  if (!SAFE_CONTAINER.test(container)) throw new Error(`Недопустимое имя контейнера: ${container}`)
  if (since && !SAFE_SINCE.test(since)) throw new Error(`Недопустимое значение --since: ${since}`)

  // awk фильтрует на стороне сервера: за сутки лог весит десятки мегабайт, и
  // тянуть его целиком ради сотни строк незачем.
  const sinceArg = since ? `--since ${since}` : ''
  const remote = `docker logs ${sinceArg} ${container} 2>/dev/null | awk '
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
  ['stale', '🕒 Сейчас адрес работает: 404 в логе был кратким', false],
  ['malformed', '🧩 Битые и склеенные ссылки (класс #1185)', false],
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
