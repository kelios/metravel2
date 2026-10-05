#!/usr/bin/env node
'use strict'
// Конвейер перевода квестов (#2199, серия QUEST-L10N).
//
// ЗАЧЕМ. Квесты написаны по-русски: 220 квестов, 2 186 шагов, 2,72 млн знаков
// (замер 04.10.2026). Перевод на четыре языка — около 11 млн знаков, и это не
// перевод статьи: надпись, которую игрок читает на месте, переводить нельзя;
// ответ, который он называет сам, обязан получить варианты на языке перевода;
// подсказка не должна выдать ответ. Без общих проверок ошибка подхода
// размножается на 880 пар «квест + язык».
//
// ЧТО ДЕЛАЕТ. Сам текст не переводит — переводит агент `quest-translator`
// (решение владельца 04.10.2026: агентские сессии, внешних платных API нет).
// Скрипт готовит агенту задание, проверяет результат и пишет его в базу через
// admin-API переводов (#2194). Источник правды — база, не git: файлы живут в
// игнорируемом `.codex-temp/quest-translations/<locale>/`.
//
//     npm run quest:translate -- next --count 10
//     npm run quest:translate -- prepare --quest krakow-dragon --locale pl
//     npm run quest:translate -- check --quest krakow-dragon --locale pl
//     npm run quest:translate -- upload --quest krakow-dragon --locale pl [--publish]
//     npm run quest:translate -- city-name --city 1 --locale pl --name Kraków
//     npm run quest:translations:status -- [--locale pl]
//
// Правила перевода и порядок работы — docs/QUEST_TRANSLATION_GUIDE.md.

const path = require('path')
const { spawnSync } = require('child_process')

const { ExpectedFailureError, UsageError, parseCliArgs, parseCliTokens, runCli } = require('./lib/cli-contract')
const { createApi, resolveToken } = require('./lib/questTranslation/api')
const { mergeReview, runStructuralChecks, uploadBlockers } = require('./lib/questTranslation/checks')
const { getQuestContentLocales } = require('./lib/questTranslation/locales')
const {
  DEFAULT_WORK_DIR,
  ROOT,
  apiStep,
  artifactPaths,
  buildReviewTask,
  buildTask,
  loadGlossary,
  planSteps,
  readJsonFile,
  relative,
  sourceFromBundle,
  writeJsonFile,
} = require('./lib/questTranslation/task')

const NAME = 'quest-translate'
const STARTS_WINDOW_DAYS = 90
// Сколько уже переведённых квестов того же города читать ради согласованных имён.
const ACCEPTED_NAMES_QUESTS = 3
const ORDERS = ['starts', 'catalog']

// Какие флаги понимает каждая подкоманда: флаг чужой подкоманды — ошибка вызова,
// а не молча проигнорированный аргумент (`check --publish` ничего не публикует).
const COMMANDS = {
  next: { required: ['count'], optional: ['order', 'json'] },
  prepare: { required: ['quest', 'locale'], optional: ['force'] },
  check: { required: ['quest', 'locale'], optional: [] },
  upload: { required: ['quest', 'locale'], optional: ['publish', 'force', 'unpublish'] },
  status: { required: [], optional: ['locale', 'json'] },
  'city-name': { required: ['city', 'locale', 'name'], optional: [] },
}
const SHARED_FLAGS = ['api-url', 'token', 'work-dir']

const USAGE = `Usage:
  node scripts/quest-translate.js next --count <n> [--order starts|catalog] [--json]
  node scripts/quest-translate.js prepare --quest <quest_id> --locale <код> [--force]
  node scripts/quest-translate.js check --quest <quest_id> --locale <код>
  node scripts/quest-translate.js upload --quest <quest_id> --locale <код> [--publish | --unpublish] [--force]
  node scripts/quest-translate.js status [--locale <код>] [--json]
  node scripts/quest-translate.js city-name --city <id> --locale <код> --name <название>

Подкоманды:
  next        следующие квесты без полного перевода и города без названия на локали
  prepare     задание агенту quest-translator: <work-dir>/<locale>/<quest_id>.task.json
  check       структурные проверки <quest_id>.json и вердикт смысловой проверки
  upload      запись перевода через API: черновик, с --publish — публикация
  status      сводка published/draft/missing/stale по локалям
  city-name   название города квеста на локали

Опции:
  --count <n>          сколько квестов вернуть (next)
  --order <порядок>    starts — по числу стартов (по умолчанию), catalog — по каталогу
  --publish            опубликовать: только при зелёных структурных и смысловой проверках
  --unpublish          записать черновик поверх опубликованного перевода: игроки вернутся на русский
  --force              переводить и перезаписывать шаги с ручным переводом (origin: human)
  --api-url <url>      API (по умолчанию https://metravel.by)
  --token <token>      токен администратора; по умолчанию METRAVEL_TOKEN или ~/.metravel_token
  --work-dir <путь>    каталог артефактов (по умолчанию ${DEFAULT_WORK_DIR})
  --json               машиночитаемый результат на stdout`

const CLI_SPEC = {
  name: NAME,
  usage: USAGE,
  // Каждый запуск работает с одной названной парой «квест + локаль» либо печатает
  // отчёт; пустой `next` — законный итог серии, а не ошибка выборки.
  selection: 'none',
  flags: {
    quest: { type: 'string', valueName: 'quest_id' },
    locale: { type: 'string', valueName: 'код локали' },
    count: { type: 'int', min: 1 },
    city: { type: 'int', min: 1 },
    name: { type: 'string', allowLeadingDash: true },
    order: { type: 'string', valueName: 'starts|catalog' },
    publish: { type: 'boolean' },
    force: { type: 'boolean' },
    unpublish: { type: 'boolean' },
    json: { type: 'boolean' },
    'api-url': { type: 'string', default: 'https://metravel.by', stripTrailingSlash: true },
    token: { type: 'string', allowLeadingDash: true },
    'work-dir': { type: 'string', default: DEFAULT_WORK_DIR },
  },
  positionals: { key: 'commands', min: 1, valueName: 'подкоманда' },
}

const camel = (flag) => flag.replace(/-([a-z])/g, (_match, char) => char.toUpperCase())
const isSet = (value) => value !== null && value !== false && value !== undefined

/** Разбор и проверка вызова: одна подкоманда, только её флаги, известная локаль. */
function resolveInvocation(args) {
  if (args.commands.length !== 1 || !COMMANDS[args.commands[0]]) {
    throw new UsageError(`нужна одна подкоманда: ${Object.keys(COMMANDS).join(', ')}`)
  }
  const command = args.commands[0]
  const { required, optional } = COMMANDS[command]
  const allowed = new Set([...required, ...optional, ...SHARED_FLAGS])
  for (const flag of Object.keys(CLI_SPEC.flags)) {
    if (!allowed.has(flag) && isSet(args[camel(flag)])) throw new UsageError(`--${flag} не относится к ${command}`)
  }
  for (const flag of required) {
    if (!isSet(args[camel(flag)])) throw new UsageError(`${command}: нужен --${flag}`)
  }
  const { targets } = getQuestContentLocales()
  if (args.locale !== null && !targets.includes(args.locale)) {
    throw new UsageError(`--locale ${args.locale}: локали перевода — ${targets.join(', ')}`)
  }
  if (args.order !== null && !ORDERS.includes(args.order)) {
    throw new UsageError(`--order ${args.order}: допустимо ${ORDERS.join(' | ')}`)
  }
  return command
}

const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC)

const isIncomplete = (row) =>
  !row || row.state !== 'published' || row.missing_step_ids.length > 0 || row.stale_step_ids.length > 0

/** Статус переводов, сгруппированный по квесту: `Map<quest_id, Map<locale, row>>`. */
function indexStatus(rows) {
  const byQuest = new Map()
  for (const row of rows) {
    if (!byQuest.has(row.quest_id)) byQuest.set(row.quest_id, new Map())
    byQuest.get(row.quest_id).set(row.locale, row)
  }
  return byQuest
}

/**
 * Число стартов по квестам из серверной воронки (`quest:funnel`, топ за окно).
 * Порядок перевода — приоритет, а не корректность: воронка ходит в прод-базу по
 * SSH, и её сбой не должен останавливать ежедневную пачку — порядок падает до
 * каталожного с предупреждением в stderr.
 */
function readStartsRanking() {
  const run = spawnSync(
    process.execPath,
    [path.join(ROOT, 'scripts', 'quest-funnel.js'), '--json', '--days', String(STARTS_WINDOW_DAYS)],
    { encoding: 'utf8', timeout: 120000 },
  )
  try {
    if (run.status !== 0) throw new Error((run.stderr || '').trim().split('\n').pop() || `exit ${run.status}`)
    const report = JSON.parse(run.stdout)
    return new Map(report.topQuests.map((row) => [row.slug, row.answered]))
  } catch (error) {
    console.error(`[${NAME}] воронка стартов недоступна (${error.message}) — порядок по каталогу`)
    return null
  }
}

async function commandNext(args, api) {
  const { targets } = getQuestContentLocales()
  const [statusRows, catalog] = [await api.getStatus(), await api.getCatalog()]
  const status = indexStatus(statusRows)
  const pending = catalog
    .map((quest) => {
      const rows = status.get(quest.quest_id) || new Map()
      const locales = targets.filter((code) => isIncomplete(rows.get(code)))
      return { quest, rows, locales }
    })
    .filter((entry) => entry.locales.length > 0)

  const starts = (args.order || 'starts') === 'starts' ? readStartsRanking() : null
  const startsOf = (entry) => (starts && starts.get(entry.quest.quest_id)) || 0
  pending.sort(
    (a, b) =>
      startsOf(b) - startsOf(a) ||
      (b.quest.completions_count || 0) - (a.quest.completions_count || 0) ||
      a.quest.id - b.quest.id,
  )
  const batch = pending.slice(0, args.count)

  // Город без названия на локали: под `?lang=` сервер отдаёт каноническое имя.
  const cities = new Map()
  if (batch.length) {
    const wanted = new Set(batch.map((entry) => entry.quest.quest_id))
    for (const code of targets) {
      for (const quest of await api.getCatalog(code)) {
        if (!wanted.has(quest.quest_id) || quest.city_name !== quest.city_name_canonical) continue
        const cityId = Number(quest.city_id)
        if (!cities.has(cityId)) cities.set(cityId, { city_id: cityId, name: quest.city_name_canonical, locales: [] })
        if (!cities.get(cityId).locales.includes(code)) cities.get(cityId).locales.push(code)
      }
    }
  }

  const describe = (row) => {
    if (!row) return 'missing'
    const stale = row.stale_step_ids.length ? `, stale ${row.stale_step_ids.length}` : ''
    const missing = row.state !== 'missing' && row.missing_step_ids.length ? `, без ${row.missing_step_ids.length} шагов` : ''
    return `${row.state}${stale}${missing}`
  }
  const result = {
    order: starts ? 'starts' : 'catalog',
    remaining: pending.length,
    quests: batch.map(({ quest, rows, locales }) => ({
      id: quest.id,
      quest_id: quest.quest_id,
      title: quest.title,
      city_id: Number(quest.city_id),
      locales: Object.fromEntries(locales.map((code) => [code, describe(rows.get(code))])),
    })),
    cities: [...cities.values()],
  }
  if (args.json) return process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)

  console.log(`Квестов без полного перевода: ${result.remaining}; в пачке ${result.quests.length} (порядок: ${result.order})`)
  for (const quest of result.quests) {
    const locales = Object.entries(quest.locales).map(([code, state]) => `${code}: ${state}`).join('; ')
    console.log(`  ${quest.quest_id} (id ${quest.id}) — ${locales}`)
  }
  if (result.cities.length) {
    console.log('Города без названия на локали (совпадает с русским — перевести командой city-name):')
    for (const city of result.cities) console.log(`  ${city.name} (city ${city.city_id}): ${city.locales.join(', ')}`)
  }
  return undefined
}

/** Имена, уже принятые в опубликованных переводах квестов того же города. */
async function collectAcceptedNames(api, bundle, locale, statusRows) {
  const published = new Set(
    statusRows.filter((row) => row.state === 'published' && row.quest_id !== bundle.quest_id).map((row) => row.quest_id),
  )
  if (!published.size || !bundle.city) return []
  const sameCity = (await api.getCatalog())
    .filter((quest) => published.has(quest.quest_id) && Number(quest.city_id) === Number(bundle.city.id))
    .slice(0, ACCEPTED_NAMES_QUESTS)
  const names = new Map()
  for (const quest of sameCity) {
    const [source, translation] = [sourceFromBundle(await api.getBundle(quest.quest_id)), await api.getTranslation(quest.id, locale)]
    if (!translation) continue
    const translated = new Map(translation.steps.map((step) => [step.step_id, step]))
    for (const step of source.steps) {
      const target = translated.get(step.step_id)
      if (step.location && target && target.location && !names.has(step.location)) {
        names.set(step.location, { source: step.location, target: target.location, from_quest: quest.quest_id })
      }
    }
  }
  return [...names.values()]
}

async function commandPrepare(args, api) {
  const { sourceLocale } = getQuestContentLocales()
  const paths = artifactPaths(args.workDir, args.locale, args.quest)
  const bundle = await api.getBundle(args.quest)
  const source = sourceFromBundle(bundle)

  let statusRow = null
  let existing = null
  let acceptedNames = []
  const notes = []
  if (api.hasToken) {
    const statusRows = await api.getStatus(args.locale)
    statusRow = statusRows.find((row) => row.quest_id === args.quest) || null
    existing = statusRow && statusRow.state !== 'missing' ? await api.getTranslation(bundle.id, args.locale) : null
    acceptedNames = await collectAcceptedNames(api, bundle, args.locale, statusRows)
  } else {
    notes.push('Статус переводов не прочитан (нет токена администратора): задание на полный перевод.')
    console.log(`[${NAME}] нет токена — статус переводов не читаю, готовлю полный перевод`)
  }

  const plan = planSteps({ source, statusRow, existing, force: args.force })
  if (plan.locked.length) notes.push(`Шаги с ручным переводом не трогать: ${plan.locked.join(', ')}.`)
  if (plan.mode === 'incremental' && !plan.translate.length && !plan.finaleOutdated) {
    console.log(`${args.quest} → ${args.locale}: перевод опубликован и актуален, переводить нечего — задание не создано`)
    return
  }

  const task = buildTask({
    bundle,
    locale: args.locale,
    sourceLocale,
    plan,
    existing,
    glossary: loadGlossary(args.locale),
    acceptedNames,
    paths,
    notes,
  })
  writeJsonFile(paths.task, task)
  console.log(`Задание: ${relative(paths.task)}`)
  console.log(`  режим ${plan.mode}; шагов к переводу ${plan.translate.length} из ${source.steps.length}; результат → ${relative(paths.translation)}`)
}

function loadArtifacts(args) {
  const paths = artifactPaths(args.workDir, args.locale, args.quest)
  const task = readJsonFile(paths.task)
  if (!task) throw new ExpectedFailureError(`нет задания ${relative(paths.task)} — сначала prepare`)
  let translation
  try {
    translation = readJsonFile(paths.translation)
  } catch (error) {
    throw new ExpectedFailureError(`${relative(paths.translation)} — не JSON: ${error.message}`)
  }
  if (!translation) throw new ExpectedFailureError(`нет файла перевода ${relative(paths.translation)}`)
  return { paths, task, translation }
}

/** Проверки одного перевода; итог записывается в `checks` файла перевода. */
function evaluate(args) {
  const { paths, task, translation } = loadArtifacts(args)
  const structural = runStructuralChecks({ task, translation })
  const structuralOk = structural.every((entry) => entry.ok)
  const semantic = structuralOk ? mergeReview({ task, translation, review: readJsonFile(paths.review) }) : []
  const checks = [...structural, ...semantic]
  if (translation && typeof translation === 'object' && !Array.isArray(translation)) {
    writeJsonFile(paths.translation, { ...translation, checks })
  }
  // Задание проверяющему пересобирается каждый раз: после правки перевода старый
  // вердикт недействителен, и проверять нужно уже новую версию.
  if (structuralOk) writeJsonFile(paths.reviewTask, buildReviewTask({ task, translation, paths }))
  return { paths, task, translation, checks, structuralOk, reviewed: semantic.length > 0 }
}

function printCheckReport({ task, checks }) {
  const scopes = [{ id: null, label: 'квест (название, финал, набор шагов)' }]
  for (const step of task.source.steps) scopes.push({ id: step.step_id, label: `шаг «${step.slug}»` })
  for (const scope of scopes) {
    const entries = checks.filter((entry) => entry.step_id === scope.id)
    if (!entries.length) {
      console.log(`  нет   ${scope.label}`)
      continue
    }
    const failed = entries.filter((entry) => !entry.ok)
    console.log(`  ${failed.length ? 'ОТКАЗ' : 'ok   '} ${scope.label}: ${entries.length - failed.length}/${entries.length}`)
    for (const entry of failed) console.log(`        ${entry.check}: ${entry.detail}`)
  }
}

function commandCheck(args) {
  const result = evaluate(args)
  console.log(`Проверки ${args.quest} → ${args.locale}:`)
  printCheckReport(result)
  const failed = result.checks.filter((entry) => !entry.ok).length
  if (failed) throw new ExpectedFailureError(`${args.quest} → ${args.locale}: не пройдено проверок: ${failed}`)
  console.log(
    result.reviewed
      ? 'Структурные и смысловая проверки зелёные — можно upload --publish.'
      : `Структурные проверки зелёные. Смысловая проверка: задание ${relative(result.paths.reviewTask)} — без её вердикта публикация закрыта.`,
  )
}

/** Тело PUT: шаги с ручным переводом на сервере без --force остаются серверными. */
function buildDocument({ translation, existing, publish, force }) {
  const human = new Map(
    force ? [] : ((existing && existing.steps) || []).filter((step) => step.origin === 'human').map((step) => [step.step_id, step]),
  )
  return {
    document: {
      title: translation.title,
      status: publish ? 'published' : 'draft',
      finale: translation.finale ? { text: translation.finale.text } : null,
      steps: translation.steps.map((step) => apiStep(human.get(step.step_id) || step)),
    },
    keptHuman: [...human.keys()],
  }
}

async function commandUpload(args, api) {
  if (args.publish && args.unpublish) throw new UsageError('--publish и --unpublish исключают друг друга')
  const result = evaluate(args)
  const blockers = uploadBlockers(result.checks, { publish: args.publish })
  if (blockers.length) {
    printCheckReport(result)
    throw new ExpectedFailureError(
      `${args.quest} → ${args.locale}: ${args.publish ? 'публикация' : 'запись черновика'} закрыта — ${blockers[0]}` +
        (blockers.length > 1 ? ` (и ещё ${blockers.length - 1})` : ''),
    )
  }
  const questPk = result.task.quest.id
  const existing = await api.getTranslation(questPk, args.locale)
  if (existing && existing.status === 'published' && !args.publish && !args.unpublish) {
    throw new ExpectedFailureError(
      `${args.quest} → ${args.locale}: перевод опубликован, запись черновиком снимет его с показа — нужен --publish (или --unpublish)`,
    )
  }
  const { document, keptHuman } = buildDocument({ translation: result.translation, existing, publish: args.publish, force: args.force })
  const response = await api.putTranslation(questPk, args.locale, document)
  if (response.status === 400) {
    const errors = ((response.json && response.json.errors) || []).map(
      (error) => `${error.code}${error.step_id ? ` step ${error.step_id}` : ''}${error.field ? ` (${error.field})` : ''}`,
    )
    const missing = (response.json && response.json.missing_step_ids) || []
    throw new ExpectedFailureError(
      `сервер отклонил перевод: ${errors.join('; ') || response.text.slice(0, 300)}` +
        (missing.length ? `; missing_step_ids: ${missing.join(', ')}` : ''),
    )
  }
  if (response.status !== 200) {
    throw new ExpectedFailureError(`PUT перевода: HTTP ${response.status} ${response.text.slice(0, 300)}`)
  }
  const failed = result.checks.filter((entry) => !entry.ok).length
  console.log(
    `${args.quest} → ${args.locale}: записан как ${document.status}, шагов ${document.steps.length}` +
      (keptHuman.length ? `; ручной перевод сохранён в шагах ${keptHuman.join(', ')}` : '') +
      (failed ? `; не пройдено проверок: ${failed} — остаётся черновиком` : ''),
  )
}

async function commandStatus(args, api) {
  const { targets } = getQuestContentLocales()
  const locales = args.locale ? [args.locale] : targets
  const [rows, catalog] = [await api.getStatus(args.locale || undefined), await api.getCatalog()]
  const inCatalog = new Set(catalog.map((quest) => quest.quest_id))
  const status = indexStatus(rows)
  const summary = locales.map((code) => {
    const counts = { locale: code, quests: catalog.length, published: 0, draft: 0, missing: 0, stale: 0, incomplete: 0 }
    for (const questId of inCatalog) {
      const row = (status.get(questId) || new Map()).get(code)
      counts[row ? row.state : 'missing'] += 1
      if (row && row.stale_step_ids.length) counts.stale += 1
      if (row && row.state === 'published' && row.missing_step_ids.length) counts.incomplete += 1
    }
    return counts
  })
  if (args.json) return process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  console.log(`Переводы квестов (квестов в каталоге: ${catalog.length})`)
  console.log('  локаль  published  draft  missing  stale  опубликован без шагов')
  for (const row of summary) {
    console.log(
      `  ${row.locale.padEnd(6)}  ${String(row.published).padStart(9)}  ${String(row.draft).padStart(5)}  ` +
        `${String(row.missing).padStart(7)}  ${String(row.stale).padStart(5)}  ${String(row.incomplete).padStart(8)}`,
    )
  }
  return undefined
}

async function commandCityName(args, api) {
  const name = args.name.trim()
  if (!name) throw new UsageError('--name пуст')
  const saved = await api.putCityName(args.city, args.locale, name)
  console.log(`Город ${args.city} → ${args.locale}: «${saved.name}»`)
}

async function run(args, { fetchImpl, tokenSources } = {}) {
  const command = resolveInvocation(args)
  const api = createApi({ apiUrl: args.apiUrl, token: resolveToken(args.token, tokenSources), fetchImpl })
  if (command === 'next') return commandNext(args, api)
  if (command === 'prepare') return commandPrepare(args, api)
  if (command === 'check') return commandCheck(args)
  if (command === 'upload') return commandUpload(args, api)
  if (command === 'status') return commandStatus(args, api)
  return commandCityName(args, api)
}

async function main() {
  await run(parseCliArgs(process.argv, CLI_SPEC))
}

if (require.main === module) {
  runCli(main, { name: NAME, usage: USAGE })
}

module.exports = { CLI_SPEC, COMMANDS, buildDocument, indexStatus, isIncomplete, parseArgs, resolveInvocation, run }
