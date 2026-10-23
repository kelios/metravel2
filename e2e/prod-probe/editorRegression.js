/* Explicit owned-fixture regression; ordinary production-smoke is unchanged. */
const path = require('node:path')
const crypto = require('node:crypto')
const { buildSource, formatProbeError } = require('./prodProbe')
const { openOwnedBatch, writePrivate, readPrivate, runDirectory, ROOT, assert } = require('./travelEditorFixtures')
const { openRoleContext, runEditorHistory } = require('../helpers/editorFixtureBrowser')

function parseOptions(args) {
  const options = {}
  const allowed = ['phase', 'width', 'temperature', 'editor-state', 'depth', 'sha', 'run-id', 'scope-capture']
  for (const arg of args) {
    if (arg === '--execute') { assert(!options.execute, 'Duplicate execution flag'); options.execute = true; continue }
    const match = /^--([a-z-]+)=(.+)$/.exec(arg)
    assert(match && allowed.includes(match[1]) && options[match[1]] == null, 'Unknown/duplicate diagnostic option')
    options[match[1]] = match[2]
  }
  assert(options.execute, 'Explicit --execute is required; no runtime started')
  assert(['diagnostic', 'matrix'].includes(options.phase), 'Select --phase=diagnostic or --phase=matrix')
  assert(/^[a-f0-9]{40}$/.test(options.sha || ''), 'Exact live40-character SHA is required')
  runDirectory(options['run-id'])
  for (const [key, values] of Object.entries({ width: ['1440', '390', 'all'], temperature: ['cold', 'warm', 'all'],
    'editor-state': ['step1', 'step6', 'all'], depth: ['zero', 'nonzero'] })) {
    assert(values.includes(options[key]), `Explicit valid --${key} is required`)
  }
  if (options.phase === 'diagnostic') assert(![options.width, options.temperature, options['editor-state']].includes('all'), 'Diagnostic is one bounded cell')
  if (options['scope-capture']) assert(options.phase === 'diagnostic' && /^\.codex-temp\/[\w./-]+\.json$/.test(options['scope-capture']) &&
    !options['scope-capture'].split('/').includes('..'), 'Scope capture must be a reviewed ignored JSON under .codex-temp')
  return options
}
function cellsFor(options) {
  const expand = (value, all) => value === 'all' ? all : [value]
  return expand(options.width, ['1440', '390']).flatMap(width =>
    expand(options.temperature, ['cold', 'warm']).flatMap(temperature =>
      expand(options['editor-state'], ['step1', 'step6']).map(editorState => ({ width: Number(width), temperature, editorState, depth: options.depth }))))
}
async function verifyBuild(sha) {
  const build = await buildSource()
  assert(build.sha === sha && build.dirty !== true, 'Live build differs from the exact selected clean baseline')
  return { sha: build.sha, dirty: build.dirty === true }
}
async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), cells = cellsFor(options)
  assert(cells.length > 0, 'Zero selected diagnostic scenarios')
  const directory = runDirectory(options['run-id']), reportFile = path.join(directory, 'report.json')
  const fs = require('node:fs')
  assert(!fs.existsSync(reportFile), 'Raw diagnostic report already exists; choose a fresh run identity')
  const report = { task: 2702, phase: options.phase, appSha: options.sha, startedAt: new Date().toISOString(),
    runnerSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), scenarios: [], checks: [], errors: [],
    productVerdict: 'RUNNING', attributionVerdict: 'NOT_YET_ESTABLISHED', cleanupComplete: false }
  const save = () => writePrivate(reportFile, report)
  const emit = async entry => { report.checks.push(entry); save() }
  save()
  let batch, failure
  try {
    report.buildBefore = await verifyBuild(options.sha); save()
    batch = await openOwnedBatch({ baseUrl: 'https://metravel.by', runId: options['run-id'], needOther: true })
    await batch.setup()
    const capture = options['scope-capture'] ? readPrivate(path.resolve(ROOT, options['scope-capture'])) : null
    for (const cell of cells) {
      const { context, page } = await openRoleContext(batch.admin.browser, batch, 'author', cell.width)
      const scenario = { ...cell, startedAt: new Date().toISOString(), verdict: 'RUNNING' }
      report.scenarios.push(scenario); save()
      try {
        await runEditorHistory({ context, page, batch, ...cell, capture, emit,
          write: (filename, source) => writePrivate(path.join(directory, 'scripts', filename), source) })
        scenario.verdict = 'PASS'
      } catch (error) { scenario.verdict = 'FAIL'; throw error }
      finally { scenario.finishedAt = new Date().toISOString(); save(); await context.close() }
    }
    report.productVerdict = 'PASS'
  } catch (error) {
    failure = error
    report.productVerdict = 'FAIL'
    report.errors.push({ phase: 'setup-or-scenario', message: formatProbeError(error) })
  } finally {
    // A failing baseline is the important attribution case. Bind that trace to
    // both live-build reads too; a concurrent rollout invalidates attribution.
    try { report.buildAfter = await verifyBuild(options.sha) }
    catch (error) { failure ||= error; report.errors.push({ phase: 'final-live-build', message: formatProbeError(error) }) }
    if (batch) {
      try { await batch.cleanup(); report.cleanupComplete = batch.reg.cleaned === true }
      catch (error) { failure ||= error; report.errors.push({ phase: 'cleanup', message: formatProbeError(error) }) }
      finally { await batch.close() }
    }
    report.finishedAt = new Date().toISOString()
    report.verdict = !failure && report.cleanupComplete && report.scenarios.length === cells.length &&
      report.scenarios.every(scenario => scenario.verdict === 'PASS') ? 'PASS' : 'FAIL'
    save()
  }
  console.log(JSON.stringify({ task: 2702, appSha: report.appSha, verdict: report.verdict,
    productVerdict: report.productVerdict, attributionVerdict: report.attributionVerdict,
    executed: report.scenarios.length, expected: cells.length, cleanupComplete: report.cleanupComplete,
    report: path.relative(ROOT, reportFile) }))
  if (report.verdict !== 'PASS') throw new Error(`Editor regression failed; inspect private ${path.relative(ROOT, reportFile)}`)
  return report
}

module.exports = { parseOptions, cellsFor, main }
if (require.main === module) main().catch(error => { console.error(formatProbeError(error)); process.exitCode = 1 })
