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
const GARBAGE_INPUTS = new Set(['хз', 'не знаю', 'незнаю', 'ответ', 'фиг знает', 'idk', 'нет', '?', '??', '???'])

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

/** Нормализация как в `utils/questAdapters.normalize` — сравниваем одинаково. */
function normalizeValue(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'„""–—-]/g, '')
    .replace(/ё/g, 'е')
    .trim()
}

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
function buildInsights({ stats, patternsByStepKey = {}, minCount = 2 } = {}) {
  const steps = Array.isArray(stats?.steps) ? stats.steps : []

  const enriched = steps.map((step) => {
    const accepted = acceptedVariantsFromPattern(patternsByStepKey[step.step_key])
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

function parseArgs(argv) {
  const args = {
    quest: null,
    since: '90d',
    minCount: 2,
    all: false,
    json: false,
    baseUrl: DEFAULT_BASE_URL,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--quest') args.quest = argv[++i]
    else if (arg === '--since') args.since = argv[++i]
    else if (arg === '--min-count') args.minCount = Math.max(1, Number(argv[++i]) || 2)
    else if (arg === '--base-url') args.baseUrl = argv[++i]
    else if (arg === '--all') args.all = true
    else if (arg === '--json') args.json = true
  }
  return args
}

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
          console.log(`    «${candidate.value}» — ${candidate.count} раз у ${candidate.players} игроков`)
        }
      }
    }
    console.log('')
  }

  console.log('Решение принимает редактор: синоним можно добавить в answer_pattern,')
  console.log('«фактически другой ответ» означает, что переписать надо формулировку задания.')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()

  if (!args.quest && !args.all) {
    console.error('quest:insights: укажите --quest <id|slug> или --all')
    process.exit(1)
  }

  const token = readStaffToken(rootDir)
  const questRefs = args.all
    ? (await apiGet(args.baseUrl, '/api/quests/?page_size=300', token)).results?.map((q) => q.id) ?? []
    : [args.quest]

  const reports = []
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
      if (!args.all) process.exit(1)
      continue
    }

    const report = buildInsights({
      stats,
      patternsByStepKey: patternsFromQuest(quest),
      minCount: args.minCount,
    })
    report.questSlug = quest.quest_id
    report.questTitle = quest.title
    reports.push(report)
  }

  const withData = reports.filter((report) => report.hasData)
  if (!withData.length) {
    // Пустая таблица нулей читается как «всё хорошо». Это не результат.
    console.error(`quest:insights: нет данных за окно ${args.since}. Попытки не собраны или окно слишком узкое.`)
    process.exit(1)
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(args.all ? withData : withData[0], null, 2)}\n`)
    return
  }

  withData.sort((a, b) => b.totalFriction - a.totalFriction)
  for (const report of withData) {
    console.log(`\n=== ${report.questTitle ?? report.questSlug ?? report.questId} ===`)
    printReport(report, { minCount: args.minCount })
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`quest:insights: ${error.message}`)
    process.exit(1)
  })
}

module.exports = {
  CATEGORY,
  CATEGORY_LABEL,
  FRICTION_WEIGHTS,
  acceptedVariantsFromPattern,
  buildInsights,
  classifyRejectedValue,
  computeFriction,
  levenshtein,
  normalizeValue,
  parseArgs,
  typoThreshold,
}
