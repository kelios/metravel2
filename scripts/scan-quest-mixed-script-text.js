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
 * словаря ему смотреть не на что. Видимый текст есть у КАЖДОГО шага при любом
 * типе ответа — популяция другая, и подмешивать её в счётчики словарного скана
 * значило бы врать обоими отчётами сразу. Общее у скриптов ровно одно —
 * определение смешения, и оно вынесено в `scripts/lib/questScriptMixing.js`,
 * чтобы копии не разошлись.
 *
 * ЧТО ИМЕННО ЧИТАЕТ ИГРОК — и почему `steps` мало. Бандл квеста отдаёт интро
 * ОТДЕЛЬНЫМ объектом `quest.intro`, а не элементом `steps` (`is_intro` у всех
 * элементов `steps` равен 0), и так же устроен локальный `*-quest-data.js`.
 * Первая редакция этого скана обходила только `parseSteps(quest)`, поэтому 147
 * интро прода в отчёт не попадали вовсе — и живая находка «пройdём» в интро
 * `bielsko-biala-cartoon-vienna` пряталась за «Смешанных слов нет». Отсюда
 * `textNodes()`: он собирает ВСЕ текстовые узлы бандла — заголовок квеста,
 * интро, каждый шаг и текст финала, — а не только те, до которых легко
 * дотянуться. Та же грабля повторилась на финале: он лежит в двух формах
 * (`finale.text` и `finale.story`), и первая правка увидела только одну.
 *
 * Baseline у скана нет намеренно: #1464 вычистил все 13 находок на проде и в
 * локальных данных до нуля, поэтому порог здесь нулевой — любая находка валит
 * прогон. Это дешевле и честнее baseline'а: список известных исключений, в
 * который нечего записать, только маскировал бы новые опечатки.
 *
 *   node scripts/scan-quest-mixed-script-text.js                       # весь прод
 *   node scripts/scan-quest-mixed-script-text.js --quest-id=belgrade-white-city
 *   node scripts/scan-quest-mixed-script-text.js --source=scripts/belgrade-quest-data.js
 *   node scripts/scan-quest-mixed-script-text.js --fields=story,task,finale
 *   node scripts/scan-quest-mixed-script-text.js --json
 *
 * Exit code 1, если найдено хотя бы одно слово.
 */

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const { mixedScriptWords, confusableChars } = require('./lib/questScriptMixing')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

// Все поля, которые игрок видит глазами. `answer_pattern` сюда не входит — он не
// текст, и его держит скан достижимости. `finale` — это `quest.finale.text`,
// экран после последнего шага.
const DEFAULT_FIELDS = ['story', 'task', 'hint', 'title', 'location', 'finale']
const KNOWN_FIELDS = new Set(DEFAULT_FIELDS)
// Поля шага (и интро — у него та же форма). Остальные поля квестовые.
const STEP_FIELDS = ['story', 'task', 'hint', 'title', 'location']

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

/**
 * Все текстовые узлы бандла — то, из чего складывается прочитанное игроком.
 * Порядок совпадает с порядком чтения: заголовок квеста → интро → шаги → финал.
 *
 * `scope` в узле нужен отчёту: находка в `quest.title` и находка в `title` шага
 * — разные места, а поле называется одинаково.
 */
function textNodes(quest) {
  const nodes = []
  const push = (scope, stepId, stepDbId, field, value) => {
    if (value != null && value !== '') nodes.push({ scope, step_id: stepId, step_db_id: stepDbId, field, value })
  }

  push('quest', null, null, 'title', quest.title)
  if (quest.intro) {
    for (const field of STEP_FIELDS) push('intro', quest.intro.step_id ?? 'intro', quest.intro.id ?? null, field, quest.intro[field])
  }
  for (const step of parseSteps(quest)) {
    for (const field of STEP_FIELDS) push('step', step.step_id, step.id ?? null, field, step[field])
  }
  // Финал в локальных данных встречается в двух формах: `{title, text}` и
  // `{title, story}`. Обе уезжают в одно и то же поле прода —
  // `scripts/sync-quest-to-prod.js:114` берёт `q.finale.text || q.finale.story`,
  // — поэтому смотреть надо обе, иначе `--source` в check:fast слеп к финалу
  // пяти квестов (`chisinau-white-stone`, `hel-fishermen`, `hel-jurata-amber`,
  // `orheiul-vechi-rock-monastery`, `soroca-round-fortress`). `finale.title` не
  // сканируем сознательно: в прод-сериализатор финала он не попадает вовсе
  // (ключи прод-финала — `text`, `video_url`, `poster_url`, `poster_media`),
  // игрок его не видит.
  push('quest', null, null, 'finale', quest.finale?.text ?? quest.finale?.story)

  return nodes
}

/**
 * Проход по бандлам. Считаем узлы текста, а не шаги: «1237 шагов» в отчёте
 * первой редакции скрывало, что 147 интро вне обхода. Число узлов такой лазейки
 * не оставляет — оно растёт ровно с тем, что скан действительно прочитал.
 */
function scanQuests(quests, fields = DEFAULT_FIELDS) {
  const wanted = new Set(fields)
  const findings = []
  let scannedNodes = 0

  for (const quest of quests) {
    for (const node of textNodes(quest)) {
      if (!wanted.has(node.field)) continue
      scannedNodes++
      for (const word of mixedScriptWords(node.value)) {
        findings.push({
          quest_db_id: quest.id ?? null,
          quest_id: quest.quest_id,
          scope: node.scope,
          step_db_id: node.step_db_id,
          step_id: node.step_id,
          field: node.field,
          word,
          confusables: confusableChars(word),
          context: contextAround(node.value, word),
        })
      }
    }
  }
  return { findings, scannedNodes }
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

/** Где именно нашлось: у квестовых полей шага нет, и «шаг ?» там было бы враньём. */
function placeOf(finding) {
  if (finding.scope === 'quest') return `[quest ${finding.quest_db_id ?? '?'}] ${finding.quest_id} / сам квест`
  const label = finding.scope === 'intro' ? 'интро' : 'шаг'
  return `[quest ${finding.quest_db_id ?? '?'}] ${finding.quest_id} / ${label} ${finding.step_db_id ?? '?'} ${finding.step_id}`
}

function reportText(source, questCount, scannedNodes, fields, findings) {
  console.log(`Скан смешения алфавитов в тексте: ${source} — ${questCount} квестов, ${scannedNodes} текстовых узлов, поля: ${fields.join(', ')}`)
  for (const f of findings) {
    console.log(`\n  ${placeOf(f)}`)
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

  const { findings, scannedNodes } = scanQuests(quests, args.fields)
  const source = args.source || args.apiUrl

  if (args.json) {
    console.log(JSON.stringify({ source, quests: quests.length, scannedNodes, fields: args.fields, findings }, null, 2))
  } else {
    reportText(source, quests.length, scannedNodes, args.fields, findings)
  }

  if (findings.length) process.exitCode = 1
}

module.exports = { scanQuests, textNodes, parseArgs, contextAround, DEFAULT_FIELDS, STEP_FIELDS, KNOWN_FIELDS }

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
