/**
 * Ready brotli copies of the release's hashed JS/CSS (board #2484).
 *
 * Prod nginx serves `<file>.br` as is (`brotli_static on`) and otherwise
 * compresses on the fly at level 6. A copy that differs from its source would
 * be served instead of the new chunk, so the contract is byte equality:
 *   1. every JS/CSS asset gets a q11 copy that unpacks to exactly its bytes,
 *      and the copy is smaller than the q6 nginx would produce;
 *   2. `--verify` refuses a stale, corrupt or orphaned copy before upload;
 *   3. a rerun replaces copies and removes orphans left by an earlier run.
 */

import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils'

const script = path.resolve(process.cwd(), 'scripts/precompress-static-assets.js')

// Text that compresses like a real chunk: repeated identifiers plus noise.
const chunk = (seed: number, size: number) => {
  let out = `__d(function(g,r,i,a,m,e,d){e.catalog=new Map([`
  let state = seed
  while (out.length < size) {
    state = (state * 1103515245 + 12345) % 2147483648
    out += `[${state},{value:"Пераклад ${state.toString(36)} недаступны"}],`
  }
  return `${out}])},${seed},[]);`
}

describe('precompress-static-assets', () => {
  let dist: string
  let webDir: string

  beforeEach(() => {
    dist = makeTempDir('metravel-precompress-')
    webDir = path.join(dist, '_expo/static/js/web')
    fs.mkdirSync(webDir, { recursive: true })
    fs.mkdirSync(path.join(dist, '_expo/static/css'), { recursive: true })
    fs.writeFileSync(path.join(webDir, 'locale-be-a1aa0192.js'), chunk(1, 200_000))
    fs.writeFileSync(path.join(webDir, 'entry-71218.js'), chunk(2, 50_000))
    fs.writeFileSync(path.join(dist, '_expo/static/css/global-ed12.css'), 'body{margin:0}'.repeat(400))
    fs.writeFileSync(path.join(webDir, 'tiny.js'), 'x')
    fs.writeFileSync(path.join(dist, 'index.html'), '<html></html>'.repeat(200))
  })

  afterEach(() => removeDir(dist))

  it('writes q11 copies that unpack to the exact source bytes', () => {
    const result = runNodeCli([script, dist])
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)

    for (const relative of ['js/web/locale-be-a1aa0192.js', 'js/web/entry-71218.js', 'css/global-ed12.css']) {
      const source = fs.readFileSync(path.join(dist, '_expo/static', relative))
      const copy = fs.readFileSync(path.join(dist, '_expo/static', `${relative}.br`))
      expect(zlib.brotliDecompressSync(copy).equals(source)).toBe(true)
      const q6 = zlib.brotliCompressSync(source, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } })
      expect(copy.length).toBeLessThan(q6.length)
    }
    // Nothing to gain on a one-byte file; HTML is outside the static tree.
    expect(fs.existsSync(path.join(webDir, 'tiny.js.br'))).toBe(false)
    expect(fs.existsSync(path.join(dist, 'index.html.br'))).toBe(false)
    expect(fs.readdirSync(webDir).filter((name) => name.includes('.tmp-'))).toEqual([])
  })

  it('refuses a copy that no longer matches its source', () => {
    expect(runNodeCli([script, dist]).status).toBe(0)
    fs.writeFileSync(path.join(webDir, 'entry-71218.js'), chunk(3, 50_000))

    const result = runNodeCli([script, '--verify', dist])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('_expo/static/js/web/entry-71218.js.br: differs from its source')
  })

  it('refuses corrupt and orphaned copies', () => {
    expect(runNodeCli([script, dist]).status).toBe(0)
    fs.writeFileSync(path.join(webDir, 'locale-be-a1aa0192.js.br'), 'not brotli')
    fs.writeFileSync(path.join(webDir, 'gone-123.js.br'), zlib.brotliCompressSync(Buffer.from('old')))

    const result = runNodeCli([script, '--verify', dist])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('locale-be-a1aa0192.js.br: not valid brotli')
    expect(result.stderr).toContain('gone-123.js.br: source file is missing')
  })

  it('a rerun refreshes stale copies and drops orphans', () => {
    expect(runNodeCli([script, dist]).status).toBe(0)
    fs.writeFileSync(path.join(webDir, 'entry-71218.js'), chunk(4, 50_000))
    fs.writeFileSync(path.join(webDir, 'gone-123.js.br'), zlib.brotliCompressSync(Buffer.from('old')))

    expect(runNodeCli([script, dist]).status).toBe(0)
    expect(fs.existsSync(path.join(webDir, 'gone-123.js.br'))).toBe(false)
    expect(runNodeCli([script, '--verify', dist]).status).toBe(0)
  })

  it('fails without an Expo static tree', () => {
    const empty = makeTempDir('metravel-precompress-empty-')
    try {
      const result = runNodeCli([script, empty])
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('no _expo/static under')
    } finally {
      removeDir(empty)
    }
  })
})
