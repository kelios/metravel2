#!/usr/bin/env node
// Отчёт «трение шага» для редактора квестов (#1278).
//
// Замыкает петлю телеметрии ответов: #1275 хранит попытки, #1276 их собирает,
// а этот скрипт превращает их в конкретное решение редактора. Без инструмента
// данные повторят судьбу `quest_progress.attempts` — они лежали в проде с июля,
// и до ручного SQL-разбора их никто не читал.
//
// Скрипт НЕ применяет правки автоматически и не будет: самый частый
// отклонённый ввод — это часто не синоним, а промежуточное вычисление
// (на quest 32 шаг `3-pobeda` игроки вводят `33` — сумму цифр без свёртки).
// Добавить такое в словарь значит засчитывать нерешённую задачу.

const fs = require('fs')
const path = require('path')

const { normalizeAnswer } = require('./lib/questAnswerNormalize')
const {
  EmptySelectionError,
  UsageError,
  parseCliArgs,
  parseCliTokens,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runCli,
} = require('./lib/cli-contract')

const DEFAULT_BASE_URL = process.env.METRAVEL_API_URL || 'https://metravel.by'
const TOKEN_FILE = '.secrets/metravel-task-board.env'
const REQUEST_TIMEOUT_MS = 30000

// Веса трения. Бросивший игрок дороже открытой подсказки, подсказка дороже
// лишней попытки — иначе шаг с десятком мелких опечаток обгонит шаг, на
// котором квест просто заканчивают.
const FRICTION_WEIGHTS = {
  rejectedPerSolver: 1,
  hintOpenRate: 2,
  abandonRate: 3,
}

// Свободные типы ответа: у них нет словаря, кандидатов быть не может, а сырые
// вводы сервер не хранит вовсе (правило приватности #1275).
const FREE_TEXT_ANSWER_TYPES = new Set(['any', 'any_text'])

// Явные заглушки вместо ответа. Список короткий и намеренно консервативный:
// всё, что не мусор и не синоним, попадает в «не синоним» — то есть в самую
// полезную для редактора группу.
// «нет»/«да» сюда НЕ входят: на шаге-вопросе это осмысленный (пусть и неверный)
// ответ, и редактору важно увидеть его в группе «фактически другой ответ».
const GARBAGE_INPUTS = new Set(['хз', 'не знаю', 'незнаю', 'ответ', 'фиг знает', 'idk', '?', '??', '???'])

const CATEGORY = {
  SYNONYM: 'synonym',
  OTHER_ANSWER: 'other-answer',
  GARBAGE: 'garbage',
}

const CATEGORY_LABEL = {
  [CATEGORY.SYNONYM]: 'похоже на синоним',
  [CATEGORY.OTHER_ANSWER]: 'фактически другой ответ',
  [CATEGORY.GARBAGE]: 'мусор',
}

// ===================== Чистое ядро (покрыто Jest) =====================

/**
 * Нормализация как в `utils/questAdapters.normalize` — сравниваем одинаково.
 * Правила берутся из общей `scripts/lib/questAnswerNormalize`, а не копируются
 * сюда: собственная копия разошлась бы с рантаймом молча, и отчёт начал бы
 * считать эхо и синонимы по своим правилам. Паритет с рантаймом держит
 * `__tests__/scripts/scanQuestAnswerReachability.test.ts`.
 */
const normalizeValue = normalizeAnswer

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = row
  }
  return prev[b.length]
}

const isNumeric = (value) => /^-?\d+([.,]\d+)?$/.test(value)

/**
 * Порог опечатки зависит от длины эталона: короткий ответ не имеет права на
 * правки. Иначе `33` оказывается в двух заменах от `6` и уезжает в синонимы —
 * ровно та ошибка, из-за которой автодобавление словаря опасно.
 */
function typoThreshold(variantLength) {
  return Math.min(2, Math.floor(variantLength / 3))
}

/** Общий корень: длинные слова с длинным общим префиксом («папоротник(а)»). */
function sharesRoot(candidate, variant) {
  if (candidate.length < 5 || variant.length < 5) return false
  let common = 0
  while (common < candidate.length && common < variant.length && candidate[common] === variant[common]) {
    common += 1
  }
  return common >= 4
}

/**
 * К какой группе отнести отклонённый ввод.
 * Числа сравниваются точно: другое число — это другой ответ, а не опечатка.
 */
function classifyRejectedValue(rawValue, acceptedVariants = []) {
  const candidate = normalizeValue(rawValue)
  const variants = acceptedVariants.map(normalizeValue).filter(Boolean)

  if (!candidate) return CATEGORY.GARBAGE
  if (GARBAGE_INPUTS.has(candidate)) return CATEGORY.GARBAGE
  if (candidate.length < 2) return CATEGORY.GARBAGE
  // Повтор одного символа — мусор («ааааа»), но НЕ для чисел: `33`, `11`, `2222`
  // это честные неверные ответы, и именно они интереснее всего редактору.
  if (!isNumeric(candidate) && new Set(candidate.replace(/\s/g, '')).size === 1) return CATEGORY.GARBAGE

  if (variants.includes(candidate)) return CATEGORY.SYNONYM

  for (const variant of variants) {
    // Число против числа: несовпадение — это другой ответ. Промежуточные
    // вычисления игроков (33 вместо 6) обязаны остаться здесь.
    if (isNumeric(candidate) && isNumeric(variant)) continue
    if (levenshtein(candidate, variant) <= typoThreshold(variant.length)) return CATEGORY.SYNONYM
    if (sharesRoot(candidate, variant)) return CATEGORY.SYNONYM
  }

  return CATEGORY.OTHER_ANSWER
}

/** Принимаемые варианты шага из его `answer_pattern`. */
function acceptedVariantsFromPattern(pattern) {
  if (!pattern) return []
  const type = typeof pattern === 'string' ? pattern : pattern.type
  if (!type || FREE_TEXT_ANSWER_TYPES.has(type)) return []

  const rawValue = typeof pattern === 'string' ? '' : pattern.value
  const value = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue ?? '')

  try {
    switch (type) {
      case 'exact':
        return value ? [value] : []
      case 'exact_any': {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed.map(String) : []
      }
      case 'range': {
        const { min, max } = JSON.parse(value)
        if (!Number.isFinite(min) || !Number.isFinite(max)) return []
        // Диапазон разворачиваем только когда он короткий: словарь синонимов
        // из тысячи чисел бессмыслен.
        if (max - min > 30) return [String(min), String(max)]
        return Array.from({ length: max - min + 1 }, (_, i) => String(min + i))
      }
      case 'approx': {
        const { target } = JSON.parse(value)
        return Number.isFinite(target) ? [String(target)] : []
      }
      default:
        return []
    }
  } catch {
    return []
  }
}

// ===================== Эхо текста шага (#1923) =====================

// Отклонённый ввод, дословно стоящий в тексте СВОЕГО шага, — это ловушка:
// игрок отвечает самым заметным словом задания и получает отказ. Признак виден
// только в телеметрии: «слово из текста шага не принимается» само по себе верно
// почти для всех слов, поэтому сканы контента его не ловят. Замер 13.09.2026 по
// всей телеметрии: 176 отклонённых попыток с сырым вводом, 10 кандидатов, из них
// 2 настоящих (шаги 537 `brest-lantern/1-chasy-fonarey` и 176
// `gomel-palace/chapel`). Остальные восемь — отрицания, отречения (в том числе
// шаг 325 `minsk-cipher/3-pobeda`: он обучающий, а не ловушка, см. комментарий
// к DISOWN_WORDS), намеренные перечисления, номер точки в заголовке и
// вставленный в поле ответа текст подсказки; их отсеивают правила ниже.
// `story` намеренно вне признака, хотя дефект шага 537 печатал «закат» и в ней:
// история — длинный художественный текст, в котором почти любое слово ответа
// найдётся случайно, и признак утонул бы в шуме. Ловушку ловим там, где игрок
// читает вопрос: заголовок, задание, подсказка. Историю правит редактор вместе
// с ними, когда ловушка уже найдена.
const STEP_TEXT_FIELDS = ['title', 'task', 'hint']
const STEP_TEXT_FIELD_LABEL = { title: 'заголовке', task: 'задании', hint: 'подсказке' }

// «не флягу и не котелок» — подсказка называет слово, чтобы его исключить.
const NEGATION_WORDS = new Set(['не', 'ни', 'без'])
// Ответ — одно-три слова. Более длинное совпадение означает, что игрок вставил
// в поле ответа сам текст шага (шаг 166 `nesvizh-radziwill/gate`).
const MAX_ECHO_WORDS = 5
// Насколько далеко ищем отрицание и признак перечисления вокруг совпадения.
const NEGATION_LOOKBEHIND = 2
const ENUMERATION_WINDOW = 4
// Текст может назвать значение и сразу от него отречься: подсказка шага 325
// `minsk-cipher/3-pobeda` пишет «получишь 33 — и это ещё не ответ», то есть сама
// говорит, что промежуточный результат не принимается. Это обучающий шаг, а не
// ловушка, и в словарь такое значение добавлять запрещено (см. шапку файла).
const DISOWN_LOOKAHEAD = 6
// Отречение узнаём по «не <чем именно>», а не по одному «не»: голое отрицание
// впереди совпадения — это обычная речь, и «встретятся тебе в Хиве ещё не раз»
// (khiva-ichan-kala/2-kalta-minor) глушило бы кандидатов, от которых текст
// ничего не объявлял. Слова даны в постнормализованной форме: `ё` уже сведена
// к `е`, поэтому «всё» пишется как `все`.
const DISOWN_WORDS = new Set([
  'ответ',
  'финал',
  'конец',
  'итог',
  'все',
  'разгадка',
  'отгадка',
  'решение',
  'результат',
])

const textWords = (value) => normalizeValue(value).split(' ').filter(Boolean)

/** Все позиции, где `needle` стоит в `hay` целой последовательностью слов. */
function wordSequenceStarts(hay, needle) {
  const starts = []
  if (!needle.length || needle.length > hay.length) return starts
  for (let start = 0; start + needle.length <= hay.length; start += 1) {
    let matched = true
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (hay[start + offset] !== needle[offset]) {
        matched = false
        break
      }
    }
    if (matched) starts.push(start)
  }
  return starts
}

const isNegatedMatch = (hay, start) =>
  hay.slice(Math.max(0, start - NEGATION_LOOKBEHIND), start).some((word) => NEGATION_WORDS.has(word))

// «дубовый лист, кленовый или липовый» — задание намеренно предлагает выбор,
// и названный вариант обязан отклоняться.
const isEnumerationMatch = (hay, start, end) =>
  hay.slice(Math.max(0, start - ENUMERATION_WINDOW), Math.min(hay.length, end + ENUMERATION_WINDOW)).includes('или')

/** Текст сам объявляет названное значение неответом («и это ещё не ответ»). */
function isDisownedMatch(hay, end) {
  const tail = hay.slice(end, Math.min(hay.length, end + DISOWN_LOOKAHEAD))
  for (let i = 0; i < tail.length - 1; i += 1) {
    if (tail[i] === 'не' && DISOWN_WORDS.has(tail[i + 1])) return true
  }
  return false
}

// «1. Экипаж» — цифра в начале заголовка это номер точки, а не ответ.
const isStepNumbering = (field, needle, start) =>
  field === 'title' && start === 0 && needle.length === 1 && isNumeric(needle[0])

/**
 * Где ввод дословно стоит в тексте своего шага. `null` — эха нет либо совпадение
 * отсеяно как отрицание, перечисление, номер точки или вставленный текст шага.
 */
function findStepTextEcho(value, texts = {}) {
  const needle = textWords(value)
  if (!needle.length || needle.length > MAX_ECHO_WORDS) return null

  for (const field of STEP_TEXT_FIELDS) {
    const hay = textWords(texts?.[field])
    if (!hay.length) continue
    for (const start of wordSequenceStarts(hay, needle)) {
      const end = start + needle.length
      if (isStepNumbering(field, needle, start)) continue
      if (isNegatedMatch(hay, start)) continue
      if (isDisownedMatch(hay, end)) continue
      if (isEnumerationMatch(hay, start, end)) continue
      return { field }
    }
  }
  return null
}

function computeFriction(step) {
  const rejectedPerSolver = Number(step?.rejected_per_solver) || 0
  const hintOpenRate = Number(step?.hint_open_rate) || 0
  const abandonRate = Number(step?.abandon_rate) || 0
  return (
    rejectedPerSolver * FRICTION_WEIGHTS.rejectedPerSolver +
    hintOpenRate * FRICTION_WEIGHTS.hintOpenRate +
    abandonRate * FRICTION_WEIGHTS.abandonRate
  )
}

/**
 * Разбор ответа `answer-stats` в отчёт: шаги по убыванию трения, у каждого —
 * отклонённые вводы, разложенные по группам.
 */
function buildInsights({ stats, patternsByStepKey = {}, textsByStepKey = {}, minCount = 2 } = {}) {
  const steps = Array.isArray(stats?.steps) ? stats.steps : []

  const enriched = steps.map((step) => {
    const accepted = acceptedVariantsFromPattern(patternsByStepKey[step.step_key])
    const texts = textsByStepKey[step.step_key] ?? {}
    const rejected = Array.isArray(step.top_rejected) ? step.top_rejected : []

    const candidates = rejected
      // Кандидатом считаем ввод, который встретился у нескольких РАЗНЫХ
      // игроков: один человек, упорно вводивший одно и то же, словарь не меняет.
      .filter((entry) => Number(entry?.players ?? entry?.count ?? 0) >= minCount)
      .map((entry) => ({
        value: String(entry.value ?? ''),
        count: Number(entry.count) || 0,
        players: Number(entry.players) || 0,
        category: classifyRejectedValue(entry.value, accepted),
        // Эхо текста шага считается по КАЖДОМУ кандидату, а не по группе: слово
        // из задания попадает и в «синоним», и в «другой ответ» (#1923).
        textEcho: findStepTextEcho(entry.value, texts),
      }))

    return {
      stepKey: step.step_key,
      answerType: step.answer_type,
      isFreeText: FREE_TEXT_ANSWER_TYPES.has(step.answer_type),
      playersReached: Number(step.players_reached) || 0,
      playersSolved: Number(step.players_solved) || 0,
      rejectedTotal: Number(step.rejected_total) || 0,
      rejectedPerSolver: Number(step.rejected_per_solver) || 0,
      hintOpenRate: Number(step.hint_open_rate) || 0,
      medianTimeMs: Number(step.median_time_ms) || 0,
      abandonRate: Number(step.abandon_rate) || 0,
      friction: computeFriction(step),
      acceptedVariants: accepted,
      candidates,
      // Шаг с эхом обязан попасть в глаза редактору: правится формулировка, а
      // не словарь (расширение словаря печатаемым словом делает шаг кнопкой).
      textEchoes: candidates.filter((candidate) => candidate.textEcho),
    }
  })

  enriched.sort((a, b) => b.friction - a.friction || b.rejectedTotal - a.rejectedTotal)

  return {
    questId: stats?.quest_id,
    steps: enriched,
    totalFriction: enriched.reduce((sum, step) => sum + step.friction, 0),
    hasData: enriched.some((step) => step.playersReached > 0 || step.rejectedTotal > 0),
  }
}

// ===================== I/O =====================

const USAGE = `Отчёт «трение шага» для редактора квестов — #1278

Usage:
  node scripts/quest-answer-insights.js (--quest <id|slug> | --all) [--since <window>] [--min-count <n>] [--base-url <url>] [--json]

Options:
  --quest <id|slug>     один квест (числовой PK или quest_id)
  --all                 все квесты API
  --since <window>      окно телеметрии (по умолчанию 90d)
  --min-count <n>       минимум игроков у кандидата (по умолчанию 2)
  --base-url <url>      адрес API (по умолчанию METRAVEL_API_URL или https://metravel.by)
  --json                machine-readable результат на stdout
  --help, -h            напечатать эту справку и выйти`

const CLI_SPEC = {
  name: 'quest-answer-insights',
  usage: USAGE,
  selection: 'quests',
  flags: {
    quest: { type: 'string' },
    since: { type: 'string', default: '90d' },
    'min-count': { type: 'int', min: 1, default: 2 },
    'base-url': { type: 'string', default: DEFAULT_BASE_URL, stripTrailingSlash: true },
    all: { type: 'boolean' },
    json: { type: 'boolean' },
  },
}

const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC)

/** Staff-токен из gitignored bundle. В вывод не попадает никогда. */
function readStaffToken(rootDir) {
  const filePath = path.join(rootDir, TOKEN_FILE)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Staff token file not found: ${TOKEN_FILE}`)
  }
  const line = fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .find((row) => row.startsWith('METRAVEL_TASK_BOARD_API_TOKEN='))
  const token = line ? line.slice('METRAVEL_TASK_BOARD_API_TOKEN='.length).trim() : ''
  if (!token) throw new Error(`METRAVEL_TASK_BOARD_API_TOKEN is empty in ${TOKEN_FILE}`)
  return token
}

async function apiGet(baseUrl, endpoint, token) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) {
      const detail = text.trim().startsWith('{') ? text.trim() : `HTTP ${response.status}`
      const error = new Error(`GET ${endpoint} -> ${response.status} ${detail.slice(0, 200)}`)
      error.status = response.status
      throw error
    }
    return JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

/** `--quest` принимает и числовой PK, и строковый quest_id. */
async function resolveQuest(baseUrl, token, questRef) {
  if (/^\d+$/.test(String(questRef))) {
    return apiGet(baseUrl, `/api/quests/${questRef}/`, token)
  }
  return apiGet(baseUrl, `/api/quests/by-quest-id/${encodeURIComponent(questRef)}/`, token)
}

const patternsFromQuest = (quest) => {
  const map = {}
  for (const step of quest?.steps ?? []) {
    const key = String(step.step_id ?? step.id ?? '')
    if (key) map[key] = step.answer_pattern
  }
  return map
}

/** Видимый игроку текст шагов — по нему считается эхо отклонённого ввода (#1923). */
const textsFromQuest = (quest) => {
  const map = {}
  for (const step of quest?.steps ?? []) {
    const key = String(step.step_id ?? step.id ?? '')
    if (key) map[key] = { title: step.title, task: step.task, hint: step.hint }
  }
  return map
}

const formatMs = (ms) => (ms > 0 ? `${Math.round(ms / 1000)}с` : '—')
const formatRate = (rate) => `${Math.round(rate * 100)}%`

function printReport(report, { minCount }) {
  console.log(`Квест ${report.questId}: ${report.steps.length} шагов, суммарное трение ${report.totalFriction.toFixed(2)}`)
  console.log('')

  for (const step of report.steps) {
    console.log(`▸ ${step.stepKey}  [${step.answerType}]  трение ${step.friction.toFixed(2)}`)
    console.log(
      `  дошло ${step.playersReached} · решило ${step.playersSolved} · ` +
        `отклонено ${step.rejectedTotal} (${step.rejectedPerSolver.toFixed(1)} на решившего) · ` +
        `подсказка ${formatRate(step.hintOpenRate)} · бросило ${formatRate(step.abandonRate)} · ` +
        `медиана ${formatMs(step.medianTimeMs)}`,
    )

    if (step.isFreeText) {
      console.log('  свободный ответ: сырые вводы не хранятся (правило приватности)')
    } else if (!step.candidates.length) {
      console.log(`  отклонённых вводов от ≥${minCount} игроков нет`)
    } else {
      for (const group of [CATEGORY.SYNONYM, CATEGORY.OTHER_ANSWER, CATEGORY.GARBAGE]) {
        const inGroup = step.candidates.filter((candidate) => candidate.category === group)
        if (!inGroup.length) continue
        console.log(`  ${CATEGORY_LABEL[group]}:`)
        for (const candidate of inGroup) {
          const echo = candidate.textEcho
            ? ` ← стоит в ${STEP_TEXT_FIELD_LABEL[candidate.textEcho.field]} шага, но отклоняется (#1923)`
            : ''
          console.log(`    «${candidate.value}» — ${candidate.count} раз у ${candidate.players} игроков${echo}`)
        }
      }
    }
    console.log('')
  }

  const trapped = report.steps.filter((step) => step.textEchoes?.length)
  if (trapped.length) {
    console.log('Ловушки текста шага (#1923) — правится формулировка, НЕ словарь:')
    for (const step of trapped) {
      const values = step.textEchoes
        .map((candidate) => `«${candidate.value}» (${STEP_TEXT_FIELD_LABEL[candidate.textEcho.field]})`)
        .join(', ')
      console.log(`  ${step.stepKey}: ${values}`)
    }
    console.log('')
  }

  console.log('Решение принимает редактор: синоним можно добавить в answer_pattern,')
  console.log('«фактически другой ответ» означает, что переписать надо формулировку задания.')
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const rootDir = process.cwd()

  if (!args.quest && !args.all) {
    throw new UsageError('quest:insights: укажите --quest <id|slug> или --all')
  }

  const token = readStaffToken(rootDir)
  // Список квестов приходит и пагинированным конвертом, и голым массивом —
  // берём обе формы, иначе `--all` молча обходит ноль квестов.
  const listAll = async () => {
    const payload = await apiGet(args.baseUrl, '/api/quests/?page_size=300', token)
    const rows = Array.isArray(payload) ? payload : (payload?.results ?? [])
    return rows.map((quest) => quest.id).filter(Boolean)
  }
  const questRefs = requireNonEmptySelection(
    args.all ? await listAll() : [args.quest],
    {
      what: 'квестов',
      source: args.all ? '--all' : `--quest ${args.quest}`,
      message: 'quest:insights: список квестов пуст — нечего обходить',
    },
  )

  const reports = []
  let failed = 0
  for (const questRef of questRefs) {
    let quest
    let stats
    try {
      quest = await resolveQuest(args.baseUrl, token, questRef)
      stats = await apiGet(
        args.baseUrl,
        `/api/quests/${quest.id}/answer-stats/?since=${encodeURIComponent(args.since)}`,
        token,
      )
    } catch (error) {
      console.error(`quest:insights: ${error.message}`)
      if (!args.all) throw error
      failed += 1
      continue
    }

    const report = buildInsights({
      stats,
      patternsByStepKey: patternsFromQuest(quest),
      textsByStepKey: textsFromQuest(quest),
      minCount: args.minCount,
    })
    report.questSlug = quest.quest_id
    report.questTitle = quest.title
    reports.push(report)
  }

  const withData = reports.filter((report) => report.hasData)
  if (!withData.length) {
    // Пустая таблица нулей читается как «всё хорошо». Это не результат.
    throw new EmptySelectionError(
      `quest:insights: нет данных за окно ${args.since}. Попытки не собраны или окно слишком узкое.`,
    )
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(args.all ? withData : withData[0], null, 2)}\n`)
  } else {
    withData.sort((a, b) => b.totalFriction - a.totalFriction)
    for (const report of withData) {
      console.log(`\n=== ${report.questTitle ?? report.questSlug ?? report.questId} ===`)
      printReport(report, { minCount: args.minCount })
    }
  }

  requireNoBatchFailures(failed, {
    total: questRefs.length,
    message: `не удалось обойти квестов: ${failed} из ${questRefs.length}`,
  })
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}

module.exports = {
  CATEGORY,
  CATEGORY_LABEL,
  FRICTION_WEIGHTS,
  acceptedVariantsFromPattern,
  buildInsights,
  classifyRejectedValue,
  computeFriction,
  findStepTextEcho,
  levenshtein,
  normalizeValue,
  parseArgs,
  typoThreshold,
}
