#!/usr/bin/env node
// Гейт очереди подачи на индексацию: адрес в очереди обязан быть живым (#1390).
//
// Зачем он есть
// -------------
// `scripts/seo-index-queue.json` — очередь адресов, которых Google не знает
// после retitle-волны (#1326). Очередь составлена один раз снимком URL
// Inspection 08.08, а статьи переименовываются и дальше: адрес очереди тихо
// превращается в 301 на новый. Подавать такой адрес бессмысленно — поисковик
// индексирует цель переезда, а запись очереди никогда не отметится
// проиндексированной и вечно тянет долю вниз.
//
// Полная подача 10.08 вскрыла 4 такие записи из 103, и нашёл их человек curl'ом:
// конвейер подачи потребляет выход механизма переименований (семейство
// SEO-SSR-001: #1186 → #1197 → #1249) и никогда его не проверял. Инвариантом
// «адрес в очереди обязан быть живым» не владел никто — теперь им владеет этот
// скрипт.
//
// Контракт
// --------
//   2xx        — адрес живой: подаём и считаем;
//   3xx        — не подаём и не считаем: с `--fix` запись переписывается на цель
//                переезда (старый слаг уходит в `renamedFrom`, дата — в
//                `staleRedirectFixedAt`), без `--fix` — отбраковка с причиной;
//   404/5xx/0  — отбраковка с причиной.
// Любой не-200, оставшийся после прохода, даёт код возврата 1: молча считать
// такую запись «ещё не проиндексированной» и есть тот самый дефект.
//
// Проверка читает только статус и `Location`: запрос идёт методом HEAD, тело
// страницы не тянется.
//
// Usage:
//   node scripts/seo-index-queue-check.js                 # весь список, отчёт
//   node scripts/seo-index-queue-check.js --fix           # переписать протухшие 301
//   node scripts/seo-index-queue-check.js --batch 11 --out batch.txt
//   node scripts/seo-index-queue-check.js --json
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

const {
  ExpectedFailureError,
  UsageError,
  parseCliArgs,
  requireNonEmptySelection,
  runSeoCli,
} = require('./lib/seo-cli-contract')

const QUEUE_FILE = path.join(__dirname, 'seo-index-queue.json')
const MAX_REDIRECT_HOPS = 5
const PROBE_TIMEOUT_MS = 15000
const USER_AGENT = 'metravel-index-queue-check'
const CLI_NAME = 'seo-index-queue'

const USAGE = `Live-status gate for the indexing queue — scripts/seo-index-queue.json

Usage:
  node scripts/seo-index-queue-check.js [options]

Options:
  --fix                 rewrite stale 3xx entries onto their redirect target
  --batch <n>           check only batch n and emit its URLs on stdout
  --out <path>          write the emitted URL list to a file (needs --batch)
  --limit <n>           check only the first n URLs (smoke)
  --queue <path>        another queue file (default scripts/seo-index-queue.json)
  --json                machine-readable output
  --help, -h            print this help and exit

Exit codes: 0 — every checked URL is live; 1 — a non-200 remains; 2 — bad invocation.

Examples:
  node scripts/seo-index-queue-check.js
  node scripts/seo-index-queue-check.js --fix
  node scripts/seo-index-queue-check.js --batch 11 --out batch.txt && \\
    node scripts/indexnow-submit.js --urls-file batch.txt`

const CLI_SPEC = {
  name: CLI_NAME,
  usage: USAGE,
  flags: {
    fix: { type: 'boolean' },
    json: { type: 'boolean' },
    batch: { type: 'int', min: 1, valueName: 'a batch number ≥ 1' },
    out: { type: 'string', valueName: 'a path' },
    limit: { type: 'int', min: 1, valueName: 'a positive integer' },
    queue: { type: 'string', key: 'queueFile', valueName: 'a path', default: QUEUE_FILE },
  },
}

/**
 * Разбор идёт через общий контракт SEO-CLI (#1391): незнакомый или опечатанный
 * флаг обязан остановить запуск, а не тихо превратиться в проход по всей
 * очереди. Здесь остаются только правила, которых нет в спеке — связки между
 * флагами.
 */
function parseArgs(argv) {
  // `--help` сюда не доходит: контракт бросает `HelpRequested`, а `runSeoCli`
  // печатает справку и выходит нулём.
  const args = parseCliArgs(argv, CLI_SPEC)

  // Список адресов выдаётся только для одной пачки: файл на всю очередь — это и
  // есть та самая «подача всего сайта разом», от которой закрывались в #1389.
  if (args.out && args.batch === null) {
    throw new UsageError('--out requires --batch <n> — a whole-queue URL file is a site-wide submit')
  }
  if (args.batch !== null && args.limit !== null) {
    throw new UsageError('--batch and --limit pick different URL sets — choose one')
  }
  return args
}

/** Все адреса очереди: пачки — источник порядка подачи, details — тот же набор. */
function collectQueueUrls(queue) {
  const urls = []
  const seen = new Set()
  const push = (url) => {
    if (typeof url !== 'string' || !url || seen.has(url)) return
    seen.add(url)
    urls.push(url)
  }
  for (const batch of (queue && queue.batches) || []) for (const url of batch.urls || []) push(url)
  for (const detail of (queue && queue.details) || []) push(detail && detail.url)
  return urls
}

/** Статус и `Location` одним HEAD: тело страницы для этого решения не нужно. */
function probeStatus(url, { timeout = PROBE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let mod
    try {
      mod = new URL(url).protocol === 'http:' ? http : https
    } catch {
      return resolve({ status: 0, location: '', error: 'битый URL' })
    }
    const req = mod.request(
      url,
      { method: 'HEAD', timeout, headers: { 'User-Agent': USER_AGENT } },
      (res) => {
        res.resume()
        resolve({ status: res.statusCode || 0, location: res.headers.location || '' })
      }
    )
    req.on('timeout', () => req.destroy(new Error('таймаут')))
    req.on('error', (e) => resolve({ status: 0, location: '', error: e.message }))
    req.end()
  })
}

/**
 * Идёт по цепочке переадресаций до первого не-3xx ответа.
 *
 * Цепочка бывает длиннее одного шага: адрес переименовывали дважды, и первый
 * алиас ведёт на второй. Конечная точка — единственное, что имеет смысл класть
 * в очередь, поэтому промежуточные шаги остаются в `hops` только для отчёта.
 */
async function resolveChain(url, probe) {
  const hops = []
  let current = url

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const res = await probe(current)
    const status = Number(res.status) || 0
    if (status < 300 || status >= 400) {
      return { status, url: current, hops, error: res.error || '' }
    }
    if (!res.location) {
      return { status, url: current, hops, error: `${status} без заголовка Location` }
    }
    if (hop === MAX_REDIRECT_HOPS) {
      return { status, url: current, hops, error: `цепочка длиннее ${MAX_REDIRECT_HOPS} переходов` }
    }
    let next
    try {
      next = new URL(res.location, current).toString()
    } catch {
      return { status, url: current, hops, error: `битый Location: ${res.location}` }
    }
    hops.push({ from: current, status, to: next })
    current = next
  }

  /* istanbul ignore next — цикл всегда выходит через return выше */
  return { status: 0, url: current, hops, error: 'цепочка не разобрана' }
}

/**
 * Вердикт по одному адресу очереди.
 *
 * `redirect` ставится только когда цель переезда сама отвечает 2xx: переезд на
 * мёртвый адрес чинить нечем, и переписывать на него запись нельзя — это
 * `dead`.
 */
async function verifyUrl(url, probe) {
  const chain = await resolveChain(url, probe)
  const moved = chain.hops.length > 0
  const firstStatus = moved ? chain.hops[0].status : chain.status

  if (chain.status >= 200 && chain.status < 300) {
    if (!moved) return { url, verdict: 'ok', status: chain.status, reason: `отвечает ${chain.status}` }
    return {
      url,
      verdict: 'redirect',
      status: firstStatus,
      target: chain.url,
      targetStatus: chain.status,
      reason: `${firstStatus} → ${chain.url} (цель отвечает ${chain.status})`,
    }
  }

  const dead = chain.status === 404 || chain.status === 410
  const tail = chain.error ? chain.error : `отвечает ${chain.status}`
  return {
    url,
    verdict: dead ? 'dead' : 'unreachable',
    status: firstStatus,
    target: moved ? chain.url : null,
    reason: moved ? `${firstStatus} → ${chain.url}, но цель ${tail}` : tail,
  }
}

/** Последовательный обход: сотня HEAD по своему же хосту, спешить некуда. */
async function verifyUrls(urls, { probe = probeStatus, onProgress } = {}) {
  const rows = []
  for (const url of urls) {
    rows.push(await verifyUrl(url, probe))
    if (onProgress) onProgress(rows.length, urls.length)
  }
  return rows
}

/** Слаг из адреса: `renamedFrom` в очереди хранит именно слаги, а не полные URL. */
function slugOf(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() || ''
  } catch {
    return ''
  }
}

/**
 * Переписывает протухшие записи на цель переезда — ровно та правка, которую
 * 10.08 делали руками.
 *
 * История подачи (`indexCheck`, `gscRequests`) не трогается: там записано, что
 * подавали и что проверяли по старому адресу, и переписать это значило бы
 * задним числом подделать факт.
 */
function applyRedirectFixes(queue, rows, { today }) {
  const applied = []
  const refused = []
  const occupied = new Set(collectQueueUrls(queue))

  for (const row of rows) {
    if (row.verdict !== 'redirect') continue
    if (occupied.has(row.target)) {
      // Обе записи ведут на один адрес: слияние потеряло бы историю одной из
      // них, поэтому это работа человека, а не автоправки.
      refused.push({ ...row, refusal: `цель ${row.target} уже есть в очереди — записи сливаются вручную` })
      continue
    }

    for (const batch of queue.batches || []) {
      batch.urls = (batch.urls || []).map((url) => (url === row.url ? row.target : url))
    }
    for (const detail of queue.details || []) {
      if (detail.url !== row.url) continue
      const renamedFrom = Array.isArray(detail.renamedFrom) ? detail.renamedFrom : []
      const oldSlug = slugOf(row.url)
      if (oldSlug && !renamedFrom.includes(oldSlug)) renamedFrom.push(oldSlug)
      detail.url = row.target
      detail.renamedFrom = renamedFrom
      detail.staleRedirectFixedAt = today
    }

    occupied.delete(row.url)
    occupied.add(row.target)
    applied.push({ from: row.url, to: row.target })
  }

  return { applied, refused }
}

/** Вердикты после автоправки: переписанная запись живая, отказ остаётся не-200. */
function rowsAfterFixes(rows, applied) {
  const fixed = new Map(applied.map((change) => [change.from, change.to]))
  return rows.map((row) => {
    const target = fixed.get(row.url)
    if (!target) return row
    return {
      url: target,
      verdict: 'ok',
      status: row.targetStatus,
      reason: `переписан с ${row.url} (${row.status})`,
      wasRedirectFrom: row.url,
    }
  })
}

/**
 * Доля проиндексированных — со знаменателем, из которого выкинуты не-200.
 *
 * Именно этот знаменатель и был дефектом: адрес, отдающий 301, физически не
 * может отметиться проиндексированным, но продолжал считаться «ещё не
 * проиндексированным» и вечно занижал показатель.
 */
function summarizeIndexProgress(queue, rows) {
  const byUrl = new Map(rows.map((row) => [row.url, row]))
  const checked = []
  const indexedUrls = new Set()

  for (const batch of (queue && queue.batches) || []) {
    if (!batch.indexCheck) continue
    for (const url of batch.urls || []) checked.push(url)
    for (const url of batch.indexCheck.indexedUrls || []) indexedUrls.add(url)
  }

  const excluded = checked
    .filter((url) => byUrl.has(url) && byUrl.get(url).verdict !== 'ok')
    .map((url) => ({ url, reason: byUrl.get(url).reason }))
  const excludedUrls = new Set(excluded.map((row) => row.url))
  const eligible = checked.filter((url) => !excludedUrls.has(url))
  const indexed = eligible.filter((url) => indexedUrls.has(url))

  return {
    checked: checked.length,
    eligible: eligible.length,
    indexed: indexed.length,
    excluded,
    share: eligible.length ? Math.round((indexed.length / eligible.length) * 1000) / 10 : null,
  }
}

const VERDICT_VIEW = [
  ['redirect', '🔁 Переехали — подавать нельзя'],
  ['dead', '💀 Мёртвые адреса'],
  ['unreachable', '⚠️  Прод не ответил внятно'],
]

function formatReport(report) {
  const lines = []
  lines.push(`📋 Очередь индексации — ${report.queueFile}`)
  lines.push(`   Проверено адресов: ${report.probed} из ${report.total}${report.scope}`)
  lines.push(`   ✅ живые: ${report.counts.ok}`)

  for (const [verdict, title] of VERDICT_VIEW) {
    const rows = report.byVerdict[verdict] || []
    if (!rows.length) continue
    lines.push(`\n${title} — ${rows.length}:`)
    for (const row of rows) lines.push(`   ${row.url}\n       ${row.reason}`)
  }

  if (report.fixes) {
    if (report.fixes.applied.length) {
      lines.push(`\n✍️  Переписано в очереди — ${report.fixes.applied.length}:`)
      for (const change of report.fixes.applied) lines.push(`   ${change.from}\n    → ${change.to}`)
    }
    for (const row of report.fixes.refused) lines.push(`\n🚫 Не переписан: ${row.url}\n       ${row.refusal}`)
  } else if ((report.byVerdict.redirect || []).length) {
    lines.push('\n➡️  Переписать записи на цель переезда: --fix')
  }

  if (report.progress) {
    const p = report.progress
    lines.push(
      `\n📈 Доля индексации по проверенным пачкам: ${p.indexed}/${p.eligible}` +
        (p.share === null ? '' : ` (${p.share}%)`)
    )
    if (p.excluded.length) {
      lines.push(`   Из знаменателя исключены ${p.excluded.length} не-200:`)
      for (const row of p.excluded) lines.push(`     ${row.url} — ${row.reason}`)
    }
  } else {
    lines.push('\n📈 Доля индексации не считалась: проверена только часть очереди.')
  }

  lines.push(
    report.failed
      ? `\n❌ Не-200 в очереди: ${report.failed}. Пока они там, подача и доля врут.`
      : '\n✅ Все проверенные адреса отдают 200 — очередь можно подавать.'
  )
  return lines.join('\n')
}

async function main(argv = process.argv, deps = {}) {
  const probe = deps.probe || probeStatus
  const readQueue = deps.readQueue || ((file) => JSON.parse(fs.readFileSync(file, 'utf8')))
  // Файл очереди перезаписывается тем же двухпробельным JSON, каким лежит в
  // репозитории: правка должна читаться в диффе построчно.
  const writeQueue = deps.writeQueue || ((file, queue) => fs.writeFileSync(file, JSON.stringify(queue, null, 2), 'utf8'))
  const writeOut = deps.writeOut || ((file, text) => fs.writeFileSync(file, text, 'utf8'))
  const today = deps.today || new Date().toISOString().slice(0, 10)

  const args = parseArgs(argv)
  const queue = readQueue(args.queueFile)
  // Пустая очередь — это отказ чтения или сломанный формат, а не «нет проблем»:
  // молчаливый зелёный отчёт над пустой выборкой и есть класс #1325.
  const allUrls = requireNonEmptySelection(collectQueueUrls(queue), {
    what: 'URLs',
    source: args.queueFile,
  })

  let batch = null
  if (args.batch !== null) {
    batch = (queue.batches || []).find((entry) => Number(entry.day) === args.batch)
    if (!batch) throw new UsageError(`В очереди нет пачки ${args.batch}`)
  }

  let urls = batch ? [...(batch.urls || [])] : allUrls
  if (args.limit) urls = urls.slice(0, args.limit)
  const partial = urls.length < allUrls.length

  // В режиме пачки stdout занят списком адресов для `indexnow-submit
  // --urls-file`, поэтому весь человеческий вывод уходит в stderr.
  const say = batch ? console.error : console.log
  if (!args.json) say(`🔎 Проверяю статус ${urls.length} адресов очереди…`)

  let rows = await verifyUrls(urls, {
    probe,
    onProgress: (done, total) => {
      if (!args.json && total > 25 && done % 25 === 0) say(`   …${done}/${total}`)
    },
  })

  let fixes = null
  if (args.fix) {
    fixes = applyRedirectFixes(queue, rows, { today })
    if (fixes.applied.length) writeQueue(args.queueFile, queue)
    rows = rowsAfterFixes(rows, fixes.applied)
  }

  const byVerdict = {}
  for (const row of rows) (byVerdict[row.verdict] = byVerdict[row.verdict] || []).push(row)
  const counts = Object.fromEntries(Object.entries(byVerdict).map(([verdict, list]) => [verdict, list.length]))
  const failed = rows.filter((row) => row.verdict !== 'ok').length

  const report = {
    queueFile: args.queueFile,
    total: allUrls.length,
    probed: rows.length,
    scope: batch ? ` (пачка ${args.batch})` : args.limit ? ' (--limit)' : '',
    counts: { ok: counts.ok || 0, redirect: counts.redirect || 0, dead: counts.dead || 0, unreachable: counts.unreachable || 0 },
    byVerdict,
    fixes,
    // Доля осмысленна только когда очередь проверена целиком: считать её по
    // куску значит опять выдать половину правды за целую.
    progress: partial ? null : summarizeIndexProgress(queue, rows),
    failed,
    rows,
  }

  // Список пачки — часть отчёта, а не отдельная запись в stdout: дописать его
  // после JSON значило бы отдать машиночитаемому потребителю битый документ.
  // Грязная пачка не выдаётся ни одним каналом: текстовый режим до неё не
  // доходит из-за броска ниже, и машиночитаемый не должен отдавать её тоже —
  // иначе `--json` останется дырой ровно того класса, что и #1389.
  if (batch && !failed) report.batchUrls = [...(batch.urls || [])]

  if (args.json) console.log(JSON.stringify(report, null, 2))
  else say(formatReport(report))

  // Провал доносится броском, а не кодом возврата: единый контракт кодов живёт
  // в runSeoCli (#1391), и пачка при этом не выдаётся вовсе. `ExpectedFailureError` —
  // это «проверка отработала и нашла плохое»: причина уже разобрана построчно
  // выше, поэтому наружу уходит одна строка, а не трасса вызовов.
  if (failed) {
    throw new ExpectedFailureError(
      batch
        ? `пачка ${args.batch} не выдана: ${failed} из ${rows.length} адресов не отдают 200`
        : `не-200 в очереди: ${failed} — разбор выше`
    )
  }

  if (batch) {
    const list = report.batchUrls.join('\n') + '\n'
    if (args.out) {
      writeOut(args.out, list)
      console.error(`📄 ${report.batchUrls.length} адресов записаны в ${args.out}`)
    } else if (!args.json) {
      process.stdout.write(list)
    }
  }

  return report
}

if (require.main === module) {
  runSeoCli(main, { name: CLI_NAME, usage: USAGE })
}

module.exports = {
  CLI_SPEC,
  QUEUE_FILE,
  USAGE,
  UsageError,
  applyRedirectFixes,
  collectQueueUrls,
  formatReport,
  main,
  parseArgs,
  probeStatus,
  resolveChain,
  rowsAfterFixes,
  slugOf,
  summarizeIndexProgress,
  verifyUrl,
  verifyUrls,
}
