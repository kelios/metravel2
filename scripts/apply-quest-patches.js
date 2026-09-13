#!/usr/bin/env node
/**
 * Применяет патчи квест-контента (.quest-audit/patches-*.json) на прод.
 * Формат патча ШАГА:   {quest_id, step_db_id, step_id, changes:{task?,hint?,answer_pattern?,lat?,lng?,maps_url?,story?}}
 * Формат патча КВЕСТА: {quest_id, quest_db_id, changes:{title}}
 * Куда идёт PATCH, решает ключ: `step_db_id` → /api/quest-steps/<id>/,
 * `quest_db_id` → /api/quests/<id>/. Заголовок квеста живёт не в шаге, и без
 * второго маршрута его правили бы мимо этого инструмента, то есть без
 * валидации и без единого лога правок (#1540).
 *
 * Режим запуска называется явно — дефолта нет ни в одну сторону (#1934):
 *
 * node scripts/apply-quest-patches.js --dry-run .quest-audit/patches-*.json
 * node scripts/apply-quest-patches.js --apply .quest-audit/patches-by-west.json
 * Токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token (нужен для --apply)
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  UsageError,
  parseCliArgs,
  parseCliTokens,
  requireNoBatchFailures,
  requireNonEmptySelection,
  runCli,
} = require('./lib/cli-contract')

const USAGE = `Применение патчей квест-контента на прод — #1540

Usage:
  node scripts/apply-quest-patches.js <--dry-run|--apply> [--api-url <url>] [--token <token>] <патч-файл...>

Modes (ровно один обязателен — это правка боевого контента):
  --dry-run             напечатать, что было бы отправлено, не писать ничего
  --apply               отправить PATCH на прод

Options:
  --api-url <url>       адрес прода (по умолчанию https://metravel.by)
  --token <token>       токен вместо METRAVEL_TOKEN / ~/.metravel_token
  --help, -h            напечатать эту справку и выйти

Examples:
  node scripts/apply-quest-patches.js --dry-run .quest-audit/patches-*.json
  node scripts/apply-quest-patches.js --apply .quest-audit/patches-by-west.json`

const CLI_SPEC = {
  name: 'apply-quest-patches',
  usage: USAGE,
  selection: 'patch files',
  flags: {
    'dry-run': { type: 'boolean' },
    apply: { type: 'boolean' },
    'api-url': { type: 'string', default: 'https://metravel.by', stripTrailingSlash: true },
    token: { type: 'string', valueName: 'a token' },
  },
  // Дефолта у режима нет сознательно. Дефолт `--dry-run=выключено` превращал
  // опечатку в необратимую правку прод-контента: `--dryrun` не распознавался и
  // уходил в боевую запись. Зеркальный дефолт `--dry-run=включено` давал такую
  // же ложь с другой стороны — оператор уверен, что применил патчи, а на проде
  // не изменилось ничего. Поэтому режим называется вслух каждый раз.
  modes: {
    flags: ['dry-run', 'apply'],
    label: 'режимы запуска',
    missing: 'Режим не выбран: --dry-run (репетиция) или --apply (боевая правка) — явно',
  },
  // Патч-файлы приходят позиционно, обычно раскрытым shell-глобом
  // (`.quest-audit/patches-*.json`), и этот способ вызова сохранён. Но
  // позиционалом становится только токен, который НЕ начинается с `-`: всё
  // остальное остаётся ошибкой распознавания флага. Раньше список файлов
  // собирался фильтром `!a.startsWith('--')`, и `--dryrun` (или любой другой
  // промах по имени флага) молча уезжал туда же, куда имена файлов, — прогон
  // шёл в боевом режиме по списку, в котором лежала опечатка.
  positionals: { key: 'files', min: 1, valueName: 'патч-файл' },
}

/**
 * Разбор одних только аргументов, без префикса `node script.js`, — та форма,
 * которой пользуются тесты и ручная проба оператора: она отвечает про
 * переданный флаг, а не срезает его молча (#1934).
 */
const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC)

// `location` правится вместе с `task`: подпись места видна игроку на карточке
// шага (`components/quests/questWizardStepCard.tsx`) и потому способна выдать
// ответ не хуже подсказки — «Скульптура музыканта с собакой» при вопросе про
// животное рядом с музыкантом (#1453).
// `title` — по той же причине: заголовок шага виден игроку на карточке, и
// механическая опечатка в нём (подменённая буква чужого алфавита, #1464)
// правится тем же путём, что и остальной видимый текст.
const ALLOWED = new Set(['task', 'hint', 'answer_pattern', 'lat', 'lng', 'maps_url', 'story', 'location', 'title', 'order', 'input_type'])
// Поля уровня КВЕСТА. Список узкий сознательно: обложка, город, статус и
// координаты квеста принадлежат migrate-/upload-скриптам, а этому инструменту
// нужен ровно редакционный текст. `title` попал сюда потому, что заголовок
// игрок читает раньше всего остального текста квеста — в каталоге, в шапке
// визарда и в мета-описании страницы, — и правило 4a на него распространяется
// так же, как на подсказку (#1540).
const QUEST_ALLOWED = new Set(['title'])
const TYPES = new Set(['any', 'exact', 'exact_any', 'range', 'any_text', 'any_number', 'approx'])
// Клавиатуру шага выбирает фронт по типу ответа, но колонка input_type в БД
// остаётся источником правды для админки и механического аудита (класс B —
// рассогласование input_type и типа паттерна), поэтому её тоже надо уметь чинить.
const INPUT_TYPES = new Set(['text', 'number'])

function resolveToken(tokenArg) {
  if (tokenArg) return tokenArg
  if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN
  try {
    const p = path.join(os.homedir(), '.metravel_token')
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  } catch {
    /* ignore */
  }
  return null
}

/** Патч уровня квеста: только разрешённые поля и непустой текст. */
function validateQuest(p, file) {
  const payload = {}
  for (const [k, v] of Object.entries(p.changes || {})) {
    if (!QUEST_ALLOWED.has(k)) throw new Error(`${file} ${p.quest_id}: запрещённое поле квеста ${k}`)
    if (typeof v !== 'string' || !v.trim()) throw new Error(`${file} ${p.quest_id}: пустое ${k}`)
    payload[k] = v
  }
  if (!Object.keys(payload).length) throw new Error(`${file} ${p.quest_id}: пустые changes`)
  return payload
}

function validateStep(p, file) {
  const payload = {}
  for (const [k, v] of Object.entries(p.changes || {})) {
    if (!ALLOWED.has(k)) throw new Error(`${file} ${p.step_id}: запрещённое поле ${k}`)
    payload[k] = v
  }
  if (!Object.keys(payload).length) throw new Error(`${file} ${p.step_id}: пустые changes`)
  if (payload.answer_pattern !== undefined) {
    const ap = JSON.parse(payload.answer_pattern)
    if (!TYPES.has(ap.type)) throw new Error(`${file} ${p.step_id}: неизвестный type ${ap.type}`)
    if (['exact_any', 'range', 'any_text', 'approx'].includes(ap.type)) JSON.parse(ap.value)
  }
  if (payload.input_type !== undefined && !INPUT_TYPES.has(payload.input_type)) {
    throw new Error(`${file} ${p.step_id}: неизвестный input_type ${payload.input_type}`)
  }
  for (const k of ['lat', 'lng']) {
    if (payload[k] !== undefined && !Number.isFinite(Number(payload[k])))
      throw new Error(`${file} ${p.step_id}: кривое ${k}=${payload[k]}`)
  }
  return payload
}

/** Куда и чем патчить: шаг или сам квест. */
function validate(p, file) {
  if (p.step_db_id) {
    return {
      endpoint: `/api/quest-steps/${p.step_db_id}/`,
      payload: validateStep(p, file),
      label: `${p.quest_id}/${p.step_id} (шаг ${p.step_db_id})`,
    }
  }
  if (p.quest_db_id) {
    return {
      endpoint: `/api/quests/${p.quest_db_id}/`,
      payload: validateQuest(p, file),
      label: `${p.quest_id} (квест ${p.quest_db_id})`,
    }
  }
  throw new Error(`${file} ${p.quest_id}: нет ни step_db_id, ни quest_db_id`)
}

async function apiPatch(endpoint, payload, { api, token, dryRun }) {
  if (dryRun) {
    console.log(`  [DRY] PATCH ${endpoint}`, Object.keys(payload).join(','))
    return {}
  }
  const r = await fetch(`${api}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`PATCH ${endpoint}: HTTP ${r.status} ${t.slice(0, 300)}`)
  }
  return r.json()
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const files = requireNonEmptySelection(args.files, {
    what: 'патч-файлов',
    source: 'позиционные аргументы',
    hint: 'глоб .quest-audit/patches-*.json мог не раскрыться',
  })

  const dryRun = args.mode === 'dry-run'
  const token = resolveToken(args.token)
  // Репетиция не ходит в сеть и токена не требует, а боевой прогон без него
  // получил бы 401 на каждом патче — это ошибка вызова, а не результат замера.
  if (!token && !dryRun) {
    throw new UsageError('Нужен токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token')
  }
  const transport = { api: args.apiUrl, token, dryRun }

  let ok = 0
  let failed = 0
  for (const file of files) {
    const patches = JSON.parse(fs.readFileSync(file, 'utf8'))
    console.log(`\n=== ${file}: ${patches.length} патчей`)
    for (const p of patches) {
      try {
        const { endpoint, payload, label } = validate(p, file)
        await apiPatch(endpoint, payload, transport)
        console.log(`  OK ${label}: ${Object.keys(payload).join(', ')}`)
        ok++
      } catch (e) {
        console.error(`  FAIL ${p.quest_id}/${p.step_id ?? 'quest'}: ${e.message}`)
        failed++
      }
    }
  }
  console.log(`\nИтого: OK ${ok}, FAIL ${failed} (${dryRun ? 'DRY RUN' : 'LIVE'})`)

  // После отчёта, а не вместо него: оператору нужен список неприменённых патчей
  // раньше вердикта — по нему он решает, что перезаливать.
  requireNoBatchFailures(failed, {
    total: ok + failed,
    message: `не применилось патчей: ${failed} из ${ok + failed}`,
  })
}

module.exports = {
  CLI_SPEC,
  USAGE,
  apiPatch,
  main,
  parseArgs,
  resolveToken,
  validate,
  validateQuest,
  validateStep,
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
