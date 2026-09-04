#!/usr/bin/env node
/**
 * Миграция картинок в телах статей: legacy-класс `uploads/**` и вставленные
 * base64-кадры (`data:image/...`) → канонический `travel-description-image`
 * (#1245, #1320).
 *
 * ЗАЧЕМ. В телах статей фотография адресуется тремя разными способами: прямой
 * ссылкой на бакет, той же ссылкой в обёртке `images.weserv.nl` (до трёх слоёв) и
 * нашими family-роутами. Класс `uploads/**` при этом мёртвый — durable-производных
 * у него нет, и он держится на объявленном фолбэке `v1_then_master_no_transform`:
 * отдаётся мастер целиком с `no-store` (#1753; прежний обход `f=jpeg` снят).
 * Перезалив в канонический пайплайн решает это в корне: замер прода 2026-08-04 на
 * `travel-description-image/135/description/…JPG` — w=320|800|960|1600 все дают
 * 200 `stored-derivative` в webp.
 *
 * БЕЗОПАСНОСТЬ. Те же рельсы, что в `scripts/seo-edit.js`, и по той же причине:
 * запись идёт в ЖИВЫЕ опубликованные статьи.
 *   1. BACKUP   — полный payload GET на диск до любой записи (`--restore <id>`).
 *   2. VERIFY   — после PUT повторный GET и сверка, что publish/moderation/slug/
 *                 галерея/точки/текст не поехали.
 *   3. ROLLBACK — при регрессии автоматический откат и ненулевой exit.
 * Плюс проверка самих картинок: новый URL обязан отдавать `stored-derivative`.
 *
 * Прод — 1 vCPU, генерация производных на загрузке его нагружает, поэтому работа
 * строго по одной статье с паузами и журналом прогресса.
 *
 * Использование:
 *   node scripts/migrate-description-images.js --inventory
 *   node scripts/migrate-description-images.js --id 430 --dry-run
 *   node scripts/migrate-description-images.js --id 430
 *   node scripts/migrate-description-images.js --restore 430
 *
 * Токен: env METRAVEL_TOKEN или .secrets/mcp_token.json.
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '')
const SITE = API_BASE.replace(/\/api$/, '')
const STATE_DIR = path.join(__dirname, '.migrate-description-images')
const BACKUP_DIR = path.join(STATE_DIR, 'backups')
const INVENTORY_FILE = path.join(STATE_DIR, 'inventory.json')
const JOURNAL_FILE = path.join(STATE_DIR, 'journal.json')
const SHRUNK_FILE = path.join(STATE_DIR, 'shrunk.json')

// ---------------------------------------------------------------------------
// Чистое ядро (экспортируется для тестов)
// ---------------------------------------------------------------------------

const LEGACY_BUCKET = 'metravelprod'
const LEGACY_IMAGE_EXTENSIONS = new Set(['gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp'])

/**
 * Разворачивает цепочку `images.weserv.nl/?url=…` до исходного адреса.
 *
 * Зеркало `unwrapWeservImageUrl` из `utils/weservImageUrl.ts`: гейт и скрипты —
 * CommonJS и TS-утилиту не импортируют, ровно как `scripts/post-deploy-media-check.js`.
 * В телах встречается до трёх слоёв, поэтому разворачиваем до неподвижной точки.
 */
function unwrapWeserv(url) {
  let current = String(url || '').trim()
  // Лимит с большим запасом: в статье 175 обёртки вложены ДЕВЯТЬ раз подряд
  // (src длиной 555 символов), и прежний предел в 8 итераций недокручивал ровно
  // на один слой — пятнадцать фотографий выглядели как «не наш класс» и молча
  // проходили мимо миграции. Раскрутка стоит копейки, а недокрут стоит картинки.
  for (let i = 0; i < 24; i += 1) {
    if (!/images\.weserv\.nl/i.test(current)) return current
    let next = null
    try {
      const parsed = new URL(current.startsWith('//') ? `https:${current}` : current)
      next = parsed.searchParams.get('url')
    } catch {
      return current
    }
    if (!next) return current
    let decoded = next
    try {
      decoded = decodeURIComponent(next)
    } catch {
      /* уже раскодировано */
    }
    if (!/^https?:\/\//i.test(decoded)) decoded = `https://${decoded.replace(/^\/+/, '')}`
    if (decoded === current) return current
    current = decoded
  }
  return current
}

/** Ключ объекта в нашем бакете для класса `uploads/**`, иначе `null`. */
function legacyUploadKey(url) {
  const value = unwrapWeserv(url)
  if (!value || /^(data:|blob:)/i.test(value)) return null
  let parsed
  try {
    parsed = new URL(value.replace(/&amp;/gi, '&'))
  } catch {
    return null
  }
  const host = parsed.hostname.toLowerCase()
  const isBucketHost =
    new RegExp(`^${LEGACY_BUCKET}\\.s3(?:[.-][a-z0-9-]+)*\\.amazonaws\\.com$`, 'i').test(host)
  const isFirstParty = host === 'metravel.by' || host.endsWith('.metravel.by')

  let key = parsed.pathname.replace(/^\/+/, '')
  if (isFirstParty) {
    // Наш прокси-путь того же класса: `/media-resize/uploads/<key>`.
    const m = /^media-resize\/(uploads\/.+)$/i.exec(key)
    if (!m) return null
    key = m[1]
  } else if (!isBucketHost) {
    return null
  }

  let decoded
  try {
    decoded = decodeURIComponent(key)
  } catch {
    return null
  }
  const parts = decoded.split('/')
  if (parts[0] !== 'uploads' || parts.length < 2) return null
  if (parts.some((part) => !part || part === '.' || part === '..')) return null
  const ext = String(parts[parts.length - 1].split('.').pop() || '').toLowerCase()
  if (!LEGACY_IMAGE_EXTENSIONS.has(ext)) return null
  return key
}

/**
 * Все `src` тела, ведущие в класс `uploads/**`.
 *
 * Возвращает `{ raw, key }`: `raw` — ровно та строка, что стоит в HTML (голая
 * ссылка либо weserv-обёртка), её и надо будет заменить; `key` — ключ в бакете,
 * по нему скачиваем байты. Один ключ может встретиться несколько раз и в разных
 * обёртках, поэтому дедуплицируем по `raw`.
 */
function collectLegacyUploadRefs(html) {
  const out = new Map()
  const source = String(html || '')
  const pattern = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = pattern.exec(source)) !== null) {
    const raw = match[1]
    const key = legacyUploadKey(raw.replace(/&amp;/gi, '&'))
    if (key && !out.has(raw)) out.set(raw, { raw, key })
  }
  return Array.from(out.values())
}

/**
 * Все `src` тела, в которых лежит сам кадр (`data:image/...;base64,…`), а не адрес.
 *
 * Такой источник вреден дважды. Он раздувает саму запись, и он раздувает
 * media-конверт: бэкенд подставляет строку в каждое поле адреса — восемь ступеней
 * `variants`, по шесть записей в `srcset` и `srcset_contain`, плюс `src`/`src_contain`.
 * Замер прода 2026-08-08 (#1319/#1320): блоб 2 521 255 Б в статье 512 дал 55,5 МБ
 * в `media.article_body` и страницу 40 МБ по проводу против 58 КБ у обычной статьи.
 *
 * Гард на вставку в редакторе уже стоит (`QuillEditor.web.tsx`, `resolvePastePayload`),
 * поэтому здесь речь только о легаси-записях, сделанных до него.
 *
 * Форма результата такая же, как у `collectLegacyUploadRefs`, чтобы дальше обе
 * ветки шли одним конвейером: `raw` — строка для замены, `key` — человекочитаемая
 * метка для журнала (бакетного ключа у этого источника нет).
 */
function collectDataUriRefs(html) {
  const out = new Map()
  const source = String(html || '')
  const pattern = /<img\b[^>]*?\bsrc=["'](data:image\/[^"']+)["'][^>]*>/gi
  let match
  let index = 0
  while ((match = pattern.exec(source)) !== null) {
    const raw = match[1]
    if (out.has(raw)) continue
    index += 1
    const mime = (/^data:(image\/[a-z0-9.+-]+)/i.exec(raw) || [])[1] || 'image/*'
    out.set(raw, { raw, key: `data-uri#${index} (${mime}, ${raw.length} B)`, dataUri: true })
  }
  return Array.from(out.values())
}

/**
 * Кадр из `data:`-строки — та же форма, что отдаёт `downloadMaster`.
 *
 * Формат берём по сигнатуре байтов, а не по MIME из самой строки: он объявляется
 * автором вставки и врёт ровно так же часто, как расширение в legacy-ключах.
 */
function decodeDataUri(raw, detect = detectImageFormat) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([\s\S]+)$/i.exec(String(raw || '').trim())
  if (!match) throw new Error('data-uri: поддерживается только base64-форма')
  const buffer = Buffer.from(match[1].replace(/\s+/g, ''), 'base64')
  if (!buffer.length) throw new Error('data-uri: пустой кадр после декодирования')
  const detected = detect(buffer)
  if (!detected) throw new Error('data-uri: не распознан формат кадра')
  return {
    buffer,
    contentType: detected.mime,
    filename: `description-image.${detected.ext}`,
  }
}

/**
 * Лестница ширин, которые обслуживает прокси.
 *
 * Зеркало `DIMENSION_LADDER` из `utils/imageProxy.ts` — по той же причине, что и
 * `unwrapWeserv`: скрипты CommonJS и TS-утилиту не импортируют. Источник правды у
 * обоих один — `ALLOWED_IMAGE_WIDTHS` бэкенда (`GET /api/media/proxy-contract`).
 */
const PROXY_WIDTH_LADDER = [32, 96, 160, 320, 480, 640, 720, 800, 960, 1024, 1200, 1280, 1600, 1920, 2500]

/**
 * Порог «кадр раздут»: байт на пиксель, выше которого файл хранится с избыточным
 * качеством.
 *
 * Замер прода 2026-08-08 по телам статей: здоровые кадры лежат на 0,11–0,20 Б/px
 * (`5893ec1a…` 800×1067 — 94 078 B = 0,110; `bdbef1ba…` 1126×234 — 15 350 B =
 * 0,058), раздутые — на 0,26–0,40 (`247b89ab…` 768×1024 — 317 486 B = 0,404;
 * `0e0d0ee6…` 600×800 — 126 632 B = 0,264). Порог 0,25 разделяет эти две группы и
 * оставляет здоровые файлы нетронутыми.
 */
const OVERSIZED_BYTES_PER_PIXEL = 0.25

/**
 * Ширина, на которой прокси реально пережмёт кадр: ближайшая ступень СТРОГО ниже
 * его собственной ширины.
 *
 * Просить ступень ≥ ширины кадра бесполезно: прокси не апскейлит и отдаёт файл
 * байт-в-байт, игнорируя даже `q`. Замер на `247b89ab…` (768×1024): `w=800`,
 * `w=960`, `w=1600` — все 317 486 B, то есть сам мастер; `w=720` — 112 602 B при
 * той же резкости (разница краёв 7123 против 7391 у локального ресайза). Именно
 * этот вариант и кладётся обратно как новый файл.
 */
function shrinkWidthFor(width) {
  const w = Number(width)
  if (!Number.isFinite(w) || w <= 0) return null
  let best = null
  for (const rung of PROXY_WIDTH_LADDER) {
    if (rung < w) best = rung
  }
  return best
}

/** Плотность файла в байтах на пиксель, либо `null` — геометрия неизвестна. */
function bytesPerPixel(bytes, width, height) {
  const area = Number(width) * Number(height)
  if (!Number.isFinite(area) || area <= 0) return null
  return Number(bytes) / area
}

/**
 * Кадр стоит пересайзить: он раздут И у прокси есть ступень ниже его ширины.
 *
 * Второе условие обязательно. Кадр 320×240 может быть сколь угодно плотным, но
 * ступени ниже 320 — это 160, и такой пересайз уже видно на глаз; такие кадры
 * пропускаем, а не портим.
 */
function isOversizedFrame({ bytes, width, height }, threshold = OVERSIZED_BYTES_PER_PIXEL) {
  const density = bytesPerPixel(bytes, width, height)
  if (density == null || density <= threshold) return false
  const target = shrinkWidthFor(width)
  return target != null && target >= 320
}

/**
 * Все `src` тела, ведущие в канонический класс `travel-description-image`.
 *
 * Это картинки, уже прошедшие миграцию (#1245/#1320): ни legacy-ключа, ни
 * base64. Для них ветка `--shrink` и работает — она меняет не адресацию, а сам
 * хранимый файл.
 */
function collectCanonicalRefs(html) {
  const out = new Map()
  const source = String(html || '')
  const pattern = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = pattern.exec(source)) !== null) {
    const raw = match[1]
    const decoded = raw.replace(/&amp;/gi, '&')
    if (/^(data:|blob:)/i.test(decoded)) continue
    let pathname
    try {
      pathname = new URL(decoded, SITE).pathname
    } catch {
      continue
    }
    if (!/^\/travel-description-image\/[^/]+$/i.test(pathname)) continue
    // `raw` — строка для замены в HTML, `url` — абсолютный адрес для сети: в теле
    // встречается и корне-относительная форма, а её `new URL(...)` без базы не берёт.
    if (!out.has(raw)) {
      out.set(raw, { raw, url: new URL(decoded, SITE).toString(), key: pathname.replace(/^\/+/, ''), pathname })
    }
  }
  return Array.from(out.values())
}

/**
 * Геометрия кадров по манифесту `media.article_body`: pathname → `{width,height}`.
 *
 * Размеры берём из манифеста, а не парсим заголовки файла: бэкенд их уже посчитал
 * и они сходятся с реальными байтами (сверка 2026-08-08 на трёх кадрах статьи 485
 * — 600×800, 800×1067, 1126×234 совпали с загруженными файлами).
 */
function buildManifestGeometry(payload) {
  const gallery = payload?.media?.article_body?.gallery
  const index = new Map()
  if (!Array.isArray(gallery)) return index
  for (const item of gallery) {
    const src = String(item?.src || '').trim()
    if (!src || !Number(item?.width) || !Number(item?.height)) continue
    try {
      index.set(new URL(src, SITE).pathname, { width: Number(item.width), height: Number(item.height) })
    } catch {
      /* адрес манифеста не разобрался — кадр просто не участвует */
    }
  }
  return index
}

/** Текст без разметки — для сверки, что миграция не тронула содержание. */
function plainText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Число `<img>` в теле — обязано совпасть до и после. */
function countImages(html) {
  return (String(html || '').match(/<img\b/gi) || []).length
}

module.exports = {
  unwrapWeserv,
  legacyUploadKey,
  collectLegacyUploadRefs,
  collectDataUriRefs,
  collectCanonicalRefs,
  buildManifestGeometry,
  shrinkWidthFor,
  bytesPerPixel,
  isOversizedFrame,
  decodeDataUri,
  plainText,
  countImages,
  upgradeFirstPartyProtocol,
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

function readToken() {
  if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN.trim()
  const file = path.join(__dirname, '..', '.secrets', 'mcp_token.json')
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (parsed && parsed.token) return String(parsed.token).trim()
    } catch {
      /* ниже */
    }
  }
  console.error('ERROR: нет METRAVEL_TOKEN и .secrets/mcp_token.json')
  process.exit(1)
}

/**
 * GET/PUT к API с теми же повторами, что и у сетевых операций с картинками.
 *
 * Это был последний незакрытый путь: повторы стояли на `fetch` (скачивание,
 * загрузка, пробы), а вызовы через `https.request` — нет. Прогон 2026-08-04 встал
 * на статье 395 с `read ECONNRESET`, хотя запись прошла и данные оказались целы:
 * оборвался уже проверочный GET. Идемпотентность соблюдена — повторный PUT
 * отправляет то же описание, что и первый.
 */
function request(method, urlPath, body, token) {
  return withRetry(`${method} ${urlPath}`, () => requestOnce(method, urlPath, body, token))
}

function requestOnce(method, urlPath, body, token) {
  const url = urlPath.startsWith('http') ? urlPath : `${API_BASE}${urlPath}`
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null
    const headers = { Accept: 'application/json' }
    // DRF TokenAuthentication: схема `Token`, не `Bearer` (как в seo-edit.js).
    if (token) headers.Authorization = `Token ${token}`
    if (payload) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = payload.length
    }
    const req = https.request(url, { method, headers, timeout: 60000 }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout ${method} ${url}`)) })
    if (payload) req.write(payload)
    req.end()
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function ensureDirs() {
  for (const dir of [STATE_DIR, BACKUP_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

/** Полный список статей из пагинированного листинга. */
async function listAllTravels(token) {
  const items = []
  let next = '/travels/?perPage=100'
  while (next) {
    const { status, text } = await request('GET', next, null, token)
    if (status !== 200) throw new Error(`листинг → HTTP ${status}`)
    const page = JSON.parse(text)
    items.push(...(page.results || []))
    next = page.next || null
    if (next) await sleep(200)
  }
  return items
}

/**
 * Обход всех статей: сохраняем payload (это и есть бэкап на случай отката) и
 * считаем, сколько legacy-ключей в теле.
 */
async function runInventory(token) {
  ensureDirs()
  const list = await listAllTravels(token)
  console.log(`📚 Статей в листинге: ${list.length}`)

  const inventory = []
  let withLegacy = 0
  let totalRefs = 0

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i]
    const { status, text } = await request('GET', `/travels/${item.id}/`, null, token)
    if (status !== 200) {
      console.log(`  ! ${item.id} ${item.slug} → HTTP ${status}, пропуск`)
      continue
    }
    const detail = JSON.parse(text)
    fs.writeFileSync(path.join(BACKUP_DIR, `${item.id}.json`), JSON.stringify(detail, null, 2))

    const refs = collectLegacyUploadRefs(detail.description || '')
    if (refs.length) {
      withLegacy += 1
      totalRefs += refs.length
    }
    inventory.push({
      id: item.id,
      slug: item.slug,
      user: item.user ?? null,
      userName: item.userName ?? null,
      publish: detail.publish ?? null,
      images: countImages(detail.description || ''),
      legacyRefs: refs.length,
      keys: refs.map((r) => r.key),
    })

    if ((i + 1) % 25 === 0) console.log(`  … ${i + 1}/${list.length}`)
    await sleep(150)
  }

  fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inventory, null, 2))

  const byAuthor = new Map()
  for (const row of inventory) {
    if (!row.legacyRefs) continue
    const key = `${row.user ?? '?'} ${row.userName ?? ''}`.trim()
    byAuthor.set(key, (byAuthor.get(key) || 0) + row.legacyRefs)
  }

  console.log('')
  console.log(`📊 Статей с legacy uploads/**: ${withLegacy} из ${inventory.length}`)
  console.log(`🖼  Ссылок на миграцию:        ${totalRefs}`)
  console.log(`🔑 Уникальных ключей:         ${new Set(inventory.flatMap((r) => r.keys)).size}`)
  console.log('')
  console.log('По авторам (ссылок):')
  for (const [author, count] of [...byAuthor.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${author}`)
  }
  console.log('')
  console.log(`💾 Бэкапы payload:  ${BACKUP_DIR}`)
  console.log(`📄 Инвентарь:       ${INVENTORY_FILE}`)
}

// ---------------------------------------------------------------------------
// Миграция одной статьи
// ---------------------------------------------------------------------------

// Рельсы записи переиспользуем, а не копируем: `buildUpsertPayload` эхом
// возвращает все реальные поля detail и меняет только описание, `detectRegression`
// ловит слетевшую публикацию/модерацию/slug/галерею/точки. Оба обкатаны на 78
// правках живых статей — своя копия разъехалась бы с ними на первой же доработке.
const { buildUpsertPayload, detectRegression, backupFileName, latestBackup } = require('./seo-edit')

/**
 * Повтор сетевой операции с нарастающей паузой.
 *
 * На прогоне в тысячи файлов транзиентный обрыв — не исключение, а данность:
 * прогон 2026-08-04 упал на статье 160 с `fetch failed`, хотя обе её картинки
 * при ручной пробе отдавались за 0.6–1.5 с. Без повторов такой сбой останавливал
 * бы очередь на ровном месте. Ошибки протокола (4xx/5xx с телом) сюда не попадают —
 * их бросают вызывающие функции, и они обязаны останавливать прогон.
 */
async function withRetry(label, fn, attempts = 5) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const message = error && error.message ? error.message : String(error)
      // 502/503/504 — это НЕ отказ, а перегрузка: прод держит один vCPU и нарезает
      // шесть производных на каждую загрузку, так что под нашим же прогоном он
      // временами отвечает Bad Gateway. Прогон 2026-08-04 встал на статье 207 с 502,
      // хотя ровно та же картинка сразу после этого отдавалась 200 три раза подряд.
      // Постоянные ошибки (4xx, битый ответ) сюда не попадают и обязаны остановить
      // очередь.
      const transient =
        /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|timeout/i.test(message) ||
        /HTTP (502|503|504)\b/.test(message)
      if (!transient || attempt === attempts) throw error
      // Под перегрузку нужен отступ длиннее, чем под обрыв сокета: если торопиться,
      // повтор придётся ровно в тот же затор.
      const overloaded = /HTTP (502|503|504)\b/.test(message)
      const backoff = (overloaded ? 5000 : 1000) * 2 ** (attempt - 1)
      console.log(`   ↻ ${label}: ${message}; повтор ${attempt}/${attempts - 1} через ${backoff} мс`)
      await sleep(backoff)
    }
  }
  throw lastError
}

/**
 * Настоящий формат кадра — по сигнатуре файла, а не по расширению ключа.
 *
 * В legacy-загрузках имя и содержимое расходятся: в статье 382 пять файлов
 * названы `.png`, а внутри JPEG, и сам роут отдаёт им `content-type: image/png`,
 * потому что выводит его из расширения. Загрузка с таким именем справедливо
 * отвергается бэкендом — `Image extension does not match file contents`.
 * Поэтому имя и MIME для upload'а строим по содержимому.
 */
function detectImageFormat(buffer) {
  const head = buffer.subarray(0, 12)
  if (head[0] === 0xff && head[1] === 0xd8) return { ext: 'jpg', mime: 'image/jpeg' }
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' }
  }
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' }
  }
  if (head.subarray(0, 3).toString('latin1') === 'GIF') return { ext: 'gif', mime: 'image/gif' }
  return null
}

/** Мастер legacy-картинки. Только эта ширина у класса и отвечает 200 (#1244). */
async function downloadMaster(key) {
  const url = `${SITE}/media-resize/${key}?w=1920`
  return withRetry(`скачивание ${key}`, async () => {
    const res = await fetch(url, { headers: { Accept: 'image/*,*/*' } })
    if (!res.ok) throw new Error(`скачивание ${key} → HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    if (!buffer.length) throw new Error(`скачивание ${key} → пустой ответ`)

    const rawName = decodeURIComponent(key.split('/').pop() || 'photo.jpg')
    const detected = detectImageFormat(buffer)
    if (!detected) throw new Error(`скачивание ${key} → не распознан формат кадра`)

    // Имя приводим к настоящему формату: расширение из ключа врёт достаточно часто,
    // чтобы на это нельзя было опираться.
    const filename = `${rawName.replace(/\.[^.]+$/, '')}.${detected.ext}`
    return { buffer, contentType: detected.mime, filename }
  })
}

/**
 * Кадр тела по его собственному адресу: без `w` — хранимый файл, с `w` — ступень.
 *
 * Отдельная функция от `downloadMaster`: тот ходит в `/media-resize/<key>` и нужен
 * legacy-классу, а здесь адрес уже канонический и лежит прямо в теле статьи.
 */
async function downloadFrame(url, width = null) {
  const target = new URL(url)
  if (width) target.searchParams.set('w', String(width))
  const label = `${width ? `w=${width}` : 'мастер'} ${target.pathname.split('/').pop()}`
  return withRetry(`скачивание ${label}`, async () => {
    const res = await fetch(target.toString(), {
      headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
    })
    if (res.status >= 500) throw new Error(`скачивание ${label} → HTTP ${res.status}`)
    if (!res.ok) throw new Error(`скачивание ${label} → HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    if (!buffer.length) throw new Error(`скачивание ${label} → пустой ответ`)
    const detected = detectImageFormat(buffer)
    if (!detected) throw new Error(`скачивание ${label} → не распознан формат кадра`)
    const rawName = decodeURIComponent(target.pathname.split('/').pop() || 'photo.jpg')
    return {
      buffer,
      contentType: detected.mime,
      filename: `${rawName.replace(/\.[^.]+$/, '')}.${detected.ext}`,
    }
  })
}

/**
 * Загрузка в канонический пайплайн — ровно теми полями, что шлёт редактор статьи
 * (`components/article/articleEditorMediaHelpers.ts`): `file`, `collection=description`,
 * `id`. Ответ отдаёт адрес в одном из четырёх полей, как разбирает
 * `extractArticleEditorUploadUrl`.
 */
async function uploadDescriptionImage(travelId, file, token) {
  // Повтор загрузки при обрыве может оставить в бакете лишний объект, если первая
  // попытка всё же дошла. Это безвредный мусор (чистится по журналу), и он дешевле
  // остановленной очереди на пять тысяч файлов.
  const text = await withRetry(`загрузка ${file.filename}`, async () => {
    const form = new FormData()
    form.append('file', new Blob([file.buffer], { type: file.contentType }), file.filename)
    form.append('collection', 'description')
    form.append('id', String(travelId))

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
      body: form,
    })
    const body = await res.text()
    if (!res.ok) throw new Error(`upload → HTTP ${res.status}: ${body.slice(0, 200)}`)
    return body
  })

  let payload = {}
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`upload → не JSON: ${text.slice(0, 200)}`)
  }
  const url = payload.url || payload?.data?.url || payload.path || payload.file_url
  if (!url) throw new Error(`upload → в ответе нет url: ${text.slice(0, 200)}`)
  const absolute = String(url).startsWith('http')
    ? String(url)
    : `${SITE}/${String(url).replace(/^\/+/, '')}`
  // Бэкенд отвечает `http://metravel.by/…`. В тело статьи это класть нельзя:
  // страница отдаётся по https, и такая картинка — mixed content. Фронт протокол
  // апгрейдит на лету, но в БД должен лежать сразу правильный адрес: тот же HTML
  // читают краулеры и пререндер, где нашей нормализации нет.
  return upgradeFirstPartyProtocol(absolute)
}

/** `http://` → `https://` для наших доменов; чужие адреса не трогаем. */
function upgradeFirstPartyProtocol(value) {
  return String(value || '').replace(
    /http:\/\/((?:cdn\.|api\.)?metravel\.by)/gi,
    'https://$1',
  )
}

/**
 * Новый адрес обязан отдавать ПРОИЗВОДНУЮ, а не мастер и не динамический ресайз —
 * иначе миграция не решила задачу, а только переставила ссылку.
 */
async function verifyCanonical(url) {
  const problems = []
  for (const width of [320, 800, 1600]) {
    const probe = new URL(url)
    probe.searchParams.set('w', String(width))
    probe.searchParams.set('q', '80')
    probe.searchParams.set('fit', 'contain')
    let res
    try {
      res = await withRetry(`проба w=${width}`, async () => {
        const response = await fetch(probe.toString(), {
          headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
        })
        // 5xx приходит УСПЕШНЫМ fetch'ем, поэтому без явного throw повтор не
        // срабатывал: прогон 2026-08-04 на статье 192 получил 502 на всех 39 пробах
        // подряд (13 картинок × 3 ступени сразу после 13 загрузок) и счёл корректную
        // миграцию провалом. Бросаем, чтобы перегрузка уходила в backoff.
        if (response.status >= 500) throw new Error(`проба → HTTP ${response.status}`)
        return response
      })
    } catch (error) {
      problems.push(`w=${width} → ${error.message} (проверить не удалось)`)
      continue
    }
    const mode = res.headers.get('x-metravel-image-transform') || '(нет)'
    if (res.status !== 200) problems.push(`w=${width} → HTTP ${res.status}`)
    else if (!/stored-derivative/i.test(mode)) problems.push(`w=${width} → mode="${mode}"`)
    // Пробы идут сразу после пачки загрузок, каждая из которых уже заставила прод
    // нарезать шесть производных. Без паузы мы сами создаём тот затор, который потом
    // читаем как ошибку.
    await sleep(200)
  }
  return problems
}

async function migrateOne(id, { token, dryRun }) {
  ensureDirs()
  const { status, text } = await request('GET', `/travels/${id}/`, null, token)
  if (status !== 200) throw new Error(`GET travel ${id} → HTTP ${status}`)
  const before = JSON.parse(text)
  const original = before.description || ''

  const dataUriRefs = collectDataUriRefs(original)
  const refs = [...collectLegacyUploadRefs(original), ...dataUriRefs]
  const httpRefs = (original.match(/http:\/\/(?:cdn\.|api\.)?metravel\.by/gi) || []).length
  console.log(
    `📄 [${id}] ${before.slug} — картинок в теле ${countImages(original)}, из них legacy ${refs.length - dataUriRefs.length}` +
      (dataUriRefs.length ? `, base64 ${dataUriRefs.length}` : '') +
      (httpRefs ? `, http-ссылок ${httpRefs}` : ''),
  )
  if (!refs.length && !httpRefs) {
    console.log('   нечего мигрировать (идемпотентность: уже мигрирована либо legacy не было)')
    return { id, status: 'skipped' }
  }

  if (dryRun) {
    for (const ref of refs) console.log(`   • ${ref.key}`)
    if (httpRefs) console.log(`   • апгрейд протокола у ${httpRefs} ссылок`)
    console.log('   --dry-run: ничего не записано')
    return { id, status: 'dry-run', refs: refs.length, httpRefs }
  }

  // Бэкап ДО любой записи — тем же именем и форматом, что у seo-edit.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, backupFileName(id, stamp))
  fs.writeFileSync(backupPath, JSON.stringify(before, null, 2))
  console.log(`   💾 бэкап: ${path.basename(backupPath)}`)

  let next = original
  const uploaded = []
  for (const ref of refs) {
    // Легаси-ссылку надо скачать, base64 уже несёт кадр в себе — дальше конвейер общий.
    const file = ref.dataUri ? decodeDataUri(ref.raw) : await downloadMaster(ref.key)
    const url = await uploadDescriptionImage(id, file, token)
    // Заменяем ВСЕ вхождения именно этой строки: один и тот же кадр может стоять
    // в теле несколько раз, в том числе в разных weserv-обёртках.
    next = next.split(ref.raw).join(url)
    uploaded.push({ key: ref.key, url, bytes: file.buffer.length })
    console.log(`   ↑ ${ref.key} → ${url.replace(SITE, '')} (${file.buffer.length} B)`)
    // 1 с между картинками, а не 0.4: каждая загрузка тянет за собой нарезку шести
    // производных на единственном vCPU, и на статьях с 30+ фото прежний темп
    // выбивал из прода 502 (статья 207).
    await sleep(1000)
  }

  // Заодно чиним протокол у наших адресов, уже лежащих в теле: http-картинка на
  // https-странице блокируется браузером как mixed content.
  next = upgradeFirstPartyProtocol(next)

  // Инварианты содержания: миграция меняет ТОЛЬКО адреса.
  if (countImages(next) !== countImages(original)) {
    throw new Error(`число <img> изменилось: ${countImages(original)} → ${countImages(next)}`)
  }
  // Текст сравниваем, применив апгрейд протокола к ОБЕИМ версиям: это единственное
  // изменение содержания, которое миграции разрешено. В телах встречаются видимые
  // ссылки на свои же статьи, набранные текстом (`http://metravel.by/travels/…` —
  // 6 штук в статье 447), и апгрейд их правит: https-версия избавляет читателя от
  // редиректа, а страницу — от смешанного содержимого. Всё остальное расхождение
  // означает, что замена задела текст, и это повод остановиться.
  if (plainText(next) !== plainText(upgradeFirstPartyProtocol(original))) {
    throw new Error('текст статьи изменился — миграция обязана трогать только адреса')
  }
  if (collectLegacyUploadRefs(next).length) {
    throw new Error('в теле остались legacy-ссылки после замены')
  }
  if (collectDataUriRefs(next).length) {
    throw new Error('в теле остались base64-кадры после замены')
  }

  const payload = buildUpsertPayload(before, { description: next })
  const put = await request('PUT', '/travels/upsert/', payload, token)
  console.log(`   PUT /travels/upsert/ → HTTP ${put.status}`)
  if (put.status < 200 || put.status >= 300) {
    throw new Error(`PUT → HTTP ${put.status}: ${put.text.slice(0, 300)}`)
  }

  await sleep(1000)
  const after = JSON.parse((await request('GET', `/travels/${id}/`, null, token)).text)

  // Регрессия ДАННЫХ — единственное основание для отката. Если слетела публикация,
  // slug, галерея или точки, старое описание надо вернуть немедленно.
  const regressions = detectRegression(before, after, { expectChanged: true, newDescription: next })
  if (regressions.length) {
    console.error(`   ❌ регрессия данных: ${regressions.join('; ')}`)
    const rollback = await request('PUT', '/travels/upsert/', buildUpsertPayload(before, { description: original }), token)
    console.error(`   ↩︎ откат PUT → HTTP ${rollback.status}`)
    throw new Error(`статья ${id} откачена: ${regressions.join('; ')}`)
  }

  // Провал ПРОБ — это «не смогли проверить», а не «мигрировали плохо», и откатывать
  // по нему нельзя. Прогон 2026-08-04 на статье 192 показал цену смешения: пробы
  // получили 502 от перегруженного прода, скрипт попытался откатить корректную
  // миграцию, и спасло только то, что откат тоже упал на 502. Данные к этому моменту
  // уже прошли инварианты содержания и `detectRegression`; останавливаемся, чтобы
  // человек перепроверил, но написанное не трогаем.
  const probeProblems = []
  for (const upload of uploaded) {
    probeProblems.push(...(await verifyCanonical(upload.url)).map((p) => `${upload.key}: ${p}`))
  }
  if (probeProblems.length) {
    console.error(`   ⚠️  записано, но проверить не удалось: ${probeProblems.slice(0, 6).join('; ')}`)
    throw new Error(
      `статья ${id}: описание записано и данные целы, но ${probeProblems.length} проб не прошли — ` +
        'откат НЕ делался, проверьте вручную',
    )
  }

  console.log(`   ✅ мигрировано ${uploaded.length}, все ступени отдают stored-derivative`)
  return { id, status: 'done', migrated: uploaded.length }
}

/**
 * Пересайз раздутых кадров тела: тот же снимок, но хранимый файл заменён на
 * пережатую прокси-ступень.
 *
 * ЗАЧЕМ. Ресайз в теле статьи работает — `srcset` собирается из манифеста, ступени
 * отвечают 200. Но кадры там узкие: у статьи 485 таких 51 из 52, у 470 — 250 из 251
 * (мастер ≤ 800 px). Любая запрошенная ширина ≥ ширины кадра возвращает файл
 * байт-в-байт, поэтому на десктопе @DPR2 браузер берёт верхнюю ступень и получает
 * мастер. Уменьшить вес можно только уменьшив сам файл — и лучше всего это делает
 * тот же прокси: `247b89ab…` 768×1024 хранится как 317 486 B, а его `w=720` весит
 * 112 602 B при сопоставимой резкости.
 *
 * Перезалив кадра БЕЗ изменения ширины бесполезен: пайплайн загрузки не пережимает
 * то, что уже уже потолка. Проверено 2026-08-08 — тот же файл, загруженный заново,
 * дал 315 088 B вместо 317 486 B и ту же лестницу.
 *
 * ГРАНИЦА ПРИМЕНИМОСТИ (2026-08-09). Ветка опирается на ресайз в момент запроса, а
 * он переходный: `docs/features/images.md` §1.3 — производные обязаны лежать
 * готовыми (#1136, #1168). Отсюда два следствия, из-за которых массовую раскатку
 * делать НЕ надо:
 *
 * 1. Выигрыш живёт только там, где ступень совпадает с мастером. На ступенях,
 *    которые останутся после перехода на предгенерацию, разница мизерная: у
 *    пилотного кадра `w=640` дал 216 230 B до пересайза и 194 682 B после — 10 %,
 *    против 44 % на «ступени = мастер».
 * 2. Целевую тяжесть даёт не ширина мастера, а параметры производной. Динамическая
 *    ступень 640 кодируется с q85 (совпадает побайтово с локальным webp q85), тогда
 *    как durable-производная того же размера у обложки весит 91 256 B против
 *    216 230 B у тела статьи.
 *
 * То есть «большие картинки в теле» закрываются предгенерацией (#1200/#1201), а эта
 * ветка остаётся точечным инструментом на время, пока динамический путь ещё жив.
 *
 * Рельсы безопасности общие с `migrateOne`: бэкап payload до записи, инварианты
 * содержания, `detectRegression` с автооткатом, пробы отдельно от отката.
 */
async function shrinkOne(id, { token, dryRun, threshold = OVERSIZED_BYTES_PER_PIXEL }) {
  ensureDirs()
  const { status, text } = await request('GET', `/travels/${id}/`, null, token)
  if (status !== 200) throw new Error(`GET travel ${id} → HTTP ${status}`)
  const before = JSON.parse(text)
  const original = before.description || ''

  const geometry = buildManifestGeometry(before)
  const refs = collectCanonicalRefs(original)
  const shrunkAlready = readShrunk()
  console.log(
    `📄 [${id}] ${before.slug} — картинок в теле ${countImages(original)}, канонических ${refs.length}, геометрия известна у ${geometry.size}`,
  )

  // Замер ДО любой записи: раздут кадр или нет, видно только по байтам мастера.
  const targets = []
  for (const ref of refs) {
    // Один кадр пересайзится РОВНО ОДИН раз. Порог для этого не годится: замер
    // после пилота на статье 512 показал, что `454947d3…` ушёл с 0,466 на 0,274 —
    // всё ещё выше порога, и второй прогон ужал бы его до 640, третий до 480.
    // Журнал новых ключей — единственное, что делает прогон идемпотентным.
    if (shrunkAlready.includes(ref.pathname)) {
      console.log(`   ✓ ${ref.key} — уже пересайжен, пропуск`)
      continue
    }
    const geo = geometry.get(ref.pathname)
    if (!geo) {
      console.log(`   ? ${ref.key} — нет в манифесте, пропуск`)
      continue
    }
    const master = await downloadFrame(ref.url)
    const density = bytesPerPixel(master.buffer.length, geo.width, geo.height)
    const frame = { bytes: master.buffer.length, width: geo.width, height: geo.height }
    const shrinkTo = shrinkWidthFor(geo.width)
    const oversized = isOversizedFrame(frame, threshold)
    console.log(
      `   ${oversized ? '•' : ' '} ${ref.key} ${geo.width}×${geo.height} ${master.buffer.length} B ` +
        `(${density.toFixed(3)} Б/px)${oversized ? ` → w=${shrinkTo}` : ' — в норме'}`,
    )
    if (oversized) targets.push({ ref, geo, shrinkTo, beforeBytes: master.buffer.length })
    await sleep(400)
  }

  if (!targets.length) {
    console.log('   нечего пересайзить: все кадры в пределах порога')
    return { id, status: 'skipped' }
  }

  if (dryRun) {
    const total = targets.reduce((sum, t) => sum + t.beforeBytes, 0)
    console.log(`   --dry-run: пересайзу подлежат ${targets.length} кадров, сейчас ${total} B`)
    return { id, status: 'dry-run', targets: targets.length, bytes: total }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, backupFileName(id, stamp))
  fs.writeFileSync(backupPath, JSON.stringify(before, null, 2))
  console.log(`   💾 бэкап: ${path.basename(backupPath)}`)

  let next = original
  const uploaded = []
  for (const target of targets) {
    const file = await downloadFrame(target.ref.url, target.shrinkTo)
    // Пережатая ступень обязана быть легче хранимой: иначе замена только плодит
    // файлы. Такой кадр оставляем как есть — это не ошибка прогона.
    if (file.buffer.length >= target.beforeBytes) {
      console.log(
        `   = ${target.ref.key}: w=${target.shrinkTo} даёт ${file.buffer.length} B против ${target.beforeBytes} B — пропуск`,
      )
      continue
    }
    const url = await uploadDescriptionImage(id, file, token)

    // Считать экономию по загруженному буферу нельзя: пайплайн перекодирует кадр
    // при приёме, и хранимый файл получается ТЯЖЕЛЕЕ отправленного. Пилот на
    // статье 512: отправили 112 602 B — легло 171 324 B. Поэтому решение о замене
    // принимается по фактически хранимому файлу, а не по нашим намерениям.
    await sleep(600)
    const stored = await downloadFrame(url)
    if (stored.buffer.length >= target.beforeBytes) {
      console.log(
        `   = ${target.ref.key}: хранимый файл ${stored.buffer.length} B не легче ${target.beforeBytes} B — адрес не меняем`,
      )
      await sleep(600)
      continue
    }

    next = next.split(target.ref.raw).join(url)
    uploaded.push({
      key: target.ref.key,
      url,
      pathname: new URL(url).pathname,
      beforeBytes: target.beforeBytes,
      afterBytes: stored.buffer.length,
      width: target.shrinkTo,
    })
    console.log(
      `   ↓ ${target.ref.key} → ${url.replace(SITE, '')} ${target.beforeBytes} → ${stored.buffer.length} B ` +
        `(−${Math.round((1 - stored.buffer.length / target.beforeBytes) * 100)}%)`,
    )
    await sleep(1000)
  }

  if (!uploaded.length) {
    console.log('   ни один кадр не стал легче — запись не нужна')
    return { id, status: 'skipped' }
  }

  next = upgradeFirstPartyProtocol(next)

  // Инварианты те же, что у миграции: меняются ТОЛЬКО адреса.
  if (countImages(next) !== countImages(original)) {
    throw new Error(`число <img> изменилось: ${countImages(original)} → ${countImages(next)}`)
  }
  if (plainText(next) !== plainText(upgradeFirstPartyProtocol(original))) {
    throw new Error('текст статьи изменился — пересайз обязан трогать только адреса')
  }

  const payload = buildUpsertPayload(before, { description: next })
  const put = await request('PUT', '/travels/upsert/', payload, token)
  console.log(`   PUT /travels/upsert/ → HTTP ${put.status}`)
  if (put.status < 200 || put.status >= 300) {
    throw new Error(`PUT → HTTP ${put.status}: ${put.text.slice(0, 300)}`)
  }

  await sleep(1000)
  const after = JSON.parse((await request('GET', `/travels/${id}/`, null, token)).text)
  const regressions = detectRegression(before, after, { expectChanged: true, newDescription: next })
  if (regressions.length) {
    console.error(`   ❌ регрессия данных: ${regressions.join('; ')}`)
    const rollback = await request(
      'PUT',
      '/travels/upsert/',
      buildUpsertPayload(before, { description: original }),
      token,
    )
    console.error(`   ↩︎ откат PUT → HTTP ${rollback.status}`)
    throw new Error(`статья ${id} откачена: ${regressions.join('; ')}`)
  }

  // Отметку ставим только после успешной записи: упавший PUT не должен закрывать
  // кадру дорогу к повторной попытке.
  writeShrunk([...shrunkAlready, ...uploaded.map((u) => u.pathname)])

  const savedBytes = uploaded.reduce((sum, u) => sum + (u.beforeBytes - u.afterBytes), 0)
  console.log(`   ✅ пересайзено ${uploaded.length} кадров, экономия ${savedBytes} B на статью`)
  return { id, status: 'done', shrunk: uploaded.length, savedBytes }
}

async function restoreOne(id, token) {
  const file = latestBackup(BACKUP_DIR, id)
  if (!file) throw new Error(`нет бэкапа для ${id}`)
  const before = JSON.parse(fs.readFileSync(file, 'utf8'))
  const put = await request('PUT', '/travels/upsert/', buildUpsertPayload(before, { description: before.description || '' }), token)
  console.log(`↩︎ restore ${id} из ${path.basename(file)} → HTTP ${put.status}`)
  if (put.status < 200 || put.status >= 300) throw new Error(`restore → HTTP ${put.status}`)
}

// ---------------------------------------------------------------------------
// Пакетный прогон
// ---------------------------------------------------------------------------

const readJournal = () =>
  fs.existsSync(JOURNAL_FILE) ? JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf8')) : {}

const writeJournal = (journal) =>
  fs.writeFileSync(JOURNAL_FILE, JSON.stringify(journal, null, 2))

/** Pathname кадров, уже прошедших `--shrink`: защита от повторного пережатия. */
const readShrunk = () =>
  fs.existsSync(SHRUNK_FILE) ? JSON.parse(fs.readFileSync(SHRUNK_FILE, 'utf8')) : []

const writeShrunk = (list) =>
  fs.writeFileSync(SHRUNK_FILE, JSON.stringify(Array.from(new Set(list)), null, 2))

/**
 * Прогон по инвентарю: строго последовательно, с паузой между статьями.
 *
 * Прод — 1 vCPU, и каждая загрузка заставляет его нарезать шесть производных.
 * Параллелизма здесь нет намеренно: обвалить прод ради скорости — плохой размен.
 * Журнал делает прогон возобновляемым, а первая же ошибка останавливает всё,
 * чтобы не размножать одну и ту же поломку на сотню статей.
 */
async function runBatch(token, { limit, authorId, pauseMs }) {
  ensureDirs()
  if (!fs.existsSync(INVENTORY_FILE)) throw new Error('нет инвентаря — сначала `--inventory`')
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8'))
  const journal = readJournal()

  const uid = (row) => (row.user && typeof row.user === 'object' ? row.user.id : row.user)
  const queue = inventory
    .filter((row) => row.legacyRefs > 0)
    .filter((row) => (authorId == null ? true : uid(row) === authorId))
    .filter((row) => journal[row.id]?.status !== 'done')
    .sort((a, b) => a.legacyRefs - b.legacyRefs)
    .slice(0, limit ?? Infinity)

  console.log(`🚚 В очереди ${queue.length} статей (${queue.reduce((s, r) => s + r.legacyRefs, 0)} картинок)`)
  console.log('')

  let done = 0
  let migrated = 0
  for (const row of queue) {
    try {
      const result = await migrateOne(row.id, { token, dryRun: false })
      journal[row.id] = { status: 'done', at: new Date().toISOString(), migrated: result.migrated ?? 0 }
      done += 1
      migrated += result.migrated ?? 0
    } catch (error) {
      const message = error && error.message ? error.message : String(error)
      journal[row.id] = { status: 'failed', at: new Date().toISOString(), error: message }
      writeJournal(journal)
      console.error('')
      console.error(`🛑 Остановка на статье ${row.id}: ${message}`)
      console.error('   журнал сохранён, повторный запуск продолжит с этого места')
      process.exitCode = 1
      return
    }
    writeJournal(journal)
    await sleep(pauseMs)
  }

  console.log('')
  console.log(`✅ Статей обработано: ${done}, картинок перенесено: ${migrated}`)
  console.log(`📓 Журнал: ${JOURNAL_FILE}`)
}

/**
 * Контрольный обход ЖИВОГО API: доказательство, что legacy-ссылок в телах не
 * осталось.
 *
 * Считает не по журналу (он говорит лишь о том, что скрипт думает про свою
 * работу), а по фактическому ответу прода — иначе приёмка проверяла бы сама себя.
 */
async function runAudit(token) {
  const list = await listAllTravels(token)
  const dirty = []
  let images = 0

  for (let i = 0; i < list.length; i += 1) {
    const { status, text } = await request('GET', `/travels/${list[i].id}/`, null, token)
    if (status !== 200) {
      dirty.push({ id: list[i].id, slug: list[i].slug, problem: `HTTP ${status}` })
      continue
    }
    const detail = JSON.parse(text)
    const description = detail.description || ''
    images += countImages(description)

    const problems = []
    const legacy = collectLegacyUploadRefs(description).length
    if (legacy) problems.push(`legacy uploads: ${legacy}`)
    const s3 = (description.match(/metravelprod\.s3/gi) || []).length
    if (s3) problems.push(`прямых S3: ${s3}`)
    const weserv = (description.match(/images\.weserv\.nl/gi) || []).length
    if (weserv) problems.push(`weserv: ${weserv}`)
    const insecure = (description.match(/http:\/\/(?:cdn\.|api\.)?metravel\.by/gi) || []).length
    if (insecure) problems.push(`http-ссылок: ${insecure}`)
    if (problems.length) dirty.push({ id: list[i].id, slug: list[i].slug, problem: problems.join(', ') })

    if ((i + 1) % 50 === 0) console.log(`  … ${i + 1}/${list.length}`)
    await sleep(120)
  }

  console.log('')
  console.log(`📊 Обойдено статей: ${list.length}, картинок в телах: ${images}`)
  console.log(`${dirty.length ? '❌' : '✅'} Статей с остатками legacy: ${dirty.length}`)
  for (const row of dirty.slice(0, 40)) console.log(`   ${row.id} ${row.slug} — ${row.problem}`)
  if (dirty.length > 40) console.log(`   … и ещё ${dirty.length - 40}`)
  return dirty.length === 0
}

/** Сводка прогресса: сколько сделано, сколько осталось, где застряли. */
function printStatus() {
  if (!fs.existsSync(INVENTORY_FILE)) throw new Error('нет инвентаря — сначала `--inventory`')
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8'))
  const journal = readJournal()
  const uid = (row) => (row.user && typeof row.user === 'object' ? row.user.id : row.user)

  const target = inventory.filter((row) => row.legacyRefs > 0)
  const groups = { mine: target.filter((r) => uid(r) === 1), others: target.filter((r) => uid(r) !== 1) }

  const line = (label, rows) => {
    const done = rows.filter((r) => journal[r.id]?.status === 'done')
    const failed = rows.filter((r) => journal[r.id]?.status === 'failed')
    const leftRefs = rows
      .filter((r) => journal[r.id]?.status !== 'done')
      .reduce((sum, r) => sum + r.legacyRefs, 0)
    const pct = rows.length ? Math.round((done.length / rows.length) * 100) : 100
    console.log(
      `  ${label.padEnd(22)} ${String(done.length).padStart(3)}/${String(rows.length).padEnd(3)} статей (${String(pct).padStart(3)}%)` +
        `  осталось картинок: ${String(leftRefs).padStart(5)}` +
        (failed.length ? `  ⚠️ упало: ${failed.length}` : ''),
    )
  }

  const doneRefs = Object.values(journal).reduce((sum, entry) => sum + (entry.migrated || 0), 0)
  console.log('📊 Прогресс миграции описаний (#1245)')
  console.log('')
  line('свои (user.id=1)', groups.mine)
  line('чужие авторы', groups.others)
  line('ВСЕГО', target)
  console.log('')
  console.log(`  картинок реально перенесено: ${doneRefs}`)

  const failed = target.filter((r) => journal[r.id]?.status === 'failed')
  if (failed.length) {
    console.log('')
    console.log('Упавшие статьи:')
    for (const row of failed) console.log(`  ${row.id} ${row.slug} — ${journal[row.id].error}`)
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const has = (flag) => argv.includes(flag)
  const valueOf = (name) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
  }

  const token = readToken()

  if (has('--inventory')) return runInventory(token)

  if (has('--status')) return printStatus()

  if (has('--audit')) {
    const clean = await runAudit(token)
    process.exitCode = clean ? 0 : 1
    return
  }

  if (has('--run')) {
    const limit = valueOf('limit') ? Number(valueOf('limit')) : null
    const authorRaw = valueOf('author')
    return runBatch(token, {
      limit,
      authorId: authorRaw == null ? null : Number(authorRaw),
      pauseMs: valueOf('pause') ? Number(valueOf('pause')) : 2500,
    })
  }

  const restoreId = valueOf('restore')
  if (restoreId) return restoreOne(Number(restoreId), token)

  const id = valueOf('id')
  if (id && has('--shrink')) {
    const dryRun = has('--dry-run')
    const thresholdRaw = valueOf('threshold')
    const result = await shrinkOne(Number(id), {
      token,
      dryRun,
      threshold: thresholdRaw ? Number(thresholdRaw) : OVERSIZED_BYTES_PER_PIXEL,
    })
    console.log(JSON.stringify(result))
    return
  }

  if (id) {
    const dryRun = has('--dry-run')
    const result = await migrateOne(Number(id), { token, dryRun })
    // Ручной прогон обязан попасть в журнал: иначе починенная вручную статья
    // остаётся помеченной `failed`, и `--status` показывает несуществующий долг.
    if (!dryRun) {
      const journal = readJournal()
      journal[id] = { status: 'done', at: new Date().toISOString(), migrated: result.migrated ?? 0 }
      writeJournal(journal)
    }
    console.log(JSON.stringify(result))
    return
  }

  console.log('Использование:')
  console.log('  --inventory                        обход всех статей: бэкап payload + отчёт')
  console.log('  --id <id> [--dry-run]              миграция одной статьи')
  console.log('  --restore <id>                     откат статьи из последнего бэкапа')
  console.log('  --run [--limit N] [--author <id>]  пакетный прогон по инвентарю')
  console.log('       [--pause <ms>]                пауза между статьями, по умолчанию 2500')
  console.log('  --id <id> --shrink [--dry-run]     пересайз раздутых кадров тела статьи')
  console.log('       [--threshold <Б/px>]          порог «кадр раздут», по умолчанию 0.25')
  console.log('       ВНИМАНИЕ: опирается на ресайз в момент запроса (переходный, #1168);')
  console.log('       после перехода на предгенерацию выигрыш падает до ~10 % — не раскатывать')
  console.log('  --status                           сводка прогресса по журналу')
  console.log('  --audit                            контрольный обход прода: остатки legacy')
  process.exit(has('--help') ? 0 : 2)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('FATAL:', error && error.message ? error.message : error)
    process.exit(1)
  })
}
