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
 * Exit code 1, если хоть один файл разошёлся с продом.
 */

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const { localQuestDataFiles } = require('./lib/scanBaseline')
const { QUEST_DATA_FILE_PATTERN } = require('./scan-quest-answer-reachability')
const { diffQuest, comparableFields, DEFAULT_API } = require('./lib/questProdDiff')

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
async function scanFile(file, apiUrl) {
  const quests = loadLocalBundles(file, null)
  const rows = []
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
    // Гейт валит только то, что заливка реально перенесёт, — расхождения полей
    // шага и текста интро/финала. Разошедшийся состав шагов заливка не
    // применяет ни в одну сторону (`sync-quest-to-prod.js:107` пропускает шаг,
    // которого нет на проде), поэтому он идёт в отчёт, но не в код возврата.
    const drifted = diff.changed.length || diff.questLevel.length
    const structure = diff.onlyLocal.length || diff.onlyProd.length
    if (drifted || structure) rows.push({ file, ...diff, drifted: Boolean(drifted) })
  }
  return { rows, compared }
}

function parseArgs(argv) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  return {
    apiUrl: get('api-url') || DEFAULT_API,
    source: get('source') || null,
    json: argv.includes('--json'),
  }
}

function reportText(rows, files) {
  console.log(`Сверка локальных data-файлов с продом: ${files} файлов, поля ${comparableFields.join(', ')}`)

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
  }

  const drifted = diffRows.filter((r) => r.drifted)
  const steps = drifted.reduce((n, r) => n + r.changed.length, 0)
  const infoOnly = diffRows.length - drifted.length
  if (infoOnly) console.log(`\nРазошёлся состав шагов (заливка его не применяет, гейт не валит): ${infoOnly} квестов`)
  console.log(drifted.length
    ? `\nРазошлись с продом: ${drifted.length} квестов, ${steps} шагов. Перенести прод в файл — node scripts/sync-quest-data-from-prod.js --all`
    : '\nРасхождений с продом нет.')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const files = args.source ? [args.source] : localQuestDataFiles(process.cwd(), QUEST_DATA_FILE_PATTERN)

  const rows = []
  let compared = 0
  for (const file of files) {
    const result = await scanFile(file, args.apiUrl)
    rows.push(...result.rows)
    compared += result.compared
  }

  // Весь корпус ответил 404 — измерения не было. Отдельная категория «на проде
  // нет квеста» задумана под единичный снятый с публикации файл; когда под неё
  // попадает ВЕСЬ корпус, это не состояние контента, а не тот эндпоинт, и
  // напечатать «Расхождений с продом нет» значило бы отчитаться о чистоте
  // вслепую — ровно то ложное зелёное, ради которого гвардия и заведена.
  // Точечный `--source` под правило не подпадает: один намеренно снятый с
  // публикации файл (`ozero-glubokoe-quest-data.js`) — штатный ответ.
  if (!args.source && compared === 0 && rows.some((r) => r.missingOnProd)) {
    throw new Error(
      `на ${args.apiUrl} не нашлось ни одного из ${rows.length} квестов корпуса — `
      + 'сравнивать не с чем, проверь --api-url / METRAVEL_API_URL',
    )
  }

  if (args.json) console.log(JSON.stringify({ files: files.length, rows }, null, 2))
  else reportText(rows, files.length)

  if (rows.some((r) => r.drifted)) process.exitCode = 1
}

module.exports = { isMissingOnProd, scanFile, parseArgs, reportText, main }

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
