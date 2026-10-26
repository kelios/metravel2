#!/usr/bin/env node
/** Fixed-context model evaluation. Requires Node 22 with --experimental-strip-types. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAssistantMessages } from '../../api/aiAssist/prompt.ts'
import { GENERATION_TIMEOUT_MS, LlamaCppGenerator } from '../../api/aiAssist/generator.ts'
import { enforceSourceLinks } from '../../api/aiAssist/linkGuard.ts'
import { evaluateTurn, findUrls, normalizeUrl, parseCards, parseSse, primaryLayer } from './checks.mjs'
import { evaluateAnswerExpectations, validateAnswerExpectations } from './answer-expectations.mjs'
import { loadCases } from './run.mjs'
import { parseJudgeLines, renderJudgeTask, renderReport, summarize, validateQualityJudges } from './report.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const readLines = (file) => fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line))

export function parseQualityArgs(argv) {
  const args = { modelUrl: 'http://127.0.0.1:8080', cases: path.join(HERE, 'cases.quality.jsonl'), fixtures: path.join(HERE, 'fixtures.quality.json') }
  const keys = { '--model-url': 'modelUrl', '--cases': 'cases', '--fixtures': 'fixtures', '--out': 'out', '--report': 'report', '--only': 'only' }
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=', 2)
    if (!keys[flag]) throw new Error(`unknown flag ${flag}`)
    const value = inline ?? argv[++i]
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`)
    args[keys[flag]] = value
  }
  const url = new URL(args.modelUrl)
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('--model-url must be a localhost HTTP origin')
  }
  args.modelUrl = url.origin
  return args
}

export function loadQualityCases(casesFile, fixturesFile) {
  const fixtures = readJson(fixturesFile)
  if (!Array.isArray(fixtures)) throw new Error('fixtures must be an array')
  const sourcesById = new Map()
  for (const source of fixtures) {
    if (!source || !['travel', 'quest'].includes(source.type) || typeof source.source_id !== 'string' || !source.source_id.trim() || sourcesById.has(source.source_id)) throw new Error('fixtures need unique source_id and travel/quest type')
    if (['title', 'url', 'path', 'snippet'].some((key) => typeof source[key] !== 'string') || !source.title.trim() || !source.path.startsWith('/') || !Number.isFinite(source.score)) throw new Error(`invalid fixture ${source.source_id}`)
    const url = new URL(source.url)
    if (url.protocol !== 'https:' || url.hostname !== 'metravel.by' || url.username || url.password || url.pathname !== source.path) throw new Error(`invalid fixture URL ${source.source_id}`)
    sourcesById.set(source.source_id, source)
  }
  const cases = loadCases(casesFile)
  if (!cases.length) throw new Error('quality cases must not be empty')
  return cases.map((item) => {
    if (item.turns.length !== 1 || !['ru', 'be', 'uk', 'pl', 'en'].includes(item.lang) || !['answer', 'no_material', 'any_on_topic', 'refuse'].includes(item.expects[0])) throw new Error(`${item.id}: single-turn model expectation required`)
    if (!Array.isArray(item.source_ids) || new Set(item.source_ids).size !== item.source_ids.length || item.source_ids.some((id) => !sourcesById.has(id))) throw new Error(`${item.id}: source_ids must contain unique known ids`)
    if (typeof item.reference_answer !== 'string' || !item.reference_answer.trim()) throw new Error(`${item.id}: reference_answer required`)
    if (item.history !== undefined && (!Array.isArray(item.history) || item.history.some((turn) => !turn || !['user', 'assistant'].includes(turn.role) || typeof turn.text !== 'string' || !turn.text.trim()))) throw new Error(`${item.id}: invalid history`)
    const sources = item.source_ids.map((id) => sourcesById.get(id))
    validateAnswerExpectations(item.criteria, sources)
    return { ...item, sources }
  })
}

export function scoreQualityTurn(turn) {
  const evaluation = evaluateTurn({ expect: turn.expect, lang: turn.lang }, turn.observed)
  if (turn.observed.modelCall && !turn.observed.modelCall.error) {
    evaluation.failures.push(...evaluateAnswerExpectations(turn.criteria, turn.observed.answerText, turn.sources, turn.observed.modelCall.text))
  }
  evaluation.pass = evaluation.failures.length === 0
  evaluation.primaryLayer = primaryLayer(evaluation.failures)
  return evaluation
}

/** Uses the production generator and captures its unguarded SSE independently. */
export async function evaluateQualityCase(item, modelUrl, fetchImpl = fetch) {
  const messages = buildAssistantMessages({ question: item.turns[0], locale: item.locale, sources: item.sources, history: item.history })
  const startedAt = Date.now()
  let capture = null
  const requestController = new AbortController()
  // The generator can finish early on a loop; its timeout then no longer bounds the cloned stream.
  const requestTimeout = setTimeout(() => requestController.abort(), GENERATION_TIMEOUT_MS)
  const generator = new LlamaCppGenerator(modelUrl, { fetchImpl: async (url, init) => {
    const signal = init?.signal ? AbortSignal.any([init.signal, requestController.signal]) : requestController.signal
    const response = await fetchImpl(url, { ...init, signal })
    capture = response.clone().text().then((body) => ({ body }), (error) => ({ error: String(error) }))
    return response
  } })
  const turn = { question: item.turns[0], expect: item.expects[0], lang: item.lang, history: item.history ?? [], sources: item.sources, criteria: item.criteria, reference_answer: item.reference_answer, observed: null }
  try {
    const generated = await generator.generate({ messages })
    const captured = capture ? await capture : null
    if (!captured || captured.error) throw new Error(`raw SSE capture failed: ${captured?.error ?? 'no response'}`)
    const parsed = parseSse(captured.body)
    if (!parsed.finishReason) throw new Error('raw SSE capture has no terminal finish reason')
    const guarded = enforceSourceLinks(generated.text, item.sources)
    const allowed = new Set(item.sources.map((source) => normalizeUrl(source.url)))
    turn.observed = {
      turnCreated: true, status: 'done', answerText: guarded.text,
      linkLabels: findUrls(guarded.text).filter((url) => allowed.has(normalizeUrl(url))),
      sources: item.sources.map((source) => ({ type: source.type, id: source.source_id, title: source.title })),
      modelCall: { ...parsed, prompt: messages, cards: parseCards(messages.at(-1).content), ms: Date.now() - startedAt },
      generatorText: generated.text, usage: generated.usage, removedLinks: guarded.removed,
    }
  } catch (error) {
    turn.observed = { turnCreated: true, status: 'error', answerText: '', sources: [], linkLabels: [], modelCall: { text: '', cards: [], ms: Date.now() - startedAt, error: String(error) } }
  } finally {
    clearTimeout(requestTimeout)
    requestController.abort()
  }
  turn.eval = scoreQualityTurn(turn)
  return { id: item.id, group: item.group, lang: item.lang, category: item.category, track: item.track, turns: [turn] }
}

function writeReports(out, meta, results) {
  const judgeFile = path.join(out, 'judge.jsonl')
  const { judges, errors } = fs.existsSync(judgeFile) ? parseJudgeLines(fs.readFileSync(judgeFile, 'utf8')) : { judges: new Map(), errors: [] }
  errors.push(...validateQualityJudges(results, judges))
  if (errors.length) throw new Error(`invalid judge.jsonl: ${errors.join('; ')}`)
  fs.writeFileSync(path.join(out, 'report.md'), renderReport(meta, results, judges))
  fs.writeFileSync(path.join(out, 'judge-task.md'), renderJudgeTask(fs.readFileSync(path.join(HERE, 'JUDGE.md'), 'utf8'), results, path.relative(ROOT, out)))
  return summarize(results, judges)
}

export async function runQuality(args) {
  if (args.report) {
    const out = path.resolve(args.report)
    const meta = readJson(path.join(out, 'meta.json'))
    if (meta.mode !== 'fixed_context') throw new Error('not a fixed-context report')
    const results = readLines(path.join(out, 'results.jsonl'))
    for (const result of results) for (const turn of result.turns) turn.eval = scoreQualityTurn(turn)
    fs.writeFileSync(path.join(out, 'results.jsonl'), results.map((result) => JSON.stringify(result)).join('\n') + '\n')
    const summary = writeReports(out, meta, results)
    console.log(`${summary.passed}/${summary.turns}; ${path.join(out, 'report.md')}`)
    return summary.passed === summary.turns ? 0 : 1
  }
  let cases = loadQualityCases(args.cases, args.fixtures)
  if (args.only) {
    const only = new Set(args.only.split(','))
    if ([...only].some((id) => !cases.some((item) => item.id === id))) throw new Error('--only contains unknown case ids')
    cases = cases.filter((item) => only.has(item.id))
  }
  const out = path.resolve(args.out ?? path.join(ROOT, '.codex-temp/ai-assistant-eval', `quality-${new Date().toISOString().replace(/[:.]/g, '-')}`))
  if (!out.startsWith(path.join(ROOT, '.codex-temp') + path.sep)) throw new Error('--out must be inside .codex-temp')
  if (fs.existsSync(out) && fs.readdirSync(out).length) throw new Error('output directory must be empty')
  const response = await fetch(`${args.modelUrl}/v1/models`, { signal: AbortSignal.timeout(10_000), redirect: 'error' })
  if (!response.ok) throw new Error(`model discovery returned ${response.status}`)
  const models = await response.json()
  const startedAt = new Date().toISOString()
  const meta = {
    mode: 'fixed_context', startedAt, model: models.data?.[0]?.id ?? models.models?.[0]?.name ?? 'unknown', modelUrl: args.modelUrl,
    tree: '.', gitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
    cases: path.resolve(args.cases), fixtures: path.resolve(args.fixtures),
    inputHash: createHash('sha256').update(fs.readFileSync(args.cases)).update(fs.readFileSync(args.fixtures)).digest('hex'),
  }
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2))
  const results = []
  for (const item of cases) {
    const result = await evaluateQualityCase(item, args.modelUrl, (url, init) => fetch(url, { ...init, redirect: 'error' }))
    results.push(result)
    fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify(result) + '\n')
    console.log(`${item.id}: ${result.turns[0].eval.pass ? 'PASS' : 'FAIL'}`)
  }
  meta.durationSec = Math.round((Date.now() - Date.parse(startedAt)) / 1000)
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2))
  const summary = writeReports(out, meta, results)
  console.log(`${summary.passed}/${summary.turns}; ${path.join(out, 'report.md')}`)
  return summary.passed === summary.turns ? 0 : 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => runQuality(parseQualityArgs(process.argv.slice(2)))).then((code) => { process.exitCode = code }, (error) => { console.error(error.message); process.exitCode = 1 })
}
