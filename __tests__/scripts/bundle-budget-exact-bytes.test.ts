import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils'

const guard = path.resolve('scripts/guard-bundle-budget.js')
const brotli = (source: string) => zlib.brotliCompressSync(Buffer.from(source), {
  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
}).length

function fixture() {
  const dir = makeTempDir('bundle-exact-bytes-')
  const js = path.join(dir, 'js')
  const html = path.join(dir, 'html')
  const config = path.join(dir, 'budget.json')
  const contract = path.join(dir, 'contract.test.ts')
  fs.mkdirSync(js)
  fs.mkdirSync(html)
  const body = 'globalThis.fixturePayload="entry";'
  // Loader metadata belongs to delivered bytes, although the legacy named-KiB
  // check intentionally strips it. Keep the payload deterministic.
  const chunkPath = Array.from({ length: 80 }, (_, i) => `${i.toString(36)}chunk${i * 17}`).join('/')
  const source = body + `__d(function(){},1,{"0":7,"paths":{"1":"/${chunkPath}.js"}});`
  const stripped = body + '__d(function(){},1,{"0":7});'
  const bytes = brotli(source)
  fs.writeFileSync(path.join(js, 'entry-abcdef.js'), source)
  fs.writeFileSync(path.join(html, 'index.html'), '<script src="/_expo/static/js/web/entry-abcdef.js"></script>')
  const budget: any = {
    tolerancePct: 100,
    chunks: { entry: { maxBrotliKB: 1, maxBrotliBytes: bytes } },
    eager: {
      chunks: ['entry'], htmlRoutes: true, maxBrotliKB: 1, tolerancePct: 100,
      maxRequests: 1, maxRequestsByRoute: { 'index.html': 1 },
      maxBrotliBytesByRoute: { '(tabs)/index.html': bytes },
    },
  }
  fs.writeFileSync(contract, '// bundle-budget-sync:eager-requests:start\n// {"maxRequests":1,"maxRequestsByRoute":{"index.html":1}}\n// bundle-budget-sync:eager-requests:end\n')
  const save = () => fs.writeFileSync(config, JSON.stringify(budget))
  save()
  const run = (...args: string[]) => runNodeCli([guard, ...args], {
    BUNDLE_BUDGET_JS_DIR: js, BUNDLE_BUDGET_HTML_DIR: html,
    BUNDLE_BUDGET_CONFIG: config, BUNDLE_BUDGET_CONTRACT_TEST: contract,
    BUNDLE_BUDGET_REPORT_DIR: path.join(dir, 'reports'),
  })
  return { dir, js, html, config, budget, source, stripped, bytes, save, run }
}

describe('exact delivered Brotli byte ceilings', () => {
  it('passes equality, then fails one-byte entry growth despite legacy tolerance, including loader metadata', () => {
    const f = fixture()
    try {
      expect(f.bytes).toBeGreaterThan(brotli(f.stripped))
      expect(f.run('--fail', '--json').status).toBe(0)
      f.budget.chunks.entry.maxBrotliBytes = f.bytes - 1
      f.save()
      const result = f.run('--fail', '--json', '--report')
      expect(result.status).toBe(1)
      const report = JSON.parse(result.stdout).diagnostic_report
      expect(report.breaches).toEqual([{
        label: 'entry (brotli bytes)', actual: f.bytes, limit: f.bytes - 1,
        unit: 'bytes', policy: 'exact_bytes', basis: 'full_chunk_with_loader_metadata',
      }])
      expect(report.measurements.files['entry-abcdef.js'].brotli).toBe(f.bytes)
      // The same report must survive persisted-report validation, not just JSON output.
      const { readReport } = require('../../scripts/lib/bundleBudgetReport')
      const [saved] = fs.readdirSync(path.join(f.dir, 'reports'))
      expect(readReport(path.join(f.dir, 'reports', saved))).toEqual(report)
      const text = f.run('--fail')
      expect(text.status).toBe(1)
      expect(text.stdout).toContain(`entry (brotli bytes): ${f.bytes} B > ${f.bytes - 1} B`)
      delete f.budget.chunks.entry.maxBrotliBytes
      f.save()
      expect(f.run('--fail', '--json').status).toBe(0)
    } finally { removeDir(f.dir) }
  })

  it('checks the normalized home HTML script set with no spare byte', () => {
    const f = fixture()
    try {
      f.budget.eager.maxBrotliBytesByRoute['(tabs)/index.html'] = f.bytes - 1
      f.save()
      const result = f.run('--fail', '--json')
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).diagnostic_report.breaches).toEqual([{
        label: 'EAGER (brotli bytes, index.html)', actual: f.bytes, limit: f.bytes - 1,
        unit: 'bytes', policy: 'exact_bytes', basis: 'html_scripts_with_loader_metadata',
      }])
    } finally { removeDir(f.dir) }
  })

  it('fails closed when a byte-pinned chunk or route disappears', () => {
    const f = fixture()
    try {
      fs.renameSync(path.join(f.html, 'index.html'), path.join(f.html, 'search.html'))
      let result = f.run('--fail', '--json')
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).breaches).toContainEqual({ label: 'Exact byte route missing from build: index.html', missing: true })
      fs.renameSync(path.join(f.js, 'entry-abcdef.js'), path.join(f.js, 'other-abcdef.js'))
      result = f.run('--fail', '--json')
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).breaches).toContainEqual({ label: 'Exact byte chunk missing from build: entry', missing: true })
      expect(f.run('--update').status).toBe(1)
    } finally { removeDir(f.dir) }
  })

  it.each([null, -1, 0.5, '123', Number.MAX_SAFE_INTEGER + 1])('rejects malformed byte value %p', (value) => {
    const f = fixture()
    try {
      f.budget.chunks.entry.maxBrotliBytes = value
      f.save()
      const result = f.run('--fail')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('chunks.entry.maxBrotliBytes must be a non-negative safe integer')
    } finally { removeDir(f.dir) }
  })

  it.each([null, [], { '../index.html': 1 }, { 'index.html': null }])('rejects malformed route pin %p', (value) => {
    const f = fixture()
    try {
      f.budget.eager.maxBrotliBytesByRoute = value
      f.save()
      const result = f.run('--fail')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('eager.maxBrotliBytesByRoute')
    } finally { removeDir(f.dir) }
  })

  it('does not substitute configured stripped chunks when an exact HTML measurement is requested', () => {
    const f = fixture()
    try {
      f.budget.eager.htmlRoutes = false
      f.save()
      const result = f.run('--fail')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('requires htmlRoutes=true')
    } finally { removeDir(f.dir) }
  })

  it('keeps exact ratchets on update rather than granting measured growth', () => {
    const f = fixture()
    try {
      f.budget.chunks.entry.maxBrotliBytes = f.bytes - 1
      f.budget.eager.maxBrotliBytesByRoute['(tabs)/index.html'] = f.bytes - 2
      f.save()
      expect(f.run('--update').status).toBe(0)
      const updated = JSON.parse(fs.readFileSync(f.config, 'utf8'))
      expect(updated.chunks.entry.maxBrotliBytes).toBe(f.bytes - 1)
      expect(updated.eager.maxBrotliBytesByRoute).toEqual({ '(tabs)/index.html': f.bytes - 2 })
      expect(f.run('--fail', '--json').status).toBe(1)
    } finally { removeDir(f.dir) }
  })
})
