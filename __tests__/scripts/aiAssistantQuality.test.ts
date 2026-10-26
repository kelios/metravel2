/** @jest-environment node */
// This evaluates a Node 22 CLI; jsdom's older AbortSignal lacks the native any().
import fs from 'node:fs'
import path from 'node:path'
import { evaluateAnswerExpectations, normalizeAnswer, validateAnswerExpectations } from '../../scripts/ai-assistant-eval/answer-expectations.mjs'
import { evaluateQualityCase, loadQualityCases, parseQualityArgs } from '../../scripts/ai-assistant-eval/quality.mjs'
import { buildAssistantMessages } from '@/api/aiAssist/prompt'
import { GENERATION_TIMEOUT_MS, LLAMACPP_MAX_TOKENS, LLAMACPP_PRESENCE_PENALTY, LLAMACPP_TEMPERATURE } from '@/api/aiAssist/generator'
import type { AiSource } from '@/api/aiAssist/types'
import { makeTempDir, removeDir } from './cli-test-utils'
import { parseJudgeLines, renderJudgeTask, renderReport, validateQualityJudges } from '../../scripts/ai-assistant-eval/report.mjs'

const SOURCES: AiSource[] = [
  { source_id: 'dragon', type: 'quest', title: 'Вавельский дракон', path: '/quests/krakow/krakow-dragon', url: 'https://metravel.by/quests/krakow/krakow-dragon', snippet: '9 точек. 120 минут.', score: 1 },
  { source_id: 'park', type: 'quest', title: 'Семейный парк', path: '/quests/krakow/park', url: 'https://metravel.by/quests/krakow/park', snippet: '8 точек. 90 минут.', score: 1 },
]
const criteria = (extra = {}) => ({ required: [], forbidden: [], required_source_ids: [], forbidden_source_ids: [], ...extra })
const caseItem = (extra = {}) => ({ id: 'fixed01', group: 'on_topic', lang: 'ru', locale: 'ru', turns: ['Один квест на 120 минут'], expects: ['answer'], sources: SOURCES, reference_answer: `Вавельский дракон: 120 минут. ${SOURCES[0].url}`, criteria: criteria({ required: [{ id: 'duration', any_of: ['120 минут', 'два часа'] }], required_source_ids: ['dragon'], forbidden_source_ids: ['park'], max_source_links: 1 }), ...extra })
const sse = (text: string, finishReason: string | null = 'stop') => `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finishReason }] })}\n\ndata: [DONE]\n\n`
const fakeFetch = (body: string, cloneFails = false) => jest.fn(async () => ({ ok: true, status: 200, body: null, text: async () => body, clone: () => ({ text: async () => { if (cloneFails) throw new Error('broken capture'); return body } }) }))

describe('fixed-context answer expectations', () => {
  it('allows alternative wording and normalizes Unicode, case, whitespace and ё', () => {
    expect(normalizeAnswer('  ЕЩЁ\n ДВА\tчаса  ')).toBe('еще два часа')
    expect(evaluateAnswerExpectations(criteria({ required: [{ id: 'time', dimension: 'instruction', any_of: ['120 минут', 'ДВА ЧАСА'] }] }), 'Ещё два\nчаса.', SOURCES)).toEqual([])
  })

  it('reports a missing mandatory fact in its dimension and forbidden claims', () => {
    const failures = evaluateAnswerExpectations(criteria({ required: [{ id: 'time', dimension: 'instruction', any_of: ['120 минут'] }], forbidden: ['60 минут'] }), '60 минут', SOURCES)
    expect(failures).toEqual(expect.arrayContaining([expect.objectContaining({ check: 'missing_fact', dimension: 'instruction', detail: 'time' }), expect.objectContaining({ check: 'forbidden_fact', detail: '60 минут' })]))
  })

  it('does not match numeric facts inside larger numbers, while allowing word stems', () => {
    const numeric = criteria({ required: [{ id: 'points', any_of: ['8 точ'] }, { id: 'time', any_of: ['90 мин'] }, { id: 'count', any_of: ['точек: 9'] }] })
    expect(evaluateAnswerExpectations(numeric, '18 точек, 190 минут, точек: 90', SOURCES).filter((failure: { check: string }) => failure.check === 'missing_fact')).toHaveLength(3)
    expect(evaluateAnswerExpectations(criteria({ required: [{ id: 'name', any_of: ['цмок'] }] }), 'Квест Цмока', SOURCES)).toEqual([])
    expect(evaluateAnswerExpectations(criteria({ required: [{ id: 'name', any_of: ['цмок'] }] }), 'суперцмок', SOURCES)).toEqual([expect.objectContaining({ check: 'missing_fact' })])
  })

  it('requires the exact source and rejects a wrong known source', () => {
    const failures = evaluateAnswerExpectations(criteria({ required_source_ids: ['dragon'], forbidden_source_ids: ['park'] }), SOURCES[1].url, SOURCES)
    expect(failures.map((failure: { check: string }) => failure.check)).toEqual(['missing_source_link', 'forbidden_source_link'])
    expect(evaluateAnswerExpectations(criteria({ required_source_ids: ['dragon'] }), `[Квест](${SOURCES[0].url})`, SOURCES)).toEqual([])
  })

  it('fails invented URLs and empty answers independently of the link guard', () => {
    expect(evaluateAnswerExpectations(criteria(), 'https://metravel.by/quests/invented', SOURCES)).toEqual([expect.objectContaining({ check: 'unknown_raw_url' })])
    expect(evaluateAnswerExpectations(criteria(), ' \n ', SOURCES)).toEqual([expect.objectContaining({ check: 'empty_answer' })])
  })

  it('counts distinct source URLs against the requested maximum', () => {
    expect(evaluateAnswerExpectations(criteria({ max_source_links: 1 }), `${SOURCES[0].url} ${SOURCES[0].url}`, SOURCES)).toEqual([])
    expect(evaluateAnswerExpectations(criteria({ max_source_links: 1 }), SOURCES.map((source) => source.url).join(' '), SOURCES)).toEqual([expect.objectContaining({ check: 'too_many_source_links', dimension: 'instruction' })])
  })

  it.each([
    { required: [{ id: 'fact', any_of: [] }] },
    { required: [{ id: 'fact', any_of: [' '] }] },
    { required: [{ id: 'fact', any_of: ['value'], dimension: 'unknown' }] },
    { required_source_ids: ['missing'] },
    { required_source_ids: ['dragon'], forbidden_source_ids: ['dragon'] },
    { max_source_links: 0 },
    { conditions: [] },
    { conditions: [{ id: 'date', description: '' }] },
    { conditions: [{ id: 'date', description: 'First' }, { id: 'date', description: 'Duplicate' }] },
  ])('rejects malformed expectations: %j', (extra) => {
    expect(() => validateAnswerExpectations(criteria(extra), SOURCES)).toThrow()
  })
})

describe('fixed-context runner', () => {
  it('ships ten reference answers that meet their own fact and source criteria', () => {
    const dir = path.join(process.cwd(), 'scripts/ai-assistant-eval')
    const cases = loadQualityCases(path.join(dir, 'cases.quality.jsonl'), path.join(dir, 'fixtures.quality.json'))
    expect(cases).toHaveLength(10)
    for (const item of cases) expect({ id: item.id, failures: evaluateAnswerExpectations(item.criteria, item.reference_answer, item.sources) }).toEqual({ id: item.id, failures: [] })
  })

  it('uses the application prompt, generation parameters and guard, while failing a raw unknown link', async () => {
    const item = caseItem()
    const raw = `Вавельский дракон — два часа. [Квест](${SOURCES[0].url}) https://unknown.example/place`
    const fetchImpl = fakeFetch(sse(raw))
    const result = await evaluateQualityCase(item, 'http://127.0.0.1:8080', fetchImpl)
    const turn = result.turns[0]
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:8080/v1/chat/completions')
    expect(JSON.parse(String(init.body))).toMatchObject({ messages: buildAssistantMessages({ question: item.turns[0], locale: item.locale, sources: SOURCES }), max_tokens: LLAMACPP_MAX_TOKENS, temperature: LLAMACPP_TEMPERATURE, presence_penalty: LLAMACPP_PRESENCE_PENALTY, chat_template_kwargs: { enable_thinking: false } })
    expect(turn.observed.modelCall.text).toBe(raw)
    expect(turn.observed.modelCall.finishReason).toBe('stop')
    expect(turn.observed.answerText).not.toContain('unknown.example')
    expect(turn.eval.pass).toBe(false)
    expect(turn.eval.failures).toContainEqual(expect.objectContaining({ check: 'unknown_raw_url', layer: 'model' }))
  })

  it('does not claim a pass when raw capture or terminal metadata is missing', async () => {
    for (const fetchImpl of [fakeFetch(sse('два часа'), true), fakeFetch(sse('два часа', null))]) {
      const result = await evaluateQualityCase(caseItem(), 'http://127.0.0.1:8080', fetchImpl)
      expect(result.turns[0].eval.pass).toBe(false)
      expect(result.turns[0].eval.primaryLayer).toBe('infra')
    }
  })

  it('requires mandatory facts in the displayed answer, not hidden thinking', async () => {
    const raw = `<think>120 минут</think> [Вавельский дракон](${SOURCES[0].url})`
    const result = await evaluateQualityCase(caseItem(), 'http://127.0.0.1:8080', fakeFetch(sse(raw)))
    const turn = result.turns[0]
    expect(turn.observed.modelCall.text).toContain('120 минут')
    expect(turn.observed.answerText).not.toContain('120 минут')
    expect(turn.eval.failures).toContainEqual(expect.objectContaining({ check: 'missing_fact', detail: 'duration' }))
  })

  it('bounds raw capture even after the generator has already returned', async () => {
    jest.useFakeTimers()
    try {
      const body = sse(`Вавельский дракон — 120 минут. [Квест](${SOURCES[0].url})`)
      const fetchImpl = jest.fn(async (_url, init) => ({
        ok: true, status: 200, body: null, text: async () => body,
        clone: () => ({ text: () => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('capture aborted')), { once: true })) }),
      }))
      const pending = evaluateQualityCase(caseItem(), 'http://127.0.0.1:8080', fetchImpl)
      await jest.advanceTimersByTimeAsync(GENERATION_TIMEOUT_MS)
      const result = await pending
      expect(result.turns[0].eval.primaryLayer).toBe('infra')
      expect(result.turns[0].observed.modelCall.error).toContain('raw SSE capture failed')
    } finally {
      jest.useRealTimers()
    }
  })

  it('restricts the model target to localhost and rejects missing CLI values', () => {
    expect(parseQualityArgs(['--model-url', 'http://localhost:8080']).modelUrl).toBe('http://localhost:8080')
    expect(() => parseQualityArgs(['--model-url', 'https://api.example'])).toThrow('localhost')
    expect(() => parseQualityArgs(['--model-url', 'http://localhost:8080/redirect'])).toThrow('localhost')
    expect(() => parseQualityArgs(['--only'])).toThrow('missing value')
  })

  it('rejects unknown source ids and duplicate cases before model calls', () => {
    const tempRoot = path.join(process.cwd(), '.codex-temp')
    fs.mkdirSync(tempRoot, { recursive: true })
    const dir = makeTempDir('quality-unit-', { root: tempRoot })
    const casesFile = path.join(dir, 'cases.jsonl')
    const fixturesFile = path.join(dir, 'fixtures.json')
    const item = { id: 'q', group: 'on_topic', lang: 'ru', q: 'Какой квест?', expect: 'answer', source_ids: ['missing'], reference_answer: 'Квест', criteria: criteria() }
    try {
      fs.writeFileSync(fixturesFile, JSON.stringify(SOURCES))
      fs.writeFileSync(casesFile, JSON.stringify(item) + '\n')
      expect(() => loadQualityCases(casesFile, fixturesFile)).toThrow('source_ids')
      fs.writeFileSync(casesFile, [item, item].map((testCase) => JSON.stringify(testCase)).join('\n'))
      expect(() => loadQualityCases(casesFile, fixturesFile)).toThrow('повтор')
    } finally {
      removeDir(dir)
    }
  })
})

describe('complete independent fixed-context judgments', () => {
  const results = [{ id: 'fixed01', group: 'date_time', lang: 'ru', turns: [{
    question: 'Успею ли до закрытия?', reference_answer: 'Не успеете.', expect: 'answer',
    criteria: { conditions: [{ id: 'window', description: '20 minutes remain' }, { id: 'decision', description: '45 minutes do not fit' }] },
    observed: { answerText: '20 минут недостаточно.', modelCall: { cards: [] } },
    eval: { pass: true, failures: [], metrics: {}, primaryLayer: null },
  }] }]
  const verdict = (extra = {}) => ({ key: 'fixed01#0', verdict: 'pass', instruction: 2, usefulness: 2, language: 2, condition_results: [
    { id: 'window', met: true, note: 'The answer calculates the remaining interval.' },
    { id: 'decision', met: true, note: 'The answer rejects the full visit.' },
  ], ...extra })
  const errorsFor = (judge: Record<string, any>) => validateQualityJudges(results, new Map([[judge.key, judge]]))

  it('rejects missing scores, absent/duplicate/unknown conditions and unsupported pass', () => {
    expect(errorsFor(verdict())).toEqual([])
    for (const extra of [
      { instruction: undefined },
      { condition_results: undefined },
      { condition_results: [{ id: 'window', met: true, note: 'Only one.' }] },
      { condition_results: [{ id: 'window', met: true, note: 'First.' }, { id: 'window', met: true, note: 'Duplicate.' }] },
      { condition_results: [{ id: 'window', met: true, note: 'First.' }, { id: 'wrong', met: true, note: 'Unknown.' }] },
      { condition_results: [{ id: 'window', met: true, note: 'First.' }, { id: 'decision', met: false, note: 'Contradiction.' }] },
      { key: 'not-collected#0' },
    ]) expect(errorsFor(verdict(extra)).length).toBeGreaterThan(0)
    expect(parseJudgeLines([verdict(), verdict()].map((item) => JSON.stringify(item)).join('\n')).errors).toHaveLength(1)
  })

  it('distinguishes preliminary automatic results and renders each judged condition', () => {
    const meta = { mode: 'fixed_context', startedAt: 't', modelUrl: 'http://localhost:8090' }
    const preliminary = renderReport(meta, results)
    expect(preliminary).toContain('Предварительный итог (судья не завершён)')
    expect(preliminary).not.toContain('Строгий итог')
    const judged = renderReport(meta, results, new Map([['fixed01#0', verdict()]]))
    expect(judged).toContain('Строгий итог')
    expect(judged).toContain('Выполнено 2/2; оценено 2/2')
    expect(judged).toContain('decision: 45 minutes do not fit')
    expect(renderJudgeTask('Rubric', results, 'out')).toContain('condition_results')
  })
})
