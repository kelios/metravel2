#!/usr/bin/env node
/**
 * Одна команда приёмки кандидата metravel-llm (#3267): база и кандидат на одинаковых входах —
 * целевые вопросы экрана ×3, отложенные ×3, «не по теме» и попытки сломать, набор quality ×3 и
 * срезы `eval.py`; на выходе таблица «замер — база — кандидат — порог — пройдено» по
 * `acceptance.thresholds.json`.
 *
 *   npm run ai:assistant:accept -- --base-url http://127.0.0.1:8080 --candidate-url http://127.0.0.1:8090
 *   npm run ai:assistant:accept -- --plan                      # показать команды, ничего не запускать
 *   npm run ai:assistant:accept -- --provider ask --base-ask-url http://127.0.0.1:8787 --candidate-ask-url http://127.0.0.1:8788 …
 *   npm run ai:assistant:accept -- --merge-judge <папка>       # вердикты судьи → прогоны → таблица
 *   npm run ai:assistant:accept -- --table <папка>             # пересчитать проверки и таблицу
 *   npm run ai:assistant:accept -- --freeze                    # переписать опись оценочных входов
 *
 * Нужен тот же локальный стек, что у контура (`docs/features/ai-assistant.md` → «Контур оценки»):
 * прокси прод-API, Metro с ассистентом (`--screen`, по умолчанию :8081) и ДВА `llama-server` — с
 * базой и с кандидатом. Обе модели идут через один и тот же экран: `run.mjs` перехватывает запрос
 * к модели и пересылает его на нужный сервер. Незавершённую приёмку можно продолжить тем же `--out`:
 * готовые прогоны не повторяются.
 *
 * `--provider ask` (#3286) добавляет прогоны пути службы `/ai/ask` (в `runs` — `"provider": "ask"`):
 * живые вопросы идут в две службы metravel-assist — `--base-ask-url` смотрит на `llama-server` базы,
 * `--candidate-ask-url` — на кандидата; обе запущены с `AI_ASSIST_EVAL_TRACE=1` и на одном индексе.
 * Без флага эти прогоны не собираются, а их строки таблицы остаются «не оценено».
 *
 * Судья — обязательный шаг: после сбора в `<папка>/judge/A` и `<папка>/judge/B` лежат задания со
 * слепыми метками (сырой и показанный ответ, без имён версий). Судья пишет `judge.jsonl` рядом с
 * каждым заданием, `--merge-judge` переносит вердикты в прогоны. До этого строки с судьёй в таблице
 * «не оценено», а итог — «приёмка неполная».
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildAcceptance, renderAcceptance, validateThresholds } from './acceptance.mjs'
import { inspectAskService } from './ask-path.mjs'
import { parseJudgeLines, renderJudgeTask, validateQualityJudges } from './report.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const THRESHOLDS = path.join(HERE, 'acceptance.thresholds.json')
const INVENTORY = path.join(HERE, 'eval-inventory.json')
const EVAL_PROMPTS = path.join(ROOT, 'scripts/ai-train/eval_prompts')
const SIDES = ['base', 'candidate']
/**
 * Флаги Node для дочерних прогонов (#3291): общий код приложения (`api/aiAssist/*.ts`) грузят и путь
 * службы, и набор quality, и проверки `checks.mjs`. Загрузчик `scripts/lib/ts-runtime.mjs` делает его
 * доступным на Node 20 и 22 одинаково — те же флаги стоят у команд `ai:assistant:*` в `package.json`.
 */
export const TS_RUNTIME_FLAGS = ['--import', pathToFileURL(path.join(ROOT, 'scripts/lib/ts-runtime.mjs')).href, '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON']

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const readLines = (file) => fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line))
const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** Замороженные оценочные входы: наборы контура, фиксированные карточки, срезы и пороги. */
export function inventoryFiles() {
  const local = fs.readdirSync(HERE).filter((name) => /^(cases.*\.jsonl|fixtures.*\.json|acceptance\.thresholds\.json|JUDGE\.md)$/.test(name)).map((name) => path.join(HERE, name))
  const slices = fs.readdirSync(EVAL_PROMPTS).filter((name) => name.endsWith('.jsonl')).map((name) => path.join(EVAL_PROMPTS, name))
  return [...local, ...slices].sort()
}

export function buildInventory() {
  const files = {}
  for (const file of inventoryFiles()) {
    const raw = fs.readFileSync(file)
    const entry = { sha256: sha256(raw) }
    if (file.endsWith('.jsonl')) entry.cases = raw.toString('utf8').split('\n').filter((line) => line.trim()).length
    files[path.relative(ROOT, file)] = entry
  }
  return { note: 'Опись замороженных оценочных входов (#3267). Правка любого файла меняет то, что измеряет приёмка: хеш обновляется той же правкой командой `npm run ai:assistant:accept -- --freeze`, а числа до и после несравнимы.', files }
}

export function parseAcceptArgs(argv) {
  const args = { screen: 'http://localhost:8081', aiHome: path.join(os.homedir(), 'metravel-ai'), skip: new Set() }
  const keys = {
    '--base-url': 'baseUrl', '--candidate-url': 'candidateUrl', '--screen': 'screen', '--out': 'out', '--ai-home': 'aiHome', '--merge-judge': 'mergeJudge', '--table': 'table',
    '--provider': 'provider', '--base-ask-url': 'baseAskUrl', '--candidate-ask-url': 'candidateAskUrl',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=', 2)
    if (flag === '--plan') args.plan = true
    else if (flag === '--freeze') args.freeze = true
    else if (flag === '--skip') args.skip = new Set((inline ?? argv[++i]).split(','))
    else if (keys[flag]) {
      const value = inline ?? argv[++i]
      if (!value || value.startsWith('--')) throw new Error(`нет значения у ${flag}`)
      args[keys[flag]] = value
    } else throw new Error(`неизвестный флаг ${flag}`)
  }
  for (const key of ['baseUrl', 'candidateUrl', 'screen', 'baseAskUrl', 'candidateAskUrl']) if (args[key]) args[key] = args[key].replace(/\/+$/, '')
  if (args.provider !== undefined && args.provider !== 'ask') throw new Error(`--provider: только ask; получено ${args.provider}`)
  if ((args.baseAskUrl || args.candidateAskUrl) && args.provider !== 'ask') throw new Error('--base-ask-url и --candidate-ask-url нужны только с --provider ask')
  const unknown = [...args.skip].filter((name) => !['contour', 'quality', 'slices'].includes(name))
  if (unknown.length) throw new Error(`--skip: contour, quality, slices; получено ${unknown.join(', ')}`)
  return args
}

/** Прогоны пути службы: в `runs` у них `"provider": "ask"`. */
const isAskRun = (run) => run.provider === 'ask'

/**
 * План прогонов одной стороны: команда, папка и сколько результатов в ней должно получиться.
 * Прогоны пути службы (#3286) входят в план только с адресом службы стороны (`askUrl`); наборы
 * вопросов читаются из `casesDir`.
 */
export function planRuns(thresholds, side, modelUrl, sideDir, screen, { askUrl = null, casesDir = HERE } = {}) {
  const runs = []
  for (const [name, run] of Object.entries(thresholds.runs)) {
    if (isAskRun(run) && !askUrl) continue
    const casesFile = path.join(casesDir, run.cases)
    if (!fs.existsSync(casesFile)) throw new Error(`runs.${name}: нет набора вопросов ${run.cases}`)
    const cases = readLines(casesFile)
    const selected = cases.filter((item) => (run.only !== 'targets' || thresholds.targets.includes(item.id)) && (!run.group || run.group.includes(item.group)))
    if (run.only === 'targets' && selected.length !== thresholds.targets.length) throw new Error(`runs.${name}: в ${run.cases} нет части целевых вопросов`)
    // Общий код приложения грузят оба пути: служба — клиент экрана (`askProvider.ts`), проверки — страж ответа.
    const argv = isAskRun(run)
      ? [...TS_RUNTIME_FLAGS, path.join(HERE, 'run.mjs'), '--provider', 'ask', '--ask-url', askUrl, '--model-url', modelUrl]
      : [...TS_RUNTIME_FLAGS, path.join(HERE, 'run.mjs'), '--base', screen, '--model-url', modelUrl]
    argv.push('--cases', casesFile, '--repeat', String(run.repeat ?? 1), '--out', path.join(sideDir, name))
    if (run.only === 'targets') argv.push('--only', thresholds.targets.join(','))
    if (run.group) argv.push('--group', run.group.join(','))
    runs.push({ kind: isAskRun(run) ? 'ask' : 'contour', side, name, dir: path.join(sideDir, name), expected: selected.length * (run.repeat ?? 1), command: [process.execPath, ...argv] })
  }
  const quality = readLines(path.join(casesDir, 'cases.quality.jsonl')).length
  for (let round = 1; round <= (thresholds.quality?.repeat ?? 1); round += 1) {
    const dir = path.join(sideDir, `quality-${round}`)
    runs.push({ kind: 'quality', side, name: `quality-${round}`, dir, expected: quality, command: [process.execPath, ...TS_RUNTIME_FLAGS, path.join(HERE, 'quality.mjs'), '--model-url', modelUrl, '--out', dir] })
  }
  return runs
}

const countResults = (dir) => (fs.existsSync(path.join(dir, 'results.jsonl')) ? readLines(path.join(dir, 'results.jsonl')).length : 0)
const isComplete = (run) => countResults(run.dir) === run.expected && fs.existsSync(path.join(run.dir, 'report.md'))

const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`${url} → ${response.status}`)
  return response.json()
}

/** Модель за адресом: файл и sha256 — метка версии сама по себе модель не определяет. */
async function identifyModel(url) {
  const models = await fetchJson(`${url}/v1/models`)
  const id = models.data?.[0]?.id ?? models.models?.[0]?.name ?? null
  const props = await fetchJson(`${url}/props`).catch(() => null)
  const file = [props?.model_path, id].find((candidate) => candidate && path.isAbsolute(candidate) && fs.existsSync(candidate)) ?? null
  let digest = null
  if (file) {
    const hash = createHash('sha256')
    await new Promise((resolve, reject) => fs.createReadStream(file).on('data', (chunk) => hash.update(chunk)).on('end', resolve).on('error', reject))
    digest = hash.digest('hex')
  }
  return { url, model: id, file: file ? path.basename(file) : id, sha256: digest }
}

/**
 * Прогон с вердиктами судьи. У набора quality вердикт обязан нести оценки качества и условия
 * (`validateQualityJudges`): пересборка `quality.mjs --report` идёт без проверки кода выхода, и без
 * этой проверки неполный вердикт попал бы в таблицу приёмки. То же у прогона, который строка
 * таблицы меряет полезностью (#3286): без трёх оценок среднюю считать не из чего.
 */
const loadRun = (dir, { quality = false } = {}) => {
  if (!fs.existsSync(path.join(dir, 'results.jsonl'))) return null
  const judgeFile = path.join(dir, 'judge.jsonl')
  const results = readLines(path.join(dir, 'results.jsonl'))
  const { judges, errors } = fs.existsSync(judgeFile) ? parseJudgeLines(fs.readFileSync(judgeFile, 'utf8')) : { judges: new Map(), errors: [] }
  if (quality) errors.push(...validateQualityJudges(results, judges))
  if (errors.length) throw new Error(`${path.relative(ROOT, judgeFile)}: ${errors.join('; ')}`)
  return { results, judges }
}

export function loadArtifacts(outDir, thresholds) {
  const artifacts = { contour: { base: {}, candidate: {} }, quality: { base: [], candidate: [] }, slices: null }
  for (const side of SIDES) {
    for (const name of Object.keys(thresholds.runs)) {
      const run = loadRun(path.join(outDir, side, name), { quality: scoredRuns(thresholds).has(name) })
      if (run) artifacts.contour[side][name] = run
    }
    for (let round = 1; round <= (thresholds.quality?.repeat ?? 1); round += 1) {
      const run = loadRun(path.join(outDir, side, `quality-${round}`), { quality: true })
      if (run) artifacts.quality[side].push(run)
    }
  }
  const slices = path.join(outDir, 'slices', 'results.jsonl')
  if (fs.existsSync(slices)) artifacts.slices = readLines(slices)
  return artifacts
}

/** Прогоны, которые строка таблицы меряет полезностью судьи: вердикт несёт три оценки на каждый ход. */
const scoredRuns = (thresholds) => new Set(thresholds.rows.filter((row) => row.rule?.type === 'usefulness_at_least').map((row) => row.run))

/** Какие прогоны оценивает судья: целевые вопросы целиком и первый повтор набора quality. */
const judgedRuns = (thresholds) => [...new Set(thresholds.rows.filter((row) => row.judge).map((row) => (row.kind === 'quality' ? 'quality-1' : row.run)))]

/** Слепые задания судье: метки A и B, без путей прогонов и имён моделей. */
export function writeJudgePackages(outDir, thresholds, blind) {
  const rubric = fs.readFileSync(path.join(HERE, 'JUDGE.md'), 'utf8')
  const written = []
  for (const [label, side] of Object.entries(blind)) {
    for (const name of judgedRuns(thresholds)) {
      const run = loadRun(path.join(outDir, side, name))
      if (!run) continue
      const dir = path.join(outDir, 'judge', label, name)
      fs.mkdirSync(dir, { recursive: true })
      const judgeFile = path.relative(ROOT, path.join(dir, 'judge.jsonl'))
      fs.writeFileSync(path.join(dir, 'judge-task.md'), renderJudgeTask(rubric, run.results, null, { blind: { label, judgeFile }, scores: scoredRuns(thresholds).has(name) }))
      written.push(path.relative(ROOT, path.join(dir, 'judge-task.md')))
    }
  }
  return written
}

function mergeJudge(outDir, thresholds, meta) {
  let merged = 0
  for (const [label, side] of Object.entries(meta.blind ?? {})) {
    for (const name of judgedRuns(thresholds)) {
      const source = path.join(outDir, 'judge', label, name, 'judge.jsonl')
      if (!fs.existsSync(source)) continue
      fs.copyFileSync(source, path.join(outDir, side, name, 'judge.jsonl'))
      merged += 1
    }
  }
  return merged
}

/** Проверки пересчитываются текущим кодом, отчёты прогонов пересобираются вместе с вердиктами судьи. */
function rebuildReports(outDir, thresholds) {
  for (const side of SIDES) {
    for (const [name, run] of Object.entries(thresholds.runs)) {
      const dir = path.join(outDir, side, name)
      if (fs.existsSync(path.join(dir, 'results.jsonl'))) execFileSync(process.execPath, [...TS_RUNTIME_FLAGS, path.join(HERE, 'run.mjs'), '--report', dir, '--cases', path.join(HERE, run.cases)], { cwd: ROOT, stdio: 'inherit' })
    }
    for (let round = 1; round <= (thresholds.quality?.repeat ?? 1); round += 1) {
      const dir = path.join(outDir, side, `quality-${round}`)
      // Код выхода 1 у quality — честный провал качества, а не сбой пересборки.
      if (fs.existsSync(path.join(dir, 'results.jsonl'))) spawnSync(process.execPath, [...TS_RUNTIME_FLAGS, path.join(HERE, 'quality.mjs'), '--report', dir], { cwd: ROOT, stdio: 'inherit' })
    }
  }
}

function writeTable(outDir, thresholds) {
  const meta = readJson(path.join(outDir, 'meta.json'))
  const acceptance = buildAcceptance(thresholds, loadArtifacts(outDir, thresholds))
  const text = renderAcceptance(meta, acceptance)
  fs.writeFileSync(path.join(outDir, 'acceptance.md'), text)
  console.log(`\n${text}`)
  console.log(`Таблица: ${path.relative(ROOT, path.join(outDir, 'acceptance.md'))}`)
  return acceptance
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()

async function collect(args, thresholds) {
  if (!args.baseUrl || !args.candidateUrl) throw new Error('нужны --base-url и --candidate-url: два llama-server с базой и кандидатом')
  if (args.baseUrl === args.candidateUrl) throw new Error('база и кандидат — один адрес')
  const outDir = path.resolve(ROOT, args.out ?? `.codex-temp/ai-assistant-eval/accept-${new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}`)
  if (!outDir.startsWith(path.join(ROOT, '.codex-temp') + path.sep)) throw new Error('--out — внутри .codex-temp')
  fs.mkdirSync(outDir, { recursive: true })
  const metaFile = path.join(outDir, 'meta.json')
  const inventory = buildInventory()
  const identity = { base: await identifyModel(args.baseUrl), candidate: await identifyModel(args.candidateUrl) }
  if (identity.base.sha256 && identity.base.sha256 === identity.candidate.sha256) throw new Error('база и кандидат — один и тот же файл модели')
  // Путь службы: каждая служба отдаёт событие `trace`, смотрит на модель своей стороны, индекс у обеих один.
  const viaService = args.provider === 'ask'
  let ask = null
  if (viaService) {
    if (!args.baseAskUrl || !args.candidateAskUrl) throw new Error('--provider ask: нужны --base-ask-url и --candidate-ask-url — две службы metravel-assist')
    if (args.baseAskUrl === args.candidateAskUrl) throw new Error('службы базы и кандидата — один адрес')
    ask = { base: await inspectAskService(args.baseAskUrl, args.baseUrl, fetchJson), candidate: await inspectAskService(args.candidateAskUrl, args.candidateUrl, fetchJson) }
    if (ask.base.indexBuiltAt !== ask.candidate.indexBuiltAt || ask.base.indexCount !== ask.candidate.indexCount) throw new Error(`службы базы и кандидата на разных индексах: ${ask.base.indexBuiltAt} (${ask.base.indexCount}) и ${ask.candidate.indexBuiltAt} (${ask.candidate.indexCount})`)
  } else if (Object.values(thresholds.runs).some(isAskRun)) {
    console.log('[accept] прогоны пути службы не собираются: нет --provider ask — их строки останутся «не оценено»')
  }
  let meta
  if (fs.existsSync(metaFile)) {
    // Продолжение: те же модели и те же входы, иначе в одной таблице окажутся несравнимые прогоны.
    meta = readJson(metaFile)
    for (const side of SIDES) if (meta[side].sha256 !== identity[side].sha256 || meta[side].file !== identity[side].file) throw new Error(`${side}: в папке приёмки другая модель (${meta[side].file}) — начните новую папку`)
    if (meta.inventoryHash !== sha256(JSON.stringify(inventory.files))) throw new Error('оценочные входы изменились с начала приёмки — начните новую папку')
    if (ask) {
      if (meta.ask && (meta.ask.base.indexBuiltAt !== ask.base.indexBuiltAt || meta.ask.base.indexCount !== ask.base.indexCount)) throw new Error('индекс служб изменился с начала приёмки — начните новую папку')
      meta.ask = ask
      fs.writeFileSync(metaFile, `${JSON.stringify(meta, null, 2)}\n`)
    }
  } else {
    // Метки судьи назначаются по хешам моделей: не «A — всегда база», но воспроизводимо.
    const flip = parseInt(sha256(`${identity.base.sha256}:${identity.candidate.sha256}`).slice(0, 2), 16) % 2 === 1
    meta = {
      startedAt: new Date().toISOString(), ...identity, screen: args.screen, gitSha: git('rev-parse', '--short', 'HEAD'),
      dirty: git('status', '--short', '--', 'api/aiAssist', 'components/screens/assistant', 'scripts/ai-assist', 'scripts/ai-assistant-eval', 'scripts/ai-train').split('\n').filter(Boolean),
      thresholds: path.relative(ROOT, THRESHOLDS), inventoryHash: sha256(JSON.stringify(inventory.files)),
      blind: flip ? { A: 'candidate', B: 'base' } : { A: 'base', B: 'candidate' },
      ...(ask ? { ask } : {}),
    }
    fs.writeFileSync(metaFile, `${JSON.stringify(meta, null, 2)}\n`)
  }

  const runs = SIDES.flatMap((side) => planRuns(thresholds, side, args[`${side}Url`], path.join(outDir, side), args.screen, { askUrl: viaService ? args[`${side}AskUrl`] : null })).filter((run) => !args.skip.has(run.kind))
  for (const run of runs) {
    const title = `${run.side}/${run.name}`
    if (isComplete(run)) {
      console.log(`[accept] ${title}: готово (${run.expected}), пропуск`)
      continue
    }
    fs.rmSync(run.dir, { recursive: true, force: true })
    console.log(`[accept] ${title}: ${run.expected} вопросов…`)
    // Код выхода 1 у прогона — провал проверок, это результат; сбой — неполные результаты.
    spawnSync(run.command[0], run.command.slice(1), { cwd: ROOT, stdio: 'inherit' })
    if (countResults(run.dir) !== run.expected) throw new Error(`${title}: результатов ${countResults(run.dir)} из ${run.expected} — прогон не завершён, повторите команду с тем же --out`)
  }

  if (!args.skip.has('slices')) {
    const slicesDir = path.join(outDir, 'slices')
    const expected = fs.readdirSync(EVAL_PROMPTS).filter((name) => name.endsWith('.jsonl')).reduce((sum, name) => sum + readLines(path.join(EVAL_PROMPTS, name)).length, 0)
    if (countResults(slicesDir) === expected) console.log(`[accept] срезы: готово (${expected}), пропуск`)
    else {
      const python = path.join(args.aiHome, 'venv/bin/python')
      console.log(`[accept] срезы eval.py: ${expected} подсказок × 2 модели…`)
      const done = spawnSync(python, ['-I', path.join(ROOT, 'scripts/ai-train/eval.py'), '--ai-home', args.aiHome, '--base-server', args.baseUrl, '--server', args.candidateUrl, '--adapter', 'кандидат', '--out', slicesDir], { cwd: ROOT, stdio: 'inherit' })
      if (done.status !== 0 || countResults(slicesDir) !== expected) throw new Error('срезы eval.py не завершены')
    }
  }

  const tasks = writeJudgePackages(outDir, thresholds, meta.blind)
  const acceptance = writeTable(outDir, thresholds)
  console.log(`\nЗадания судье (слепые метки):\n${tasks.map((task) => `  ${task}`).join('\n')}\nПосле судьи: npm run ai:assistant:accept -- --merge-judge ${path.relative(ROOT, outDir)}`)
  return acceptance.verdict === 'go' ? 0 : 1
}

export async function main(argv) {
  const args = parseAcceptArgs(argv)
  // Дочерние прогоны получают загрузчик TypeScript флагом `--import` (`TS_RUNTIME_FLAGS`): он есть с Node 20.6.
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (!args.freeze && !args.plan && (major < 20 || (major === 20 && minor < 6))) throw new Error(`нужен Node ≥ 20.6 (сейчас ${process.versions.node}): PATH="/opt/homebrew/opt/node@22/bin:$PATH"`)
  if (args.freeze) {
    fs.writeFileSync(INVENTORY, `${JSON.stringify(buildInventory(), null, 2)}\n`)
    console.log(`Опись оценочных входов: ${path.relative(ROOT, INVENTORY)}`)
    return 0
  }
  const thresholds = readJson(THRESHOLDS)
  const errors = validateThresholds(thresholds)
  if (errors.length) throw new Error(`acceptance.thresholds.json: ${errors.join('; ')}`)
  if (args.plan) {
    for (const side of SIDES) {
      for (const run of planRuns(thresholds, side, `<${side}-url>`, path.join('<out>', side), args.screen, { askUrl: args.provider === 'ask' ? `<${side}-ask-url>` : null })) console.log(`${side}/${run.name} (${run.expected}): ${run.command.map((part) => (part === process.execPath ? 'node' : part.startsWith(ROOT) ? path.relative(ROOT, part) : part)).join(' ')}`)
    }
    console.log(`slices: ${path.join(args.aiHome, 'venv/bin/python')} -I scripts/ai-train/eval.py --ai-home ${args.aiHome} --base-server <base-url> --server <candidate-url> --out <out>/slices`)
    const askRuns = Object.entries(thresholds.runs).filter(([, run]) => isAskRun(run)).map(([name]) => name)
    if (askRuns.length && args.provider !== 'ask') console.log(`путь службы (${askRuns.join(', ')}): в плане только с --provider ask --base-ask-url <адрес> --candidate-ask-url <адрес>`)
    return 0
  }
  if (args.mergeJudge || args.table) {
    const outDir = path.resolve(ROOT, args.mergeJudge ?? args.table)
    const meta = readJson(path.join(outDir, 'meta.json'))
    if (args.mergeJudge) console.log(`[accept] вердикты судьи перенесены в прогоны: ${mergeJudge(outDir, thresholds, meta)}`)
    rebuildReports(outDir, thresholds)
    return writeTable(outDir, thresholds).verdict === 'go' ? 0 : 1
  }
  return collect(args, thresholds)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code }, (error) => {
    console.error(error.message)
    process.exitCode = 2
  })
}
