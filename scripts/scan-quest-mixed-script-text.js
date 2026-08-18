#!/usr/bin/env node
/**
 * Скан смешения алфавитов в ВИДИМОМ ИГРОКУ тексте шага квеста (#1464).
 *
 * Родственник `scan-quest-answer-reachability.js` (#1450) по механике и его
 * противоположность по последствию. Там слово с подменённой буквой лежит в
 * словаре `exact_any`, сравнивается `buildAnswerChecker` строгим равенством, и
 * игрок получает «Неверный ответ» на верный ввод — шаг ломается. Здесь то же
 * слово лежит в `story`/`task`/`hint`/`title`/`location`, которые просто
 * рендерятся текстом (`components/quests/questWizardStepCard.tsx`): прохождение
 * не страдает, но игрок читает опечатку — «brusчатка старого Белграда»,
 * «площадь Луža», «Гора Трёх Крестов — память о морe».
 *
 * Почему отдельный скрипт, а не флаг у скана достижимости: тот сканирует только
 * шаги с типом ответа `exact_any` и пропускает `is_intro`, потому что вне
 * словаря ему смотреть не на что. Видимый текст есть у КАЖДОГО шага, включая
 * интро, при любом типе ответа — популяция шагов другая, и подмешивать её в
 * счётчики словарного скана значило бы врать обоими отчётами сразу. Общее у
 * скриптов ровно одно — определение смешения, и оно вынесено в
 * `scripts/lib/questScriptMixing.js`, чтобы копии не разошлись.
 *
 * Baseline у скана нет намеренно: #1464 вычистил все 13 находок на проде и в
 * локальных данных до нуля, поэтому порог здесь нулевой — любая находка валит
 * прогон. Это дешевле и честнее baseline'а: список известных исключений, в
 * который нечего записать, только маскировал бы новые опечатки.
 *
 *   node scripts/scan-quest-mixed-script-text.js                       # весь прод
 *   node scripts/scan-quest-mixed-script-text.js --quest-id=belgrade-white-city
 *   node scripts/scan-quest-mixed-script-text.js --source=scripts/belgrade-quest-data.js
 *   node scripts/scan-quest-mixed-script-text.js --fields=story,task
 *   node scripts/scan-quest-mixed-script-text.js --json
 *
 * Exit code 1, если найдено хотя бы одно слово.
 */

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const { mixedScriptWords, confusableChars } = require('./lib/questScriptMixing')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

// Все поля шага, которые игрок видит глазами. `answer_pattern` сюда не входит —
// он не текст, и его держит скан достижимости.
const DEFAULT_FIELDS = ['story', 'task', 'hint', 'title', 'location']
const KNOWN_FIELDS = new Set(DEFAULT_FIELDS)

// Сколько символов текста вокруг слова показать в отчёте: подменённую букву
// глазами не видно, и без фразы находку невозможно проверить.
const CONTEXT_RADIUS = 45

/** Кусок текста вокруг первого вхождения слова — чтобы находку было где искать. */
function contextAround(text, word) {
  const value = String(text == null ? '' : text)
  const at = value.indexOf(word)
  if (at < 0) return ''
  const from = Math.max(0, at - CONTEXT_RADIUS)
  const to = Math.min(value.length, at + word.length + CONTEXT_RADIUS)
  return `${from > 0 ? '…' : ''}${value.slice(from, to).replace(/\s+/g, ' ')}${to < value.length ? '…' : ''}`
}

/** Находки одного шага по перечисленным полям. */
function scanStepText(step, fields = DEFAULT_FIELDS) {
  const findings = []
  for (const field of fields) {
    for (const word of mixedScriptWords(step[field])) {
      findings.push({
        field,
        word,
        confusables: confusableChars(word),
        context: contextAround(step[field], word),
      })
    }
  }
  return findings
}

/**
 * Проход по бандлам. В отличие от скана достижимости берём ВСЕ шаги: интро тоже
 * читается игроком, а тип ответа к тексту отношения не имеет.
 */
function scanQuests(quests, fields = DEFAULT_FIELDS) {
  const findings = []
  let scannedSteps = 0

  for (const quest of quests) {
    for (const step of parseSteps(quest)) {
      scannedSteps++
      for (const finding of scanStepText(step, fields)) {
        findings.push({
          quest_db_id: quest.id ?? null,
          quest_id: quest.quest_id,
          step_db_id: step.id ?? null,
          step_id: step.step_id,
          ...finding,
        })
      }
    }
  }
  return { findings, scannedSteps }
}

function parseArgs(argv) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  const fields = (get('fields') || DEFAULT_FIELDS.join(',')).split(',').map((f) => f.trim()).filter(Boolean)
  for (const field of fields) {
    if (!KNOWN_FIELDS.has(field)) throw new Error(`неизвестное поле --fields=${field}`)
  }
  return {
    apiUrl: get('api-url') || DEFAULT_API,
    questId: get('quest-id') || null,
    source: get('source') || null,
    fields,
    json: argv.includes('--json'),
  }
}

function reportText(source, questCount, scannedSteps, fields, findings) {
  console.log(`Скан смешения алфавитов в тексте: ${source} — ${questCount} квестов, ${scannedSteps} шагов, поля: ${fields.join(', ')}`)
  for (const f of findings) {
    console.log(`\n  [quest ${f.quest_db_id ?? '?'}] ${f.quest_id} / шаг ${f.step_db_id ?? '?'} ${f.step_id}`)
    console.log(`    ${f.field}: «${f.word}» — буквы чужого алфавита: ${f.confusables}`)
    console.log(`    ${f.context}`)
  }
  console.log(findings.length
    ? `\nСлов со смешанным алфавитом: ${findings.length}. Каждое слово пишется одним алфавитом целиком.`
    : '\nСмешанных слов нет.')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const quests = args.source
    ? loadLocalBundles(args.source, args.questId)
    : await fetchQuestBundles(args.apiUrl, args.questId)

  const { findings, scannedSteps } = scanQuests(quests, args.fields)
  const source = args.source || args.apiUrl

  if (args.json) {
    console.log(JSON.stringify({ source, quests: quests.length, scannedSteps, fields: args.fields, findings }, null, 2))
  } else {
    reportText(source, quests.length, scannedSteps, args.fields, findings)
  }

  if (findings.length) process.exitCode = 1
}

module.exports = { scanStepText, scanQuests, parseArgs, contextAround, DEFAULT_FIELDS, KNOWN_FIELDS }

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
