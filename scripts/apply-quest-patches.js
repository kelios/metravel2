#!/usr/bin/env node
/**
 * Применяет патчи квест-контента (.codex-temp/quest-audit/patches-*.json) на прод.
 * Формат патча ШАГА:   {quest_id, step_db_id, step_id, changes:{task?,hint?,answer_pattern?,lat?,lng?,maps_url?,story?,point_role?,poi_info:null}}
 * Формат патча КВЕСТА: {quest_id, quest_db_id, changes:{title}}
 * Формат НОВОЙ ТОЧКИ:  {quest_id, quest_db_id, after_step_id, create_step:{step_id, title, location, story, task, hint?, answer_pattern, lat, lng, maps_url?, input_type?, point_role?}}
 * Куда идёт PATCH, решает ключ: `step_db_id` → /api/quest-steps/<id>/,
 * `quest_db_id` → /api/quests/<id>/. Заголовок квеста живёт не в шаге, и без
 * второго маршрута его правили бы мимо этого инструмента, то есть без
 * валидации и без единого лога правок (#1540).
 * Формат ПЕРЕСТАНОВКИ: {quest_id, quest_db_id, reorder:[step_id, …все точки квеста]}
 * `create_step` — POST /api/quest-steps/ и вставка сразу после `after_step_id`
 * сдвигом `order` у следующих точек (#2423: квест с точками меньше пола
 * добирается новой обязательной точкой, а не удалением чужих шагов).
 * `reorder` — новый порядок точек без правки их полей (#2426: крюк маршрута из
 * `quest-geocheck --route-only`); order 1..n, двухфазно через +10000.
 *
 * Режим запуска называется явно — дефолта нет ни в одну сторону (#1934):
 *
 * node scripts/apply-quest-patches.js --dry-run .codex-temp/quest-audit/patches-*.json
 * node scripts/apply-quest-patches.js --apply .codex-temp/quest-audit/patches-by-west.json
 * Токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token (нужен для --apply)
 */

const { rethrowTerminalAuthError, createToolSession, TokenError, formatTokenError  } = require('./lib/metravel-tool-session');
const fs = require('fs')
const { fetchQuestBundles, parseSteps } = require('./lib/questBundles')

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
  node scripts/apply-quest-patches.js --dry-run .codex-temp/quest-audit/patches-*.json
  node scripts/apply-quest-patches.js --apply .codex-temp/quest-audit/patches-by-west.json`

const CLI_SPEC = {
  name: 'apply-quest-patches',
  usage: USAGE,
  selection: 'patch files',
  flags: {
    'dry-run': { type: 'boolean' },
    'auth-check': { type: 'boolean' },
    'token-file': { type: 'string' },
    'cache-dir': { type: 'string' },
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
  // (`.codex-temp/quest-audit/patches-*.json`), и этот способ вызова сохранён. Но
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
const ALLOWED = new Set(['task', 'hint', 'answer_pattern', 'lat', 'lng', 'maps_url', 'story', 'location', 'title', 'order', 'input_type', 'point_role', 'poi_info'])
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
// Смена обязательности существующей точки не создаёт новый старт или финал.
const PATCH_ROLES = new Set(['required', 'optional'])

// Только наши ошибки плана можно печатать подробно. Произвольные исключения
// транспорта и TokenError по-прежнему проходят через безопасный formatter.
class PatchValidationError extends Error {}

const formatPatchError = (error) => error instanceof PatchValidationError ? error.message : formatTokenError(error)

// Один transport = один последовательный запуск. Репетиция держит только
// затронутые квесты, не меняет публичный снимок и не переживает новый запуск.
const dryRunBundles = new WeakMap()

async function readBundle(transport, questId, fetchBundle) {
  if (!transport.dryRun) return (await fetchBundle(transport.api, questId))[0]
  if (typeof questId !== 'string' || !questId.trim()) throw new PatchValidationError('для репетиции нужен quest_id')
  let bundles = dryRunBundles.get(transport)
  if (!bundles) { bundles = new Map(); dryRunBundles.set(transport, bundles) }
  if (!bundles.has(questId)) {
    const [source] = await fetchBundle(transport.api, questId)
    if (!source || (source.quest_id && source.quest_id !== questId)) {
      throw new PatchValidationError(`квест ${questId} не совпал с продом`)
    }
    const bundle = JSON.parse(JSON.stringify(source))
    bundle.steps = parseSteps(bundle)
    if (typeof bundle.intro === 'string') bundle.intro = JSON.parse(bundle.intro)
    bundles.set(questId, bundle)
  }
  return bundles.get(questId)
}



/** Патч уровня квеста: только разрешённые поля и непустой текст. */
function validateQuest(p, file) {
  const payload = {}
  for (const [k, v] of Object.entries(p.changes || {})) {
    if (!QUEST_ALLOWED.has(k)) throw new PatchValidationError(`${file} ${p.quest_id}: запрещённое поле квеста ${k}`)
    if (typeof v !== 'string' || !v.trim()) throw new PatchValidationError(`${file} ${p.quest_id}: пустое ${k}`)
    payload[k] = v
  }
  if (!Object.keys(payload).length) throw new PatchValidationError(`${file} ${p.quest_id}: пустые changes`)
  return payload
}

function validateStep(p, file) {
  const payload = {}
  for (const [k, v] of Object.entries(p.changes || {})) {
    if (!ALLOWED.has(k)) throw new PatchValidationError(`${file} ${p.step_id}: запрещённое поле ${k}`)
    payload[k] = v
  }
  if (!Object.keys(payload).length) throw new PatchValidationError(`${file} ${p.step_id}: пустые changes`)
  if (payload.answer_pattern !== undefined) {
    let ap
    try { ap = JSON.parse(payload.answer_pattern) } catch { throw new PatchValidationError(`${file} ${p.step_id}: answer_pattern — некорректный JSON`) }
    if (!ap || typeof ap !== 'object') throw new PatchValidationError(`${file} ${p.step_id}: answer_pattern — нужен объект`)
    if (!TYPES.has(ap.type)) throw new PatchValidationError(`${file} ${p.step_id}: неизвестный type ${ap.type}`)
    if (['exact_any', 'range', 'any_text', 'approx'].includes(ap.type)) {
      try { JSON.parse(ap.value) } catch { throw new PatchValidationError(`${file} ${p.step_id}: answer_pattern.value — некорректный JSON`) }
    }
  }
  if (payload.input_type !== undefined && !INPUT_TYPES.has(payload.input_type)) {
    throw new PatchValidationError(`${file} ${p.step_id}: неизвестный input_type ${payload.input_type}`)
  }
  if (payload.point_role !== undefined) {
    if (p.step_id === 'intro' || !PATCH_ROLES.has(payload.point_role)) {
      throw new PatchValidationError(`${file} ${p.step_id}: допустима только роль required/optional у обычной точки`)
    }
  }
  // При смене объекта можно удалить старые часы/билет. Заполнение новых POI
  // остаётся задачей профильного инструмента, произвольный JSON не принимаем.
  if (Object.hasOwn(payload, 'poi_info') && payload.poi_info !== null) {
    throw new PatchValidationError(`${file} ${p.step_id}: poi_info допускает только null для очистки`)
  }
  for (const k of ['lat', 'lng']) {
    if (payload[k] !== undefined && !Number.isFinite(Number(payload[k])))
      throw new PatchValidationError(`${file} ${p.step_id}: кривое ${k}=${payload[k]}`)
  }
  return payload
}

// Новая точка: те же поля, что правит патч шага, плюс собственный step_id и
// роль. Порядок задаёт `after_step_id`, а не `order` из патча: свободный слот
// определяется по живому бандлу в момент применения, иначе патч, написанный
// до чужой вставки, занял бы чужой order. Роль `final` новой точке не дают —
// финал у квеста один, и вставка после него сломала бы эту единственность.
const CREATE_REQUIRED = ['title', 'location', 'story', 'task', 'answer_pattern', 'lat', 'lng']
const CREATE_ROLES = new Set(['required', 'optional'])
const STEP_ID_RE = /^[a-z0-9][a-z0-9-]*$/

function validateCreate(p, file) {
  const spec = p.create_step || {}
  const { step_id: stepId, point_role: role = 'required', ...changes } = spec
  if (!p.quest_db_id) throw new PatchValidationError(`${file} ${p.quest_id}: новой точке нужен quest_db_id`)
  if (!p.after_step_id) throw new PatchValidationError(`${file} ${p.quest_id}: новой точке нужен after_step_id`)
  if (typeof stepId !== 'string' || !STEP_ID_RE.test(stepId)) throw new PatchValidationError(`${file} ${p.quest_id}: кривой step_id ${stepId}`)
  if (!CREATE_ROLES.has(role)) throw new PatchValidationError(`${file} ${stepId}: роль новой точки только required|optional, не ${role}`)
  if (changes.order !== undefined) throw new PatchValidationError(`${file} ${stepId}: order новой точки задаёт after_step_id`)
  const payload = validateStep({ step_id: stepId, changes }, file)
  for (const k of CREATE_REQUIRED) {
    if (payload[k] === undefined || payload[k] === null || String(payload[k]).trim() === '') {
      throw new PatchValidationError(`${file} ${stepId}: у новой точки пустое ${k}`)
    }
  }
  if (!payload.maps_url) payload.maps_url = `https://maps.google.com/?q=${payload.lat},${payload.lng}`
  if (!payload.input_type) payload.input_type = 'text'
  return {
    payload: { ...payload, step_id: stepId, point_role: role, is_intro: false },
    label: `${p.quest_id}/${stepId} (новая точка после ${p.after_step_id})`,
  }
}

/**
 * Чистый план вставки: order новой точки — сразу за `after_step_id`, все точки
 * с order не меньше него сдвигаются на +1. Временный order для POST лежит выше
 * любого занятого, чтобы unique (quest, order) не сработал до сдвига.
 */
function planInsert(steps, afterStepId) {
  const after = steps.find((s) => !s.is_intro && s.step_id === afterStepId)
  if (!after) throw new PatchValidationError(`нет точки ${afterStepId}`)
  if (after.point_role === 'final') throw new PatchValidationError(`${afterStepId} — финальная точка, после неё вставлять нельзя`)
  const order = Number(after.order) + 1
  const shifts = steps
    .filter((s) => !s.is_intro && Number(s.order) >= order)
    .map((s) => ({ pk: s.id, step_id: s.step_id, from: Number(s.order), to: Number(s.order) + 1 }))
  const tempOrder = Math.max(0, ...steps.map((s) => Number(s.order) || 0)) + 5000
  return { order, shifts, tempOrder }
}

/**
 * POST новой точки с временным order, затем сдвиг хвоста двухфазно (+10000 →
 * целевой) и перевод новой точки на её место. Если step_id уже на проде —
 * повтор после частичного прогона, и точка не создаётся второй раз.
 */
async function applyCreate(p, file, transport, { fetchBundle = fetchQuestBundles } = {}) {
  const { payload, label } = validateCreate(p, file)
  const bundle = await readBundle(transport, p.quest_id, fetchBundle)
  if (!bundle || bundle.id !== p.quest_db_id) throw new PatchValidationError(`${file} ${p.quest_id}: quest_db_id ${p.quest_db_id} ≠ проду ${bundle && bundle.id}`)
  const steps = parseSteps(bundle)
  const intro = bundle.intro ? [{ ...bundle.intro, is_intro: true }] : []
  const existing = steps.find((s) => s.step_id === payload.step_id)
  if (existing) {
    // Повтор засчитывается, только если прошлый прогон довёл точку до места:
    // упавший сдвиг оставил бы её на временном order за финалом.
    const after = steps.find((s) => s.step_id === p.after_step_id)
    const want = after ? Number(after.order) + 1 : NaN
    if (Number(existing.order) !== want) {
      throw new PatchValidationError(`${file} ${payload.step_id}: точка уже на проде, но order ${existing.order} ≠ ${want} — прошлый прогон не довёл сдвиг, почини order вручную`)
    }
    return { label, skipped: true }
  }
  const plan = planInsert([...intro, ...steps], p.after_step_id)
  const newId = transport.dryRun ? `dry-run:${p.quest_id}:${payload.step_id}` : null
  const created = await apiRequest('POST', '/api/quest-steps/', { ...payload, quest: bundle.id, order: plan.tempOrder }, transport)
  for (const s of plan.shifts) await apiRequest('PATCH', `/api/quest-steps/${s.pk}/`, { order: s.from + 10000 }, transport)
  for (const s of plan.shifts) await apiRequest('PATCH', `/api/quest-steps/${s.pk}/`, { order: s.to }, transport)
  await apiRequest('PATCH', `/api/quest-steps/${transport.dryRun ? newId : created.id}/`, { order: plan.order }, transport)
  if (transport.dryRun) {
    for (const shift of plan.shifts) steps.find((step) => step.id === shift.pk).order = shift.to
    steps.push({ ...payload, id: newId, quest: bundle.id, order: plan.order })
  }
  return { label: `${label}, order ${plan.order}, сдвинуто ${plan.shifts.length}`, skipped: false }
}

const PARK = 10000

/**
 * Чистый план перестановки: точки получают order 1..n в новой
 * последовательности — та же плотная нумерация, что у всего прода. Цель берётся
 * из позиции в списке, а не из текущих order: после упавшего прогона часть точек
 * стоит на временных +10000, и слоты по ним уже не восстановить. Список обязан
 * совпасть с составом квеста на проде — пропущенная точка иначе осталась бы на
 * чужом слоте. Финал (`point_role: final`) остаётся последней обязательной точкой.
 */
function planReorder(steps, reorder) {
  const points = steps.filter((s) => !s.is_intro)
  const byId = new Map(points.map((s) => [s.step_id, s]))
  const unknown = reorder.filter((id) => !byId.has(id))
  const missing = points.map((s) => s.step_id).filter((id) => !reorder.includes(id))
  if (unknown.length || missing.length || new Set(reorder).size !== reorder.length) {
    throw new PatchValidationError(`состав точек не совпал с продом: лишние ${unknown.join(',') || '—'}, пропущены ${missing.join(',') || '—'}`)
  }
  const final = points.find((s) => s.point_role === 'final')
  if (final) {
    const tail = reorder.slice(reorder.indexOf(final.step_id) + 1).map((id) => byId.get(id))
    if (tail.some((s) => s.point_role !== 'optional')) throw new PatchValidationError(`после финала ${final.step_id} осталась обязательная точка`)
  }
  const moves = reorder
    .map((id, i) => ({ pk: byId.get(id).id, step_id: id, from: Number(byId.get(id).order), to: i + 1 }))
    .filter((m) => m.from !== m.to)
  return { moves }
}

/** Перестановка точек: сдвиг через +10000, затем целевые слоты; повтор по готовому порядку — SKIP. */
async function applyReorder(p, file, transport, { fetchBundle = fetchQuestBundles } = {}) {
  if (!p.quest_db_id) throw new PatchValidationError(`${file} ${p.quest_id}: перестановке нужен quest_db_id`)
  if (!Array.isArray(p.reorder) || !p.reorder.every((id) => typeof id === 'string')) throw new PatchValidationError(`${file} ${p.quest_id}: reorder — список step_id`)
  const bundle = await readBundle(transport, p.quest_id, fetchBundle)
  if (!bundle || bundle.id !== p.quest_db_id) throw new PatchValidationError(`${file} ${p.quest_id}: quest_db_id ${p.quest_db_id} ≠ проду ${bundle && bundle.id}`)
  const { moves } = planReorder(parseSteps(bundle), p.reorder)
  const label = `${p.quest_id} (порядок ${p.reorder.join('→')})`
  if (!moves.length) return { label, skipped: true }
  for (const m of moves.filter((x) => x.from < PARK)) await apiRequest('PATCH', `/api/quest-steps/${m.pk}/`, { order: m.from + PARK }, transport)
  for (const m of moves) await apiRequest('PATCH', `/api/quest-steps/${m.pk}/`, { order: m.to }, transport)
  if (transport.dryRun) {
    for (const move of moves) bundle.steps.find((step) => step.id === move.pk).order = move.to
  }
  return { label: `${label}, переставлено ${moves.length}`, skipped: false }
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
  throw new PatchValidationError(`${file} ${p.quest_id}: нет ни step_db_id, ни quest_db_id`)
}

async function apiRequest(method, endpoint, payload, { api, session, token, dryRun }) {
 if (dryRun) { console.log(`[DRY] ${method}`, endpoint, Object.keys(payload).join(',')); return {}; }
 const r = await (session || createToolSession({ origin: api, explicit: token })).request(endpoint, { method, json: payload });
 if (!r.ok) throw new TokenError('response', { status: r.status });
 return r.json();
}

const apiPatch = (endpoint, payload, transport) => apiRequest('PATCH', endpoint, payload, transport)

/** Метаданные меняются у подтверждённой точки; роль старта/финала сохраняется. */
async function applyPatch(p, file, transport, { fetchBundle = fetchQuestBundles } = {}) {
  const validated = validate(p, file)
  const changesRole = Object.hasOwn(validated.payload, 'point_role')
  let dryRunTarget
  if (transport.dryRun) {
    const bundle = await readBundle(transport, p.quest_id, fetchBundle)
    if (p.step_db_id) {
      dryRunTarget = [...bundle.steps, ...(bundle.intro ? [bundle.intro] : [])]
        .find((step) => String(step.id) === String(p.step_db_id))
      if (!dryRunTarget || dryRunTarget.step_id !== p.step_id) {
        throw new PatchValidationError(`${file}: step_db_id и step_id не совпали с продом`)
      }
    } else {
      if (bundle.id !== p.quest_db_id) throw new PatchValidationError(`${file}: quest_db_id не совпал с продом`)
      dryRunTarget = bundle
    }
  }
  if (changesRole || Object.hasOwn(validated.payload, 'poi_info')) {
    if (typeof p.quest_id !== 'string' || !p.quest_id.trim() || typeof p.step_id !== 'string' || !p.step_id.trim()) {
      throw new PatchValidationError(`${file}: метаданным нужны quest_id и step_id`)
    }
    const bundle = await readBundle(transport, p.quest_id, fetchBundle)
    if (!bundle || bundle.quest_id !== p.quest_id) throw new PatchValidationError(`${file}: квест не совпал с продом`)
    const intro = typeof bundle.intro === 'string' ? JSON.parse(bundle.intro) : bundle.intro
    const points = [...parseSteps(bundle), ...(intro ? [{ ...intro, is_intro: true }] : [])]
    const target = points.find((s) => String(s.id) === String(p.step_db_id))
    if (!target || target.step_id !== p.step_id) throw new PatchValidationError(`${file}: step_db_id и step_id не совпали с продом`)
    if (changesRole && (target.is_intro || !PATCH_ROLES.has(target.point_role))) {
      throw new PatchValidationError(`${file} ${p.step_id}: нельзя менять роль старта, финала или неподтверждённой точки`)
    }
  }
  await apiPatch(validated.endpoint, validated.payload, transport)
  if (dryRunTarget) Object.assign(dryRunTarget, validated.payload)
  return validated
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const files = requireNonEmptySelection(args.files, {
    what: 'патч-файлов',
    source: 'позиционные аргументы',
    hint: 'глоб .codex-temp/quest-audit/patches-*.json мог не раскрыться',
  })

  const dryRun = args.mode === 'dry-run'
  let sessionOptions = { origin: args.apiUrl, explicit: args.token }
  if (args.tokenFile || args.cacheDir) {
    if (!args.authCheck || !args.tokenFile || !args.cacheDir) throw new UsageError('Isolated token-file/cache-dir require --auth-check')
    const { fixtureHome, assertContained } = require('./lib/metravel-token-cache')
    const homeDir = fixtureHome(args.cacheDir)
    const tokenFile = assertContained(args.tokenFile, homeDir)
    sessionOptions = { origin: args.apiUrl, homeDir, sources: [{ kind: 'file', path: tokenFile, format: 'plain' }] }
  }
  if (args.authCheck && !dryRun) throw new UsageError('--auth-check requires --dry-run')
  const session = createToolSession(sessionOptions)
  if (args.authCheck) { await session.ensureToken(); console.log('metravel-auth: ready (userId=104); content writes=0') }
  // Репетиция не пишет в сеть и токена не требует (новая точка лишь читает
  // публичный бандл ради плана order, метаданные — ради сверки цели), а боевой прогон без него
  // получил бы 401 на каждом патче — это ошибка вызова, а не результат замера.
  const transport = { api: args.apiUrl, session, dryRun }

  let ok = 0
  let failed = 0
  for (const file of files) {
    const patches = JSON.parse(fs.readFileSync(file, 'utf8'))
    console.log(`\n=== ${file}: ${patches.length} патчей`)
    for (const p of patches) {
      try {
        if (p.create_step || p.reorder) {
          const { label, skipped } = await (p.create_step ? applyCreate : applyReorder)(p, file, transport)
          console.log(`  ${skipped ? 'SKIP' : 'OK'} ${label}${skipped ? ': уже на проде' : ''}`)
          ok++
          continue
        }
        const { payload, label } = await applyPatch(p, file, transport)
        console.log(`  OK ${label}: ${Object.keys(payload).join(', ')}`)
        ok++
      } catch (e) {
        rethrowTerminalAuthError(e);
        console.error(`  FAIL ${p.quest_id}/${p.step_id ?? p.create_step?.step_id ?? (p.reorder ? 'reorder' : 'quest')}: ${formatPatchError(e)}`)
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
  applyPatch,
  applyCreate,
  applyReorder,
  formatPatchError,
  main,
  parseArgs,
  planInsert,
  planReorder,
  validate,
  validateCreate,
  validateQuest,
  validateStep,
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
