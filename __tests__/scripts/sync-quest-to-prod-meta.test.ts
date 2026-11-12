/**
 * Regression tests for scripts/sync-quest-to-prod.js — перенос меты квеста (#3373).
 *
 * Мета (точка старта, длительность, сложность, теги, pet_friendly) писалась
 * только при создании квеста, и у pinsk-polesie после переписывания старт на
 * проде остался в 869 м от файла. Прогон идёт настоящим CLI по HTTP-стабу:
 * проверяется состояние «прода» после запуска, а не факт отправленного запроса.
 */

import http from 'http'
import path from 'path'

import { makeTempDir, removeDir, runNodeCli, startStubServer, writeTextFile, type StubServer } from './cli-test-utils'

const SCRIPT = path.resolve(process.cwd(), 'scripts', 'sync-quest-to-prod.js')

// Как на проде: шаговый бандл меты не несёт, она живёт в строке каталога города.
// `freezeMeta` — бэкенд, который принимает PATCH и ничего не сохраняет.
const SERVER_SOURCE = `
const http = require('http')
let state = { quests: {}, steps: {}, patches: [], freezeMeta: false }

const body = (req) => new Promise((resolve) => {
  const chunks = []
  req.on('data', (c) => { chunks.push(c) })
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    resolve(raw ? JSON.parse(raw) : {})
  })
})

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
  const url = req.url
  if (req.method === 'PUT' && url === '/__fixture') { state = { patches: [], freezeMeta: false, ...(await body(req)) }; return json(res, 200, {}) }
  if (req.method === 'GET' && url === '/__state') return json(res, 200, state)

  let m = /^\\/api\\/quests\\/by-quest-id\\/([^/]+)\\/$/.exec(url)
  if (m && req.method === 'GET') {
    const quest = Object.values(state.quests).find((q) => q.quest_id === decodeURIComponent(m[1]))
    if (!quest) return json(res, 404, { detail: 'no quest' })
    return json(res, 200, { id: quest.id, quest_id: quest.quest_id, city: { id: quest.city_id }, steps: [], intro: null, finale: null })
  }

  m = /^\\/api\\/quests\\/by-city\\/(\\d+)\\/$/.exec(url)
  if (m && req.method === 'GET') {
    return json(res, 200, Object.values(state.quests).filter((q) => String(q.city_id) === m[1]))
  }

  m = /^\\/api\\/quests\\/(\\d+)\\/$/.exec(url)
  if (m && req.method === 'PATCH') {
    const quest = state.quests[m[1]]
    if (!quest) return json(res, 404, { detail: 'no quest' })
    const payload = await body(req)
    state.patches.push({ id: Number(m[1]), payload })
    if (!state.freezeMeta) {
      for (const [k, v] of Object.entries(payload)) quest[k] = (k === 'lat' || k === 'lng') ? Number(v) : v
    }
    return json(res, 200, quest)
  }

  m = /^\\/api\\/quest-steps\\/(\\d+)\\/$/.exec(url)
  if (m && req.method === 'PATCH') {
    state.patches.push({ step: Number(m[1]), payload: await body(req) })
    return json(res, 200, {})
  }

  return json(res, 404, { detail: 'not found' })
})
server.listen(0, '127.0.0.1', () => console.log('PORT=' + server.address().port))
`

type ProdQuest = {
  id: number
  quest_id: string
  city_id: number
  lat: number
  lng: number
  duration_min: number
  difficulty: string
  tags: Record<string, boolean>
  pet_friendly: boolean
}

type State = {
  quests: Record<string, ProdQuest>
  patches: { id?: number; step?: number; payload: Record<string, unknown> }[]
  freezeMeta?: boolean
}

const PINSK_PROD: ProdQuest = {
  id: 37,
  quest_id: 'pinsk-polesie',
  city_id: 33,
  lat: 52.1135,
  lng: 26.1085,
  duration_min: 90,
  difficulty: 'easy',
  tags: { legend: true, history: true },
  pet_friendly: true,
}

const PINSK_META = {
  lat: 52.120116,
  lng: 26.115276,
  duration_min: 120,
  difficulty: 'easy',
  tags: ['history', 'story'],
  pet_friendly: true,
}

const pinskFile = (meta: Record<string, unknown> | undefined = PINSK_META) => ({
  quest_id: 'pinsk-polesie',
  ...(meta ? { meta } : {}),
  steps: [{ step_id: '1-start', title: 'Старт', location: 'Костёл', story: 'история', task: 'задание', lat: 52.12, lng: 26.11, answer_pattern: { type: 'any', value: '' } }],
})

describe('sync-quest-to-prod: мета квеста (#3373)', () => {
  let server: StubServer
  let origin = ''
  let dir = ''

  const request = (method: string, url: string, payload?: unknown): Promise<string> =>
    new Promise((resolve, reject) => {
      const req = http.request(url, { method }, (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', () => (res.statusCode === 200 ? resolve(raw) : reject(new Error(`HTTP ${res.statusCode} ${method} ${url}`))))
      })
      req.on('error', reject)
      if (payload === undefined) req.end()
      else {
        req.setHeader('Content-Type', 'application/json')
        req.end(JSON.stringify(payload))
      }
    })

  const setFixture = (fixture: Partial<State>) => request('PUT', `${origin}/__fixture`, fixture)
  const readState = async (): Promise<State> => JSON.parse(await request('GET', `${origin}/__state`))
  const prodFixture = () => ({ quests: { [PINSK_PROD.id]: { ...PINSK_PROD, tags: { ...PINSK_PROD.tags } } } })

  let fileSeq = 0
  const run = (quests: unknown[], ...flags: string[]) => {
    const file = path.join(dir, `quests-${++fileSeq}.js`)
    writeTextFile(file, `module.exports = ${JSON.stringify(quests)}\n`)
    return runNodeCli([SCRIPT, `--source-file=${file}`, ...flags, `--api-url=${origin}`, '--token=test'])
  }

  beforeAll(async () => {
    dir = makeTempDir('sync-quest-to-prod-meta-')
    server = await startStubServer(SERVER_SOURCE, dir)
    origin = server.origin
  })

  afterAll(() => {
    server.stop()
    removeDir(dir)
  })

  it('--meta-only --apply пишет только разошедшиеся поля и сверяет результат GET-ом', async () => {
    await setFixture(prodFixture())

    const result = run([pinskFile()], '--meta-only', '--apply')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('meta lat: 52.1135 → 52.120116')
    expect(result.stdout).toContain('meta duration_min: 90 → 120')
    expect(result.stdout).toContain('meta tags: history,legend → history,story')
    expect(result.stdout).toContain('контрольный GET совпал с файлом')
    const state = await readState()
    expect(state.patches).toEqual([{
      id: 37,
      payload: { lat: '52.120116', lng: '26.115276', duration_min: 120, tags: { history: true, story: true } },
    }])
    expect(state.quests[37]).toMatchObject({ lat: 52.120116, lng: 26.115276, duration_min: 120, tags: { history: true, story: true } })
  })

  it('--dry-run печатает «было → стало» и ничего не пишет', async () => {
    await setFixture(prodFixture())

    const result = run([pinskFile()], '--meta-only', '--dry-run')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('meta duration_min: 90 → 120')
    expect(result.stdout).toContain('[DRY] PATCH /api/quests/37/')
    const state = await readState()
    expect(state.patches).toEqual([])
    expect(state.quests[37].duration_min).toBe(90)
  })

  it('совпавшая мета — ни одного PATCH квеста', async () => {
    await setFixture({ quests: { 37: { ...PINSK_PROD, lat: 52.120116, lng: 26.115276, duration_min: 120, tags: { story: true, history: true } } } })

    const result = run([pinskFile()], '--meta-only', '--apply')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('meta совпадает с файлом')
    expect((await readState()).patches).toEqual([])
  })

  it('PATCH принят, а контрольный GET показывает старое — отказ с кодом 1', async () => {
    await setFixture({ ...prodFixture(), freezeMeta: true })

    const result = run([pinskFile()], '--meta-only', '--apply')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('контрольный GET показывает другое')
    expect(result.stderr).toContain('duration_min: файл 120; прод 90')
    expect(result.stdout).not.toContain('Sync завершён')
  })

  it('--meta-only не трогает шаги', async () => {
    await setFixture(prodFixture())
    run([pinskFile()], '--meta-only', '--apply')
    expect((await readState()).patches.some((p) => p.step !== undefined)).toBe(false)
  })

  it('обычный синк без --meta мету не трогает: теги, которые есть только на проде, живы', async () => {
    await setFixture(prodFixture())

    const full = run([pinskFile()], '--apply')

    // Шага 1-start на «проде» нет — это прежний отказ про состав шагов.
    expect(full.status).toBe(1)
    expect(full.stdout).toContain('мета не переносится — для неё нужен --meta или --meta-only')
    const state = await readState()
    expect(state.patches.filter((p) => p.id !== undefined)).toEqual([])
    expect(state.quests[37]).toMatchObject({ duration_min: 90, tags: { legend: true, history: true } })
  })

  it('синк с --meta переносит мету вместе с шагами', async () => {
    await setFixture(prodFixture())

    const full = run([pinskFile()], '--meta', '--apply')

    expect(full.status).toBe(1)
    expect(full.stdout).toContain('контрольный GET совпал с файлом')
    expect((await readState()).quests[37]).toMatchObject({ duration_min: 120, tags: { history: true, story: true } })
  })

  it('поле meta со значением null на прод не уходит', async () => {
    await setFixture(prodFixture())

    const result = run([pinskFile({ ...PINSK_META, lat: null, lng: null })], '--meta-only', '--apply')

    expect(result.status).toBe(0)
    const [patch] = (await readState()).patches
    expect(patch.payload).not.toHaveProperty('lat')
    expect(patch.payload).not.toHaveProperty('lng')
  })

  it('--meta-only вместе с --reorder — ошибка использования', async () => {
    const result = run([pinskFile()], '--meta-only', '--reorder', '--dry-run')
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('--meta-only и --reorder несовместимы')
  })
})
