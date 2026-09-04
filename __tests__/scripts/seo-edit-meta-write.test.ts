/**
 * CLI-контракт `--meta` у scripts/seo-edit.js — #1759 (снятие отказа #1716).
 *
 * Пока `TravelUpsertSerializer` поле `meta_description` не объявлял, DRF срезал
 * его на валидации, а GET не отдавал вовсе: скрипт отказывал на `--meta` до
 * первого запроса, потому что записать половину просьбы и отрапортовать «OK» —
 * то же враньё, что и откат по ложной тревоге, только тише. #1737 объявил поле
 * и научил GET его сериализовать, поэтому отказ снят, а честность держится уже
 * не запретом, а круговой сверкой: значение перечитывается и сверяется
 * байт-в-байт.
 *
 * Здесь проверяется ровно эта развилка, а не сам upsert: `--meta` доезжает до
 * записи, совпавшее значение даёт успех, а ответ БЕЗ ключа `meta_description`
 * (сервер снова срезал поле) обязан сказать «записано, но не проверено» и выйти
 * ненулевым кодом — молчаливый «✅ OK» здесь и есть регрессия #1716.
 *
 * Четвёртый прогон — БЕЗ `--meta`. С #1737 эхо `meta_description` из детали в
 * payload перестало быть холостым: раньше бэкенд его срезал, теперь пишет. То
 * есть каждая правка тела теперь ещё и перезаписывает мету собственным
 * значением, и «переехало как было» надо доказывать, а не предполагать.
 *
 * Спавним настоящий процесс: проверяемое живёт в main(), а не в чистой функции.
 */

import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli, startStubServer } from './cli-test-utils'

const ROOT = path.join(__dirname, '..', '..')
const OLD_META = 'Старая мета статьи'

/**
 * Стенд с записью: PUT запоминает присланное `meta_description`, и следующий
 * GET отдаёт именно его — то есть круговая сверка проверяет тракт, а не
 * заранее захардкоженный ответ. Каждое тело PUT дописывается в `putLog`, откуда
 * тест читает и что ушло на сервер, и сколько было записей: «отката не было» —
 * это ровно один PUT, а не отсутствие строки в stderr.
 *
 * `omitMeta` воспроизводит поведение сервера до #1737: значение принято, но
 * в ответе GET ключа нет вовсе.
 */
const serverSource = (omitMeta: boolean, putLog: string) => `
const fs = require('fs')
const http = require('http')

const omitMeta = ${omitMeta}
const putLog = ${JSON.stringify(putLog)}
let storedMeta = ${JSON.stringify(OLD_META)}
const puts = []

const server = http.createServer((req, res) => {
  if (req.method === 'PUT') {
    // setEncoding, а не склейка буферов: без него кириллица, разорванная на
    // границе чанка, вернулась бы с U+FFFD и уронила байт-сверку по вине
    // стенда, а не скрипта (#1649).
    req.setEncoding('utf8')
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      let parsed
      try {
        parsed = JSON.parse(body)
      } catch (e) {
        parsed = { parseError: String((e && e.message) || e) }
      }
      if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'meta_description')) {
        storedMeta = parsed.meta_description
      }
      puts.push(parsed)
      // Синхронно и ДО ответа: иначе CLI успел бы завершиться раньше записи.
      fs.writeFileSync(putLog, JSON.stringify(puts), 'utf8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: 990301 }))
    })
    return
  }
  const detail = {
    id: 990301,
    name: 'Статья под проверку',
    slug: 'statya',
    description: '<p>тело</p>',
    publish: true,
    moderation: true,
    gallery: [],
    coordsMeTravel: [],
  }
  if (!omitMeta) detail.meta_description = storedMeta
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(detail))
})

server.listen(0, '127.0.0.1', () => {
  process.stdout.write('PORT=' + server.address().port + '\\n')
})
`

const META = 'Живецкие Бескиды: маршрут, ночёвка и подъём'

type Run = ReturnType<typeof runCli>
type PutBody = Record<string, unknown>

/** Один прогон seo-edit против свежего стенда со своим каталогом бэкапов. */
const runAgainstStub = async (
  args: string[],
  { omitMeta = false }: { omitMeta?: boolean } = {},
): Promise<{ run: Run; backups: string[]; puts: PutBody[] }> => {
  const dir = makeTempDir('seo-edit-meta-')
  const backupDir = path.join(dir, 'backups')
  const putLog = path.join(dir, 'puts.json')
  try {
    const stub = await startStubServer(serverSource(omitMeta, putLog), dir)
    try {
      const run = runCli(
        process.execPath,
        ['scripts/seo-edit.js', '--id', '990301', '--backup-dir', backupDir, ...args],
        { cwd: ROOT, env: { METRAVEL_API: stub.origin, METRAVEL_TOKEN: 'test-token' } },
      )
      const backups = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : []
      const puts: PutBody[] = fs.existsSync(putLog)
        ? JSON.parse(fs.readFileSync(putLog, 'utf8'))
        : []
      return { run, backups, puts }
    } finally {
      stub.stop()
    }
  } finally {
    removeDir(dir)
  }
}

describe('seo-edit --meta write', () => {
  let dryRun: Run
  let dryRunBackups: string[]
  let dryRunPuts: PutBody[]
  let live: Run
  let livePuts: PutBody[]
  let omitted: Run
  let omittedPuts: PutBody[]
  let plain: Run
  let plainPuts: PutBody[]

  beforeAll(async () => {
    const dry = await runAgainstStub(['--meta', META, '--dry-run'])
    dryRun = dry.run
    dryRunBackups = dry.backups
    dryRunPuts = dry.puts

    const written = await runAgainstStub(['--meta', META])
    live = written.run
    livePuts = written.puts

    const withoutKey = await runAgainstStub(['--meta', META], { omitMeta: true })
    omitted = withoutKey.run
    omittedPuts = withoutKey.puts

    const noFlag = await runAgainstStub([])
    plain = noFlag.run
    plainPuts = noFlag.puts
  }, 40000)

  it('доезжает до плана правки и показывает будущее значение целиком', () => {
    expect(dryRun.status).toBe(0)
    expect(dryRun.stdout).toContain('travel #990301')
    expect(dryRun.stdout).toContain(`${JSON.stringify(OLD_META)} → ${JSON.stringify(META)}`)
  })

  it('в --dry-run не пишет ничего: ни PUT, ни бэкапа', () => {
    expect(dryRun.stdout).toContain('DRY RUN')
    expect(dryRun.stdout).not.toContain('PUT /travels/upsert/')
    expect(dryRun.stdout).not.toContain('💾 backup')
    expect(dryRunBackups).toEqual([])
    expect(dryRunPuts).toEqual([])
  })

  it('боевой вызов пишет мету и подтверждает её круговой сверкой', () => {
    expect(live.status).toBe(0)
    expect(live.stdout).toContain('PUT /travels/upsert/ → HTTP 200')
    expect(live.stdout).toContain('✅ OK')
    expect(live.stdout).toContain(`meta=${META.length} chars`)
    // На сервер ушло именно запрошенное значение, и ровно одним PUT: второй
    // означал бы откат.
    expect(livePuts).toHaveLength(1)
    expect(livePuts[0].meta_description).toBe(META)
    expect(live.stderr).not.toContain('Auto-rolling back')
  })

  it('ответ без ключа meta_description — «записано, но не проверено», а не «OK»', () => {
    expect(omitted.status).toBe(1)
    expect(omitted.stderr).toContain('записано, но не проверено')
    expect(omitted.stdout).not.toContain('✅ OK')
    // Тело статьи цело, откатывать нечего — ровно та ошибка #1716, из-за
    // которой правка на тысячи символов уезжала обратно. Доказательство — один
    // PUT в логе стенда, а не отсутствие строки в stderr.
    expect(omitted.stderr).toContain('откат не нужен')
    expect(omittedPuts).toHaveLength(1)
    expect(omittedPuts[0].meta_description).toBe(META)
  })

  it('без --meta мета переезжает из детали как была, а не обнуляется', () => {
    expect(plain.status).toBe(0)
    expect(plain.stdout).toContain('✅ OK')
    // Плана по мете нет — её не просили менять.
    expect(plain.stdout).not.toContain('  meta:')
    expect(plain.stdout).not.toContain('meta=')
    expect(plainPuts).toHaveLength(1)
    expect(plainPuts[0]).toHaveProperty('meta_description', OLD_META)
  })
})
