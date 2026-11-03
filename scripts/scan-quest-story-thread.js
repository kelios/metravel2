#!/usr/bin/env node
/**
 * Скан сквозной нити квеста — то, чего не видит `quest-gates.js` (#2963).
 *
 * Гейт меряет долю проверяемых шагов и объём текста, но не историю. Партии
 * правок «проверяемые ответы» (`3aed14bb2` / #2433 от 13.10.2026 — Цмок,
 * `0a92351a8` от 18.10.2026 — Тракторный посёлок) прошли его зелёными, хотя
 * разрезали объекты на пары шагов («Та же табличка», «Тот же торец», «Тот же
 * декоративный вход») и заменили рассказ точки общими фразами о самом задании
 * («Здесь не нужно искать скрытую табличку», «искать его … не придётся»).
 * Обе потери вернули ручным ревью (#2958, #2959).
 *
 * Три проверки по data-файлу, без сети:
 *
 * 1. `same-object` — шаг стоит у того же объекта, что предыдущий обязательный
 *    (точки «по желанию» пропускаются: кофейня у точки — норма маршрута):
 *    - координаты ближе `SAME_POINT_M` — почти совпадают;
 *    - `title` или `location` говорит «тот же / та же / то же …»;
 *    - нормализованный `location` совпадает дословно, или `task` говорит «у той
 *      же доски», — и точки ближе `SAME_PHRASE_M` (общий адрес «Михайловский
 *      сквер» у двух скульптур в 50 м — разные объекты; оборот «один и тот же
 *      знак» про повтор внутри объекта не в счёт).
 *    Порог координат взят по корпусу 03.11.2026: соседние ОТДЕЛЬНЫЕ объекты
 *    (детали замка, фонари и фигуры детских маршрутов, Роланд и ратуша в
 *    Бремене) стоят в 6–30 м, а копия координат объекта — в 0–5 м. Порог
 *    25–40 м по одним координатам краснил бы первые.
 * 2. `no-thread` — у story обязательного шага нет НИ одной общей значимой
 *    основы со сквозной нитью (название квеста и интро) И ни одной с соседними
 *    обязательными шагами (title/location/story). Основа — слово без
 *    окончания (тот же список окончаний, что у морфологического прохода
 *    ответа) с беглой гласной, первые `STEM_LENGTH` букв. Служебные и
 *    вездесущие слова прогулки («город», «улица», «здесь») в основу не идут.
 *    Эвристика нарочно консервативная: одна общая основа с соседом уже мостик,
 *    поэтому краснеет только рассказ, оторванный от всего вокруг.
 * 3. `filler` — шаблонная фраза-«вода» из `FILLER_PATTERNS`: рассказ о том,
 *    чего на точке делать НЕ надо, о «масштабе» и «приметах» вместо объекта.
 *    Список собран по правкам-источникам `0a92351a8` и `3aed14bb2`; новая
 *    находка редакции — новая строка списка с примером в тесте.
 *
 *   node scripts/scan-quest-story-thread.js --source=scripts/<city>-quest-data.js
 *   node scripts/scan-quest-story-thread.js --source=… --baseline=scripts/quest-story-thread-baseline.json
 *   node scripts/scan-quest-story-thread.js                     # все локальные data-файлы
 *   node scripts/scan-quest-story-thread.js --update-baseline   # переписать baseline
 *   node scripts/scan-quest-story-thread.js --json
 *
 * Exit code 1, если хотя бы у одного квеста выборки есть находка вне baseline.
 */

const path = require('path')

const { loadLocalBundles } = require('./lib/questBundles')
const { ENDINGS } = require('./lib/questAnswerMorphology')
const { declaredRole, isOptionalByTitle } = require('./lib/questPointRoles')
const { haversineMeters } = require('./quest-geocheck')
const { loadBaseline, localQuestDataFiles, splitByBaseline, writeBaseline } = require('./lib/scanBaseline')
const { QUEST_DATA_FILE_PATTERN } = require('./scan-quest-answer-reachability')
const { getQuestIntro, getQuestSteps } = require('../utils/questStoryText')
const {
  parseCliArgs,
  parseCliTokens,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runCli,
  UsageError,
} = require('./lib/cli-contract')

const SAME_POINT_M = 5
const SAME_PHRASE_M = 40
const STEM_LENGTH = 6
const MIN_STEM_LENGTH = 4

// ===================== Нормализация и основы слов =====================

const normText = (text) => String(text ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
const words = (text) => normText(text).match(/\p{L}+/gu) || []

const ENDINGS_BY_LENGTH = [3, 2, 1].map((length) => [...ENDINGS].filter((e) => e.length === length))

function stemOf(word) {
  let stem = word
  for (const group of ENDINGS_BY_LENGTH) {
    const ending = group.find((e) => stem.endsWith(e) && stem.length - e.length >= MIN_STEM_LENGTH)
    if (ending) {
      stem = stem.slice(0, -ending.length)
      break
    }
  }
  // Беглая гласная: «осколок» → «осколк», как «осколки», «посёлок» → «поселк».
  const fleeting = /^(.{2,})[ое]([кц])$/.exec(stem)
  if (fleeting) stem = fleeting[1] + fleeting[2]
  return stem.slice(0, STEM_LENGTH)
}

/**
 * Служебные слова и слова, которые стоят почти в каждом тексте прогулки: общая
 * основа «город» или «здесь» не делает рассказ частью нити.
 */
const STOP_WORDS = [
  'этот', 'этого', 'этому', 'этом', 'этой', 'эта', 'эти', 'этих', 'это',
  'здесь', 'теперь', 'тогда', 'когда', 'потом', 'после', 'перед', 'через', 'между', 'около', 'рядом',
  'вокруг', 'возле', 'напротив', 'только', 'также', 'тоже', 'более', 'менее', 'очень', 'можно', 'нужно',
  'если', 'чтобы', 'сейчас', 'сегодня', 'всего', 'всех', 'весь', 'всей', 'свой', 'свою', 'своей', 'своих',
  'самый', 'самая', 'самое', 'самые', 'который', 'которая', 'которое', 'которые', 'которых', 'которой',
  'один', 'одна', 'одно', 'одни', 'одной', 'одного', 'была', 'было', 'были', 'будет', 'стал', 'стала',
  'стали', 'стало', 'именно', 'почти', 'даже', 'лишь', 'каждый', 'каждая', 'другой', 'другая', 'другие',
  'такой', 'такая', 'такие', 'много', 'многие', 'несколько', 'всегда', 'никогда', 'где', 'куда', 'откуда',
  'потому', 'поэтому', 'однако', 'хотя', 'просто', 'совсем', 'конечно', 'сразу', 'снова',
  'город', 'города', 'городской', 'улица', 'улицы', 'место', 'места', 'точка', 'точки', 'маршрут',
  'прогулка', 'прогулки', 'квест', 'история', 'истории', 'здание', 'века', 'годы', 'году', 'года',
  'сторона', 'стороны', 'взгляд', 'видно', 'смотри', 'найди', 'посмотри', 'подойди',
]
const STOP_STEMS = new Set(STOP_WORDS.map(stemOf))

function significantStems(...texts) {
  const stems = new Set()
  for (const text of texts) {
    for (const word of words(text)) {
      if (word.length < MIN_STEM_LENGTH) continue
      const stem = stemOf(word)
      if (stem.length >= MIN_STEM_LENGTH && !STOP_STEMS.has(stem)) stems.add(stem)
    }
  }
  return stems
}

const intersects = (a, b) => [...a].some((stem) => b.has(stem))

// ===================== Шаги и расстояния =====================

// Роль — как у геометрии маршрута (`quest-geocheck.js`): заявленная авторитетна,
// без неё — обещание необязательности в заголовке.
const isOptionalStep = (step) => (declaredRole(step) ? declaredRole(step) === 'optional' : isOptionalByTitle(step))

function coordsOf(step) {
  const lat = Number(step.lat)
  const lng = Number(step.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null
}

// «Та же табличка», «Тот же торец», «Всё то же озеро», «у той же доски».
const SAME_PHRASE = /(?:^|[^\p{L}])((?:вс[её]\s+)?(?:тот|та|то|ту|те|той|того|тому|том|тем|тех|теми)\s+же)(?=[^\p{L}]|$)/iu
// «один и тот же знак повторяется» — повтор внутри одного объекта, не отсылка к прошлому шагу.
const REPEAT_PHRASE = /(?:^|[^\p{L}])(?:один|одна|одно|одного|одной|одном|одним|одну|одни|одних)\s+и\s+(?:тот|та|то|ту|те|той|того|тому|том|тем|тех|теми)\s+же/iu

function samePhrase(text) {
  const value = String(text ?? '')
  if (REPEAT_PHRASE.test(value)) return null
  const match = SAME_PHRASE.exec(value)
  return match ? match[1] : null
}

function sameObjectReason(previous, step) {
  const a = coordsOf(previous)
  const b = coordsOf(step)
  const distance = a && b ? haversineMeters(a.lat, a.lng, b.lat, b.lng) : null
  if (distance !== null && distance <= SAME_POINT_M) return `координаты в ${Math.round(distance)} м от шага ${previous.step_id}`
  const location = normText(step.location)
  // «Михайловский сквер» у двух скульптур в 50 м друг от друга — разные объекты:
  // общий адрес без близких координат дублем не считается.
  const near = distance === null || distance <= SAME_PHRASE_M
  if (near && location && location === normText(previous.location)) return `тот же location, что у шага ${previous.step_id}`
  for (const field of ['title', 'location']) {
    const phrase = samePhrase(step[field])
    if (phrase) return `${field} «${phrase} …» после шага ${previous.step_id}`
  }
  const taskPhrase = samePhrase(step.task)
  if (taskPhrase && (distance === null || distance <= SAME_PHRASE_M)) {
    return `task «${taskPhrase} …» в ${distance === null ? '?' : Math.round(distance)} м от шага ${previous.step_id}`
  }
  return null
}

// ===================== «Вода» =====================

/**
 * Фразы о задании вместо рассказа о месте. Каждая строка — образец из
 * правок-источников (`0a92351a8`, `3aed14bb2`), сопоставление по
 * нормализованному тексту story (нижний регистр, ё → е).
 */
const FILLER_PATTERNS = [
  { id: 'не-нужно-искать', re: /не нужно (?:искать|подниматься|заходить|ждать|знать|покупать|разбирать)/ },
  { id: 'не-придется', re: /(?:искать|ждать|подниматься|заходить)[^.!?]{0,40} не придется/ },
  { id: 'важна-не', re: /важн[аоы] (?:не (?:дата|даты|перечислени|имена|фамили)|твоя наблюдательность, а не)/ },
  { id: 'для-прогулки-это', re: /для (?:нашей )?прогулки по [^.!?,]{1,40} это (?:важная|хорошая)/ },
  { id: 'связывает-прогулку', re: /(?:связывает|возвращает) (?:эту часть )?прогулк/ },
  { id: 'без-знания', re: /без знания (?:биографии|истории|дат|языка)/ },
  { id: 'масштаб', re: /(?:перемена|смена) масштаба|меняется масштаб/ },
  { id: 'примета-замысла', re: /еще одна примета (?:замысла|чертежа|плана)/ },
  { id: 'история-продолжается', re: /история продолжается/ },
  { id: 'короткая-остановка', re: /(?:это|оставляет время для) коротк(?:ая|ой) остановк/ },
  { id: 'в-нашем-поиске', re: /в нашем поиске это/ },
  { id: 'деталь-помогает', re: /(?:маленькая|небольшая) деталь помогает/ },
  { id: 'с-разных-сторон', re: /позволяет рассмотреть [^.!?]{0,40}с разных сторон/ },
  { id: 'достаточно-остановиться', re: /достаточно остановиться/ },
]

function fillerHits(story) {
  const text = normText(story)
  return FILLER_PATTERNS.filter(({ re }) => re.test(text)).map(({ id }) => id)
}

// ===================== Скан квеста =====================

function inspectQuest(bundle) {
  const questId = String(bundle?.quest_id || '').trim()
  const intro = getQuestIntro(bundle)
  const steps = getQuestSteps(bundle).filter((step) => !step.is_intro)
  const required = steps.filter((step) => !isOptionalStep(step))
  const thread = significantStems(bundle?.title, intro?.title, intro?.story, intro?.task)
  const findings = []
  const add = (step, kind, detail) => findings.push({ quest_id: questId, step_id: String(step.step_id ?? step.id ?? '?'), kind, detail })

  required.forEach((step, index) => {
    const previous = required[index - 1]
    const next = required[index + 1]
    const reason = previous && sameObjectReason(previous, step)
    if (reason) add(step, 'same-object', reason)

    if (String(step.story || '').trim() && thread.size) {
      const own = significantStems(step.story)
      const neighbours = significantStems(
        ...[previous, next].filter(Boolean).flatMap((s) => [s.title, s.location, s.story]),
      )
      if (!intersects(own, thread) && !intersects(own, neighbours)) {
        add(step, 'no-thread', 'story без общих слов с названием и интро квеста и без мостика к соседним шагам')
      }
    }

    for (const id of fillerHits(step.story)) add(step, 'filler', `шаблонная фраза «${id}» в story`)
  })

  return { quest_id: questId, title: String(bundle?.title || ''), steps: steps.length, required: required.length, findings }
}

function scanQuests(bundles) {
  const results = (Array.isArray(bundles) ? bundles : []).map((bundle) => inspectQuest(bundle))
  return { results, findings: results.flatMap((result) => result.findings) }
}

// ===================== Baseline =====================

/**
 * Baseline — находки в репозитории до появления гейта (#2963). Ключ —
 * `quest_id|step_id|kind`: правка, которая добавит в такой квест НОВЫЙ дубль
 * или новую «воду» на другом шаге, валит гейт сразу. Квесты, уже
 * переработанные под нить (#2958–#2961), сюда не входят.
 */
const BASELINE_PATH = 'scripts/quest-story-thread-baseline.json'
const BASELINE_CONTRACT_VERSION = 1
const findingKeys = (finding) => [`${finding.quest_id}|${finding.step_id}|${finding.kind}`]

/**
 * Перезапись baseline по всем локальным данным квестов. Снимается по файлам в
 * РАБОЧЕМ ДЕРЕВЕ — обновлять на дереве без чужих незавершённых правок.
 */
function updateBaseline(rootDir) {
  const known = {}
  let total = 0
  for (const file of localQuestDataFiles(rootDir, QUEST_DATA_FILE_PATTERN)) {
    const { findings } = scanQuests(loadLocalBundles(path.join(rootDir, file), null))
    if (!findings.length) continue
    known[file] = [...new Set(findings.flatMap(findingKeys))].sort()
    total += findings.length
  }
  writeBaseline(path.join(rootDir, BASELINE_PATH), {
    contractVersion: BASELINE_CONTRACT_VERSION,
    note: 'Находки скана сквозной нити (дубль объекта подряд, story без нити, шаблонная «вода»), '
      + 'лежавшие в репозитории до появления гейта #2963. Их исправление — редакционная работа своих '
      + 'карточек; новая находка baseline не покрыта. Ключ quest_id|step_id|kind. Снимается по '
      + 'файлам данных в РАБОЧЕМ ДЕРЕВЕ. Обновлять: npm run quest:scan-story-thread:baseline',
    known,
  })
  return { files: Object.keys(known).length, total }
}

// ===================== CLI =====================

const USAGE = `Скан сквозной нити квеста: дубль объекта подряд, story без нити, шаблонная «вода» (#2963)

Usage:
  node scripts/scan-quest-story-thread.js [--source <file>] [--quest-id <id>] [--baseline <file>] [--update-baseline] [--json]

Options:
  --source <file>       один data-файл (по умолчанию — все локальные scripts/*-quest-data.js)
  --quest-id <id>       один квест data-файла (только с --source)
  --baseline <file>     вычесть находки, лежавшие до появления гейта
  --update-baseline     переписать ${BASELINE_PATH} по всем локальным данным
  --json                machine-readable результат на stdout
  --help, -h            напечатать эту справку и выйти`

const CLI_SPEC = {
  name: 'scan-quest-story-thread',
  usage: USAGE,
  selection: 'quests',
  flags: {
    source: { type: 'string' },
    'quest-id': { type: 'string' },
    baseline: { type: 'string' },
    'update-baseline': { type: 'boolean' },
    json: { type: 'boolean' },
  },
}

const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC)

function formatResult(result, fresh) {
  const own = fresh.filter((f) => f.quest_id === result.quest_id)
  const lines = [`  ${own.length ? '❌' : '✅'} ${result.quest_id} — обязательных точек ${result.required}`]
  for (const f of own) lines.push(`       - ${f.step_id} [${f.kind}] ${f.detail}`)
  return lines.join('\n')
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  // Без --source флаг молча гонял бы весь корпус вместо одного квеста.
  if (args.questId && !args.source) throw new UsageError('--quest-id работает только с --source')

  if (args.updateBaseline) {
    const result = updateBaseline(process.cwd())
    console.log(`Baseline перезаписан: ${BASELINE_PATH} — ${result.total} находок в ${result.files} файлах.`)
    return
  }

  const files = args.source ? [args.source] : localQuestDataFiles(process.cwd(), QUEST_DATA_FILE_PATTERN)
  const baseline = args.baseline
    ? loadBaseline(path.resolve(process.cwd(), args.baseline), BASELINE_CONTRACT_VERSION).known || {}
    : null

  const results = []
  const fresh = []
  const known = []
  for (const file of files) {
    const scanned = scanQuests(loadLocalBundles(file, args.questId))
    const split = baseline ? splitByBaseline(scanned.findings, baseline[file], findingKeys) : { fresh: scanned.findings, known: [] }
    results.push(...scanned.results)
    fresh.push(...split.fresh)
    known.push(...split.known)
  }
  requireNonEmptySelection(results, { what: 'квестов', source: args.source || 'scripts/', hint: 'проверь --source / --quest-id' })

  const failedQuests = new Set(fresh.map((f) => f.quest_id)).size
  if (args.json) {
    console.log(JSON.stringify({ source: args.source || 'scripts/', quests: results.length, findings: fresh, knownFindings: known }, null, 2))
  } else {
    console.log(`Скан сквозной нити квестов: ${args.source || 'все локальные data-файлы'} — ${results.length} квестов`)
    for (const result of results) {
      if (args.source || fresh.some((f) => f.quest_id === result.quest_id)) console.log(formatResult(result, fresh))
    }
    if (known.length) console.log(`\nУчтено baseline (до появления гейта): ${known.length} находок.`)
    console.log(failedQuests
      ? `\nКвестов с потерей нити: ${failedQuests} из ${results.length} — один шаг на объект, story о месте и сюжете, без шаблонной «воды».`
      : '\nНовых находок нет: дублей объекта подряд, story без нити и шаблонной «воды» не найдено.')
  }

  requireNoBatchFailures(failedQuests, {
    total: results.length,
    message: `квестов с потерей сквозной нити: ${failedQuests}`,
  })
}

module.exports = {
  BASELINE_CONTRACT_VERSION,
  BASELINE_PATH,
  CLI_SPEC,
  FILLER_PATTERNS,
  SAME_PHRASE_M,
  SAME_POINT_M,
  USAGE,
  findingKeys,
  inspectQuest,
  parseArgs,
  scanQuests,
  significantStems,
  stemOf,
  updateBaseline,
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
