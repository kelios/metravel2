#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { runBounded } = require('../../scripts/native-e2e-lib')
const { acquireQualityGateLock, releaseQualityGateLock } = require('../../scripts/quality-gate-lock')
const { resolveLockRoot } = require('../../scripts/build-lock')

const ROOT = path.resolve(__dirname, '../..')
const DRIVER = __dirname
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/
const OPS = {
  wait: ['sec'], shot: ['name'], tree: [], tap: ['x', 'y'], tapId: ['id', 'timeout'],
  tapText: ['text', 'timeout'], longPressText: ['text', 'sec'], longPressPlaceholder: ['placeholder', 'sec'],
  tapSystemAlertButton: ['alertText', 'button'], secretClipboard: ['key'], clearSecretClipboard: [],
  ensureSwitch: ['id', 'on'], typePlaceholder: ['placeholder', 'text'], swipe: ['dir'], type: ['text'],
  return: [], clear: ['text'], dismissKeyboard: [], home: [], activate: [], terminate: [],
  assert: ['id', 'text', 'state', 'value', 'count'], waitUntil: ['id', 'text', 'state', 'value', 'count', 'timeout'],
}
const REQUIRED = {
  wait: ['sec'], tap: ['x', 'y'], tapId: ['id'], tapText: ['text'], longPressText: ['text'],
  longPressPlaceholder: ['placeholder'], tapSystemAlertButton: ['alertText', 'button'], secretClipboard: ['key'],
  ensureSwitch: ['id', 'on'], typePlaceholder: ['placeholder', 'text'], swipe: ['dir'], type: ['text'], clear: ['text'],
}
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
function fail(message) { throw new Error(message) }
function assertExecutionReceipt(execution, steps) {
  const counts = { totalTestCount: 1, passedTests: 1, failedTests: 0, skippedTests: 0, expectedFailures: 0 }
  if (!execution || Object.entries(counts).some(([key, value]) => execution[key] !== value) || execution.identity !== 'MetravelDeviceUITests/RunScriptTests/testRunScript()') fail('Missing intended passing execution without failures or skips')
  if (execution.scriptSha256 !== sha256(JSON.stringify(steps)) || execution.completedSteps !== steps.length || execution.completedAssertions !== steps.filter((step) => ['assert', 'waitUntil'].includes(step.op)).length) fail('Execution script hash or completed counts mismatch')
  return execution
}
function assertExecutionResult(summary, tests, log, steps) {
  // Xcode may exit zero without executing the requested testcase. Read the actual
  // result bundle and the completed Swift dispatch, not just the process status.
  const expectedCounts = { totalTestCount: 1, passedTests: 1, failedTests: 0, skippedTests: 0, expectedFailures: 0 }
  if (!summary || summary.result !== 'Passed' || Object.entries(expectedCounts).some(([key, value]) => summary[key] !== value)) fail('XCTest must execute exactly one passing case without skips or expected failures')
  if (!Array.isArray(tests?.testNodes) || !tests.testNodes.length) fail('Missing XCTest case identity')
  const cases = []
  const visit = (nodes, bundle = null) => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') fail('Invalid XCTest result tree')
      const owner = node.nodeType === 'UI test bundle' ? node.name : bundle
      if (node.nodeType === 'Test Case') cases.push({ bundle: owner, identity: node.nodeIdentifier, result: node.result })
      if (node.children !== undefined) {
        if (!Array.isArray(node.children)) fail('Invalid XCTest result tree')
        visit(node.children, owner)
      }
    }
  }
  visit(tests.testNodes)
  const identity = 'RunScriptTests/testRunScript()'
  if (cases.length !== 1 || cases[0].bundle !== 'MetravelDeviceUITests' || cases[0].identity !== identity || cases[0].result !== 'Passed') fail('Unexpected XCTest case identity or outcome')
  const lines = log.split(/\r?\n/).filter((line) => /^\s*QA-COMPLETE\s/.test(line))
  if (lines.length !== 1) fail('Missing or duplicate completed QA_SCRIPT receipt')
  let receipt
  try { receipt = JSON.parse(lines[0].replace(/^\s*QA-COMPLETE\s+/, '')) } catch { fail('Invalid completed QA_SCRIPT receipt') }
  const scriptSha256 = sha256(JSON.stringify(steps))
  const assertions = steps.filter((step) => ['assert', 'waitUntil'].includes(step.op)).length
  if (receipt?.schemaVersion !== 1 || receipt.scriptSha256 !== scriptSha256 || receipt.completedSteps !== steps.length || receipt.completedAssertions !== assertions) fail('QA_SCRIPT dispatch hash or completion counts mismatch')
  return assertExecutionReceipt({ ...expectedCounts, identity: `MetravelDeviceUITests/${identity}`, scriptSha256, completedSteps: receipt.completedSteps, completedAssertions: receipt.completedAssertions }, steps)
}
function validateSteps(steps, privateInput = false) {
  if (!Array.isArray(steps) || !steps.length || steps.length > 200) fail('Expected 1..200 steps')
  for (const [i, step] of steps.entries()) {
    const bad = (message) => fail(`Step ${i}: ${message}`)
    if (!step || typeof step !== 'object' || Array.isArray(step) || !Object.hasOwn(OPS, step.op)) bad('unknown operation')
    const allowed = new Set(['op', 'name', ...OPS[step.op]])
    if (Object.keys(step).some((key) => !allowed.has(key))) bad('unexpected field')
    for (const field of REQUIRED[step.op] || []) if (step[field] === undefined) bad(`missing ${field}`)
    for (const field of ['id', 'text', 'placeholder', 'alertText', 'button', 'key']) {
      if (step[field] !== undefined && (typeof step[field] !== 'string' || !step[field].length || step[field].length > 4096)) bad(`invalid ${field}`)
    }
    if (step.name !== undefined && (typeof step.name !== 'string' || !SAFE_NAME.test(step.name))) bad('unsafe name')
    if (step.op === 'secretClipboard' && !/^[A-Za-z0-9_-]{1,64}$/.test(step.key)) bad('invalid private key')
    if (step.on !== undefined && typeof step.on !== 'boolean') bad('on must be boolean')
    if (step.dir !== undefined && !['up', 'down', 'left', 'right'].includes(step.dir)) bad('invalid direction')
    for (const field of ['sec', 'timeout', 'x', 'y']) {
      if (step[field] !== undefined && (typeof step[field] !== 'number' || !Number.isFinite(step[field]) || step[field] < 0 || step[field] > (['x', 'y'].includes(field) ? 4096 : 30))) bad(`invalid ${field}`)
    }
    if (step.op === 'wait' && step.sec > 5) bad('fixed waits limited to 5s; use waitUntil')
    if (['assert', 'waitUntil'].includes(step.op)) {
      if (Number(step.id !== undefined) + Number(step.text !== undefined) !== 1) bad('one exact id or text selector required')
      if (!['exists', 'absent', 'hittable', 'value', 'count'].includes(step.state)) bad('invalid assertion state')
      if (step.state === 'value' && typeof step.value !== 'string') bad('value must be string')
      if (step.state === 'count' && (!Number.isInteger(step.count) || step.count < 0 || step.count > 100)) bad('count must be 0..100')
    }
    if (privateInput && ['shot', 'tree', 'type', 'typePlaceholder', 'clear', 'assert', 'waitUntil'].includes(step.op)) bad('operation disabled in private input')
    if (!privateInput && step.op === 'secretClipboard') bad('secretClipboard requires private input')
  }
  return steps
}
function runnerSourceHash() {
  const files = ['run.sh', 'run.js', '../../scripts/native-e2e-lib.js', '../../scripts/native-device-lock.js', 'MetravelDeviceUITests/RunScriptTests.swift',
    'MetravelDeviceUITests.xcodeproj/project.pbxproj',
    'MetravelDeviceUITests.xcodeproj/xcshareddata/xcschemes/MetravelDeviceUITests.xcscheme']
  return sha256(files.map((file) => `${file}\0${sha256(fs.readFileSync(path.join(DRIVER, file)))}`).join('\n'))
}
function assertUnlocked(lockState) {
  if (!/passcodeRequired:\s*false\b/.test(lockState) || /passcodeRequired:\s*true\b/.test(lockState)) fail('Device locked or lock state unknown; unlock before running')
}
function readConfig(args, env = process.env) {
  const flags = new Set(args.filter((arg) => arg.startsWith('--')))
  if ([...flags].some((flag) => !['--validate', '--rehearsal'].includes(flag))) fail('Unknown flag')
  const positional = args.filter((arg) => !arg.startsWith('--'))
  if (!positional.length || positional.length > 2) fail('Usage: run.sh [--validate] [--rehearsal] <JSON|@file> [label]')
  const label = positional[1] || 'run'
  if (!SAFE_NAME.test(label)) fail('Unsafe label')
  const scenarioFile = positional[0].startsWith('@') ? fs.realpathSync(path.resolve(positional[0].slice(1))) : null
  const raw = scenarioFile ? fs.readFileSync(scenarioFile, 'utf8') : positional[0]
  let scenario
  try { scenario = JSON.parse(raw) } catch { fail('Invalid scenario JSON') }
  const steps = validateSteps(Array.isArray(scenario) ? scenario : scenario.steps, env.QA_PRIVATE_INPUT === '1')
  if (env.IOS_QA_ATTACHMENTS !== undefined && env.IOS_QA_ATTACHMENTS !== 'none') fail('Invalid attachment policy')
  if (env.IOS_QA_ATTACHMENTS === 'none' && steps.some((step) => ['shot', 'tree'].includes(step.op))) fail('Capture forbidden by attachment policy')
  const keepNever = env.QA_PRIVATE_INPUT === '1' || env.IOS_QA_ATTACHMENTS === 'none'
  const attachmentPolicy = { system: keepNever ? 'keepNever' : 'deleteOnSuccess', user: keepNever ? 'keepNever' : 'keepAlways' }
  const rehearsal = flags.has('--rehearsal')
  if (!Array.isArray(scenario) && (!SAFE_NAME.test(scenario.id || '') || scenario.layer !== 'physical-ios')) fail('Scenario requires id and layer=physical-ios')
  if (rehearsal) {
    if (!scenarioFile || Array.isArray(scenario) || !steps.some((step) => step.op === 'assert')) fail('Rehearsal requires tracked scenario object with assertions')
    const relative = path.relative(ROOT, scenarioFile)
    if (relative.startsWith('..') || path.isAbsolute(relative)) fail('Scenario must be in repository')
    try { execFileSync('git', ['ls-files', '--error-unmatch', '--', relative], { cwd: ROOT, stdio: 'ignore' }) } catch { fail('Rehearsal scenario must be tracked') }
  }
  const metadata = {
    candidate: Object.fromEntries(['VERSION', 'BUILD', 'SOURCE', 'ORIGIN'].map((key) => [key.toLowerCase(), env[`IOS_QA_CANDIDATE_${key}`] || null])),
    environment: { apiUrl: env.IOS_QA_API_URL || null, locale: env.IOS_QA_LOCALE || null, accountRole: env.IOS_QA_ACCOUNT_ROLE || null, deviceModel: env.IOS_QA_DEVICE_MODEL || null },
  }
  if (rehearsal) {
    if (Object.values(metadata.candidate).concat(Object.values(metadata.environment)).some((value) => !value || /[\r\n]/.test(value))) fail('Rehearsal requires complete candidate and environment metadata')
    if (!/^[a-f0-9]{40}$/i.test(metadata.candidate.source)) fail('Candidate source must be full 40-character commit SHA')
    let api
    try { api = new URL(metadata.environment.apiUrl) } catch { fail('Invalid API URL') }
    if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password || api.search || api.hash) fail('API URL must not contain credentials/query/hash')
    if (!['ru', 'be', 'uk', 'pl', 'en'].includes(metadata.environment.locale)) fail('Unsupported locale')
    if (!SAFE_NAME.test(metadata.environment.accountRole)) fail('Account role must be a public role, not credentials')
  }
  const budget = Number(env.IOS_QA_BUDGET_SEC || 300)
  if (!Number.isInteger(budget) || budget < 10 || budget > 600) fail('IOS_QA_BUDGET_SEC must be 10..600')
  const device = env.IOS_QA_DEVICE
  if (!device || !/^[A-Fa-f0-9-]{8,64}$/.test(device)) fail('Explicit IOS_QA_DEVICE required')
  const bundle = env.QA_BUNDLE || 'by.metravel.app'
  if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(bundle)) fail('Invalid QA_BUNDLE')
  const out = path.resolve(env.IOS_QA_OUT || path.join(ROOT, '.codex-temp/ios-device-qa'))
  // Resolve existing ancestors so a symlink cannot redirect evidence outside ignored paths.
  let parent = out
  while (!fs.existsSync(parent)) parent = path.dirname(parent)
  const canonicalOut = path.join(fs.realpathSync(parent), path.relative(parent, out))
  if (!['.codex-temp', 'test-results'].some((base) => canonicalOut.startsWith(path.join(ROOT, base) + path.sep))) fail('IOS_QA_OUT must be inside .codex-temp/ or test-results/')
  if (env.IOS_QA_ALLOW_PROVISIONING_UPDATES && env.IOS_QA_ALLOW_PROVISIONING_UPDATES !== '1') fail('Invalid provisioning opt-in')
  return { steps, scenario: { id: scenario.id || 'diagnostic', sha256: sha256(raw) }, rehearsal, validate: flags.has('--validate'), metadata, budget, device, bundle, out: canonicalOut, label, privateInput: env.QA_PRIVATE_INPUT === '1', attachmentPolicy, provisioning: env.IOS_QA_ALLOW_PROVISIONING_UPDATES === '1' }
}
function productHashes(directory) {
  const result = {}
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (entry.isFile()) result[path.relative(directory, full)] = sha256(fs.readFileSync(full))
      else if (entry.isSymbolicLink()) result[path.relative(directory, full)] = `link:${fs.readlinkSync(full)}`
    }
  }
  visit(directory)
  return result
}
function validCache(cache, fingerprint) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(cache, 'manifest.json'), 'utf8'))
    const products = path.join(cache, 'Build/Products')
    return manifest.fingerprint === fingerprint && Object.keys(manifest.files).some((file) => file.endsWith('.xctestrun')) && JSON.stringify(manifest.files) === JSON.stringify(productHashes(products))
  } catch { return false }
}
// A separate process group lets the deadline stop only OUR xcodebuild descendants.
async function runCommand(command, args, { deadline, log, env = process.env, limit = Infinity } = {}) {
  const remaining = Math.min(deadline - Date.now(), limit)
  if (remaining <= 0) throw Object.assign(new Error('Run budget exhausted'), { code: 'TIMEOUT' })
  const controller = new AbortController()
  const interrupt = () => controller.abort()
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', interrupt)
  try {
    const result = await runBounded(command, args, { timeoutMs: remaining, logPath: log, env, signal: controller.signal })
    if (result.timedOut) throw Object.assign(new Error('Run budget exhausted'), { code: 'TIMEOUT' })
    if (result.code !== 0) throw Object.assign(new Error(`${command} failed; inspect run log`), { exitCode: result.code })
    return result.output
  } finally {
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', interrupt)
  }
}

async function main(args = process.argv.slice(2), env = process.env) {
  const config = readConfig(args, env) // Never probe device or create output before validation.
  const sourceSha256 = runnerSourceHash()
  if (config.validate) { console.log(`VALIDATED ${config.scenario.id} (${config.steps.length} steps)`); return }
  const { acquireDeviceLock } = require('../../scripts/native-device-lock')
  const quality = acquireQualityGateLock({ name: 'physical-ios-xctest' })
  const releaseQuality = () => { if (!quality.reentrant) releaseQualityGateLock() }
  let release
  try { release = acquireDeviceLock({ device: config.device, root: resolveLockRoot(ROOT), name: 'physical-ios-xctest' }) } catch (error) { releaseQuality(); throw error }
  const startedAt = new Date().toISOString()
  const deadline = Date.now() + config.budget * 1000
  let runDir, report, incompleteCache
  try {
    fs.mkdirSync(config.out, { recursive: true, mode: 0o700 })
    runDir = fs.mkdtempSync(path.join(config.out, config.label + '-'))
    report = { schemaVersion: 1, status: 'failed', layer: 'physical-ios', mode: config.rehearsal ? 'rehearsal' : 'diagnostic', scenario: config.scenario, runner: { sourceSha256, fingerprint: null }, ...config.metadata, attachmentPolicy: config.attachmentPolicy, startedAt, finishedAt: null, exitCode: 1 }
    const buildLog = path.join(runDir, 'build.log')
    const log = path.join(runDir, 'test.log')
    const command = (program, argv, options = {}) => runCommand(program, argv, { deadline, env, ...options })
    const lockState = await command('xcrun', ['devicectl', 'device', 'info', 'lockState', '--device', config.device], { limit: 15000 })
    assertUnlocked(lockState)
    if (config.rehearsal) {
      const appsFile = path.join(runDir, 'installed-app.json')
      await command('xcrun', ['devicectl', 'device', 'info', 'apps', '--device', config.device, '--bundle-id', config.bundle, '--json-output', appsFile], { limit: 15000 })
      const apps = JSON.parse(fs.readFileSync(appsFile, 'utf8')).result?.apps
      const matches = Array.isArray(apps) ? apps.filter((app) => app.bundleIdentifier === config.bundle) : []
      if (matches.length !== 1 || String(matches[0].version) !== config.metadata.candidate.version || String(matches[0].bundleVersion) !== config.metadata.candidate.build) fail('Installed candidate version/build does not match rehearsal metadata')
      report.observedCandidate = { version: String(matches[0].version), build: String(matches[0].bundleVersion) }
    }
    const xcode = await command('xcodebuild', ['-version'], { limit: 15000 })
    const fingerprint = sha256(JSON.stringify({ sourceSha256, xcode, device: config.device, bundle: config.bundle, developerDir: env.DEVELOPER_DIR || null }))
    report.runner.fingerprint = fingerprint
    const cache = path.join(resolveLockRoot(ROOT), '.codex-temp/ios-runner-cache', fingerprint)
    const destination = ['-destination', `id=${config.device}`, '-destination-timeout', '15']
    if (!validCache(cache, fingerprint)) {
      if (fs.existsSync(cache)) fail('Runner cache integrity mismatch; preserve evidence and rebuild with a fresh cache after inspection')
      fs.mkdirSync(cache, { recursive: true, mode: 0o700 })
      incompleteCache = cache
      await command('xcodebuild', ['build-for-testing', '-project', path.join(DRIVER, 'MetravelDeviceUITests.xcodeproj'), '-scheme', 'MetravelDeviceUITests', ...destination, '-derivedDataPath', cache, ...(config.provisioning ? ['-allowProvisioningUpdates'] : [])], { log: buildLog })
      const files = productHashes(path.join(cache, 'Build/Products'))
      if (!Object.keys(files).some((file) => file.endsWith('.xctestrun'))) fail('Build produced no xctestrun')
      fs.writeFileSync(path.join(cache, 'manifest.json'), JSON.stringify({ fingerprint, files }, null, 2), { mode: 0o600 })
      incompleteCache = null
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(cache, 'manifest.json'), 'utf8'))
    const testRuns = Object.keys(manifest.files).filter((file) => file.endsWith('.xctestrun'))
    if (testRuns.length !== 1) fail('Expected one cached xctestrun')
    const runtime = path.join(runDir, 'run.xctestrun')
    fs.copyFileSync(path.join(cache, 'Build/Products', testRuns[0]), runtime)
    // __TESTROOT__ in an xctestrun is relative to its original products directory.
    // Apply explicit lifetimes to the runtime copy; cached products stay intact.
    const patch = `import plistlib,sys\np=sys.argv[1]\nwith open(p,'rb') as f: d=plistlib.load(f)\ndef visit(x):\n if isinstance(x,dict):\n  for k,v in list(x.items()):\n   if isinstance(v,str): x[k]=v.replace('__TESTROOT__',sys.argv[2])\n   else: visit(v)\n  if 'TestBundlePath' in x:\n   x['SystemAttachmentLifetime']=sys.argv[3]\n   x['UserAttachmentLifetime']=sys.argv[4]\n elif isinstance(x,list):\n  for v in x: visit(v)\nvisit(d)\nwith open(p,'wb') as f: plistlib.dump(d,f)\n`
    await command('python3', ['-c', patch, runtime, path.join(cache, 'Build/Products'), config.attachmentPolicy.system, config.attachmentPolicy.user], { limit: 10000 })
    const resultBundle = path.join(runDir, 'result.xcresult')
    await command('xcodebuild', ['test-without-building', '-xctestrun', runtime, ...destination, '-only-testing:MetravelDeviceUITests/RunScriptTests/testRunScript', '-parallel-testing-enabled', 'NO', '-maximum-concurrent-test-device-destinations', '1', '-resultBundlePath', resultBundle], { log, env: { ...env, TEST_RUNNER_QA_SCRIPT: JSON.stringify(config.steps), TEST_RUNNER_QA_BUNDLE: config.bundle, TEST_RUNNER_QA_PRIVATE_INPUT: config.privateInput ? '1' : '0' } })
    let summary, tests
    try {
      summary = JSON.parse(await command('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', resultBundle], { limit: 15000 }))
      tests = JSON.parse(await command('xcrun', ['xcresulttool', 'get', 'test-results', 'tests', '--path', resultBundle], { limit: 15000 }))
    } catch (error) {
      if (error.code === 'TIMEOUT') throw error
      fail('Cannot verify XCTest result bundle')
    }
    report.execution = assertExecutionResult(summary, tests, fs.readFileSync(log, 'utf8'), config.steps)
    report.status = 'passed'; report.exitCode = 0
  } catch (error) {
    if (incompleteCache) {
      // Preserve failed products for diagnosis without poisoning future cache lookup.
      try { fs.renameSync(incompleteCache, `${incompleteCache}-failed-${Date.now()}`) } catch { /* preserve original */ }
    }
    if (report) { report.status = error.code === 'TIMEOUT' ? 'timed_out' : 'failed'; report.exitCode = error.code === 'TIMEOUT' ? 124 : (error.exitCode || 1) }
    throw error
  } finally {
    try {
      if (report) { report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 }); console.log(`Evidence: ${path.relative(ROOT, runDir)}`) }
    } finally { release(); releaseQuality() }
  }
}
module.exports = { validateSteps, readConfig, runnerSourceHash, assertUnlocked, productHashes, validCache, runCommand, assertExecutionResult, assertExecutionReceipt, main }
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = error.code === 'TIMEOUT' ? 124 : (['NATIVE_DEVICE_BUSY', 'QUALITY_GATE_BUSY'].includes(error.code) ? 73 : 1) })
