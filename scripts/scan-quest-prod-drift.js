#!/usr/bin/env node
/**
 * Скан расхождения локальных data-файлов квестов с продом (#1554).
 *
 * Зачем нужен отдельный инструмент. Контент квестов правится напрямую на проде
 * через `apply-quest-patches.js` — по одному полю одного шага, в рамках
 * конкретного тикета, — а пункт «синхронизировать локальный файл» выполняется
 * пошагово: тикет чинит свой шаг и уходит, соседние поля того же файла отстают
 * дальше. Замер 2026-08-24: 68 разошедшихся шагов в 26 квестах, накопленных за
 * несколько волн контента. Пока расхождение никто не мерил, оно росло молча.
 *
 * Чем это опасно. `scripts/sync-quest-to-prod.js:76-90` переносит поля
 * локального файла на прод БЕЗ проверки свежести, и `--dry-run` по умолчанию не
 * включён. То есть отставший файл — это не «неаккуратность в репозитории», а
 * заряженный откат боевого контента: один обычный запуск штатного инструмента
 * возвращает игрокам тексты, которые уже были починены.
 *
 * Почему скан не в `check:fast`. Он сетевой: обход всей базы — это по одному
 * запросу на квест. Офлайн-гейт по построению не видит состояния прода (это
 * прямо зафиксировано в #1489), и тащить туда сеть значит либо сделать гейт
 * медленным и хрупким, либо получить проверку, которая всегда врёт. Поэтому
 * здесь отдельная команда, а в `check:fast` живёт офлайн-часть класса —
 * `guard-quest-data-sources.js` (уникальность `quest_id` между файлами).
 *
 * Что скан НЕ считает расхождением: `maps_url` (бэкенд генерирует его из
 * координат, локально поля нет вовсе) и координаты интро/финала (локально это
 * заглушка `lat: 0`). Всё остальное, что заливка отправляет, сравнивается —
 * включая `poi_info`. Полный список полей и причины исключений —
 * `scripts/lib/questProdDiff.js`, общий с синхронизатором.
 *
 * Расхождение состава шагов (в файле есть шаг, которого нет на проде, и
 * наоборот) печатается, но гейт не валит: заливка такой шаг ПРОПУСКАЕТ
 * (`sync-quest-to-prod.js:107`), создают шаги только `migrate-*-quest.js`.
 * Гейт валят расхождения полей — то, что заливка действительно перенесёт.
 *
 *   node scripts/scan-quest-prod-drift.js                                  # все локальные файлы
 *   node scripts/scan-quest-prod-drift.js --source=scripts/pinsk-quest-data.js
 *   node scripts/scan-quest-prod-drift.js --json
 *
 * Локальный файл, которому на проде не отвечает ни один квест (404 по слагу),
 * печатается отдельной категорией и код возврата не меняет: заливка такой квест
 * не создаёт, откатить им боевой контент нельзя, а обход остальных файлов должен
 * продолжаться. На 06.09.2026 такой файл в корпусе один —
 * `ozero-glubokoe-quest-data.js`, снятый с публикации в #1652 и намеренно
 * оставленный как обратимый исходник.
 *
 * Корпусный прогон, в котором не сравнился НИ ОДИН квест, при этом падает: это
 * не чистый корпус, а промах по эндпоинту (чужой `METRAVEL_API_URL`, локальный
 * бэкенд без контента, опечатка в `--api-url`). Замер 06.09.2026 на хосте,
 * отвечающем 404 на всё: 175 файлов, 179 квестов, ноль сравнений — и без этой
 * проверки итог был бы «Расхождений с продом нет» с кодом 0, то есть отчёт о
 * чистоте вслепую.
 *
 * Мета квеста (#3373) — точка старта, длительность, сложность, теги,
 * pet_friendly — в бандле `by-quest-id` не приходит, её отдаёт строка каталога.
 * Каталог читается ОДИН раз на прогон (`/api/quests/?page_size=200`, два
 * запроса на весь корпус), а не по запросу на город или квест: у прода 1 CPU.
 * Источник правды для меты — файл, поэтому её расхождение лечит не
 * `sync-quest-data-from-prod.js`, а `sync-quest-to-prod.js --meta-only`.
 * Квест с живым бандлом, которого нет в каталоге, — несверенная мета, и она
 * валит код: иначе пустой или недочитанный каталог давал бы «чисто» по мете
 * всего корпуса.
 *
 * Известные на 12.11.2026 расхождения меты лежат в baseline
 * `scripts/quest-meta-drift-baseline.json` (ключ `<quest_id>|<поле>` по файлу)
 * и применяются по умолчанию: такое расхождение печатается жёлтой строкой и код
 * не валит. Ратчет только вниз: расхождение вне baseline — красный, и запись
 * baseline, которой расхождение больше не отвечает (мету перенесли, поле
 * сошлось, квест ушёл из файла), — тоже красный, пока её не уберут
 * `--prune-baseline`. Пополнять baseline инструментом нельзя.
 *
 * Exit code 1, если хоть один файл разошёлся с продом.
 */

const { DEFAULT_USER_AGENT, fetchQuestBundles, fetchQuestCatalog, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const path = require('path')

const { loadBaseline, localQuestDataFiles, splitByBaseline, writeBaseline } = require('./lib/scanBaseline')
const { QUEST_DATA_FILE_PATTERN } = require('./scan-quest-answer-reachability')
const { diffQuest, diffQuestMeta, formatMetaValue, comparableFields, QUEST_META_FIELDS, DEFAULT_API } = require('./lib/questProdDiff')
const {
  EmptySelectionError,
  parseCliArgs,
  parseCliTokens,
  requireNoBatchFailures,
  requireNonEmptySelection,
  runCli,
} = require('./lib/cli-contract')

const USAGE = `Сверка локальных data-файлов квестов с продом — #1554

Usage:
  node scripts/scan-quest-prod-drift.js [--source <file>] [--api-url <url>] [--baseline <file>] [--prune-baseline] [--json]

Options:
  --source <file>       сверить один data-файл вместо всего корпуса
  --baseline <file>     известные расхождения меты (по умолчанию scripts/quest-meta-drift-baseline.json)
  --prune-baseline      убрать из baseline записи, которым расхождение больше не отвечает (только убирает)
  --api-url <url>       адрес прода (по умолчанию METRAVEL_API_URL или https://metravel.by)
  --json                machine-readable результат на stdout
  --help, -h            напечатать эту справку и выйти`

// Флаг распознаётся по ИМЕНИ, а не по значению: до #1934 скан читал только
// `--source=`, и вызов `--quest-id=brest-lantern` молча уходил в обход всего
// корпуса, печатая «Расхождений с продом нет» — ответ не про тот квест, о
// котором спросили. Обе записи, `--source file.js` и `--source=file.js`,
// разбираются одинаково; неизвестное имя — UsageError.
const CLI_SPEC = {
  name: 'scan-quest-prod-drift',
  usage: USAGE,
  selection: 'quest data files',
  flags: {
    'api-url': { type: 'string', default: DEFAULT_API, stripTrailingSlash: true },
    source: { type: 'string' },
    baseline: { type: 'string', default: 'scripts/quest-meta-drift-baseline.json' },
    'prune-baseline': { type: 'boolean' },
    json: { type: 'boolean' },
  },
}

const BASELINE_PATH = CLI_SPEC.flags.baseline.default
const BASELINE_CONTRACT_VERSION = 1
const PRUNE_COMMAND = 'node scripts/scan-quest-prod-drift.js --prune-baseline'

const metaKey = (questId, field) => `${questId}|${field}`

/**
 * 404 по конкретному квесту — это результат замера, а не сбой замера: сравнивать
 * локальный файл не с чем. Причин три, и все штатные — квест снят с публикации
 * (`status=2` фильтруется этим эндпоинтом, так живёт `ozero-glubokoe-crystal`
 * после #1652), слаг переименован, файл ещё не разлит. Раньше 404 летел наружу
 * наравне с сетевой ошибкой и ронял весь корпусный обход на первом же таком
 * файле — гвардия класса #1554 не измеряла ничего.
 *
 * Остальные коды (5xx, 429, таймаут, обрыв сокета) остаются фатальными: они
 * означают «измерить не удалось», и молчаливое «расхождений нет» было бы там
 * ложью.
 */
function isMissingOnProd(error) {
  return error?.statusCode === 404
}

/**
 * Строки отчёта по одному файлу плюс `compared` — сколько квестов реально
 * удалось сравнить. Счётчик нужен вызывающему, чтобы отличить чистый корпус
 * (сравнили всё, расхождений нет) от корпуса, который не сравнили вовсе: в
 * обоих случаях `rows` не содержит ни одного расхождения.
 */
async function scanFile(file, apiUrl, prodMetaByQuestId, knownMetaKeys = []) {
  const quests = loadLocalBundles(file, null)
  const known = new Set(knownMetaKeys)
  const rows = []
  const staleBaseline = []
  const localIds = new Set(quests.map((q) => q?.quest_id).filter(Boolean))
  for (const key of known) {
    const [questId, field] = key.split('|')
    if (!localIds.has(questId)) staleBaseline.push({ file, quest_id: questId, field, reason: 'квеста нет в файле' })
  }
  let compared = 0
  for (const quest of quests) {
    if (!quest?.quest_id) continue
    let bundle
    try {
      ;[bundle] = await fetchQuestBundles(apiUrl, quest.quest_id)
    } catch (error) {
      if (!isMissingOnProd(error)) throw error
      rows.push({ file, quest_id: quest.quest_id, missingOnProd: true, drifted: false })
      continue
    }
    compared += 1
    const diff = diffQuest(quest, bundle, parseSteps(bundle))
    // Без каталога (вызов без третьего аргумента) мету не сверяем вовсе; квест,
    // которого в каталоге нет при живом бандле, — отдельная пометка, а не «чисто».
    const prodMeta = prodMetaByQuestId ? prodMetaByQuestId.get(quest.quest_id) : undefined
    const metaAll = quest.meta && prodMeta ? diffQuestMeta(quest.meta, prodMeta) : []
    const split = splitByBaseline(metaAll, knownMetaKeys, (m) => [metaKey(quest.quest_id, m.field)])
    diff.meta = split.fresh
    diff.metaKnown = split.known
    diff.metaUnchecked = Boolean(prodMetaByQuestId && quest.meta && !prodMeta)
    // Запись baseline судится только по реально сверенной мете: 404 и «нет в
    // каталоге» ничего не доказывают ни в одну сторону.
    if (quest.meta && prodMeta) {
      const drifting = new Set(metaAll.map((m) => m.field))
      for (const key of known) {
        const [questId, field] = key.split('|')
        if (questId === quest.quest_id && !drifting.has(field)) {
          staleBaseline.push({ file, quest_id: questId, field, reason: 'расхождения больше нет' })
        }
      }
    }
    // Гейт валит то, что заливка реально перенесёт, — расхождения полей шага и
    // текста интро/финала, — и отставший порядок точек: по нему файл меряет
    // гейт маршрута (#2426). Разошедшийся состав шагов заливка не применяет ни
    // в одну сторону (`sync-quest-to-prod.js:107` пропускает шаг, которого нет
    // на проде), поэтому он идёт в отчёт, но не в код возврата.
    const drifted = diff.changed.length || diff.questLevel.length || diff.order || diff.meta.length
    const structure = diff.onlyLocal.length || diff.onlyProd.length
    if (drifted || structure || diff.metaUnchecked || diff.metaKnown.length) rows.push({ file, ...diff, drifted: Boolean(drifted) })
  }
  return { rows, compared, staleBaseline }
}

/**
 * Разбор одних только аргументов, без префикса `node script.js`, — та форма,
 * которой пользуются тесты и ручная проба оператора. Именно она отвечает про
 * переданный флаг, а не срезает его молча (#1934).
 */
const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC)

/**
 * Мета квеста с прода по `quest_id` — из одного обхода каталога. Строки каталога
 * несут ровно те поля, что показывает карточка квеста: `lat`, `lng`,
 * `duration_min`, `difficulty`, `tags`, `pet_friendly`.
 */
async function fetchProdMeta(apiUrl) {
  const rows = await fetchQuestCatalog(apiUrl, DEFAULT_USER_AGENT, { pageSize: 200 })
  return new Map(rows.filter((row) => row?.quest_id).map((row) => [row.quest_id, row]))
}

/** Строки с полями шага / интро / финала / порядком — то, что переносит `sync-quest-data-from-prod.js`. */
const hasContentDrift = (row) => Boolean(row.changed?.length || row.questLevel?.length || row.order)

function reportText(rows, files, compared, staleBaseline = []) {
  console.log(`Сверка локальных data-файлов с продом: ${files} файлов, поля ${comparableFields.join(', ')}, порядок точек и мета квеста (${QUEST_META_FIELDS.join(', ')})`)

  const missing = rows.filter((r) => r.missingOnProd)
  const diffRows = rows.filter((r) => !r.missingOnProd)

  if (missing.length) {
    console.log(`\nСравнивать не с чем — на проде нет квеста с таким слагом: ${missing.length}`)
    console.log('  (снят с публикации, переименован или ещё не разлит — проверить шапку файла)')
    for (const row of missing) console.log(`  ${row.file} [${row.quest_id}]`)
  }

  for (const row of diffRows) {
    console.log(`\n  ${row.file} [${row.quest_id}] — локально ${row.local_steps} шагов, на проде ${row.prod_steps}`)
    if (row.onlyProd.length) console.log(`    шаги только на проде: ${row.onlyProd.join(', ')}`)
    if (row.onlyLocal.length) console.log(`    шаги только локально (заливка их пропустит — структура разошлась): ${row.onlyLocal.join(', ')}`)
    for (const c of row.changed) console.log(`    ${c.step_id} (id ${c.prod_db_id ?? '?'}): ${c.fields.join(', ')}`)
    for (const q of row.questLevel) console.log(`    ${q.scope} / ${q.field}: расходится`)
    if (row.order) console.log(`    порядок точек: файл ${row.order.local.join(' → ')}; прод ${row.order.prod.join(' → ')}`)
    for (const m of row.meta || []) console.log(`    мета / ${m.field}: файл ${formatMetaValue(m.field, m.local)}; прод ${formatMetaValue(m.field, m.prod)}`)
    if (row.metaUnchecked) console.log('    мета не сверена: квеста нет в каталоге /api/quests/ (бандл при этом отвечает)')
    for (const m of row.metaKnown || []) console.log(`    ⚠️ известное расхождение меты (#3373): ${m.field} — файл ${formatMetaValue(m.field, m.local)}; прод ${formatMetaValue(m.field, m.prod)}`)
    if (row.meta?.length) console.log(`    перенести мету файла на прод — node scripts/sync-quest-to-prod.js --source-file=${row.file} --meta-only --dry-run`)
  }

  const drifted = diffRows.filter((r) => r.drifted)
  const steps = drifted.reduce((n, r) => n + r.changed.length, 0)
  const metaDrifted = drifted.filter((r) => r.meta?.length).length
  const contentDrifted = drifted.filter(hasContentDrift).length
  const infoOnly = diffRows.filter((r) => !r.drifted && (r.onlyLocal?.length || r.onlyProd?.length)).length
  if (infoOnly) console.log(`\nРазошёлся состав шагов (заливка его не применяет, гейт не валит): ${infoOnly} квестов`)
  // Охват печатается всегда и рядом с вердиктом: «расхождений нет» после
  // сравнения одного квеста из корпуса — это не чистота, а несравнённый
  // корпус. Нулевой охват `main()` уже валит, но частичный (свой бэкенд с
  // парой засеянных квестов, отставший прод) вердикт не красит, и молча он
  // читался бы как зелёный.
  const visited = Number.isFinite(compared) ? compared + missing.length : null
  const coverage = visited ? ` (сравнено ${compared} из ${visited} квестов)` : ''
  const knownMeta = diffRows.filter((r) => r.metaKnown?.length)
  if (knownMeta.length) console.log(`\nИзвестные расхождения меты (#3373, baseline ${BASELINE_PATH}): ${knownMeta.length} квестов — код не валят`)
  if (staleBaseline.length) {
    console.log(`\nУстаревшие записи baseline меты — потолок только опускается, убрать: ${PRUNE_COMMAND}`)
    for (const s of staleBaseline) console.log(`  ${s.file} [${s.quest_id}] ${s.field}: ${s.reason}`)
  }
  // Бандл и каталог отдаёт один queryset (`status=1`), поэтому живой бандл без
  // строки каталога — неполный замер меты (каталог не прочитался целиком), а не
  // «чисто»: такие квесты валят код так же, как расхождение.
  const unchecked = diffRows.filter((r) => r.metaUnchecked).length
  if (unchecked) console.log(`\nМета не сверена у ${unchecked} квестов: их нет в каталоге /api/quests/ — замер неполный`)
  if (!drifted.length) {
    // Устаревшая запись baseline валит код (`main`), поэтому и текст не зелёный.
    if (!unchecked && !staleBaseline.length) console.log(`\nРасхождений с продом нет${coverage}.`)
    return
  }
  // Два направления — две команды. Контент шагов правят на проде, файл догоняет
  // (`sync-quest-data-from-prod.js`); мету правят в файле, прод догоняет
  // (`sync-quest-to-prod.js --meta-only`, команда — у каждого квеста выше).
  console.log(`\nРазошлись с продом: ${drifted.length} квестов, ${steps} шагов, мета у ${metaDrifted}${coverage}.`)
  if (contentDrifted) console.log(`  Контент шагов (${contentDrifted} квестов): перенести прод в файл — node scripts/sync-quest-data-from-prod.js --all`)
  if (metaDrifted) console.log(`  Мета (${metaDrifted} квестов): источник правды — файл; перенести на прод — node scripts/sync-quest-to-prod.js --source-file=<файл> --meta-only --dry-run, затем --apply`)
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const files = requireNonEmptySelection(
    args.source ? [args.source] : localQuestDataFiles(process.cwd(), QUEST_DATA_FILE_PATTERN),
    {
      what: 'data-файлов квестов',
      source: args.source ? `--source ${args.source}` : 'scripts/',
      hint: 'запускать из корня репозитория',
    },
  )

  const baselinePath = path.resolve(process.cwd(), args.baseline)
  const baseline = loadBaseline(baselinePath, BASELINE_CONTRACT_VERSION)
  const prodMeta = await fetchProdMeta(args.apiUrl)
  const rows = []
  let staleBaseline = []
  let compared = 0
  for (const file of files) {
    const result = await scanFile(file, args.apiUrl, prodMeta, baseline.known?.[file])
    rows.push(...result.rows)
    staleBaseline.push(...result.staleBaseline)
    compared += result.compared
  }
  // Файл, которого больше нет в корпусе, — тоже устаревшая запись (только на
  // корпусном прогоне: точечный `--source` о чужих файлах не судит).
  if (!args.source) {
    for (const [file, keys] of Object.entries(baseline.known || {})) {
      if (files.includes(file)) continue
      for (const key of keys) {
        const [questId, field] = key.split('|')
        staleBaseline.push({ file, quest_id: questId, field, reason: 'файла нет в корпусе' })
      }
    }
  }
  if (args.pruneBaseline && staleBaseline.length) {
    pruneBaseline(baselinePath, baseline, staleBaseline)
    console.error(`Baseline меты: убрано ${staleBaseline.length} устаревших записей из ${args.baseline}`)
    staleBaseline = []
  }

  // Весь корпус ответил 404 — измерения не было. Отдельная категория «на проде
  // нет квеста» задумана под единичный снятый с публикации файл; когда под неё
  // попадает ВЕСЬ корпус, это не состояние контента, а не тот эндпоинт, и
  // напечатать «Расхождений с продом нет» значило бы отчитаться о чистоте
  // вслепую — ровно то ложное зелёное, ради которого гвардия и заведена.
  // Точечный `--source` под правило не подпадает: один намеренно снятый с
  // публикации файл (`ozero-glubokoe-quest-data.js`) — штатный ответ.
  if (!args.source && compared === 0 && rows.some((r) => r.missingOnProd)) {
    throw new EmptySelectionError(
      `на ${args.apiUrl} не нашлось ни одного из ${rows.length} квестов корпуса — `
      + 'сравнивать не с чем, проверь --api-url / METRAVEL_API_URL',
    )
  }

  if (args.json) {
    const flat = (key) => rows.flatMap((r) => (r[key] || []).map((m) => ({ file: r.file, quest_id: r.quest_id, ...m })))
    console.log(JSON.stringify({ files: files.length, compared, metaDrift: flat('meta'), metaKnown: flat('metaKnown'), staleBaseline, rows }, null, 2))
  } else reportText(rows, files.length, compared, staleBaseline)

  // После отчёта, а не вместо него: найденное расхождение — это результат
  // замера, и оператор должен увидеть список раньше вердикта.
  // Единица счёта — сравненный квест и запись baseline: на одном `--source`
  // бывает и несколько разошедшихся квестов, и несколько устаревших записей,
  // а `requireNoBatchFailures` при failed > total отвечает TypeError вместо вердикта.
  const drifted = rows.filter((r) => r.drifted)
  const unchecked = rows.filter((r) => r.metaUnchecked)
  const failingQuests = rows.filter((r) => r.drifted || r.metaUnchecked).length
  requireNoBatchFailures(failingQuests + staleBaseline.length, {
    total: compared + staleBaseline.length,
    message: `разошлись с продом: ${drifted.length} из ${files.length} файлов; устаревших записей baseline меты: ${staleBaseline.length}`
      + (staleBaseline.length ? ` — ${PRUNE_COMMAND}` : '')
      + (unchecked.length ? `; мета не сверена (нет в каталоге): ${unchecked.length}` : ''),
  })
}

/** Ратчет вниз: из baseline только убираются записи, добавить их отсюда нельзя. */
function pruneBaseline(baselinePath, baseline, staleBaseline) {
  const drop = new Set(staleBaseline.map((s) => `${s.file}\n${metaKey(s.quest_id, s.field)}`))
  const known = {}
  for (const [file, keys] of Object.entries(baseline.known || {})) {
    const left = keys.filter((key) => !drop.has(`${file}\n${key}`))
    if (left.length) known[file] = left
  }
  writeBaseline(baselinePath, { contractVersion: baseline.contractVersion, note: baseline.note, known })
}

module.exports = { BASELINE_CONTRACT_VERSION, BASELINE_PATH, CLI_SPEC, USAGE, isMissingOnProd, scanFile, fetchProdMeta, parseArgs, pruneBaseline, reportText, main }

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
