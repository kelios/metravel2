import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils'

const { createReportContext, persistReport, readReport, validateReport, MAX_REPORT_BYTES, MAX_AGE_MS, roundedByteLimit } = require('../../scripts/lib/bundleBudgetReport')
const root = process.cwd()
const guard = path.join(root, 'scripts/guard-bundle-budget.js')
const compare = path.join(root, 'scripts/compare-bundle-budget-reports.js')

function fixture() {
  const dir = makeTempDir('bundle-report-')
  const js = path.join(dir, 'worktree/js')
  const html = path.join(dir, 'worktree/html')
  const archive = path.join(dir, 'archive')
  const config = path.join(dir, 'worktree/budget.json')
  fs.mkdirSync(js, { recursive: true })
  fs.mkdirSync(html, { recursive: true })
  const source = 'var payloadMarker = "owner";'.repeat(7)
  fs.writeFileSync(path.join(js, 'entry-abcdef.js'), source)
  fs.writeFileSync(path.join(html, 'index.html'), '<script src="/_expo/static/js/web/entry-abcdef.js"></script>')
  fs.writeFileSync(path.join(html, 'search.html'), '<script src="/_expo/static/js/web/entry-abcdef.js"></script>')
  const budget = {
    tolerancePct: 0,
    chunks: { entry: { maxRawKB: 1, maxGzipKB: 1, maxBrotliKB: 1 } },
    total: { maxRawKB: 1, maxGzipKB: 1, maxBrotliKB: 1 },
    eager: {
      htmlRoutes: true, chunks: ['entry'], maxRequests: 1,
      maxRequestsByRoute: { 'index.html': 1, 'search.html': 1 },
      payloadRoutes: { owner: { marker: 'payloadMarker', maxRoutes: 2 } },
    },
  }
  const saveBudget = () => fs.writeFileSync(config, JSON.stringify(budget))
  saveBudget()
  const run = (...args: string[]) => runNodeCli([guard, '--fail', '--json', '--report', ...args], {
    BUNDLE_BUDGET_JS_DIR: js, BUNDLE_BUDGET_HTML_DIR: html, BUNDLE_BUDGET_CONFIG: config,
    BUNDLE_BUDGET_REPORT_DIR: archive,
  })
  return { dir, js, html, archive, config, source, budget, saveBudget, run }
}

const reportFiles = (directory: string): string[] => fs.readdirSync(directory).filter((name) => name.endsWith('.json')).map((name) => path.join(directory, name))

describe('exact bundle budget reports', () => {
  it('resolves toolchain versions from the requested root and keeps malformed package fallback', () => {
    const f = fixture()
    try {
      const reportRoot = path.dirname(f.config)
      for (const name of ['expo', 'metro']) fs.mkdirSync(path.join(reportRoot, 'node_modules', name), { recursive: true })
      fs.writeFileSync(path.join(reportRoot, 'node_modules/expo/package.json'), JSON.stringify({ version: 'root-expo' }))
      fs.writeFileSync(path.join(reportRoot, 'node_modules/metro/package.json'), '{malformed')
      const report = createReportContext({ root: reportRoot, budgetPath: f.config, persist: false })
      expect(report.toolchain.versions).toMatchObject({ expo: 'root-expo', metro: null })
    } finally { removeDir(f.dir) }
  })

  it('retains full and named bytes, healthy requests, payload totals and legacy JSON after cleanup', () => {
    const f = fixture()
    try {
      const result = f.run()
      expect(result.status).toBe(0)
      const legacy = JSON.parse(result.stdout)
      const report = legacy.diagnostic_report
      expect(legacy).toMatchObject({ chunkCount: 1, eagerRequests: 1, eagerRequestsByRoute: {}, breaches: [] })
      expect(report).toMatchObject({ schema_version: 1, dirty: expect.any(Boolean), verdict: 'pass', measurement_status: 'complete' })
      expect(report.sha).toMatch(/^[0-9a-f]{40}$/)
      expect(report.config.fingerprint).toMatch(/^[0-9a-f]{64}$/)
      expect(report.toolchain).toMatchObject({ fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/), versions: { node: process.versions.node } })
      const sizes = { raw: Buffer.byteLength(f.source), gzip: zlib.gzipSync(f.source).length, brotli: zlib.brotliCompressSync(f.source, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length }
      expect(report.measurements.named.entry).toEqual({ ...sizes, files: { 'entry-abcdef.js': sizes } })
      expect(report.measurements.all).toEqual(sizes)
      expect(report.measurements.eager.status).toBe('complete')
      expect(report.measurements.eager.requests_by_route).toEqual({
        'index.html': { requests: 1, limit: 1, missing_files: [] },
        'search.html': { requests: 1, limit: 1, missing_files: [] },
      })
      expect(report.measurements.eager.payload_routes.owner).toEqual({ routes: 2, total: 2 })
      const [file] = reportFiles(f.archive)
      expect(result.stderr).toContain(file)
      fs.rmSync(path.join(f.dir, 'worktree'), { recursive: true })
      expect(readReport(file)).toEqual(report)
      expect(runNodeCli([compare, file, file])).toMatchObject({ status: 0, stderr: '' })
    } finally { removeDir(f.dir) }
  })

  it('preserves named metadata stripping and full TOTAL/eager measurement', () => {
    const f = fixture()
    try {
      const namedSource = f.source + '__d(function(){},1,{"0":7});'
      const fullSource = f.source + '__d(function(){},1,{"0":7,"paths":{"1":"/x.js"}});'
      fs.writeFileSync(path.join(f.js, 'entry-abcdef.js'), fullSource)
      const report = JSON.parse(f.run().stdout).diagnostic_report
      expect(report.measurements.named.entry.raw).toBe(Buffer.byteLength(namedSource))
      expect(report.measurements.all.raw).toBe(Buffer.byteLength(fullSource))
      expect(report.measurements.total.raw).toBe(Buffer.byteLength(fullSource))
      expect(report.measurements.eager.raw).toBe(Buffer.byteLength(fullSource))
    } finally { removeDir(f.dir) }
  })

  it('keeps fail exit and exact breaches through cleanup, without changing rounding boundaries', () => {
    const f = fixture()
    try {
      f.budget.chunks.entry.maxRawKB = 0.1
      f.saveBudget()
      const result = f.run()
      expect(result.status).toBe(1)
      const report = JSON.parse(result.stdout).diagnostic_report
      expect(report.verdict).toBe('fail')
      expect(report.breaches).toContainEqual({ label: 'entry (raw)', actual: Buffer.byteLength(f.source), limit: roundedByteLimit(0.1), unit: 'bytes', policy: 'rounded_kib_0.1', configured_limit_kib: 0.1, checked_limit_kib: 0.1 })
      fs.rmSync(path.join(f.dir, 'worktree'), { recursive: true })
      expect(readReport(reportFiles(f.archive)[0]).verdict).toBe('fail')
      for (const limit of [0, 0.1, 1.2, 800]) {
        const upper = roundedByteLimit(limit)
        const toKB = (bytes: number) => Math.round(bytes / 1024 * 10) / 10
        expect(toKB(upper)).toBeLessThanOrEqual(limit)
        expect(toKB(upper + 1)).toBeGreaterThan(limit)
      }
    } finally { removeDir(f.dir) }
  })

  it('reports full configured eager files while preserving the legacy named-basis guard', () => {
    const f = fixture()
    try {
      const namedSource = f.source + '__d(function(){},1,{"0":7});'
      const fullSource = f.source + '__d(function(){},1,{"0":7,"paths":{"1":"/x.js"}});'
      fs.writeFileSync(path.join(f.js, 'entry-abcdef.js'), fullSource)
      fs.writeFileSync(f.config, JSON.stringify({ tolerancePct: 0, chunks: { entry: {} }, eager: { chunks: ['entry'], maxRawKB: 0.1 } }))
      const result = f.run()
      const legacy = JSON.parse(result.stdout)
      const report = legacy.diagnostic_report
      expect(result.status).toBe(1)
      expect(report.measurements.eager).toMatchObject({ status: 'complete', source: 'configured_chunks', raw: Buffer.byteLength(fullSource), route: null })
      expect(legacy.eagerRawKB).toBe(Math.round(Buffer.byteLength(namedSource) / 1024 * 10) / 10)
      expect(report.breaches).toContainEqual(expect.objectContaining({ label: 'EAGER (raw)', actual: Buffer.byteLength(namedSource), basis: 'configured_chunks_without_loader_metadata' }))
      const [file] = reportFiles(f.archive)
      expect(runNodeCli([compare, file, file]).stdout).toContain('eager.source: configured_chunks -> configured_chunks')
    } finally { removeDir(f.dir) }
  })

  it('distinguishes exact byte deltas hidden by legacy rounding and reports config changes', () => {
    const f = fixture()
    try {
      const before = JSON.parse(f.run().stdout)
      fs.appendFileSync(path.join(f.js, 'entry-abcdef.js'), 'x')
      const after = JSON.parse(f.run().stdout)
      expect(before.totalRawKB).toBe(after.totalRawKB)
      const files = reportFiles(f.archive)
      const reports = files.sort((a, b) => readReport(a).measurements.total.raw - readReport(b).measurements.total.raw)
      const result = runNodeCli([compare, ...reports])
      expect(result.status).toBe(0)
      expect(result.stdout).toMatch(/measurements.total.raw: \d+ -> \d+; delta \+1 bytes/)
      expect(result.stdout).toContain('verdict: pass -> pass')
      const changed = readReport(reports[1])
      changed.config.fingerprint = 'f'.repeat(64)
      changed.toolchain.versions.node = 'different'
      fs.writeFileSync(reports[1], JSON.stringify(changed))
      expect(runNodeCli([compare, ...reports]).stdout).toContain('different')
    } finally { removeDir(f.dir) }
  })

  it('reports missing input and malformed config as unavailable/error without zero measurements', () => {
    const f = fixture()
    try {
      fs.rmSync(f.js, { recursive: true })
      expect(f.run().status).toBe(1)
      const report = readReport(reportFiles(f.archive)[0])
      expect(report).toMatchObject({ verdict: 'error', measurement_status: 'unavailable', measurements: null })
      expect(report.errors.join(' ')).toContain('Web build chunks not found')
      fs.mkdirSync(f.js)
      fs.writeFileSync(path.join(f.js, 'entry-abcdef.js'), f.source)
      fs.writeFileSync(f.config, '{')
      expect(f.run().status).toBe(1)
      expect(reportFiles(f.archive)).toHaveLength(2)
      expect(reportFiles(f.archive).map((file) => readReport(file).errors.join(' '))).toEqual(expect.arrayContaining([expect.stringMatching(/JSON|Unexpected/)]))
    } finally { removeDir(f.dir) }
  })

  it('makes missing route assets incomplete and keeps their actual request counts', () => {
    const f = fixture()
    try {
      fs.appendFileSync(path.join(f.html, 'search.html'), '<script src="/missing.js"></script>')
      const result = f.run()
      const report = JSON.parse(result.stdout).diagnostic_report
      expect(result.status).toBe(1)
      expect(report).toMatchObject({ verdict: 'fail', measurement_status: 'incomplete' })
      expect(report.measurements.eager).toMatchObject({ status: 'incomplete', raw: null, gzip: null, brotli: null })
      expect(report.measurements.eager.requests_by_route['search.html']).toEqual({ requests: 2, limit: 1, missing_files: ['missing.js'] })
      expect(report.breaches).toEqual(expect.arrayContaining([expect.objectContaining({ unit: 'unavailable', actual: null, limit: null })]))
    } finally { removeDir(f.dir) }
  })

  it('does not treat absent eager configuration as a measured zero', () => {
    const f = fixture()
    try {
      const budget = { tolerancePct: 0, chunks: f.budget.chunks }
      fs.writeFileSync(f.config, JSON.stringify(budget))
      const result = f.run()
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout).diagnostic_report.measurements.eager).toMatchObject({ status: 'not_configured', raw: null, gzip: null, brotli: null, requests: null })
      expect(readReport(reportFiles(f.archive)[0]).verdict).toBe('pass')
    } finally { removeDir(f.dir) }
  })

  it('keeps incomplete route aliases visible even when their request count is not the maximum', () => {
    const f = fixture()
    try {
      fs.mkdirSync(path.join(f.html, 'search'))
      fs.writeFileSync(path.join(f.html, 'search/index.html'), '<script src="/missing.js"></script>')
      const report = JSON.parse(f.run().stdout).diagnostic_report
      expect(report.measurements.eager).toMatchObject({ status: 'incomplete', raw: null })
      expect(report.measurements.eager.requests_by_route['search.html']).toMatchObject({ requests: 1, missing_files: ['missing.js'] })
    } finally { removeDir(f.dir) }
  })

  it('preserves a passing guard exit and archives explicit metadata read failures', () => {
    const f = fixture()
    try {
      const preload = path.join(f.dir, 'metadata-read-error.cjs')
      fs.writeFileSync(preload, `const fs = require('fs'); const read = fs.readFileSync; fs.readFileSync = function(file, ...args) { if (String(file).endsWith('/yarn.lock')) throw new Error('lockfile unreadable'); return read.call(this, file, ...args); };`)
      const result = runNodeCli(['--require', preload, guard, '--fail', '--json', '--report'], {
        BUNDLE_BUDGET_JS_DIR: f.js, BUNDLE_BUDGET_HTML_DIR: f.html, BUNDLE_BUDGET_CONFIG: f.config,
        BUNDLE_BUDGET_REPORT_DIR: f.archive,
      })
      expect(result.status).toBe(0)
      expect(readReport(reportFiles(f.archive)[0])).toMatchObject({ verdict: 'error', errors: ['Lockfile fingerprint unavailable'], toolchain: { lockfile: { fingerprint: null } } })
    } finally { removeDir(f.dir) }
  })

  it('does not turn a red guard green or change a green guard exit on diagnostic write errors', () => {
    const f = fixture()
    try {
      fs.writeFileSync(f.archive, 'blocked')
      expect(f.run()).toMatchObject({ status: 0, stderr: expect.stringContaining('Bundle budget diagnostics:') })
      f.budget.chunks.entry.maxRawKB = 0
      f.saveBudget()
      expect(f.run()).toMatchObject({ status: 1, stderr: expect.stringContaining('Bundle budget diagnostics:') })
    } finally { removeDir(f.dir) }
  })

  it('writes atomically and rejects oversize reports without leaving a partial file', () => {
    const f = fixture()
    try {
      const report = JSON.parse(f.run().stdout).diagnostic_report
      const before = reportFiles(f.archive)
      const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('rename denied') })
      try { expect(() => persistReport(report, f.archive)).toThrow('rename denied') } finally { rename.mockRestore() }
      expect(reportFiles(f.archive)).toEqual(before)
      expect(fs.readdirSync(f.archive).some((name) => name.endsWith('.tmp'))).toBe(false)
      report.errors.push('x'.repeat(MAX_REPORT_BYTES))
      expect(() => persistReport(report, f.archive)).toThrow('exceeds')
      expect(reportFiles(f.archive)).toEqual(before)
    } finally { removeDir(f.dir) }
  })

  it('retains at most twenty own recent reports and preserves unrelated or corrupt files', () => {
    const f = fixture()
    try {
      const report = JSON.parse(f.run().stdout).diagnostic_report
      fs.writeFileSync(path.join(f.archive, 'unrelated.json'), '{}')
      const corrupt = `bundle-budget-v1-${report.sha}-20000101T000000000Z-0123456789abcdef.json`
      fs.writeFileSync(path.join(f.archive, corrupt), '{')
      const expired = { ...report, generated_at: new Date(Date.now() - MAX_AGE_MS - 1000).toISOString() }
      persistReport(expired, f.archive)
      for (let i = 0; i < 21; i++) persistReport({ ...report, generated_at: new Date(Date.now() - i * 1000).toISOString() }, f.archive)
      const own = reportFiles(f.archive).filter((file) => {
        try { readReport(file); return true } catch { return false }
      })
      expect(own).toHaveLength(20)
      expect(own.every((file) => Date.now() - Date.parse(readReport(file).generated_at) <= MAX_AGE_MS)).toBe(true)
      expect(fs.readFileSync(path.join(f.archive, 'unrelated.json'), 'utf8')).toBe('{}')
      expect(fs.readFileSync(path.join(f.archive, corrupt), 'utf8')).toBe('{')
    } finally { removeDir(f.dir) }
  })

  it('refuses malformed, unknown and invalid measurement schemas', () => {
    const f = fixture()
    try {
      const report = JSON.parse(f.run().stdout).diagnostic_report
      const [good] = reportFiles(f.archive)
      const bad = path.join(f.dir, 'bad.json')
      for (const invalid of [
        { ...report, schema_version: 99 }, { ...report, measurements: {} }, { ...report, dirty: 'no' },
        { ...report, measurements: { ...report.measurements, eager: { ...report.measurements.eager, status: 'complete', raw: null } } },
        { ...report, measurements: { ...report.measurements, eager: { ...report.measurements.eager, status: 'incomplete' } } },
      ]) {
        fs.writeFileSync(bad, JSON.stringify(invalid))
        expect(runNodeCli([compare, good, bad]).status).toBe(1)
      }
      report.measurements.total.raw = 1.5
      expect(() => validateReport(report)).toThrow('total.raw')
      fs.writeFileSync(bad, '{')
      expect(runNodeCli([compare, good, bad]).status).toBe(1)
    } finally { removeDir(f.dir) }
  })
})
