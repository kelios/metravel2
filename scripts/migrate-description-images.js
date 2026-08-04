#!/usr/bin/env node
/**
 * Миграция картинок в телах статей: legacy-класс `uploads/**` → канонический
 * `travel-description-image` (#1245).
 *
 * ЗАЧЕМ. В телах статей фотография адресуется тремя разными способами: прямой
 * ссылкой на бакет, той же ссылкой в обёртке `images.weserv.nl` (до трёх слоёв) и
 * нашими family-роутами. Класс `uploads/**` при этом мёртвый — durable-производных
 * у него нет, и после fail-closed чтения он держится на временном обходе `f=jpeg`
 * (#1244). Перезалив в канонический пайплайн решает это в корне: замер прода
 * 2026-08-04 на `travel-description-image/135/description/…JPG` — w=320|800|960|1600
 * все дают 200 `stored-derivative` в webp.
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
  for (let i = 0; i < 8; i += 1) {
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

function request(method, urlPath, body, token) {
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
async function withRetry(label, fn, attempts = 4) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const transient = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|timeout/i.test(
        error && error.message ? error.message : String(error),
      )
      if (!transient || attempt === attempts) throw error
      const backoff = 1000 * 2 ** (attempt - 1)
      console.log(`   ↻ ${label}: ${error.message}; повтор ${attempt}/${attempts - 1} через ${backoff} мс`)
      await sleep(backoff)
    }
  }
  throw lastError
}

/** Мастер legacy-картинки. Только эта ширина у класса и отвечает 200 (#1244). */
async function downloadMaster(key) {
  const url = `${SITE}/media-resize/${key}?w=1920`
  return withRetry(`скачивание ${key}`, async () => {
    const res = await fetch(url, { headers: { Accept: 'image/*,*/*' } })
    if (!res.ok) throw new Error(`скачивание ${key} → HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    if (!buffer.length) throw new Error(`скачивание ${key} → пустой ответ`)
    return {
      buffer,
      contentType: res.headers.get('content-type') || 'application/octet-stream',
      filename: decodeURIComponent(key.split('/').pop() || 'photo.jpg'),
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
    const res = await withRetry(`проба w=${width}`, () =>
      fetch(probe.toString(), {
        headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
      }),
    )
    const mode = res.headers.get('x-metravel-image-transform') || '(нет)'
    if (res.status !== 200) problems.push(`w=${width} → HTTP ${res.status}`)
    else if (!/stored-derivative/i.test(mode)) problems.push(`w=${width} → mode="${mode}"`)
  }
  return problems
}

async function migrateOne(id, { token, dryRun }) {
  ensureDirs()
  const { status, text } = await request('GET', `/travels/${id}/`, null, token)
  if (status !== 200) throw new Error(`GET travel ${id} → HTTP ${status}`)
  const before = JSON.parse(text)
  const original = before.description || ''

  const refs = collectLegacyUploadRefs(original)
  const httpRefs = (original.match(/http:\/\/(?:cdn\.|api\.)?metravel\.by/gi) || []).length
  console.log(
    `📄 [${id}] ${before.slug} — картинок в теле ${countImages(original)}, из них legacy ${refs.length}` +
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
    const file = await downloadMaster(ref.key)
    const url = await uploadDescriptionImage(id, file, token)
    // Заменяем ВСЕ вхождения именно этой строки: один и тот же кадр может стоять
    // в теле несколько раз, в том числе в разных weserv-обёртках.
    next = next.split(ref.raw).join(url)
    uploaded.push({ key: ref.key, url, bytes: file.buffer.length })
    console.log(`   ↑ ${ref.key} → ${url.replace(SITE, '')} (${file.buffer.length} B)`)
    await sleep(400)
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

  const payload = buildUpsertPayload(before, { description: next })
  const put = await request('PUT', '/travels/upsert/', payload, token)
  console.log(`   PUT /travels/upsert/ → HTTP ${put.status}`)
  if (put.status < 200 || put.status >= 300) {
    throw new Error(`PUT → HTTP ${put.status}: ${put.text.slice(0, 300)}`)
  }

  await sleep(1000)
  const after = JSON.parse((await request('GET', `/travels/${id}/`, null, token)).text)
  const problems = detectRegression(before, after, { expectChanged: true, newDescription: next })
  for (const upload of uploaded) problems.push(...(await verifyCanonical(upload.url)).map((p) => `${upload.key}: ${p}`))

  if (problems.length) {
    console.error(`   ❌ регрессия: ${problems.join('; ')}`)
    const rollback = await request('PUT', '/travels/upsert/', buildUpsertPayload(before, { description: original }), token)
    console.error(`   ↩︎ откат PUT → HTTP ${rollback.status}`)
    throw new Error(`статья ${id} откачена: ${problems.join('; ')}`)
  }

  console.log(`   ✅ мигрировано ${uploaded.length}, все ступени отдают stored-derivative`)
  return { id, status: 'done', migrated: uploaded.length }
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

  if (has('--run')) {
    const limit = valueOf('limit') ? Number(valueOf('limit')) : null
    const authorRaw = valueOf('author')
    return runBatch(token, {
      limit,
      authorId: authorRaw == null ? null : Number(authorRaw),
      pauseMs: valueOf('pause') ? Number(valueOf('pause')) : 1500,
    })
  }

  const restoreId = valueOf('restore')
  if (restoreId) return restoreOne(Number(restoreId), token)

  const id = valueOf('id')
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
  console.log('       [--pause <ms>]                пауза между статьями, по умолчанию 1500')
  process.exit(has('--help') ? 0 : 2)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('FATAL:', error && error.message ? error.message : error)
    process.exit(1)
  })
}
