#!/usr/bin/env node
'use strict'

// Rehearsal only. Hashes establish consistency, never independent provenance.
const fs = require('node:fs')
const path = require('node:path')
const { createHash, randomUUID } = require('node:crypto')
const deviceRunner = require('../tools/ios-device-uitests/run')
const { validateSteps, runnerSourceHash, assertExecutionReceipt } = deviceRunner
const { acquireQualityGateLock, releaseQualityGateLock } = require('./quality-gate-lock')
const ROOT = path.resolve(__dirname, '..')
const MAX_AGE_MS = 86400000
const CANDIDATE_KEYS = ['version', 'build', 'source', 'origin']
const ENVIRONMENT_KEYS = ['apiUrl', 'locale', 'accountRole', 'deviceModel']
const STAGES = {
  login: ['pre-login', 'credentials', 'post-login'],
  register: ['pre-register', 'registration-input', 'post-register', 'activation-login-input', 'registered'],
  'account-delete': ['pre-delete', 'delete', 'relogin-input', 'failed-relogin'],
}
const PRIVATE_STAGES = new Set(['credentials', 'registration-input', 'activation-login-input', 'relogin-input'])
const REJECTION_TEXT = 'Invalid email or password'
const hash = (value) => createHash('sha256').update(value).digest('hex')
const read = (file) => { const raw = fs.readFileSync(file, 'utf8'); return { raw, value: JSON.parse(raw) } }
const sourceHash = () => hash(fs.readFileSync(__filename))
const normalizerSourceHash = () => hash(['api/auth.ts', 'utils/authFailure.ts', 'components/auth/LoginForm.tsx', 'i18n/locales/en/static/errors_static.ts'].map((file) => `${file}\0${hash(fs.readFileSync(path.join(ROOT, file)))}`).join('\n'))
const entryHash = (entry) => hash(JSON.stringify(entry))
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const same = (actual, expected, keys) => keys.every((key) => actual?.[key] === expected?.[key])
const opaque = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value || '')
const keysOnly = (object, keys) => object && !Array.isArray(object) && Object.keys(object).every((key) => keys.includes(key))

function assertIdentity(identity) {
  assert(keysOnly(identity?.candidate, CANDIDATE_KEYS) && CANDIDATE_KEYS.every((key) => typeof identity.candidate[key] === 'string' && identity.candidate[key].length > 0), 'Incomplete candidate')
  assert(/^\d+(?:\.\d+){0,3}$/.test(identity.candidate.version) && /^\d+$/.test(identity.candidate.build) && /^[a-f0-9]{40}$/.test(identity.candidate.source) && identity.candidate.origin === 'testflight', 'Flow requires exact TestFlight candidate metadata')
  assert(keysOnly(identity.environment, ENVIRONMENT_KEYS) && ENVIRONMENT_KEYS.every((key) => typeof identity.environment[key] === 'string' && identity.environment[key].length > 0 && !/[\r\n@]/.test(identity.environment[key])), 'Incomplete public environment')
  const url = new URL(identity.environment.apiUrl)
  assert(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash, 'Invalid API origin')
  assert(['ru', 'be', 'uk', 'pl', 'en'].includes(identity.environment.locale) && /^[a-z0-9-]{1,80}$/.test(identity.environment.accountRole), 'Invalid public locale or role')
  assert(opaque(identity.accountRef), 'Opaque random account reference required')
  assert(/^[a-f0-9]{64}$/.test(identity.runnerFingerprint || ''), 'Runner fingerprint required')
}
function assertBinding(actual, expected) {
  assert(same(actual?.candidate, expected.candidate, CANDIDATE_KEYS) && same(actual?.environment, expected.environment, ENVIRONMENT_KEYS) && actual?.accountRef === expected.accountRef && actual?.runnerFingerprint === expected.runnerFingerprint, 'Flow candidate/environment/account/runner mismatch')
}
function assertTimes(startedAt, finishedAt, now, after = -Infinity) {
  const start = Date.parse(startedAt), finish = Date.parse(finishedAt)
  assert(Number.isFinite(start) && Number.isFinite(finish) && start >= after && finish >= start && finish <= now && now - start <= MAX_AGE_MS, 'Stale, overlapping or invalid flow timestamps')
  return finish
}
function assertObserved(observed, candidate) {
  assert(observed?.version === candidate.version && observed?.build === candidate.build, 'Installed candidate mismatch')
}
function loadFlow(file) {
  const { raw, value: flow } = read(file)
  assert(keysOnly(flow, ['schemaVersion', 'id', 'status', 'reviewed', 'scene', 'accountKind', 'completeReviewScenes', 'phases']) && flow.schemaVersion === 1 && /^[a-z0-9-]{1,80}$/.test(flow.id || '') && STAGES[flow.scene], 'Invalid flow identity')
  assert(flow.status === 'frozen' && flow.reviewed === true, 'Flow must be reviewed and frozen')
  assert(Array.isArray(flow.completeReviewScenes) && flow.completeReviewScenes.length === 1 && flow.completeReviewScenes[0] === flow.scene, 'Only the whole frozen flow may declare its scene')
  assert(['reviewer-demo', 'disposable'].includes(flow.accountKind) && (flow.scene === 'login' || flow.accountKind === 'disposable'), 'Registration/deletion requires disposable fixture')
  assert(Array.isArray(flow.phases) && JSON.stringify(flow.phases.map((phase) => phase.id)) === JSON.stringify(STAGES[flow.scene]), 'Missing, reordered or duplicate phases')
  const files = new Set()
  const phases = flow.phases.map((phase) => {
    assert(keysOnly(phase, ['id', 'visibility', 'path', 'credentialExit']) && phase.visibility === (PRIVATE_STAGES.has(phase.id) ? 'private' : 'public') && typeof phase.path === 'string', 'Invalid phase visibility/path')
    const fullPath = fs.realpathSync(path.resolve(path.dirname(file), phase.path))
    assert(!files.has(fullPath), 'Reused phase scenario'); files.add(fullPath)
    const { raw: scenarioRaw, value: scenario } = read(fullPath)
    validateSteps(scenario.steps, phase.visibility === 'private')
    assert(scenario.layer === 'physical-ios' && scenario.id === `${flow.id}-${phase.id}`, 'Phase identity mismatch')
    assert(!scenario.completeReviewScenes?.length && !scenario.completeReviewSegments?.length, 'Partial phase cannot declare complete coverage')
    assert(!scenario.steps.some((step) => ['shot', 'tree', 'type', 'typePlaceholder', 'clear'].includes(step.op)), 'Capture and literal input forbidden in review flow')
    if (phase.visibility === 'public') assert(scenario.steps.some((step) => step.op === 'assert'), 'Public phase needs assertions')
    else {
      assert(scenario.steps.some((step) => step.op === 'secretClipboard'), 'Private phase requires private channel')
      assert(!scenario.steps.some((step) => step.op === 'wait'), 'Private phase cannot wait or capture')
      const exit = phase.credentialExit
      assert(keysOnly(exit, ['submitStep', 'rejectionStep', 'leaveStep', 'formId', 'formText']) && Number.isInteger(exit.submitStep) && Number.isInteger(exit.leaveStep) && exit.submitStep >= 0 && exit.leaveStep > exit.submitStep && exit.leaveStep === scenario.steps.length - 2, 'Reviewed private submit/leave boundary required')
      assert(['tapId', 'tapText', 'return'].includes(scenario.steps[exit.submitStep]?.op) && ['tapId', 'tapText'].includes(scenario.steps[exit.leaveStep]?.op) && scenario.steps.at(-1).op === 'clearSecretClipboard', 'Private phase must submit, leave form and clear clipboard')
      if (phase.id === 'relogin-input') {
        const rejection = scenario.steps[exit.rejectionStep]
        assert(Number.isInteger(exit.rejectionStep) && exit.rejectionStep > exit.submitStep && exit.rejectionStep < exit.leaveStep && rejection?.op === 'tapText' && rejection.text === REJECTION_TEXT && Number.isFinite(rejection.timeout) && rejection.timeout > 0 && rejection.timeout <= 30, 'Exact bounded rejection synchronization required')
      } else assert(exit.rejectionStep === undefined, 'Unexpected rejection synchronization')
      assert(Number(typeof exit.formId === 'string' && exit.formId.length > 0) + Number(typeof exit.formText === 'string' && exit.formText.length > 0) === 1, 'Exact credential form boundary required')
    }
    return { ...phase, fullPath, scenario, sha256: hash(scenarioRaw) }
  })
  for (const [index, phase] of phases.entries()) {
    if (phase.visibility !== 'private') continue
    const next = phases[index + 1]?.scenario.steps[0]
    const previous = phases[index - 1]?.scenario.steps.at(-1)
    const selector = phase.credentialExit.formId ? 'id' : 'text'
    const form = phase.credentialExit.formId || phase.credentialExit.formText
    assert(previous?.op === 'assert' && ['exists', 'hittable'].includes(previous.state) && previous[selector] === form, 'Pre-input phase must assert the exact credential form')
    assert(next?.op === 'assert' && next.state === 'absent' && next[selector] === form, 'Public handoff must first assert credential form absent')
    if (phase.id === 'relogin-input') {
      const stale = phases[index - 1].scenario.steps.at(-2)
      assert(stale?.op === 'assert' && stale.text === REJECTION_TEXT && stale.state === 'absent', 'Public stale rejection absence required')
    }
  }
  return { flow, phases, sha256: hash(raw), file: path.resolve(file) }
}
function assertAttestation(receipt, kind, identity, flowSha256, now, after = -Infinity) {
  assert(keysOnly(receipt, ['schemaVersion', 'kind', 'status', 'independentlyReviewed', 'candidate', 'environment', 'accountRef', 'runnerFingerprint', 'flowSha256', 'runnerSourceSha256', 'orchestratorSha256', 'startedAt', 'finishedAt', 'dummyOnly', 'noSecretArtifacts', 'privacyEvidenceSha256', 'accountKind', 'activated', 'runRef', 'phaseId', 'contextSha256', 'nativeCorrelation']) && receipt?.schemaVersion === 1 && receipt.kind === kind && receipt.status === 'passed' && receipt.independentlyReviewed === true && receipt.flowSha256 === flowSha256 && receipt.runnerSourceSha256 === runnerSourceHash() && receipt.orchestratorSha256 === sourceHash(), 'Missing matching independent prerequisite')
  assertBinding(receipt, identity)
  assertTimes(receipt.startedAt, receipt.finishedAt, now, after)
  if (kind === 'dummy-canary') assert(receipt.dummyOnly === true && receipt.noSecretArtifacts === true && /^[a-f0-9]{64}$/.test(receipt.privacyEvidenceSha256 || ''), 'Dummy canary privacy review required')
  else if (kind === 'activation') assert(receipt.accountKind === 'disposable' && receipt.activated === true, 'Disposable activation required')
  else assert(kind === 'relogin-rejection' && receipt.accountKind === 'disposable' && receipt.runRef === identity.runRef && receipt.phaseId === 'relogin-input' && /^[a-f0-9]{64}$/.test(receipt.contextSha256 || ''), 'Native rejection binding required')
}
async function waitForAttestation(file, kind, identity, flowSha256, { deadline, after, now = Date.now, pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const label = kind === 'activation' ? 'Activation' : 'Native rejection'
  assert(typeof file === 'string' && file.length > 0 && Number.isFinite(deadline), `Explicit ${label.toLowerCase()} receipt path required`)
  // The external activation owner writes an atomic receipt. We only wait for
  // that named file within the already-running flow budget; never activate.
  while (true) {
    const remaining = deadline - now()
    assert(remaining > 0, `${label} prerequisite deadline exceeded`)
    if (fs.existsSync(file)) {
      const activation = read(file).value
      assertAttestation(activation, kind, identity, flowSha256, now(), after)
      return activation
    }
    await pause(Math.min(250, remaining))
  }
}
function waitForActivation(file, identity, flowSha256, options) {
  return waitForAttestation(file, 'activation', identity, flowSha256, options)
}
function phaseContext(receipt, phase, entry, dispatchedAt) {
  return { schemaVersion: 1, kind: 'native-phase-context', candidate: receipt.candidate, environment: receipt.environment, accountRef: receipt.accountRef, runnerFingerprint: receipt.runnerFingerprint, runRef: receipt.runRef, flow: receipt.flow, runnerSourceSha256: receipt.runnerSourceSha256, orchestratorSha256: receipt.orchestratorSha256, phase: { id: phase.id, visibility: phase.visibility, scenarioSha256: phase.sha256, previousSha256: entry.previousSha256 }, dispatchedAt }
}
function assertNativeRejection(attestation, receipt, entry, deletion, now, phase, report) {
  assertAttestation(attestation, 'relogin-rejection', receipt, receipt.flow.sha256, now)
  assert(attestation.contextSha256 === entry.contextSha256, 'Native rejection context mismatch')
  const correlation = attestation.nativeCorrelation
  assert(keysOnly(correlation, ['origin', 'evidenceSha256', 'priorValid', 'deletion', 'rejection']) && correlation.origin === 'native-device-network' && /^[a-f0-9]{64}$/.test(correlation.evidenceSha256 || ''), 'Actual native response correlation required')
  const requests = new Set()
  const base = receipt.environment.apiUrl.replace(/\/+$/, '')
  // Match normalizeApiBaseUrl in utils/resolveApiBaseUrl.ts: metadata may
  // name the origin or the already-normalized /api base.
  const api = base.endsWith('/api') ? base : `${base}/api`
  for (const [key, method, endpoint, statuses] of [['priorValid', 'POST', `${api}/user/login/`, [200]], ['deletion', 'DELETE', `${api}/user/delete-account/`, [200, 204]], ['rejection', 'POST', `${api}/user/login/`, [401]]]) {
    const event = correlation[key]
    const fields = ['accountRef', 'requestRef', 'observedAt', 'method', 'endpoint', 'status', ...(key === 'rejection' ? ['code', 'classificationBasis', 'rawResponseBodyObserved', 'uiSource'] : [])]
    assert(keysOnly(event, fields) && event.accountRef === receipt.accountRef && opaque(event.requestRef) && !requests.has(event.requestRef) && event.method === method && event.endpoint === endpoint && statuses.includes(event.status), 'Native request identity/status mismatch')
    requests.add(event.requestRef)
    assertTimes(event.observedAt, event.observedAt, now)
    assert(Date.parse(event.observedAt) >= Date.parse(attestation.startedAt) && Date.parse(event.observedAt) <= Date.parse(attestation.finishedAt), 'Native observation outside attestation')
  }
  const { priorValid, deletion: removed, rejection } = correlation
  assert(deletion && Date.parse(priorValid.observedAt) < Date.parse(removed.observedAt) && Date.parse(removed.observedAt) >= Date.parse(deletion.startedAt) && Date.parse(removed.observedAt) <= Date.parse(deletion.finishedAt), 'Native deletion window mismatch')
  assert(rejection.code === 'invalid_credentials' && Date.parse(rejection.observedAt) > Date.parse(removed.observedAt) && Date.parse(rejection.observedAt) >= Date.parse(entry.startedAt) && Date.parse(rejection.observedAt) <= Date.parse(entry.finishedAt), 'Native rejection window/code mismatch')
  assert(['native-response-body', 'native-ui-source-classification'].includes(rejection.classificationBasis), 'Explicit native rejection classification basis required')
  if (rejection.classificationBasis === 'native-response-body') {
    assert(rejection.rawResponseBodyObserved === true && rejection.uiSource === undefined, 'Observed native response body required')
  } else {
    const evidence = rejection.uiSource
    assert(rejection.rawResponseBodyObserved === false && keysOnly(evidence, ['candidateSource', 'normalizerSha256', 'scenarioSha256', 'reportSha256', 'executionSha256', 'rejectionStep', 'text']), 'Derived native rejection evidence required')
    assert(evidence.candidateSource === receipt.candidate.source && evidence.normalizerSha256 === normalizerSourceHash() && evidence.scenarioSha256 === phase.sha256 && evidence.reportSha256 === entry.reportSha256 && evidence.executionSha256 === hash(JSON.stringify(report.execution)) && evidence.rejectionStep === phase.credentialExit.rejectionStep && evidence.text === REJECTION_TEXT, 'Native UI/source classification binding mismatch')
  }
}
function validateFlowReceipt(manifestFile, receiptFile, { now = Date.now(), expected } = {}) {
  try {
    const loaded = loadFlow(manifestFile), receipt = read(receiptFile).value
    assert(keysOnly(receipt, ['schemaVersion', 'mode', 'status', 'candidate', 'environment', 'accountRef', 'runnerFingerprint', 'runRef', 'accountKind', 'flow', 'orchestratorSha256', 'runnerSourceSha256', 'canary', 'startedAt', 'finishedAt', 'phases', 'finalSha256']) && receipt.schemaVersion === 1 && receipt.mode === 'rehearsal-flow' && receipt.status === 'passed', 'No successful whole flow')
    assertIdentity(receipt)
    if (loaded.flow.scene === 'account-delete') assert(receipt.environment.locale === 'en', 'Exact EN rejection locale required')
    if (expected) assertBinding(receipt, expected)
    assert(receipt.flow?.id === loaded.flow.id && receipt.flow?.sha256 === loaded.sha256 && receipt.orchestratorSha256 === sourceHash() && receipt.runnerSourceSha256 === runnerSourceHash(), 'Flow/orchestrator/runner changed')
    assert(receipt.accountKind === loaded.flow.accountKind && opaque(receipt.runRef), 'Invalid flow fixture/run binding')
    assert(Array.isArray(receipt.phases) && receipt.phases.length === loaded.phases.length, 'Missing phase receipts')
    assertTimes(receipt.startedAt, receipt.finishedAt, now)
    const runFinish = Date.parse(receipt.finishedAt)
    assertAttestation(receipt.canary, 'dummy-canary', receipt, loaded.sha256, now)
    assert(Date.parse(receipt.canary.finishedAt) <= Date.parse(receipt.startedAt), 'Canary must precede private input')
    let predecessor = null, finish = Date.parse(receipt.startedAt)
    const usedReports = new Set(), usedContexts = new Set()
    for (const [index, phase] of loaded.phases.entries()) {
      const entry = receipt.phases[index]
      assert(keysOnly(entry, ['id', 'visibility', 'scenarioSha256', 'previousSha256', 'report', 'reportSha256', 'startedAt', 'finishedAt', 'installedBefore', 'installedAfter', 'observedBeforeAt', 'observedAfterAt', 'activation', 'rejection', 'context', 'contextSha256']), 'Invalid phase receipt fields')
      assert(entry.id === phase.id && entry.visibility === phase.visibility && entry.scenarioSha256 === phase.sha256 && entry.previousSha256 === predecessor, 'Phase order/scenario/predecessor mismatch')
      const reportFile = fs.realpathSync(path.resolve(path.dirname(receiptFile), entry.report))
      assert(!usedReports.has(reportFile), 'Reused phase report'); usedReports.add(reportFile)
      const { raw, value: report } = read(reportFile)
      assert(entry.reportSha256 === hash(raw), 'Phase report changed')
      const contextFile = fs.realpathSync(path.resolve(path.dirname(receiptFile), entry.context))
      assert(!usedContexts.has(contextFile), 'Reused phase context'); usedContexts.add(contextFile)
      const context = read(contextFile)
      assert(entry.contextSha256 === hash(context.raw), 'Phase context changed')
      assertBinding(context.value, receipt)
      assert(JSON.stringify(context.value) === JSON.stringify(phaseContext(receipt, phase, entry, context.value.dispatchedAt)), 'Phase context identity mismatch')
      assertTimes(context.value.dispatchedAt, context.value.dispatchedAt, now, finish)
      assert(Date.parse(context.value.dispatchedAt) <= Date.parse(report.startedAt), 'Phase context published after dispatch')

      assertBinding({ ...report, accountRef: receipt.accountRef, runnerFingerprint: report.runner?.fingerprint }, receipt)
      assert(report.schemaVersion === 1 && report.status === 'passed' && report.exitCode === 0 && report.layer === 'physical-ios' && report.mode === (phase.visibility === 'private' ? 'diagnostic' : 'rehearsal'), 'Incomplete phase execution')
      assert(report.attachmentPolicy?.system === 'keepNever' && report.attachmentPolicy?.user === 'keepNever', 'Authentication phases must disable all attachments')
      assert(report.scenario?.id === phase.scenario.id && report.scenario?.sha256 === phase.sha256 && report.runner?.sourceSha256 === runnerSourceHash(), 'Phase scenario/runner changed')
      assertExecutionReceipt(report.execution, phase.scenario.steps)
      finish = assertTimes(report.startedAt, report.finishedAt, now, finish)
      assert(entry.startedAt === report.startedAt && entry.finishedAt === report.finishedAt && finish <= Date.parse(receipt.finishedAt), 'Phase time binding mismatch')
      if (phase.visibility === 'private') {
        assertObserved(entry.installedBefore, receipt.candidate); assertObserved(entry.installedAfter, receipt.candidate)
        assertTimes(entry.observedBeforeAt, entry.observedBeforeAt, now, index ? Date.parse(receipt.phases[index - 1].finishedAt) : Date.parse(receipt.startedAt))
        assertTimes(entry.observedAfterAt, entry.observedAfterAt, now, finish)
        assert(Date.parse(entry.observedBeforeAt) <= Date.parse(report.startedAt) && Date.parse(entry.observedAfterAt) <= Date.parse(receipt.finishedAt), 'Private observation boundary mismatch')
        finish = Date.parse(entry.observedAfterAt)
      } else assertObserved(report.observedCandidate, receipt.candidate)
      if (phase.id === 'post-register') {
        assertAttestation(entry.activation, 'activation', receipt, loaded.sha256, now, Date.parse(receipt.phases[index - 1].finishedAt))
        assert(Date.parse(entry.activation.finishedAt) <= Date.parse(report.startedAt), 'Activation must precede signed-in assertions')
      } else assert(!entry.activation, 'Unexpected activation prerequisite')
      if (phase.id === 'relogin-input') assertNativeRejection(entry.rejection, receipt, entry, receipt.phases.find((item) => item.id === 'delete'), now, phase, report)
      else assert(!entry.rejection, 'Unexpected native rejection prerequisite')
      assert(finish <= runFinish, 'Phase exceeds flow finish')
      predecessor = entryHash(entry)
    }
    assert(receipt.finalSha256 === predecessor, 'Final phase chain mismatch')
    return []
  } catch (error) {
    // Never echo JSON, paths, driver output or secret values from parser exceptions.
    const safe = new Set(['Missing, reordered or duplicate phases', 'Reused phase scenario', 'Partial phase cannot declare complete coverage', 'Capture and literal input forbidden in review flow', 'No successful whole flow', 'Flow candidate/environment/account/runner mismatch', 'Flow/orchestrator/runner changed', 'Missing phase receipts', 'Phase order/scenario/predecessor mismatch', 'Reused phase report', 'Phase report changed', 'Incomplete phase execution', 'Phase scenario/runner changed', 'Stale, overlapping or invalid flow timestamps', 'Installed candidate mismatch', 'Missing matching independent prerequisite', 'Final phase chain mismatch'])
    return [safe.has(error.message) ? error.message : 'Invalid or incomplete native review flow evidence']
  }
}

async function main(args = process.argv.slice(2), env = process.env) {
  assert(args.length === 1, 'Usage: native-review-flow.js <frozen-flow.json>')
  const loaded = loadFlow(path.resolve(args[0]))
  const identity = {
    candidate: Object.fromEntries(CANDIDATE_KEYS.map((key) => [key, env[`IOS_QA_CANDIDATE_${key.toUpperCase()}`]])),
    environment: { apiUrl: env.IOS_QA_API_URL, locale: env.IOS_QA_LOCALE, accountRole: env.IOS_QA_ACCOUNT_ROLE, deviceModel: env.IOS_QA_DEVICE_MODEL },
    accountRef: env.IOS_QA_ACCOUNT_REF, runnerFingerprint: env.IOS_QA_RUNNER_FINGERPRINT,
  }
  assertIdentity(identity)
  if (loaded.flow.scene === 'account-delete') assert(identity.environment.locale === 'en', 'Exact EN rejection locale required')
  assert(/^[A-Fa-f0-9-]{8,64}$/.test(env.IOS_QA_DEVICE || ''), 'Explicit device required')
  const canary = read(env.IOS_QA_CANARY_RECEIPT).value
  assertAttestation(canary, 'dummy-canary', identity, loaded.sha256, Date.now())
  const budget = Number(env.IOS_QA_FLOW_BUDGET_SEC || 600)
  assert(Number.isInteger(budget) && budget >= 10 && budget <= 600, 'Invalid flow budget')
  if (loaded.flow.scene === 'register') assert(typeof env.IOS_QA_ACTIVATION_RECEIPT === 'string' && env.IOS_QA_ACTIVATION_RECEIPT.length > 0, 'Explicit activation receipt path required')
  if (loaded.flow.scene === 'account-delete') assert(typeof env.IOS_QA_RELOGIN_RECEIPT === 'string' && env.IOS_QA_RELOGIN_RECEIPT.length > 0, 'Explicit native rejection receipt path required')
  const out = path.resolve(env.IOS_QA_FLOW_OUT || path.join(ROOT, '.codex-temp/native-review-flow'))
  let ancestor = out
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor)
  const canonicalOut = path.join(fs.realpathSync(ancestor), path.relative(ancestor, out))
  assert(['.codex-temp', 'test-results'].some((base) => canonicalOut.startsWith(path.join(ROOT, base) + path.sep)), 'Ignored output directory required')
  const quality = acquireQualityGateLock({ name: 'native-review-flow' })
  try {
    fs.mkdirSync(canonicalOut, { recursive: true, mode: 0o700 })
    const directory = fs.mkdtempSync(path.join(canonicalOut, `${loaded.flow.id}-`))
    const receiptFile = path.join(directory, 'flow-receipt.json')
    const receipt = { schemaVersion: 1, mode: 'rehearsal-flow', status: 'failed', ...identity, runRef: randomUUID(), accountKind: loaded.flow.accountKind, flow: { id: loaded.flow.id, sha256: loaded.sha256 }, orchestratorSha256: sourceHash(), runnerSourceSha256: runnerSourceHash(), canary, startedAt: new Date().toISOString(), finishedAt: null, phases: [], finalSha256: null }
    // The runner owns its phase device lock and bounded subprocess cleanup.
    // Do not wrap it in another killed process group: xcodebuild has its own.
    const deadline = Date.now() + budget * 1000
    const command = (program, argv, options = {}) => deviceRunner.runCommand(program, argv, { deadline, env: { ...env, MT_QUALITY_GATE_LOCK_OWNED: '1' }, ...options })
    const observe = async (label) => {
      const target = path.join(directory, `${label}-installed.json`)
      const bundle = env.QA_BUNDLE || 'by.metravel.app'
      await command('xcrun', ['devicectl', 'device', 'info', 'apps', '--device', env.IOS_QA_DEVICE, '--bundle-id', bundle, '--json-output', target], { limit: 15000 })
      const matches = read(target).value.result?.apps?.filter((app) => app.bundleIdentifier === bundle)
      assert(matches?.length === 1, 'Installed candidate mismatch')
      const observed = { version: String(matches[0].version), build: String(matches[0].bundleVersion) }
      assertObserved(observed, identity.candidate)
      return observed
    }
    try {
      for (const phase of loaded.phases) {
        assert(hash(fs.readFileSync(loaded.file)) === loaded.sha256 && hash(fs.readFileSync(phase.fullPath)) === phase.sha256 && sourceHash() === receipt.orchestratorSha256 && runnerSourceHash() === receipt.runnerSourceSha256, 'Frozen flow changed during run')
        const entry = { id: phase.id, visibility: phase.visibility, scenarioSha256: phase.sha256, previousSha256: receipt.finalSha256 }
        if (phase.id === 'post-register') {
          entry.activation = await waitForActivation(env.IOS_QA_ACTIVATION_RECEIPT, identity, loaded.sha256, { deadline, after: Date.parse(receipt.phases.at(-1).finishedAt) })
        }
        if (phase.visibility === 'private') { entry.installedBefore = await observe(`${phase.id}-before`); entry.observedBeforeAt = new Date().toISOString() }
        // Reserve host bookkeeping time and never extend a short remaining
        // budget to the runner's 10-second minimum.
        const phaseBudget = Math.floor((deadline - Date.now()) / 1000) - 1
        assert(phaseBudget >= 10, 'Insufficient remaining phase budget')
        const phaseOut = path.join(directory, phase.id)
        fs.mkdirSync(phaseOut, { mode: 0o700 })
        entry.context = `${phase.id}-context.json`
        const contextFile = path.join(directory, entry.context)
        const contextRaw = JSON.stringify(phaseContext(receipt, phase, entry, new Date().toISOString()), null, 2)
        fs.writeFileSync(`${contextFile}.tmp`, contextRaw, { mode: 0o600, flag: 'wx' })
        fs.renameSync(`${contextFile}.tmp`, contextFile)
        entry.contextSha256 = hash(contextRaw)
        console.log(`Native phase context: ${path.relative(ROOT, contextFile)}`)

        await deviceRunner.main([...(phase.visibility === 'public' ? ['--rehearsal'] : []), `@${phase.fullPath}`, phase.id], {
          ...env, MT_QUALITY_GATE_LOCK_OWNED: '1', QA_PRIVATE_INPUT: phase.visibility === 'private' ? '1' : '0', IOS_QA_ATTACHMENTS: 'none', IOS_QA_OUT: phaseOut, IOS_QA_BUDGET_SEC: String(phaseBudget),
        })
        const children = fs.readdirSync(phaseOut)
        assert(children.length === 1, 'Expected unique phase output')
        entry.report = path.relative(directory, path.join(phaseOut, children[0], 'report.json'))
        const phaseReport = read(path.join(directory, entry.report))
        entry.reportSha256 = hash(phaseReport.raw)
        entry.startedAt = phaseReport.value.startedAt; entry.finishedAt = phaseReport.value.finishedAt
        if (phase.visibility === 'private') { entry.installedAfter = await observe(`${phase.id}-after`); entry.observedAfterAt = new Date().toISOString() }
        const report = phaseReport.value
        assertExecutionReceipt(report.execution, phase.scenario.steps)
        assert(report.status === 'passed' && report.exitCode === 0 && report.layer === 'physical-ios' && report.mode === (phase.visibility === 'private' ? 'diagnostic' : 'rehearsal'), 'Incomplete phase execution')
        assert(report.attachmentPolicy?.system === 'keepNever' && report.attachmentPolicy?.user === 'keepNever', 'Authentication phases must disable all attachments')
        assertBinding({ ...report, accountRef: identity.accountRef, runnerFingerprint: report.runner?.fingerprint }, identity)
        assert(report.scenario?.id === phase.scenario.id && report.scenario?.sha256 === phase.sha256 && report.runner?.sourceSha256 === receipt.runnerSourceSha256, 'Phase scenario/runner changed')
        assertTimes(report.startedAt, report.finishedAt, Date.now(), Date.parse(receipt.phases.at(-1)?.observedAfterAt || receipt.phases.at(-1)?.finishedAt || receipt.startedAt))
        if (phase.visibility === 'public') assertObserved(report.observedCandidate, identity.candidate)
        if (phase.id === 'relogin-input') {
          entry.rejection = await waitForAttestation(env.IOS_QA_RELOGIN_RECEIPT, 'relogin-rejection', receipt, loaded.sha256, { deadline })
          assertNativeRejection(entry.rejection, receipt, entry, receipt.phases.find((item) => item.id === 'delete'), Date.now(), phase, report)
        }
        receipt.phases.push(entry); receipt.finalSha256 = entryHash(entry)
      }
      receipt.status = 'passed'
    } finally {
      receipt.finishedAt = new Date().toISOString()
      fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2), { mode: 0o600 })
    }
    const failures = validateFlowReceipt(loaded.file, receiptFile)
    if (failures.length) {
      receipt.status = 'failed'
      fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2), { mode: 0o600 })
      throw new Error('Whole flow receipt validation failed')
    }
    console.log(`FLOW EVIDENCE CONSISTENT: ${path.relative(ROOT, receiptFile)}; independent provenance, transport, role and privacy verification still required`)
  } finally { if (!quality.reentrant) releaseQualityGateLock() }
}
module.exports = { loadFlow, validateFlowReceipt, sourceHash, normalizerSourceHash, hash, entryHash, assertAttestation, assertIdentity, waitForActivation, waitForAttestation, phaseContext, assertNativeRejection, main }
if (require.main === module) main().catch(() => { console.error('NATIVE REVIEW FLOW BLOCKED: inspect private local evidence; no coverage granted'); process.exitCode = 1 })
