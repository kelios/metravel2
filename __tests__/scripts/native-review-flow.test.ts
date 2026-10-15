const fs = require('node:fs')
const path = require('node:path')
const { loadFlow, validateFlowReceipt, sourceHash, normalizerSourceHash, hash, entryHash, waitForActivation, waitForAttestation, phaseContext, main } = require('../../scripts/native-review-flow')
const deviceRunner = require('../../tools/ios-device-uitests/run')
const { runnerSourceHash } = deviceRunner
const { validateReadiness } = require('../../scripts/native-recording-readiness')
const { makeTempDir } = require('./cli-test-utils')

// Synthetic receipts verify validation only. They never qualify a real device.
describe('whole native authentication flow consistency', () => {
  let directory: string, flow: any, receipt: any, reports: any[], scenarios: any[], now: number
  const manifestFile = () => path.join(directory, 'flow.json')
  const receiptFile = () => path.join(directory, 'receipt.json')
  const saveManifest = () => fs.writeFileSync(manifestFile(), JSON.stringify(flow))
  const save = () => {
    saveManifest()
    receipt.flow.sha256 = hash(fs.readFileSync(manifestFile()))
    receipt.canary.flowSha256 = receipt.flow.sha256
    let previous: any = null
    for (const [index, phase] of flow.phases.entries()) {
      fs.writeFileSync(path.join(directory, phase.path), JSON.stringify(scenarios[index]))
      reports[index].scenario.sha256 = hash(JSON.stringify(scenarios[index]))
      reports[index].execution.scriptSha256 = hash(JSON.stringify(scenarios[index].steps))
      reports[index].execution.completedSteps = scenarios[index].steps.length
      reports[index].execution.completedAssertions = scenarios[index].steps.filter((step: any) => ['assert', 'waitUntil'].includes(step.op)).length
      fs.writeFileSync(path.join(directory, `${index}-report.json`), JSON.stringify(reports[index]))
      Object.assign(receipt.phases[index], { previousSha256: previous, reportSha256: hash(JSON.stringify(reports[index])), scenarioSha256: reports[index].scenario.sha256 })
      const entry = receipt.phases[index]
      entry.context = `${index}-context.json`
      const context = phaseContext(receipt, { ...phase, sha256: reports[index].scenario.sha256 }, entry, new Date(Date.parse(reports[index].startedAt) - 1).toISOString())
      fs.writeFileSync(path.join(directory, entry.context), JSON.stringify(context))
      entry.contextSha256 = hash(JSON.stringify(context))
      if (entry.activation) entry.activation.flowSha256 = receipt.flow.sha256
      if (entry.rejection) { entry.rejection.flowSha256 = receipt.flow.sha256; entry.rejection.contextSha256 = entry.contextSha256 }

      previous = entryHash(receipt.phases[index])
    }
    receipt.finalSha256 = previous
    fs.writeFileSync(receiptFile(), JSON.stringify(receipt))
  }
  const configureScene = (scene: string) => {
    const names = scene === 'register' ? ['pre-register', 'registration-input', 'post-register', 'activation-login-input', 'registered'] : ['pre-delete', 'delete', 'relogin-input', 'failed-relogin']
    const templates = scene === 'register' ? [0, 1, 0, 1, 2] : [0, 0, 1, 2]
    const clone = (value: any) => JSON.parse(JSON.stringify(value))
    const original = { phases: flow.phases, scenarios, reports, entries: receipt.phases }
    flow.scene = scene; flow.completeReviewScenes = [scene]; flow.accountKind = receipt.accountKind = 'disposable'
    flow.phases = []; scenarios = []; reports = []; receipt.phases = []
    names.forEach((id, index) => {
      const template = templates[index], isPrivate = template === 1
      const phase = { ...clone(original.phases[template]), id, path: `${index}.json` }
      const scenario = clone(original.scenarios[template]); scenario.id = `${flow.id}-${id}`
      const report = clone(original.reports[template]); report.scenario.id = scenario.id
      report.startedAt = new Date(now - 100000 + index * 10000).toISOString(); report.finishedAt = new Date(now - 95000 + index * 10000).toISOString()
      const entry = { id, visibility: phase.visibility, report: `${index}-report.json`, startedAt: report.startedAt, finishedAt: report.finishedAt,
        ...(isPrivate ? { installedBefore: { version: '1.0.5', build: '13' }, installedAfter: { version: '1.0.5', build: '13' }, observedBeforeAt: new Date(Date.parse(report.startedAt) - 1000).toISOString(), observedAfterAt: new Date(Date.parse(report.finishedAt) + 1000).toISOString() } : {}),
      }
      if (id === 'delete') scenario.steps.splice(-1, 0, { op: 'assert', text: 'Invalid email or password', state: 'absent' })
      if (id === 'relogin-input') {
        scenario.steps.splice(2, 0, { op: 'tapText', text: 'Invalid email or password', timeout: 30 })
        phase.credentialExit.rejectionStep = 2; phase.credentialExit.leaveStep = 3
      }
      flow.phases.push(phase); scenarios.push(scenario); reports.push(report); receipt.phases.push(entry)
    })
    receipt.finishedAt = new Date(now - 40000).toISOString()
    save()
  }
  const addNativeRejection = (basis = 'native-response-body') => {
    const entry = receipt.phases[2], deletion = receipt.phases[1]
    const base = receipt.environment.apiUrl.replace(/\/+$/, '')
    const api = base.endsWith('/api') ? base : `${base}/api`
    entry.rejection = { ...receipt.canary, kind: 'relogin-rejection', accountKind: 'disposable', runRef: receipt.runRef, phaseId: entry.id, contextSha256: entry.contextSha256,
      startedAt: receipt.startedAt, finishedAt: receipt.finishedAt,
      nativeCorrelation: { origin: 'native-device-network', evidenceSha256: 'd'.repeat(64),
        priorValid: { accountRef: receipt.accountRef, requestRef: '33333333-3333-4333-8333-333333333333', observedAt: new Date(Date.parse(deletion.startedAt) - 1000).toISOString(), method: 'POST', endpoint: `${api}/user/login/`, status: 200 },
        deletion: { accountRef: receipt.accountRef, requestRef: '44444444-4444-4444-8444-444444444444', observedAt: new Date(Date.parse(deletion.startedAt) + 1000).toISOString(), method: 'DELETE', endpoint: `${api}/user/delete-account/`, status: 204 },
        rejection: { accountRef: receipt.accountRef, requestRef: '55555555-5555-4555-8555-555555555555', observedAt: new Date(Date.parse(entry.startedAt) + 1000).toISOString(), method: 'POST', endpoint: `${api}/user/login/`, status: 401, code: 'invalid_credentials', classificationBasis: basis, rawResponseBodyObserved: basis === 'native-response-body' },
      },
    }
    save()
    if (basis === 'native-ui-source-classification') {
      entry.rejection.nativeCorrelation.rejection.uiSource = { candidateSource: receipt.candidate.source, normalizerSha256: normalizerSourceHash(), scenarioSha256: entry.scenarioSha256, reportSha256: entry.reportSha256, executionSha256: hash(JSON.stringify(reports[2].execution)), rejectionStep: flow.phases[2].credentialExit.rejectionStep, text: 'Invalid email or password' }
      save()
    }
  }
  const writeReceipt = () => fs.writeFileSync(receiptFile(), JSON.stringify(receipt))
  const check = () => validateFlowReceipt(manifestFile(), receiptFile(), { now })
  beforeEach(() => {
    directory = makeTempDir('flow-', { root: path.resolve('.codex-temp/native-review-flow-tests') })
    now = Date.parse('2026-10-15T12:00:00Z')
    flow = { schemaVersion: 1, id: 'review-login', status: 'frozen', reviewed: true, scene: 'login', accountKind: 'reviewer-demo', completeReviewScenes: ['login'], phases: [
      { id: 'pre-login', visibility: 'public', path: '0.json' },
      { id: 'credentials', visibility: 'private', path: '1.json', credentialExit: { submitStep: 1, leaveStep: 2, formId: 'credential-form' } },
      { id: 'post-login', visibility: 'public', path: '2.json' },
    ] }
    const identity = {
      candidate: { version: '1.0.5', build: '13', source: 'a'.repeat(40), origin: 'testflight' },
      environment: { apiUrl: 'https://example.invalid', locale: 'en', accountRole: 'reviewer', deviceModel: 'Synthetic iPhone' },
      accountRef: '11111111-1111-4111-8111-111111111111', runnerFingerprint: 'b'.repeat(64),
    }
    scenarios = flow.phases.map((phase: any) => ({ id: `${flow.id}-${phase.id}`, layer: 'physical-ios', steps: phase.visibility === 'public'
      ? [{ op: 'assert', id: 'credential-form', state: 'absent' }, { op: 'assert', id: 'expected-state', state: 'hittable' }]
      : [{ op: 'secretClipboard', key: 'opaque' }, { op: 'tapId', id: 'submit' }, { op: 'tapId', id: 'leave-credentials' }, { op: 'clearSecretClipboard' }] }))
    scenarios[0].steps.push({ op: 'assert', id: 'credential-form', state: 'hittable' })
    reports = scenarios.map((scenario: any, index: number) => ({
      schemaVersion: 1, status: 'passed', exitCode: 0, layer: 'physical-ios', mode: index === 1 ? 'diagnostic' : 'rehearsal',
      attachmentPolicy: { system: 'keepNever', user: 'keepNever' },
      candidate: { ...identity.candidate }, environment: { ...identity.environment },
      scenario: { id: scenario.id, sha256: '' }, runner: { sourceSha256: runnerSourceHash(), fingerprint: identity.runnerFingerprint },
      ...(index === 1 ? {} : { observedCandidate: { version: '1.0.5', build: '13' } }),
      execution: { totalTestCount: 1, passedTests: 1, failedTests: 0, skippedTests: 0, expectedFailures: 0, identity: 'MetravelDeviceUITests/RunScriptTests/testRunScript()', scriptSha256: '', completedSteps: 0, completedAssertions: 0 },
      startedAt: new Date(now - 100000 + index * 10000).toISOString(), finishedAt: new Date(now - 95000 + index * 10000).toISOString(),
    }))
    receipt = {
      schemaVersion: 1, mode: 'rehearsal-flow', status: 'passed', ...identity, accountKind: 'reviewer-demo', runRef: '22222222-2222-4222-8222-222222222222',
      flow: { id: flow.id, sha256: '' }, orchestratorSha256: sourceHash(), runnerSourceSha256: runnerSourceHash(),
      canary: { schemaVersion: 1, kind: 'dummy-canary', status: 'passed', independentlyReviewed: true, ...identity, flowSha256: '', runnerSourceSha256: runnerSourceHash(), orchestratorSha256: sourceHash(), dummyOnly: true, noSecretArtifacts: true, privacyEvidenceSha256: 'c'.repeat(64), startedAt: new Date(now - 140000).toISOString(), finishedAt: new Date(now - 130000).toISOString() },
      startedAt: new Date(now - 110000).toISOString(), finishedAt: new Date(now - 60000).toISOString(),
      phases: reports.map((report: any, index: number) => ({ id: flow.phases[index].id, visibility: flow.phases[index].visibility, report: `${index}-report.json`, startedAt: report.startedAt, finishedAt: report.finishedAt,
        ...(index === 1 ? { installedBefore: { version: '1.0.5', build: '13' }, installedAfter: { version: '1.0.5', build: '13' }, observedBeforeAt: new Date(now - 91000).toISOString(), observedAfterAt: new Date(now - 84000).toISOString() } : {}),
      })),
    }
    save()
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    fs.rmSync(directory, { recursive: true, force: true })
  })
  const mainEnvironment = () => {
    const canary = path.join(directory, 'canary.json')
    fs.writeFileSync(canary, JSON.stringify(receipt.canary))
    return {
      ...Object.fromEntries(Object.entries(receipt.candidate).map(([key, value]) => [`IOS_QA_CANDIDATE_${key.toUpperCase()}`, value])),
      IOS_QA_API_URL: receipt.environment.apiUrl, IOS_QA_LOCALE: receipt.environment.locale,
      IOS_QA_ACCOUNT_ROLE: receipt.environment.accountRole, IOS_QA_DEVICE_MODEL: receipt.environment.deviceModel,
      IOS_QA_ACCOUNT_REF: receipt.accountRef, IOS_QA_RUNNER_FINGERPRINT: receipt.runnerFingerprint,
      IOS_QA_DEVICE: '00000000-0000-4000-8000-000000000000', IOS_QA_CANARY_RECEIPT: canary,
      IOS_QA_FLOW_OUT: path.join(directory, 'output'),
    }
  }
  it('reuses the runner in-process so its phase owns device cleanup and the host keeps its quality lock', async () => {
    jest.useFakeTimers().setSystemTime(now)
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const env = mainEnvironment()
    const originalPrivateMode = process.env.QA_PRIVATE_INPUT
    const originalQualityOwner = process.env.MT_QUALITY_GATE_LOCK_OWNED
    const command = jest.spyOn(deviceRunner, 'runCommand').mockImplementation(async (program: string, args: string[]) => {
      expect(program).toBe('xcrun')
      expect(args.slice(0, 4)).toEqual(['devicectl', 'device', 'info', 'apps'])
      fs.writeFileSync(args.at(-1), JSON.stringify({ result: { apps: [{ bundleIdentifier: 'by.metravel.app', version: '1.0.5', bundleVersion: '13' }] } }))
      jest.advanceTimersByTime(1)
      return ''
    })
    const dispatch = jest.spyOn(deviceRunner, 'main').mockImplementation(async (args: string[], phaseEnv: Record<string, string>) => {
      const index = flow.phases.findIndex((phase: any) => phase.id === args.at(-1))
      const contextFile = path.join(path.dirname(phaseEnv.IOS_QA_OUT), `${flow.phases[index].id}-context.json`)
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf8'))
      expect(context.runRef).toMatch(/^[a-f0-9-]{36}$/)
      expect(context.phase.id).toBe(flow.phases[index].id)
      expect(Date.parse(context.dispatchedAt)).toBeLessThanOrEqual(Date.now())
      expect(fs.statSync(contextFile).mode & 0o777).toBe(0o600)
      expect(fs.existsSync(`${contextFile}.tmp`)).toBe(false)

      expect(phaseEnv.QA_PRIVATE_INPUT).toBe(index === 1 ? '1' : '0')
      expect(phaseEnv.IOS_QA_ATTACHMENTS).toBe('none')
      expect(args.includes('--rehearsal')).toBe(index !== 1)
      expect(phaseEnv.MT_QUALITY_GATE_LOCK_OWNED).toBe('1')
      expect(Number(phaseEnv.IOS_QA_BUDGET_SEC)).toBeGreaterThanOrEqual(10)
      const report = { ...reports[index], startedAt: new Date().toISOString() }
      jest.advanceTimersByTime(1000)
      report.finishedAt = new Date().toISOString()
      const out = path.join(phaseEnv.IOS_QA_OUT, 'phase-run')
      fs.mkdirSync(out)
      fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report))
    })
    await main([manifestFile()], env)
    expect(dispatch).toHaveBeenCalledTimes(3)
    expect(command).toHaveBeenCalledTimes(2)
    expect(process.env.QA_PRIVATE_INPUT).toBe(originalPrivateMode)
    expect(process.env.MT_QUALITY_GATE_LOCK_OWNED).toBe(originalQualityOwner)
    const output = path.join(env.IOS_QA_FLOW_OUT, fs.readdirSync(env.IOS_QA_FLOW_OUT)[0], 'flow-receipt.json')
    expect(validateFlowReceipt(manifestFile(), output, { now: Date.now() })).toEqual([])
  })
  it('does not extend a below-minimum remaining budget to dispatch a phase', async () => {
    jest.useFakeTimers().setSystemTime(now)
    const env = { ...mainEnvironment(), IOS_QA_FLOW_BUDGET_SEC: '10' }
    const dispatch = jest.spyOn(deviceRunner, 'main')
    await expect(main([manifestFile()], env)).rejects.toThrow('Insufficient remaining phase budget')
    expect(dispatch).not.toHaveBeenCalled()
    const output = path.join(env.IOS_QA_FLOW_OUT, fs.readdirSync(env.IOS_QA_FLOW_OUT)[0], 'flow-receipt.json')
    expect(JSON.parse(fs.readFileSync(output, 'utf8')).status).toBe('failed')
  })
  it.each(['budget', 'activation'])('validates the %s prerequisite before creating output or dispatching', async (kind: string) => {
    jest.useFakeTimers().setSystemTime(now)
    if (kind === 'activation') {
      configureScene('register')
    }
    const env = { ...mainEnvironment(), ...(kind === 'budget' ? { IOS_QA_FLOW_BUDGET_SEC: '0' } : {}) }
    const dispatch = jest.spyOn(deviceRunner, 'main')
    await expect(main([manifestFile()], env)).rejects.toThrow(kind === 'budget' ? 'Invalid flow budget' : 'Explicit activation receipt path required')
    expect(dispatch).not.toHaveBeenCalled()
    expect(fs.existsSync(env.IOS_QA_FLOW_OUT)).toBe(false)
  })
  it('accepts a consistent full flow with zero private assertions and no fabricated private installed report', () => {
    expect(reports[1].observedCandidate).toBeUndefined()
    expect(reports[1].execution.completedAssertions).toBe(0)
    expect(check()).toEqual([])
  })
  it('accepts explicit readiness mapping for the full frozen flow', () => {
    const plan = { schemaVersion: 1, purpose: 'app-review', ...receipt, scenes: [{ id: 'login', flow: 'flow.json', report: 'receipt.json', accountRef: receipt.accountRef }] }
    plan.schemaVersion = 1
    expect(validateReadiness(plan, { directory, now })).toEqual([])
    plan.scenes[0].accountRef = '33333333-3333-4333-8333-333333333333'
    expect(validateReadiness(plan, { directory, now }).length).toBeGreaterThan(0)
  })
  it.each([0, 1, 2])('rejects attachment retention in phase %s even with matching report and chain hashes', (index: number) => {
    for (const policy of [undefined, { system: 'deleteOnSuccess', user: 'keepNever' }, { system: 'keepNever', user: 'keepAlways' }]) {
      reports[index].attachmentPolicy = policy
      save()
      expect(check().length).toBeGreaterThan(0)
    }
  })
  it.each(['omit', 'reorder', 'reuse', 'predecessor', 'runner', 'source', 'identity', 'canary', 'stale', 'overlap'])('rejects %s receipt', (kind: string) => {
    if (kind === 'omit') receipt.phases.pop()
    if (kind === 'reorder') receipt.phases.reverse()
    if (kind === 'reuse') receipt.phases[2].report = receipt.phases[0].report
    if (kind === 'predecessor') receipt.phases[1].previousSha256 = 'f'.repeat(64)
    if (kind === 'runner') receipt.runnerSourceSha256 = 'f'.repeat(64)
    if (kind === 'source') receipt.orchestratorSha256 = 'f'.repeat(64)
    if (kind === 'identity') receipt.candidate.build = '12'
    if (kind === 'canary') delete receipt.canary
    if (kind === 'stale') now += 86400001
    if (kind === 'overlap') { reports[2].startedAt = reports[1].startedAt; receipt.phases[2].startedAt = reports[1].startedAt; save() }
    writeReceipt()
    expect(check().length).toBeGreaterThan(0)
  })
  it.each(['scenario', 'report', 'manifest'])('rejects changed %s bytes', (kind: string) => {
    fs.appendFileSync(path.join(directory, kind === 'scenario' ? '1.json' : kind === 'report' ? '1-report.json' : 'flow.json'), '\n')
    expect(check().length).toBeGreaterThan(0)
  })
  it.each(['skipped', 'missing', 'incomplete', 'wrong-test', 'candidate', 'environment', 'private-identity', 'private-mode'])('rejects %s phase evidence', (kind: string) => {
    if (kind === 'skipped') reports[1].execution.skippedTests = 1
    if (kind === 'incomplete') reports[1].execution.passedTests = 0
    if (kind === 'wrong-test') reports[1].execution.identity = 'Other/test()'
    if (kind === 'candidate') reports[1].candidate.build = '12'
    if (kind === 'environment') reports[1].environment.locale = 'ru'
    if (kind === 'private-identity') receipt.phases[1].installedAfter.build = '12'
    if (kind === 'private-mode') reports[1].mode = 'rehearsal'
    save()
    if (kind === 'missing') { delete reports[1].execution; fs.writeFileSync(path.join(directory, '1-report.json'), JSON.stringify(reports[1])); receipt.phases[1].reportSha256 = hash(JSON.stringify(reports[1])); writeReceipt() }
    expect(check().length).toBeGreaterThan(0)
  })
  it.each(['shot', 'tree', 'assert', 'waitUntil', 'wait', 'type', 'empty', 'public-secret', 'coverage', 'exit'])('rejects unsafe or partial %s scenario', (kind: string) => {
    if (kind === 'empty') scenarios[1].steps = []
    else if (kind === 'public-secret') scenarios[0].steps.push({ op: 'secretClipboard', key: 'opaque' })
    else if (kind === 'coverage') scenarios[2].completeReviewScenes = ['login']
    else if (kind === 'exit') delete flow.phases[1].credentialExit
    else scenarios[1].steps.unshift(kind === 'assert' || kind === 'waitUntil' ? { op: kind, id: 'secret-form', state: 'exists' } : kind === 'type' ? { op: kind, text: 'dummy' } : kind === 'wait' ? { op: kind, sec: 1 } : { op: kind })
    save()
    expect(check().length).toBeGreaterThan(0)
  })
  it.each(['scriptSha256', 'completedSteps', 'completedAssertions'])('rejects wrong completed dispatch %s even after report and chain hashes are recomputed', (key: string) => {
    reports[1].execution[key] = key === 'scriptSha256' ? 'f'.repeat(64) : -1
    fs.writeFileSync(path.join(directory, '1-report.json'), JSON.stringify(reports[1]))
    receipt.phases[1].reportSha256 = hash(JSON.stringify(reports[1]))
    let previous = null
    for (const entry of receipt.phases) { entry.previousSha256 = previous; previous = entryHash(entry) }
    receipt.finalSha256 = previous
    writeReceipt()
    expect(check().length).toBeGreaterThan(0)
  })
  it.each(['privacy', 'canary-runner', 'account-email', 'before-observation', 'after-observation', 'future'])('rejects %s safety boundaries', (kind: string) => {
    if (kind === 'privacy') receipt.canary.noSecretArtifacts = false
    if (kind === 'canary-runner') receipt.canary.runnerSourceSha256 = 'f'.repeat(64)
    if (kind === 'account-email') receipt.accountRef = 'someone@example.invalid'
    if (kind === 'before-observation') receipt.phases[1].observedBeforeAt = receipt.phases[1].finishedAt
    if (kind === 'after-observation') receipt.phases[1].observedAfterAt = receipt.phases[1].startedAt
    if (kind === 'future') now -= 200000
    save()
    expect(check().length).toBeGreaterThan(0)
  })
  it.each(['before', 'after'])('requires the exact credential form %s private input', (boundary: string) => {
    const step = boundary === 'before' ? scenarios[0].steps.at(-1) : scenarios[2].steps[0]
    step.id = 'unrelated-state'
    save()
    expect(check().length).toBeGreaterThan(0)
  })
  it('rejects draft, unreviewed, skipped/reordered manifest phases and isolated post-login', () => {
    for (const change of [() => { flow.status = 'draft' }, () => { flow.reviewed = false }, () => { flow.phases = [flow.phases[2]] }]) {
      change(); saveManifest()
      expect(() => loadFlow(manifestFile())).toThrow()
    }
  })
  it('waits only for the explicit activation receipt and keeps the existing total deadline', async () => {
    const file = path.join(directory, 'activation.json')
    let clock = now
    const activation = { ...receipt.canary, kind: 'activation', accountKind: 'disposable', activated: true, startedAt: new Date(now - 2000).toISOString(), finishedAt: new Date(now - 1000).toISOString() }
    const pause = jest.fn(async (ms: number) => {
      clock += ms
      fs.writeFileSync(file, JSON.stringify(activation))
    })
    const result = await waitForActivation(file, receipt, receipt.flow.sha256, { deadline: now + 1000, after: now - 3000, now: () => clock, pause })
    expect(result).toEqual(activation)
    expect(pause).toHaveBeenCalledTimes(1)
    expect(pause).toHaveBeenCalledWith(250)
  })
  it('times out missing activation within the existing remaining budget', async () => {
    let clock = now
    const pause = jest.fn(async (ms: number) => { clock += ms })
    await expect(waitForActivation(path.join(directory, 'missing-activation.json'), receipt, receipt.flow.sha256, { deadline: now + 100, after: now - 3000, now: () => clock, pause })).rejects.toThrow('Activation prerequisite deadline exceeded')
    expect(pause).toHaveBeenCalledTimes(1)
    expect(pause).toHaveBeenCalledWith(100)
  })
  it.each(['stale', 'wrong-fixture', 'before-registration', 'malformed'])('refuses %s external activation without continuing or waiting', async (kind: string) => {
    const file = path.join(directory, 'activation.json')
    const activation = { ...receipt.canary, kind: 'activation', accountKind: 'disposable', activated: true, startedAt: new Date(now - 2000).toISOString(), finishedAt: new Date(now - 1000).toISOString() }
    if (kind === 'stale') activation.startedAt = new Date(now - 86400001).toISOString()
    if (kind === 'wrong-fixture') activation.accountRef = '33333333-3333-4333-8333-333333333333'
    const pause = jest.fn()
    fs.writeFileSync(file, kind === 'malformed' ? '{' : JSON.stringify(activation))
    await expect(waitForActivation(file, receipt, receipt.flow.sha256, { deadline: now + 1000, after: now - (kind === 'before-registration' ? 500 : 3000), now: () => now, pause })).rejects.toThrow()
    expect(pause).not.toHaveBeenCalled()
  })
  it.each(['missing', 'bytes', 'late', 'reused', 'account', 'run'])('rejects %s phase context', (kind: string) => {
    const file = path.join(directory, receipt.phases[1].context)
    if (kind === 'missing') fs.unlinkSync(file)
    if (kind === 'bytes') fs.appendFileSync(file, '\n')
    if (kind === 'reused') receipt.phases[1].context = receipt.phases[0].context
    if (['late', 'account', 'run'].includes(kind)) {
      const context = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (kind === 'late') context.dispatchedAt = receipt.phases[1].finishedAt
      if (kind === 'account') context.accountRef = '33333333-3333-4333-8333-333333333333'
      if (kind === 'run') context.runRef = '33333333-3333-4333-8333-333333333333'
      fs.writeFileSync(file, JSON.stringify(context)); receipt.phases[1].contextSha256 = hash(JSON.stringify(context))
    }
    writeReceipt()
    expect(check().length).toBeGreaterThan(0)
  })
  it('requires real correlated native rejection before the final guest phase', () => {
    configureScene('account-delete')
    expect(check().length).toBeGreaterThan(0)
    addNativeRejection()
    expect(check()).toEqual([])
  })
  it('accepts explicitly derived native UI classification without claiming an observed response body', () => {
    configureScene('account-delete'); addNativeRejection('native-ui-source-classification')
    expect(receipt.phases[2].rejection.nativeCorrelation.rejection.rawResponseBodyObserved).toBe(false)
    expect(check()).toEqual([])
  })
  it.each(['missing-basis', 'wrong-basis', 'claims-body', 'missing-ui', 'source', 'candidate', 'scenario', 'report', 'execution', 'step', 'text', 'status'])('rejects %s derived classification even with recomputed chain hashes', (kind: string) => {
    configureScene('account-delete'); addNativeRejection('native-ui-source-classification')
    const event = receipt.phases[2].rejection.nativeCorrelation.rejection
    if (kind === 'missing-basis') delete event.classificationBasis
    if (kind === 'wrong-basis') event.classificationBasis = 'host-response-body'
    if (kind === 'claims-body') event.rawResponseBodyObserved = true
    if (kind === 'missing-ui') delete event.uiSource
    if (kind === 'source') event.uiSource.normalizerSha256 = 'f'.repeat(64)
    if (kind === 'candidate') event.uiSource.candidateSource = 'f'.repeat(40)
    if (kind === 'scenario') event.uiSource.scenarioSha256 = 'f'.repeat(64)
    if (kind === 'report') event.uiSource.reportSha256 = 'f'.repeat(64)
    if (kind === 'execution') event.uiSource.executionSha256 = 'f'.repeat(64)
    if (kind === 'step') event.uiSource.rejectionStep = 0
    if (kind === 'text') event.uiSource.text += '.'
    if (kind === 'status') event.status = 403
    let previous = null
    for (const entry of receipt.phases) { entry.previousSha256 = previous; previous = entryHash(entry) }
    receipt.finalSha256 = previous; writeReceipt()
    expect(check().length).toBeGreaterThan(0)
  })
  it('does not label an unobserved body as direct native-response evidence', () => {
    configureScene('account-delete'); addNativeRejection()
    receipt.phases[2].rejection.nativeCorrelation.rejection.rawResponseBodyObserved = false
    save()
    expect(check().length).toBeGreaterThan(0)
  })
  it('keeps composed deletion consent accepted and replaces complete retained credentials before re-login', () => {
    const root = path.resolve(__dirname, '../../tools/ios-device-uitests/scenarios/app-review')
    const remove = JSON.parse(fs.readFileSync(path.join(root, 'phases/account-delete-delete.json'), 'utf8'))
    expect(remove.steps).toContainEqual({ op: 'assert', id: 'auth-terms-gate-hint', state: 'absent' })
    expect(remove.steps.some((step: any) => step.id === 'auth-terms-gate-checkbox')).toBe(false)
    const input = JSON.parse(fs.readFileSync(path.join(root, 'phases/account-delete-relogin-input.json'), 'utf8'))
    for (const placeholder of ['Email', 'Password']) {
      const index = input.steps.findIndex((step: any) => step.op === 'longPressPlaceholder' && step.placeholder === placeholder)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(input.steps.slice(index + 1, index + 3)).toEqual([{ op: 'tapText', text: 'Select All', timeout: 10 }, { op: 'tapText', text: 'Paste', timeout: 10 }])
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'flows/account-delete.json'), 'utf8'))
    const exit = manifest.phases.find((phase: any) => phase.id === 'relogin-input').credentialExit
    expect(input.steps[exit.submitStep].text).toBe('Login')
    expect(input.steps[exit.rejectionStep].text).toBe('Invalid email or password')
    expect(input.steps[exit.leaveStep].text).toBe('Back')
    expect(input.steps.at(-1).op).toBe('clearSecretClipboard')
  })
  it.each(['https://example.invalid', 'https://example.invalid/', 'https://example.invalid/api', 'https://example.invalid/api/'])('matches real /api endpoints for declared API %s', (apiUrl: string) => {
    configureScene('account-delete')
    receipt.environment.apiUrl = receipt.canary.environment.apiUrl = apiUrl
    for (const report of reports) report.environment.apiUrl = apiUrl
    addNativeRejection()
    expect(receipt.phases[2].rejection.nativeCorrelation.rejection.endpoint).toBe('https://example.invalid/api/user/login/')
    expect(check()).toEqual([])
  })
  it.each(['host', 'wrong-code', 'wrong-status', 'wrong-api', 'missing-api-prefix', 'duplicate-api-prefix', 'wrong-run', 'wrong-account', 'wrong-event-account', 'wrong-locale', 'context', 'reused-request', 'before-deletion', 'outside-private', 'outside-deletion', 'unreviewed'])('rejects %s native attestation', (kind: string) => {
    configureScene('account-delete'); addNativeRejection()
    const proof = receipt.phases[2].rejection, events = proof.nativeCorrelation
    if (kind === 'host') events.origin = 'host-probe'
    if (kind === 'wrong-code') events.rejection.code = 'account_not_activated'
    if (kind === 'wrong-status') events.rejection.status = 403
    if (kind === 'wrong-api') events.rejection.endpoint = 'https://other.invalid/user/login/'
    if (kind === 'missing-api-prefix') events.rejection.endpoint = 'https://example.invalid/user/login/'
    if (kind === 'duplicate-api-prefix') events.rejection.endpoint = 'https://example.invalid/api/api/user/login/'
    if (kind === 'wrong-run') proof.runRef = '33333333-3333-4333-8333-333333333333'
    if (kind === 'wrong-account') proof.accountRef = '33333333-3333-4333-8333-333333333333'
    if (kind === 'wrong-event-account') events.priorValid.accountRef = '33333333-3333-4333-8333-333333333333'
    if (kind === 'wrong-locale') receipt.environment.locale = 'ru'
    if (kind === 'context') proof.contextSha256 = 'f'.repeat(64)
    if (kind === 'reused-request') events.rejection.requestRef = events.deletion.requestRef
    if (kind === 'before-deletion') events.priorValid.observedAt = events.rejection.observedAt
    if (kind === 'outside-private') events.rejection.observedAt = receipt.phases[3].startedAt
    if (kind === 'outside-deletion') events.deletion.observedAt = receipt.phases[0].startedAt
    if (kind === 'unreviewed') proof.independentlyReviewed = false
    // Recompute chain without overwriting the deliberately changed proof binding.
    let previous = null
    for (const entry of receipt.phases) { entry.previousSha256 = previous; previous = entryHash(entry) }
    receipt.finalSha256 = previous; writeReceipt()
    expect(check().length).toBeGreaterThan(0)
  })
  it.each(['missing', 'period', 'order', 'timeout', 'stale'])('rejects %s rejection synchronization', (kind: string) => {
    configureScene('account-delete'); addNativeRejection()
    if (kind === 'missing') delete flow.phases[2].credentialExit.rejectionStep
    if (kind === 'period') scenarios[2].steps[2].text += '.'
    if (kind === 'order') flow.phases[2].credentialExit.rejectionStep = 1
    if (kind === 'timeout') scenarios[2].steps[2].timeout = 0
    if (kind === 'stale') scenarios[1].steps.splice(-2, 1)
    save()
    expect(check().length).toBeGreaterThan(0)
  })
  it('does not substitute three-stage registration or move activation after the second login', () => {
    configureScene('register')
    flow.phases.splice(2, 2); saveManifest()
    expect(() => loadFlow(manifestFile())).toThrow('Missing, reordered or duplicate phases')
  })
  it('uses the same bounded wait for native rejection and refuses absent proof at deadline', async () => {
    configureScene('account-delete'); addNativeRejection()
    let clock = now
    await expect(waitForAttestation(path.join(directory, 'missing-native.json'), 'relogin-rejection', receipt, receipt.flow.sha256, { deadline: now + 10, now: () => clock, pause: async (ms: number) => { clock += ms } })).rejects.toThrow('Native rejection prerequisite deadline exceeded')
  })
  it('requires disposable registration activation after input and before public assertions', () => {
    configureScene('register')
    expect(check().length).toBeGreaterThan(0)
    receipt.phases[2].activation = { ...receipt.canary, kind: 'activation', accountKind: 'disposable', activated: true, startedAt: new Date(now - 83000).toISOString(), finishedAt: new Date(now - 82000).toISOString() }
    save()
    expect(check()).toEqual([])
    receipt.phases[2].activation.accountRef = '33333333-3333-4333-8333-333333333333'
    save()
    expect(check().length).toBeGreaterThan(0)
  })
})
