/** @jest-environment node */
// #2199: конвейер перевода квестов против локального HTTP-стаба admin-API (#2194).
//
// Запись перевода — единственное место, где конвейер меняет прод: черновик,
// публикация, перезапись уже принятого. Стаб повторяет контракт бэкенда
// (`quests/services/translation_management.py`): токен администратора, замена
// перевода целиком, отказ 400 при публикации без шага. К проду тест не ходит.
import { makeTempDir, removeDir } from './cli-test-utils'
import { GATE_ID, INTRO_ID, TOWER_ID, makeBundle, makePolishTranslation } from './questTranslate.fixtures'

const fs = require('fs')
const http = require('http')
const path = require('path')

const { EmptySelectionError, ExpectedFailureError, UsageError } = require('@/scripts/lib/cli-contract')
const { RETRY_DELAYS_MS, createApi, resolveToken } = require('@/scripts/lib/questTranslation/api')
const { reviewDigest } = require('@/scripts/lib/questTranslation/checks')
const { parseArgs, run } = require('@/scripts/quest-translate')

type Json = Record<string, any>

const TOKEN = 'stub-admin-token'
const BASE_QUESTS = [
  { id: 7, quest_id: 'demo-quest', title: 'Квест по Кракову: демо', city_id: '1', city_name: 'Краков', city_name_canonical: 'Краков', completions_count: 1 },
  { id: 9, quest_id: 'second-quest', title: 'Второй', city_id: '2', city_name: 'Минск', city_name_canonical: 'Минск', completions_count: 5 },
]

let server: any
let apiUrl = ''
let workDir = ''
let homeDir = ''
// Состояние стаба: переводы по ключу «pk:locale», названия городов, шаги источника.
let translations: Map<string, Json>
let cityNames: Map<string, string>
let sourceStepIds: number[]
let staleStepIds: number[]
// Правка русского источника после `prepare`: поля поверх бандла демо-квеста.
let bundlePatch: Json
let requests: string[]
let QUESTS: typeof BASE_QUESTS

const sendJson = (res: any, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

const statusRows = (locale: string | null) =>
  QUESTS.flatMap((quest) =>
    ['be', 'uk', 'pl', 'en']
      .filter((code) => !locale || code === locale)
      .map((code) => {
        const row = translations.get(`${quest.id}:${code}`)
        const ids = quest.id === 7 ? sourceStepIds : []
        const have = new Set((row ? row.steps : []).map((step: Json) => step.step_id))
        return {
          id: quest.id,
          quest_id: quest.quest_id,
          locale: code,
          state: row ? row.status : 'missing',
          missing_step_ids: ids.filter((id) => !have.has(id)),
          stale_step_ids: row && quest.id === 7 ? staleStepIds.filter((id) => have.has(id)) : [],
          updated_at: row ? '2026-10-05T10:00:00Z' : null,
        }
      }),
  )

const handle = (req: any, res: any, body: Json | null) => {
  const url = new URL(req.url, 'http://stub')
  requests.push(`${req.method} ${url.pathname}${url.search}`)
  const admin = req.headers.authorization === `Token ${TOKEN}`

  const bundleOf = /^\/api\/quests\/by-quest-id\/([a-z0-9-]+)\/$/.exec(url.pathname)
  const bundleQuest = bundleOf && QUESTS.find((quest) => quest.quest_id === bundleOf[1] && quest.city_id === '1')
  if (req.method === 'GET' && bundleQuest) {
    return sendJson(res, 200, { ...makeBundle(), ...bundlePatch, id: bundleQuest.id, quest_id: bundleQuest.quest_id })
  }
  // Публичный источник: неизвестный квест — 404, а не отказ в доступе.
  if (req.method === 'GET' && bundleOf) return sendJson(res, 404, { detail: 'Not found.' })
  if (req.method === 'GET' && url.pathname === '/api/quests/') {
    const lang = url.searchParams.get('lang')
    return sendJson(res, 200, {
      count: QUESTS.length,
      next: null,
      results: QUESTS.map((quest) => ({ ...quest, city_name: (lang && cityNames.get(`${quest.city_id}:${lang}`)) || quest.city_name })),
    })
  }
  if (!admin) return sendJson(res, 401, { detail: 'Authentication credentials were not provided.' })
  if (req.method === 'GET' && url.pathname === '/api/quests/translations/status/') {
    return sendJson(res, 200, statusRows(url.searchParams.get('locale')))
  }
  const city = /^\/api\/quest-cities\/(\d+)\/translations\/([a-z]+)\/$/.exec(url.pathname)
  if (city && req.method === 'PUT') {
    cityNames.set(`${city[1]}:${city[2]}`, body!.name)
    return sendJson(res, 200, { name: body!.name })
  }
  const match = /^\/api\/quests\/(\d+)\/translations\/([a-z]+)\/$/.exec(url.pathname)
  if (!match) return sendJson(res, 404, { detail: 'Not found.' })
  const key = `${match[1]}:${match[2]}`
  if (req.method === 'GET') {
    const row = translations.get(key)
    if (!row) return sendJson(res, 404, { detail: 'Translation not found.' })
    return sendJson(res, 200, {
      ...row,
      steps: row.steps.map((step: Json) => ({ ...step, source_hash: 'h', stale: staleStepIds.includes(step.step_id) })),
    })
  }
  const missing = sourceStepIds.filter((id) => !body!.steps.some((step: Json) => step.step_id === id))
  if (body!.status === 'published' && missing.length) {
    return sendJson(res, 400, { errors: [{ code: 'missing_steps', field: 'steps' }], missing_step_ids: missing })
  }
  translations.set(key, body!)
  return sendJson(res, 200, body)
}

beforeAll(async () => {
  server = http.createServer((req: any, res: any) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => (raw += chunk))
    req.on('end', () => handle(req, res, raw ? JSON.parse(raw) : null))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  apiUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

let logSpy: jest.SpyInstance
let stdoutSpy: jest.SpyInstance

beforeEach(() => {
  workDir = makeTempDir('quest-translate-')
  homeDir = makeTempDir('quest-translate-home-')
  translations = new Map()
  cityNames = new Map()
  sourceStepIds = [INTRO_ID, GATE_ID, TOWER_ID]
  staleStepIds = []
  bundlePatch = {}
  requests = []
  QUESTS = [...BASE_QUESTS]
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

afterEach(() => {
  jest.restoreAllMocks()
  removeDir(workDir)
  removeDir(homeDir)
})

// Глобальный `fetch` в jest подменён полифилом React Native — к стабу ходим через `http`.
const nodeFetch = (url: string, init: Json) =>
  new Promise((resolve, reject) => {
    const request = http.request(url, { method: init.method, headers: init.headers }, (response: any) => {
      let raw = ''
      response.on('data', (chunk: Buffer) => (raw += chunk))
      response.on('end', () => resolve({ status: response.statusCode, text: async () => raw }))
    })
    request.on('error', reject)
    if (init.body) request.write(init.body)
    request.end()
  })

const cli = (tokens: string[], { token = TOKEN as string | null } = {}) =>
  run(parseArgs([...tokens, '--api-url', apiUrl, '--work-dir', workDir, ...(token ? ['--token', token] : [])]), {
    fetchImpl: nodeFetch,
    // Токен читается из окружения и `~/.metravel_token`: тест не должен найти настоящий.
    tokenSources: { env: {}, homeDir },
  })
const artifact = (suffix: string, locale = 'pl') => path.join(workDir, locale, `demo-quest${suffix}`)
const readArtifact = (suffix: string, locale = 'pl') => JSON.parse(fs.readFileSync(artifact(suffix, locale), 'utf8'))
const writeArtifact = (suffix: string, value: unknown) => fs.writeFileSync(artifact(suffix), JSON.stringify(value))
const logged = () => logSpy.mock.calls.map((call) => call.join(' ')).join('\n')
const writes = () => requests.filter((line) => line.startsWith('PUT'))
const stored = () => translations.get('7:pl')

const QUEST = ['--quest', 'demo-quest', '--locale', 'pl']
const writeReview = (translation = readArtifact('.json'), ok = true) =>
  writeArtifact('.review.json', {
    kind: 'quest-translation-review',
    translation_sha256: reviewDigest({ task: readArtifact('.task.json'), translation }),
    verdicts: [INTRO_ID, GATE_ID, TOWER_ID, null].map((id) => ({ step_id: id, ok, detail: ok ? '' : 'смысл искажён' })),
  })

/** prepare → файл перевода от «агента» → check: исходная точка большинства сценариев. */
const prepareAndTranslate = async (translation = makePolishTranslation()) => {
  await cli(['prepare', ...QUEST])
  writeArtifact('.json', translation)
}

describe('разбор вызова', () => {
  it.each([
    [['check', ...QUEST, '--publish'], '--publish не относится к check'],
    [['prepare', '--quest', 'demo-quest'], 'нужен --locale'],
    [['upload', '--quest', 'demo-quest', '--locale', 'ru'], 'локали перевода'],
    [['upload', '--quest', 'demo-quest', '--locale', 'de'], 'локали перевода'],
    [['next', '--count', '3', '--order', 'random'], '--order random'],
    [['translate', ...QUEST], 'нужна одна подкоманда'],
    [['next', 'status', '--count', '1'], 'нужна одна подкоманда'],
    [['check', 'demo-quest', ...QUEST], 'нужна одна подкоманда'],
    [['toString', ...QUEST], 'нужна одна подкоманда'],
    [['sweep'], 'нужен список quest_id или --from-next'],
    [['sweep', 'demo-quest', '--from-next', '2'], 'либо список quest_id, либо --from-next'],
    [['sweep', 'demo-quest', 'Demo_Quest'], '"Demo_Quest" — не quest_id'],
    [['sweep', 'demo-quest', '--order', 'catalog'], '--order имеет смысл только с --from-next'],
    [['sweep', 'demo-quest', '--publish'], '--publish не относится к sweep'],
  ])('%j — ошибка вызова', async (tokens, message) => {
    await expect(cli(tokens)).rejects.toThrow(UsageError)
    await expect(cli(tokens)).rejects.toThrow(message)
    expect(requests).toEqual([])
  })

  it('опечатка во флаге не превращается в запуск по умолчанию', () => {
    expect(() => parseArgs(['upload', ...QUEST, '--publsh'])).toThrow(UsageError)
    expect(() => parseArgs(['--count', '3'])).toThrow(UsageError)
  })

  it('без токена admin-команды не делают ни одной записи', async () => {
    await prepareAndTranslate()
    requests = []
    await expect(cli(['upload', ...QUEST], { token: null })).rejects.toThrow(UsageError)
    await expect(cli(['status'], { token: null })).rejects.toThrow('Нужен токен администратора')
    expect(writes()).toEqual([])
  })

  it('токен: флаг, затем METRAVEL_TOKEN, затем ~/.metravel_token; пустой файл — нет токена', () => {
    fs.writeFileSync(path.join(homeDir, '.metravel_token'), 'from-file\n')
    expect(resolveToken('flag', { env: { METRAVEL_TOKEN: 'from-env' }, homeDir })).toBe('flag')
    expect(resolveToken(null, { env: { METRAVEL_TOKEN: 'from-env' }, homeDir })).toBe('from-env')
    expect(resolveToken(null, { env: {}, homeDir })).toBe('from-file')
    fs.writeFileSync(path.join(homeDir, '.metravel_token'), '\n')
    expect(resolveToken(null, { env: {}, homeDir })).toBeNull()
    expect(resolveToken(null, { env: {}, homeDir: workDir })).toBeNull()
  })

  it('отклонённый токен — отказ с подсказкой, а не пустой отчёт', async () => {
    await expect(cli(['status'], { token: 'expired' })).rejects.toThrow(ExpectedFailureError)
    await expect(cli(['status'], { token: 'expired' })).rejects.toThrow('get-quest-token')
  })
})

describe('prepare', () => {
  it('пишет задание на полный перевод: снимок источника, числовые id шагов, глоссарий локали, подписи кнопок', async () => {
    await cli(['prepare', ...QUEST])
    const task = readArtifact('.task.json')
    expect(task).toMatchObject({ kind: 'quest-translation-task', locale: 'pl', source_locale: 'ru', mode: 'full' })
    expect(task.translate_step_ids).toEqual([INTRO_ID, GATE_ID, TOWER_ID])
    expect(task.source.steps.map((step: Json) => step.slug)).toEqual(['intro', '1-gate', '2-tower'])
    expect(task.glossary[0]).toEqual({ ru: 'квест', pl: 'quest' })
    expect(task.ui_labels[0].source).toBe('Начать квест')
    expect(task.existing).toBeNull()
    expect(writes()).toEqual([])
  })

  it('без токена готовит полный перевод и говорит, что статус не прочитан', async () => {
    await cli(['prepare', ...QUEST], { token: null })
    expect(readArtifact('.task.json').notes[0]).toContain('нет токена')
    expect(requests).toEqual(['GET /api/quests/by-quest-id/demo-quest/'])
  })

  it('опубликованный и актуальный перевод задания не даёт', async () => {
    translations.set('7:pl', { ...makePolishTranslation(), status: 'published' })
    await cli(['prepare', ...QUEST])
    expect(fs.existsSync(artifact('.task.json'))).toBe(false)
    expect(logged()).toContain('переводить нечего')
  })

  it('опубликованный перевод с устаревшим финалом даёт задание, хотя шаги актуальны', async () => {
    const published = makePolishTranslation() as Json
    translations.set('7:pl', { ...published, status: 'published', finale: { ...published.finale, stale: true } })
    await cli(['prepare', ...QUEST])
    expect(readArtifact('.task.json')).toMatchObject({ mode: 'incremental', translate_step_ids: [] })
  })

  it('у опубликованного перевода в задание идут только устаревшие шаги', async () => {
    translations.set('7:pl', { ...makePolishTranslation(), status: 'published' })
    staleStepIds = [TOWER_ID]
    await cli(['prepare', ...QUEST])
    const task = readArtifact('.task.json')
    expect(task).toMatchObject({ mode: 'incremental', translate_step_ids: [TOWER_ID] })
    expect(task.existing.steps).toHaveLength(3)
    expect(task.existing.steps[0]).not.toHaveProperty('source_hash')
  })

  it('принятые имена — из опубликованных переводов квестов того же города', async () => {
    QUESTS.push({ ...BASE_QUESTS[0], id: 11, quest_id: 'neighbor-quest' })
    translations.set('11:pl', { ...makePolishTranslation(), status: 'published' })
    translations.set('9:pl', { status: 'published', steps: [] })
    await cli(['prepare', ...QUEST])
    expect(readArtifact('.task.json').accepted_names).toEqual(
      expect.arrayContaining([{ source: 'Флорианские ворота', target: 'Brama Floriańska', from_quest: 'neighbor-quest' }]),
    )
    expect(requests).not.toContain('GET /api/quests/by-quest-id/second-quest/')
  })
})

describe('check', () => {
  it('зелёный перевод: отчёт по каждому шагу, checks в файле, задание проверяющему', async () => {
    await prepareAndTranslate()
    await cli(['check', ...QUEST])
    expect(logged()).toMatch(/ok\s+шаг «intro»: 7\/7/)
    expect(logged()).toMatch(/ok\s+шаг «1-gate»: 7\/7/)
    expect(logged()).toContain('без её вердикта публикация закрыта')
    expect(readArtifact('.json').checks.every((entry: Json) => entry.ok)).toBe(true)
    expect(readArtifact('.review-task.json').translation_sha256).toBe(
      reviewDigest({ task: readArtifact('.task.json'), translation: makePolishTranslation() }),
    )
  })

  it('файл без шага — отказ с названием шага и ненулевой выход', async () => {
    const broken = makePolishTranslation()
    broken.steps = broken.steps.filter((step) => step.step_id !== TOWER_ID)
    await prepareAndTranslate(broken)
    await expect(cli(['check', ...QUEST])).rejects.toThrow(ExpectedFailureError)
    expect(logged()).toContain('step_set: нет перевода: шаг «2-tower» (Башня — 82 метра)')
    expect(fs.existsSync(artifact('.review-task.json'))).toBe(false)
  })

  it('кириллица в польском переводе — отказ с названием шага и правила', async () => {
    const broken = makePolishTranslation()
    broken.steps[1].hint = 'Барельеф bardzo wysoko, pod dachem bramy.'
    await prepareAndTranslate(broken)
    await expect(cli(['check', ...QUEST])).rejects.toThrow('не пройдено проверок: 1')
    expect(logged()).toMatch(/ОТКАЗ шаг «1-gate»/)
    expect(logged()).toContain('script: шаг «1-gate» (Флорианские ворота — страж на рубеже): кириллица вне цитат в полях hint')
  })

  it('без задания и без файла перевода — понятный отказ', async () => {
    await expect(cli(['check', ...QUEST])).rejects.toThrow('сначала prepare')
    await cli(['prepare', ...QUEST])
    await expect(cli(['check', ...QUEST])).rejects.toThrow('нет файла перевода')
  })

  it('отказ проверяющего делает check красным', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation(), false)
    await expect(cli(['check', ...QUEST])).rejects.toThrow('не пройдено проверок: 4')
    expect(logged()).toContain('semantic: смысл искажён')
  })
})

describe('upload', () => {
  it('по умолчанию пишет черновик: тело без служебных полей, статус draft', async () => {
    await prepareAndTranslate()
    await cli(['upload', ...QUEST])
    expect(stored()).toMatchObject({ title: 'Quest po Krakowie: demo', status: 'draft' })
    expect(stored()!.steps.map((step: Json) => step.step_id)).toEqual([INTRO_ID, GATE_ID, TOWER_ID])
    expect(Object.keys(stored()!).sort()).toEqual(['finale', 'status', 'steps', 'title'])
    expect(stored()!.steps[1]).not.toHaveProperty('checks')
    expect(logged()).toContain('записан как draft')
  })

  it('--publish без вердикта смысловой проверки не делает запроса записи', async () => {
    await prepareAndTranslate()
    await expect(cli(['upload', ...QUEST, '--publish'])).rejects.toThrow('смысловая проверка не проведена')
    expect(writes()).toEqual([])
  })

  it('--publish при зелёных проверках публикует; правка после проверки публикацию закрывает', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation())
    await cli(['upload', ...QUEST, '--publish'])
    expect(stored()!.status).toBe('published')

    const edited = makePolishTranslation()
    edited.steps[1].answer_variants.push('orzełek')
    writeArtifact('.json', edited)
    requests = []
    await expect(cli(['upload', ...QUEST, '--publish'])).rejects.toThrow('другой версии перевода')
    expect(writes()).toEqual([])
    // Задание проверяющему уже от новой версии — повторная проверка возможна без ручной чистки.
    expect(readArtifact('.review-task.json').translation_sha256).toBe(
      reviewDigest({ task: readArtifact('.task.json'), translation: edited }),
    )
  })

  it('перевод с потерянным шагом не пишется даже черновиком', async () => {
    const broken = makePolishTranslation()
    broken.steps.pop()
    await prepareAndTranslate(broken)
    await expect(cli(['upload', ...QUEST])).rejects.toThrow('запись черновика закрыта')
    expect(writes()).toEqual([])
  })

  it('опубликованный перевод черновиком не затирается без --publish', async () => {
    await prepareAndTranslate()
    translations.set('7:pl', { ...makePolishTranslation(), status: 'published' })
    await expect(cli(['upload', ...QUEST])).rejects.toThrow('снимет его с показа')
    // --force — про ручные шаги: снять перевод с показа он не разрешает.
    await expect(cli(['upload', ...QUEST, '--force'])).rejects.toThrow('снимет его с показа')
    await expect(cli(['upload', ...QUEST, '--publish', '--unpublish'])).rejects.toThrow(UsageError)
    expect(stored()!.status).toBe('published')
    expect(writes()).toEqual([])

    await cli(['upload', ...QUEST, '--unpublish'])
    expect(stored()!.status).toBe('draft')
  })

  it('ручной перевод шага на сервере сохраняется; --force его перезаписывает', async () => {
    const human = makePolishTranslation()
    human.steps[1] = { ...human.steps[1], task: 'Ręcznie poprawione zadanie.', origin: 'human' }
    translations.set('7:pl', { ...human, status: 'draft' })
    await prepareAndTranslate()

    await cli(['upload', ...QUEST])
    expect(stored()!.steps[1]).toMatchObject({ task: 'Ręcznie poprawione zadanie.', origin: 'human' })
    expect(logged()).toContain(`ручной перевод сохранён в шагах ${GATE_ID}`)

    await cli(['upload', ...QUEST, '--force'])
    expect(stored()!.steps[1]).toMatchObject({ origin: 'machine' })
    expect(stored()!.steps[1].task).toContain('Jaki ptak')
  })

  it('отказ сервера 400 показывает причину и недостающие шаги, а не «успех»', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation())
    sourceStepIds = [INTRO_ID, GATE_ID, TOWER_ID, 73]
    await expect(cli(['upload', ...QUEST, '--publish'])).rejects.toThrow('сервер отклонил перевод: missing_steps (steps); missing_step_ids: 73')
    expect(stored()).toBeUndefined()
  })
})

describe('sweep', () => {
  const printed = () => JSON.parse(stdoutSpy.mock.calls.map((call) => call[0]).join(''))
  const pairOf = (report: Json, locale: string, questId = 'demo-quest') =>
    report.pairs.find((pair: Json) => pair.quest_id === questId && pair.locale === locale)
  const prepareLocale = async (locale: string, translation: unknown = null) => {
    await cli(['prepare', '--quest', 'demo-quest', '--locale', locale])
    if (translation) fs.writeFileSync(artifact('.json', locale), JSON.stringify(translation))
  }

  it('одна волна: готовая пара публикуется, остальные получают состояние по месту в конвейере', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation())
    // Польский текст проходит структурные проверки и для en: ни кириллицы, ни потерь.
    await prepareLocale('en', makePolishTranslation())
    await prepareLocale('be')
    requests = []
    await cli(['sweep', 'demo-quest', '--json'])
    const report = printed()
    expect(report.quests).toEqual(['demo-quest'])
    expect(report.summary).toEqual({ no_task: 1, awaiting_translation: 1, needs_review: 1, published: 1 })
    expect(report.failed).toBe(0)
    expect(pairOf(report, 'pl')).toMatchObject({ status: 'published', details: ['опубликован, шагов 3'] })
    expect(pairOf(report, 'en')).toMatchObject({ status: 'needs_review', details: [expect.stringContaining('нет вердикта')] })
    expect(pairOf(report, 'en').details[0]).toContain('en/demo-quest.review-task.json')
    expect(pairOf(report, 'be')).toMatchObject({ status: 'awaiting_translation', details: [expect.stringContaining('be/demo-quest.json')] })
    expect(pairOf(report, 'uk')).toMatchObject({ status: 'no_task', details: [expect.stringContaining('prepare')] })
    expect(writes()).toEqual(['PUT /api/quests/7/translations/pl/'])
    expect(stored()!.status).toBe('published')
    // Задание проверяющему для en уже лежит рядом — его и отдают агенту.
    expect(fs.existsSync(artifact('.review-task.json', 'en'))).toBe(true)
  })

  it('повторная волна пропускает опубликованную пару по статусу сервера: ни проверок, ни записи', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation())
    await cli(['sweep', 'demo-quest', '--json'])
    fs.unlinkSync(artifact('.review-task.json'))
    requests = []
    stdoutSpy.mockClear()
    await cli(['sweep', 'demo-quest', '--json'])
    expect(pairOf(printed(), 'pl')).toMatchObject({ status: 'published', details: ['уже опубликован на сервере'] })
    expect(requests).toContain('GET /api/quests/7/translations/pl/')
    expect(writes()).toEqual([])
    expect(fs.existsSync(artifact('.review-task.json'))).toBe(false)
  })

  it('старый вердикт после повторного перевода — needs_review, а не отказ проверяющего', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation())
    const retranslated = makePolishTranslation()
    retranslated.steps[1].hint = 'Płaskorzeźba jest wysoko, tuż pod dachem bramy.'
    writeArtifact('.json', retranslated)
    await cli(['sweep', 'demo-quest', '--json'])
    const report = printed()
    expect(pairOf(report, 'pl')).toMatchObject({ status: 'needs_review', details: [expect.stringContaining('другой версии')] })
    expect(report.failed).toBe(0)
    expect(writes()).toEqual([])
    expect(readArtifact('.review-task.json').translation_sha256).toBe(
      reviewDigest({ task: readArtifact('.task.json'), translation: retranslated }),
    )
  })

  it('отказ проверяющего и структурный отказ — красные строки с причиной и ненулевой выход', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation(), false)
    const broken = makePolishTranslation()
    broken.steps[1].hint = 'Барельеф bardzo wysoko, pod dachem bramy.'
    await prepareLocale('en', broken)
    await expect(cli(['sweep', 'demo-quest'])).rejects.toThrow('2 из 4 пар с отказом')
    expect(logged()).toMatch(/demo-quest\s+pl\s+review_refused\s+semantic: смысл искажён; semantic: смысл искажён \(и ещё 2\)/)
    expect(logged()).toMatch(/demo-quest\s+en\s+struct_fail\s+script: шаг «1-gate» \(Флорианские ворота — страж на рубеже\): кириллица/)
    expect(logged()).toContain('Итого: no_task 2, struct_fail 1, review_refused 1')
    expect(writes()).toEqual([])
  })

  it('отказ сервера при публикации — upload_failed с причиной сервера, остальные пары не теряются', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation())
    sourceStepIds = [INTRO_ID, GATE_ID, TOWER_ID, 73]
    await expect(cli(['sweep', 'demo-quest', '--json'])).rejects.toThrow(ExpectedFailureError)
    const report = printed()
    expect(pairOf(report, 'pl')).toMatchObject({ status: 'upload_failed', details: [expect.stringContaining('missing_step_ids: 73')] })
    expect(report.summary).toEqual({ no_task: 3, upload_failed: 1 })
    expect(stored()).toBeUndefined()
  })

  it('квест правили после prepare: задание от прежней версии — no_task, перевод прежнего текста не публикуется', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation())
    bundlePatch = { title: 'Квест по Кракову: демо, новая редакция' }
    requests = []
    await cli(['sweep', 'demo-quest', '--json'])
    const report = printed()
    expect(pairOf(report, 'pl')).toMatchObject({ status: 'no_task', details: [expect.stringContaining('прежней версии источника')] })
    expect(report.failed).toBe(0)
    expect(writes()).toEqual([])
    // Источник читается один раз на квест, а не на каждую пару.
    expect(requests.filter((line) => line === 'GET /api/quests/by-quest-id/demo-quest/')).toHaveLength(1)
  })

  it('задание от прежней версии без перевода — no_task до того, как переводчик переведёт старый текст', async () => {
    await prepareLocale('en')
    bundlePatch = { title: 'Квест по Кракову: демо, новая редакция' }
    await cli(['sweep', 'demo-quest', '--json'])
    expect(pairOf(printed(), 'en')).toMatchObject({ status: 'no_task', details: [expect.stringContaining('прежней версии источника')] })
  })

  it('задание от прежней версии при полном опубликованном переводе — published, а не круг «prepare»', async () => {
    await prepareAndTranslate()
    translations.set('7:pl', { ...makePolishTranslation(), status: 'published' })
    bundlePatch = { title: 'Квест по Кракову: демо, новая редакция' }
    fs.unlinkSync(artifact('.json'))
    await cli(['sweep', 'demo-quest', '--json'])
    expect(pairOf(printed(), 'pl')).toMatchObject({
      status: 'published',
      details: [expect.stringMatching(/^уже опубликован на сервере; .*прежней версии источника/)],
    })
    expect(writes()).toEqual([])
  })

  it('квест, которого сервер не отдаёт, — error этой пары с причиной; отчёт и остальные пары на месте', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation())
    fs.mkdirSync(path.join(workDir, 'pl'), { recursive: true })
    fs.copyFileSync(artifact('.task.json'), path.join(workDir, 'pl', 'second-quest.task.json'))
    fs.copyFileSync(artifact('.json'), path.join(workDir, 'pl', 'second-quest.json'))
    await expect(cli(['sweep', 'second-quest', 'demo-quest', '--json'])).rejects.toThrow('1 из 8 пар с отказом')
    const report = printed()
    expect(pairOf(report, 'pl', 'second-quest')).toMatchObject({ status: 'error', details: ['квест second-quest не найден'] })
    expect(pairOf(report, 'pl')).toMatchObject({ status: 'published' })
    expect(report.summary).toEqual({ no_task: 6, error: 1, published: 1 })
    expect(writes()).toEqual(['PUT /api/quests/7/translations/pl/'])
    // Отказ сервера по квесту тоже один на все локали, а не повтор на каждую пару.
    expect(requests.filter((line) => line === 'GET /api/quests/by-quest-id/second-quest/')).toHaveLength(1)
  })

  it('устаревший на сервере шаг при том же тексте записывается заново: сервер узнаёт о проверке по новому источнику', async () => {
    translations.set('7:pl', { ...makePolishTranslation(), status: 'published' })
    staleStepIds = [TOWER_ID]
    await cli(['prepare', ...QUEST])
    expect(readArtifact('.task.json')).toMatchObject({ mode: 'incremental', translate_step_ids: [TOWER_ID] })
    writeArtifact('.json', makePolishTranslation())
    writeReview(makePolishTranslation())
    requests = []
    await cli(['sweep', 'demo-quest', '--json'])
    expect(pairOf(printed(), 'pl')).toMatchObject({ status: 'published', details: ['опубликован, шагов 3'] })
    expect(writes()).toEqual(['PUT /api/quests/7/translations/pl/'])
  })

  it('ручные шаги на сервере: если документ не изменился бы, пара опубликована без записи', async () => {
    await prepareAndTranslate()
    writeReview(makePolishTranslation())
    const human = makePolishTranslation()
    human.steps[1] = { ...human.steps[1], task: 'Ręcznie poprawione zadanie.', origin: 'human' }
    translations.set('7:pl', { ...human, status: 'published' })
    await cli(['sweep', 'demo-quest', '--json'])
    expect(pairOf(printed(), 'pl')).toMatchObject({ status: 'published', details: ['уже опубликован на сервере'] })
    expect(writes()).toEqual([])
    expect(stored()!.steps[1].origin).toBe('human')
  })

  it('пара без задания: полный опубликованный перевод на сервере — published, неполный — no_task', async () => {
    // `prepare` на полном опубликованном переводе задания не создаёт — совет «prepare» был бы пустым кругом.
    translations.set('7:uk', { ...makePolishTranslation(), status: 'published' })
    const partial = makePolishTranslation()
    partial.steps = partial.steps.filter((step: Json) => step.step_id !== TOWER_ID)
    translations.set('7:en', { ...partial, status: 'published' })
    await cli(['sweep', 'demo-quest', '--json'])
    const report = printed()
    expect(pairOf(report, 'uk')).toMatchObject({ status: 'published', details: ['уже опубликован на сервере'] })
    expect(pairOf(report, 'en')).toMatchObject({ status: 'no_task', details: [expect.stringContaining('prepare')] })
    expect(report.summary).toEqual({ no_task: 3, published: 1 })
    expect(requests.filter((line) => line.includes('/translations/') && !line.includes('/status/'))).toEqual([])
  })

  it('битый вердикт проверяющего — отказ этой пары с путём файла, остальные пары в отчёте', async () => {
    await prepareAndTranslate()
    fs.writeFileSync(artifact('.review.json'), '{"verdicts": [')
    await expect(cli(['sweep', 'demo-quest', '--json'])).rejects.toThrow('1 из 4 пар с отказом')
    const report = printed()
    expect(pairOf(report, 'pl')).toMatchObject({ status: 'struct_fail', details: [expect.stringContaining('pl/demo-quest.review.json — не JSON')] })
    expect(report.summary).toEqual({ no_task: 3, struct_fail: 1 })
    expect(writes()).toEqual([])
  })

  it('--from-next берёт квесты из выборки next; пустая выборка — ненулевой выход, а не зелёный отчёт', async () => {
    await cli(['sweep', '--from-next', '1', '--order', 'catalog', '--json'])
    const report = printed()
    expect(report.quests).toEqual(['second-quest'])
    expect(report.pairs.map((pair: Json) => [pair.locale, pair.status])).toEqual([
      ['be', 'no_task'],
      ['uk', 'no_task'],
      ['pl', 'no_task'],
      ['en', 'no_task'],
    ])
    expect(requests.filter((line) => line.includes('/translations/status/'))).toHaveLength(1)

    for (const code of ['be', 'uk', 'pl', 'en']) {
      translations.set(`9:${code}`, { status: 'published', steps: [] })
      translations.set(`7:${code}`, { ...makePolishTranslation(), status: 'published' })
    }
    await expect(cli(['sweep', '--from-next', '5', '--order', 'catalog'])).rejects.toThrow(EmptySelectionError)
    expect(writes()).toEqual([])
  })
})

describe('next, status, city-name', () => {
  const printed = () => JSON.parse(stdoutSpy.mock.calls.map((call) => call[0]).join(''))

  it('next возвращает квесты без полного перевода в каталожном порядке и города без названия', async () => {
    await cli(['next', '--count', '10', '--order', 'catalog', '--json'])
    const result = printed()
    expect(result).toMatchObject({ order: 'catalog', remaining: 2 })
    expect(result.quests.map((quest: Json) => quest.quest_id)).toEqual(['second-quest', 'demo-quest'])
    expect(result.quests[0].locales).toEqual({ be: 'missing', uk: 'missing', pl: 'missing', en: 'missing' })
    expect(result.cities).toEqual([
      { city_id: 1, name: 'Краков', locales: ['be', 'uk', 'pl', 'en'] },
      { city_id: 2, name: 'Минск', locales: ['be', 'uk', 'pl', 'en'] },
    ])
  })

  it('next соблюдает --count и не возвращает квест, опубликованный на всех локалях', async () => {
    for (const code of ['be', 'uk', 'pl', 'en']) translations.set(`9:${code}`, { status: 'published', steps: [] })
    cityNames.set('1:pl', 'Kraków')
    staleStepIds = [GATE_ID]
    translations.set('7:en', { ...makePolishTranslation(), status: 'published' })
    await cli(['next', '--count', '1', '--order', 'catalog', '--json'])
    const result = printed()
    expect(result.remaining).toBe(1)
    expect(result.quests).toHaveLength(1)
    expect(result.quests[0]).toMatchObject({ quest_id: 'demo-quest', locales: { be: 'missing', uk: 'missing', pl: 'missing', en: 'published, stale 1' } })
    expect(result.cities).toEqual([{ city_id: 1, name: 'Краков', locales: ['be', 'uk', 'en'] }])
  })

  it('status считает published/draft/missing/stale по квестам каталога', async () => {
    translations.set('7:pl', { ...makePolishTranslation(), status: 'published' })
    translations.set('9:pl', { status: 'draft', steps: [] })
    staleStepIds = [TOWER_ID]
    await cli(['status', '--json'])
    const summary = printed()
    expect(summary.map((row: Json) => row.locale)).toEqual(['be', 'uk', 'pl', 'en'])
    expect(summary[2]).toEqual({ locale: 'pl', quests: 2, published: 1, draft: 1, missing: 0, stale: 1, incomplete: 0 })
    expect(summary[0]).toMatchObject({ published: 0, draft: 0, missing: 2 })
  })

  it('city-name пишет название города на локали', async () => {
    await cli(['city-name', '--city', '1', '--locale', 'pl', '--name', 'Kraków'])
    expect(cityNames.get('1:pl')).toBe('Kraków')
    expect(writes()).toEqual(['PUT /api/quest-cities/1/translations/pl/'])
  })
})

describe('повтор запроса', () => {
  it('502 во время выката бэка повторяется; запись не теряется и не дублируется логикой', async () => {
    const answers = [502, 503, 200]
    const fetchImpl = jest.fn(async (..._args: any[]) => {
      const status = answers.shift()!
      return { status, text: async () => (status === 200 ? '{"title":"ok"}' : 'Bad Gateway') }
    })
    const sleep = jest.fn(async (_ms: number) => {})
    const api = createApi({ apiUrl: 'https://stub.test/', token: TOKEN, fetchImpl, sleep })
    await expect(api.putTranslation(7, 'pl', { title: 'ok' })).resolves.toMatchObject({ status: 200, json: { title: 'ok' } })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map((call) => call[0])).toEqual(RETRY_DELAYS_MS)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://stub.test/api/quests/7/translations/pl/')
  })

  it('исчерпанные повторы возвращают последний ответ как отказ, а не как успех', async () => {
    const fetchImpl = jest.fn(async (..._args: any[]) => ({ status: 503, text: async () => 'down' }))
    const api = createApi({ apiUrl: 'https://stub.test', token: TOKEN, fetchImpl, sleep: async () => {} })
    await expect(api.getStatus('pl')).rejects.toThrow('HTTP 503')
    expect(fetchImpl).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1)
  })
})
