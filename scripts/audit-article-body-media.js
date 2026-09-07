#!/usr/bin/env node
/**
 * Корпусный 404-прогон по картинкам в телах статей (#1834).
 *
 * ЗАЧЕМ. Кадр в теле статьи может умереть, не тронув ни одного гейта: код 200 у
 * страницы, валидный HTML, зелёный SEO-check, зелёный `post-deploy-media-check`
 * (он смотрит контракт трансформации — вес, кэш, ступени — на выборке статей, а
 * не доступность каждой ссылки). Так прожили #1088 и #1834: `/address-image/<id
 * точки>/…` резолвится ПО СТРОКЕ `travel_address`, и удаление точки оставляет в
 * тексте `<img>`, который навсегда отдаёт 404. Обнаруживал это автор глазами в
 * консоли, а не проверка.
 *
 * ЧТО СЧИТАЕТСЯ ДЕФЕКТОМ. Два разных состояния, и второе важнее первого:
 *   1. `broken`  — первопартийный `<img>` тела не отдаёт 200. Читатель уже видит
 *                  пустую рамку.
 *   2. `dangling` — `/address-image/<id>/` в теле статьи, у которой такой точки в
 *                  маршруте НЕТ. Ссылка может ещё отвечать 200 из кэша или по
 *                  живому файлу, но владельца у неё уже нет. Это тот же дефект за
 *                  сутки до того, как его увидит читатель.
 * Отдельной строкой идёт `fragile` — живая ссылка на фото существующей точки в
 * теле. Прогон её не валит: это не поломка, а долг (#1834, п.3) — такой кадр
 * умрёт при первой же правке маршрута.
 *
 * СКОЛЬКО ЭТО СТОИТ. Замер корпуса 06.09.2026 (412 опубликованных статей): 6800
 * ссылок `travel-description-image`, 199 `gallery`, 29 `address-image`. Классы
 * неравноценны по риску: `travel-description-image` принадлежит самой статье и
 * умереть вместе с чужой строкой не может, а `address-image`/`gallery`/legacy
 * `uploads/**` — ровно те, где ломалось. Поэтому по умолчанию щупаются только
 * рискованные классы (сотни запросов, дёшево на 1 vCPU прода), а `--full`
 * добавляет `travel-description-image` — это регрессионный замер всего корпуса,
 * а не пост-деплойный гейт.
 *
 * Usage:
 *   node scripts/audit-article-body-media.js [--url https://metravel.by]
 *     [--full] [--limit N|all] [--concurrency N] [--json] [--verbose]
 *
 * `--json` — режим для машины: в stdout уходит один отчёт и ничего больше.
 * Код возврата 1, если найден хотя бы один `broken` или `dangling`.
 */

const https = require('https')
const http = require('http')

const { fetchJson } = require('./lib/fetchJson')
const { mapWithConcurrency } = require('./lib/concurrency')
const { readPagedList, TRAVELS_PER_PAGE } = require('./lib/pagedList')
const {
  collectArticleBodyMediaUrls,
  collectRichTextMediaUrls,
  familyOfMediaUrl,
} = require('./lib/articleBodyMedia')
const { toReaderMediaUrl, toSourceMediaUrl } = require('./lib/readerMediaUrl')

const args = process.argv.slice(2)

function hasFlag(name) {
  return args.includes(`--${name}`)
}

function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const SITE = getArg('url', 'https://metravel.by').replace(/\/+$/, '')
const JSON_OUTPUT = hasFlag('json')
const VERBOSE = hasFlag('verbose')
const FULL = hasFlag('full')

/**
 * Классы, чей кадр живёт по ЧУЖОМУ ключу, — их и щупаем всегда.
 *
 * `address-image` привязан к строке точки, `gallery`/`travel-image` — к записям
 * галереи и обложки, `media-resize-*` и `uploads` — legacy без durable-производных
 * (#1245). Всё это уже ломалось. `travel-description-image` в набор не входит: он
 * принадлежит описанию самой статьи и вместе с чужой строкой не исчезает.
 */
const RISKY_FAMILIES = new Set([
  'address-image',
  'gallery',
  'travel-image',
  'media-resize-legacy',
  'media-resize-uploads',
  'uploads',
])

/** То же плюс канонический класс тела — полный корпусный замер. */
const FULL_FAMILIES = new Set([...RISKY_FAMILIES, 'travel-description-image'])

/**
 * Параллелизм: прод одноядерный и на 8 начинает отвечать 503 `capacity-rejected`
 * (замер 2026-08-05, `post-deploy-media-check.js`). Четыре — проверенный потолок.
 */
const DEFAULT_CONCURRENCY = 4

const REQUEST_TIMEOUT_MS = 20000

/** Столько строк списка печатаем человеку; полный список — в `--json`. */
const MAX_PRINTED_ITEMS = 40

function concurrency() {
  const parsed = Number(getArg('concurrency', String(DEFAULT_CONCURRENCY)))
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_CONCURRENCY
}

function travelLimit() {
  const raw = String(getArg('limit', 'all')).trim()
  if (/^all$/i.test(raw)) return Infinity
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Infinity
}

/**
 * Статус кадра по HEAD.
 *
 * HEAD, а не GET: прод отвечает на него честным кодом (проба 07.09.2026 —
 * существующая производная 200, несуществующая 404) и не гоняет по сети тело
 * картинки. Редирект проходим руками: ответ 30x — это ещё не вердикт.
 */
function headStatus(url, redirectDepth = 0) {
  return new Promise((resolve) => {
    let client
    try {
      client = url.startsWith('https:') ? https : http
    } catch {
      resolve({ status: 0, error: 'bad url' })
      return
    }

    const req = client.request(
      url,
      { method: 'HEAD', timeout: REQUEST_TIMEOUT_MS, headers: { 'user-agent': 'metravel-body-media-audit' } },
      (res) => {
        res.resume()
        const status = res.statusCode || 0
        if (status >= 300 && status < 400 && res.headers.location && redirectDepth < 5) {
          const next = new URL(res.headers.location, url).toString()
          headStatus(next, redirectDepth + 1).then(resolve)
          return
        }
        resolve({ status })
      },
    )

    req.on('error', (error) => resolve({ status: 0, error: error.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ status: 0, error: 'timeout' })
    })
    req.end()
  })
}

/** HEAD с одним повтором на backpressure: 503/429 — про нагрузку, не про кадр. */
async function headStatusResilient(url) {
  const first = await headStatus(url)
  if (first.status !== 429 && first.status !== 503 && first.status !== 0) return first
  await new Promise((resolve) => setTimeout(resolve, 2000))
  return headStatus(url)
}

/**
 * Адрес, который щупаем, — ровно тот, что уходит из браузера читателя.
 *
 * Между `src` в теле и запросом браузера стоит переписывание роута
 * (`toLegacyResizePath` в `utils/mediaUrl.ts`), и строить цель из `src` нельзя:
 * бакетную ссылку и conversion-ключ читатель спрашивает по `/media-resize/…`,
 * а не по адресу из разметки. Гейт по адресу из `src` меряет доступность
 * другого файла — молчит на сломанном прокси-роуте при живом объекте в бакете и
 * выдумывает битые кадры, когда объект в бакете закроют (#1854).
 *
 * Правило одно на все гейты и живёт в `lib/readerMediaUrl.js`; чужой хост он
 * отдаёт как `null` — его доступность не наш контракт.
 */
function toTargetUrl(rawUrl) {
  return toReaderMediaUrl(rawUrl, SITE)
}

/** Id точек маршрута статьи — владельцы кадров `/address-image/<id>/`. */
function collectPointIds(detail) {
  const points = Array.isArray(detail?.travelAddress)
    ? detail.travelAddress
    : Array.isArray(detail?.coordsMeTravel)
      ? detail.coordsMeTravel
      : []
  const ids = new Set()
  for (const point of points) {
    const id = Number(point?.id)
    if (Number.isFinite(id) && id > 0) ids.add(id)
  }
  return ids
}

const POINT_IMAGE_PATH_RE = /^\/address-image\/(\d+)\//

/**
 * Id точки из ИСХОДНОГО адреса кадра, либо null для любого другого класса.
 *
 * Считается до переписывания роута и только по нему: у читательского адреса
 * (`/media-resize/legacy/<id>/conversions/…`) первый сегмент ключа — тот же id,
 * но семейство источника по нему уже не восстановить, и `gallery`-ключ выглядел
 * бы фотографией точки.
 */
function pointIdOfUrl(url) {
  try {
    // База нужна корне-относительной форме: в теле статьи `src` чаще всего
    // именно такой, а разбор без базы на нём бросает.
    const match = POINT_IMAGE_PATH_RE.exec(new URL(String(url), SITE).pathname)
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}

/**
 * Цели одной статьи: уникальные первопартийные адреса кадров её тела.
 *
 * Источников два и они не заменяют друг друга: `media.article_body` — BE-манифест
 * обложки и галереи тела, rich-text HTML — то, что читатель реально запрашивает,
 * и только там живут ссылки, вставленные вручную (в том числе на фото точки).
 */
function collectTravelTargets(detail, families) {
  const pointIds = collectPointIds(detail)
  const seen = new Set()
  const targets = []

  for (const rawUrl of [...collectArticleBodyMediaUrls(detail), ...collectRichTextMediaUrls(detail)]) {
    const url = toTargetUrl(rawUrl)
    if (!url || seen.has(url)) continue
    // Классификация идёт по ИСХОДНОМУ адресу: `family` и `pointId` — это про
    // владельца кадра (строка точки, запись галереи, legacy-ключ), а роут на
    // владельца не влияет. Обёртку weserv снимаем — она не класс, а упаковка, и
    // без разворота ссылка на бакет внутри неё выглядела бы «не наш класс».
    const sourceUrl = toSourceMediaUrl(rawUrl)
    const family = familyOfMediaUrl(sourceUrl, SITE)
    if (!family || !families.has(family)) continue
    seen.add(url)

    const pointId = pointIdOfUrl(sourceUrl)
    targets.push({
      url,
      // Адрес из разметки печатается рядом с целью: без него по строке отчёта
      // не найти сам `<img>`, который надо править.
      sourceUrl,
      family,
      pointId,
      // Точки статьи прочитаны из её же payload: пустой маршрут значит «точек
      // нет», и ссылка на фото точки в таком теле осиротела по определению.
      dangling: pointId != null && !pointIds.has(pointId),
    })
  }

  return targets
}

function log(...parts) {
  if (!JSON_OUTPUT) console.log(...parts)
}

async function main() {
  const families = FULL ? FULL_FAMILIES : RISKY_FAMILIES
  const limit = travelLimit()

  log(`🔎 Корпусный прогон медиа тел статей: ${SITE}`)
  log(`   классы: ${[...families].join(', ')}`)

  const rows = await readPagedList({
    fetchPage: (page, pageSize) =>
      fetchJson(`${SITE}/api/travels/?page=${page}&perPage=${pageSize}`, { timeoutMs: REQUEST_TIMEOUT_MS }),
    pageSize: TRAVELS_PER_PAGE,
  })
  const ids = rows.map((row) => row?.id).filter((id) => Number.isFinite(Number(id)))
  const scanIds = Number.isFinite(limit) ? ids.slice(0, limit) : ids

  if (!scanIds.length) {
    console.error('❌ Каталог статей пуст — проверять нечего, это отказ источника, а не чистый прогон')
    process.exit(1)
  }

  log(`   статей в каталоге: ${ids.length}, обходим: ${scanIds.length}`)

  const perTravel = await mapWithConcurrency(scanIds, concurrency(), async (id) => {
    try {
      const detail = await fetchJson(`${SITE}/api/travels/${id}/`, { timeoutMs: REQUEST_TIMEOUT_MS })
      return { id, targets: collectTravelTargets(detail, families) }
    } catch (error) {
      return { id, targets: [], error: error.message }
    }
  })

  const unreadable = perTravel.filter((item) => item.error)
  const targets = perTravel.flatMap((item) =>
    item.targets.map((target) => ({ ...target, travelId: item.id })),
  )

  log(`   кадров к проверке: ${targets.length}`)

  // Один и тот же адрес встречается в разных статьях: сеть щупаем по уникальному
  // адресу, а отчёт по-прежнему называет каждую статью-владельца.
  const uniqueUrls = [...new Set(targets.map((target) => target.url))]
  const statuses = new Map()
  const probed = await mapWithConcurrency(uniqueUrls, concurrency(), (url) => headStatusResilient(url))
  uniqueUrls.forEach((url, index) => statuses.set(url, probed[index]))

  const broken = []
  const dangling = []
  const fragile = []
  for (const target of targets) {
    const probe = statuses.get(target.url) || { status: 0 }
    const item = { ...target, status: probe.status, error: probe.error }
    if (probe.status !== 200) broken.push(item)
    if (target.dangling) dangling.push(item)
    else if (target.pointId != null) fragile.push(item)
  }

  const report = {
    site: SITE,
    scannedTravels: scanIds.length,
    catalogTravels: ids.length,
    families: [...families],
    checkedMedia: targets.length,
    checkedUniqueMedia: uniqueUrls.length,
    unreadableTravels: unreadable.map((item) => ({ id: item.id, error: item.error })),
    broken,
    dangling,
    fragile,
  }

  if (JSON_OUTPUT) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    printReport(report)
  }

  // Недочитанная статья — потеря покрытия, а не чистый прогон: молчать об этом
  // нельзя, но и валить деплой из-за одного 502 у API незачем.
  if (unreadable.length) {
    console.error(`⚠️  Не прочитано статей: ${unreadable.length} — покрытие неполное`)
  }

  process.exit(broken.length || dangling.length ? 1 : 0)
}

function printItems(title, items) {
  if (!items.length) return
  console.log(`\n${title} (${items.length}):`)
  for (const item of items.slice(0, MAX_PRINTED_ITEMS)) {
    const status = item.status ? `HTTP ${item.status}` : item.error || 'нет ответа'
    // Цель и `src` расходятся на двух классах из шести; когда расходятся —
    // печатаем оба, иначе строка не даёт найти `<img>` в теле статьи.
    const source = item.sourceUrl && item.sourceUrl !== item.url ? ` ← ${item.sourceUrl}` : ''
    console.log(`   travel ${item.travelId} · ${status} · ${item.url}${source}`)
  }
  if (items.length > MAX_PRINTED_ITEMS) {
    console.log(`   … ещё ${items.length - MAX_PRINTED_ITEMS} — полный список в --json`)
  }
}

function printReport(report) {
  console.log(
    `\n📊 Статей обойдено: ${report.scannedTravels}/${report.catalogTravels}, ` +
      `кадров: ${report.checkedMedia} (уникальных адресов: ${report.checkedUniqueMedia})`,
  )

  printItems('❌ Не отдаётся (битые картинки в тексте)', report.broken)
  printItems('❌ Фото точки, которой в маршруте нет (умрёт при следующей правке)', report.dangling)
  if (VERBOSE) {
    printItems('⚠️  Фото живой точки в теле — долг #1834 п.3', report.fragile)
  } else if (report.fragile.length) {
    console.log(
      `\n⚠️  Фото живых точек в телах: ${report.fragile.length} — прогон не валят, ` +
        'но умрут при правке маршрута (--verbose покажет список)',
    )
  }

  if (!report.broken.length && !report.dangling.length) {
    console.log('\n✅ Битых и осиротевших картинок в телах статей нет')
  }
}

module.exports = {
  FULL_FAMILIES,
  RISKY_FAMILIES,
  collectPointIds,
  collectTravelTargets,
  pointIdOfUrl,
  toTargetUrl,
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Корпусный прогон медиа тел статей упал:', error)
    process.exit(1)
  })
}
