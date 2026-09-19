#!/usr/bin/env node
/**
 * Скан свободного шага, чей порог `min_length` выше слов, которые шаг сам
 * перечисляет как варианты ответа — класс QUEST-FREE-TEXT-MIN-LENGTH-001
 * (`docs/PROBLEM_MEMORY.md`, #1979).
 *
 * Доказанный кейс: `brest-lantern / 4-alleya-fonarey` просил «опиши его в
 * паре слов» и перечислял фонари «Дон Кихот, Нос, тройка» при `min_length` 4.
 * Двое игроков (28.08 и 13.09.2026) написали три символа — «Нос» — и получили
 * «Слишком коротко». Тот же механизм: `minsk-cinema / 2-artmuseum` (подсказка
 * «Колонны, скульптура наверху, симметрия.», порог 10, игрок ввёл 9 символов
 * при открытой подсказке) и `mogilev-teens-symbol-code / 2-citizens-mural`
 * («…фон или повторяющийся элемент», порог 6, два отказа по 3 символа).
 *
 * Порог существует ради отсечения заглушек («хз», «.»), а не ради того, чтобы
 * игрок дописывал то, чего задание не просило. Рантайм исправен
 * (`utils/questAdapters.ts`: длина нормализованного ввода ≥ `min_length`),
 * дефект целиком в данных, и ни один другой скан `min_length` не читает.
 *
 * Что скан ловит: шаг `any_text`, чьё задание просит короткий ответ («назови»,
 * «одним словом», «в паре слов») ИЛИ чья подсказка — голое перечисление, и в
 * задании/подсказке через запятую или «или» перечислен вариант из одного-двух
 * слов короче порога. Чего НЕ ловит: шаги-«эссе» («сформулируй», «назови два
 * отличия», «назови три признака») — там перечисление это категории, а ответ
 * заведомо длиннее одного элемента; такие шаги вне scope по MULTI_RE.
 *
 *   node scripts/scan-quest-anytext-minlen.js                          # весь прод
 *   node scripts/scan-quest-anytext-minlen.js --quest-id=brest-lantern
 *   node scripts/scan-quest-anytext-minlen.js --source=scripts/brest-city-quest-data.js
 *   node scripts/scan-quest-anytext-minlen.js --no-allow-file          # без вычитания
 *   node scripts/scan-quest-anytext-minlen.js --json
 *
 * Exit code 1, если найден хотя бы один шаг вне allow-файла. Правка находки —
 * `min_length` не выше самого короткого перечисленного варианта, но не ниже 3
 * (иначе порог перестаёт отсекать «хз»); либо вердикт с обоснованием в
 * allow-файле.
 */

const path = require('path')

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const { normalizeAnswer } = require('./lib/questAnswerNormalize')
// Allow-файл — общий с другими аудит-сканами квестов механизм (#1450, #1718).
const { loadBaseline, splitByBaseline } = require('./lib/scanBaseline')
const {
  parseCliArgs,
  parseCliTokens,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runCli,
} = require('./lib/cli-contract')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

/**
 * Allow-файл ключуется парой `quest_id|step_id`, как у скана счётных шагов
 * (#1718): вердикт «порог осознанно выше перечисленного» — свойство шага, а не
 * файла-источника, и обязан читаться одинаково при прогоне по проду и по
 * локальным данным. Значение ключа — текст обоснования.
 */
const ALLOW_PATH = 'scripts/quest-anytext-minlen-allow.json'
const ALLOW_CONTRACT_VERSION = 1

// ===================== Критерий отбора =====================

/**
 * `\b` в JS-регулярках слеп к кириллице, поэтому граница слова собирается
 * lookaround'ами по кириллическим буквам (RU/BE-алфавит).
 */
const CYRILLIC = 'а-яёіў'
const cyrillicWord = (alternatives) => new RegExp(`(?<![${CYRILLIC}])(?:${alternatives})(?![${CYRILLIC}])`, 'iu')

/** Задание просит короткий ответ — одно слово, одну деталь, пару слов. */
const ASK_RE = /одним словом|одно слово|одну деталь|один\s+(?:\S+\s+)?признак|в паре слов|пару слов|одним[- ]двумя|двумя словами|назови/iu

/**
 * Задание просит несколько элементов («назови два отличия», «три признака»,
 * «по одной детали из прошлого и из настоящего») — ответ заведомо длиннее
 * одного перечисленного слова, порог там осмыслен. «Пару слов» и «несколько
 * слов» — про длину ответа, а не про число элементов, поэтому исключены.
 */
const MULTI_RE = cyrillicWord('два|две|три|четыре|трёх|трех|пары|две-три|два-три|пару(?!\\s+слов)|несколько(?!\\s+слов)|хотя бы дв[а-яё]*')
const PAIR_OF_ONES_RE = /одн[ау] [^.!?]{0,40}(?<![а-яё])и одн[ау](?![а-яё])/iu

/**
 * Императивы-вводные: «Обрати внимание на позу, взгляд…», «Смотри на форму
 * окон, кладку и крыльцо». Первый элемент перечисления несёт вводную, сам
 * вариант — его последнее слово; императив из одного-двух слов («Опиши»,
 * «Подумай») вариантом не является.
 */
const IMPERATIVES = new Set([
  'опиши', 'назови', 'сравни', 'посмотри', 'смотри', 'подумай', 'вспомни', 'найди', 'обойди',
  'рассмотри', 'ищи', 'напиши', 'пиши', 'реши', 'проследи', 'сформулируй', 'зайди', 'встань',
  'подойди', 'пройди', 'пройдись', 'оглядись', 'осмотрись', 'выбери', 'отойди', 'представь',
  'прочитай', 'взгляни', 'загляни', 'обрати', 'отдели', 'поднимись', 'отметь', 'определи',
  'посчитай', 'сосчитай', 'считай', 'добавь', 'проверь', 'сверь', 'подними', 'запрокинь',
  'попробуй', 'присмотрись', 'прислушайся', 'ответь', 'запиши', 'укажи', 'отгадай', 'угадай',
  'узнай', 'спроси', 'оцени', 'прикинь', 'потрогай', 'понюхай',
])

/** Служебные слова, которые перечисление даёт как обломки, а не как варианты. */
const STOP_WORDS = new Set([
  'где', 'или', 'то', 'и', 'а', 'но', 'что', 'как', 'кто', 'кого', 'кому', 'чем', 'тем', 'это',
  'его', 'ее', 'их', 'там', 'тут', 'вот', 'еще', 'уже', 'так', 'все', 'нет', 'да', 'ли', 'же',
  'бы', 'о', 'об', 'на', 'в', 'с', 'у', 'к', 'по', 'за', 'из', 'от', 'до', 'при', 'для', 'под',
  'над', 'без', 'про', 'через', 'сюда', 'туда', 'этот', 'эта', 'эти', 'тот', 'та', 'те', 'сам',
  'сама', 'само', 'себя', 'ним', 'ней', 'них', 'мы', 'вы', 'ты', 'он', 'она', 'они', 'оно',
  'когда', 'если', 'тогда', 'потом', 'сначала', 'затем', 'почему', 'зачем', 'откуда', 'куда',
  'сколько', 'который', 'которая', 'которые', 'какой', 'какая', 'какие', 'какое', 'чего',
  'нибудь', 'либо', 'ну', 'вдруг', 'пусть', 'хоть', 'даже', 'внутри', 'снаружи', 'сверху',
  'снизу', 'рядом', 'слева', 'справа', 'вокруг', 'вдоль', 'напротив', 'дальше', 'ближе',
  'выше', 'ниже', 'вверху', 'внизу', 'впереди', 'сзади', 'наверху', 'может', 'можно', 'нужно',
])

const SENTENCE_SPLIT_RE = /(?<=[.!?…])\s+|\n+/u
const ITEM_SPLIT_RE = /,|;|\sили\s|\sи\s|\s[—–]\s|:|\(|\)/u
const CONJUNCTION_RE = /\s(?:и|или)\s/iu
const LEADING_CONNECTOR_RE = /^(?:это|то есть|например|а|но|или|и|не)\s+/iu
const WORD_CHARS_RE = /^[а-яёіўa-z\s«»"'-]+$/iu
// Неразрывный пробел в текстах после редактора — приводится к обычному до разбора.
const NBSP_RE = new RegExp(String.fromCharCode(0xa0), 'g')

/**
 * Порог свободного ответа ровно так, как его читает рантайм
 * (`utils/questAdapters.ts`): `any_text` без числа или с нечисловым
 * `min_length` — порог 1. Не-`any_text` — `null`.
 */
function freeTextMinLength(answerPattern) {
  if (!answerPattern || answerPattern.type !== 'any_text') return null
  try {
    const parsed = typeof answerPattern.value === 'string'
      ? JSON.parse(answerPattern.value || '{}')
      : (answerPattern.value || {})
    const raw = Number(parsed?.min_length)
    return Number.isFinite(raw) && raw > 0 ? raw : 1
  } catch {
    return 1
  }
}

/**
 * Элементы одного предложения: части через запятую/«или»/«и»/тире/двоеточие
 * из одного-двух слов, только буквы. Вводная первого элемента с императивом
 * («Обрати внимание на позу») даёт вариант хвостом без предлога; обломок
 * придаточного или предложная группа («что зацепило», «на постаменте»)
 * вариантом не считается.
 */
function sentenceCandidates(sentence) {
  const candidates = []
  sentence.split(ITEM_SPLIT_RE).forEach((rawItem, index) => {
    const item = rawItem
      .trim()
      .replace(LEADING_CONNECTOR_RE, '')
      .replace(/[.!?…]+$/u, '')
      .replace(/[«»"']/g, '')
      .trim()
    if (!item || !WORD_CHARS_RE.test(item)) return
    let words = item.split(/\s+/)
    if (index === 0 && IMPERATIVES.has(normalizeAnswer(words[0]))) {
      if (words.length <= 2) return
      const tail = words.slice(-2)
      words = STOP_WORDS.has(normalizeAnswer(tail[0])) ? tail.slice(1) : tail
    }
    if (words.length > 2) return
    // Глагольная группа («найди дерево») и предложная группа или обломок
    // придаточного («на постаменте», «что зацепило») вариантом не являются.
    if (IMPERATIVES.has(normalizeAnswer(words[0]))) return
    if (words.length === 2 && STOP_WORDS.has(normalizeAnswer(words[0]))) return
    const normalized = normalizeAnswer(words.join(' '))
    if (normalized.length < 2 || STOP_WORDS.has(normalized) || IMPERATIVES.has(normalized)) return
    candidates.push({ text: words.join(' '), normalized, length: normalized.length })
  })
  return candidates
}

/**
 * Варианты, которые текст перечисляет. Две запятые — перечисление всегда;
 * одна запятая или только союз «и»/«или» — перечисление лишь когда коротких
 * элементов хотя бы два («свет, горы и расстояние…»), иначе это две
 * склеенные фразы («пройди по саду и найди дерево, которое…»). Нормализация —
 * та же, что у рантайма, поэтому длина здесь равна длине, которую увидит
 * проверка порога.
 */
function enumeratedItems(text) {
  const out = []
  const seen = new Set()
  const sentences = String(text ?? '').replace(NBSP_RE, ' ').split(SENTENCE_SPLIT_RE)
  for (const sentence of sentences) {
    const commas = (sentence.match(/,/g) || []).length
    if (commas < 2 && !CONJUNCTION_RE.test(sentence)) continue
    const candidates = sentenceCandidates(sentence)
    if (commas < 2 && candidates.length < 2) continue
    for (const candidate of candidates) {
      if (seen.has(candidate.normalized)) continue
      seen.add(candidate.normalized)
      out.push(candidate)
    }
  }
  return out
}

/**
 * Подсказка — голое перечисление («Колонны, скульптура наверху, симметрия.»):
 * каждое предложение из двух и более элементов по одному-два слова без
 * императива. Такая подсказка называет ответы прямо, и порог обязан их
 * пропускать даже там, где задание короткого ответа не просит.
 */
function hasBareEnumeration(hint) {
  return String(hint ?? '').split(SENTENCE_SPLIT_RE).some((sentence) => {
    const trimmed = sentence.trim().replace(/[.!?…]+$/u, '')
    if (!trimmed) return false
    const parts = trimmed.split(/,|\sи\s/u).map((part) => part.trim()).filter(Boolean)
    if (parts.length < 2) return false
    return parts.every((part) => {
      const words = part.split(/\s+/)
      return words.length <= 2 && WORD_CHARS_RE.test(part) && !IMPERATIVES.has(normalizeAnswer(words[0]))
    })
  })
}

/** Вердикт по одному шагу: `null`, если шаг вне класса или порог не выше перечисленного. */
function inspectStep(step) {
  if (step.is_intro) return null
  const minLength = freeTextMinLength(step.answer_pattern)
  // Порог 1–2 не отсекает ни одного настоящего слова.
  if (minLength === null || minLength <= 2) return null
  const task = String(step.task ?? '')
  const hint = String(step.hint ?? '')
  if (MULTI_RE.test(task) || PAIR_OF_ONES_RE.test(task)) return null
  const asksShort = ASK_RE.test(task)
  const bareHint = hasBareEnumeration(hint)
  if (!asksShort && !bareHint) return null
  const seen = new Set()
  const items = [...enumeratedItems(task), ...enumeratedItems(hint)].filter((item) => {
    if (item.length >= minLength || seen.has(item.normalized)) return false
    seen.add(item.normalized)
    return true
  })
  if (!items.length) return null
  return {
    min_length: minLength,
    scope: asksShort ? 'task-asks-short' : 'hint-bare-enumeration',
    items: items.map(({ text, length }) => ({ text, length })),
  }
}

function scanQuests(quests) {
  const findings = []
  let scannedSteps = 0
  for (const quest of quests) {
    for (const step of quest.steps || []) {
      if (step.is_intro) continue
      scannedSteps++
      const verdict = inspectStep(step)
      if (!verdict) continue
      findings.push({
        quest_db_id: quest.id ?? null,
        quest_id: quest.quest_id,
        step_db_id: step.id ?? null,
        step_id: step.step_id,
        ...verdict,
        task: String(step.task ?? ''),
        hint: String(step.hint ?? ''),
      })
    }
  }
  return { findings, scannedSteps }
}

// ===================== Allow-файл =====================

function findingKeys(finding) {
  return [`${finding.quest_id}|${finding.step_id}`]
}

function loadAllowKeys(allowPath) {
  const baseline = loadBaseline(path.resolve(process.cwd(), allowPath), ALLOW_CONTRACT_VERSION)
  const known = baseline.known || {}
  return Array.isArray(known) ? known : Object.keys(known)
}

// ===================== Источники данных =====================

function toScanBundle(bundle) {
  return { id: bundle.id, quest_id: bundle.quest_id, steps: parseSteps(bundle) }
}

async function loadFromApi(apiUrl, questId) {
  const bundles = await fetchQuestBundles(apiUrl, questId)
  return bundles.map(toScanBundle)
}

// ===================== CLI =====================

const USAGE = `Скан свободного шага, чей min_length выше перечисленных им вариантов — QUEST-FREE-TEXT-MIN-LENGTH-001

Usage:
  node scripts/scan-quest-anytext-minlen.js [--quest-id <id>] [--source <file>] [--allow-file <file>] [--no-allow-file] [--api-url <url>] [--json]

Options:
  --quest-id <id>       один квест вместо всего корпуса
  --source <file>       локальный data-файл вместо прода
  --allow-file <file>   файл обоснованных исключений (по умолчанию ${ALLOW_PATH})
  --no-allow-file       показать все находки без вычитания
  --api-url <url>       адрес прода (по умолчанию METRAVEL_API_URL или https://metravel.by)
  --json                machine-readable результат на stdout
  --help, -h            напечатать эту справку и выйти`

const CLI_SPEC = {
  name: 'scan-quest-anytext-minlen',
  usage: USAGE,
  selection: 'quests',
  flags: {
    'api-url': { type: 'string', default: DEFAULT_API, stripTrailingSlash: true },
    'quest-id': { type: 'string' },
    source: { type: 'string' },
    'allow-file': { type: 'string', default: ALLOW_PATH },
    'no-allow-file': { type: 'boolean' },
    json: { type: 'boolean' },
  },
}

const parseArgs = (tokens) => {
  const args = parseCliTokens(tokens, CLI_SPEC)
  return { ...args, allowFile: args.noAllowFile ? null : args.allowFile }
}

const formatItems = (items) => items.map((item) => `«${item.text}» (${item.length})`).join(', ')

async function main() {
  const parsed = parseCliArgs(process.argv, CLI_SPEC)
  const args = { ...parsed, allowFile: parsed.noAllowFile ? null : parsed.allowFile }
  const quests = requireNonEmptySelection(
    args.source
      ? loadLocalBundles(args.source, args.questId)
      : await loadFromApi(args.apiUrl, args.questId),
    {
      what: 'квестов',
      source: args.source || args.apiUrl,
      hint: 'проверь --source / --quest-id / --api-url',
    },
  )

  const scanned = scanQuests(quests)
  const source = args.source || args.apiUrl
  const { fresh: findings, known: knownFindings } = args.allowFile
    ? splitByBaseline(scanned.findings, loadAllowKeys(args.allowFile), findingKeys)
    : { fresh: scanned.findings, known: [] }

  if (args.json) {
    console.log(JSON.stringify(
      {
        source,
        quests: quests.length,
        scannedSteps: scanned.scannedSteps,
        allowFile: args.allowFile,
        knownFindings: knownFindings.length,
        findings,
      },
      null,
      2,
    ))
  } else {
    console.log(`Скан min_length свободных шагов: ${source} — ${quests.length} квестов, ${scanned.scannedSteps} шагов`)
    for (const f of findings) {
      console.log(`\n  [quest ${f.quest_db_id ?? '?'}] ${f.quest_id} / шаг ${f.step_db_id ?? '?'} ${f.step_id}`)
      console.log(`    any_text min_length=${f.min_length} (${f.scope}) — короче порога: ${formatItems(f.items)}`)
      console.log(`    ${f.task}`)
    }
    if (knownFindings.length) {
      console.log(`\nУчтено allow-файлом (оставлено с обоснованием): ${knownFindings.length}`)
    }
    console.log(findings.length
      ? `\nСвободных шагов с порогом выше перечисленного: ${findings.length}`
      : '\nСвободных шагов с порогом выше перечисленного нет.')
  }

  requireNoBatchFailures(findings.length, {
    total: Math.max(findings.length, quests.length),
    message: `свободных шагов с порогом выше перечисленного: ${findings.length}`,
  })
}

module.exports = {
  ALLOW_PATH,
  ALLOW_CONTRACT_VERSION,
  ASK_RE,
  MULTI_RE,
  freeTextMinLength,
  enumeratedItems,
  hasBareEnumeration,
  inspectStep,
  scanQuests,
  findingKeys,
  loadAllowKeys,
  toScanBundle,
  parseArgs,
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
