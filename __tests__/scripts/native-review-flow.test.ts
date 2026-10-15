const fs = require('node:fs')
const path = require('node:path')
const { loadFlow, validateFlowReceipt, sourceHash, hash, entryHash, waitForActivation, main } = require('../../scripts/native-review-flow')
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
      previous = entryHash(receipt.phases[index])
    }
    receipt.finalSha256 = previous
    fs.writeFileSync(receiptFile(), JSON.stringify(receipt))
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
      flow.scene = 'register'; flow.completeReviewScenes = ['register']; flow.accountKind = receipt.accountKind = 'disposable'
      const names = ['pre-register', 'registration-input', 'registered']
      names.forEach((id, index) => { flow.phases[index].id = receipt.phases[index].id = id; scenarios[index].id = reports[index].scenario.id = `${flow.id}-${id}` })
      save()
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
  it('requires disposable registration activation after input and before public assertions', () => {
    flow.scene = 'register'; flow.completeReviewScenes = ['register']; flow.accountKind = receipt.accountKind = 'disposable'
    const names = ['pre-register', 'registration-input', 'registered']
    names.forEach((id, index) => { flow.phases[index].id = receipt.phases[index].id = id; scenarios[index].id = reports[index].scenario.id = `${flow.id}-${id}` })
    save()
    expect(check().length).toBeGreaterThan(0)
    receipt.phases[2].activation = { ...receipt.canary, kind: 'activation', accountKind: 'disposable', activated: true, startedAt: new Date(now - 83000).toISOString(), finishedAt: new Date(now - 82000).toISOString() }
    save()
    expect(check()).toEqual([])
    receipt.phases[2].activation.accountRef = '33333333-3333-4333-8333-333333333333'
    save()
    expect(check().length).toBeGreaterThan(0)
  })
})
