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
 * Exit code 1, если хоть один файл разошёлся с продом.
 */

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const { localQuestDataFiles } = require('./lib/scanBaseline')
const { QUEST_DATA_FILE_PATTERN } = require('./scan-quest-answer-reachability')
const { diffQuest, comparableFields, DEFAULT_API } = require('./lib/questProdDiff')

async function scanFile(file, apiUrl) {
  const quests = loadLocalBundles(file, null)
  const rows = []
  for (const quest of quests) {
    if (!quest?.quest_id) continue
    const [bundle] = await fetchQuestBundles(apiUrl, quest.quest_id)
    const diff = diffQuest(quest, bundle, parseSteps(bundle))
    // Гейт валит только то, что заливка реально перенесёт, — расхождения полей
    // шага и текста интро/финала. Разошедшийся состав шагов заливка не
    // применяет ни в одну сторону (`sync-quest-to-prod.js:107` пропускает шаг,
    // которого нет на проде), поэтому он идёт в отчёт, но не в код возврата.
    const drifted = diff.changed.length || diff.questLevel.length
    const structure = diff.onlyLocal.length || diff.onlyProd.length
    if (drifted || structure) rows.push({ file, ...diff, drifted: Boolean(drifted) })
  }
  return rows
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

  for (const row of rows) {
    console.log(`\n  ${row.file} [${row.quest_id}] — локально ${row.local_steps} шагов, на проде ${row.prod_steps}`)
    if (row.onlyProd.length) console.log(`    шаги только на проде: ${row.onlyProd.join(', ')}`)
    if (row.onlyLocal.length) console.log(`    шаги только локально (заливка их пропустит — структура разошлась): ${row.onlyLocal.join(', ')}`)
    for (const c of row.changed) console.log(`    ${c.step_id} (id ${c.prod_db_id ?? '?'}): ${c.fields.join(', ')}`)
    for (const q of row.questLevel) console.log(`    ${q.scope} / ${q.field}: расходится`)
  }

  const drifted = rows.filter((r) => r.drifted)
  const steps = drifted.reduce((n, r) => n + r.changed.length, 0)
  const infoOnly = rows.length - drifted.length
  if (infoOnly) console.log(`\nРазошёлся состав шагов (заливка его не применяет, гейт не валит): ${infoOnly} квестов`)
  console.log(drifted.length
    ? `\nРазошлись с продом: ${drifted.length} квестов, ${steps} шагов. Перенести прод в файл — node scripts/sync-quest-data-from-prod.js --all`
    : '\nРасхождений с продом нет.')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const files = args.source ? [args.source] : localQuestDataFiles(process.cwd(), QUEST_DATA_FILE_PATTERN)

  const rows = []
  for (const file of files) rows.push(...await scanFile(file, args.apiUrl))

  if (args.json) console.log(JSON.stringify({ files: files.length, rows }, null, 2))
  else reportText(rows, files.length)

  if (rows.some((r) => r.drifted)) process.exitCode = 1
}

module.exports = { scanFile, parseArgs }

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
