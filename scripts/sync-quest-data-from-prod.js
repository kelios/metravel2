#!/usr/bin/env node
/**
 * Приводит локальный `scripts/<город>-quest-data.js` к тому, что уже стоит на
 * проде (#1554). Направление ровно одно: прод → файл. Обратное направление —
 * это `scripts/sync-quest-to-prod.js`, и именно его опасность породила задачу.
 *
 * Зачем инструмент, а не разовая правка. Контент квестов правится напрямую на
 * проде через `scripts/apply-quest-patches.js` — по одному полю одного шага, в
 * рамках конкретного тикета. Пункт «синхронизировать локальный файл» при этом
 * выполняется ПОШАГОВО: тикет чинит свой шаг и уходит, а соседние поля того же
 * файла отстают дальше. За несколько волн контента накопилось 68 разошедшихся
 * шагов в 26 квестах, и любой запуск `sync-quest-to-prod.js` на таком файле
 * молча вернул бы прод на устаревший текст.
 *
 * Почему правка текстовая, а не перегенерация файла. Data-файлы написаны
 * руками и у каждого свои идиомы записи (`JSON.stringify([...])` против готовой
 * JSON-строки, одинарные кавычки против двойных). Перегенерация дала бы
 * гарантированный паритет ценой полной перезаписи 26 файлов — diff, в котором
 * настоящую правку контента уже не разглядеть. Поэтому меняется только значение
 * разошедшегося поля, в той же форме записи, что и было; если форму опознать не
 * удалось, поле не трогается и попадает в отчёт как `не заменено`.
 *
 * Гарантия корректности не в самой замене, а в проверке после неё: файл
 * перечитывается с диска и сравнивается с продом заново. Пока сверка не даёт
 * ноль расхождений, работа не считается сделанной.
 *
 *   node scripts/sync-quest-data-from-prod.js --source=scripts/pinsk-quest-data.js --dry-run
 *   node scripts/sync-quest-data-from-prod.js --source=scripts/pinsk-quest-data.js
 *   node scripts/sync-quest-data-from-prod.js --all --dry-run
 */

const fs = require('fs')
const path = require('path')

const { fetchQuestBundles, parseSteps } = require('./lib/questBundles')
const { localQuestDataFiles } = require('./lib/scanBaseline')
const { QUEST_DATA_FILE_PATTERN } = require('./scan-quest-answer-reachability')
const { comparableFields, diffStep, diffQuestLevel, DEFAULT_API } = require('./lib/questProdDiff')

// ===================== Представление значения в исходнике =====================

/**
 * Формы записи значения в data-файле, в ФИКСИРОВАННОМ порядке стилей.
 *
 * Порядок важнее содержимого: старое значение ищется по стилю i, новое ставится
 * стилем того же i. Первая редакция строила список от структуры значения — и на
 * шаге `mir-castle/church`, где прод сменил тип ответа с `exact_any` на `range`,
 * индексы разъехались: под индексом старого массива у нового значения оказался
 * стиль от объекта. Поэтому стиль теперь не зависит от того, массив внутри,
 * объект или строка.
 */
function sourceShapes(field, value) {
  if (value == null) return []
  if (field === 'answer_pattern') {
    const ap = typeof value === 'string' ? JSON.parse(value) : value
    const raw = typeof ap.value === 'string' ? ap.value : JSON.stringify(ap.value)
    const inner = typeof ap.value === 'string' ? tryParse(ap.value) ?? ap.value : ap.value
    return [
      `{ type: 'REPL', value: INNER }`.replace('REPL', ap.type).replace('INNER', innerLiteral(inner, raw, "'", ', ')),
      `{ type: 'REPL', value: INNER }`.replace('REPL', ap.type).replace('INNER', innerLiteral(inner, raw, "'", ',')),
      `{ type: "REPL", value: INNER }`.replace('REPL', ap.type).replace('INNER', innerLiteral(inner, raw, '"', ', ')),
      `{ type: "REPL", value: INNER }`.replace('REPL', ap.type).replace('INNER', innerLiteral(inner, raw, '"', ',')),
      JSON.stringify({ type: ap.type, value: raw }),
    ]
  }
  // Число без якоря по имени поля неуникально: `0` и `52.1129` встречаются в
  // файле десятки раз, и замена попала бы в чужой шаг.
  if (field === 'lat' || field === 'lng') return [`${field}: ${value}`]
  if (field === 'poi_info') return [jsObject(value), JSON.stringify(value)]
  return [jsString(String(value), "'"), jsString(String(value), '"')]
}

/** Внутреннее значение `answer_pattern`: массив форм, объект-параметры или готовая строка. */
function innerLiteral(inner, raw, quote, separator) {
  if (Array.isArray(inner)) {
    return `JSON.stringify([${inner.map((f) => jsString(String(f), quote)).join(separator)}])`
  }
  if (inner && typeof inner === 'object') {
    const body = Object.entries(inner).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(separator)
    return separator === ', ' ? `JSON.stringify({ ${body} })` : `JSON.stringify({${body}})`
  }
  return jsString(raw, quote)
}

function tryParse(s) { try { return JSON.parse(s) } catch { return null } }

/** JS-литерал строки в заданных кавычках — ровно так, как их пишут в data-файлах. */
function jsString(value, quote) {
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(new RegExp(quote, 'g'), `\\${quote}`)
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
  return `${quote}${escaped}${quote}`
}

function jsObject(value) {
  return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${typeof v === 'string' ? jsString(v, "'") : JSON.stringify(v)}`).join(', ')} }`
}

/**
 * Замена одного поля. Ищет старое значение в той форме, в какой оно записано, и
 * ставит новое в ТОЙ ЖЕ форме. Требует ровно одного вхождения: два вхождения
 * значат, что то же значение стоит ещё где-то, и слепая замена испортила бы
 * чужой шаг.
 */
function replaceField(text, field, oldValue, newValue) {
  const olds = sourceShapes(field, oldValue)
  for (let i = 0; i < olds.length; i++) {
    const old = olds[i]
    if (text.split(old).length !== 2) continue
    const fresh = sourceShapes(field, newValue)[i]
    if (fresh === undefined) continue
    return { text: text.replace(old, fresh), ok: true }
  }
  return { text, ok: false }
}

// ===================== Синхронизация файла =====================

async function syncFile(file, { apiUrl, dryRun }) {
  const abs = path.resolve(process.cwd(), file)
  let text = fs.readFileSync(abs, 'utf8')
  delete require.cache[require.resolve(abs)]
  const data = require(abs)
  const quests = Array.isArray(data) ? data : [data]

  const applied = []
  const skipped = []

  for (const quest of quests) {
    if (!quest?.quest_id) continue
    const [bundle] = await fetchQuestBundles(apiUrl, quest.quest_id)
    const prodSteps = new Map(parseSteps(bundle).map((s) => [s.step_id, s]))

    for (const step of quest.steps || []) {
      const prod = prodSteps.get(step.step_id)
      if (!prod) continue
      for (const field of diffStep(step, prod)) {
        const result = replaceField(text, field, step[field], prod[field])
        const row = { quest_id: quest.quest_id, step_id: step.step_id, field }
        if (result.ok) { text = result.text; applied.push(row) } else skipped.push(row)
      }
    }

    for (const { scope, field, local, prod } of diffQuestLevel(quest, bundle)) {
      const result = replaceField(text, field, local, prod)
      const row = { quest_id: quest.quest_id, step_id: scope, field }
      if (result.ok) { text = result.text; applied.push(row) } else skipped.push(row)
    }
  }

  if (!dryRun && applied.length) fs.writeFileSync(abs, text, 'utf8')
  return { file, applied, skipped }
}

// ===================== CLI =====================

function parseArgs(argv) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  return {
    apiUrl: get('api-url') || DEFAULT_API,
    source: get('source') || null,
    all: argv.includes('--all'),
    dryRun: argv.includes('--dry-run'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.source && !args.all) {
    console.error('Укажи --source=scripts/<город>-quest-data.js или --all')
    process.exit(1)
  }
  const files = args.source ? [args.source] : localQuestDataFiles(process.cwd(), QUEST_DATA_FILE_PATTERN)

  let applied = 0
  let skipped = 0
  for (const file of files) {
    const result = await syncFile(file, args)
    if (!result.applied.length && !result.skipped.length) continue
    console.log(`\n${file}${args.dryRun ? ' [DRY]' : ''}`)
    for (const row of result.applied) console.log(`  ← ${row.step_id} / ${row.field}`)
    for (const row of result.skipped) console.log(`  НЕ ЗАМЕНЕНО ${row.step_id} / ${row.field} — форма записи не опознана`)
    applied += result.applied.length
    skipped += result.skipped.length
  }

  console.log(`\nПеренесено полей: ${applied}${args.dryRun ? ' (DRY RUN, файлы не тронуты)' : ''}`)
  if (skipped) {
    console.log(`Не заменено: ${skipped} — правь вручную и прогоняй сверку заново.`)
    process.exitCode = 1
  }
}

module.exports = { sourceShapes, jsString, replaceField, comparableFields, parseArgs }

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
