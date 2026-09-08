/**
 * Contract tests for the prod artifact config gate (board #1881).
 *
 * The private-IP mask has been there since the LAN-URL incident, but loopback
 * was outside it. On 2026-09-08 the shared `.env` ended up carrying
 * `EXPO_PUBLIC_API_URL=http://127.0.0.1:8085`, left over from a neighbouring
 * e2e run whose web server was already dead — an artifact built from it would
 * have shipped a dead API base and passed this gate untouched.
 *
 * The mask must stay narrow at the same time: `localhost` and `192.168.` appear
 * as bare literals in runtime host-detection code, and a gate that reddens on
 * every prod build is a gate nobody keeps.
 */

import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runNodeCli, writeTextFile } from './cli-test-utils'

const SCRIPT = 'scripts/verify-prod-config.js'

function envProdVar(key: string): string {
  const file = path.resolve(process.cwd(), '.env.prod')
  if (!fs.existsSync(file)) return ''
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1 || line.slice(0, eq).trim() !== key) continue
    return line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

// The gate also asserts that the analytics ids from .env.prod reached the HTML.
// The fixture carries whichever ids this machine has, so the loopback assertions
// below fail for the loopback reason and nothing else.
const analyticsIds = [
  envProdVar('EXPO_PUBLIC_METRIKA_ID'),
  envProdVar('EXPO_PUBLIC_GOOGLE_GA4'),
].filter(Boolean)

const INDEX_HTML =
  '<!doctype html><html><head><script>/* analytics ' +
  `${analyticsIds.join(' ')} */</script></head><body></body></html>\n`

describe('verify-prod-config non-public API leak gate', () => {
  let dist: string

  const writeIndex = (extra = '') => {
    writeTextFile(path.join(dist, 'index.html'), INDEX_HTML.replace('</body>', `${extra}</body>`))
  }

  const writeChunk = (content: string) => {
    writeTextFile(path.join(dist, '_expo', 'static', 'js', 'entry-abc.js'), content)
  }

  const run = () => runNodeCli([SCRIPT, '--dist', dist])

  beforeEach(() => {
    dist = makeTempDir('verify-prod-config-')
    writeIndex()
  })

  afterEach(() => {
    removeDir(dist)
  })

  it('accepts an artifact that points at the public API', () => {
    writeChunk('const API="https://metravel.by/api";export{API};\n')

    const result = run()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('no LAN/dev/local leak')
  })

  it.each([
    ['loopback IP', 'const API="http://127.0.0.1:8085";'],
    ['loopback hostname', 'const API="http://localhost:8000";'],
    ['LAN IP', 'const API="http://192.168.50.36";'],
  ])('rejects a bundle carrying a %s API base', (_label, chunk) => {
    writeChunk(`${chunk}export{API};\n`)

    const result = run()

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('API URL leaked into prod build')
    expect(result.stderr).toContain('entry-abc.js')
  })

  it('rejects a loopback API base inlined into index.html', () => {
    writeIndex('<script>window.__API__="http://127.0.0.1:8085"</script>')

    const result = run()

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('API URL leaked into prod build')
    expect(result.stderr).toContain('index.html')
  })

  it('does not redden on host-detection literals that legitimately ship', () => {
    writeChunk(
      [
        'const isLan=location.hostname.startsWith("192.168.");',
        'const isLocal=location.hostname==="localhost"||location.hostname==="127.0.0.1";',
        'const cdn="https://localhost-cdn.example.com/assets";',
        'export{isLan,isLocal,cdn};',
      ].join('\n'),
    )

    const result = run()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('no LAN/dev/local leak')
  })
})
