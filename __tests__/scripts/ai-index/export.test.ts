import fs from 'fs'
import path from 'path'

import {
  chunkRawCorpus,
  emptyState,
  planTravelExport,
  RAW_FORMAT_VERSION,
  rawFactsProblem,
  readRawQuests,
  readRawTravels,
  readState,
  runExport,
  type Fetcher,
} from '@/scripts/ai-index/export'
import { buildCorpusFacts, DICTIONARIES_FILE, parseDictionaries, readDictionaries } from '@/scripts/ai-index/facts'

import { sha256Hex } from '@/scripts/ai-index/format'

import { makeTempDir, runCli } from '../cli-test-utils'

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures', 'ai-index', 'raw')
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))

describe('ai-index export: план инкремента статей', () => {
  const list = readJson(path.join(FIXTURES, 'travels-list.json')) as Array<{ id: number; updated_at: string }>

  it('первый запуск читает все опубликованные, неопубликованные не трогает', () => {
    const plan = planTravelExport(list, emptyState())
    expect(plan).toEqual({ fetch: [816, 791, 761], keep: [], remove: [] })
  })

  it('неизменённый updated_at пропускается, изменённый и пропавший из raw — перечитываются, исчезнувшие — удаляются', () => {
    const state = emptyState()
    state.travels = { '816': list[0].updated_at, '791': 'stale', '761': list[2].updated_at, '555': 'gone' }
    const plan = planTravelExport(list, state, { hasRaw: (id) => id !== 761 })
    expect(plan).toEqual({ fetch: [791, 761], keep: [816], remove: [555] })
    expect(planTravelExport(list, state, { full: true }).fetch).toEqual([816, 791, 761])
  })
})

function fakeApi(): { fetcher: Fetcher; calls: string[] } {
  const calls: string[] = []
  const list = readJson(path.join(FIXTURES, 'travels-list.json'))
  const quests = ['1.ru', '1.pl', '2.ru'].map((name) => readJson(path.join(FIXTURES, 'quests', `${name}.json`)))
  const questList = [
    { ...quests[0], available_locales: ['ru', 'pl'] },
    { ...quests[2], available_locales: ['ru'] },
  ].map((quest) => {
    const meta = { ...quest }
    delete meta.steps
    delete meta.intro
    delete meta.finale_text
    return meta
  })
  const fetcher: Fetcher = async (url: string) => {
    calls.push(url)
    const parsed = new URL(url)
    if (parsed.pathname === '/api/travels/') return { count: list.length, next: null, results: list }
    if (parsed.pathname === '/api/quests/') return { count: questList.length, next: null, results: questList }
    const travel = parsed.pathname.match(/^\/api\/travels\/(\d+)\/$/)
    if (travel) {
      const id = Number(travel[1])
      if (id === 999) return { id, publish: true, moderation: false, description: '<p>черновик</p>' }
      return readJson(path.join(FIXTURES, 'travels', `${id}.json`))
    }
    const quest = parsed.pathname.match(/^\/api\/quests\/(\d+)\/$/)
    if (quest) {
      const lang = parsed.searchParams.get('lang')
      const found = quests.find((item) => item.id === Number(quest[1]) && item.content_locale === lang)
      if (!found) throw new Error(`no fixture for ${url}`)
      return { ...found, finale: { text: found.finale_text } }
    }
    throw new Error(`unexpected ${url}`)
  }
  return { fetcher, calls }
}

describe('ai-index export: прогон на фикстурах', () => {
  let rawDir: string
  beforeEach(() => {
    rawDir = makeTempDir('ai-index-export-')
  })
  afterEach(() => {
    fs.rmSync(rawDir, { recursive: true, force: true })
  })

  it('пишет raw-файлы, state и повторный запуск не перечитывает статьи', async () => {
    const api = fakeApi()
    const log: string[] = []
    const first = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: (l) => log.push(l) })
    expect(first.travels).toEqual({ listed: 4, fetched: 3, kept: 0, removed: 0 })
    expect(first.quests).toEqual({ listed: 2, fetched: 3, changed: 3, removed: 0 })
    expect(fs.readdirSync(path.join(rawDir, 'travels')).sort()).toEqual(['761.json', '791.json', '816.json'])
    expect(fs.readdirSync(path.join(rawDir, 'quests')).sort()).toEqual(['1.pl.json', '1.ru.json', '2.ru.json'])
    expect(api.calls.filter((url) => url.includes('/travels/') && !url.includes('page='))).toHaveLength(3)
    expect(api.calls.some((url) => url.endsWith('/quests/1/?lang=pl'))).toBe(true)
    expect(api.calls.find((url) => url.includes('/travels/?'))).toContain('page_size=50')

    const state = readState(rawDir)
    expect(Object.keys(state.travels).sort()).toEqual(['761', '791', '816'])
    expect(Object.keys(state.quests).sort()).toEqual(['1:pl', '1:ru', '2:ru'])

    const stored = readRawTravels(rawDir)
    expect(stored.map((t) => t.id)).toEqual([761, 791, 816])
    expect(stored[0]).not.toHaveProperty('gallery')
    expect(readRawQuests(rawDir).map((q) => `${q.id}.${q.content_locale}`)).toEqual(['1.pl', '1.ru', '2.ru'])

    api.calls.length = 0
    const second = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
    expect(second.travels).toEqual({ listed: 4, fetched: 0, kept: 3, removed: 0 })
    expect(second.quests.changed).toBe(0)
    expect(api.calls.filter((url) => /\/travels\/\d+\/$/.test(url))).toHaveLength(0)
  })

  it('--full перечитывает всё, пропавший источник удаляется из raw и state', async () => {
    const api = fakeApi()
    await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
    const full = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, full: true, log: () => {} })
    expect(full.travels.fetched).toBe(3)

    const state = readState(rawDir)
    state.travels['555'] = '2020-01-01T00:00:00Z'
    state.quests['9:ru'] = 'deadbeef'
    fs.writeFileSync(path.join(rawDir, 'travels', '555.json'), '{}')
    fs.writeFileSync(path.join(rawDir, 'quests', '9.ru.json'), '{}')
    fs.writeFileSync(path.join(rawDir, 'state.json'), JSON.stringify(state))
    const cleaned = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
    expect(cleaned.travels.removed).toBe(1)
    expect(cleaned.quests.removed).toBe(1)
    expect(fs.existsSync(path.join(rawDir, 'travels', '555.json'))).toBe(false)
    expect(fs.existsSync(path.join(rawDir, 'quests', '9.ru.json'))).toBe(false)
  })

  it('--full и файлы raw вне state тоже чистятся, --limit не удаляет то, чего не видел', async () => {
    const api = fakeApi()
    await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
    // Источники, снятые с сайта: один учтён в state, другой остался файлом после прерванного прогона.
    const state = readState(rawDir)
    state.travels['555'] = '2020-01-01T00:00:00Z'
    fs.writeFileSync(path.join(rawDir, 'state.json'), JSON.stringify(state))
    for (const name of ['travels/555.json', 'travels/556.json', 'quests/9.ru.json']) {
      fs.writeFileSync(path.join(rawDir, name), '{}')
    }

    const limited = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, limit: 1, log: () => {} })
    expect(limited.travels.removed).toBe(0)
    expect(fs.readdirSync(path.join(rawDir, 'travels')).sort()).toEqual(['555.json', '556.json', '761.json', '791.json', '816.json'])

    const full = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, full: true, log: () => {} })
    expect(full.travels).toMatchObject({ fetched: 3, removed: 2 })
    expect(full.quests).toMatchObject({ changed: 3, removed: 1 })
    expect(fs.readdirSync(path.join(rawDir, 'travels')).sort()).toEqual(['761.json', '791.json', '816.json'])
    expect(fs.readdirSync(path.join(rawDir, 'quests')).sort()).toEqual(['1.pl.json', '1.ru.json', '2.ru.json'])
    expect(Object.keys(readState(rawDir).travels).sort()).toEqual(['761', '791', '816'])
  })

  it('узкий --locales читает только свои локали и не удаляет raw чужих', async () => {
    const api = fakeApi()
    await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
    api.calls.length = 0
    const ruOnly = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, locales: ['ru'], log: () => {} })
    expect(ruOnly.quests).toMatchObject({ fetched: 2, removed: 0 })
    expect(api.calls.some((url) => url.includes('lang=pl'))).toBe(false)
    expect(fs.existsSync(path.join(rawDir, 'quests', '1.pl.json'))).toBe(true)
    expect(Object.keys(readState(rawDir).quests).sort()).toEqual(['1:pl', '1:ru', '2:ru'])
  })

  it('chunkRawCorpus нарезает raw и фильтрует квесты по локали', async () => {
    const api = fakeApi()
    await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
    const all = chunkRawCorpus(rawDir)
    expect(all.travels).toBe(3)
    expect(all.quests).toBe(3)
    expect(all.chunks.filter((c) => c.locale === 'pl').length).toBeGreaterThan(0)
    const ru = chunkRawCorpus(rawDir, {}, ['ru'])
    expect(ru.quests).toBe(2)
    expect(ru.chunks.every((c) => c.locale === 'ru')).toBe(true)
    expect(ru.chunks.length).toBeLessThan(all.chunks.length)
  })
})

// #3287: факты источника для карточки ассистента идут тем же путём, что и текст: каталог → raw → артефакт.
describe('ai-index export: факты источников (#3287)', () => {
  let rawDir: string
  beforeEach(() => {
    rawDir = makeTempDir('ai-index-export-facts-')
  })
  afterEach(() => {
    fs.rmSync(rawDir, { recursive: true, force: true })
  })

  const QUEST_FACTS: Record<number, Record<string, unknown>> = {
    1: { points: 11, duration_min: 120, difficulty: 'easy', pet_friendly: true },
    2: { points: '6', duration_min: 90, difficulty: 'medium', pet_friendly: false },
  }
  const TRAVEL_FACTS: Record<number, Record<string, unknown>> = {
    816: { number_days: 3, transports: [1, 9] },
    791: { number_days: null, transports: [] },
    761: { number_days: 1, transports: [404] },
  }
  const DICTIONARY = {
    transports: [{ id: 1, name: 'Машина' }, { id: 9, name: 'Поезд' }, { id: 5, name: ' ' }],
    categories: [{ id: 19, name: 'Ярмарки' }, { id: 14, name: 'Города' }],
    month: [{ id: 1, name: 'Январь' }],
  }

  /** Тот же каталог, что у `fakeApi`, с полями фактов в списке квестов, деталях статей и словаре. */
  function factsApi(options: { dictionary?: boolean } = {}) {
    const api = fakeApi()
    const fetcher: Fetcher = async (url: string) => {
      const { pathname } = new URL(url)
      if (pathname === '/api/getFiltersTravel/') {
        api.calls.push(url)
        if (options.dictionary === false) throw new Error('HTTP 502')
        return DICTIONARY
      }
      const data = (await api.fetcher(url)) as Record<string, unknown>
      if (pathname === '/api/quests/') {
        return { ...data, results: (data.results as Array<{ id: number }>).map((quest) => ({ ...quest, ...QUEST_FACTS[quest.id] })) }
      }
      const travel = /^\/api\/travels\/(\d+)\/$/.exec(pathname)
      return travel ? { ...data, ...TRAVEL_FACTS[Number(travel[1])] } : data
    }
    return { fetcher, calls: api.calls }
  }

  it('экспорт кладёт в raw поля фактов квеста и статьи и словарь каталога; chunkRawCorpus отдаёт запись на источник', async () => {
    const api = factsApi()
    await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
    expect(readRawQuests(rawDir).map((quest) => [quest.id, quest.content_locale, quest.points, quest.duration_min, quest.difficulty, quest.pet_friendly])).toEqual([
      [1, 'pl', 11, 120, 'easy', true],
      [1, 'ru', 11, 120, 'easy', true],
      [2, 'ru', '6', 90, 'medium', false],
    ])
    expect(readRawTravels(rawDir).map((travel) => [travel.id, travel.number_days, travel.transports])).toEqual([
      [761, 1, [404]],
      [791, null, []],
      [816, 3, [1, 9]],
    ])
    expect(readDictionaries(rawDir)).toEqual({ transports: { 1: 'Машина', 9: 'Поезд' }, categories: { 19: 'Ярмарки', 14: 'Города' } })
    expect(readState(rawDir).raw_version).toBe(RAW_FORMAT_VERSION)

    const { facts, chunks } = chunkRawCorpus(rawDir)
    // Квест 1 лежит на двух локалях — запись одна; id транспорта без названия в словаре в запись не идёт.
    expect(facts).toEqual([
      { type: 'travel', source_id: 761, number_days: 1, months: [9, 10] },
      { type: 'travel', source_id: 791, months: [10] },
      { type: 'travel', source_id: 816, number_days: 3, months: [11, 12], transports: ['Машина', 'Поезд'], categories: ['Ярмарки', 'Города'] },
      { type: 'quest', source_id: 1, points: 11, duration_min: 120, difficulty: 'easy', pet_friendly: true },
      { type: 'quest', source_id: 2, points: 6, duration_min: 90, difficulty: 'medium', pet_friendly: false, audience: 'family' },
    ])
    expect(new Set(chunks.map((chunk) => `${chunk.type}:${chunk.source_id}`)).size).toBe(facts.length)
  })

  it('слепок прежней версии полей перечитывает все статьи один раз; следующий запуск снова инкрементален', async () => {
    const api = factsApi()
    await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
    // Слепок, собранный до #3287: в state нет версии, в файлах статей нет полей фактов.
    const { raw_version: _version, ...legacy } = readState(rawDir)
    fs.writeFileSync(path.join(rawDir, 'state.json'), JSON.stringify(legacy))
    const log: string[] = []
    const migrated = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: (line) => log.push(line) })
    expect(migrated.travels).toMatchObject({ fetched: 3, kept: 0 })
    expect(log.join('\n')).toMatch(/перечитываются все статьи/)
    const next = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
    expect(next.travels).toMatchObject({ fetched: 0, kept: 3 })
  })

  it('#3287: слепок, выгруженный до поезда, фактам не годится — `facts` отказывает и артефакт не трогает; обычный export его перечитывает', async () => {
    const outDir = makeTempDir('ai-index-facts-')
    const legacyRaw = path.join(outDir, 'raw')
    try {
      const api = factsApi()
      await runExport({ rawDir: legacyRaw, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
      expect(rawFactsProblem(legacyRaw)).toBeNull()

      // Слепок до #3287: в state нет версии, в файлах квестов и статей нет полей фактов, отпечатки — от старых файлов.
      const { raw_version: _version, ...state } = readState(legacyRaw)
      for (const name of fs.readdirSync(path.join(legacyRaw, 'quests'))) {
        const file = path.join(legacyRaw, 'quests', name)
        const { points: _points, duration_min: _duration, difficulty: _difficulty, pet_friendly: _pet, ...old } = readJson(file)
        fs.writeFileSync(file, JSON.stringify(old))
        const [id, locale] = name.split('.')
        state.quests[`${id}:${locale}`] = sha256Hex(JSON.stringify(old))
      }
      for (const name of fs.readdirSync(path.join(legacyRaw, 'travels'))) {
        const file = path.join(legacyRaw, 'travels', name)
        const { number_days: _days, ...old } = readJson(file)
        fs.writeFileSync(file, JSON.stringify(old))
      }
      fs.writeFileSync(path.join(legacyRaw, 'state.json'), JSON.stringify(state))
      expect(rawFactsProblem(legacyRaw)).toMatch(/версии 1, фактам нужна 2/)
      // Именно такой слепок давал записи без чисел: у квестов оставалась одна аудитория по тегам.
      expect(chunkRawCorpus(legacyRaw).facts.every((record) => !('duration_min' in record) && !('points' in record) && !('number_days' in record))).toBe(true)

      // Версия в state есть, а полей в файлах нет (слепок подправили руками) — тоже отказ.
      fs.writeFileSync(path.join(legacyRaw, 'state.json'), JSON.stringify({ ...state, raw_version: RAW_FORMAT_VERSION }))
      expect(rawFactsProblem(legacyRaw)).toMatch(/нет полей фактов/)
      fs.writeFileSync(path.join(legacyRaw, 'state.json'), JSON.stringify(state))

      // Команда: ненулевой код, подсказка чем перечитать raw, файла фактов в артефакте нет.
      const run = runCli(
        process.execPath,
        ['--import', './scripts/lib/ts-runtime.mjs', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/ai-index/build.ts', 'facts', '--out', outDir],
        { cwd: process.cwd() },
      )
      expect(run.status).toBe(1)
      expect(run.stderr).toMatch(/facts: raw-слепок .* версии 1, фактам нужна 2/)
      expect(run.stderr).toContain(`npm run ai:index -- export --out ${outDir}`)
      expect(run.stdout.trim()).toBe('')
      expect(fs.existsSync(path.join(outDir, 'dist', 'facts.jsonl'))).toBe(false)

      // Обычный инкрементальный export на таком слепке сам перечитывает статьи и квесты — после него факты с числами.
      const migrated = await runExport({ rawDir: legacyRaw, apiBase: 'https://example.test/api', fetcher: api.fetcher, log: () => {} })
      expect(migrated.travels).toMatchObject({ fetched: 3, kept: 0 })
      expect(migrated.quests.changed).toBe(3)
      expect(rawFactsProblem(legacyRaw)).toBeNull()
      expect(chunkRawCorpus(legacyRaw).facts).toContainEqual({ type: 'quest', source_id: 1, points: 11, duration_min: 120, difficulty: 'easy', pet_friendly: true })
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  })

  it('--limit версию слепка не подтверждает; сбой словаря экспорт не роняет и оставляет прежний файл', async () => {
    const limited = factsApi()
    await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: limited.fetcher, limit: 1, log: () => {} })
    expect(readState(rawDir).raw_version).toBeUndefined()

    await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: factsApi().fetcher, log: () => {} })
    const saved = fs.readFileSync(path.join(rawDir, DICTIONARIES_FILE), 'utf8')
    const log: string[] = []
    const broken = await runExport({ rawDir, apiBase: 'https://example.test/api', fetcher: factsApi({ dictionary: false }).fetcher, log: (line) => log.push(line) })
    expect(broken.travels.kept).toBe(3)
    expect(log.join('\n')).toMatch(/dictionaries: словарь каталога не получен/)
    expect(fs.readFileSync(path.join(rawDir, DICTIONARIES_FILE), 'utf8')).toBe(saved)
  })

  it('словарь и факты читаются из кривых значений без падения: пустые поля в запись не попадают', () => {
    expect(parseDictionaries(null)).toEqual({ transports: {}, categories: {} })
    expect(parseDictionaries({ transports: 'нет', categories: [{ id: null, name: 'Без id' }, { id: 3 }] })).toEqual({ transports: {}, categories: {} })
    expect(readDictionaries(rawDir)).toEqual({ transports: {}, categories: {} })
    expect(
      buildCorpusFacts(
        [{ id: 5, slug: 'a', number_days: '0', month: ['13', 'май', 2, 2], transports: null, categories: [7] }],
        [{ id: 9, points: 'много', duration_min: 0, difficulty: 'extreme', pet_friendly: null, tags: ['kids', 'age-5-7', 'age-8-10', 'adult-required'] }],
      ),
    ).toEqual([
      { type: 'travel', source_id: 5, months: [2] },
      { type: 'quest', source_id: 9, audience: 'kids', age: [5, 10], adult: true },
    ])
  })
})
