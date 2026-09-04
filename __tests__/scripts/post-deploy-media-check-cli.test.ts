import path from 'path'

import { makeTempDir, removeDir, runNodeCli, startStubServer, type StubServer } from './cli-test-utils'

const SCRIPT = path.resolve(process.cwd(), 'scripts', 'post-deploy-media-check.js')

/**
 * Контракт вывода гейта: `--json` — это режим ДЛЯ МАШИНЫ.
 *
 * Проверяется процессом, а не вызовом функции: дефект #1760 жил ровно в стыке
 * двух печатающих функций внутри `main`, и юнит-тест на любую из них по
 * отдельности был бы зелёным. Разъехаться контракт может только на реальном
 * stdout, поэтому смотрим именно его.
 */

const COVERAGE_CONTRACT = {
  route_behavior: {
    model_owned: {
      family_modes: {
        travel: {
          requested_mode: 'durable_s3_derivatives',
          active_mode: 'durable_s3_derivatives',
          coverage: { masters: 10, complete_masters: 10, coverage_percent: 100, complete: true },
        },
      },
    },
  },
}

/**
 * Стаб публичного API: минимум, из которого гейт строит хотя бы одну цель.
 *
 * Медиа-адреса относительные — гейт сам переносит путь на проверяемый origin
 * (`toTargetUrl`), и стабу не нужно знать свой эфемерный порт.
 *
 * `contract === null` — недоступный `proxy-contract`: та самая ветка «Режим
 * раздачи не проверен», на которой дефект #1760 и был пойман.
 */
const serverSource = (contract: unknown) => `
const http = require('http')

const CONTRACT = ${JSON.stringify(contract)}

const json = (res, body) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')

  if (url.pathname === '/api/travels/') {
    return json(res, { data: [{ id: 1, travel_image_thumb_url: '/travel-image/1/cover.webp' }] })
  }
  if (url.pathname === '/api/quests/') {
    return json(res, { data: [{ id: 7, cover_url: '/quest-cover/7/cover.webp' }] })
  }
  if (/^\\/api\\/travels\\/\\d+\\/$/.test(url.pathname)) {
    return json(res, {
      data: {
        id: 1,
        gallery: [{ url: '/gallery/1/frame.webp' }],
        travelAddress: [{ travelImageThumbUrl: '/address-image/1/point.webp' }],
      },
    })
  }
  if (url.pathname === '/api/media/proxy-contract') {
    if (!CONTRACT) {
      res.writeHead(503, { 'content-type': 'application/json' })
      return res.end('{}')
    }
    return json(res, CONTRACT)
  }

  // Любой медиа-адрес: гейт смотрит на заголовки и рост байтов по ширине, а не
  // на содержимое кадра.
  const body = Buffer.alloc(Number(url.searchParams.get('w') || 1) * 10, 1)
  res.writeHead(200, {
    'content-type': 'image/webp',
    'x-metravel-image-transform': 'dynamic-transform-cache',
    'cache-control': 'public, max-age=31536000, immutable',
    'content-length': String(body.length),
  })
  res.end(body)
})

server.listen(0, '127.0.0.1', () => console.log('PORT=' + server.address().port))
`

describe('post-deploy-media-check: контракт вывода CLI', () => {
  let servedDir: string
  let unreadableDir: string
  let served: StubServer
  let unreadable: StubServer

  // Лестничный обход тела статей выключен: он к режиму вывода отношения не
  // имеет, а стабу стоил бы обход всего каталога.
  const run = (origin: string, ...flags: string[]) =>
    runNodeCli([SCRIPT, '--url', origin, '--article-body-scan', '0', ...flags])

  // Стабы поднимаются по очереди, а не через `Promise.all`: тот отклоняется на
  // первом падении, присваивание не выполняется вовсе — и уже слушающий второй
  // процесс остаётся висеть на эфемерном порту, пережив выход jest-воркера.
  // Здесь каждый пойманный сервер попадает в переменную сразу, и `afterAll`
  // гасит всё, что успело подняться.
  beforeAll(async () => {
    servedDir = makeTempDir('post-deploy-media-check-cli-')
    unreadableDir = makeTempDir('post-deploy-media-check-cli-no-contract-')
    served = await startStubServer(serverSource(COVERAGE_CONTRACT), servedDir)
    unreadable = await startStubServer(serverSource(null), unreadableDir)
  })

  afterAll(() => {
    served?.stop()
    unreadable?.stop()
    removeDir(servedDir)
    removeDir(unreadableDir)
  })

  it('в --json печатает в stdout ровно отчёт и ничего кроме него', () => {
    const result = run(served.origin, '--json')

    // Падение здесь — это и есть дефект: следом за отчётом печатался блок
    // «📦 Режим раздачи…».
    const report = JSON.parse(result.stdout)

    expect(result.stdout.trim()).toBe(JSON.stringify(report, null, 2))
    // Данные покрытия не потеряны вместе с печатью: их место — в отчёте.
    expect(report.coverage.families).toHaveLength(1)
    expect(report.site).toBe(served.origin)
  })

  it('в --json молчит и когда proxy-contract недоступен', () => {
    const result = run(unreadable.origin, '--json')

    const report = JSON.parse(result.stdout)

    expect(result.stdout.trim()).toBe(JSON.stringify(report, null, 2))
    expect(report.coverage.issues).toEqual([
      expect.objectContaining({ code: 'coverage.contract_unreadable' }),
    ])
  })

  it('без --json по-прежнему печатает блок режима раздачи человеку', () => {
    expect(run(served.origin).stdout).toContain('📦 Режим раздачи: 1 из 1')
    expect(run(unreadable.origin).stdout).toContain('⚠️  Режим раздачи не проверен')
  })
})
