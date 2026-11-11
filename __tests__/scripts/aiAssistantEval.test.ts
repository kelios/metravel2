import fs from 'node:fs'
import path from 'node:path'

import {
  MAX_ANSWER_CHARS,
  countRecommendations,
  countShownRecommendations,
  detectLang,
  detectLoop,
  evaluateTurn,
  leaksPrompt,
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

describe('проверки хода: режим страницы и утечка разметки', () => {
  const pageCards = [{ n: 1, type: 'travel', title: SOURCES[0].title, url: SOURCES[0].url, snippet: 'Польша, Краков. Дней: 3', group: 'page' }]
  const observedPage = (answerText: string, cards: unknown[]) => ({
    turnCreated: true,
    status: 'done',
    answerText,
    linkLabels: [],
    sources: [{ type: 'travel', id: SOURCES[0].source_id, title: SOURCES[0].title }],
    modelCall: { text: answerText, cards, finishReason: 'stop', ms: 900 },
  })

  it('ответ по странице без ссылки на неё — не провал, а предупреждение; в общем режиме no_links остаётся провалом', () => {
    const answer = 'В карточке указано, что поездка занимает 3 дня.'
    const page = evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Сколько дней занимает поездка?' }, observedPage(answer, pageCards))
    expect(page.failures).toEqual([])
    expect(page.warnings).toEqual([{ check: 'no_links', layer: 'model', detail: 'ответ по странице без ссылки на неё' }])
    // Та же карточка без группы `page` — общий подбор: ссылка обязательна.
    const general = evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Сколько дней занимает поездка?' }, observedPage(answer, [{ ...pageCards[0], group: undefined }]))
    expect(general.failures.map((failure: { check: string }) => failure.check)).toContain('no_links')
  })

  it('prompt_leak — общий со стражем детектор: переведённый заголовок блока карточек и номер карточки в скобках', () => {
    for (const leaked of ['Матеріали сайту:\n[1] Отдых в Доминикане', 'The most relevant card is [2].', 'Материалы сайта: ничего не найдено.', 'Вопрос посетителя: что посмотреть?']) {
      expect({ leaked, found: leaksPrompt(leaked) }).toEqual({ leaked, found: true })
    }
    expect(leaksPrompt('Загляните в путеводитель по Кракову.')).toBe(false)
    const result = evaluateTurn({ expect: 'any_on_topic', lang: 'en', question: 'Is there a hike near Krakow?' }, observedPage('The site lists several hikes near Krakow. The most relevant card is [2].', CARDS))
    expect(result.failures.filter((failure: { check: string }) => failure.check === 'prompt_leak')).toEqual([{ check: 'prompt_leak', layer: 'prompt', detail: expect.any(String) }])
  })
})

describe('разбор карточек подсказки (#3289)', () => {
  it('строки «Почему подходит» и «материала о месте нет» фрагментом карточки не считаются', () => {
    const withWhy = [{ ...SOURCES[0], why: 'месяц: май, 1 день' }, SOURCES[1]]
    const message = `Материалы сайта:\n${formatSourcesBlock(withWhy)}\n\nО месте из вопроса на сайте материала нет: карточки выше — ближайшее из того, что есть.\n\nВопрос посетителя: что посмотреть в Кракове`
    const cards = parseCards(message)
    expect(cards.map((card: { snippet: string }) => card.snippet)).toEqual(CARDS.map((card: { snippet: string }) => card.snippet))
    expect(cards.map((card: { why?: string }) => card.why)).toEqual(['месяц: май, 1 день', undefined])
  })
})

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
    // #3267: учебные ответы на других языках строятся в обратном порядке.
    'Асобнага матэрыялу пра Гданьск на сайце пакуль няма. З таго, што знайшлося, можна паглядзець квэст.',
    'Окремого матеріалу про Гданськ на сайті поки немає. З того, що знайшлося, можна подивитися квест.',
    'Osobnego materiału o Gdańsku w serwisie jeszcze nie ma. Z tego, co się znalazło, zobacz quest.',
    'The site has no separate article about Gdansk yet. From what was found, see the quest.',
  ])('recognizes a missing material regardless of subject order: %s', (answer) => {
    expect(isNoMaterial(answer)).toBe(true)
  })

  it.each([
    'Материал про Гданьск есть, но цены нет.',
    'Материал про Гданьск есть но цены нет.',
    'Материал опубликован. Цены пока нет.',
    'Квест по Гданьску найден. Билетов нет.',
    'Квест по Гданьску есть. Нет свободного времени.',
    'Матэрыял пра Гданьск ёсць, але кошту няма.',
    'Materiał o Gdańsku jest, ale ceny nie ma.',
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
    // #2751 (UK ln03, 09.11.2026): три разных квеста одной длительности — общий факт, а не цикл.
    const quest = (title: string, points: number) => `- [${title}](https://metravel.by/quests/krakow/${points}) — міський квест: точок — ${points}, близько 120 хв`
    expect(detectLoop(['Ось головне у Кракові:', quest('Казімеж', 9), quest('Наказ № 1', 8), quest('Вавельський дракон', 10)].join('\n'))).toBeNull()
    // Круг из нескольких пунктов и один пункт подряд остаются циклом.
    expect(detectLoop('Вавель дракон, Казимеж квартал, Тынец аббатство, Вавель дракон, Казимеж квартал, Тынец аббатство, Вавель дракон')).toBe('вавель дракон')
    // Ответ, обрезанный лимитом токенов посреди следующего пункта круга, — тоже цикл.
    expect(detectLoop('Вавель дракон, Казимеж квартал, Тынец аббатство, Вавель дракон, Казимеж квартал, Тынец аббатство, Вавель дракон, Казимеж кв')).toBe('вавель дракон')
    expect(detectLoop('гарадской квэст па Лошыцкім парку — https://metravel.by/a, гарадской квэст па Лошыцкім парку — https://metravel.by/a, гарадской квэст па Лошыцкім парку — https://metravel.by/a')).toContain('лошыцкім парку')
    expect(hasTemplate('Краков\n**Страна:** Польша\nКогда: весна')).toBe('Страна')
    expect(hasTemplate('Посмотрите Вавель — когда будете в Кракове.')).toBeNull()
  })

  it('counts card links, bullets and names without links', () => {
    const raw = '- [Путеводитель](https://metravel.by/travels/krakow-guide)\n- Вавель\n- Казимеж\n- https://example.com/x'
    expect(countRecommendations(raw, CARDS)).toEqual({ cardLinks: 1, bullets: 4, bulletsWithoutLink: 3, unknownUrls: ['https://example.com/x'] })
  })

  // #3216: генератор закрывает стрим на четвёртой рекомендации — сырой ответ и показанный считаются отдельно.
  it('counts shown recommendations apart from the raw model answer', () => {
    expect(countShownRecommendations('Квесты:\n• Первый квест\n• Второй квест\n• Третий квест', ['Первый квест', 'Второй квест', 'Третий квест'])).toBe(3)
    expect(countShownRecommendations('Посмотрите путеводитель и квест.', ['путеводитель', 'квест', 'квест'])).toBe(2)
    const link = (slug: string) => `- [${slug}](https://metravel.by/quests/krakow/${slug})`
    const raw = ['krakow-dragon', 'krakow-kazimierz', 'krakow-bike', 'krakow-nowa-huta'].map(link).join('\n')
    const cards = [...CARDS, { type: 'quest', title: 'Казимеж', url: 'https://metravel.by/quests/krakow/krakow-kazimierz' }, { type: 'quest', title: 'Вело', url: 'https://metravel.by/quests/krakow/krakow-bike' }, { type: 'quest', title: 'Нова-Хута', url: 'https://metravel.by/quests/krakow/krakow-nowa-huta' }]
    const turn = { expect: 'answer', lang: 'ru' }
    const capped = evaluateTurn(turn, { ...observedDone(raw, '• Дракон\n• Казимеж\n• Вело', { linkLabels: ['Дракон', 'Казимеж', 'Вело'] }), modelCall: { text: raw, cards, finishReason: 'stop', ms: 1 } })
    expect(capped.failures.map((f: { check: string }) => f.check)).toEqual(['too_many'])
    expect(capped.metrics.shownRecommendations).toBe(3)
    const leaked = evaluateTurn(turn, { ...observedDone(raw, '• Дракон\n• Казимеж\n• Вело\n• Нова-Хута', { linkLabels: ['Дракон', 'Казимеж', 'Вело', 'Нова-Хута'] }), modelCall: { text: raw, cards, finishReason: 'stop', ms: 1 } })
    expect(leaked.failures.map((f: { check: string; layer: string }) => `${f.check}:${f.layer}`)).toEqual(['too_many:model', 'too_many_shown:guard'])
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

  it('judges the answer language by its own words, not by an untranslated card title (#3267)', () => {
    const title = 'Детский квест по Минску: бронзовые друзья города'
    const raw = `Дітям підійде [${title}](https://metravel.by/travels/krakow-guide) — це 45 хвилин.`
    const shown = `Дітям підійде ${title} — це 45 хвилин.`
    // Собственных слов меньше 40 знаков — язык не оценивается; раньше длинное русское название давало wrong_lang.
    expect(evaluateTurn({ expect: 'answer', lang: 'uk' }, observedDone(raw, shown, { linkLabels: [title] })).failures).toEqual([])
    const russian = `Детям подойдёт ${title} — это сорок пять минут прогулки по центру города, без спешки.`
    expect(evaluateTurn({ expect: 'answer', lang: 'uk' }, observedDone(raw, russian, { linkLabels: [title] })).failures.map((f: { check: string }) => f.check)).toEqual(['wrong_lang'])
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
