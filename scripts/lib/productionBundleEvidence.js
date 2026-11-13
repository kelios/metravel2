'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')

const CONTEXT_FILE = '.codex-temp/deploy/production-build-context.json'
const CONTRACT = 'canonical-isolated-ssr-v1'
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const SAFE_FLAGS = ['NODE_ENV', 'BABEL_ENV', 'EXPO_ENV', 'METRAVEL_WEB_OUTPUT', 'EXPO_PUBLIC_WEB_RUNTIME_SSR',
  'EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR', 'EXPO_PUBLIC_RNW_SLIM', 'EXPO_WEB_BUILD_MINIFY', 'EXPO_WEB_BUILD_GENERATE_SOURCE_MAP',
  'EXPO_PUBLIC_AI_SIMILAR_SOURCE', 'EXPO_PUBLIC_QUEST_LOCALE_HUBS', 'EXPO_PUBLIC_IS_LOCAL_API',
  'EXPO_PUBLIC_E2E_SCREENSHOT_MODE', 'EXPO_PUBLIC_SHOW_DEVTOOLS']
const SAFE_VALUES = new Set(['production', 'prod', 'server', 'static', 'service', 'true', 'false', '1', '0', ''])
const BROWSER_ROOTS = /^(?:app|components|hooks|context|constants|utils|i18n|api|services|stores|types|screens|data|assets|metro-stubs|patches)\//
const BROWSER_FILES = new Set(['entry.js', 'app.json', 'app.config.js', 'metro.config.js', 'babel.config.js', 'package.json', 'yarn.lock', 'tsconfig.json',
  'scripts/lib/granularChunkMerge.js', 'scripts/lib/scopedModuleIdFactory.js', 'scripts/lib/webChunkMetadataCodec.js', 'scripts/lib/webChunkMetadataRuntime.js',
  'scripts/lib/webMinifierConfig.js', 'scripts/lib/webOutput.js'])
const EXTRA_COMPILER_ENV = new Set(['NODE_ENV', 'BABEL_ENV', 'APP_ENV', 'API_TIMEOUT', 'IS_LOCAL_API', 'PROD_API_URL',
  'META_FACEBOOK_CLIENT_TOKEN', 'CI', 'DISABLE_GH_STUB', 'DISABLE_REANIMATED_STUB', 'ANALYZE_BUNDLE', 'APP_MANIFEST', 'NODE_OPTIONS'])

function browserInputFingerprint(cwd, revision = 'HEAD') {
  const rows = git(cwd, ['ls-tree', '-r', revision]).split('\n').filter((row) => {
    const file = row.split('\t')[1]
    return file && (BROWSER_ROOTS.test(file) || BROWSER_FILES.has(file)
      || file.startsWith('config/') && file !== 'config/bundle-budget.json')
  })
  return hash(rows.join('\n'))
}

function captureContext(cwd, envName, env = process.env) {
  const expoEnv = require('@expo/env')
  const effective = { ...env }
  expoEnv.setNodeEnv('production', { systemEnv: effective })
  const parsed = expoEnv.parseProjectEnv(cwd, { mode: 'production', systemEnv: effective, silent: true })
  Object.assign(effective, { ...parsed.env, ...effective })
  const commonDir = path.resolve(cwd, git(cwd, ['rev-parse', '--git-common-dir']))
  const canonicalRoot = fs.realpathSync(path.dirname(commonDir))
  const projectRoot = fs.realpathSync(cwd)
  const expectedRoot = path.join(path.dirname(canonicalRoot), 'worktrees', 'deploy-prod')
  const dependencyRoot = fs.realpathSync(path.join(cwd, 'node_modules'))
  const expectedDependencies = fs.realpathSync(path.join(canonicalRoot, 'node_modules'))
  const compiled = Object.entries(effective).filter(([key]) => key.startsWith('EXPO_') || key.startsWith('METRAVEL_') || EXTRA_COMPILER_ENV.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
  const flags = Object.fromEntries(SAFE_FLAGS.map((key) => [key, effective[key] == null ? '<unset>'
    : SAFE_VALUES.has(effective[key]) ? effective[key] : '<present; fingerprinted>']))
  const sourceSha = git(cwd, ['rev-parse', 'HEAD'])
  let publicConfigFingerprint
  try {
    publicConfigFingerprint = execFileSync(process.execPath, ['-e',
      'process.stdout.write(require(process.argv[1]).getExpoPublicConfigRevision(process.argv[2]))',
      require.resolve('./metroCacheInputs'), cwd], { cwd, env: effective, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    if (!/^[a-f0-9]{64}$/.test(publicConfigFingerprint)) throw new Error('Invalid config fingerprint')
  } catch { throw new Error('Unable to fingerprint the effective Expo public config') }
  const context = {
    schema_version: 1, contract: CONTRACT, run_id: crypto.randomBytes(16).toString('hex'), captured_at: new Date().toISOString(), env: envName,
    source_sha: sourceSha, source_dirty: Boolean(git(cwd, ['status', '--porcelain'])),
    browser_input_fingerprint: browserInputFingerprint(cwd),
    layout: { project_root: projectRoot, canonical_root: canonicalRoot, dependency_root: dependencyRoot,
      expected_project_root: expectedRoot, expected_dependency_root: expectedDependencies,
      canonical: projectRoot === expectedRoot && dependencyRoot === expectedDependencies },
    flags,
    compiled_env_fingerprint: hash(JSON.stringify(compiled)),
    public_env_keys: compiled.filter(([key]) => key.startsWith('EXPO_PUBLIC_')).map(([key]) => key),
    dotenv_fingerprints: parsed.files.map((file) => ({ name: path.basename(file), sha256: hash(fs.readFileSync(file)) })),
    prod_env_fingerprint: hash(fs.readFileSync(path.join(cwd, `.env.${envName}`))),
    budget_fingerprint: hash(fs.readFileSync(path.join(cwd, 'config/bundle-budget.json'))),
    expo_public_config_fingerprint: publicConfigFingerprint,
    expo_public_config_source: effective.APP_MANIFEST ? 'APP_MANIFEST' : 'computed-expo-config',
    toolchain_fingerprint: require('./metroCacheInputs').getToolchainRevision(cwd),
    node: process.version,
  }
  const target = path.join(cwd, CONTEXT_FILE)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(context, null, 2) + '\n', { mode: 0o600 })
  return context
}

function shapeContext(value) {
  const hex = (item, length) => typeof item === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(item)
  if (!value || value.schema_version !== 1 || value.contract !== CONTRACT || value.env !== 'prod'
      || !hex(value.run_id, 32) || !hex(value.source_sha, 40) || !Number.isFinite(Date.parse(value.captured_at))
      || !['browser_input_fingerprint', 'compiled_env_fingerprint', 'prod_env_fingerprint', 'budget_fingerprint', 'toolchain_fingerprint', 'expo_public_config_fingerprint'].every((key) => hex(value[key], 64))
      || !['APP_MANIFEST', 'computed-expo-config'].includes(value.expo_public_config_source)
      || typeof value.source_dirty !== 'boolean' || !/^v\d+\.\d+\.\d+$/.test(value.node)) throw new Error('Invalid private context schema')
  const layout = {}
  for (const key of ['project_root', 'canonical_root', 'dependency_root', 'expected_project_root', 'expected_dependency_root']) {
    if (typeof value.layout?.[key] !== 'string' || !path.isAbsolute(value.layout[key]) || /[\r\n\0]/.test(value.layout[key])) throw new Error('Invalid context layout')
    layout[key] = value.layout[key]
  }
  layout.canonical = value.layout.canonical === true
  const flags = Object.fromEntries(SAFE_FLAGS.map((key) => [key, SAFE_VALUES.has(value.flags?.[key])
    || ['<unset>', '<present; fingerprinted>'].includes(value.flags?.[key]) ? value.flags[key] : '<present; fingerprinted>']))
  const dotenv = (value.dotenv_fingerprints || []).map((file) => {
    if (!/^\.env(?:\.production(?:\.local)?|\.local)?$/.test(file.name) || !hex(file.sha256, 64)) throw new Error('Invalid dotenv fingerprint')
    return { name: file.name, sha256: file.sha256 }
  })
  return { schema_version: 1, contract: CONTRACT, run_id: value.run_id, captured_at: value.captured_at,
    env: 'prod', source_sha: value.source_sha, source_dirty: value.source_dirty,
    browser_input_fingerprint: value.browser_input_fingerprint, layout, flags,
    compiled_env_fingerprint: value.compiled_env_fingerprint,
    public_env_keys: (value.public_env_keys || []).filter((key) => typeof key === 'string' && /^EXPO_PUBLIC_[A-Z0-9_]+$/.test(key)),
    dotenv_fingerprints: dotenv, prod_env_fingerprint: value.prod_env_fingerprint, budget_fingerprint: value.budget_fingerprint,
    expo_public_config_fingerprint: value.expo_public_config_fingerprint, expo_public_config_source: value.expo_public_config_source,
    toolchain_fingerprint: value.toolchain_fingerprint, node: value.node }
}

function validateCalibrationReference(reference, budget) {
  const sha = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value)
  if (!reference || reference.schema_version !== 1 || reference.contract !== CONTRACT
      || reference.kind !== 'historical-canonical-report-with-parity-proof'
      || reference.raw_artifacts_retained !== false || !sha(reference.source_sha, 40)
      || !['report_sha256', 'build_log_sha256', 'env_parity_proof_sha256', 'layout_proof_sha256', 'browser_input_fingerprint'].every((key) => sha(reference[key], 64))
      || !Number.isSafeInteger(reference.home_log_line) || reference.home_log_line <= 0
      || !Number.isSafeInteger(reference.entry_full_brotli_bytes) || reference.entry_full_brotli_bytes <= 0
      || !Number.isSafeInteger(reference.home_full_brotli_bytes) || reference.home_full_brotli_bytes <= 0
      || reference.entry_full_brotli_bytes !== budget.chunks?.entry?.maxBrotliBytes
      || reference.home_full_brotli_bytes !== budget.eager?.maxBrotliBytesByRoute?.['index.html']) {
    throw new Error('Invalid canonical bundle calibration reference or exact byte pins')
  }
}

function archiveEvidence({ worktree, canonicalRoot, sourceSha, logFile, exitCode, startedAt }) {
  const archive = path.join(canonicalRoot, '.codex-temp/deploy/bundle-artifacts',
    `${sourceSha}-${new Date().toISOString().replace(/[^0-9TZ]/g, '')}-${process.pid}`)
  fs.mkdirSync(path.join(archive, 'client'), { recursive: true })
  fs.chmodSync(archive, 0o700)
  const reasons = []
  let context = null
  try { context = shapeContext(JSON.parse(fs.readFileSync(path.join(worktree, CONTEXT_FILE), 'utf8'))) } catch { reasons.push('Private build context unavailable or invalid') }
  const actualRoot = fs.realpathSync(worktree)
  const actualCanonical = fs.realpathSync(canonicalRoot)
  const expectedRoot = path.join(path.dirname(actualCanonical), 'worktrees', 'deploy-prod')
  let actualDependencies = null
  let canonicalDependencies = null
  try {
    actualDependencies = fs.realpathSync(path.join(worktree, 'node_modules'))
    canonicalDependencies = fs.realpathSync(path.join(canonicalRoot, 'node_modules'))
  } catch { reasons.push('Shared dependency layout unavailable') }
  if (!context || context.contract !== CONTRACT || context.source_sha !== sourceSha || context.source_dirty
      || git(worktree, ['rev-parse', 'HEAD']) !== sourceSha || Boolean(git(worktree, ['status', '--porcelain']))
      || actualRoot !== expectedRoot || !context.layout?.canonical || context.layout.project_root !== actualRoot
      || context.layout.canonical_root !== actualCanonical || actualDependencies !== canonicalDependencies
      || context.layout.dependency_root !== actualDependencies || context.layout.expected_project_root !== expectedRoot
      || context.layout.expected_dependency_root !== canonicalDependencies
      || context.flags.METRAVEL_WEB_OUTPUT !== 'server' || context.flags.EXPO_PUBLIC_WEB_RUNTIME_SSR !== 'true'
      || context.flags.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR !== 'true' || context.flags.NODE_ENV !== 'production'
      || context.flags.EXPO_WEB_BUILD_MINIFY !== 'true' || context.flags.EXPO_WEB_BUILD_GENERATE_SOURCE_MAP !== 'false') {
    reasons.push('Build context is not a clean canonical production SSR reference')
    context = null
  }
  if (context && context.browser_input_fingerprint !== browserInputFingerprint(worktree)) {
    reasons.push('Browser source inputs no longer match the captured context')
    context = null
  }
  if (context) {
    try {
      if (context.toolchain_fingerprint !== require('./metroCacheInputs').getToolchainRevision(worktree)) throw new Error('Toolchain inputs changed')
    } catch { reasons.push('Toolchain inputs no longer match the captured context'); context = null }
  }
  let report = null
  const candidates = fs.readdirSync(path.join(canonicalRoot, '.codex-temp/deploy'))
    .filter((file) => file.startsWith(`bundle-budget-v1-${sourceSha}-`) && file.endsWith('.json'))
    .map((file) => path.join(canonicalRoot, '.codex-temp/deploy', file)).sort().reverse()
  for (const file of candidates) {
    try {
      const value = require('./bundleBudgetReport').readReport(file)
      if (context && value.sha === sourceSha && value.build_run_id === context.run_id
          && value.config.fingerprint === context.budget_fingerprint
          && value.config.fingerprint === hash(fs.readFileSync(path.join(worktree, 'config/bundle-budget.json')))
          && Date.parse(value.generated_at) >= Date.parse(context.captured_at)
          && Date.parse(value.generated_at) >= Number(startedAt) * 1000) {
        report = value
        fs.copyFileSync(file, path.join(archive, 'budget-report.json'))
        break
      }
    } catch { /* An unrelated/malformed report is never a reference. */ }
  }
  if (!report || report.dirty || report.measurement_status !== 'complete' || !['pass', 'fail'].includes(report.verdict)
      || report.errors.length) reasons.push('Complete matching budget report unavailable')
  const files = {}
  const publicRoot = path.join(worktree, 'dist/prod')
  let totalBytes = 0
  function copy(relative) {
    const source = path.join(publicRoot, relative)
    const stat = fs.lstatSync(source)
    if (!stat.isFile() || stat.isSymbolicLink()) { reasons.push(`Non-regular public evidence: ${relative}`); return }
    totalBytes += stat.size
    if (totalBytes > 64 * 1024 * 1024 || Object.keys(files).length >= 1024) throw new Error('Public bundle evidence exceeds bounded archive limits')
    const buffer = fs.readFileSync(source)
    const destination = path.join(archive, 'client', relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, buffer)
    files[relative] = { raw: buffer.length, sha256: hash(buffer) }
  }
  function walk(relative = '') {
    const dir = path.join(publicRoot, relative)
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.posix.join(relative, entry.name)
      if (entry.isSymbolicLink()) { reasons.push(`Symlink excluded: ${file}`); continue }
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'assets' || entry.name === 'server') continue
        if (file === '_expo' || file === '_expo/static' || file === '_expo/static/js'
          || file === '_expo/static/js/web' || file === '_expo/static/css' || !file.startsWith('_expo/')) walk(file)
      } else if (entry.isFile() && (file === '.build-source.json' || file.endsWith('.html')
          || /^_expo\/static\/js\/web\/[^/]+\.js$/.test(file)
          || /^_expo\/static\/css\/[^/]+\.css$/.test(file))) copy(file)
    }
  }
  try {
    if (fs.realpathSync(publicRoot) !== path.resolve(publicRoot)) throw new Error('Public root contains a symlink')
    walk()
  } catch (error) { reasons.push(`Public client incomplete: ${error.message}`) }
  if (!Object.keys(files).some((file) => /^_expo\/static\/js\/web\/entry-/.test(file))) reasons.push('Full delivered entry unavailable')
  if (!files['index.html'] || !files['.build-source.json']) reasons.push('Home HTML or public source marker unavailable')
  for (const [file, sizes] of Object.entries(report?.measurements?.files || {})) {
    if (files[`_expo/static/js/web/${file}`]?.raw !== sizes.raw) reasons.push(`Report/public file mismatch: ${file}`)
  }
  for (const file of Object.keys(files).filter((file) => file.startsWith('_expo/static/js/web/'))) {
    if (!report?.measurements?.files?.[path.basename(file)]) reasons.push(`Unmeasured public file: ${file}`)
  }
  if (files['.build-source.json']) {
    try {
      const marker = JSON.parse(fs.readFileSync(path.join(archive, 'client/.build-source.json'), 'utf8'))
      if (marker.sha !== sourceSha || marker.dirty !== false) reasons.push('Public source marker mismatch')
    } catch { reasons.push('Invalid public source marker') }
  }
  const entry = Object.entries(report?.measurements?.files || {}).find(([file]) => /^entry-.*\.js$/.test(file))
  function routeEvidence(route) {
    if (!files[route] || !report) return null
    const html = fs.readFileSync(path.join(archive, 'client', route), 'utf8')
    const scripts = [...new Set([...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["']/gi)]
      .map((match) => path.basename(new URL(match[1], 'https://bundle.invalid').pathname)))]
    if (!scripts.length || scripts.some((file) => !report.measurements.files[file]
        || !files[`_expo/static/js/web/${file}`])) return null
    const full = scripts.reduce((sum, file) => {
      const sizes = report.measurements.files[file]
      return { raw: sum.raw + sizes.raw, gzip: sum.gzip + sizes.gzip, brotli: sum.brotli + sizes.brotli, scripts }
    }, { raw: 0, gzip: 0, brotli: 0, scripts })
    const text = scripts.map((file) => fs.readFileSync(path.join(archive, 'client/_expo/static/js/web', file), 'utf8')).join('\n')
    return { full, ownership_markers: {
      parser: text.includes('parseQuestUrlLocale'), shell: text.includes('getQuestLocaleRouteParserScript'),
      serving_projection: text.includes('validateQuestServingProjection') || text.includes('questServingAlternates'),
    } }
  }
  const startupOwnership = Object.fromEntries(['index.html', 'travels/[param].html', 'article/[id].html', 'article/1.html']
    .map((route) => [route, routeEvidence(route)]))
  const home = startupOwnership['index.html']?.full ?? null
  if (!home) reasons.push('Home script measurement incomplete')
  // The wrapper appends its final summary after cleanup; bind this snapshot as
  // a prefix instead of mislabelling it as the hash of the eventual whole log.
  const logPrefix = logFile && fs.existsSync(logFile) ? fs.readFileSync(logFile) : null
  const manifest = { schema_version: 1, contract: CONTRACT, source_sha: sourceSha, original_exit_code: Number(exitCode),
    reference_eligible: reasons.length === 0, reasons, context, files,
    metrics: { entry_full: entry ? { file: entry[0], ...entry[1] } : null, entry_normalized: report?.measurements?.named?.entry ?? null, home_full: home },
    startup_ownership: startupOwnership,
    log_prefix: logPrefix ? { bytes: logPrefix.length, sha256: hash(logPrefix) } : null,
    report_sha256: report ? hash(fs.readFileSync(path.join(archive, 'budget-report.json'))) : null }
  const target = path.join(archive, 'manifest.json')
  fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
  return target
}

module.exports = { CONTEXT_FILE, CONTRACT, browserInputFingerprint, captureContext, shapeContext, archiveEvidence, validateCalibrationReference }
if (require.main === module) {
  try {
    const [command, ...args] = process.argv.slice(2)
    if (command === 'context') console.log(captureContext(process.cwd(), args[0]).run_id)
    else if (command === 'archive') console.log(`📊 Public bundle evidence: ${archiveEvidence({ worktree: args[0], canonicalRoot: args[1], sourceSha: args[2], logFile: args[3], exitCode: args[4], startedAt: args[5] })}`)
    else throw new Error('Expected context or archive')
  } catch (error) { console.error(`[bundle evidence] ${error.message}`); process.exitCode = 1 }
}
