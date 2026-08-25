#!/usr/bin/env node
/**
 * Guard: у каждого квеста ровно один локальный файл-источник (#1554).
 *
 * Ловит две ошибки, каждая из которых кончается молчаливым откатом прода —
 * `scripts/sync-quest-to-prod.js` переносит поля локального файла на прод без
 * проверки свежести, и `--dry-run` у него по умолчанию выключен.
 *
 *   1) `duplicate_quest_id` — один `quest_id` описан в двух data-файлах. Правка
 *      в одном отменяется заливкой второго, и никакой ошибки при этом не
 *      возникает. Так прожили `hel-fishermen` (`hel-city-quest-data.js` против
 *      `hel-fishermen-quest-data.js`) и три краковских района
 *      (`krakow-district-quests-data.js` против по-квестовых файлов): старый
 *      батч-файл не убрали при переходе на по-квестовую конвенцию.
 *
 *   2) `unregistered_source` — файл несёт данные квеста, но не назван
 *      `*-quest-data.js` / `*-quests-data.js`. Такой файл невидим для ВСЕХ
 *      инструментов проекта: пять квест-сканов `check:fast` его не проверяют,
 *      сверка с продом не сверяет, поиск дублей не находит. Ровно так
 *      `migrate-quests-to-backend-data.js` четыре месяца держал устаревшие копии
 *      `krakow-dragon`, `pakocim-voices`, `barkovshchina-spirits` и `minsk-cmok`
 *      мимо любого контроля, и нашёлся только руками.
 *
 * Проверка офлайновая и потому живёт в `check:fast`. Вторая половина класса —
 * расхождение локального файла с продом — сетевая и вынесена в отдельный
 * `scripts/scan-quest-prod-drift.js`: офлайн-гейт по построению не видит
 * состояния прода (#1489).
 *
 *   node scripts/guard-quest-data-sources.js
 *   node scripts/guard-quest-data-sources.js --json
 *
 * Exit code 1 при любой находке.
 */

const fs = require('fs')
const path = require('path')

const { parse } = require('@babel/parser')

const { QUEST_DATA_FILE_PATTERN } = require('./scan-quest-answer-reachability')

// Дешёвый отсев: файл вообще не упоминает `quest_id` — разбирать нечего.
const MENTIONS_QUEST_ID = /quest_id/

/**
 * Квесты, которые файл описывает, — по РАЗБОРУ исходника, без его исполнения.
 *
 * Исполнять нельзя категорически. Первая редакция звала `require()` на каждый
 * скрипт, упоминающий `quest_id`, и на первом же прогоне запустила
 * `scripts/add-quest-spots.js` — у него нет гарда `require.main === module`, он
 * вызывает `main()` прямо при загрузке и сразу идёт писать на прод. Обошлось
 * только потому, что тот скрипт идемпотентен по `step_id`. Guard, который ради
 * проверки чистоты дерева выполняет произвольные CLI-скрипты, опаснее того,
 * что он проверяет.
 *
 * Разбор AST заодно точнее регулярки: он видит `steps: STEPS` и шорткат
 * `{ quest_id, steps }`, на которых текстовый поиск молчал.
 */
function describedQuests(source, file) {
  let ast
  try {
    ast = parse(source, { sourceType: 'unambiguous', errorRecovery: true, plugins: ['objectRestSpread'] })
  } catch {
    // Файл не разбирается — гейту сказать о нём нечего, а падать на чужом
    // синтаксисе он не должен.
    return []
  }

  const found = []
  const seen = new Set()
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (node.type === 'ObjectExpression') {
      const names = new Map()
      for (const prop of node.properties) {
        if (prop.type !== 'ObjectProperty' && prop.type !== 'Property') continue
        const key = prop.key?.name ?? prop.key?.value
        if (key) names.set(key, prop.value)
      }
      // `quest_id` обязан быть СТРОКОВЫМ ЛИТЕРАЛОМ: только это значит, что файл
      // сам описывает квест. Вычисляемый `quest_id: bundle.quest_id` — признак
      // трансформации чужих данных, так строят объекты сами квест-сканы и
      // `quest-geocheck.js`, и метить их источником нельзя.
      const literal = names.get('quest_id')
      if (names.has('steps') && literal && literal.type === 'StringLiteral' && literal.value) {
        if (!seen.has(literal.value)) {
          seen.add(literal.value)
          found.push({ quest_id: literal.value, file })
        }
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue
      visit(node[key])
    }
  }
  visit(ast.program ?? ast)
  return found
}

function scanScripts(rootDir) {
  const dir = path.join(rootDir, 'scripts')
  const findings = []
  const owners = new Map()

  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.js')).sort()) {
    const file = `scripts/${name}`
    const source = fs.readFileSync(path.join(dir, name), 'utf8')
    if (!MENTIONS_QUEST_ID.test(source)) continue

    const quests = describedQuests(source, file)
    if (!quests.length) continue

    if (!QUEST_DATA_FILE_PATTERN.test(name)) {
      findings.push({
        kind: 'unregistered_source',
        file,
        quest_ids: quests.map((q) => q.quest_id),
        detail: 'файл описывает данные квеста, но не назван *-quest-data.js — его не видит ни один инструмент проекта',
      })
      continue
    }

    for (const quest of quests) {
      if (!owners.has(quest.quest_id)) owners.set(quest.quest_id, [])
      if (!owners.get(quest.quest_id).includes(file)) owners.get(quest.quest_id).push(file)
    }
  }

  for (const [id, files] of [...owners].sort()) {
    if (files.length < 2) continue
    findings.push({
      kind: 'duplicate_quest_id',
      file: files[0],
      quest_ids: [id],
      detail: `квест описан в ${files.length} файлах: ${files.join(', ')} — заливка одного отменит правки в другом`,
    })
  }

  return { findings, quests: owners.size }
}

function reportText({ findings, quests }) {
  console.log(`Guard источников quest-data: ${quests} квестов в локальных файлах`)
  for (const f of findings) {
    console.log(`\n  ${f.kind}: ${f.file}`)
    console.log(`    ${f.detail}`)
    if (f.kind === 'unregistered_source') console.log(`    quest_id внутри: ${f.quest_ids.join(', ')}`)
  }
  console.log(findings.length ? `\nНарушений: ${findings.length}` : '\nНарушений нет.')
}

function main() {
  const json = process.argv.includes('--json')
  const result = scanScripts(process.cwd())
  if (json) console.log(JSON.stringify(result, null, 2))
  else reportText(result)
  if (result.findings.length) process.exitCode = 1
}

module.exports = { describedQuests, scanScripts, MENTIONS_QUEST_ID }

if (require.main === module) main()
