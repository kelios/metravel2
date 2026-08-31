/**
 * Regression tests for scripts/update-quest-content.js — резолв pk финала (#1458).
 *
 * FK `quest -> finale` API не отдаёт. Скрипт искал запись перебором по
 * совпадению ТЕКУЩЕГО текста финала, брал первое совпадение и считал финал
 * применённым по факту отправленного PATCH: собственный verify печатал
 * «❌ … текст не применился к нужному квесту!» и ни на что не влиял — снимок
 * архивировался, код возврата оставался 0. Ложный сигнал успеха при записи в
 * чужой квест.
 *
 * Теперь основной путь — точный маппинг questId → finaleId из
 * `scripts/generate-quest-finale-videos.js` (тот же, по которому заливаются
 * финальные видео), а перебор по тексту остался фолбэком для квестов вне
 * маппинга: с полным сканом, детектором коллизии и обязательным verify.
 *
 * Прогон идёт по живому HTTP-стабу отдельным процессом и настоящему CLI:
 * проверяются код возврата, состояние прода после запуска и судьба снимка.
 * Мок fetch поверх готового ответа тут доказательством не считается — он не
 * проверит ни код возврата, ни то, что снимок не уехал в архив.
 */

import fs from 'fs'
import http from 'http'
import path from 'path'

import { makeTempDir, removeDir, runNodeCli, startStubServer, writeTextFile, type StubServer } from './cli-test-utils'

const { QUESTS } = require('../../scripts/generate-quest-finale-videos.js')

const SCRIPT = path.resolve(process.cwd(), 'scripts', 'update-quest-content.js')
const APPLIED_DIR = path.resolve(process.cwd(), 'scripts', '.quest-review', 'applied')

// Квест из маппинга: его pk резолвится напрямую, без перебора по тексту.
const MAPPED = QUESTS.find((q: { finaleId?: number }) => q.finaleId) as { questId: string; finaleId: number }
// Квесты вне маппинга: работает фолбэк-перебор.
const UNMAPPED = 'stub-quest-not-in-mapping'
const UNMAPPED_TWIN = 'stub-quest-twin'

// Стаб прод-API: держит состояние в памяти, PATCH реально его меняет — иначе
// verify в скрипте нечего было бы проверять. `PUT /__fixture` переставляет
// состояние между кейсами, `GET /__state` показывает, что осталось на «проде».
// `failPk` отдаёт 500 на конкретной записи — так проверяется, что оборванный
// перебор не выдаёт себя за однозначный резолв.
const SERVER_SOURCE = `
const http = require('http')
let state = { quests: {}, finales: {}, steps: {}, failPk: null }

// #1649: буферизуем байты и декодируем один раз. \`raw += chunk\` декодировал
// каждый транспортный чанк отдельно, и кириллица на границе чанка приезжала бы
// в фикстуру как U+FFFD — оракул теста врал бы вместе со скриптом.
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

  let m = /^\\/api\\/quests\\/by-quest-id\\/([^/]+)\\/$/.exec(url)
  if (m && req.method === 'GET') {
    const quest = state.quests[decodeURIComponent(m[1])]
    if (!quest) return json(res, 404, { detail: 'no quest' })
    const finaleText = state.finales[String(quest.finalePk)]
    return json(res, 200, {
      steps: (quest.steps || []).map((id) => state.steps[String(id)]),
      intro: quest.intro ? state.steps[String(quest.intro)] : null,
      finale: finaleText == null ? null : { text: finaleText },
    })
  }

  m = /^\\/api\\/quest-finales\\/(\\d+)\\/$/.exec(url)
  if (m) {
    const pk = m[1]
    if (state.failPk != null && Number(pk) === Number(state.failPk)) return json(res, 500, { detail: 'boom' })
    if (req.method === 'GET') {
      if (state.finales[pk] == null) return json(res, 404, { detail: 'no finale' })
      return json(res, 200, { id: Number(pk), text: state.finales[pk] })
    }
    if (req.method === 'PATCH') {
      const payload = await body(req)
      if (state.finales[pk] == null) return json(res, 404, { detail: 'no finale' })
      state.finales[pk] = payload.text
      return json(res, 200, { id: Number(pk), text: payload.text })
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
  quests: Record<string, { steps: number[]; intro?: number; finalePk: number }>
  finales: Record<string, string>
  steps: Record<string, { id: number; step_id: string; story?: string }>
  failPk?: number | null
}

const STEP = { 10: { id: 10, step_id: '1-start', story: 'старая история' } }
const OTHER_STEP = { 20: { id: 20, step_id: '1-start', story: 'чужая история' } }

describe('update-quest-content: резолв pk финала (#1458)', () => {
  let server: StubServer
  let origin = ''
  let dir = ''
  // Архивы, созданные прогонами этого сьюта, — по одному имени на запуск CLI.
  let created: string[] = []

  // Запрос идёт через node:http, а не через глобальный fetch: в jest-окружении
  // проекта он подменён winter-обёрткой expo и падает на отсутствующем Request.
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

  // Снимок кладётся вне репозитория: git-tracked файл скрипт применять
  // отказывается (#1448), а архив уезжает в scripts/.quest-review/applied/.
  const writeSnapshot = (name: string, payload: unknown) => {
    const file = path.join(dir, name)
    writeTextFile(file, JSON.stringify(payload, null, 2))
    return file
  }

  // Каталог архива — общий с настоящими прогонами по проду (#1448: применённый
  // снимок там и есть весь след инцидента), а путь к нему считается от самого
  // скрипта и тесту не переопределяется. Поэтому «архив этого кейса» — не «всё,
  // чего не было в начале сьюта», а ровно то, что появилось за время
  // синхронного запуска CLI: снимок соседней сессии, легший рядом, не попадёт
  // ни в ассерт, ни в уборку.
  const archivedFiles = () => (fs.existsSync(APPLIED_DIR) ? fs.readdirSync(APPLIED_DIR) : [])

  const run = (snapshot: string, questId: string, extra: string[] = []) => {
    const before = archivedFiles()
    const result = runNodeCli([SCRIPT, `--quest-id=${questId}`, `--data=${snapshot}`, `--api-url=${origin}`, '--token=test', ...extra])
    created.push(...archivedFiles().filter((name) => !before.includes(name)))
    return result
  }

  beforeAll(async () => {
    dir = makeTempDir('update-quest-content-')
    server = await startStubServer(SERVER_SOURCE, dir)
    origin = server.origin
  })

  // Упавший кейс тоже мог оставить архив — чистим независимо от исхода, но
  // только файлы, появившиеся во время собственных запусков CLI.
  afterEach(() => {
    for (const name of created) {
      const file = path.join(APPLIED_DIR, name)
      if (fs.existsSync(file)) fs.unlinkSync(file)
    }
    created = []
  })

  afterAll(() => {
    server.stop()
    removeDir(dir)
  })

  it('квест из маппинга пишется по точному pk и не спотыкается о чужой одинаковый текст', async () => {
    // Двойник с дословно тем же текстом финала: перебору он был бы коллизией,
    // а точному маппингу — безразличен.
    await setFixture({
      quests: {
        [MAPPED.questId]: { steps: [10], finalePk: MAPPED.finaleId },
        [UNMAPPED_TWIN]: { steps: [20], finalePk: 2 },
      },
      finales: { [MAPPED.finaleId]: 'Общий текст финала', 2: 'Общий текст финала' },
      steps: { ...STEP, ...OTHER_STEP },
    })
    const snapshot = writeSnapshot('mapped.json', { finale: { text: 'Новый финал по маппингу' } })

    const result = run(snapshot, MAPPED.questId)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`✅ finale (pk=${MAPPED.finaleId})`)
    expect(result.stdout).toContain('✅ Done')

    const state = await readState()
    expect(state.finales[String(MAPPED.finaleId)]).toBe('Новый финал по маппингу')
    expect(state.finales['2']).toBe('Общий текст финала')
    expect(fs.existsSync(snapshot)).toBe(false)
  })

  it('падает, если маппинг ведёт в запись с другим текстом', async () => {
    // pk из маппинга и финал квеста — одна и та же запись, поэтому расхождение
    // текстов означает протухший маппинг: писать по нему нельзя.
    await setFixture({
      quests: { [MAPPED.questId]: { steps: [10], finalePk: 40 } },
      finales: { [MAPPED.finaleId]: 'Финал совсем другого квеста', 40: 'Настоящий финал квеста' },
      steps: STEP,
    })
    const snapshot = writeSnapshot('stale-mapping.json', { finale: { text: 'Новый финал' } })

    const result = run(snapshot, MAPPED.questId)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('там лежит другой текст')
    expect(result.stdout).not.toContain('✅ Done')

    const state = await readState()
    expect(state.finales[String(MAPPED.finaleId)]).toBe('Финал совсем другого квеста')
    expect(state.finales['40']).toBe('Настоящий финал квеста')
    expect(fs.existsSync(snapshot)).toBe(true)
    expect(created).toHaveLength(0)
  })

  it('падает, если записи из маппинга вообще нет', async () => {
    await setFixture({
      quests: { [MAPPED.questId]: { steps: [10], finalePk: 40 } },
      finales: { 40: 'Настоящий финал квеста' },
      steps: STEP,
    })
    const snapshot = writeSnapshot('missing-mapping.json', { finale: { text: 'Новый финал' } })

    const result = run(snapshot, MAPPED.questId)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('но записи нет')
    expect(fs.existsSync(snapshot)).toBe(true)
    expect(created).toHaveLength(0)
  })

  it('отказывается писать финал квеста вне маппинга, если текст совпал с несколькими записями', async () => {
    // Два квеста с дословно совпадающим текстом финала: по тексту нужную
    // запись не отличить, и раньше побеждала первая по возрастанию pk.
    await setFixture({
      quests: {
        [UNMAPPED]: { steps: [10], finalePk: 3 },
        [UNMAPPED_TWIN]: { steps: [20], finalePk: 9 },
      },
      finales: { 3: 'Общий финал', 9: 'Общий финал' },
      steps: { ...STEP, ...OTHER_STEP },
    })
    const snapshot = writeSnapshot('collision.json', {
      steps: [{ step_id: '1-start', story: 'новая история' }],
      finale: { text: 'Новый финал только для одного квеста' },
    })

    const result = run(snapshot, UNMAPPED)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('совпадает сразу с несколькими записями: pk=3, 9')
    expect(result.stderr).toContain('Снимок оставлен на месте')

    // Ни одна запись финала не тронута: отказ случился до PATCH.
    const state = await readState()
    expect(state.finales['3']).toBe('Общий финал')
    expect(state.finales['9']).toBe('Общий финал')
    // Снимок не архивирован — его ещё применять после ручного разбора.
    expect(fs.existsSync(snapshot)).toBe(true)
    expect(created).toHaveLength(0)
  })

  it('падает и не архивирует снимок, если после PATCH у квеста остался чужой текст', async () => {
    // Настоящая запись финала лежит за границей перебора (pk=999), а внутри
    // диапазона тем же текстом отсвечивает финал другого квеста. Совпадение
    // единственное — коллизия не ловится, ловит только verify.
    await setFixture({
      quests: {
        [UNMAPPED]: { steps: [10], finalePk: 999 },
        [UNMAPPED_TWIN]: { steps: [20], finalePk: 3 },
      },
      finales: { 3: 'Общий финал', 999: 'Общий финал' },
      steps: { ...STEP, ...OTHER_STEP },
    })
    const snapshot = writeSnapshot('verify-miss.json', { finale: { text: 'Новый финал только для одного квеста' } })

    const result = run(snapshot, UNMAPPED)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('правка ушла в чужую запись')
    expect(result.stderr).toContain('pk=3')
    expect(result.stdout).not.toContain('✅ Done')

    // Промах зафиксирован честно: чужая запись действительно перезаписана и
    // названа в сообщении, снимок остался на месте для ручного отката.
    const state = await readState()
    expect(state.finales['3']).toBe('Новый финал только для одного квеста')
    expect(state.finales['999']).toBe('Общий финал')
    expect(fs.existsSync(snapshot)).toBe(true)
    expect(created).toHaveLength(0)
  })

  it('падает, если запись финала не нашлась по тексту, — правка не должна теряться молча', async () => {
    // Запись лежит за границей перебора и внутри диапазона ничем не отсвечивает.
    // Раньше это был ⚠️ с продолжением: снимок уезжал в архив с кодом 0, а
    // отредактированный финал не применялся вообще.
    await setFixture({
      quests: { [UNMAPPED]: { steps: [10], finalePk: 999 } },
      finales: { 3: 'Финал совсем другого квеста', 999: 'Финал квеста' },
      steps: STEP,
    })
    const snapshot = writeSnapshot('not-found.json', {
      steps: [{ step_id: '1-start', story: 'новая история' }],
      finale: { text: 'Новый финал' },
    })

    const result = run(snapshot, UNMAPPED)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('текст финала не применён')
    expect(result.stdout).not.toContain('✅ Done')

    const state = await readState()
    expect(state.finales['3']).toBe('Финал совсем другого квеста')
    expect(state.finales['999']).toBe('Финал квеста')
    expect(fs.existsSync(snapshot)).toBe(true)
    expect(created).toHaveLength(0)
  })

  it('падает, если у квеста на проде вообще нет текста финала', async () => {
    // Записи, в которую лёг бы текст, нет: писать по маппингу вслепую значило
    // бы писать в чужую. Раньше это был ⚠️ с архивацией и кодом 0.
    await setFixture({
      quests: { [MAPPED.questId]: { steps: [10], finalePk: 777 } },
      finales: { [MAPPED.finaleId]: 'Финал другого квеста' },
      steps: STEP,
    })
    const snapshot = writeSnapshot('no-finale.json', {
      steps: [{ step_id: '1-start', story: 'новая история' }],
      finale: { text: 'Новый финал' },
    })

    const result = run(snapshot, MAPPED.questId)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('нет текста финала')
    expect(result.stdout).not.toContain('✅ Done')

    const state = await readState()
    expect(state.finales[String(MAPPED.finaleId)]).toBe('Финал другого квеста')
    expect(fs.existsSync(snapshot)).toBe(true)
    expect(created).toHaveLength(0)
  })

  it('обрывает перебор на не-404 ошибке вместо мнимо однозначного резолва', async () => {
    // Сбой на pk=9 скрывает второе совпадение: без обрыва перебор счёл бы
    // оставшееся совпадение однозначным и записал бы в pk=3.
    await setFixture({
      quests: {
        [UNMAPPED]: { steps: [10], finalePk: 3 },
        [UNMAPPED_TWIN]: { steps: [20], finalePk: 9 },
      },
      finales: { 3: 'Общий финал', 9: 'Общий финал' },
      steps: { ...STEP, ...OTHER_STEP },
      failPk: 9,
    })
    const snapshot = writeSnapshot('scan-error.json', { finale: { text: 'Новый финал' } })

    const result = run(snapshot, UNMAPPED)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Перебор финалов оборвался на pk=9')

    const state = await readState()
    expect(state.finales['3']).toBe('Общий финал')
    expect(fs.existsSync(snapshot)).toBe(true)
    expect(created).toHaveLength(0)
  })

  it('без коллизии применяет финал квеста вне маппинга, подтверждает verify и архивирует снимок', async () => {
    await setFixture({
      quests: {
        [UNMAPPED]: { steps: [10], finalePk: 3 },
        [UNMAPPED_TWIN]: { steps: [20], finalePk: 9 },
      },
      finales: { 3: 'Финал первого', 9: 'Финал второго' },
      steps: { ...STEP, ...OTHER_STEP },
    })
    const snapshot = writeSnapshot('unique.json', {
      steps: [{ step_id: '1-start', story: 'новая история' }],
      finale: { text: 'Новый финал первого' },
    })

    const result = run(snapshot, UNMAPPED)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('✅ finale (pk=3)')
    expect(result.stdout).toContain('✅ Done')

    const state = await readState()
    expect(state.finales['3']).toBe('Новый финал первого')
    expect(state.finales['9']).toBe('Финал второго')
    expect(state.steps['10'].story).toBe('новая история')
    expect(state.steps['20'].story).toBe('чужая история')

    // Снимок применён и убран из рабочего пути.
    expect(fs.existsSync(snapshot)).toBe(false)
    expect(created.length).toBeGreaterThan(0)
  })

  it('в dry-run не пишет на прод и не трогает снимок', async () => {
    await setFixture({
      quests: { [MAPPED.questId]: { steps: [10], finalePk: MAPPED.finaleId } },
      finales: { [MAPPED.finaleId]: 'Финал квеста' },
      steps: STEP,
    })
    const snapshot = writeSnapshot('dry.json', {
      steps: [{ step_id: '1-start', story: 'новая история' }],
      finale: { text: 'Новый финал' },
    })

    const result = run(snapshot, MAPPED.questId, ['--dry-run'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`[DRY] finale → pk=${MAPPED.finaleId}`)
    const state = await readState()
    expect(state.finales[String(MAPPED.finaleId)]).toBe('Финал квеста')
    expect(state.steps['10'].story).toBe('старая история')
    expect(fs.existsSync(snapshot)).toBe(true)
    expect(created).toHaveLength(0)
  })
})
