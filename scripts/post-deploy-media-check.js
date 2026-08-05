#!/usr/bin/env node
/**
 * Post-deploy media contract checker (#1205).
 *
 * Регрессия #1195 была тихой: код 200, тело — валидная картинка, страница
 * выглядит нормально. Пост-деплой SEO-check, guard'ы, unit-тесты и e2e её
 * пропустили, потому что ни один из них не смотрит на ВЕС и заголовки кэша
 * медиа-ответа. Этот гейт смотрит ровно на них:
 *
 *   x-metravel-image-transform: source-pass-through   ← ресайз не применён
 *   cache-control: no-store                           ← кэша нет
 *   разные `w` дают одинаковый вес                    ← ресайз не применён
 *
 * URL берутся из публичного API (`/api/travels/`, `/api/quests/`), а не
 * хардкодятся: гейт не должен протухать вместе с id конкретной записи.
 *
 * Usage:
 *   node scripts/post-deploy-media-check.js [--url https://metravel.by]
 *     [--allow-known-broken] [--json] [--verbose] [--insecure]
 */

const https = require('https')
const http = require('http')

const args = process.argv.slice(2)

function hasFlag(name) {
  return args.includes(`--${name}`)
}

function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const SITE = getArg('url', 'https://metravel.by').replace(/\/+$/, '')
const VERBOSE = hasFlag('verbose')
const JSON_OUTPUT = hasFlag('json')
const ALLOW_KNOWN_BROKEN = hasFlag('allow-known-broken')
const INSECURE_TLS =
  hasFlag('insecure') || String(process.env.MEDIA_CHECK_INSECURE || '0') === '1'

/**
 * Ступени, на которых меряем инвариант ресайза, — СВОИ у каждого семейства.
 *
 * Одной пары на всех быть не может: лестницы в `IMAGE_STORAGE_POLICY_V1`
 * (`constants/imageContract.ts`) разные, и общей верхней ступени у них нет.
 * Прежняя фиксированная `LARGE_WIDTH = 1920` после включения
 * `MEDIA_IMAGE_DERIVATIVE_READ_ENABLED` (#1180) стала спрашивать ширину,
 * которой нет НИ В ОДНОМ профиле: бэкенд честно отвечает 400 + `text/plain`
 * (fail-closed вместо тихой подмены мастером, #1201), а гейт считал это тремя
 * ошибками на ветку и валил каждый деплой — 30 ложных ошибок на прогон.
 *
 * `small` — минимальная производная профиля, `large` — максимальная. Мастер
 * сюда не берём: он раздаётся `no-store` by design, и проверка кэша на нём
 * даёт ложную ошибку. Таблицу сверяет с контрактом
 * `__tests__/scripts/postDeployMediaWidths.test.ts` — руками её править нельзя,
 * только вслед за `IMAGE_STORAGE_POLICY_V1`.
 */
const WIDTHS_BY_FAMILY = new Map([
  ['travel-image', { small: 96, large: 1600 }],
  ['gallery', { small: 96, large: 1600 }],
  ['travel-description-image', { small: 320, large: 1600 }],
  ['address-image', { small: 320, large: 960 }],
  ['quest-cover', { small: 320, large: 800 }],
  // Legacy-роут обслуживает conversion-ключи travel-медиа, лестница у него та же.
  ['media-resize-legacy', { small: 96, large: 1600 }],
  // Ключи `uploads/**` — это фото тела старых статей, лестница профиля `articleBody`.
  ['media-resize-uploads', { small: 320, large: 1600 }],
])

/** Ступени по умолчанию — для семейства, которого ещё нет в таблице. */
const DEFAULT_WIDTHS = { small: 96, large: 800 }

/**
 * Семейства, у которых ширина мастера обязана обслуживаться ПРОИЗВОДНОЙ (#1215).
 *
 * Таблица выше меряет только производные ступени и мастер намеренно не трогает —
 * иначе `no-store` мастера даёт ложную ошибку. Но именно из-за этого гейт был
 * слеп к дефекту #1215: `travel-description-image` на `w=1920` отдаёт мастер с
 * `no-store`, фото тела статьи качается дважды на desktop @2x, а прогон гейта
 * при этом зелёный — 6 семейств, 0 ошибок. Проверка ширины мастера закрывает
 * ровно эту дыру.
 *
 * `pendingTicket` — протокол решения, а не выключатель: пока дефект открыт,
 * несоответствие понижено до предупреждения (иначе каждый деплой фронта краснел
 * бы из-за бэкендовой работы), но оно ВИДНО в отчёте. Когда прод начнёт отдавать
 * производную, гейт сам скажет снять пометку и станет строгим — так регресс
 * после починки уже не пройдёт молча.
 */
const MASTER_DERIVATIVE_BY_FAMILY = new Map([
  ['travel-description-image', { width: 1920, pendingTicket: '#1215' }],
])

/**
 * Семейства, ключи которых по контракту хранения обязаны быть `.webp` (#1251).
 *
 * 50 ключей `gallery`/`description` физически были WebP, но сохранили
 * историческое имя `....JPG`, и мастер по ним отдавался как `image/jpeg`:
 * Content-Type выводится из расширения ключа. Штатный `renormalize_image_sources`
 * такие ключи пропускает совершенно правильно — формат уже целевой, —
 * поэтому повторное появление такого ключа (новая заливка, откат, ручная правка)
 * ловить больше нечем. Legacy-роуты (`media-resize-*`, `uploads/**`) сюда не
 * входят: там исторические расширения — норма by design.
 */
const WEBP_ONLY_KEY_FAMILIES = new Set(['gallery', 'travel-description-image'])

/** Классы ключей, где историческое расширение — норма by design, а не дефект. */
const LEGACY_KEY_SEGMENT = /(^|\/)(conversions|uploads)\//i

/**
 * Расширение ключа цели, если оно нарушает контракт `.webp`; иначе null.
 * Работает по URL цели: сеть для этого не нужна, а протухнуть нечему.
 */
function legacyKeyExtension(target) {
  if (!WEBP_ONLY_KEY_FAMILIES.has(String(target?.family || '').toLowerCase())) return null
  let pathname
  try {
    pathname = decodeURIComponent(new URL(String(target.url)).pathname)
  } catch {
    return null
  }
  const key = pathname.replace(/^\/[^/]+\//, '')
  if (!key || LEGACY_KEY_SEGMENT.test(key)) return null
  const extension = String(key.split('/').pop().split('.').pop() || '').toLowerCase()
  return extension && extension !== 'webp' ? extension : null
}

function widthsFor(family) {
  return WIDTHS_BY_FAMILY.get(family) || DEFAULT_WIDTHS
}

/**
 * Семейства, про которые уже известно, что они сломаны, — с задачей-владельцем.
 * Список ЯВНЫЙ и сокращается по мере закрытия #1195; пустой список = гейт строгий
 * ко всем семействам. С `--allow-known-broken` ошибки этих семейств понижаются до
 * предупреждений, чтобы деплой не блокировался уже известной поломкой, но новая
 * регрессия в любом другом семействе валила гейт.
 */
const KNOWN_BROKEN_FAMILIES = new Map([
  // Пусто = гейт строгий ко всем семействам. Так и должно быть по умолчанию.
  //
  // Запись сюда добавляется ТОЛЬКО когда семейство сломано подтверждённо и у
  // поломки есть задача-владелец на борде, например:
  //   ['quest-cover', '#1195 — model-owned роут отдаёт мастер'],
  // Замер 2026-08-02: все пять семейств отдают dynamic-transform-cache и
  // корректные ступени в обеих Accept-ветках, поэтому исключений нет.
])

/** Family-роуты proxy-contract: из них достаётся storage-key для legacy-цели. */
const FIRST_PARTY_MEDIA_ROUTE =
  /^\/(gallery|travel-image|travel-description-image|address-image|avatar|quest-cover|trip-cover|quest-step-image|quest-poster|badge-image)\/(.+)$/i

/** Расширения, которые legacy-роут вообще обслуживает (`LEGACY_IMAGE_EXTENSIONS` в `utils/mediaUrl.ts`). */
const LEGACY_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

/**
 * Дубль `LEGACY_UPLOAD_TRANSFORM_FORMAT` из `constants/imageContract.ts`: гейт —
 * CommonJS и TS-константу не импортирует, как и правило маршрутизации выше.
 * Расхождение ловит `__tests__/scripts/post-deploy-media-check.test.ts`.
 */
const LEGACY_UPLOAD_TRANSFORM_FORMAT = 'jpeg'

/**
 * Accept ровно как у Chrome. Без него бэк уходит в jpeg-ветку
 * (`explicit_format_overrides: {jpeg: transform}` в proxy-contract), которая
 * ресайзится даже когда дефолтный webp-путь отдаёт мастер. Гейт с дефолтным
 * `Accept` зеленел бы на формате, который живой браузер не запрашивает, — то
 * есть проверял бы не ту ветку, что видит пользователь.
 */
const BROWSER_IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'

/**
 * Ветки клиентов, которые обязаны получать ресайз одинаково хорошо: браузер и
 * generic-клиент (краулер, соцсеть, превью-бот). Проверяются обе, потому что
 * бэкенд ветвится по `Accept` и деградировать может только одна из них.
 */
const ACCEPT_VARIANTS = [
  { id: 'browser', header: BROWSER_IMAGE_ACCEPT },
  { id: 'any', header: '*/*' },
]

function fetchMedia(url, accept = BROWSER_IMAGE_ACCEPT, redirectDepth = 0, originalUrl = url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const opts = {
      timeout: 30000,
      headers: {
        'User-Agent': 'MeTravelPostDeployMediaCheck/1.0',
        Accept: accept,
      },
    }
    if (mod === https) opts.rejectUnauthorized = !INSECURE_TLS

    const req = mod.get(url, opts, (res) => {
      const status = Number(res.statusCode || 0)
      if (status >= 300 && status < 400 && res.headers.location) {
        if (redirectDepth > 5) {
          reject(new Error(`Too many redirects for ${url}`))
          return
        }
        const nextUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString()
        res.resume()
        fetchMedia(nextUrl, accept, redirectDepth + 1, originalUrl).then(resolve, reject)
        return
      }

      // Вес считаем по фактически прочитанным байтам: `content-length` на
      // chunked-ответе отсутствует, а именно вес и есть предмет проверки.
      let bytes = 0
      res.on('data', (chunk) => { bytes += chunk.length })
      res.on('end', () => {
        resolve({
          url: originalUrl,
          finalUrl: url,
          status,
          bytes,
          contentType: String(res.headers['content-type'] || ''),
          transform: String(res.headers['x-metravel-image-transform'] || ''),
          headers: res.headers,
        })
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout: ${url}`))
    })
  })
}

/**
 * Backpressure origin'а, а не дефект контракта: 503 + `capacity-rejected`.
 *
 * Понадобилось вместе с лестничным обходом (#1261): он спрашивает сотни ступеней
 * подряд, и прод под такой нагрузкой начинает сбрасывать запросы. Замер
 * 2026-08-05: в прогоне гейта `quest-cover?w=320` ответил 503 `capacity-rejected`
 * в обеих Accept-ветках, а тот же URL поштучно — 200 `dynamic-transform`. Без
 * этого различения правило «любой non-200 — ошибка» валило бы деплой по нагрузке,
 * которую гейт сам же и создал.
 */
const isBackpressureResponse = (response) =>
  Number(response?.status) === 503 || /capacity-rejected/i.test(String(response?.transform || ''))

const BACKPRESSURE_RETRY_ATTEMPTS = 3
const BACKPRESSURE_RETRY_DELAY_MS = 1500

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** `fetchMedia` с повтором по backpressure; контрактные ответы не ретраятся. */
async function fetchMediaResilient(url, accept = BROWSER_IMAGE_ACCEPT) {
  let response = await fetchMedia(url, accept)
  for (let attempt = 1; attempt < BACKPRESSURE_RETRY_ATTEMPTS && isBackpressureResponse(response); attempt += 1) {
    await delay(BACKPRESSURE_RETRY_DELAY_MS * attempt)
    response = await fetchMedia(url, accept)
  }
  return response
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const opts = {
      timeout: 30000,
      headers: { 'User-Agent': 'MeTravelPostDeployMediaCheck/1.0', Accept: 'application/json' },
    }
    if (mod === https) opts.rejectUnauthorized = !INSECURE_TLS

    const req = mod.get(url, opts, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        if (Number(res.statusCode || 0) !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error instanceof Error ? error.message : error}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout: ${url}`))
    })
  })
}

function getHeaderValue(headers, name) {
  const raw = headers?.[String(name || '').toLowerCase()]
  if (Array.isArray(raw)) return raw.join(', ')
  return typeof raw === 'string' ? raw : ''
}

/** Список элементов из ответа DRF/легаси-конверта: `data`, `results` или голый массив. */
function unwrapList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.results)) return payload.results
  if (payload?.data && typeof payload.data === 'object') return [payload.data]
  return []
}

function unwrapItem(payload) {
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  return payload && typeof payload === 'object' ? payload : null
}

/** Путь+query медиа-URL, перенесённые на проверяемый origin. */
function toTargetUrl(site, rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return null
  try {
    const parsed = value.startsWith('/') ? new URL(value, site) : new URL(value)
    return `${site}${parsed.pathname}`
  } catch {
    return null
  }
}

/**
 * Legacy-роут того же изображения: `/media-resize/legacy/<storage-key>`.
 *
 * Ключ в бакете — это путь без family-префикса, ровно как его достаёт
 * `FIRST_PARTY_MEDIA_ROUTE` в `utils/mediaUrl.ts`. Legacy обслуживает только
 * conversion-ключи, поэтому URL без `/conversions/` сюда не годится.
 */
function toLegacyTarget(site, familyUrl) {
  const value = String(familyUrl || '').trim()
  if (!value) return null
  let pathname
  try {
    pathname = (value.startsWith('/') ? new URL(value, site) : new URL(value)).pathname
  } catch {
    return null
  }
  const match = FIRST_PARTY_MEDIA_ROUTE.exec(pathname)
  if (!match) return null
  const key = match[2]
  if (!/\/conversions\//i.test(key)) return null
  return `${site}/media-resize/legacy/${key}`
}

/**
 * Роут фото тела старой статьи: `/media-resize/uploads/<key>`.
 *
 * Манифест для legacy-ключа отдаёт голую ссылку на бакет
 * (`https://<bucket>.s3.<region>.amazonaws.com/uploads/<key>`), а фронт
 * переписывает её на наш прокси по правилу `isLegacyUploadKey` из
 * `utils/mediaUrl.ts`: класс `uploads/**` идёт БЕЗ префикса `legacy/`. Здесь то
 * же правило продублировано, потому что гейт — CommonJS и TS-утилиту не
 * импортирует; расхождение ловит `__tests__/scripts/post-deploy-media-check.test.ts`.
 *
 * Path-style ссылки на бакет (`s3.<region>.amazonaws.com/<bucket>/uploads/...`)
 * сюда намеренно не попадают: манифест их не отдаёт, а угадывать имя бакета в
 * гейте — способ получить цель, которой нет на проверяемом origin.
 *
 * #1233: цель несёт `f=jpeg`, потому что именно так фронт теперь спрашивает этот
 * класс (`LEGACY_UPLOAD_TRANSFORM_FORMAT`): durable-производных у `uploads/**`
 * нет, дефолтная webp-ветка отвечает 404 на КАЖДОЙ ступени. Гейт обязан щупать
 * ту ветку, которую видит читатель, иначе он либо валит деплой на URL, который
 * никто не запрашивает, либо зеленеет не на том. `format_precedence` контракта
 * ставит явный `f` выше `Accept`, поэтому обе Accept-ветки придут в jpeg — это
 * ожидаемо ровно для этого семейства и снимается вместе с карве-аутом.
 */
function toUploadsTarget(site, rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return null
  let key
  try {
    const pathname = (value.startsWith('/') ? new URL(value, site) : new URL(value)).pathname
    key = decodeURIComponent(pathname).replace(/^\/+/, '')
  } catch {
    return null
  }
  const parts = key.split('/')
  if (parts[0] !== 'uploads' || parts.length < 2) return null
  if (parts.some((part) => !part || part === '.' || part === '..')) return null
  const extension = String(parts[parts.length - 1].split('.').pop() || '').toLowerCase()
  if (!LEGACY_IMAGE_EXTENSIONS.has(extension)) return null
  return `${site}/media-resize/${key}?f=${LEGACY_UPLOAD_TRANSFORM_FORMAT}`
}

/** URL'ы медиа тела статьи из BE-манифеста: обложка + галерея. */
function collectArticleBodyMediaUrls(detail) {
  const body = detail?.media?.article_body
  if (!body) return []
  const items = [body.cover, ...(Array.isArray(body.gallery) ? body.gallery : [])]
  return items
    .filter(Boolean)
    .flatMap((item) => [item.src, item.variants?.original, item.src_contain, item.src_cover])
    .filter(Boolean)
}

/**
 * Семейство по адресу медиа: первый сегмент пути, у legacy-роутов — второй.
 *
 * Совпадает с ключами `WIDTHS_BY_FAMILY`, поэтому потолок берётся оттуда же,
 * а не из новой таблицы: сверку той таблицы с `IMAGE_STORAGE_POLICY_V1` уже
 * держит `__tests__/scripts/postDeployMediaWidths.test.ts`.
 */
function familyOfMediaUrl(rawUrl, site = SITE) {
  let pathname
  try {
    const value = String(rawUrl || '').trim()
    if (!value) return null
    pathname = (value.startsWith('/') ? new URL(value, site) : new URL(value)).pathname
  } catch {
    return null
  }
  const parts = pathname.split('/').filter(Boolean)
  if (!parts.length) return null
  if (parts[0].toLowerCase() === 'media-resize') {
    return parts[1]?.toLowerCase() === 'legacy' ? 'media-resize-legacy' : 'media-resize-uploads'
  }
  return parts[0].toLowerCase()
}

/**
 * КАЖДАЯ ступень `media.article_body[*].srcset`, а не первая подходящая (#1261).
 *
 * Гейт до этого щупал по одному URL на семейство и на двух ширинах. Этого хватало,
 * пока лестницу в манифесте задавал слот-потребитель и она была одинаковой у всех
 * ключей. #1260 сделал её производной от профиля ИСТОЧНИКА — значит расходиться
 * теперь может отдельная ступень отдельного ключа, и увидеть это можно только
 * обойдя лестницу целиком: ровно так дефект #1260 и прожил до прода (14 битых URL
 * из 222 в одной статье, при зелёном гейте на всех шести семействах).
 *
 * Ссылки прямо в бакет сюда не попадают: они не на проверяемом origin, у них своя
 * цель `media-resize-uploads`, и `?w=` бакет игнорирует by design (#1176).
 */
function collectArticleBodyRungs(detail, site = SITE) {
  const body = detail?.media?.article_body
  if (!body) return []
  const items = [body.cover, ...(Array.isArray(body.gallery) ? body.gallery : [])].filter(Boolean)

  const rungs = []
  for (const item of items) {
    const sources = [item.srcset, item.srcset_cover, item.srcset_contain]
    for (const srcset of sources) {
      if (typeof srcset !== 'string' || !srcset.trim()) continue
      for (const rawCandidate of srcset.split(',')) {
        const candidate = rawCandidate.trim()
        if (!candidate) continue
        const [rawUrl, descriptor] = candidate.split(/\s+/)
        const width = Number(String(descriptor || '').replace(/w$/i, ''))
        if (!rawUrl || !Number.isFinite(width) || width <= 0) continue
        if (isLegacyBucketUrl(rawUrl)) continue
        const url = toTargetUrlWithQuery(site, rawUrl)
        const family = familyOfMediaUrl(rawUrl, site)
        if (!url || !family) continue
        rungs.push({ url, width, family, profile: item.storage_policy?.profile || null })
      }
    }
  }
  return rungs
}

/** Прямая ссылка в S3: не на проверяемом origin и `?w=` не понимает (#1176). */
function isLegacyBucketUrl(rawUrl) {
  return /^https?:\/\/[^/]*\bs3[.-][^/]*amazonaws\.com\//i.test(String(rawUrl || '').trim())
}

/** Как `toTargetUrl`, но сохраняет query: у ступени в нём и лежит ширина. */
function toTargetUrlWithQuery(site, rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return null
  try {
    const parsed = value.startsWith('/') ? new URL(value, site) : new URL(value)
    return `${site}${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

/**
 * Разбор ответов по ступеням лестницы. Сеть отдельно, суждение отдельно — иначе
 * тест проверял бы мок примитива, а не реальный разбор контракта.
 *
 * `responses` — массив `{ rung, response }` в любом порядке.
 */
function auditArticleBodyLadder(responses) {
  const issues = []
  const byFamily = new Map()

  for (const { rung, response } of responses) {
    const family = rung.family
    const stats = byFamily.get(family) || { family, checked: 0, failed: 0, maxWidth: 0, minWidth: Infinity }
    stats.checked += 1
    stats.maxWidth = Math.max(stats.maxWidth, rung.width)
    stats.minWidth = Math.min(stats.minWidth, rung.width)

    // Любой не-200 — ошибка. Именно смягчение этого правила («первая подходящая
    // ступень ответила, значит семейство живое») и прятало #1260.
    if (response.status !== 200) {
      stats.failed += 1
      issues.push({
        severity: 'error',
        code: 'media.article_body.rung_status',
        message:
          `${family} w=${rung.width}: HTTP ${response.status} на ступени из media.article_body.srcset ` +
          `(${rung.url}) — манифест обещает адрес, которого нет`,
      })
    }

    const transform = getHeaderValue(response.headers, 'x-metravel-image-transform')
    if (/derivative-missing/i.test(transform)) {
      stats.failed += 1
      issues.push({
        severity: 'error',
        code: 'media.article_body.rung_derivative_missing',
        message: `${family} w=${rung.width}: transform="${transform}" — читатель видит битое фото (${rung.url})`,
      })
    }

    byFamily.set(family, stats)
  }

  // Ступень выше верхней производной СВОЕГО семейства — это и есть класс #1260.
  // Потолок берём из уже сверенной с контрактом таблицы, своей не заводим (#1261).
  for (const stats of byFamily.values()) {
    const known = WIDTHS_BY_FAMILY.get(stats.family)
    if (!known) continue
    if (stats.maxWidth > known.large) {
      issues.push({
        severity: 'error',
        code: 'media.article_body.ladder_exceeds_family',
        message:
          `${stats.family}: манифест рекламирует ступень ${stats.maxWidth}, а верхняя реальная производная ` +
          `семейства — ${known.large}. Лестница обязана считаться по профилю источника (#1260)`,
      })
    } else if (stats.maxWidth < known.large) {
      // Не ошибка: у мелкого исходника верхних ступеней может не быть по-честному.
      // Но молчать нельзя — так же незаметно семейство может ПОТЕРЯТЬ свою верхнюю
      // ступень, и `gallery` тихо просядет с 1600 до 960 на всех статьях сразу.
      issues.push({
        severity: 'warning',
        code: 'media.article_body.ladder_below_family',
        message:
          `${stats.family}: верхняя встреченная ступень ${stats.maxWidth} < ${known.large} — ` +
          'либо исходники мельче, либо семейство потеряло верхнюю производную',
      })
    }
  }

  return { issues, families: [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family)) }
}

/**
 * Цели проверки из уже загруженных payload'ов публичного API — по одному URL на
 * семейство. Вынесено из сетевой части, чтобы тесты гоняли реальный разбор
 * контракта, а не мок примитива (правило evidence №4 в docs/TASK_BOARD_MCP.md).
 */
function extractTargetsFromPayloads(site, { travels, travelDetail, travelDetails, quests } = {}) {
  const targets = []
  const seenFamilies = new Set()

  const push = (family, url, source) => {
    if (!url || !family || seenFamilies.has(family)) return
    seenFamilies.add(family)
    targets.push({ family, url, source })
  }

  // Первая деталь даёт цели галереи и точки; остальные нужны только для поиска
  // legacy-ключа `uploads/**`, которого у конкретной статьи может не быть вовсе.
  const details = [travelDetail, ...(Array.isArray(travelDetails) ? travelDetails : [])]
    .map(unwrapItem)
    .filter(Boolean)

  const firstTravel = unwrapList(travels).find((item) => item?.media?.cover?.variants || item?.travel_image_thumb_url)
  const travelCover =
    firstTravel?.media?.cover?.variants?.original ||
    firstTravel?.media?.cover?.variants?.card_480 ||
    firstTravel?.travel_image_thumb_url
  push('travel-image', toTargetUrl(site, travelCover), '/api/travels/')

  const detail = details[0] || null
  const galleryItem = (detail?.gallery || []).find((item) => item?.url || item?.thumb_url)
  push('gallery', toTargetUrl(site, galleryItem?.url || galleryItem?.thumb_url), '/api/travels/<id>/')

  const addressItem = (detail?.travelAddress || []).find(
    (item) => item?.travelImageThumbUrl || item?.travelImageUrl
  )
  push(
    'address-image',
    toTargetUrl(site, addressItem?.travelImageThumbUrl || addressItem?.travelImageUrl),
    '/api/travels/<id>/'
  )

  const firstQuest = unwrapList(quests).find((item) => item?.media?.cover?.variants || item?.cover_url)
  const questCover =
    firstQuest?.media?.cover?.variants?.original ||
    firstQuest?.media?.cover?.variants?.card_480 ||
    firstQuest?.cover_url
  push('quest-cover', toTargetUrl(site, questCover), '/api/quests/')

  // Legacy-роут держим в наборе всегда: без него гейт не отличит «все семейства
  // сломаны» от «проверять нечего». Обслуживает он только conversion-ключи,
  // поэтому берём первый кандидат, из которого путь реально строится, а не
  // первый непустой URL.
  const legacyUrl = [travelCover, addressItem?.travelImageThumbUrl, galleryItem?.url]
    .map((candidate) => toLegacyTarget(site, candidate))
    .find(Boolean)
  push('media-resize-legacy', legacyUrl, 'derived from family URL')

  // Фото тела старых статей. Именно этой цели не хватало, когда fail-closed
  // чтение производных включили без покрытия `uploads/**` (#1222): гейт был
  // зелёным, а 4381 фото в 215 из 397 опубликованных статей отдавало 404.
  const uploadsUrl = details
    .flatMap(collectArticleBodyMediaUrls)
    .map((candidate) => toUploadsTarget(site, candidate))
    .find(Boolean)
  push('media-resize-uploads', uploadsUrl, 'media.article_body опубликованных travel')

  // Фото тела статей нового пайплайна. Ступени для семейства в таблице были с
  // самого начала, но цель не строилась ни разу: `article_body` разбирался
  // только ради legacy-ключа `uploads/**`. Из-за этого гейт физически не мог
  // увидеть #1215 — сколько бы ширин ни проверял, семейства не было в наборе.
  const descriptionUrl = details
    .flatMap(collectArticleBodyMediaUrls)
    .filter((candidate) => /\/travel-description-image\//i.test(String(candidate)))
    .map((candidate) => toTargetUrl(site, candidate))
    .find(Boolean)
  push('travel-description-image', descriptionUrl, 'media.article_body опубликованных travel')

  return targets
}

/**
 * Проверка одной цели по двум ступеням ширины в каждой Accept-ветке.
 *
 * `probes` — массив `{ accept, small, large }`, где `small`/`large` это ответы
 * `fetchMedia` на SMALL_WIDTH и LARGE_WIDTH. Веток две, и обе обязательны:
 * браузерная (`image/webp`) — то, что видит пользователь; generic — то, что
 * видят краулеры, соцсети и превью-боты. Бэкенд ветвится по `Accept`, поэтому
 * деградировать может ровно одна ветка, и проверять только браузерную нельзя.
 */
function validateTarget(target, probes, options = {}) {
  const allowKnownBroken = Boolean(options.allowKnownBroken)
  const knownBroken = KNOWN_BROKEN_FAMILIES.get(target.family)
  const { small: smallWidth, large: largeWidth } = widthsFor(target.family)
  const issues = []

  const add = (code, message, severity = 'error') => {
    const downgraded = Boolean(knownBroken) && allowKnownBroken
    issues.push({
      severity: downgraded ? 'warning' : severity,
      code,
      message: downgraded ? `${message} (известная поломка: ${knownBroken})` : message,
    })
  }

  // Расширение ключа (#1251) — чистая строковая проверка, без сети. Ступени
  // ширины её не поймают: производные всегда `.webp`, а разъезжается имя мастера.
  const legacyExtension = legacyKeyExtension(target)
  if (legacyExtension) {
    add(
      'media.key_extension',
      `ключ хранится как ".${legacyExtension}", а не ".webp" — Content-Type мастера берётся из расширения, ` +
        `и WebP внутри отдаётся как image/${legacyExtension === 'png' ? 'png' : 'jpeg'} (#1251)`
    )
  }

  for (const probe of probes) {
    const scope = `[accept=${probe.accept}]`

    for (const [width, response] of [[smallWidth, probe.small], [largeWidth, probe.large]]) {
      if (response.status !== 200) {
        add('media.status', `${scope} w=${width}: ожидался HTTP 200, получен ${response.status}`)
      }
      const contentType = getHeaderValue(response.headers, 'content-type')
      if (contentType && !/^image\//i.test(contentType)) {
        add('media.content_type', `${scope} w=${width}: ответ не изображение (content-type "${contentType}")`)
      }
      const transform = getHeaderValue(response.headers, 'x-metravel-image-transform')
      if (/source-pass-through/i.test(transform)) {
        add(
          'media.source_pass_through',
          `${scope} w=${width}: x-metravel-image-transform="${transform}" — ресайз не применён, отдан мастер (${response.bytes} B)`
        )
      }
      // Fail-closed чтение производных (#1201) превращает пробел в покрытии d/v1
      // в 404 — то есть в битую картинку у читателя. Именно так уехал #1222.
      if (/derivative-missing/i.test(transform)) {
        add(
          'media.derivative_missing',
          `${scope} w=${width}: x-metravel-image-transform="${transform}" — производной нет, читатель видит битое фото`
        )
      }
      // Мастер вместо производной. На минимальной ступени профиля это всегда
      // провал бюджета (#1195, #1219). На верхней — пока допустимо: производной
      // в ширину мастера может не быть by design (#1215), поэтому предупреждение.
      if (/stored-master/i.test(transform)) {
        add(
          'media.master_instead_of_derivative',
          `${scope} w=${width}: отдан мастер (transform="${transform}", ${response.bytes} B) вместо производной`,
          width === smallWidth ? 'error' : 'warning'
        )
      }
      const cacheControl = getHeaderValue(response.headers, 'cache-control')
      if (/no-store/i.test(cacheControl)) {
        add(
          'media.cache_control.no_store',
          `${scope} w=${width}: cache-control="${cacheControl}" — раздача не кэшируется`
        )
      } else if (!/public/i.test(cacheControl) || !/max-age/i.test(cacheControl)) {
        add(
          'media.cache_control.missing',
          `${scope} w=${width}: cache-control="${cacheControl || '(нет)'}" — ожидались public и max-age`
        )
      }
    }

    // Ширина мастера (#1215): она обязана обслуживаться производной, иначе
    // desktop @2x берёт из srcset именно её и качает фото дважды — мастер
    // раздаётся `no-store`. Проверяется только у семейств, где производная в
    // эту ширину обещана; для остальных пробы `master` просто нет.
    const masterRule = MASTER_DERIVATIVE_BY_FAMILY.get(target.family)
    if (masterRule && probe.master) {
      const width = masterRule.width
      const transform = getHeaderValue(probe.master.headers, 'x-metravel-image-transform')
      const cacheControl = getHeaderValue(probe.master.headers, 'cache-control')
      const servedAsMaster = /stored-master/i.test(transform) || /no-store/i.test(cacheControl)
      const pending = masterRule.pendingTicket

      if (servedAsMaster) {
        add(
          'media.master_width_not_derivative',
          `${scope} w=${width}: transform="${transform || '(нет)'}", cache-control="${cacheControl || '(нет)'}" — ` +
            `ширина мастера отдаётся мастером, фото тела статьи качается дважды на desktop @2x` +
            (pending ? ` (ожидаемо до закрытия ${pending})` : ''),
          pending ? 'warning' : 'error'
        )
      } else if (pending && probe.master.status === 200) {
        // Дефект починен, а пометка осталась: без этого напоминания гейт
        // навсегда остался бы мягким к этой ширине и пропустил бы регресс.
        add(
          'media.master_width_pending_stale',
          `${scope} w=${width}: производная появилась (transform="${transform}") — ${pending} закрыт, ` +
            'снимите pendingTicket в MASTER_DERIVATIVE_BY_FAMILY, чтобы проверка снова стала строгой',
          'warning'
        )
      }
    }

    // Главный инвариант: разные `w` обязаны давать разный вес. Именно он ловит
    // тихую подмену ступени мастером, при которой все заголовки могут быть в норме.
    if (probe.small.status === 200 && probe.large.status === 200) {
      if (probe.small.bytes === probe.large.bytes) {
        add(
          'media.width_invariant',
          `${scope} w=${smallWidth} и w=${largeWidth} весят одинаково (${probe.small.bytes} B) — ресайз не применяется`
        )
      } else if (probe.small.bytes > probe.large.bytes) {
        add(
          'media.width_invariant',
          `${scope} w=${smallWidth} тяжелее w=${largeWidth} (${probe.small.bytes} B > ${probe.large.bytes} B) — ступени перепутаны`
        )
      }
    }
  }

  const primary = probes[0]

  return {
    family: target.family,
    url: target.url,
    source: target.source,
    knownBroken: knownBroken || null,
    probes: probes.map((probe) => ({
      accept: probe.accept,
      smallBytes: probe.small.bytes,
      largeBytes: probe.large.bytes,
      contentType: getHeaderValue(probe.small.headers, 'content-type'),
      transform: getHeaderValue(probe.small.headers, 'x-metravel-image-transform') || '(нет)',
    })),
    smallBytes: primary?.small.bytes ?? 0,
    largeBytes: primary?.large.bytes ?? 0,
    issues,
  }
}

/**
 * Сколько статей обходит лестничная проверка тела по умолчанию.
 *
 * Обход ПОЛНОЙ лестницы стоит на два порядка дороже прежней проверки: у одной
 * статьи в `media.article_body` до ~300 URL (замер прода 2026-08-05, статья 682),
 * поэтому весь каталог из 397 опубликованных travel — это десятки тысяч запросов,
 * то есть часы. Деплой-гейт берёт выборку, а полный обход запускается явно:
 * `--article-body-scan all`. Сколько статей и ступеней реально проверено, гейт
 * печатает всегда — усечённое покрытие не должно выглядеть как «проверено всё».
 */
const ARTICLE_BODY_SCAN_DEFAULT = 3

/**
 * Параллелизм лестничного обхода: ступеней много, а origin — прод.
 *
 * На 8 прод начинал отвечать 503 `capacity-rejected` (замер 2026-08-05), то есть
 * гейт своей же нагрузкой ронял собственную проверку. Четырёх хватает: 450
 * ступеней проходятся за ~40 с, и backpressure не воспроизводится.
 */
const ARTICLE_BODY_SCAN_CONCURRENCY = 4

/** Значение `--article-body-scan`: число статей, `all`, или `0` — не обходить. */
function articleBodyScanLimit() {
  const raw = String(getArg('article-body-scan', String(ARTICLE_BODY_SCAN_DEFAULT))).trim()
  if (/^all$/i.test(raw)) return Infinity
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : ARTICLE_BODY_SCAN_DEFAULT
}

/** Прогон задач с ограничением параллелизма; порядок результатов сохраняется. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

/** Сколько деталей забираем с одной страницы каталога в поиске ключа `uploads/**`. */
const UPLOADS_SCAN_DETAILS_PER_PAGE = 4

/**
 * Страницы каталога, в которых стоит искать legacy-ключ.
 *
 * «Первые N» тут не работают: у свежих статей `uploads/**` нет вообще (новый
 * пайплайн), у самых старых — тоже. Замер 2026-08-03 по всем 397
 * опубликованным travel: страницы 1–4 и 20 дают 0–2 попадания из 20, а 5–19 —
 * от 50% до 95%. Поэтому берём сечения каталога, а не его край.
 */
function uploadsScanPages(travels) {
  const count = Number(travels?.count ?? travels?.total ?? 0)
  const pageSize = unwrapList(travels).length
  if (!count || !pageSize) return [1]
  const lastPage = Math.max(1, Math.ceil(count / pageSize))
  const candidates = [
    Math.ceil(lastPage / 2),
    Math.ceil(lastPage * 0.75),
    Math.ceil(lastPage * 0.25),
  ]
  return [...new Set(candidates)].filter((page) => page >= 1 && page <= lastPage)
}

/** Детали travel до первой, в теле которой действительно есть ключ `uploads/**`. */
async function collectUploadsScanDetails(softFetch, travels) {
  const details = []
  for (const page of uploadsScanPages(travels)) {
    const list = await softFetch(`${SITE}/api/travels/?page=${page}`)
    const ids = unwrapList(list)
      .map((item) => item?.id)
      .filter(Boolean)
      .slice(0, UPLOADS_SCAN_DETAILS_PER_PAGE)
    const fetched = await Promise.all(ids.map((id) => softFetch(`${SITE}/api/travels/${id}/`)))
    details.push(...fetched.filter(Boolean))

    const found = details.some((item) =>
      collectArticleBodyMediaUrls(unwrapItem(item)).some((url) => toUploadsTarget(SITE, url))
    )
    if (found) break
  }
  return details
}

/**
 * Детали опубликованных travel для лестничного обхода — по порядку каталога.
 *
 * Выборка идёт с первой страницы, а не сечениями, как у `uploads/**`: там искали
 * редкий legacy-класс, здесь — обычные тела статей, и они есть у всех.
 */
async function collectArticleBodyScanDetails(softFetch, travels, limit) {
  if (!limit) return { details: [], scannedTravels: 0, totalTravels: 0 }

  const count = Number(travels?.count ?? travels?.total ?? 0)
  const pageSize = unwrapList(travels).length || 1
  const lastPage = count ? Math.max(1, Math.ceil(count / pageSize)) : 1

  const details = []
  for (let page = 1; page <= lastPage && details.length < limit; page += 1) {
    const list = page === 1 ? travels : await softFetch(`${SITE}/api/travels/?page=${page}`)
    const ids = unwrapList(list).map((item) => item?.id).filter(Boolean)
    if (!ids.length) break
    for (const id of ids) {
      if (details.length >= limit) break
      const detail = await softFetch(`${SITE}/api/travels/${id}/`)
      if (detail) details.push(detail)
    }
  }

  return { details, scannedTravels: details.length, totalTravels: count }
}

/**
 * Лестничный обход тела статей: каждая ступень `srcset` из манифеста (#1261).
 *
 * Возвращает `null`, когда обход выключен (`--article-body-scan 0`), — это видно
 * в отчёте отдельно от «обошли и ничего не нашли».
 */
async function scanArticleBodyLadders(softFetch, travels) {
  const limit = articleBodyScanLimit()
  if (!limit) return null

  const { details, scannedTravels, totalTravels } = await collectArticleBodyScanDetails(
    softFetch,
    travels,
    limit,
  )

  // Дедуп по URL: один и тот же кадр приходит и в `srcset`, и в `srcset_contain`.
  const byUrl = new Map()
  for (const detail of details) {
    for (const rung of collectArticleBodyRungs(unwrapItem(detail))) {
      if (!byUrl.has(rung.url)) byUrl.set(rung.url, rung)
    }
  }
  const rungs = [...byUrl.values()]

  const responses = await mapWithConcurrency(
    rungs,
    ARTICLE_BODY_SCAN_CONCURRENCY,
    async (rung) => {
      try {
        return { rung, response: await fetchMediaResilient(rung.url, BROWSER_IMAGE_ACCEPT) }
      } catch (error) {
        return {
          rung,
          response: { status: 0, bytes: 0, headers: {}, error: error instanceof Error ? error.message : String(error) },
        }
      }
    },
  )

  return {
    ...auditArticleBodyLadder(responses),
    scannedTravels,
    totalTravels,
    checkedRungs: rungs.length,
    // Полным обход считается только когда он реально накрыл весь каталог.
    full: limit === Infinity || scannedTravels >= totalTravels,
  }
}

async function collectTargets() {
  // Молчаливый catch тут опасен: пустой список целей выглядит как «нечего
  // проверять», хотя причина — недоступный API. Причину всегда печатаем.
  const softFetch = (url) =>
    fetchJson(url).catch((error) => {
      console.error(`⚠️  Источник целей недоступен: ${url} — ${error instanceof Error ? error.message : error}`)
      return null
    })

  const [travels, quests] = await Promise.all([
    softFetch(`${SITE}/api/travels/?limit=5`),
    softFetch(`${SITE}/api/quests/?limit=5`),
  ])

  const firstTravel = unwrapList(travels).find((item) => item?.id)
  const travelDetail = firstTravel?.id
    ? await softFetch(`${SITE}/api/travels/${firstTravel.id}/`)
    : null

  const travelDetails = await collectUploadsScanDetails(softFetch, travels)

  const targets = extractTargetsFromPayloads(SITE, { travels, travelDetail, travelDetails, quests })

  if (!targets.some((target) => target.family === 'media-resize-uploads')) {
    // Не ошибка: когда legacy-фото уйдут из тел статей, цели не станет по-честному.
    // Но молчать нельзя — иначе потеря покрытия неотличима от «всё хорошо».
    console.error(
      'ℹ️  Ключей uploads/** в просмотренных статьях нет — цель media-resize-uploads пропущена'
    )
  }

  return { targets, travels, softFetch }
}

function withWidth(url, width) {
  const parsed = new URL(url)
  parsed.searchParams.set('w', String(width))
  return parsed.toString()
}

function printSummary(summary) {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  console.log(`\n📊 Проверено семейств: ${summary.totalTargets}`)
  console.log(`❌ Ошибок: ${summary.errorCount}`)
  console.log(`⚠️  Предупреждений: ${summary.warningCount}`)

  for (const target of summary.targets) {
    const worst = target.issues.some((issue) => issue.severity === 'error')
      ? '✗'
      : target.issues.length > 0
        ? '!'
        : '✅'
    if (worst === '✅' && !VERBOSE) continue
    console.log(`\n${worst} ${target.family} — ${target.url}\n   источник: ${target.source}`)
    const { small: smallWidth, large: largeWidth } = widthsFor(target.family)
    for (const probe of target.probes || []) {
      console.log(
        `   accept=${probe.accept}: w=${smallWidth} ${probe.smallBytes} B · w=${largeWidth} ${probe.largeBytes} B` +
          ` · ${probe.contentType || '(нет)'} · transform: ${probe.transform}`
      )
    }
    for (const issue of target.issues) {
      console.log(`   ${issue.severity === 'error' ? '✗' : '!'} ${issue.code}: ${issue.message}`)
    }
  }

  printArticleBodySummary(summary.articleBody)
}

/** Итог лестничного обхода тела статей (#1261). */
function printArticleBodySummary(articleBody) {
  if (!articleBody) {
    console.log('\nℹ️  Лестничный обход media.article_body выключен (--article-body-scan 0)')
    return
  }

  const { scannedTravels, totalTravels, checkedRungs, families, issues, full } = articleBody
  const coverage = full
    ? `все ${totalTravels || scannedTravels} статей`
    : `${scannedTravels} из ${totalTravels || '?'} статей (выборка; полный обход — --article-body-scan all)`
  console.log(`\n🪜 Лестницы media.article_body: ${checkedRungs} ступеней, ${coverage}`)

  for (const stats of families) {
    const known = WIDTHS_BY_FAMILY.get(stats.family)
    console.log(
      `   ${stats.failed ? '✗' : '✅'} ${stats.family}: ${stats.checked} ступеней, ` +
        `${stats.minWidth}…${stats.maxWidth}` +
        (known ? ` (потолок семейства ${known.large})` : '') +
        (stats.failed ? ` — не 200: ${stats.failed}` : '')
    )
  }

  for (const issue of issues) {
    console.log(`   ${issue.severity === 'error' ? '✗' : '!'} ${issue.code}: ${issue.message}`)
  }
}

async function main() {
  if (!JSON_OUTPUT) {
    console.log(`🖼  Пост-деплой проверка медиа-контракта на ${SITE}`)
    if (ALLOW_KNOWN_BROKEN && KNOWN_BROKEN_FAMILIES.size > 0) {
      console.log(
        `ℹ️  Известные поломки понижены до предупреждений: ${[...KNOWN_BROKEN_FAMILIES.keys()].join(', ')}`
      )
    }
  }

  const { targets, travels, softFetch } = await collectTargets()
  if (targets.length === 0) {
    console.error('❌ Публичный API не отдал ни одного медиа-URL — проверять нечего, гейт считается упавшим')
    process.exit(1)
  }

  const checked = []
  for (const target of targets) {
    try {
      const probes = []
      for (const variant of ACCEPT_VARIANTS) {
        const { small: smallWidth, large: largeWidth } = widthsFor(target.family)
        const masterRule = MASTER_DERIVATIVE_BY_FAMILY.get(target.family)
        const [small, large, master] = await Promise.all([
          fetchMediaResilient(withWidth(target.url, smallWidth), variant.header),
          fetchMediaResilient(withWidth(target.url, largeWidth), variant.header),
          masterRule
            ? fetchMediaResilient(withWidth(target.url, masterRule.width), variant.header)
            : null,
        ])
        probes.push({ accept: variant.id, small, large, ...(master ? { master } : {}) })
      }
      checked.push(validateTarget(target, probes, { allowKnownBroken: ALLOW_KNOWN_BROKEN }))
    } catch (error) {
      checked.push({
        family: target.family,
        url: target.url,
        source: target.source,
        knownBroken: KNOWN_BROKEN_FAMILIES.get(target.family) || null,
        probes: [],
        smallBytes: 0,
        largeBytes: 0,
        issues: [{
          severity: 'error',
          code: 'media.fetch_failed',
          message: error instanceof Error ? error.message : String(error),
        }],
      })
    }
  }

  const articleBody = await scanArticleBodyLadders(softFetch, travels)
  const articleBodyIssues = articleBody?.issues || []

  const summary = {
    site: SITE,
    allowKnownBroken: ALLOW_KNOWN_BROKEN,
    totalTargets: checked.length,
    errorCount:
      checked.reduce(
        (acc, target) => acc + target.issues.filter((issue) => issue.severity === 'error').length,
        0
      ) + articleBodyIssues.filter((issue) => issue.severity === 'error').length,
    warningCount:
      checked.reduce(
        (acc, target) => acc + target.issues.filter((issue) => issue.severity === 'warning').length,
        0
      ) + articleBodyIssues.filter((issue) => issue.severity === 'warning').length,
    targets: checked,
    articleBody,
  }

  printSummary(summary)
  process.exit(summary.errorCount > 0 ? 1 : 0)
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ACCEPT_VARIANTS,
    BROWSER_IMAGE_ACCEPT,
    DEFAULT_WIDTHS,
    KNOWN_BROKEN_FAMILIES,
    MASTER_DERIVATIVE_BY_FAMILY,
    WEBP_ONLY_KEY_FAMILIES,
    WIDTHS_BY_FAMILY,
    legacyKeyExtension,
    widthsFor,
    auditArticleBodyLadder,
    isBackpressureResponse,
    collectArticleBodyMediaUrls,
    collectArticleBodyRungs,
    familyOfMediaUrl,
    isLegacyBucketUrl,
    mapWithConcurrency,
    toTargetUrlWithQuery,
    extractTargetsFromPayloads,
    toLegacyTarget,
    toTargetUrl,
    toUploadsTarget,
    uploadsScanPages,
    unwrapItem,
    unwrapList,
    validateTarget,
    withWidth,
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Пост-деплой проверка медиа-контракта упала:', error)
    process.exit(1)
  })
}
