/**
 * End-to-end guard for every way `scripts/seo-rename.js` can fail: whatever
 * went wrong, the run must exit non-zero and say what is still live.
 *
 * Four separate holes live here, none of them visible from a unit test:
 *   - `break` alone left main() resolving normally, so runSeoCli exited 0 and a
 *     run aborted *because the pipeline is damaging content* printed
 *     "Done: 0 renamed" and reported success to the operator and to CI;
 *   - continuing to the next entry would write the same corruption into every
 *     remaining article, which is the failure #1649 exists to prevent;
 *   - the rollback is a network call too. When it threw, that plain Error
 *     replaced the TextCorruptionError, `isTextCorruptionError` said no, and
 *     both of the above came back at once. Its other half — a non-2xx answer —
 *     exited inside restoreFromBackup(), so the message naming the article left
 *     live under the wrong title could never print;
 *   - a batch in which EVERY entry failed its GET printed "Dry-run complete."
 *     and exited 0, because renameOne() returned the same `null` for «skipped»
 *     and for «failed». That is the #1325 shape.
 *
 * So the script is spawned for real against a stub API, and the assertions are
 * on the exit code and on what the stub was actually asked to write.
 */

import fs from 'fs'
import http from 'http'
import path from 'path'

import { makeTempDir, removeDir, runCli, startStubServer, writeJsonFile, type StubServer } from './cli-test-utils'

const ROOT = path.join(__dirname, '..', '..')
const BACKUP_DIR = path.join(ROOT, 'scripts', '.seo-backups')
const MANIFEST = path.join(ROOT, 'scripts', 'seo-redirects.json')

/** Ids far outside the real catalogue, so no live backup can be picked up. */
const FIRST = 990239
const SECOND = 990240

const CLEAN = 'Голубые озёра: маршрут по Беларуси. '.repeat(60)
/** Exactly what a code point split across a chunk boundary leaves behind. */
const MANGLED = CLEAN.replace('озёра', 'оз��ра')

/**
 * Stub API. Source lives in a string because the server runs in its own
 * process: the CLI under test is spawned synchronously, so a server inside Jest
 * would never get to answer it.
 *
 * `failRollback` breaks the second PUT — the rollback — either by dropping the
 * socket ('socket') or by answering 500 ('http'); those are two different code
 * paths in restoreFromBackup(). `failGet` refuses every read with 401, the way
 * a stale service token does.
 */
type StubOptions = { failRollback?: false | 'socket' | 'http'; failGet?: boolean }

const serverSource = ({ failRollback = false, failGet = false }: StubOptions) => `
const http = require('http')

const CLEAN = ${JSON.stringify(CLEAN)}
const MANGLED = ${JSON.stringify(MANGLED)}
const FAIL_ROLLBACK = ${JSON.stringify(failRollback)}
const FAIL_GET = ${failGet}
const writes = []
let reads = 0

const article = (id, name, slug) => ({
  id, name, slug, description: CLEAN,
  meta_description: 'Маршрут по Беларуси',
  publish: true, moderation: true,
  gallery: [{ id: 1 }, { id: 2 }], coordsMeTravel: [{ id: 1 }],
  year: 2025, categories: [20], countries: [160],
})

const state = {
  ${FIRST}: article(${FIRST}, 'Старое имя', 'staroe-imya'),
  ${SECOND}: article(${SECOND}, 'Другое старое', 'drugoe-staroe'),
}

const readBody = (req) => new Promise((resolve) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    resolve(raw ? JSON.parse(raw) : {})
  })
})

const json = (res, payload) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/__writes') return json(res, writes)

  if (req.method === 'PUT' && req.url === '/api/travels/upsert/') {
    const payload = await readBody(req)
    writes.push({ id: payload.id, name: payload.name })
    if (FAIL_ROLLBACK && writes.length === 2) {
      // res, not req: dropping the RESPONSE socket makes the client see
      // ECONNRESET at once, while destroying the request leaves it waiting out
      // its own 60 s timeout.
      if (FAIL_ROLLBACK === 'socket') return res.destroy()
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: 'upsert refused' }))
    }
    const row = state[payload.id]
    if (row) { row.name = payload.name; row.slug = 'novyi-slug-' + payload.id }
    return json(res, {})
  }

  const match = /^\\/api\\/travels\\/(\\d+)\\/$/.exec(req.url || '')
  if (req.method === 'GET' && FAIL_GET) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ detail: 'Invalid token.' }))
  }
  if (req.method === 'GET' && match && state[match[1]]) {
    reads += 1
    const row = { ...state[match[1]] }
    // The verification GET — the second read of the first article — is the one
    // that hands back mangled text, exactly as a per-chunk decode would.
    if (reads === 2) row.description = MANGLED
    return json(res, row)
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end('{}')
})

server.listen(0, '127.0.0.1', () => {
  process.stdout.write('PORT=' + server.address().port + '\\n')
})
`

const getJson = (url: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', reject)
  })

type Run = { result: ReturnType<typeof runCli>; writes: Array<{ id: number; name: string }> }

describe('#1649 — a mangled re-read stops the batch and fails the run', () => {
  let backupsBefore: string[] = []
  let manifestBefore = ''
  const stubs: StubServer[] = []

  /** Spawn the real CLI over a two-entry batch against a fresh stub. */
  const renameBatch = async (options: StubOptions): Promise<Run> => {
    const dir = makeTempDir('seo-1649-')
    try {
      const mapFile = path.join(dir, 'renames.json')
      writeJsonFile(mapFile, [
        { id: FIRST, name: 'Новое имя первой' },
        { id: SECOND, name: 'Новое имя второй' },
      ])
      const stub = await startStubServer(serverSource(options), dir)
      stubs.push(stub)
      const result = runCli(process.execPath, ['scripts/seo-rename.js', '--map-file', mapFile], {
        cwd: ROOT,
        env: { METRAVEL_API: stub.origin, METRAVEL_TOKEN: 'stub-token' },
      })
      const writes = (await getJson(`${stub.origin}/__writes`)) as Run['writes']
      return { result, writes }
    } finally {
      removeDir(dir)
    }
  }

  let clean: Run
  let brokenSocketRollback: Run
  let brokenHttpRollback: Run
  let deadReads: Run

  beforeAll(async () => {
    backupsBefore = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR) : []
    manifestBefore = fs.readFileSync(MANIFEST, 'utf8')
    clean = await renameBatch({})
    brokenSocketRollback = await renameBatch({ failRollback: 'socket' })
    brokenHttpRollback = await renameBatch({ failRollback: 'http' })
    deadReads = await renameBatch({ failGet: true })
  }, 40000)

  afterAll(() => {
    for (const stub of stubs) stub.stop()
    // The spawned CLI appends to the TRACKED redirect manifest as soon as one
    // rename lands — which is precisely what happens when the abort gate
    // regresses and these tests fail. Left behind, it rides out on the next
    // `git add -A` in this shared tree.
    if (fs.readFileSync(MANIFEST, 'utf8') !== manifestBefore) {
      fs.writeFileSync(MANIFEST, manifestBefore, 'utf8')
    }
    // Each aborted run writes a backup before its PUT; that directory is
    // gitignored working state, so only the files these runs created go.
    if (fs.existsSync(BACKUP_DIR)) {
      for (const file of fs.readdirSync(BACKUP_DIR)) {
        if (!backupsBefore.includes(file) && /^99023\d-/.test(file)) {
          fs.rmSync(path.join(BACKUP_DIR, file), { force: true })
        }
      }
    }
  })

  it('exits 1 instead of reporting a clean partial batch', () => {
    // Exit code first: a silent 0 is the exact failure mode this test exists for.
    expect(clean.result.status).toBe(1)
    expect(clean.result.stderr).toContain('TEXT CORRUPTION')
    expect(clean.result.stderr).toContain('U+FFFD')
    expect(clean.result.stderr).toContain('batch stopped')
  })

  it('rolls the first article back and never touches the second', () => {
    expect(clean.writes.map((entry) => entry.id)).toEqual([FIRST, FIRST])
    // The article is left under its original title, not the half-applied one.
    expect(clean.writes[clean.writes.length - 1].name).toBe('Старое имя')
  })

  it.each([
    ['a dropped socket', () => brokenSocketRollback],
    ['a 500 answer', () => brokenHttpRollback],
  ])('still aborts when the rollback fails with %s, and says the text is live', (_case, get) => {
    // Two different code paths: a rejecting restore used to replace
    // TextCorruptionError with a plain Error, and a non-2xx one used to
    // process.exit() inside restoreFromBackup() before the message was built.
    const run = get()
    expect(run.result.status).toBe(1)
    expect(run.result.stderr).toContain('rollback FAILED')
    expect(run.result.stderr).toContain('may still be live')
    expect(run.result.stderr).toContain('batch stopped')
    expect(run.writes.map((entry) => entry.id)).toEqual([FIRST, FIRST])
  })

  it('exits 1 when every entry fails its GET, instead of "Dry-run complete."', () => {
    // The original report: a stale token answered 401 to every read and the run
    // still reported success. renameOne() returned `null` for «failed» exactly
    // as it did for «skipped», so nothing counted.
    expect(deadReads.result.status).toBe(1)
    expect(deadReads.result.stderr).toContain('HTTP 401')
    expect(deadReads.result.stderr).toContain('2 of 2 entries failed')
    // Nothing was written, and the failure is not a corruption abort.
    expect(deadReads.writes).toEqual([])
    expect(deadReads.result.stderr).not.toContain('TEXT CORRUPTION')
  })

  it('leaves the redirect manifest untouched when nothing landed', () => {
    expect(fs.readFileSync(MANIFEST, 'utf8')).toBe(manifestBefore)
  })
})
