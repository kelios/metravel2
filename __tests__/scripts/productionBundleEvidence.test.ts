import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const { captureContext, archiveEvidence, CONTEXT_FILE, browserInputFingerprint } = require('../../scripts/lib/productionBundleEvidence')
const { createReportContext, persistReport } = require('../../scripts/lib/bundleBudgetReport')
const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_AUTHOR_NAME: 'evidence test', GIT_AUTHOR_EMAIL: 'evidence@test.invalid', GIT_COMMITTER_NAME: 'evidence test', GIT_COMMITTER_EMAIL: 'evidence@test.invalid' }
const SECRET = 'SYNTHETIC_PRIVATE_VALUE_NEVER_ARCHIVED'
const SSR_ENV = { NODE_ENV: 'production', EXPO_ENV: 'prod', METRAVEL_WEB_OUTPUT: 'server', EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true', EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'true', EXPO_PUBLIC_RNW_SLIM: '1', EXPO_WEB_BUILD_MINIFY: 'true', EXPO_WEB_BUILD_GENERATE_SOURCE_MAP: 'false', EXPO_PUBLIC_AI_SIMILAR_SOURCE: 'static', EXPO_PUBLIC_QUEST_LOCALE_HUBS: 'true' }

function fixture() {
  const root = fs.realpathSync(makeTempDir('production-bundle-evidence-'))
  const canonicalRoot = path.join(root, 'repo')
  const worktree = path.join(root, 'worktrees/deploy-prod')
  fs.mkdirSync(canonicalRoot)
  const git = (cwd: string, args: string[]) => {
    const result = runCli('git', args, { cwd, env: GIT_ENV })
    if (result.status !== 0) throw new Error(result.stderr)
    return result.stdout.trim()
  }
  git(canonicalRoot, ['init', '-q'])
  fs.mkdirSync(path.join(canonicalRoot, 'config'))
  fs.mkdirSync(path.join(canonicalRoot, 'app'))
  fs.writeFileSync(path.join(canonicalRoot, 'package.json'), '{"scripts":{}}')
  fs.writeFileSync(path.join(canonicalRoot, 'yarn.lock'), 'fixture')
  fs.writeFileSync(path.join(canonicalRoot, 'app/index.tsx'), 'export default 1')
  fs.writeFileSync(path.join(canonicalRoot, 'config/bundle-budget.json'), '{"chunks":{"entry":{"maxRawKB":1}}}')
  fs.writeFileSync(path.join(canonicalRoot, '.gitignore'), '.codex-temp/\n.env*\nnode_modules\ndist/\n')
  git(canonicalRoot, ['add', 'package.json', 'yarn.lock', 'app/index.tsx', 'config/bundle-budget.json', '.gitignore'])
  git(canonicalRoot, ['commit', '-qm', 'fixture'])
  const sourceSha = git(canonicalRoot, ['rev-parse', 'HEAD'])
  fs.symlinkSync(path.resolve('node_modules'), path.join(canonicalRoot, 'node_modules'), 'dir')
  fs.writeFileSync(path.join(canonicalRoot, '.env.prod'), `EXPO_PUBLIC_GOOGLE_API_SECRET=${SECRET}\nMETA_FACEBOOK_CLIENT_TOKEN=${SECRET}\nEXPO_PUBLIC_E2E_SCREENSHOT_MODE=false\n`)
  git(canonicalRoot, ['worktree', 'add', '-q', '--detach', worktree, sourceSha])
  fs.symlinkSync(path.join(canonicalRoot, 'node_modules'), path.join(worktree, 'node_modules'), 'dir')
  fs.symlinkSync(path.join(canonicalRoot, '.env.prod'), path.join(worktree, '.env.prod'))
  fs.copyFileSync(path.join(worktree, '.env.prod'), path.join(worktree, '.env'))
  const context = captureContext(worktree, 'prod', SSR_ENV)
  const publicRoot = path.join(worktree, 'dist/prod')
  const js = path.join(publicRoot, '_expo/static/js/web')
  fs.mkdirSync(js, { recursive: true })
  const body = 'module.exports={parseQuestUrlLocale:function(){}};'
  fs.writeFileSync(path.join(js, 'entry-abcdef.js'), body)
  fs.writeFileSync(path.join(publicRoot, 'index.html'), '<script src="/_expo/static/js/web/entry-abcdef.js"></script>')
  fs.writeFileSync(path.join(publicRoot, '.build-source.json'), JSON.stringify({ sha: sourceSha, dirty: false }))
  const size = { raw: Buffer.byteLength(body), gzip: zlib.gzipSync(body).length, brotli: zlib.brotliCompressSync(body).length }
  const report = createReportContext({ root: worktree, budgetPath: path.join(worktree, 'config/bundle-budget.json'), persist: false })
  Object.assign(report, { build_run_id: context.run_id, measurement_status: 'complete', verdict: 'pass', measurements: {
    named: { entry: { ...size, files: { 'entry-abcdef.js': size } } }, files: { 'entry-abcdef.js': size }, total: size, all: { ...size, files: 1 }, deferred: { raw: 0, gzip: 0, brotli: 0 },
    eager: { ...size, status: 'complete', source: 'html_routes', route: 'index.html', requests: 1, requests_route: 'index.html', requests_by_route: {}, payload_routes: {} },
  } })
  const reportDir = path.join(canonicalRoot, '.codex-temp/deploy')
  const saveReport = () => {
    fs.mkdirSync(reportDir, { recursive: true })
    for (const file of fs.readdirSync(reportDir).filter((file) => file.startsWith('bundle-budget-v1-'))) fs.rmSync(path.join(reportDir, file))
    return persistReport(report, reportDir)
  }
  saveReport()
  const archive = (exitCode = 0) => {
    const manifest = archiveEvidence({ worktree, canonicalRoot, sourceSha, exitCode, startedAt: Math.floor(Date.now() / 1000) - 10 })
    return { file: manifest, value: JSON.parse(fs.readFileSync(manifest, 'utf8')) }
  }
  return { root, worktree, canonicalRoot, sourceSha, publicRoot, js, context, report, saveReport, archive }
}

describe('canonical public bundle evidence', () => {
  it('keeps complete public bytes/full-vs-normalized metrics and shaped private provenance, without env/server/arbitrary files', () => {
    const f = fixture()
    try {
      fs.writeFileSync(path.join(f.publicRoot, '.env'), SECRET)
      fs.mkdirSync(path.join(f.publicRoot, 'server'))
      fs.writeFileSync(path.join(f.publicRoot, 'server/private.js'), SECRET)
      fs.writeFileSync(path.join(f.publicRoot, 'server/private.html'), SECRET)
      fs.writeFileSync(path.join(f.js, 'entry-abcdef.js.map'), SECRET)
      const privateContext = path.join(f.worktree, CONTEXT_FILE)
      fs.writeFileSync(privateContext, JSON.stringify({ ...f.context, arbitrary_private_dump: SECRET }))
      const { file, value } = f.archive(1)
      expect(value).toMatchObject({ reference_eligible: true, source_sha: f.sourceSha, original_exit_code: 1, reasons: [] })
      expect(value.context.flags).toMatchObject({ NODE_ENV: 'production', EXPO_WEB_BUILD_MINIFY: 'true', EXPO_PUBLIC_QUEST_LOCALE_HUBS: 'true' })
      expect(value.files['_expo/static/js/web/entry-abcdef.js']).toMatchObject({ raw: f.report.measurements.files['entry-abcdef.js'].raw, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
      expect(Object.keys(value.files).sort()).toEqual(['.build-source.json', '_expo/static/js/web/entry-abcdef.js', 'index.html'])
      expect(value.metrics.home_full.brotli).toBe(value.metrics.entry_full.brotli)
      expect(value.startup_ownership['index.html'].ownership_markers).toEqual({ parser: true, shell: false, serving_projection: false })
      expect(fs.readFileSync(file, 'utf8')).not.toContain(SECRET)
      expect(fs.existsSync(path.join(path.dirname(file), 'client/.env'))).toBe(false)
      expect(fs.existsSync(path.join(path.dirname(file), 'client/server/private.js'))).toBe(false)
      expect(fs.existsSync(path.join(path.dirname(file), 'client/server/private.html'))).toBe(false)
      expect(fs.existsSync(path.join(path.dirname(file), 'client/_expo/static/js/web/entry-abcdef.js.map'))).toBe(false)
    } finally { removeDir(f.root) }
  })

  it('retains a complete exact-byte budget breach as eligible evidence without changing its failed exit', () => {
    const f = fixture()
    try {
      f.report.verdict = 'fail'
      f.report.breaches = [{ label: 'entry Brotli', unit: 'bytes', basis: 'full_chunk_with_loader_metadata',
        actual: f.report.measurements.files['entry-abcdef.js'].brotli,
        limit: f.report.measurements.files['entry-abcdef.js'].brotli - 1 }]
      f.saveReport()
      const { file, value } = f.archive(1)
      expect(value).toMatchObject({ reference_eligible: true, original_exit_code: 1, reasons: [] })
      const report = JSON.parse(fs.readFileSync(path.join(path.dirname(file), 'budget-report.json'), 'utf8'))
      expect(report).toMatchObject({ verdict: 'fail', measurement_status: 'complete', errors: [],
        breaches: [expect.objectContaining({ actual: report.breaches[0].limit + 1 })] })
    } finally { removeDir(f.root) }
  })

  it.each(['run', 'time', 'config'])('rejects a same-SHA stale/mismatched %s report', (kind) => {
    const f = fixture()
    try {
      if (kind === 'run') f.report.build_run_id = 'f'.repeat(32)
      if (kind === 'time') f.report.generated_at = new Date(Date.parse(f.context.captured_at) - 1000).toISOString()
      if (kind === 'config') f.report.config.fingerprint = 'f'.repeat(64)
      f.saveReport()
      expect(f.archive().value).toMatchObject({ reference_eligible: false, reasons: expect.arrayContaining(['Complete matching budget report unavailable']) })
    } finally { removeDir(f.root) }
  })

  it('rejects a public root symlink and never follows public child symlinks', () => {
    const f = fixture()
    try {
      fs.writeFileSync(path.join(f.root, 'private.txt'), SECRET)
      fs.symlinkSync(path.join(f.root, 'private.txt'), path.join(f.js, 'leak.js'))
      const child = f.archive()
      expect(child.value.reference_eligible).toBe(false)
      expect(child.value.files).not.toHaveProperty('_expo/static/js/web/leak.js')
      fs.rmSync(path.join(f.js, 'leak.js'))
      fs.renameSync(f.publicRoot, path.join(f.worktree, 'dist/original'))
      fs.symlinkSync(path.join(f.worktree, 'dist/original'), f.publicRoot, 'dir')
      const root = f.archive()
      expect(root.value.reference_eligible).toBe(false)
      expect(root.value.files).toEqual({})
    } finally { removeDir(f.root) }
  })

  it.each(['missing-report', 'incomplete-report', 'error-report', 'marker', 'context', 'source', 'toolchain'])('marks %s evidence ineligible', (kind) => {
    const f = fixture()
    try {
      if (kind === 'missing-report') {
        const dir = path.join(f.canonicalRoot, '.codex-temp/deploy')
        for (const name of fs.readdirSync(dir)) fs.rmSync(path.join(dir, name), { recursive: true, force: true })
      }
      if (kind === 'incomplete-report') { f.report.measurement_status = 'incomplete'; f.report.verdict = 'fail'; f.saveReport() }
      if (kind === 'error-report') { f.report.verdict = 'error'; f.saveReport() }
      if (kind === 'marker') fs.writeFileSync(path.join(f.publicRoot, '.build-source.json'), JSON.stringify({ sha: 'f'.repeat(40), dirty: false }))
      if (kind === 'context') fs.writeFileSync(path.join(f.worktree, CONTEXT_FILE), JSON.stringify({ schema_version: 999, private_value: SECRET }))
      if (kind === 'toolchain') fs.writeFileSync(path.join(f.worktree, CONTEXT_FILE), JSON.stringify({ ...f.context, toolchain_fingerprint: 'f'.repeat(64) }))
      if (kind === 'source') fs.writeFileSync(path.join(f.worktree, 'app/index.tsx'), 'export default 2')
      const { value, file } = f.archive()
      expect(value.reference_eligible).toBe(false)
      expect(value.reasons.length).toBeGreaterThan(0)
      expect(fs.readFileSync(file, 'utf8')).not.toContain(SECRET)
    } finally { removeDir(f.root) }
  })

  it.each(['DISABLE_GH_STUB', 'DISABLE_REANIMATED_STUB', 'ANALYZE_BUNDLE', 'APP_MANIFEST'])('fingerprints the actual %s compiler input', (name) => {
    const f = fixture()
    try {
      const changed = captureContext(f.worktree, 'prod', { ...SSR_ENV, [name]: 'different' })
      expect(changed.compiled_env_fingerprint).not.toBe(f.context.compiled_env_fingerprint)
      if (name === 'APP_MANIFEST') {
        expect(changed.expo_public_config_source).toBe('APP_MANIFEST')
        expect(changed.expo_public_config_fingerprint).not.toBe(f.context.expo_public_config_fingerprint)
      }
      expect(browserInputFingerprint(f.worktree)).toBe(f.context.browser_input_fingerprint)
      expect(JSON.stringify(changed)).not.toContain(SECRET)
    } finally { removeDir(f.root) }
  })
})
