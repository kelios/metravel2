/**
 * CLI-контракт `--meta` у scripts/seo-edit.js — #1716.
 *
 * `TravelUpsertSerializer` на бэкенде поле `meta_description` не объявляет, и
 * DRF срезает его на валидации: до `UpsertTravelService.NON_RELATION_FIELDS`
 * доезжает не значение, а его отсутствие. Наличие поля в списке сервиса
 * доказывает намерение, но не приём — на проде мету несут 3 статьи из 462.
 *
 * Раньше скрипт этого не знал: он писал описание, не находил меты в ответе GET,
 * объявлял порчу текста и авто-откатом уносил заново собранное тело на тысячи
 * символов — при HTTP 200 на PUT. Поэтому отказ должен случиться ДО записи, а не
 * превратиться в предупреждение после неё: молча выполнить половину просьбы и
 * отрапортовать «OK» — то же враньё, что и ложная тревога, только тише.
 *
 * Спавним настоящий процесс: проверяемое живёт в main(), а не в чистой функции,
 * и главное утверждение теста — что до стенда НЕ дошло ни одного запроса.
 */

import path from 'path'

import { makeTempDir, removeDir, runCli, startStubServer } from './cli-test-utils'

const ROOT = path.join(__dirname, '..', '..')

/** Стенд отвечает на всё; главное — что скрипт к нему не обратится. */
const SERVER_SOURCE = `
const http = require('http')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  if (req.method === 'PUT') return res.end(JSON.stringify({ id: 990301 }))
  res.end(JSON.stringify({
    id: 990301,
    name: 'Статья под проверку',
    slug: 'statya',
    description: '<p>тело</p>',
    publish: true,
    moderation: true,
    gallery: [],
    coordsMeTravel: [],
  }))
})

server.listen(0, '127.0.0.1', () => {
  process.stdout.write('PORT=' + server.address().port + '\\n')
})
`

describe('seo-edit --meta refusal', () => {
  let run: ReturnType<typeof runCli>
  let withoutMeta: ReturnType<typeof runCli>

  beforeAll(async () => {
    const dir = makeTempDir('seo-edit-meta-')
    try {
      const stub = await startStubServer(SERVER_SOURCE, dir)
      try {
        run = runCli(
          process.execPath,
          ['scripts/seo-edit.js', '--id', '990301', '--meta', 'Новое описание для поиска'],
          { cwd: ROOT, env: { METRAVEL_API: stub.origin, METRAVEL_TOKEN: 'test-token' } },
        )
        // Контрольный прогон: без флага тот же вызов доходит до дела и просто
        // печатает план — значит отказ выше вызван именно `--meta`, а не общей
        // неработоспособностью скрипта на стенде.
        withoutMeta = runCli(
          process.execPath,
          ['scripts/seo-edit.js', '--id', '990301', '--dry-run'],
          { cwd: ROOT, env: { METRAVEL_API: stub.origin, METRAVEL_TOKEN: 'test-token' } },
        )
      } finally {
        stub.stop()
      }
    } finally {
      removeDir(dir)
    }
  }, 20000)

  it('отказывает до записи и называет причину, а не молчит про половину просьбы', () => {
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('--meta не поддерживается сервером')
    expect(run.stderr).toContain('#1737')
  })

  it('не пишет: ни PUT, ни бэкапа, ни рапорта об успехе', () => {
    expect(run.stdout).not.toContain('PUT /travels/upsert/')
    expect(run.stdout).not.toContain('💾 backup');
    expect(run.stdout).not.toContain('✅ OK')
  })

  it('без --meta тот же вызов доходит до плана правки', () => {
    expect(withoutMeta.status).toBe(0)
    expect(withoutMeta.stdout).toContain('DRY RUN')
  })
})
