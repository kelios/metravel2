/**
 * Exit-code guard for scripts/seo-mass-augment.js.
 *
 * The same hole as in seo-rename.js, one script over: the loop catches a failed
 * article, logs it, and carries on. The count even reached the printed summary
 * (`errors: N`) — and was then dropped on the floor, so a run in which every
 * single article threw exited 0 and read as a clean batch. This is the SEO-OPS
 * family the repo already guards against on the INPUT side (an empty selection
 * is refused); the processing loop was the other door into the same failure.
 *
 * Spawned for real against a stub API, because nothing below `main()` is
 * exported and the defect lives in what main() does with what it collected.
 */

import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli, startStubServer } from './cli-test-utils'

const ROOT = path.join(__dirname, '..', '..')
/** Gitignored working state (scripts/.seo-*.json), still worth not clobbering. */
const LOG_PATH = path.join(ROOT, 'scripts', '.seo-mass-augment.log.json')

/** Every detail read fails, so every article in the batch throws. */
const SERVER_SOURCE = `
const http = require('http')

const rows = [
  { id: 990241, name: 'Первая статья', slug: 'pervaya' },
  { id: 990242, name: 'Вторая статья', slug: 'vtoraya' },
]

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/travels/?')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ count: rows.length, results: rows }))
  }
  // Detail reads die the way a flaky upstream does.
  res.writeHead(500, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ detail: 'upstream exploded' }))
})

server.listen(0, '127.0.0.1', () => {
  process.stdout.write('PORT=' + server.address().port + '\\n')
})
`

describe('seo-mass-augment exit contract', () => {
  let run: ReturnType<typeof runCli>
  let logBefore: string | null = null

  beforeAll(async () => {
    logBefore = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8') : null
    const dir = makeTempDir('seo-mass-augment-')
    try {
      const stub = await startStubServer(SERVER_SOURCE, dir)
      try {
        run = runCli(process.execPath, ['scripts/seo-mass-augment.js', '--user-id', '1', '--dry-run'], {
          cwd: ROOT,
          env: { METRAVEL_API: stub.origin },
        })
      } finally {
        stub.stop()
      }
    } finally {
      removeDir(dir)
    }
  }, 20000)

  afterAll(() => {
    // The run rewrites its own log; put a developer's copy back.
    if (logBefore === null) fs.rmSync(LOG_PATH, { force: true })
    else fs.writeFileSync(LOG_PATH, logBefore, 'utf8')
  })

  it('exits 1 when every article in the batch failed', () => {
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('2 of 2 travel(s) failed')
  })

  it('still writes the log and the summary before failing', () => {
    // The throw goes AFTER the artefacts: an operator debugging the failures
    // needs the per-article log, and losing it to the exit path would be worse
    // than the silent success it replaces.
    expect(run.stdout).toContain('Summary:')
    expect(run.stdout).toContain('"errors": 2')
    expect(fs.existsSync(LOG_PATH)).toBe(true)
  })

  it('reports the failure as one line, not as a crash', () => {
    // ExpectedFailureError: the script ran correctly and found a problem.
    expect(run.stderr).not.toContain('    at ')
  })
})
