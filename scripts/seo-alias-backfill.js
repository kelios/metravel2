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
 * Usage:
 *   node scripts/seo-alias-backfill.js --map-file scripts/.seo-aliases.json --dry-run
 *   node scripts/seo-alias-backfill.js --map-file scripts/.seo-aliases.json
 *   node scripts/seo-alias-backfill.js --id 239 --old-slug usadba-trabutishki-…
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

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by').replace(/\/+$/, '') + '/api'
const BACKUP_DIR = path.join(__dirname, '.seo-backups')
const SECRETS_TOKEN_FILE = path.join(__dirname, '..', '.secrets', 'mcp_token.json')

function getArg(args, name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

function hasFlag(args, name) {
  return args.includes(`--${name}`)
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
    const req = https.request(url, opts, (res) => {
      let buf = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (buf += c))
      res.on('end', () =>
        resolve({ status: res.statusCode, text: buf, location: res.headers.location || '' })
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
  const args = process.argv.slice(2)
  const dryRun = hasFlag(args, 'dry-run')
  const mapFile = getArg(args, 'map-file', '')
  const id = getArg(args, 'id', '')
  const oldSlug = getArg(args, 'old-slug', '')

  let entries = []
  if (mapFile) {
    entries = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
  } else if (id && oldSlug) {
    entries = [{ id: Number(id), oldSlug }]
  } else {
    console.error('Usage: --map-file <file> | --id <id> --old-slug <slug> [--dry-run]')
    process.exit(1)
  }

  console.log(`${dryRun ? '🧪 DRY-RUN ' : '🔗 '}Алиасы без миграции: ${entries.length} пар(ы) через ${API_BASE}\n`)

  const results = []
  for (const entry of entries) {
    const result = await backfillOne(entry, { dryRun })
    const icon = result.status === 'ok' ? '✅' : result.status === 'skipped' ? '⏭️ ' : '❌'
    console.log(`${icon} #${entry.id} ${result.note}`)
    results.push({ ...entry, ...result })
  }

  const ok = results.filter((r) => r.status === 'ok').length
  const failed = results.filter((r) => r.status === 'failed').length
  console.log(`\nИтог: ${ok} заведено, ${results.length - ok - failed} пропущено, ${failed} не удалось.`)
  process.exit(failed > 0 ? 1 : 0)
}

module.exports = { backfillOne, detectDamage, verifyAlias }

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Fatal:', err.message)
    process.exit(1)
  })
}
