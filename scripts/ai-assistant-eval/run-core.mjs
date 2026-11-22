/**
 * Прогон контура оценки ассистента /assistant (#2710). Путь один (#3286, #3297) — служба `/ai/ask`,
 * которую получает посетитель: вопрос уходит в службу клиентом экрана (`api/aiAssist/askProvider.ts`,
 * `ask-path.mjs`), подбор по индексу, подсказка, модель и стражи работают без подмен; служба запущена с
 * `AI_ASSIST_EVAL_TRACE=1` и отдаёт карточки подсказки и сырой ответ модели. Прежний путь экрана
 * (Playwright + перехват запроса приложения к модели) удалён вместе с клиентским пайплайном.
 *
 * Команды и флаги — в точке входа `run.mjs`: она подключает загрузчик TypeScript и зовёт `main`
 * отсюда. Модуль грузит общий код приложения и службы (`checks.mjs` → `scripts/ai-assist/*.ts`,
 * `api/aiAssist/*.ts`), поэтому импортируется только после загрузчика; тесты и соседние скрипты берут
 * функции прогона здесь.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAskSession, inspectAskService, loadAskProvider, loadShownTexts } from './ask-path.mjs'
import { EXPECTS, evaluateTurn, primaryLayer } from './checks.mjs'
import { parseJudgeLines, renderJudgeTask, renderReport, summarize, validateQualityJudges } from './report.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const DEFAULT_CASES = path.join(HERE, 'cases.jsonl')
/** Адрес службы по умолчанию — тот же, куда Metro проксирует `/ai/*` (`metro.config.js`). */
const DEFAULT_ASK_URL = 'http://127.0.0.1:8787'
/** Флаги пути экрана, удалённого с клиентским пайплайном (#3297): называются, чтобы старая команда не шла молча другим путём. */
const REMOVED_SCREEN_FLAGS = new Set(['--base', '--headed'])

const parseArgs = (argv) => {
  const args = { provider: 'ask', modelUrl: 'http://127.0.0.1:8080', cases: null, repeat: 1 }
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=', 2)
    const value = () => inline ?? argv[++i]
    if (REMOVED_SCREEN_FLAGS.has(flag)) throw new Error(`${flag}: путь экрана удалён (#3297) — прогон идёт только через службу /ai/ask (--ask-url)`)
    else if (flag === '--model-url') args.modelUrl = args.expectModelUrl = value()
    else if (flag === '--provider') args.provider = value()
    else if (flag === '--ask-url') args.askUrl = value()
    else if (flag === '--cases') args.cases = value()
    else if (flag === '--only') args.only = new Set(value().split(','))
    else if (flag === '--group') args.group = new Set(value().split(','))
    else if (flag === '--label') args.label = value()
    else if (flag === '--out') args.out = value()
    else if (flag === '--repeat') args.repeat = Math.max(1, Number(value()) || 1)
    else if (flag === '--report') args.report = value()
    else if (flag === '--tree') args.tree = value()
    else throw new Error(`неизвестный флаг ${flag}`)
  }
  // `--report` без `--cases` берёт набор самого прогона; новый прогон — набор по умолчанию.
  if (!args.cases && !args.report) args.cases = DEFAULT_CASES
  // `--provider ask` принимается ради старых команд: другого пути нет.
  if (args.provider !== 'ask') throw new Error(`--provider: только ask; получено ${args.provider}`)
  args.askUrl = (args.askUrl ?? DEFAULT_ASK_URL).replace(/\/+$/, '')
  args.modelUrl = args.modelUrl.replace(/\/+$/, '')
  return args
}

export { parseArgs as parseRunArgs }

export const loadCases = (file) => {
  const cases = []
  const seen = new Set()
  for (const [index, line] of fs.readFileSync(file, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue
    const item = JSON.parse(line)
    const turns = Array.isArray(item.turns) ? item.turns : [item.q]
    const expects = Array.isArray(item.expect) ? item.expect : turns.map(() => item.expect)
    if (!item.id || seen.has(item.id)) throw new Error(`${file}:${index + 1}: нет id или повтор ${item.id}`)
    if (!turns.length || turns.some((turn) => !String(turn ?? '').trim())) throw new Error(`${item.id}: пустой вопрос`)
    if (expects.length !== turns.length || expects.some((value) => !EXPECTS.includes(value))) throw new Error(`${item.id}: expect по ходам — одно из ${EXPECTS.join('/')}`)
    // Страница, с которой задан вопрос (#2897): в пути службы уходит в запрос полем `source`.
    if (item.source !== undefined && !(['travel', 'quest'].includes(item.source?.type) && Number.isInteger(item.source?.id) && item.source.id > 0)) throw new Error(`${item.id}: source — {type: travel|quest, id: положительное целое}`)
    // Маршруты мира (#3357): ожидание блока «Ещё в мире» — числа и шаблон страны.
    if (item.expect_world !== undefined) {
      const world = item.expect_world
      const numeric = ['min', 'max', 'max_km', 'min_km', 'month', 'max_days']
      const known = [...numeric, 'country', 'title']
      const bad = !world || typeof world !== 'object' || Object.keys(world).some((key) => !known.includes(key)) || numeric.some((key) => world[key] !== undefined && !(Number.isFinite(world[key]) && world[key] >= 0))
      if (bad || (world.month !== undefined && !(Number.isInteger(world.month) && world.month >= 1 && world.month <= 12))) throw new Error(`${item.id}: expect_world — {min, max, max_km, min_km, month 1–12, max_days, country, title}`)
    }
    // Личный вопрос (#3354): задаётся от имени тестового аккаунта — токен берётся из окружения прогона.
    if (item.profile !== undefined && typeof item.profile !== 'boolean') throw new Error(`${item.id}: profile — true или false`)
    seen.add(item.id)
    cases.push({ ...item, turns, expects, locale: item.locale ?? item.lang ?? 'ru', lang: item.lang ?? 'ru' })
  }
  return cases
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

const git = (cwd, ...args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error(`${url} → ${response.status}`)
  return response.json()
}

const writeReport = (outDir, meta, results) => {
  const judgeFile = path.join(outDir, 'judge.jsonl')
  const { judges, errors } = fs.existsSync(judgeFile) ? parseJudgeLines(fs.readFileSync(judgeFile, 'utf8')) : { judges: new Map(), errors: [] }
  // Вердикт на ход, которого в прогоне нет, — ошибка судьи (опечатка в key), а не лишняя строка.
  const known = new Set(results.flatMap((result) => result.turns.map((_, index) => `${result.id}#${index}`)))
  // Путь службы оценивается полезностью: вердикт без трёх оценок в отчёт не попадает. Прогон прежнего
  // пути экрана (до #3297) пересчитывается по своим правилам: три оценки от судьи там не требовались.
  if (meta.provider === 'ask') errors.push(...validateQualityJudges(results, judges))
  else for (const key of judges.keys()) if (!known.has(key)) errors.push(`${key}: неизвестный ход судьи`)
  if (errors.length) throw new Error(`judge.jsonl: ${errors.join('; ')}`)
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReport(meta, results, judges))
  return summarize(results, judges)
}

/** Ожидание хода; нужные карточки проверяются на последнем ходе диалога (первые — подводка). */
const turnExpectation = (item, index) => ({
  expect: item.expects[index],
  lang: item.lang,
  expectSources: index === item.turns.length - 1 ? item.expect_sources ?? null : null,
  // Контрольный вопрос о поездке (#3293): справочных карточек среди источников быть не должно.
  ...(item.no_help === true ? { noHelp: true } : {}),
  // Маршруты мира (#3357): блок «Ещё в мире» проверяется на последнем ходе диалога.
  ...(index === item.turns.length - 1 && item.expect_world ? { expectWorld: item.expect_world } : {}),
})

const scoreTurn = (expectation, observed) => {
  const evaluation = evaluateTurn(expectation, observed)
  return { ...evaluation, primaryLayer: evaluation.pass ? null : primaryLayer(evaluation.failures) }
}

/**
 * Прогон набора. `openCase` открывает диалог одного вопроса (свой адрес посетителя у службы) и
 * возвращает «задать вопрос → наблюдение хода».
 */
export async function collectResults(cases, repeat, openCase, onResult = () => {}) {
  const results = []
  let sequence = 0
  for (let round = 0; round < repeat; round += 1) {
    for (const item of cases) {
      const id = repeat > 1 ? `${item.id}@${round + 1}` : item.id
      const ask = await openCase(item, sequence)
      sequence += 1
      const turns = []
      for (const [index, question] of item.turns.entries()) {
        const observed = await ask(question)
        const expectation = turnExpectation(item, index)
        // Слой стража содержания (#3291): вопрос хода и прошлые вопросы диалога; в запись хода они не идут.
        const evaluation = scoreTurn({ ...expectation, question, earlier: item.turns.slice(0, index).join(' ') }, observed)
        turns.push({ question, ...expectation, observed, eval: evaluation })
        const mark = evaluation.pass ? 'ok ' : 'FAIL'
        console.log(`${mark} ${id}#${index} [${observed.status ?? 'нет хода'}] ${question.slice(0, 60)}${evaluation.pass ? '' : ` — ${evaluation.failures.map((f) => f.check).join(', ')}`}`)
      }
      const result = { id, group: item.group, lang: item.lang, locale: item.locale, turns }
      results.push(result)
      onResult(result)
    }
  }
  return results
}

/** Переменная окружения с токеном тестового аккаунта для личных вопросов (#3354). Значение нигде не печатается. */
export const PROFILE_TOKEN_ENV = 'AI_ASSIST_EVAL_PROFILE_TOKEN'

/**
 * Токен для вопроса набора: личный вопрос (`profile: true`) идёт от имени тестового аккаунта, остальные — как
 * у гостя, даже когда переменная задана. Личный вопрос без токена — ошибка сборки прогона, а не провал ответа.
 */
export const profileTokenFor = (item, env = process.env) => {
  if (item.profile !== true) return null
  const token = String(env[PROFILE_TOKEN_ENV] ?? '').trim()
  if (!token) throw new Error(`${item.id}: личный вопрос — задайте ${PROFILE_TOKEN_ENV} (токен тестового аккаунта; значение не печатается)`)
  return token
}

/** Путь службы (#3286): клиент экрана шлёт вопрос в `/ai/ask`, каждый вопрос набора — со своего адреса посетителя. */
async function openAskDriver(args) {
  const { createAskClient } = await loadAskProvider()
  // Метка прогона в адресе: счётчики службы за день не складываются между прогонами.
  const run = Date.now().toString(16).padStart(12, '0')
  return {
    // Строки экрана на локали хода: ход без текста модели контур видит так же, как посетитель.
    openCase: async (item, sequence) =>
      createAskSession({ createAskClient, askUrl: args.askUrl, locale: item.locale, source: item.source ?? null, shownTexts: await loadShownTexts(item.locale), authToken: profileTokenFor(item), visitor: `2001:db8:${run.slice(0, 4)}:${run.slice(4, 8)}:${run.slice(8, 12)}::${sequence.toString(16)}` }),
    close: async () => {},
  }
}

async function runCases(args) {
  const cases = loadCases(args.cases).filter((item) => (!args.only || args.only.has(item.id)) && (!args.group || args.group.has(item.group)))
  if (!cases.length) throw new Error('нет вопросов под фильтр')
  const personal = cases.filter((item) => item.profile === true)
  if (personal.length) profileTokenFor(personal[0])
  const tree = path.resolve(ROOT, args.tree ?? '.')
  // Старый Node, служба без события `trace` или на чужой модели — замера нет: отказ до первого вопроса.
  await loadAskProvider()
  const service = await inspectAskService(args.askUrl, args.expectModelUrl ?? null, fetchJson)
  const modelUrl = service.llmUrl ?? args.modelUrl
  const outDir = path.resolve(ROOT, args.out ?? `.codex-temp/ai-assistant-eval/${stamp()}${args.label ? `-${args.label}` : ''}`)
  fs.mkdirSync(outDir, { recursive: true })

  const models = await fetchJson(`${modelUrl}/v1/models`).catch((error) => {
    console.warn(`[eval] модель недоступна: ${error.message} — ходы будут помечены «инфраструктура»`)
    return null
  })
  const meta = {
    label: args.label ?? null,
    startedAt: new Date().toISOString(),
    provider: 'ask',
    askUrl: args.askUrl,
    index: { builtAt: service.indexBuiltAt, count: service.indexCount },
    modelUrl,
    model: models?.data?.[0]?.id ?? models?.models?.[0]?.name ?? null,
    // Служба код на лету не перечитывает: её правки входят в замер после перезапуска. `--tree` — дерево,
    // из которого запущена служба (замер «до» — служба из отдельного worktree).
    tree: path.relative(ROOT, tree) || '.',
    gitSha: git(tree, 'rev-parse', '--short', 'HEAD'),
    dirty: git(tree, 'status', '--short', '--', 'api/aiAssist', 'scripts/ai-assist', 'scripts/ai-index')?.split('\n').filter(Boolean) ?? [],
    cases: path.relative(ROOT, args.cases),
    repeat: args.repeat,
  }
  const driver = await openAskDriver(args)
  const resultsFile = path.join(outDir, 'results.jsonl')
  fs.writeFileSync(resultsFile, '')
  const started = Date.now()
  let results
  try {
    results = await collectResults(cases, args.repeat, driver.openCase, (result) => fs.appendFileSync(resultsFile, `${JSON.stringify(result)}\n`))
  } finally {
    await driver.close()
  }
  meta.durationSec = Math.round((Date.now() - started) / 1000)
  fs.writeFileSync(path.join(outDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
  // Путь службы оценивается полезностью: судья ставит три оценки на каждый ход.
  fs.writeFileSync(path.join(outDir, 'judge-task.md'), renderJudgeTask(fs.readFileSync(path.join(HERE, 'JUDGE.md'), 'utf8'), results, path.relative(ROOT, outDir), { scores: true }))
  const summary = writeReport(outDir, meta, results)
  console.log(`\n${summary.passed}/${summary.turns} ходов прошли. Отчёт: ${path.relative(ROOT, path.join(outDir, 'report.md'))}`)
}

/**
 * Пересборка отчёта по сохранённым наблюдениям: проверки пересчитываются текущим
 * `checks.mjs` (правка проверки не требует нового прогона модели), вердикты судьи
 * подмешиваются из `judge.jsonl`. Слой стража содержания считается так же, как в прогоне: по вопросу
 * хода и прошлым вопросам диалога — иначе пересчёт молча терял его провалы.
 *
 * `out` — папка для пересчитанной копии (#3277): исходный прогон не меняется, поэтому базу сравнения
 * можно честно пересчитать новыми проверками и положить рядом с новым прогоном. `meta.json` копии
 * несёт `rescoredFrom`. Без `out` результат пишется в ту же папку, как раньше.
 */
export function rebuildReport(dir, casesFile, out = null) {
  const sourceDir = path.resolve(ROOT, dir)
  const outDir = out ? path.resolve(ROOT, out) : sourceDir
  const meta = JSON.parse(fs.readFileSync(path.join(sourceDir, 'meta.json'), 'utf8'))
  // Ожидания берутся из набора самого прогона (`meta.cases`), а не из набора по умолчанию: иначе
  // проверки прогона на другом файле молча не пересчитывались. Явный `--cases` важнее; набор,
  // которого уже нет (переименован), — ошибка, а не тихий пропуск.
  const ownCases = meta.cases ? path.resolve(ROOT, meta.cases) : null
  const source = casesFile ?? (ownCases && fs.existsSync(ownCases) ? ownCases : null)
  if (!source) throw new Error(`набор прогона ${meta.cases ?? '?'} не найден — укажите его через --cases`)
  const cases = new Map(loadCases(source).map((item) => [item.id, item]))
  const results = fs
    .readFileSync(path.join(sourceDir, 'results.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const result = JSON.parse(line)
      const item = cases.get(result.id.replace(/@\d+$/, ''))
      if (!item) throw new Error(`${result.id}: вопроса нет в наборе ${path.relative(ROOT, source)}`)
      result.turns = result.turns.map((turn, index) => {
        const expectation = turnExpectation(item, index)
        const question = turn.question ?? item.turns[index]
        return { ...turn, ...expectation, eval: scoreTurn({ ...expectation, question, earlier: item.turns.slice(0, index).join(' ') }, turn.observed) }
      })
      return result
    })
  if (outDir !== sourceDir) {
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'meta.json'), `${JSON.stringify({ ...meta, rescoredFrom: path.relative(ROOT, sourceDir) }, null, 2)}\n`)
    for (const name of ['judge.jsonl', 'judge-task.md']) {
      if (fs.existsSync(path.join(sourceDir, name))) fs.copyFileSync(path.join(sourceDir, name), path.join(outDir, name))
    }
  }
  fs.writeFileSync(path.join(outDir, 'results.jsonl'), results.map((result) => JSON.stringify(result)).join('\n') + '\n')
  const summary = writeReport(outDir, meta, results)
  console.log(`${summary.passed}/${summary.turns} ходов прошли (с судьёй). Отчёт: ${path.relative(ROOT, path.join(outDir, 'report.md'))}`)
  return summary
}

/** Запуск из командной строки: `run.mjs` передаёт сюда аргументы после загрузчика TypeScript. */
export async function main(argv) {
  try {
    const args = parseArgs(argv)
    await (args.report ? rebuildReport(args.report, args.cases, args.out) : runCases(args))
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
