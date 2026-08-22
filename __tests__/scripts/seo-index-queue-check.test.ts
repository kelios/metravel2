import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runNodeCli, startStubServer, writeTextFile, type StubServer } from './cli-test-utils'

const {
  CLI_SPEC,
  USAGE,
  UsageError,
  applyRedirectFixes,
  collectQueueUrls,
  main,
  parseArgs,
  rowsAfterFixes,
  slugOf,
  summarizeIndexProgress,
  verifyUrl,
} = require('../../scripts/seo-index-queue-check')

const SCRIPT = path.resolve(process.cwd(), 'scripts', 'seo-index-queue-check.js')

const argvOf = (...flags: string[]) => ['node', 'script', ...flags]

type Probe = (url: string) => Promise<{ status: number; location?: string; error?: string }>

/** Очередь той же формы, что `scripts/seo-index-queue.json`. */
const makeQueue = () => ({
  totalUrls: 4,
  batchSize: 2,
  batches: [
    {
      day: 1,
      submittedAt: '2026-08-08',
      urls: ['https://metravel.by/travels/alive', 'https://metravel.by/travels/moved-old'],
      indexCheck: {
        checkedAt: '2026-08-10',
        indexed: 1,
        of: 2,
        indexedUrls: ['https://metravel.by/travels/alive'],
      },
    },
    {
      day: 2,
      submittedAt: null,
      urls: ['https://metravel.by/travels/gone'],
    },
  ],
  details: [
    { id: 1, url: 'https://metravel.by/travels/alive', state: 'URL неизвестен Google', renamedFrom: [] },
    {
      id: 2,
      url: 'https://metravel.by/travels/moved-old',
      state: 'URL неизвестен Google',
      renamedFrom: ['travels-pervoe-imia'],
    },
    { id: 3, url: 'https://metravel.by/travels/gone', state: 'URL неизвестен Google', renamedFrom: [] },
  ],
})

const probeFrom = (table: Record<string, { status: number; location?: string }>): Probe => {
  return async (url: string) => table[url] || { status: 0, error: 'нет ответа в фикстуре' }
}

// Разбор идёт через общий контракт SEO-CLI (#1391) — здесь проверяется, что
// скрипт действительно им пользуется и что связки флагов, которых в спеке нет,
// тоже не пропускают мусор.
describe('очередь индексации: разбор аргументов', () => {
  it('отвергает незнакомый аргумент вместо тихого прохода', () => {
    expect(() => parseArgs(argvOf('--nonsense'))).toThrow(UsageError)
    expect(() => parseArgs(argvOf('--nonsense'))).toThrow('Unknown argument: --nonsense')
    expect(() => parseArgs(argvOf('--fixx'))).toThrow('Unknown argument: --fixx')
  })

  it('читает каждый флаг явно', () => {
    expect(parseArgs(argvOf())).toMatchObject({ fix: false, json: false, batch: null, limit: null })
    expect(parseArgs(argvOf('--fix'))).toMatchObject({ fix: true })
    expect(parseArgs(argvOf('--batch', '11'))).toMatchObject({ batch: 11 })
    expect(parseArgs(argvOf('--batch', '11', '--out', 'batch.txt'))).toMatchObject({
      batch: 11,
      out: 'batch.txt',
    })
  })

  it('по умолчанию берёт очередь из репозитория', () => {
    expect(parseArgs(argvOf()).queueFile).toBe(path.resolve(process.cwd(), 'scripts', 'seo-index-queue.json'))
    expect(parseArgs(argvOf('--queue', 'other.json')).queueFile).toBe('other.json')
  })

  it('не отдаёт список адресов на всю очередь: --out только с --batch', () => {
    expect(() => parseArgs(argvOf('--out', 'batch.txt'))).toThrow('--out requires --batch')
  })

  it('требует значение у флагов, а опечатку не глотает как значение', () => {
    expect(() => parseArgs(argvOf('--batch'))).toThrow('--batch expects a batch number')
    expect(() => parseArgs(argvOf('--batch', '0'))).toThrow('--batch expects a batch number')
    expect(() => parseArgs(argvOf('--out', '--fix'))).toThrow('--out expects a path')
    expect(() => parseArgs(argvOf('--queue'))).toThrow('--queue expects a path')
  })

  it('отвергает повтор флага и несовместимую пару', () => {
    expect(() => parseArgs(argvOf('--batch', '1', '--batch', '2'))).toThrow('given twice')
    expect(() => parseArgs(argvOf('--batch', '1', '--limit', '5'))).toThrow('choose one')
  })

  it('документирует в справке каждый флаг, объявленный в спеке', () => {
    for (const flag of Object.keys(CLI_SPEC.flags)) expect(USAGE).toContain(`--${flag}`)
    expect(USAGE).toContain('--help, -h')
  })

  it('парсит аргументы только через общий контракт SEO-CLI', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8')

    expect(source).toContain("require('./lib/seo-cli-contract')")
    expect(source).toContain('parseCliArgs(')
    expect(source).toContain('runSeoCli(')
  })
})

describe('очередь индексации: вердикт по адресу', () => {
  it('живой адрес проходит — контрольная проба, без неё проверка бракует всё подряд', async () => {
    const probe = probeFrom({ 'https://metravel.by/travels/alive': { status: 200 } })

    expect(await verifyUrl('https://metravel.by/travels/alive', probe)).toMatchObject({
      verdict: 'ok',
      status: 200,
    })
  })

  it('переезд на живую цель — redirect с разобранной целью', async () => {
    const probe = probeFrom({
      'https://metravel.by/travels/old': { status: 301, location: '/travels/new' },
      'https://metravel.by/travels/new': { status: 200 },
    })

    expect(await verifyUrl('https://metravel.by/travels/old', probe)).toMatchObject({
      verdict: 'redirect',
      status: 301,
      target: 'https://metravel.by/travels/new',
      targetStatus: 200,
    })
  })

  it('идёт по цепочке из нескольких переименований до конечного адреса', async () => {
    const probe = probeFrom({
      'https://metravel.by/travels/first': { status: 301, location: '/travels/second' },
      'https://metravel.by/travels/second': { status: 301, location: '/travels/third' },
      'https://metravel.by/travels/third': { status: 200 },
    })

    expect(await verifyUrl('https://metravel.by/travels/first', probe)).toMatchObject({
      verdict: 'redirect',
      target: 'https://metravel.by/travels/third',
    })
  })

  it('переезд на мёртвую цель — это dead, а не «можно переписать»', async () => {
    const probe = probeFrom({
      'https://metravel.by/travels/old': { status: 301, location: '/travels/gone' },
      'https://metravel.by/travels/gone': { status: 404 },
    })

    const row = await verifyUrl('https://metravel.by/travels/old', probe)
    expect(row.verdict).toBe('dead')
    expect(row.reason).toContain('но цель отвечает 404')
  })

  it('404, 5xx и молчание прода разводятся по разным вердиктам', async () => {
    const probe = probeFrom({
      'https://metravel.by/travels/gone': { status: 404 },
      'https://metravel.by/travels/broken': { status: 502 },
    })

    expect(await verifyUrl('https://metravel.by/travels/gone', probe)).toMatchObject({ verdict: 'dead' })
    expect(await verifyUrl('https://metravel.by/travels/broken', probe)).toMatchObject({
      verdict: 'unreachable',
    })
    expect(await verifyUrl('https://metravel.by/travels/silent', probe)).toMatchObject({
      verdict: 'unreachable',
    })
  })

  it('3xx без Location не считается живым', async () => {
    const probe = probeFrom({ 'https://metravel.by/travels/odd': { status: 301 } })

    const row = await verifyUrl('https://metravel.by/travels/odd', probe)
    expect(row.verdict).toBe('unreachable')
    expect(row.reason).toContain('без заголовка Location')
  })

  it('обрывает бесконечную цепочку переадресаций', async () => {
    const probe: Probe = async (url) => ({ status: 301, location: `${url}x` })

    const row = await verifyUrl('https://metravel.by/travels/loop', probe)
    expect(row.verdict).toBe('unreachable')
    expect(row.reason).toContain('цепочка длиннее')
  })
})

describe('очередь индексации: автоправка протухшей записи', () => {
  it('переписывает адрес в пачке и в details, старый слаг уходит в renamedFrom', () => {
    const queue = makeQueue()
    const rows = [
      {
        url: 'https://metravel.by/travels/moved-old',
        verdict: 'redirect',
        status: 301,
        target: 'https://metravel.by/travels/moved-new',
        targetStatus: 200,
      },
    ]

    const { applied, refused } = applyRedirectFixes(queue, rows, { today: '2026-08-10' })

    expect(refused).toEqual([])
    expect(applied).toEqual([
      { from: 'https://metravel.by/travels/moved-old', to: 'https://metravel.by/travels/moved-new' },
    ])
    expect(queue.batches[0].urls).toEqual([
      'https://metravel.by/travels/alive',
      'https://metravel.by/travels/moved-new',
    ])
    expect(queue.details[1]).toMatchObject({
      url: 'https://metravel.by/travels/moved-new',
      renamedFrom: ['travels-pervoe-imia', 'moved-old'],
      staleRedirectFixedAt: '2026-08-10',
    })
  })

  it('не трогает историю подачи: indexCheck остаётся фактом о старом адресе', () => {
    const queue = makeQueue()
    const rows = [
      {
        url: 'https://metravel.by/travels/alive',
        verdict: 'redirect',
        status: 301,
        target: 'https://metravel.by/travels/alive-renamed',
        targetStatus: 200,
      },
    ]

    applyRedirectFixes(queue, rows, { today: '2026-08-10' })

    expect(queue.batches[0].indexCheck.indexedUrls).toEqual(['https://metravel.by/travels/alive'])
  })

  it('отказывается сливать записи, когда цель переезда уже есть в очереди', () => {
    const queue = makeQueue()
    const rows = [
      {
        url: 'https://metravel.by/travels/moved-old',
        verdict: 'redirect',
        status: 301,
        target: 'https://metravel.by/travels/alive',
        targetStatus: 200,
      },
    ]

    const { applied, refused } = applyRedirectFixes(queue, rows, { today: '2026-08-10' })

    expect(applied).toEqual([])
    expect(refused[0].refusal).toContain('уже есть в очереди')
    expect(queue.batches[0].urls).toContain('https://metravel.by/travels/moved-old')
  })

  it('мёртвый адрес автоправкой не чинится', () => {
    const queue = makeQueue()
    const rows = [{ url: 'https://metravel.by/travels/gone', verdict: 'dead', status: 404 }]

    expect(applyRedirectFixes(queue, rows, { today: '2026-08-10' })).toEqual({ applied: [], refused: [] })
    expect(queue.batches[1].urls).toEqual(['https://metravel.by/travels/gone'])
  })

  it('после автоправки запись считается живой под новым адресом', () => {
    const rows = [
      { url: 'https://metravel.by/travels/moved-old', verdict: 'redirect', status: 301, targetStatus: 200 },
      { url: 'https://metravel.by/travels/gone', verdict: 'dead', status: 404 },
    ]

    expect(
      rowsAfterFixes(rows, [
        { from: 'https://metravel.by/travels/moved-old', to: 'https://metravel.by/travels/moved-new' },
      ]),
    ).toMatchObject([
      { url: 'https://metravel.by/travels/moved-new', verdict: 'ok' },
      { url: 'https://metravel.by/travels/gone', verdict: 'dead' },
    ])
  })

  it('берёт из адреса именно слаг — так renamedFrom и заполнен в очереди', () => {
    expect(slugOf('https://metravel.by/travels/zamok-malbork-putevoditel')).toBe('zamok-malbork-putevoditel')
    expect(slugOf('https://metravel.by/travels/zamok-malbork-putevoditel/')).toBe('zamok-malbork-putevoditel')
    expect(slugOf('не-адрес')).toBe('')
  })
})

describe('очередь индексации: знаменатель доли', () => {
  it('выкидывает не-200 из знаменателя вместо «ещё не проиндексирован»', () => {
    const queue = makeQueue()
    const rows = [
      { url: 'https://metravel.by/travels/alive', verdict: 'ok', status: 200, reason: 'отвечает 200' },
      { url: 'https://metravel.by/travels/moved-old', verdict: 'redirect', status: 301, reason: '301 → …' },
    ]

    expect(summarizeIndexProgress(queue, rows)).toMatchObject({
      checked: 2,
      eligible: 1,
      indexed: 1,
      share: 100,
    })
  })

  it('называет каждый исключённый адрес и причину, а не молчит про них', () => {
    const queue = makeQueue()
    const rows = [
      { url: 'https://metravel.by/travels/alive', verdict: 'ok', status: 200, reason: 'отвечает 200' },
      {
        url: 'https://metravel.by/travels/moved-old',
        verdict: 'redirect',
        status: 301,
        reason: '301 → https://metravel.by/travels/moved-new',
      },
    ]

    expect(summarizeIndexProgress(queue, rows).excluded).toEqual([
      {
        url: 'https://metravel.by/travels/moved-old',
        reason: '301 → https://metravel.by/travels/moved-new',
      },
    ])
  })

  it('считает только пачки с проверкой индекса', () => {
    const queue = makeQueue()
    const rows = collectQueueUrls(queue).map((url: string) => ({ url, verdict: 'ok', status: 200 }))

    // Пачка 2 без indexCheck: её адрес в долю не попадает ни в какую сторону.
    expect(summarizeIndexProgress(queue, rows).checked).toBe(2)
  })
})

// Записи о подаче ведутся руками после сессии в Search Console, а долю индексации
// `seo-index-queue-check.js` считает по `indexCheck.indexedUrls` и больше ни по
// чему. Значит, расхождение между `indexed`, `indexedUrls` и подробным `results`
// (#1375) никем не ловится: доля молча уедет, а по карточке будет «всё сходится».
describe('очередь индексации: согласованность записей в реальном файле', () => {
  const queue = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'scripts', 'seo-index-queue.json'), 'utf8')
  )

  it.each(queue.batches.map((b: { day: number }) => [b.day]))('пачка %i: замер сходится сам с собой', (day: number) => {
    const batch = queue.batches.find((b: { day: number }) => b.day === day)
    const check = batch.indexCheck
    if (!check) return

    const listed = check.indexedUrls || []
    expect(check.indexed).toBe(listed.length)
    expect(check.of).toBe(batch.urls.length)
    expect(listed.filter((url: string) => !batch.urls.includes(url))).toEqual([])

    // Подробная форма (`results`) появилась в пачке 1 и обязана совпадать со
    // списком, по которому реально считается доля.
    if (check.results) {
      expect(check.results.map((r: { url: string }) => r.url)).toEqual(batch.urls)
      const indexedInResults = check.results
        .filter((r: { outcome: string }) => r.outcome === 'indexed')
        .map((r: { url: string }) => r.url)
      expect(indexedInResults).toEqual(listed)

      // Замер снимается руками, и соблазн записать всем неиндексированным один
      // и тот же `outcome` велик — а он потом читается как «что изменилось после
      // подачи». Адрес, который Google ни разу не скачал (`lastCrawlTime: null`),
      // просканированным называть нельзя: следующий замер тогда не покажет
      // перехода «неизвестен → просканирована», ради которого подача и делается.
      // Для уже индексированного адреса отдельным source-backed доказательством
      // служит `already-indexed` из той же URL Inspection сессии: время обхода
      // интерфейс мог не зафиксировать, и придумывать его для очереди нельзя.
      for (const r of check.results) {
        expect(r.outcome === 'indexed').toBe(r.verdict === 'PASS')
        if (r.outcome === 'crawled-not-indexed') {
          expect(r.lastCrawlTime).toBeTruthy()
        }
        if (r.outcome === 'indexed' && !r.lastCrawlTime) {
          const hasAlreadyIndexedEvidence = batch.gscRequests?.some(
            (candidate: { url: string; result: string }) =>
              candidate.url === r.url && candidate.result === 'already-indexed'
          )
          expect(hasAlreadyIndexedEvidence).toBe(true)
        }
      }
    }
  })

  it.each(queue.batches.map((b: { day: number }) => [b.day]))('пачка %i: подача записана по адресам пачки', (day: number) => {
    const batch = queue.batches.find((b: { day: number }) => b.day === day)
    const requests = batch.gscRequests
    if (!requests) return

    // Пачка может быть подана частично (квота GSC — 10 кликов в сутки), и по
    // одному адресу допустимо несколько записей `quota-exceeded` — это история
    // попыток. А вот исход, закрывающий адрес, бывает только один: два
    // «accepted» на один URL означают, что подача съела лишнюю единицу квоты.
    const urls = requests.map((r: { url: string }) => r.url)
    expect(urls.filter((url: string) => !batch.urls.includes(url))).toEqual([])
    for (const r of requests) {
      expect(['accepted', 'already-indexed', 'quota-exceeded']).toContain(r.result)
    }

    const settled = requests
      .filter((r: { result: string }) => r.result !== 'quota-exceeded')
      .map((r: { url: string }) => r.url)
    expect(new Set(settled).size).toBe(settled.length)
  })
})

// Настоящий прод-путь целиком: живой HTTP-сервер, настоящие HEAD-запросы через
// сокет, настоящий CLI отдельным процессом и настоящая перезапись файла очереди.
// Мок HTTP-клиента поверх готового ответа доказательством здесь не считается:
// он не проверит ни разбор Location, ни код возврата, ни диff файла.
describe('очередь индексации: сквозной прогон по живому серверу', () => {
  let server: StubServer
  let origin = ''
  let dir = ''

  const SERVER_SOURCE = `
const http = require('http')
const routes = {
  '/travels/alive': { status: 200 },
  '/travels/moved-old': { status: 301, location: '/travels/moved-new' },
  '/travels/moved-new': { status: 200 },
  '/travels/gone': { status: 404 },
  '/travels/moved-to-nowhere': { status: 302, location: '/travels/gone' },
}
const server = http.createServer((req, res) => {
  const route = routes[req.url]
  if (!route) {
    res.writeHead(404)
    return res.end()
  }
  res.writeHead(route.status, route.location ? { Location: route.location } : undefined)
  res.end()
})
server.listen(0, '127.0.0.1', () => console.log('PORT=' + server.address().port))
`

  const writeQueueFile = (name: string, payload: unknown) => {
    const file = path.join(dir, name)
    writeTextFile(file, JSON.stringify(payload, null, 2))
    return file
  }

  const readQueueFile = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))

  const queueAt = (urls: string[], indexedUrls: string[] = []) => ({
    batches: [
      {
        day: 1,
        urls: urls.map((route) => `${origin}${route}`),
        indexCheck: {
          checkedAt: '2026-08-10',
          indexed: indexedUrls.length,
          of: urls.length,
          indexedUrls: indexedUrls.map((route) => `${origin}${route}`),
        },
      },
    ],
    details: urls.map((route, index) => ({
      id: index + 1,
      url: `${origin}${route}`,
      state: 'URL неизвестен Google',
      renamedFrom: [],
    })),
  })

  beforeAll(async () => {
    dir = makeTempDir('seo-index-queue-')
    server = await startStubServer(SERVER_SOURCE, dir)
    origin = server.origin
  })

  afterAll(() => {
    server.stop()
    removeDir(dir)
  })

  it('находит переехавший и мёртвый адрес и возвращает ненулевой код', () => {
    const file = writeQueueFile(
      'mixed.json',
      queueAt(['/travels/alive', '/travels/moved-old', '/travels/gone', '/travels/moved-to-nowhere']),
    )

    const result = runNodeCli([SCRIPT, '--queue', file])

    expect(result.status).toBe(1)
    expect(result.stdout).toContain(`${origin}/travels/moved-old`)
    expect(result.stdout).toContain(`${origin}/travels/gone`)
    expect(result.stdout).toContain('Не-200 в очереди: 3')
    // Ожидаемый исход печатается одной строкой: трасса вызовов тут только шум,
    // разбор по каждому адресу уже выведен выше.
    expect(result.stderr).toContain('[seo-index-queue] не-200 в очереди: 3')
    expect(result.stderr).not.toContain('    at ')
    // Живой адрес в отбраковку не попал — иначе проверка ловит саму себя.
    expect(result.stdout).toContain('✅ живые: 1')
    // Файл не тронут: без --fix проверка ничего не переписывает.
    expect(readQueueFile(file).batches[0].urls[1]).toBe(`${origin}/travels/moved-old`)
  })

  it('исключает не-200 из знаменателя доли и называет их поимённо', () => {
    const file = writeQueueFile(
      'share.json',
      queueAt(['/travels/alive', '/travels/moved-old', '/travels/gone'], ['/travels/alive']),
    )

    const result = runNodeCli([SCRIPT, '--queue', file, '--json'])
    const report = JSON.parse(result.stdout)

    expect(result.status).toBe(1)
    expect(report.progress).toMatchObject({ checked: 3, eligible: 1, indexed: 1, share: 100 })
    expect(report.progress.excluded.map((row: { url: string }) => row.url)).toEqual([
      `${origin}/travels/moved-old`,
      `${origin}/travels/gone`,
    ])
  })

  it('переписывает протухшую запись на цель переезда прямо в файле очереди', () => {
    const file = writeQueueFile('fix.json', queueAt(['/travels/alive', '/travels/moved-old']))

    const result = runNodeCli([SCRIPT, '--queue', file, '--fix'])
    const queue = readQueueFile(file)

    expect(result.status).toBe(0)
    expect(queue.batches[0].urls).toEqual([`${origin}/travels/alive`, `${origin}/travels/moved-new`])
    expect(queue.details[1]).toMatchObject({
      url: `${origin}/travels/moved-new`,
      renamedFrom: ['moved-old'],
    })
    expect(queue.details[1].staleRedirectFixedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Контроль: живая запись осталась ровно такой, какой была.
    expect(queue.details[0]).toEqual({
      id: 1,
      url: `${origin}/travels/alive`,
      state: 'URL неизвестен Google',
      renamedFrom: [],
    })
  })

  // `scripts/seo-index-queue.json` лежит в репозитории с завершающим переводом
  // строки. Пока `--fix` писал без него, к содержательной правке молча
  // подмешивался хвостовой однобайтовый diff («\ No newline at end of file»),
  // которого никто не заказывал. Проверяем не наличие «\n» на конце, а
  // побайтовое совпадение с той сериализацией, о которой говорит комментарий
  // над writeQueue: иначе тест переживёт и смену отступа, и потерю новой строки.
  it('--fix пишет файл ровно в том виде, в каком очередь лежит в репозитории', () => {
    const file = writeQueueFile('fix-bytes.json', queueAt(['/travels/alive', '/travels/moved-old']))

    expect(runNodeCli([SCRIPT, '--queue', file, '--fix']).status).toBe(0)

    const raw = fs.readFileSync(file, 'utf8')
    expect(raw).toBe(`${JSON.stringify(JSON.parse(raw), null, 2)}\n`)
    expect(raw.endsWith('\n\n')).toBe(false)
  })

  it('--fix не выдаёт зелёный, пока в очереди остаётся мёртвый адрес', () => {
    const file = writeQueueFile('fix-dead.json', queueAt(['/travels/moved-old', '/travels/gone']))

    const result = runNodeCli([SCRIPT, '--queue', file, '--fix'])

    expect(result.status).toBe(1)
    expect(readQueueFile(file).batches[0].urls[0]).toBe(`${origin}/travels/moved-new`)
    expect(readQueueFile(file).batches[0].urls[1]).toBe(`${origin}/travels/gone`)
  })

  it('не выдаёт пачку на подачу, пока в ней есть не-200, и файл не создаёт', () => {
    const file = writeQueueFile('batch-dirty.json', queueAt(['/travels/alive', '/travels/gone']))
    const out = path.join(dir, 'batch-dirty.txt')

    const result = runNodeCli([SCRIPT, '--queue', file, '--batch', '1', '--out', out])

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(fs.existsSync(out)).toBe(false)
  })

  it('в машиночитаемом режиме кладёт пачку в отчёт, а не поверх JSON', () => {
    const file = writeQueueFile('batch-json.json', queueAt(['/travels/alive', '/travels/moved-new']))

    const result = runNodeCli([SCRIPT, '--queue', file, '--batch', '1', '--json'])

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout).batchUrls).toEqual([
      `${origin}/travels/alive`,
      `${origin}/travels/moved-new`,
    ])
  })

  it('в машиночитаемом режиме не отдаёт грязную пачку ни одним полем', () => {
    const file = writeQueueFile('batch-json-dirty.json', queueAt(['/travels/alive', '/travels/gone']))

    const result = runNodeCli([SCRIPT, '--queue', file, '--batch', '1', '--json'])
    const report = JSON.parse(result.stdout)

    expect(result.status).toBe(1)
    expect(report.failed).toBe(1)
    expect(report.batchUrls).toBeUndefined()
  })

  it('выдаёт проверенную пачку для indexnow-submit --urls-file', () => {
    const file = writeQueueFile('batch-clean.json', queueAt(['/travels/alive', '/travels/moved-new']))
    const out = path.join(dir, 'batch-clean.txt')

    const result = runNodeCli([SCRIPT, '--queue', file, '--batch', '1', '--out', out])

    expect(result.status).toBe(0)
    expect(fs.readFileSync(out, 'utf8')).toBe(
      `${origin}/travels/alive\n${origin}/travels/moved-new\n`,
    )
  })

  it('пустая или нечитаемая очередь — это ошибка, а не «проблем нет»', () => {
    const file = writeQueueFile('empty.json', { batches: [], details: [] })

    const result = runNodeCli([SCRIPT, '--queue', file])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('returned 0 URLs — refusing to report success')
  })
})

describe('очередь индексации: код возврата CLI', () => {
  it('печатает справку и выходит с нулём', () => {
    const result = runNodeCli([SCRIPT, '--help'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Live-status gate for the indexing queue')
    expect(result.stdout).not.toContain('Проверяю статус')
  })

  it('на незнакомый флаг печатает справку в stderr и не идёт в сеть', () => {
    const result = runNodeCli([SCRIPT, '--nonsense'])

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Unknown argument: --nonsense')
    expect(result.stderr).toContain('Exit codes:')
    expect(result.stdout).not.toContain('Проверяю статус')
  })

  it('main падает, когда в очереди остался не-200, и не глотает это в код 0', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const queue = makeQueue()
    const probe = probeFrom({
      'https://metravel.by/travels/alive': { status: 200 },
      'https://metravel.by/travels/moved-old': { status: 301, location: '/travels/moved-new' },
      'https://metravel.by/travels/moved-new': { status: 200 },
      'https://metravel.by/travels/gone': { status: 404 },
    })

    try {
      await expect(
        main(argvOf('--queue', 'in-memory.json'), {
          probe,
          readQueue: () => queue,
          writeQueue: () => undefined,
        }),
      ).rejects.toThrow('не-200 в очереди: 2')
      // Разбор по каждому адресу уже напечатан — код возврата не единственный сигнал.
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('💀 Мёртвые адреса'))
    } finally {
      logSpy.mockRestore()
    }
  })

  it('main отдаёт отчёт, когда очередь чистая', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const queue = makeQueue()
    const probe = probeFrom({
      'https://metravel.by/travels/alive': { status: 200 },
      'https://metravel.by/travels/moved-old': { status: 200 },
      'https://metravel.by/travels/gone': { status: 200 },
    })

    try {
      const report = await main(argvOf('--queue', 'in-memory.json'), {
        probe,
        readQueue: () => queue,
      })

      expect(report).toMatchObject({ failed: 0, probed: 3, counts: { ok: 3 } })
    } finally {
      logSpy.mockRestore()
    }
  })
})
