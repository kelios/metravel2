#!/usr/bin/env node
/**
 * Заводит 301-алиас старого слага travel БЕЗ бэкенд-миграции (#1252).
 *
 * Зачем это возможно
 * ------------------
 * Алиас создаёт не миграция, а сам бэкенд в `Travel.save()`:
 *
 *   if old_slug and old_slug != self.slug:
 *       TravelSlugRedirect.objects.update_or_create(old_slug=old_slug, defaults={'travel': self})
 *       TravelSlugRedirect.objects.filter(old_slug=self.slug).delete()   # защита от петли
 *
 * Срабатывает это на обычный публичный `PUT /api/travels/upsert/`, поэтому 20
 * адресов батча #1234 получили 301 сразу, без участия владельца бэкенда.
 *
 * Приём: слаг напрямую задать нельзя — `_set_name_and_slug` выводит его из
 * `name` через `slugify()`. Но старый слаг сам по себе — уже валидная строка
 * для `slugify` (латиница и дефисы), поэтому статья временно переименовывается
 * в СВОЙ ЖЕ старый слаг, а затем возвращается к исходному заголовку:
 *
 *   шаг A: name = <old-slug>   → slug = old-slug,   алиас current → travel (временный)
 *   шаг B: name = <исходный>   → slug = current,    алиас old-slug → travel (нужный),
 *                                а временный удаляется тем самым `filter(old_slug=self.slug).delete()`
 *
 * Остаётся ровно одна запись `old-slug → current`, без цепочек и петель.
 *
 * Цена и границы применимости
 * ---------------------------
 * Между шагами A и B публичная статья живёт под своим старым адресом и старым
 * заголовком, а её текущий URL в это окно отдаёт 404. Окно — секунды, но оно
 * реально: именно так отчёт #1249 однажды поймал живые слаги как «мёртвые».
 * Поэтому: по одной статье, с проверкой факта после каждой, и в паре с деплоем
 * фронта — пререндеренный снимок иначе останется со старым заголовком.
 *
 * НЕ работает, когда `slugify(исходный заголовок)` не равен текущему слагу —
 * например у статьи, сидящей на слаге с суффиксом `-1` из-за исторической
 * коллизии: шаг B вернул бы её на слаг без суффикса, то есть сменил бы
 * канонический адрес живой статьи. Такой случай инструмент отказывается делать
 * и пишет причину — это решение владельца, а не побочный эффект прогона.
 *
 * `--help` печатает USAGE ниже; сами аргументы разбирает общий SEO CLI contract
 * (#1391), поэтому опечатка `--dry-runn` — это ошибка вызова, а не настоящий
 * прогон переименований на проде.
 *
 * Формат map-файла: [{ "id": 239, "oldSlug": "usadba-trabutishki-…" }, …]
 *
 * Токен: env METRAVEL_TOKEN, иначе `.secrets/mcp_token.json`, иначе
 * `~/.metravel_token` (никогда не печатается).
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const https = require('https')
const { buildUpsertPayload } = require('./seo-edit')
const { readResponseText, withAcceptEncoding } = require('./lib/httpText')
const { detectStoredTextCorruption } = require('./lib/textIntegrity')
const {
  UsageError,
  parseCliArgs,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runSeoCli,
} = require('./lib/seo-cli-contract')

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by').replace(/\/+$/, '') + '/api'
const BACKUP_DIR = path.join(__dirname, '.seo-backups')
const SECRETS_TOKEN_FILE = path.join(__dirname, '..', '.secrets', 'mcp_token.json')

const USAGE = `301-алиасы старых слагов travel без бэкенд-миграции — metravel.by

Usage:
  node scripts/seo-alias-backfill.js <input> [options]

Наборы входа (ровно один обязателен — сам скрипт статьи не выбирает):
  --map-file <path>     все пары {id, oldSlug} из JSON-файла
  --id <id>             одна статья; нужен --old-slug

Options:
  --old-slug <slug>     прежний слаг статьи, только вместе с --id
  --dry-run             показать план, ничего не писать
  --help, -h            print this help and exit

Examples:
  node scripts/seo-alias-backfill.js --map-file scripts/.seo-aliases.json --dry-run
  node scripts/seo-alias-backfill.js --map-file scripts/.seo-aliases.json
  node scripts/seo-alias-backfill.js --id 239 --old-slug usadba-trabutishki`

/**
 * Каждый шаг временно уводит живую статью на чужой адрес, поэтому «вход не
 * распознан» не имеет права превращаться в набор по умолчанию: набор объявлен
 * режимом, и парсер откажется работать, пока его не назвали явно.
 */
const CLI_SPEC = {
  name: 'seo-alias-backfill',
  usage: USAGE,
  selection: 'alias pairs',
  flags: {
    'map-file': { type: 'string', valueName: 'a path' },
    id: { type: 'string', valueName: 'a travel id' },
    'old-slug': {
      type: 'string',
      valueName: 'a slug',
      requiresMode: 'id',
      reason: 'map-файл несёт свои слаги',
    },
    'dry-run': { type: 'boolean' },
  },
  modes: {
    flags: ['map-file', 'id'],
    label: 'наборы входа',
    missing: 'Вход не задан: передайте --map-file <path> либо --id <id> --old-slug <slug>',
  },
}

function token() {
  let t = process.env.METRAVEL_TOKEN
  if (!t) {
    try {
      t = String(JSON.parse(fs.readFileSync(SECRETS_TOKEN_FILE, 'utf8')).token || '').trim()
    } catch {
      /* следующий источник */
    }
  }
  if (!t) {
    const p = path.join(os.homedir(), '.metravel_token')
    if (fs.existsSync(p)) t = fs.readFileSync(p, 'utf8').trim()
  }
  if (!t) {
    console.error('ERROR: нет токена — env METRAVEL_TOKEN, .secrets/mcp_token.json или ~/.metravel_token')
    process.exit(1)
  }
  return t
}

function request(method, urlPath, data, { auth = true, followRedirect = false } = {}) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${urlPath}`
    const body = data != null ? Buffer.from(JSON.stringify(data)) : null
    const opts = { method, timeout: 60000, headers: {} }
    if (auth) opts.headers.Authorization = `Token ${token()}`
    if (body) {
      opts.headers['Content-Type'] = 'application/json'
      opts.headers['Content-Length'] = body.length
    }
    opts.headers = withAcceptEncoding(opts.headers)
    const req = https.request(url, opts, (res) => {
      // #1649: whole body buffered, then decoded once — accumulating
      // `buf += chunk` decoded every transport chunk on its own.
      readResponseText(res).then(
        (text) => resolve({ status: res.statusCode, text, location: res.headers.location || '' }),
        reject
      )
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout: ${url}`))
    })
    if (body) req.write(body)
    req.end()
    void followRedirect
  })
}

async function getTravel(id) {
  const { status, text } = await request('GET', `/travels/${id}/`)
  if (status !== 200) throw new Error(`GET travel ${id} → HTTP ${status}`)
  return JSON.parse(text)
}

async function putName(detail, name) {
  const payload = buildUpsertPayload(detail, {
    description: detail.description,
    meta: detail.meta_description,
  })
  payload.name = name
  const { status, text } = await request('PUT', '/travels/upsert/', payload)
  return { status, text }
}

function saveBackup(detail) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(BACKUP_DIR, `${detail.id}-alias-${ts}.json`)
  fs.writeFileSync(file, JSON.stringify(detail, null, 2), 'utf8')
  return file
}

/**
 * Различия, которые делают шаг небезопасным. Проверяется ПОСЛЕ каждого PUT:
 * временное переименование не должно стоить статье публичности или контента.
 */
function detectDamage(before, after) {
  const problems = []
  if (before.publish && !after.publish) problems.push('publish стал false')
  if (before.moderation && !after.moderation) problems.push('moderation стал false')
  const bg = (before.gallery || []).length
  const ag = (after.gallery || []).length
  if (ag < bg) problems.push(`галерея сократилась ${bg} → ${ag}`)
  const bp = (before.coordsMeTravel || []).length
  const ap = (after.coordsMeTravel || []).length
  if (ap < bp) problems.push(`точки сократились ${bp} → ${ap}`)
  const bd = (before.description || '').trim().length
  const ad = (after.description || '').trim().length
  if (bd > 0 && ad < Math.floor(bd * 0.95)) problems.push(`описание сократилось ${bd} → ${ad}`)
  return problems
}

/** Живая проба: старый адрес обязан отдавать один 301 на текущий слаг. */
async function verifyAlias(oldSlug, currentSlug) {
  const { status, location } = await request('GET', `/travels/by-slug/${encodeURIComponent(oldSlug)}/`, null, {
    auth: false,
  })
  const target = `/travels/${currentSlug}`
  const ok = status === 301 && String(location).endsWith(target)
  return { ok, status, location, expected: target }
}

/**
 * Одна пара. Возвращает {status: 'ok'|'skipped'|'failed', note}.
 *
 * Отказ вместо прогона — штатный исход: лучше не завести алиас, чем сменить
 * канонический адрес живой статьи или оставить её под чужим заголовком.
 */
async function backfillOne({ id, oldSlug }, options = {}) {
  const { dryRun = false, sleep = defaultSleep } = options
  // Сетевые примитивы инжектируются, чтобы последовательность шагов
  // (и все её отказы) проверялись тестами, а не только боевым прогоном.
  const {
    getTravel = defaultDeps.getTravel,
    putName = defaultDeps.putName,
    verifyAlias = defaultDeps.verifyAlias,
    saveBackup = defaultDeps.saveBackup,
  } = options.deps || {}

  const before = await getTravel(id)
  const currentSlug = before.slug
  const currentName = before.name

  if (currentSlug === oldSlug) {
    return { status: 'skipped', note: `статья уже сидит на ${oldSlug} — алиас не нужен` }
  }

  const alreadyLive = await verifyAlias(oldSlug, currentSlug)
  if (alreadyLive.ok) {
    return { status: 'skipped', note: `алиас уже есть: ${oldSlug} → 301 → ${currentSlug}` }
  }

  // Гард обязан стоять ДО первого PUT: шаг B возвращает не сохранённый слаг, а
  // тот, что даст `slugify(заголовок)`. Если статья сидит на слаге с
  // коллизионным суффиксом (`…-1`), её заголовок даёт слаг БЕЗ суффикса —
  // вернуть её обратно нечем, и она осталась бы на новом адресе навсегда.
  // Проверка после переименования тут не спасает: к тому моменту ущерб нанесён.
  // Год в хвосте (`…-2025`) под правило не подпадает — суффикс коллизии короткий.
  if (/-\d{1,2}$/.test(currentSlug)) {
    return {
      status: 'skipped',
      note:
        `слаг «${currentSlug}» оканчивается коллизионным суффиксом: заголовок даёт слаг без него, ` +
        'поэтому возврат сменил бы канонический адрес живой статьи. Нужно решение владельца — ' +
        'либо алиас пишет бэкенд-миграция, либо статья осознанно переезжает на чистый слаг',
    }
  }

  if (dryRun) {
    return {
      status: 'skipped',
      note: `[dry] #${id} «${currentName}» (${currentSlug}) ← временно «${oldSlug}» ← и обратно`,
    }
  }

  const backup = saveBackup(before)

  // Шаг A: статья временно уезжает на свой прежний адрес.
  const stepA = await putName(before, oldSlug)
  if (stepA.status !== 200 && stepA.status !== 201) {
    return { status: 'failed', note: `шаг A → HTTP ${stepA.status}: ${stepA.text.slice(0, 200)}` }
  }
  await sleep(1000)
  const mid = await getTravel(id)
  if (mid.slug !== oldSlug) {
    // Слаг вышел не тот (коллизия дала суффикс либо slugify изменил строку) —
    // возвращаем заголовок и не трогаем ничего дальше.
    await putName(mid, currentName)
    return {
      status: 'failed',
      note: `шаг A дал слаг ${mid.slug}, а нужен ${oldSlug} — откачено, бэкап ${path.basename(backup)}`,
    }
  }
  const damageA = detectDamage(before, mid)
  if (damageA.length) {
    await putName(mid, currentName)
    return { status: 'failed', note: `шаг A повредил статью: ${damageA.join('; ')} — откачено` }
  }

  // Шаг B: возвращаем исходный заголовок. Здесь и рождается нужный алиас.
  const stepB = await putName(mid, currentName)
  if (stepB.status !== 200 && stepB.status !== 201) {
    return {
      status: 'failed',
      note: `шаг B → HTTP ${stepB.status}: статья ОСТАЛАСЬ на ${oldSlug}, восстанови из ${path.basename(backup)}`,
    }
  }
  await sleep(1000)
  const after = await getTravel(id)

  if (after.slug !== currentSlug) {
    return {
      status: 'failed',
      note:
        `шаг B вернул слаг ${after.slug} вместо ${currentSlug}: заголовок статьи не даёт её текущий слаг ` +
        `(историческая коллизия). Канонический адрес живой статьи менять нельзя без решения владельца — ` +
        `бэкап ${path.basename(backup)}`,
    }
  }
  if (after.name !== currentName) {
    return { status: 'failed', note: `шаг B не вернул заголовок: «${after.name}» — бэкап ${path.basename(backup)}` }
  }
  const damageB = detectDamage(before, after)
  if (damageB.length) {
    return { status: 'failed', note: `после возврата: ${damageB.join('; ')} — бэкап ${path.basename(backup)}` }
  }
  // #1649: оба PUT возвращают описание обратно как есть, поэтому испорченное
  // чтение записалось бы в статью. detectDamage считает длину — подмена буквы
  // на два U+FFFD её не меняет, значит нужна отдельная проверка. Она fatal:
  // продолжать пакет, который портит текст, нельзя.
  // Только описание: заголовок уже сверен побайтово выше (`after.name !==
  // currentName` → failed), туда эта проверка не дотянется ни при каком ответе.
  const corruption = detectStoredTextCorruption([
    { label: 'описание', sent: before.description, stored: after.description },
  ])
  if (corruption.length) {
    // Stopping protects the remaining batch, but the current article has
    // already passed through two PUTs. Restore from the clean pre-write
    // snapshot as well; otherwise the guard reports damage while leaving that
    // damage live until an operator notices and applies the backup manually.
    const rollback = await putName(before, currentName).catch((error) => ({
      status: 0,
      text: error instanceof Error ? error.message : String(error),
    }))
    const rollbackOk = rollback.status === 200 || rollback.status === 201
    return {
      status: 'failed',
      fatal: true,
      note:
        `текст испорчен при записи: ${corruption.join('; ')} — ` +
        (rollbackOk
          ? `откачено из чистого snapshot, бэкап ${path.basename(backup)}`
          : `ROLLBACK FAILED (HTTP ${rollback.status}: ${String(rollback.text || '').slice(0, 160)}) — восстанови из ${path.basename(backup)}`),
    }
  }

  const alias = await verifyAlias(oldSlug, currentSlug)
  if (!alias.ok) {
    return {
      status: 'failed',
      note: `алиас не появился: ${oldSlug} → HTTP ${alias.status} ${alias.location || ''} (ждали 301 на ${alias.expected})`,
    }
  }

  return { status: 'ok', note: `${oldSlug} → 301 → ${currentSlug}` }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const defaultDeps = { getTravel, putName, verifyAlias, saveBackup }

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const dryRun = args.dryRun

  let entries = []
  if (args.mode === 'map-file') {
    entries = JSON.parse(fs.readFileSync(args.mapFile, 'utf8'))
  } else {
    if (!args.oldSlug) throw new UsageError('--id нужен вместе с --old-slug <slug>')
    entries = [{ id: Number(args.id), oldSlug: args.oldSlug }]
  }
  // Пустой map-файл разобрался бы в зелёный отчёт «0 заведено» — это ровно та
  // форма, которой жил #1325. Пустая выборка обязана дойти до кода возврата.
  entries = requireNonEmptySelection(entries, {
    what: 'пар {id, oldSlug}',
    source: args.mode === 'map-file' ? args.mapFile : '--id/--old-slug',
    hint: 'формат: [{ "id": 239, "oldSlug": "…" }, …]',
  })

  console.log(`${dryRun ? '🧪 DRY-RUN ' : '🔗 '}Алиасы без миграции: ${entries.length} пар(ы) через ${API_BASE}\n`)

  const results = []
  for (const entry of entries) {
    const result = await backfillOne(entry, { dryRun })
    const icon = result.status === 'ok' ? '✅' : result.status === 'skipped' ? '⏭️ ' : '❌'
    console.log(`${icon} #${entry.id} ${result.note}`)
    results.push({ ...entry, ...result })
    if (result.fatal) {
      console.error('🛑 пакет остановлен: путь чтения/записи портит UTF-8, остальные пары не тронуты.')
      break
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length
  const failed = results.filter((r) => r.status === 'failed').length
  console.log(`\nИтог: ${ok} заведено, ${results.length - ok - failed} пропущено, ${failed} не удалось.`)
  requireNoBatchFailures(failed, {
    total: entries.length,
    what: 'alias pairs',
    message: `${failed} из ${entries.length} пар алиасов завершились ошибкой — разбор выше`,
  })
}

module.exports = { CLI_SPEC, USAGE, backfillOne, detectDamage, verifyAlias }

if (require.main === module) {
  runSeoCli(main, { name: 'seo-alias-backfill', usage: USAGE })
}
