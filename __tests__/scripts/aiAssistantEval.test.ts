import fs from 'node:fs'
import path from 'node:path'

import {
  MAX_ANSWER_CHARS,
  countRecommendations,
  detectLang,
  detectLoop,
  evaluateTurn,
  hasTemplate,
  isNoMaterial,
  isOfftopicRefusal,
  parseCards,
  parseSse,
  primaryLayer,
} from '../../scripts/ai-assistant-eval/checks.mjs'
import { parseJudgeLines, renderJudgeTask, renderReport, summarize } from '../../scripts/ai-assistant-eval/report.mjs'
import { loadCases } from '../../scripts/ai-assistant-eval/run.mjs'
import { formatSourcesBlock } from '@/api/aiAssist/prompt'
import type { AiSource } from '@/api/aiAssist/types'

describe('fixed-context quality report', () => {
  const results = [{ id: 'q01', group: 'on_topic', lang: 'ru', turns: [{
    question: 'Один семейный квест', expect: 'answer', reference_answer: 'Прокоцим, 90 минут',
    criteria: { required: [] }, history: [{ role: 'user', text: 'Только в Кракове' }],
    observed: { answerText: 'Прокоцим, полтора часа', modelCall: { cards: [] } },
    eval: { pass: true, failures: [], warnings: [], metrics: {}, primaryLayer: null },
  }] }]

  it('keeps semantic coverage pending until all three scores exist and never claims UI coverage', () => {
    const meta = { mode: 'fixed_context', startedAt: 't', modelUrl: 'http://localhost:8080' }
    const pending = renderReport(meta, results)
    expect(pending).toContain('Смысловая оценка не завершена')
    expect(pending).not.toContain('undefined/assistant')
    expect(pending).toContain('Прокоцим, 90 минут')
    const judges = new Map([['q01#0', { verdict: 'pass', instruction: 2, usefulness: 2, language: 1 }]])
    const complete = renderReport(meta, results, judges)
    expect(complete).not.toContain('Смысловая оценка не завершена')
    expect(complete).toContain('| 1 | Следование запросу | 2 / 2 | 1/1 |')
    expect(complete).toContain('| 3 | Язык и естественность | 1 / 2 | 1/1 |')
    const task = renderJudgeTask('# Судья', results, 'out')
    expect(task).toContain('Только в Кракове')
    expect(task).toContain('instruction=2, usefulness=2')
  })

  it('separates a false automatic failure from the independent semantic pass', () => {
    const automaticFailure = results.map((result) => ({ ...result, turns: result.turns.map((turn) => ({ ...turn,
      eval: { ...turn.eval, pass: false, failures: [{ check: 'no_admission', layer: 'model', detail: 'paraphrase' }], primaryLayer: 'model' },
    })) }))
    const judges = new Map([['q01#0', { verdict: 'pass', instruction: 2, usefulness: 2, language: 2 }]])
    const report = renderReport({ mode: 'fixed_context' }, automaticFailure, judges)
    expect(report).toContain('Автопроверки: 0/1; независимая смысловая оценка: 1/1')
    expect(report).toContain('ложных автопровалов 1, ложных автопрохождений 0')
    expect(report).toContain('Строгий итог (автопроверки и судья): 0/1')
  })

  it('reveals automatic false positives without changing the semantic verdict', () => {
    const judges = new Map([['q01#0', { verdict: 'fail', layer: 'model', instruction: 1, usefulness: 2, language: 2 }]])
    const report = renderReport({ mode: 'fixed_context' }, results, judges)
    expect(report).toContain('Автопроверки: 1/1; независимая смысловая оценка: 0/1')
    expect(report).toContain('ложных автопровалов 0, ложных автопрохождений 1')
    expect(report).toContain('Строгий итог (автопроверки и судья): 0/1')
  })

  it.each([
    { instruction: 0, usefulness: 2, language: 2 },
    { instruction: 2, usefulness: 1, language: 2 },
    { instruction: 2, usefulness: 2, language: 0 },
    { instruction: 2 },
    { instruction: 3, usefulness: 2, language: 2 },
  ])('rejects a semantic pass that contradicts its scores: %j', (scores) => {
    const parsed = parseJudgeLines(JSON.stringify({ key: 'q01#0', verdict: 'pass', ...scores }))
    expect(parsed.errors).toHaveLength(1)
    expect(parsed.judges.size).toBe(0)
  })
})

// #2710: контур оценки ассистента — проверки и отчёт без браузера.

const SOURCES: AiSource[] = [
  { type: 'travel', source_id: '568', title: 'Краков: путеводитель по местам', url: 'https://metravel.by/travels/krakow-guide', path: '/travels/krakow-guide', snippet: 'Вавель, Рынок, Казимеж.', score: 3 },
  { type: 'quest', source_id: 'krakow-dragon', title: 'Квест по Кракову: Вавельский дракон', url: 'https://metravel.by/quests/krakow/krakow-dragon', path: '/quests/krakow/krakow-dragon', snippet: '', score: 2 },
]
const USER_MESSAGE = `Материалы сайта:\n${formatSourcesBlock(SOURCES)}\n\nВопрос посетителя: что посмотреть в Кракове`
const CARDS = parseCards(USER_MESSAGE)

const observedDone = (raw: string, answerText: string, extra: Record<string, unknown> = {}) => ({
  turnCreated: true,
  status: 'done',
  answerText,
  linkLabels: ['путеводитель'],
  sources: SOURCES.map((s) => ({ type: s.type, id: s.source_id, title: s.title })),
  modelCall: { text: raw, cards: CARDS, finishReason: 'stop', ms: 900 },
  ...extra,
})

describe('ai-assistant-eval checks', () => {
  it.each([
    'Отдельного материала про Гданьск на сайте пока нет. В Кракове есть квесты.',
    'Статьи про Гданьск пока нет.',
    'Квестов по Гданьску у нас нет.',
    'Материал про Вильнюс пока не найден.',
    'Нет материалов про Гданьск.',
  ])('recognizes a missing material regardless of subject order: %s', (answer) => {
    expect(isNoMaterial(answer)).toBe(true)
  })

  it.each([
    'Материал про Гданьск есть, но цены нет.',
    'Материал про Гданьск есть но цены нет.',
    'Материал опубликован. Цены пока нет.',
    'Квест по Гданьску найден. Билетов нет.',
    'Квест по Гданьску есть. Нет свободного времени.',
  ])('does not confuse another missing fact with a missing material: %s', (answer) => {
    expect(isNoMaterial(answer)).toBe(false)
  })

  it('still requires a real admission for no_material and accepts a valid reverse-order paraphrase', () => {
    const accepted = 'Отдельного материала про Гданьск на сайте пока нет.'
    expect(evaluateTurn({ expect: 'no_material', lang: 'ru' }, observedDone(accepted, accepted, { linkLabels: [] })).pass).toBe(true)
    const affirmative = 'Материал про Гданьск есть, но цены нет.'
    expect(evaluateTurn({ expect: 'no_material', lang: 'ru' }, observedDone(affirmative, affirmative)).failures).toContainEqual(expect.objectContaining({ check: 'no_admission' }))
  })
  it('keeps the answer limit in step with prompt.ts (assistant_prompt.json)', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts/ai-train/assistant_prompt.json'), 'utf8'))
    expect(MAX_ANSWER_CHARS).toBe(fixture.max_answer_chars)
  })

  it('reads cards in the exact prompt.ts format', () => {
    expect(CARDS).toEqual([
      { n: 1, type: 'travel', title: 'Краков: путеводитель по местам', url: 'https://metravel.by/travels/krakow-guide', snippet: 'Вавель, Рынок, Казимеж.' },
      { n: 2, type: 'quest', title: 'Квест по Кракову: Вавельский дракон', url: 'https://metravel.by/quests/krakow/krakow-dragon', snippet: '' },
    ])
  })

  it('assembles SSE deltas, finish reason and usage', () => {
    const body = [
      'data: {"choices":[{"delta":{"content":"При"}}]}',
      'data: {"choices":[{"delta":{"content":"вет"},"finish_reason":"length"}]}',
      'data: {"choices":[],"usage":{"completion_tokens":2}}',
      'data: [DONE]',
    ].join('\n\n')
    expect(parseSse(body)).toEqual({ text: 'Привет', finishReason: 'length', usage: { completion_tokens: 2 } })
  })

  it('finds a looping item and the site-card template, but not a normal list', () => {
    expect(detectLoop('Точки: Ratusz; Ratusz; Ratusz; Ratusz')).toBe('ratusz')
    expect(detectLoop('- Вавель\n- Рынок\n- Казимеж')).toBeNull()
    expect(hasTemplate('Краков\n**Страна:** Польша\nКогда: весна')).toBe('Страна')
    expect(hasTemplate('Посмотрите Вавель — когда будете в Кракове.')).toBeNull()
  })

  it('counts card links, bullets and names without links', () => {
    const raw = '- [Путеводитель](https://metravel.by/travels/krakow-guide)\n- Вавель\n- Казимеж\n- https://example.com/x'
    expect(countRecommendations(raw, CARDS)).toEqual({ cardLinks: 1, bullets: 4, bulletsWithoutLink: 3, unknownUrls: ['https://example.com/x'] })
  })

  it('detects answer language like eval.py', () => {
    expect(detectLang('Посмотрите путеводитель по Кракову')).toBe('ru')
    expect(detectLang('Паглядзіце даведнік па Кракаве і квэст')).toBe('be')
    expect(detectLang('Подивіться путівник по Кракову і квест')).toBe('uk')
    expect(detectLang('Zobacz przewodnik po Krakowie i quest')).toBe('pl')
    expect(detectLang('See the guide to Krakow and the quest')).toBe('en')
  })

  it('recognises the off-topic refusal in several languages', () => {
    expect(isOfftopicRefusal('Я ассистент metravel.by по путешествиям — на другие темы не отвечаю.')).toBe(true)
    expect(isOfftopicRefusal('Jestem asystentem metravel.by i nie odpowiadam na inne tematy.')).toBe(true)
    expect(isOfftopicRefusal('Посмотрите путеводитель по Кракову.')).toBe(false)
  })

  it('passes a short answer with card links', () => {
    const raw = 'Начните с [путеводителя](https://metravel.by/travels/krakow-guide), а вечером — [квест](https://metravel.by/quests/krakow/krakow-dragon).'
    const result = evaluateTurn({ expect: 'answer', lang: 'ru', expectSources: { pattern: 'краков', min: 2 } }, observedDone(raw, 'Начните с путеводителя, а вечером — квест.'))
    expect(result.failures).toEqual([])
    expect(result.pass).toBe(true)
  })

  it('blames retrieval before the model when the cards are off', () => {
    const raw = 'Страна: Польша\nRatusz; Ratusz; Ratusz'
    const result = evaluateTurn(
      { expect: 'answer', lang: 'ru', expectSources: { pattern: 'гданьск', min: 1 } },
      observedDone(raw, 'Страна: Польша Ratusz', { linkLabels: [] }),
    )
    expect(result.failures.map((f: { check: string }) => f.check)).toEqual(['irrelevant_sources', 'loop', 'template', 'no_links'])
    expect(primaryLayer(result.failures)).toBe('retrieval')
  })

  it('flags an off-topic question that got an answer, and an on-topic one that got refused', () => {
    const answered = evaluateTurn({ expect: 'refuse', lang: 'ru' }, observedDone('Кашу варят 20 минут.', 'Кашу варят 20 минут.', { linkLabels: [] }))
    expect(answered.failures.map((f: { check: string }) => f.check)).toEqual(['not_refused', 'model_not_refused'])
    expect(primaryLayer(answered.failures)).toBe('gate')

    const refused = evaluateTurn({ expect: 'any_on_topic', lang: 'ru' }, { turnCreated: true, status: 'off_topic', answerText: '', sources: [] })
    expect(refused.failures.map((f: { check: string }) => f.check)).toEqual(['false_offtopic'])
  })

  it('checks escalation: refusal with a block, then no new turn', () => {
    const third = evaluateTurn({ expect: 'refuse_block', lang: 'ru' }, { turnCreated: true, status: 'off_topic', answerText: '', sources: [], blockedAfter: false })
    expect(third.failures.map((f: { check: string }) => f.check)).toEqual(['not_blocked'])
    expect(evaluateTurn({ expect: 'blocked', lang: 'ru' }, { turnCreated: false }).pass).toBe(true)
    expect(evaluateTurn({ expect: 'blocked', lang: 'ru' }, { turnCreated: true, status: 'done' }).pass).toBe(false)
  })

  it('reports a non-card address left in the shown text as a guard leak', () => {
    const result = evaluateTurn({ expect: 'answer', lang: 'ru' }, observedDone('См. [путеводитель](https://metravel.by/travels/krakow-guide)', 'См. путеводитель и google.com https://google.com'))
    expect(result.failures.map((f: { check: string }) => f.check)).toEqual(['url_leak'])
  })
})

describe('ai-assistant-eval report and cases', () => {
  const results = [
    {
      id: 'on01',
      group: 'on_topic',
      lang: 'ru',
      turns: [
        { question: 'что посмотреть в Кракове', expect: 'answer', observed: observedDone('x', 'Ответ'), eval: { pass: true, failures: [], warnings: [], metrics: { sources: 2, links: 1 }, primaryLayer: null } },
      ],
    },
    {
      id: 'of01',
      group: 'off_topic',
      lang: 'ru',
      turns: [
        {
          question: 'как готовить кашу',
          expect: 'refuse',
          observed: { turnCreated: true, status: 'no_sources', answerText: '', notice: 'На сайте пока нет материалов', sources: [] },
          eval: { pass: false, failures: [{ check: 'not_refused', layer: 'gate', detail: 'x' }], warnings: [], metrics: { sources: 0, links: 0 }, primaryLayer: 'gate' },
        },
      ],
    },
  ]

  it('summarises by group and layer, and lets the judge fail an auto-passed turn', () => {
    const plain = summarize(results)
    expect(plain.passed).toBe(1)
    expect(plain.byLayer.gate).toBe(1)
    const { judges, errors } = parseJudgeLines('{"key":"on01#0","verdict":"fail","layer":"model","note":"не тот город"}\nbroken')
    expect(errors).toHaveLength(1)
    const judged = summarize(results, judges)
    expect(judged.passed).toBe(0)
    expect(judged.byLayer.model).toBe(1)
    const report = renderReport({ startedAt: 't', baseUrl: 'http://localhost:8081', modelUrl: 'http://127.0.0.1:8080' }, results, judges)
    expect(report).toContain('**Итог: 0/2 ходов (0 %).**')
    expect(report).toContain('судья: не тот город')
    expect(renderJudgeTask('# Судья', results, 'out')).toContain('### of01#0')
  })

  it('ships a valid case set covering every group and all five languages', () => {
    const cases = loadCases(path.join(process.cwd(), 'scripts/ai-assistant-eval/cases.jsonl'))
    const groups = new Set(cases.map((item: { group: string }) => item.group))
    expect([...groups].sort()).toEqual(['borderline', 'escalation', 'injection', 'languages', 'multi_turn', 'off_topic', 'on_topic'])
    expect(new Set(cases.map((item: { lang: string }) => item.lang))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']))
    for (const item of cases) {
      if (item.expect_sources) expect(() => new RegExp(item.expect_sources.pattern, 'iu')).not.toThrow()
    }
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/ai-assistant-eval/JUDGE.md'))).toBe(true)
  })
})
