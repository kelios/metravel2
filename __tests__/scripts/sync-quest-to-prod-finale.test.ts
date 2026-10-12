/**
 * Regression tests for scripts/sync-quest-to-prod.js — адресация записи финала (#2427).
 *
 * Скрипт слал `PATCH /api/quest-finales/${bundle.id}/`, считая pk финала равным
 * числовому id квеста. Это неверно: `QuestFinale.quest` — OneToOne, но pk у
 * финала собственный. На проде у torun-copernicus (id квеста 20) финал лежит в
 * pk=21, а у lublin-old-town (id 21) — в pk=20, и синк Торуни переписал финал
 * Люблина. Стаб воспроизводит ровно эти перекрёстные пары: тест красный, если
 * pk финала снова вычисляется из id квеста.
 *
 * Прогон идёт настоящим CLI по живому HTTP-стабу: проверяются код возврата и
 * состояние «прода» после запуска, а не сам факт отправленного запроса.
 */

import http from 'http'
import path from 'path'

import { makeTempDir, removeDir, runNodeCli, startStubServer, writeTextFile, type StubServer } from './cli-test-utils'

const { QUESTS } = require('../../scripts/generate-quest-finale-videos.js')

const SCRIPT = path.resolve(process.cwd(), 'scripts', 'sync-quest-to-prod.js')

const finalePkOf = (questId: string): number => QUESTS.find((q: { questId: string }) => q.questId === questId).finaleId

// Перекрёстные пары как на проде: id квеста одного города = pk финала другого.
const TORUN = { questId: 'torun-copernicus', id: 20, finalePk: finalePkOf('torun-copernicus') }
const LUBLIN = { questId: 'lublin-old-town', id: 21, finalePk: finalePkOf('lublin-old-town') }
// Квест вне маппинга: его pk ищется перебором по тексту, а id квеста совпадает
// с pk чужого финала (Торуни) — ловушка для адресации по id.
const UNMAPPED = { questId: 'stub-quest-not-in-mapping', id: TORUN.finalePk, finalePk: 3 }

const SERVER_SOURCE = `
const http = require('http')
let state = { quests: {}, finales: {}, steps: {} }

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
  if (req.method === 'PUT' && url === '/__fixture') { state = await body(req); return json(res, 200, {}) }
  if (req.method === 'GET' && url === '/__state') return json(res, 200, state)

  // Как на проде: у finale в ответе нет id, связь квест -> финал API не отдаёт.
  let m = /^\\/api\\/quests\\/by-quest-id\\/([^/]+)\\/$/.exec(url)
  if (m && req.method === 'GET') {
    const quest = state.quests[decodeURIComponent(m[1])]
    if (!quest) return json(res, 404, { detail: 'no quest' })
    const finaleText = state.finales[String(quest.finalePk)]
    return json(res, 200, {
      id: quest.id,
      steps: (quest.steps || []).map((id) => state.steps[String(id)]),
      intro: null,
      finale: finaleText == null ? null : { text: finaleText },
    })
  }

  m = /^\\/api\\/quest-finales\\/(\\d+)\\/$/.exec(url)
  if (m) {
    const pk = m[1]
    if (state.finales[pk] == null) return json(res, 404, { detail: 'no finale' })
    if (req.method === 'GET') return json(res, 200, { text: state.finales[pk] })
    if (req.method === 'PATCH') {
      const payload = await body(req)
      state.finales[pk] = payload.text
      return json(res, 200, { text: payload.text })
    }
  }

  m = /^\\/api\\/quest-steps\\/(\\d+)\\/$/.exec(url)
  if (m && req.method === 'PATCH') {
    const payload = await body(req)
    const step = state.steps[m[1]]
    if (!step) return json(res, 404, { detail: 'no step' })
    Object.assign(step, payload)
    return json(res, 200, step)
  }

  return json(res, 404, { detail: 'not found' })
})
server.listen(0, '127.0.0.1', () => console.log('PORT=' + server.address().port))
`

type Fixture = {
  quests: Record<string, { id: number; steps: number[]; finalePk: number }>
  finales: Record<string, string>
  steps: Record<string, { id: number; step_id: string }>
}

const TORUN_OLD = 'Финал Торуни: Коперник остановил Солнце.'
const LUBLIN_OLD = 'Финал Люблина: Брама Краковская на закате.'
const TORUN_NEW = 'Новый финал Торуни: пряник, Висла и Коперник.'

const baseFixture = (): Fixture => ({
  quests: {
    [TORUN.questId]: { id: TORUN.id, steps: [101], finalePk: TORUN.finalePk },
    [LUBLIN.questId]: { id: LUBLIN.id, steps: [201], finalePk: LUBLIN.finalePk },
  },
  finales: { [TORUN.finalePk]: TORUN_OLD, [LUBLIN.finalePk]: LUBLIN_OLD },
  steps: { 101: { id: 101, step_id: '1-start' }, 201: { id: 201, step_id: '1-start' } },
})

const questData = (questId: string, finaleText: string) => ({
  quest_id: questId,
  steps: [{ step_id: '1-start', title: 'Старт', location: 'Площадь', story: 'история', task: 'задание', lat: 53, lng: 18, answer_pattern: { type: 'any', value: '' } }],
  finale: { text: finaleText },
})

describe('sync-quest-to-prod: адресация записи финала (#2427)', () => {
  let server: StubServer
  let origin = ''
  let dir = ''

  // node:http, а не глобальный fetch: в jest-окружении проекта он подменён
  // winter-обёрткой expo.
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

  const setFixture = (fixture: Fixture) => request('PUT', `${origin}/__fixture`, fixture)
  const readState = async (): Promise<Fixture> => JSON.parse(await request('GET', `${origin}/__state`))

  let fileSeq = 0
  const run = (quests: unknown[], mode: '--apply' | '--dry-run') => {
    const file = path.join(dir, `quests-${++fileSeq}.js`)
    writeTextFile(file, `module.exports = ${JSON.stringify(quests)}\n`)
    return runNodeCli([SCRIPT, `--source-file=${file}`, mode, `--api-url=${origin}`, '--token=test'])
  }

  beforeAll(async () => {
    dir = makeTempDir('sync-quest-to-prod-finale-')
    server = await startStubServer(SERVER_SOURCE, dir)
    origin = server.origin
  })

  afterAll(() => {
    server.stop()
    removeDir(dir)
  })

  it('фикстура действительно перекрёстная: pk финала ≠ id квеста', () => {
    expect(TORUN.finalePk).not.toBe(TORUN.id)
    expect(TORUN.finalePk).toBe(LUBLIN.id)
    expect(LUBLIN.finalePk).toBe(TORUN.id)
  })

  it('финал Торуни пишется в её запись, финал Люблина не трогается', async () => {
    await setFixture(baseFixture())

    const result = run([questData(TORUN.questId, TORUN_NEW)], '--apply')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`✅ finale (pk=${TORUN.finalePk})`)
    const state = await readState()
    expect(state.finales[TORUN.finalePk]).toBe(TORUN_NEW)
    expect(state.finales[LUBLIN.finalePk]).toBe(LUBLIN_OLD)
  })

  it('репетиция показывает верный pk финала и ничего не пишет', async () => {
    await setFixture(baseFixture())

    const result = run([questData(TORUN.questId, TORUN_NEW), questData(LUBLIN.questId, 'Новый финал Люблина.')], '--dry-run')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`[DRY] PATCH /api/quest-finales/${TORUN.finalePk}/`)
    expect(result.stdout).toContain(`[DRY] finale → pk=${TORUN.finalePk}`)
    expect(result.stdout).toContain(`[DRY] finale → pk=${LUBLIN.finalePk}`)
    expect(result.stdout).not.toContain(`[DRY] PATCH /api/quest-finales/${TORUN.id}/ {"text":"${TORUN_NEW}`)
    const state = await readState()
    expect(state.finales[TORUN.finalePk]).toBe(TORUN_OLD)
    expect(state.finales[LUBLIN.finalePk]).toBe(LUBLIN_OLD)
  })

  it('маппинг указывает на запись с чужим текстом — отказ без записи', async () => {
    // Записи поменялись местами относительно маппинга: писать по нему нельзя.
    const fixture = baseFixture()
    fixture.quests[TORUN.questId].finalePk = LUBLIN.finalePk
    fixture.quests[LUBLIN.questId].finalePk = TORUN.finalePk
    fixture.finales = { [LUBLIN.finalePk]: TORUN_OLD, [TORUN.finalePk]: LUBLIN_OLD }
    await setFixture(fixture)

    const result = run([questData(TORUN.questId, TORUN_NEW)], '--apply')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`«${TORUN.questId}»`)
    expect(result.stderr).toContain('там лежит другой текст')
    expect(result.stdout).not.toContain('Sync завершён')
    const state = await readState()
    expect(state.finales).toEqual(fixture.finales)
  })

  it('квест вне маппинга находит свою запись перебором, а не по id квеста', async () => {
    const fixture = baseFixture()
    fixture.quests[UNMAPPED.questId] = { id: UNMAPPED.id, steps: [301], finalePk: UNMAPPED.finalePk }
    fixture.finales[UNMAPPED.finalePk] = 'Финал квеста вне маппинга.'
    fixture.steps[301] = { id: 301, step_id: '1-start' }
    await setFixture(fixture)

    const result = run([questData(UNMAPPED.questId, 'Обновлённый финал вне маппинга.')], '--apply')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`✅ finale (pk=${UNMAPPED.finalePk})`)
    const state = await readState()
    expect(state.finales[UNMAPPED.finalePk]).toBe('Обновлённый финал вне маппинга.')
    expect(state.finales[TORUN.finalePk]).toBe(TORUN_OLD)
  })

  it('текст квеста вне маппинга совпал с двумя записями — отказ без записи', async () => {
    const fixture = baseFixture()
    fixture.quests[UNMAPPED.questId] = { id: UNMAPPED.id, steps: [301], finalePk: UNMAPPED.finalePk }
    fixture.finales[UNMAPPED.finalePk] = 'Одинаковый текст.'
    fixture.finales[9] = 'Одинаковый текст.'
    fixture.steps[301] = { id: 301, step_id: '1-start' }
    await setFixture(fixture)

    const result = run([questData(UNMAPPED.questId, 'Новый текст.')], '--apply')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`совпадает сразу с несколькими записями: pk=${UNMAPPED.finalePk}, 9`)
    const state = await readState()
    expect(state.finales[UNMAPPED.finalePk]).toBe('Одинаковый текст.')
    expect(state.finales[9]).toBe('Одинаковый текст.')
  })
})
