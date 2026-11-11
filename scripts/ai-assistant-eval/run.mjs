#!/usr/bin/env node
/**
 * Контур оценки ассистента /assistant (#2710): вопросы посетителя задаются через
 * тот же экран, что у человека, — подбор `api/aiAssist/retrieval.ts` → промпт
 * `prompt.ts` → `llama-server` → страж `linkGuard.ts` работают без подмен.
 * Playwright перехватывает только запрос к модели: пересылает его в `--model-url`
 * и сохраняет карточки промпта и сырой ответ до стража.
 *
 *   npm run ai:assistant:eval                         # все вопросы, модель :8080, экран :8081
 *   npm run ai:assistant:eval -- --group off_topic --label v2
 *   npm run ai:assistant:eval -- --model-url http://127.0.0.1:8090 --label v3
 *   npm run ai:assistant:eval -- --base http://localhost:8085 --tree .codex-temp/wt-eval-base --label before
 *   npm run ai:assistant:eval -- --report <папка>     # пересчитать проверки и отчёт (+ judge.jsonl судьи)
 *   npm run ai:assistant:eval -- --provider ask --ask-url http://127.0.0.1:8787 --cases scripts/ai-assistant-eval/cases.live.jsonl
 *
 * `--provider ask` (#3286) — путь службы `/ai/ask`, который получит посетитель на проде: вопрос
 * уходит в службу клиентом экрана, Playwright и Metro не нужны (`ask-path.mjs`). Служба запущена с
 * `AI_ASSIST_EVAL_TRACE=1`; `--model-url` здесь — сверка, что служба смотрит на эту модель.
 *
 * Нужен локальный стек: прокси прод-API, `llama-server`, Metro с ассистентом
 * (`docs/features/ai-assistant.md` → «Контур оценки»). Результат — в
 * `.codex-temp/ai-assistant-eval/<время>[-метка]/`: `results.jsonl`, `report.md`,
 * `judge-task.md` (задание судье-агенту).
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAskSession, inspectAskService, loadAskProvider } from './ask-path.mjs'
import { EXPECTS, evaluateTurn, parseCards, parseSse, primaryLayer } from './checks.mjs'
import { parseJudgeLines, renderJudgeTask, renderReport, summarize, validateQualityJudges } from './report.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const DEFAULT_CASES = path.join(HERE, 'cases.jsonl')
const LOCALE_PREFERENCE_STORAGE_KEY = '@metravel/locale-preference:v1'
const TERMINAL_WAIT_MS = 240_000
const NEW_TURN_WAIT_MS = 8_000
const MODEL_TIMEOUT_MS = 180_000
/** Первая загрузка экрана в Metro собирает бандл — до пары минут. */
const PAGE_LOAD_TIMEOUT_MS = 180_000

const parseArgs = (argv) => {
  const args = { baseUrl: 'http://localhost:8081', modelUrl: 'http://127.0.0.1:8080', cases: null, repeat: 1 }
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=', 2)
    const value = () => inline ?? argv[++i]
    if (flag === '--base') args.baseUrl = value()
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
    else if (flag === '--headed') args.headed = true
    else if (flag === '--tree') args.tree = value()
    else throw new Error(`неизвестный флаг ${flag}`)
  }
  // `--report` без `--cases` берёт набор самого прогона; новый прогон — набор по умолчанию.
  if (!args.cases && !args.report) args.cases = DEFAULT_CASES
  if (args.provider !== undefined && args.provider !== 'ask') throw new Error(`--provider: только ask; получено ${args.provider}`)
  if (args.askUrl && args.provider !== 'ask') throw new Error('--ask-url нужен только с --provider ask')
  if (args.provider === 'ask') args.askUrl = (args.askUrl ?? 'http://127.0.0.1:8787').replace(/\/+$/, '')
  args.baseUrl = args.baseUrl.replace(/\/+$/, '')
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
  // Путь службы оценивается полезностью: вердикт без трёх оценок в отчёт не попадает.
  if (meta.provider === 'ask') errors.push(...validateQualityJudges(results, judges))
  else for (const key of judges.keys()) if (!known.has(key)) errors.push(`${key}: неизвестный ход судьи`)
  if (errors.length) throw new Error(`judge.jsonl: ${errors.join('; ')}`)
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReport(meta, results, judges))
  return summarize(results, judges)
}

/** Модель за перехватом: та же нагрузка, что от экрана, плюс запись карточек и сырого ответа. */
const installModelRoute = async (context, modelUrl, calls) => {
  await context.route('**/v1/chat/completions', async (route) => {
    const request = route.request()
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const body = request.postData() ?? '{}'
    const messages = JSON.parse(body).messages ?? []
    const userMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
    const call = { cards: parseCards(userMessage), messages, startedAt: Date.now() }
    calls.push(call)
    try {
      const response = await fetch(`${modelUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      })
      const text = await response.text()
      Object.assign(call, parseSse(text), { httpStatus: response.status, ms: Date.now() - call.startedAt })
      await route.fulfill({ status: response.status, headers: { ...cors, 'content-type': response.headers.get('content-type') ?? 'text/event-stream' }, body: text })
    } catch (error) {
      Object.assign(call, { error: String(error?.message ?? error), ms: Date.now() - call.startedAt })
      await route.abort('connectionrefused')
    }
  })
}

/** Последний ход ленты так, как его видит посетитель. */
const readLastTurn = (page) =>
  page.evaluate(() => {
    const turns = [...document.querySelectorAll('[data-testid^="assistant-turn-"]')]
    const turn = turns[turns.length - 1]
    if (!turn) return null
    // Отказ «не по теме» (#2711) — отдельный текст хода, а не ответ модели.
    const answer = turn.querySelector('[data-testid="assistant-answer-text"]') ?? turn.querySelector('[data-testid="assistant-offtopic"]')
    const answerText = answer ? answer.innerText.trim() : ''
    const sources = [...turn.querySelectorAll('[data-testid^="assistant-source-"]')].map((element) => {
      const [, type, id] = /^assistant-source-(\w+)-(.+)$/.exec(element.getAttribute('data-testid')) ?? []
      const label = element.getAttribute('aria-label') ?? ''
      return { type, id, title: label.replace(/^[^:]+:\s*/, '') }
    })
    const full = turn.innerText
    return {
      status: turn.getAttribute('data-testid').replace('assistant-turn-', ''),
      answerText,
      linkLabels: [...turn.querySelectorAll('[data-testid="assistant-answer-link"]')].map((element) => element.innerText.trim()),
      sources,
      linksRemovedNotice: Boolean(turn.querySelector('[data-testid="assistant-links-removed"]')),
      notice: full.split('\n').slice(3, 6).filter((line) => line.trim() && line.trim() !== answerText).join(' ').trim(),
    }
  })

const readComposer = (page) =>
  page.evaluate(() => {
    // Кнопка «Спросить» выключена и при пустом поле, поэтому блок читается только по самому полю.
    const input = document.querySelector('[data-testid="assistant-input"]')
    const meta = document.querySelector('[data-testid="assistant-composer-meta"]')
    return {
      // Блок — это закрытое поле; экран без поля (упал, не догрузился) блокировкой не считается.
      inputMissing: !input,
      inputBlocked: Boolean(input) && (input.disabled || input.readOnly || input.getAttribute('aria-disabled') === 'true'),
      composerMeta: meta ? meta.innerText.trim() : '',
    }
  })

const countTurns = (page) => page.locator('[data-testid^="assistant-turn-"]').count()

const askTurn = async (page, question, calls) => {
  const before = await countTurns(page)
  const callsBefore = calls.length
  const input = page.locator('[data-testid="assistant-input"]')
  const composerBefore = await readComposer(page)
  if (composerBefore.inputMissing) return { turnCreated: false, status: 'error', ...composerBefore, blockedAfter: false, composerMeta: 'на экране нет поля ввода' }
  if (!composerBefore.inputBlocked) {
    await input.fill(question)
    await input.press('Enter')
  }
  const deadline = Date.now() + NEW_TURN_WAIT_MS
  while (Date.now() < deadline && (await countTurns(page)) <= before) await page.waitForTimeout(150)
  if ((await countTurns(page)) <= before) {
    const composer = await readComposer(page)
    return { turnCreated: false, ...composer, blockedAfter: composer.inputBlocked }
  }
  const terminalDeadline = Date.now() + TERMINAL_WAIT_MS
  let last = await readLastTurn(page)
  while (Date.now() < terminalDeadline && last && ['searching', 'streaming'].includes(last.status)) {
    await page.waitForTimeout(250)
    last = await readLastTurn(page)
  }
  await page.waitForTimeout(300)
  last = await readLastTurn(page)
  const composer = await readComposer(page)
  const modelCall = calls.length > callsBefore ? calls[calls.length - 1] : null
  return { turnCreated: true, ...last, ...composer, blockedAfter: composer.inputBlocked, modelCall: modelCall ? { ...modelCall, messages: undefined, prompt: modelCall.messages } : null }
}

const openFreshScreen = async (page, baseUrl, locale) => {
  await page.goto(`${baseUrl}/assistant`, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT_MS })
  await page.evaluate(
    ([key, value]) => {
      window.localStorage.clear()
      window.localStorage.setItem(key, value)
    },
    [LOCALE_PREFERENCE_STORAGE_KEY, JSON.stringify({ version: 1, mode: 'explicit', locale })],
  )
  // Пока Metro пересобирает бандл, роутер на миг уводит /assistant на главную и обратно, а
  // переход может оборваться (ERR_ABORTED): если экран не появился, переход повторяется.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await page.goto(`${baseUrl}/assistant`, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT_MS })
      await page.locator('[data-testid="assistant-input"]').waitFor({ state: 'visible', timeout: PAGE_LOAD_TIMEOUT_MS / 3 })
      return
    } catch (error) {
      if (attempt >= 3) throw error
    }
  }
}

/** Ожидание хода; нужные карточки проверяются на последнем ходе диалога (первые — подводка). */
const turnExpectation = (item, index) => ({
  expect: item.expects[index],
  lang: item.lang,
  expectSources: index === item.turns.length - 1 ? item.expect_sources ?? null : null,
})

const scoreTurn = (expectation, observed) => {
  const evaluation = evaluateTurn(expectation, observed)
  return { ...evaluation, primaryLayer: evaluation.pass ? null : primaryLayer(evaluation.failures) }
}

/**
 * Прогон набора. `openCase` открывает диалог одного вопроса (свежий экран или свой адрес посетителя
 * у службы) и возвращает «задать вопрос → наблюдение хода»; проверки и запись — общие для обоих путей.
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
        const evaluation = scoreTurn(expectation, observed)
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

/** Путь экрана: Playwright задаёт вопрос на `/assistant`, запрос к модели перехватывается. */
async function openScreenDriver(args) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: !args.headed })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const calls = []
  await installModelRoute(context, args.modelUrl, calls)
  const page = await context.newPage()
  return {
    openCase: async (item) => {
      await openFreshScreen(page, args.baseUrl, item.locale)
      return (question) => askTurn(page, question, calls)
    },
    close: () => browser.close(),
  }
}

/** Путь службы (#3286): клиент экрана шлёт вопрос в `/ai/ask`, каждый вопрос набора — со своего адреса посетителя. */
async function openAskDriver(args) {
  const { createAskClient } = await loadAskProvider()
  // Метка прогона в адресе: счётчики службы за день не складываются между прогонами.
  const run = Date.now().toString(16).padStart(12, '0')
  return {
    openCase: (item, sequence) =>
      createAskSession({ createAskClient, askUrl: args.askUrl, locale: item.locale, source: item.source ?? null, visitor: `2001:db8:${run.slice(0, 4)}:${run.slice(4, 8)}:${run.slice(8, 12)}::${sequence.toString(16)}` }),
    close: async () => {},
  }
}

async function runCases(args) {
  const viaService = args.provider === 'ask'
  const cases = loadCases(args.cases).filter((item) => (!args.only || args.only.has(item.id)) && (!args.group || args.group.has(item.group)))
  if (!cases.length) throw new Error('нет вопросов под фильтр')
  const tree = path.resolve(ROOT, args.tree ?? '.')
  // Старый Node, служба без события `trace` или на чужой модели — замера нет: отказ до первого вопроса.
  if (viaService) await loadAskProvider()
  const service = viaService ? await inspectAskService(args.askUrl, args.expectModelUrl ?? null, fetchJson) : null
  const modelUrl = service?.llmUrl ?? args.modelUrl
  const outDir = path.resolve(ROOT, args.out ?? `.codex-temp/ai-assistant-eval/${stamp()}${args.label ? `-${args.label}` : ''}`)
  fs.mkdirSync(outDir, { recursive: true })

  const models = await fetchJson(`${modelUrl}/v1/models`).catch((error) => {
    console.warn(`[eval] модель недоступна: ${error.message} — ходы будут помечены «инфраструктура»`)
    return null
  })
  const meta = {
    label: args.label ?? null,
    startedAt: new Date().toISOString(),
    ...(viaService ? { provider: 'ask', askUrl: args.askUrl, index: { builtAt: service.indexBuiltAt, count: service.indexCount } } : { baseUrl: args.baseUrl }),
    modelUrl,
    model: models?.data?.[0]?.id ?? models?.models?.[0]?.name ?? null,
    // Metro отдаёт рабочее дерево с горячей перезагрузкой: незакоммиченные правки ассистента входят
    // в замер, а правка посреди прогона его портит. Замер «до» — Metro из отдельного worktree (`--tree`).
    // Служба код на лету не перечитывает: её правки входят в замер после перезапуска.
    tree: path.relative(ROOT, tree) || '.',
    gitSha: git(tree, 'rev-parse', '--short', 'HEAD'),
    dirty: git(tree, 'status', '--short', '--', 'api/aiAssist', ...(viaService ? ['scripts/ai-assist', 'scripts/ai-index'] : ['components/screens/assistant', 'i18n/locales']))?.split('\n').filter(Boolean) ?? [],
    cases: path.relative(ROOT, args.cases),
    repeat: args.repeat,
  }
  const driver = viaService ? await openAskDriver(args) : await openScreenDriver(args)
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
  fs.writeFileSync(path.join(outDir, 'judge-task.md'), renderJudgeTask(fs.readFileSync(path.join(HERE, 'JUDGE.md'), 'utf8'), results, path.relative(ROOT, outDir), { scores: viaService }))
  const summary = writeReport(outDir, meta, results)
  console.log(`\n${summary.passed}/${summary.turns} ходов прошли. Отчёт: ${path.relative(ROOT, path.join(outDir, 'report.md'))}`)
}

/**
 * Пересборка отчёта по сохранённым наблюдениям: проверки пересчитываются текущим
 * `checks.mjs` (правка проверки не требует нового прогона модели), вердикты судьи
 * подмешиваются из `judge.jsonl`.
 */
export function rebuildReport(dir, casesFile) {
  const outDir = path.resolve(ROOT, dir)
  const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'meta.json'), 'utf8'))
  // Ожидания берутся из набора самого прогона (`meta.cases`), а не из набора по умолчанию: иначе
  // проверки прогона на другом файле молча не пересчитывались. Явный `--cases` важнее; набор,
  // которого уже нет (переименован), — ошибка, а не тихий пропуск.
  const ownCases = meta.cases ? path.resolve(ROOT, meta.cases) : null
  const source = casesFile ?? (ownCases && fs.existsSync(ownCases) ? ownCases : null)
  if (!source) throw new Error(`набор прогона ${meta.cases ?? '?'} не найден — укажите его через --cases`)
  const cases = new Map(loadCases(source).map((item) => [item.id, item]))
  const results = fs
    .readFileSync(path.join(outDir, 'results.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const result = JSON.parse(line)
      const item = cases.get(result.id.replace(/@\d+$/, ''))
      if (!item) throw new Error(`${result.id}: вопроса нет в наборе ${path.relative(ROOT, source)}`)
      result.turns = result.turns.map((turn, index) => {
        const expectation = turnExpectation(item, index)
        return { ...turn, ...expectation, eval: scoreTurn(expectation, turn.observed) }
      })
      return result
    })
  fs.writeFileSync(path.join(outDir, 'results.jsonl'), results.map((result) => JSON.stringify(result)).join('\n') + '\n')
  const summary = writeReport(outDir, meta, results)
  console.log(`${summary.passed}/${summary.turns} ходов прошли (с судьёй). Отчёт: ${path.relative(ROOT, path.join(outDir, 'report.md'))}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2))
  Promise.resolve(args.report ? rebuildReport(args.report, args.cases) : runCases(args)).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
