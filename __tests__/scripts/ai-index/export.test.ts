import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  chunkRawCorpus,
  emptyState,
  planTravelExport,
  readRawQuests,
  readRawTravels,
  readState,
  runExport,
  type Fetcher,
} from '@/scripts/ai-index/export'

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
    rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-index-export-'))
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
