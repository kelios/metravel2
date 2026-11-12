/**
 * @jest-environment node
 */
import fs from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import path from 'path'

import { createAskClient } from '@/api/aiAssist/askProvider'
import type { GenerateRequest, Generator } from '@/api/aiAssist/generator'
import { createApp } from '@/scripts/ai-assist/app'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { createDemandLog } from '@/scripts/ai-assist/demandLog'
import { AskLimits, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'

import { createAskSession, inspectAskService, loadShownTexts, parseTrace, sameServer, SHOWN_TEXT_KEYS } from '../../scripts/ai-assistant-eval/ask-path.mjs'
import { evaluateTurn } from '../../scripts/ai-assistant-eval/checks.mjs'
import { parseJudgeLines, renderJudgeTask, renderReport } from '../../scripts/ai-assistant-eval/report.mjs'
import { collectResults, loadCases, parseRunArgs, rebuildReport } from '../../scripts/ai-assistant-eval/run-core.mjs'
import { fakeEmbedQuery, FIXTURE_CHUNKS, loadFixtureIndex, MODEL, type Spec, writeFixtureIndex } from './ai-assist/fixture'
import { makeTempDir, removeDir } from './cli-test-utils'

// #3286: контур оценки меряет путь службы `/ai/ask` — вопрос уходит в настоящую службу (фикстурный
// индекс, подставная модель) клиентом экрана, наблюдение хода собирается из потока и события `trace`.

const ROOT = process.cwd()
const LLM_URL = 'http://127.0.0.1:8090'
const BREST = 'Загляните в [Квест по Бресту](https://metravel.by/quests/2) и на https://evil.example/x'
const CHUNKS: Spec[] = [...FIXTURE_CHUNKS, { type: 'quest', sourceId: 4, title: 'Набережная Гродно', text: 'квест задание набережная неман', city: 'Гродно' }]

type Reply = { ok: boolean; status: number; headers: { get: (name: string) => string | null }; text: () => Promise<string> }

/** `fetch` поверх `node:http`: глобальный `fetch` под Jest подменён и до локального сервера не ходит. */
const httpFetch = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const request = http.request(url, { method: init.method ?? 'GET', headers: init.headers }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const status = response.statusCode ?? 0
        const body = Buffer.concat(chunks).toString('utf8')
        resolve({ ok: status >= 200 && status < 300, status, headers: { get: (name) => String(response.headers[name.toLowerCase()] ?? '') || null }, text: async () => body })
      })
    })
    request.on('error', reject)
    if (init.body) request.write(init.body)
    request.end()
  })
const fetchJson = async (url: string) => JSON.parse(await (await httpFetch(url)).text())

async function startService({ evalTrace = true, reply = () => BREST }: { evalTrace?: boolean; reply?: (request: GenerateRequest) => string } = {}) {
  const requests: GenerateRequest[] = []
  const generator: Generator = {
    async generate(request) {
      requests.push(request)
      const text = reply(request)
      request.onDelta?.(text, text)
      return { text, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 } }
    },
  }
  const limits = new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: 20, strikesToBlock: 3 })
  const server = createApp({
    index: loadFixtureIndex(writeFixtureIndex(MODEL, CHUNKS)),
    modelKey: MODEL,
    embedQuery: fakeEmbedQuery,
    lexical: async () => [],
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    ask: { generator, limits, demandLog: createDemandLog({ path: path.join(makeTempDir('ai-demand-'), 'ai-demand.jsonl') }), queueTimeoutMs: 200, trustProxy: true, evalTrace: evalTrace ? { llmUrl: LLM_URL } : null },
    authorDraft: { limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: 5, strikesToBlock: 3 }) },
    suggestTags: { catalog: { dictionary: async () => null, travelTags: async () => null } },
    log: () => {},
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const askUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const session = (visitor: string, options: { locale?: string; source?: { type: string; id: number } | null } = {}) =>
    createAskSession({ createAskClient, askUrl, visitor, locale: options.locale ?? 'ru', source: options.source ?? null, fetchImpl: httpFetch })
  return { askUrl, limits, requests, session, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

const promptOf = (request: GenerateRequest) => String(request.messages.at(-1)?.content ?? '')
const checksOf = (result: { failures: { check: string }[] }) => result.failures.map((failure) => failure.check)

describe('путь службы /ai/ask в контуре оценки (#3286)', () => {
  let quiet: jest.SpyInstance
  beforeEach(() => { quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined) })
  afterEach(() => quiet.mockRestore())

  it('ход несёт карточки подсказки и сырой ответ из события trace, показанный ответ и статус; слой провала считают те же проверки', async () => {
    const service = await startService()
    try {
      const cases = [{ id: 'lv01', group: 'weekend', lang: 'ru', locale: 'ru', turns: ['Какие квесты есть в Бресте?', 'А какой из них самый короткий?'], expects: ['answer', 'answer'], expect_sources: { pattern: 'брест', min: 1 } }]
      const [result] = await collectResults(cases, 1, (item: { locale: string }, sequence: number) => service.session(`2001:db8::${sequence}`, { locale: item.locale }))
      const [first, second] = result.turns
      expect(first.observed).toMatchObject({ turnCreated: true, status: 'done', answerText: 'Загляните в Квест по Бресту и на', linkLabels: ['Квест по Бресту'], linksRemovedNotice: true, blockedAfter: false })
      // Посетитель получил полный подбор, модель — только карточки Бреста (#3315): в записи хода оба списка.
      expect(first.observed.sources.length).toBeGreaterThan(1)
      expect(first.observed.modelCall).toMatchObject({ provider: 'ask', text: BREST, usage: { prompt_tokens: 100, completion_tokens: 20 } })
      expect(first.observed.modelCall.cards).toEqual([{ n: 1, type: 'quest', title: 'Квест по Бресту', url: 'https://metravel.by/quests/2', snippet: 'Городской квест по городу Брест (Польша). квест брест крепость задание дети' }])
      expect(promptOf(service.requests[0])).toContain('[1] Квест «Квест по Бресту» — https://metravel.by/quests/2\nГородской квест по городу Брест (Польша). квест брест крепость задание дети')
      expect(promptOf(service.requests[0])).not.toContain('Гродно')
      // Автопроверки те же, что у экрана: ход прошёл, выдуманный адрес — предупреждение слоя модели.
      expect(first.eval).toMatchObject({ pass: true, primaryLayer: null })
      expect(first.eval.warnings.map((warning: { check: string }) => warning.check)).toEqual(['invented_urls'])
      expect(first.eval.metrics).toMatchObject({ answeredByModel: true, cardLinks: 1, links: 1 })
      // Ожидание места проверяется на последнем ходе диалога: в подсказке только карточки Бреста.
      expect(second.eval.metrics).toMatchObject({ placeCards: 1, foreignCards: 0 })

      // Второй ход уходит с историей диалога, как у экрана: вопрос и показанный ответ первого хода.
      expect(second.observed.request.history).toEqual([{ role: 'user', text: 'Какие квесты есть в Бресте?' }, { role: 'assistant', text: 'Загляните в [Квест по Бресту](https://metravel.by/quests/2) и на' }])
      expect(service.requests[1].messages.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user'])
      expect(promptOf(service.requests[1])).not.toContain('Гродно')

      // Адрес посетителя — свой у вопроса набора: счётчик службы списан с него, а не с общего сокета.
      expect((await service.limits.quotaState('2001:db8::0')).used).toBe(2)
      expect((await service.limits.quotaState('127.0.0.1')).used).toBe(0)

      const report = renderReport({ startedAt: 't', provider: 'ask', askUrl: service.askUrl, modelUrl: LLM_URL, index: { builtAt: '2026-10-18', count: 8 } }, [result])
      expect(report).toContain('# Оценка ассистента /ai/ask (путь службы)')
      expect(report).toContain(`служба: ${service.askUrl}/ai/ask (запрос клиентом экрана, сам экран не участвует)`)
      expect(report).toContain('карточки места дошли до модели — 1; рядом с ними чужие карточки — 0.')
      const task = renderJudgeTask('# Судья', [result], 'out', { scores: true })
      expect(task).toContain('Карточки службы (ушли в подсказку модели):')
      expect(task).toContain('Предыдущие реплики диалога:\n\n```text\nПосетитель: Какие квесты есть в Бресте?\nАссистент: Загляните в Квест по Бресту и на\n```')
      expect(task).toContain('https://evil.example/x')
    } finally {
      await service.close()
    }
  })

  it('поле source случая уходит в запрос страницей-источником: её карточка первой в подсказке', async () => {
    const service = await startService({ reply: () => 'Смотрите [Ярмарки Польши](https://metravel.by/travels/816).' })
    try {
      const observed = await service.session('2001:db8::a', { source: { type: 'travel', id: 816 } })('Сколько дней занимает поездка?')
      expect(observed.request.source).toEqual({ type: 'travel', id: 816 })
      expect(observed.modelCall.cards[0]).toMatchObject({ n: 1, type: 'travel', title: 'Ярмарки Польши', url: 'https://metravel.by/travels/816' })
      expect(observed.sources[0]).toMatchObject({ type: 'travel', id: '816' })
      expect(promptOf(service.requests[0]).startsWith('Материалы сайта:\n[1] Статья «Ярмарки Польши»')).toBe(true)
      expect(renderJudgeTask('# Судья', [{ id: 'lv43', group: 'page', lang: 'ru', turns: [{ question: 'Сколько дней занимает поездка?', expect: 'answer', observed, eval: { pass: true, failures: [] } }] }], 'out')).toContain('Вопрос задан со страницы статьи (id 816)')
    } finally {
      await service.close()
    }
  })

  it('отказ фильтра тем — ход без вызова модели; третий вопрос не по теме закрывает диалог, соседний вопрос набора не задет', async () => {
    const service = await startService()
    try {
      const escalation = [{ id: 'es01', group: 'escalation', lang: 'ru', locale: 'ru', turns: ['как готовить кашу', 'напиши функцию на python', 'расскажи анекдот', 'что посмотреть в Кракове?'], expects: ['refuse', 'refuse', 'refuse_block', 'blocked'] }]
      const [result] = await collectResults(escalation, 1, () => service.session('2001:db8::e'))
      expect(result.turns.map((turn: { observed: { status?: string; turnCreated: boolean } }) => [turn.observed.turnCreated, turn.observed.status ?? null])).toEqual([[true, 'off_topic'], [true, 'off_topic'], [true, 'off_topic'], [false, null]])
      expect(result.turns.every((turn: { eval: { pass: boolean } }) => turn.eval.pass)).toBe(true)
      expect(result.turns[0].observed.modelCall).toBeNull()
      expect(result.turns[2].observed).toMatchObject({ blockedAfter: true, inputBlocked: true })
      // Вопрос после блока в службу не уходит — как на экране с закрытым полем.
      expect(service.requests).toHaveLength(0)
      // Следующий вопрос набора идёт с другого адреса: блок и счётчик первого его не срезают.
      const next = await service.session('2001:db8::f')('Какие квесты есть в Бресте?')
      expect(next.status).toBe('done')
    } finally {
      await service.close()
    }
  })

  it('отказ самой модели: статус off_topic без текста, сырой отказ и карточки остаются в записи хода', async () => {
    const refusal = 'Я ассистент metravel.by по путешествиям — статьям и квестам сайта, на другие темы не отвечаю. Спросите про маршрут или город.'
    const service = await startService({ reply: () => refusal })
    try {
      const [result] = await collectResults([{ id: 'lv02', group: 'weekend', lang: 'ru', locale: 'ru', turns: ['ярмарки краков'], expects: ['answer'] }], 1, () => service.session('2001:db8::b'))
      const [turn] = result.turns
      expect(turn.observed).toMatchObject({ status: 'off_topic', answerText: '', sources: [], linkLabels: [] })
      expect(turn.observed.modelCall.text).toBe(refusal)
      expect(turn.observed.modelCall.cards.length).toBeGreaterThan(0)
      expect(checksOf(turn.eval)).toEqual(['false_offtopic'])
    } finally {
      await service.close()
    }
  })

  it('служба без AI_ASSIST_EVAL_TRACE: ответ есть, вызова модели в записи нет — ход уходит в слой инфраструктуры', async () => {
    const service = await startService({ evalTrace: false })
    try {
      const [result] = await collectResults([{ id: 'lv03', group: 'weekend', lang: 'ru', locale: 'ru', turns: ['Какие квесты есть в Бресте?'], expects: ['answer'] }], 1, () => service.session('2001:db8::c'))
      expect(result.turns[0].observed).toMatchObject({ status: 'done', modelCall: null })
      expect(result.turns[0].eval).toMatchObject({ pass: false, primaryLayer: 'infra' })
      expect(checksOf(result.turns[0].eval)).toEqual(['no_model_call'])
      // До первого вопроса прогон останавливает проверка службы.
      await expect(inspectAskService(service.askUrl, null, fetchJson)).rejects.toThrow('служба запущена без AI_ASSIST_EVAL_TRACE=1')
    } finally {
      await service.close()
    }
  })

  it('проверка службы перед прогоном: событие trace включено и модель — та, что ждёт сторона приёмки', async () => {
    const service = await startService()
    try {
      expect(await inspectAskService(service.askUrl, 'http://localhost:8090/', fetchJson)).toEqual({ url: service.askUrl, llmUrl: LLM_URL, indexBuiltAt: '2026-10-18T16:48:48.951Z', indexCount: CHUNKS.length })
      await expect(inspectAskService(service.askUrl, 'http://127.0.0.1:8080', fetchJson)).rejects.toThrow(`служба смотрит на модель ${LLM_URL}, ожидалась http://127.0.0.1:8080`)
      expect(sameServer('http://localhost:8080', 'http://127.0.0.1:8080/')).toBe(true)
      expect(sameServer('http://127.0.0.1:8080', 'http://127.0.0.1:8090')).toBe(false)
      expect(sameServer('не адрес', 'http://127.0.0.1:8090')).toBe(false)
    } finally {
      await service.close()
    }
  })

  it('служба недоступна или занята — статус хода слоя инфраструктуры с текстом отказа', async () => {
    const failing = (status: number, body: object) => createAskSession({
      createAskClient, askUrl: 'http://service.test', visitor: '2001:db8::d', locale: 'ru',
      fetchImpl: async () => ({ ok: false, status, headers: { get: () => null }, text: async () => JSON.stringify(body) }),
    })
    expect(await failing(429, { error: 'busy', detail: 'очередь к модели' })('вопрос')).toMatchObject({ turnCreated: true, status: 'busy', notice: 'очередь к модели', modelCall: null })
    expect(await failing(503, { error: 'generator_unavailable', detail: 'AI_LLM_URL не задан' })('вопрос')).toMatchObject({ status: 'unavailable', notice: 'AI_LLM_URL не задан' })
    // Дневной лимит службы в прогоне — сбой стенда, а не отказ вопросу.
    expect(await failing(429, { error: 'limit', detail: 'дневной лимит 20 вопросов исчерпан' })('вопрос')).toMatchObject({ turnCreated: true, status: 'error', notice: 'дневной лимит 20 вопросов исчерпан' })
  })

  describe('ход без текста модели контур видит той же строкой, что посетитель (#3345, четвёртый заход)', () => {
    const NEARBY = '{"type":"quest","source_id":"129","title":"Детский квест по Варшаве","url":"https://metravel.by/quests/10/warsaw-kids","path":"/quests/10/warsaw-kids","snippet":"Детский городской квест","score":0.5,"group":"nearby"}'
    const emptyPrompt = (done: string) => [
      `event: sources\ndata: {"sources":[${NEARBY}],"degraded":false,"remaining":19}`,
      'event: trace\ndata: {"prompt_sources":[],"raw_text":"","model_called":false}',
      'event: text\ndata: {"text":""}',
      `event: done\ndata: ${done}`,
      '',
    ].join('\n\n')
    const CARD = '{"type":"quest","source_id":"64","title":"Квест по Софии: Сердика под ногами","url":"https://metravel.by/quests/sofia/serdica","path":"/quests/sofia/serdica","snippet":"Городской квест по городу София (Болгария). Точек: 9","score":0.6}'
    const guardFallback = [
      `event: sources\ndata: {"sources":[${CARD}],"degraded":false,"remaining":19}`,
      `event: trace\ndata: {"prompt_sources":[${CARD}],"raw_text":"Сколько стоит пройти квест?"}`,
      'event: text\ndata: {"text":""}',
      'event: done\ndata: {"status":"done","removed_links":0,"fallback":true,"remaining":19}',
      '',
    ].join('\n\n')
    const sessionOf = async (body: string, locale = 'ru', withTexts = true) => {
      const requests: string[] = []
      const ask = createAskSession({
        createAskClient, askUrl: 'http://service.test', visitor: '2001:db8::e', locale, shownTexts: withTexts ? await loadShownTexts(locale) : null,
        fetchImpl: async (_url: string, init: { body?: string }) => {
          requests.push(String(init.body))
          return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => body }
        },
      })
      return { ask, requests }
    }
    const question = 'Где погулять с собакой недалеко от Варшавы?'
    const failuresOf = (expect: string, lang: string, observed: unknown) => evaluateTurn({ expect, lang, question }, observed).failures.map((item: { check: string; layer: string }) => `${item.check}/${item.layer}`)

    it('строки берутся из ресурсов интерфейса на локали хода — по ключам экрана', async () => {
      expect(SHOWN_TEXT_KEYS).toEqual({ fallback: 'ask.fallbackAnswer', noMaterial: 'ask.noSources' })
      expect(await loadShownTexts('ru')).toEqual({
        fallback: 'Точного ответа в найденных материалах нет — посмотрите источники ниже.',
        noMaterial: 'На сайте пока нет материалов по этому вопросу. Попробуйте другое направление или загляните в каталог маршрутов.',
      })
      expect((await loadShownTexts('be')).noMaterial).toMatch(/^На сайце пакуль няма матэрыялаў/)
      expect((await loadShownTexts('en')).fallback).toBe('There is no exact answer in the materials found — see the sources below.')
    })

    it('пустая подсказка: показанный текст — «материала нет», признаки promptEmpty и noMaterial, история диалога без хода', async () => {
      const { ask, requests } = await sessionOf(emptyPrompt('{"status":"done","removed_links":0,"fallback":true,"reason":"no_material","remaining":19}'))
      const observed = await ask(question)
      expect(observed).toMatchObject({
        status: 'done', fallback: true, noMaterial: true, promptEmpty: true, modelCall: null, linkLabels: [],
        answerText: 'На сайте пока нет материалов по этому вопросу. Попробуйте другое направление или загляните в каталог маршрутов.',
        sources: [{ type: 'quest', id: '129', title: 'Детский квест по Варшаве' }],
      })
      // Строка экрана в историю диалога не идёт, как на экране.
      await ask('А в Кракове?')
      expect(JSON.parse(requests[1]).history).toEqual([])
      // Ход решён подбором, модель не вызывалась: `no_links` (слой модели) ему не ставится. Ожидание `answer`
      // получает провал подбора `empty_prompt`; «по теме» и «материала нет» честное признание проходят.
      expect(failuresOf('answer', 'ru', observed)).toEqual(['empty_prompt/retrieval'])
      expect(failuresOf('any_on_topic', 'ru', observed)).toEqual([])
      expect(failuresOf('no_material', 'ru', observed)).toEqual([])
      // На другой локали — её строка, язык ответа верный.
      const pl = await (await sessionOf(emptyPrompt('{"status":"done","removed_links":0,"fallback":true,"reason":"no_material","remaining":19}'), 'pl')).ask('Gdzie pójść z psem pod Warszawą?')
      expect(pl.answerText).toBe('W serwisie nie ma jeszcze materiałów na ten temat. Spróbuj innego kierunku albo zajrzyj do katalogu tras.')
      expect(failuresOf('no_material', 'pl', pl)).toEqual([])
    })

    it('служба без причины в done (старый образ) — прежняя запасная фраза стража, ход по-прежнему promptEmpty', async () => {
      const observed = await (await sessionOf(emptyPrompt('{"status":"done","removed_links":0,"fallback":true,"remaining":19}'))).ask(question)
      expect(observed).toMatchObject({ status: 'done', fallback: true, promptEmpty: true, answerText: 'Точного ответа в найденных материалах нет — посмотрите источники ниже.' })
      expect(observed.noMaterial).toBeUndefined()
    })

    it('запасной ответ стража: показанный текст — запасная фраза; проверки не ослабли — у ожидания answer это `no_links` слоя модели', async () => {
      const observed = await (await sessionOf(guardFallback)).ask('Сколько стоит пройти квест?')
      expect(observed).toMatchObject({ status: 'done', fallback: true, answerText: 'Точного ответа в найденных материалах нет — посмотрите источники ниже.', linkLabels: [] })
      expect(observed.noMaterial).toBeUndefined()
      expect(observed.promptEmpty).toBeUndefined()
      expect(observed.modelCall).toMatchObject({ text: 'Сколько стоит пройти квест?' })
      expect(failuresOf('answer', 'ru', observed)).toEqual(['no_links/model'])
      expect(failuresOf('any_on_topic', 'ru', observed)).toEqual([])
    })

    it('строки экрана не переданы — ход без текста модели роняет прогон, а не пишет пустой ответ', async () => {
      const { ask } = await sessionOf(guardFallback, 'ru', false)
      await expect(ask('Сколько стоит пройти квест?')).rejects.toThrow(/loadShownTexts/)
    })
  })

  it('#3293: справка о сайте — ход без модели: ответ записи, вид источника help, признак helpDirect; набор несёт 12 вопросов о сайте и три контрольных', async () => {
    const body = [
      'event: sources\ndata: {"sources":[{"type":"help","source_id":"1","title":"Сколько стоит пройти квест?","url":"https://metravel.by/quests","path":"/quests","snippet":"Бесплатно.","score":0.66,"group":"match"}],"degraded":false,"remaining":19}',
      'event: trace\ndata: {"prompt_sources":[{"type":"help","source_id":"1","title":"Сколько стоит пройти квест?","url":"https://metravel.by/quests","snippet":"Бесплатно."}],"raw_text":"","model_called":false,"help":true}',
      'event: text\ndata: {"text":"Бесплатно.\\n\\n[metravel.by/quests](https://metravel.by/quests)"}',
      'event: done\ndata: {"status":"done","removed_links":0,"remaining":19}',
      '',
    ].join('\n\n')
    const ask = createAskSession({
      createAskClient, askUrl: 'http://service.test', visitor: '2001:db8::f', locale: 'ru',
      fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => body }),
    })
    const observed = await ask('Сколько стоит пройти квест?')
    expect(observed).toMatchObject({ status: 'done', answerText: 'Бесплатно.\n\nmetravel.by/quests', linkLabels: ['metravel.by/quests'], modelCall: null, helpDirect: true, sources: [{ type: 'help', id: '1', title: 'Сколько стоит пройти квест?', group: 'match' }] })
    expect(observed.promptEmpty).toBeUndefined()
    expect(observed.helpCards).toEqual([{ n: 1, type: 'help', title: 'Сколько стоит пройти квест?', url: 'https://metravel.by/quests', snippet: 'Бесплатно.' }])
    const live = loadCases(path.join(ROOT, 'scripts/ai-assistant-eval/cases.live.jsonl')) as { id: string; group: string; lang: string; expects: string[]; no_help?: boolean }[]
    // В группе `site_help` — и прежние пять вопросов о сайте (lv38–lv42, ожидание any_on_topic).
    const help = live.filter((item) => item.group === 'site_help' && item.expects[0] === 'help')
    expect(help).toHaveLength(12)
    expect(live.filter((item) => item.group === 'site_help')).toHaveLength(17)
    expect([...new Set(help.map((item) => item.lang))].sort()).toEqual(['be', 'en', 'pl', 'ru', 'uk'])
    const control = live.filter((item) => item.group === 'site_help_control')
    expect(control.map((item) => [item.expects[0], item.no_help])).toEqual([['answer', true], ['answer', true], ['answer', true]])
  })

  it('событие trace читается из тела потока; без него и на битых данных — null', () => {
    const body = 'event: sources\ndata: {"sources":[]}\n\nevent: trace\ndata: {"prompt_sources":[{"type":"quest","title":"Т"}],"raw_text":"сырой"}\n\nevent: done\ndata: {"status":"done"}\n\n'
    expect(parseTrace(body)).toEqual({ promptSources: [{ type: 'quest', title: 'Т' }], rawText: 'сырой', modelCalled: true, help: false })
    // Пустая подсказка (#3345): служба ответила без вызова модели.
    expect(parseTrace('event: trace\ndata: {"prompt_sources":[],"raw_text":"","model_called":false}\n\n')).toEqual({ promptSources: [], rawText: '', modelCalled: false, help: false })
    expect(parseTrace('event: done\ndata: {"status":"done"}\n\n')).toBeNull()
    expect(parseTrace('event: trace\ndata: {битый\n\n')).toBeNull()
  })
})

describe('команда прогона: режим --provider ask (#3286)', () => {
  it('флаги: служба по умолчанию на :8787, --model-url — сверка модели; чужой провайдер и --ask-url без режима — ошибка', () => {
    expect(parseRunArgs(['--provider', 'ask'])).toMatchObject({ provider: 'ask', askUrl: 'http://127.0.0.1:8787' })
    expect(parseRunArgs(['--provider', 'ask']).expectModelUrl).toBeUndefined()
    expect(parseRunArgs(['--provider=ask', '--ask-url', 'http://127.0.0.1:8788/', '--model-url', 'http://127.0.0.1:8080'])).toMatchObject({ askUrl: 'http://127.0.0.1:8788', expectModelUrl: 'http://127.0.0.1:8080' })
    expect(() => parseRunArgs(['--provider', 'llamacpp'])).toThrow('--provider: только ask')
    expect(() => parseRunArgs(['--ask-url', 'http://127.0.0.1:8787'])).toThrow('--ask-url нужен только с --provider ask')
    // Прогон через экран флагами службы не задет.
    expect(parseRunArgs([])).toMatchObject({ baseUrl: 'http://localhost:8081', modelUrl: 'http://127.0.0.1:8080' })
    expect(parseRunArgs([]).provider).toBeUndefined()
  })

  describe('папка прогона', () => {
    let dir: string
    beforeEach(() => { dir = makeTempDir('ai-ask-run-', { root: path.join(ROOT, '.codex-temp') }) })
    afterEach(() => removeDir(dir))

    it('набор вопросов: поле source — страница travel|quest с положительным id', () => {
      const file = path.join(dir, 'cases.jsonl')
      const write = (source: unknown) => fs.writeFileSync(file, `${JSON.stringify({ id: 'lv43', group: 'page', lang: 'ru', q: 'На сколько дней маршрут?', expect: 'answer', source })}\n`)
      write({ type: 'travel', id: 438 })
      expect(loadCases(file)[0].source).toEqual({ type: 'travel', id: 438 })
      write({ type: 'article', id: 438 })
      expect(() => loadCases(file)).toThrow('lv43: source — {type: travel|quest, id: положительное целое}')
      write({ type: 'quest', id: '94' })
      expect(() => loadCases(file)).toThrow('lv43: source')
    })

    it('пересчёт отчёта прогона службы: полезность судьи в отчёте, вердикт без трёх оценок — ошибка', async () => {
      const service = await startService()
      const quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined)
      try {
        const cases = path.join(dir, 'cases.live.jsonl')
        fs.writeFileSync(cases, [
          { id: 'lv01', group: 'weekend', lang: 'ru', q: 'Какие квесты есть в Бресте?', expect: 'answer', expect_sources: { pattern: 'брест', min: 1 } },
          { id: 'lv02', group: 'weekend', lang: 'ru', q: 'Что посмотреть в Бресте за день?', expect: 'answer' },
        ].map((item) => JSON.stringify(item)).join('\n') + '\n')
        const results = await collectResults(loadCases(cases), 1, (_item: unknown, sequence: number) => service.session(`2001:db8::1${sequence}`))
        fs.writeFileSync(path.join(dir, 'results.jsonl'), results.map((result: unknown) => JSON.stringify(result)).join('\n') + '\n')
        fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ startedAt: 't', provider: 'ask', askUrl: service.askUrl, modelUrl: LLM_URL, cases: path.relative(ROOT, cases) }))

        fs.writeFileSync(path.join(dir, 'judge.jsonl'), `${JSON.stringify({ key: 'lv01#0', verdict: 'pass' })}\n`)
        expect(() => rebuildReport(dir, null)).toThrow('lv01#0: нужны все три оценки качества')

        fs.writeFileSync(path.join(dir, 'judge.jsonl'), [
          { key: 'lv01#0', verdict: 'pass', instruction: 2, usefulness: 2, language: 2 },
          { key: 'lv02#0', verdict: 'fail', layer: 'model', instruction: 1, usefulness: 0, language: 2, note: 'ответ про квест вместо маршрута' },
        ].map((item) => JSON.stringify(item)).join('\n') + '\n')
        rebuildReport(dir, null)
        const report = fs.readFileSync(path.join(dir, 'report.md'), 'utf8')
        expect(report).toContain('- Полезность по судье: 1,00 из 2; нулей 1/2 (50 %); оценено 2/2 ходов.')
        expect(report).toContain('**Итог: 1/2 ходов (50 %).**')
        expect(parseJudgeLines(fs.readFileSync(path.join(dir, 'judge.jsonl'), 'utf8')).errors).toEqual([])
      } finally {
        quiet.mockRestore()
        await service.close()
      }
    })
  })
})
