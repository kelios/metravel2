const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { validateReadiness, readinessMessage, MAX_AGE_MS } = require('../../scripts/native-recording-readiness')
const { runnerSourceHash } = require('../../tools/ios-device-uitests/run')
const { makeTempDir } = require('./cli-test-utils')

describe('native recording readiness', () => {
  let directory: string
  let plan: any
  let report: any
  let scenario: any
  const now = Date.parse('2026-10-15T12:00:00Z')
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const executionFor = (steps: Array<{ op: string }>) => ({
    totalTestCount: 1, passedTests: 1, failedTests: 0, skippedTests: 0, expectedFailures: 0,
    identity: 'MetravelDeviceUITests/RunScriptTests/testRunScript()', scriptSha256: digest(JSON.stringify(steps)),
    completedSteps: steps.length, completedAssertions: steps.filter((step) => ['assert', 'waitUntil'].includes(step.op)).length,
  })
  const appReview = () => {
    plan.purpose = 'app-review'
    plan.candidate.origin = report.candidate.origin = 'testflight'
    plan.scenes = []
  }
  // Synthetic unit-only receipts never represent a real candidate or rehearsal.
  const addChild = (segment: string) => {
    const child = {
      id: `report-${segment}`, layer: 'physical-ios', completeReviewScenes: [],
      completeReviewSegments: [`ugc-flag-content/${segment}`],
      steps: [{ op: 'tapId', id: `${segment}-trigger` }, { op: 'assert', id: `${segment}-ack`, state: 'hittable' }],
    }
    const childReport = JSON.parse(JSON.stringify(report))
    childReport.scenario = { id: child.id, sha256: digest(JSON.stringify(child)) }
    childReport.execution = executionFor(child.steps)
    const request = { id: 'ugc-flag-content', segment, path: `${segment}.json`, report: `${segment}-report.json` }
    const save = () => {
      fs.writeFileSync(path.join(directory, request.path), JSON.stringify(child))
      fs.writeFileSync(path.join(directory, request.report), JSON.stringify(childReport))
    }
    save()
    plan.scenes.push(request)
    return { child, childReport, request, save }
  }
  const write = () => {
    const raw = JSON.stringify(scenario)
    fs.writeFileSync(path.join(directory, 'scene.json'), raw)
    report.scenario.sha256 = createHash('sha256').update(raw).digest('hex')
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report))
  }
  const check = () => validateReadiness(plan, { directory, now })
  beforeEach(() => {
    const root = path.resolve('.codex-temp/native-recording-tests')
    directory = makeTempDir('case-', { root })
    scenario = { id: 'modal-reopen', layer: 'physical-ios', steps: [{ op: 'tapId', id: 'trigger' }, { op: 'assert', id: 'sheet', state: 'hittable' }] }
    plan = {
      schemaVersion: 1, purpose: 'regression', runnerFingerprint: 'b'.repeat(64),
      candidate: { version: '1.0.5', build: '11', source: 'a'.repeat(40), origin: 'development' },
      environment: { apiUrl: 'http://192.0.2.1:8000', locale: 'en', accountRole: 'guest', deviceModel: 'iPhone test' },
      scenes: [{ id: scenario.id, path: 'scene.json', report: 'report.json' }],
    }
    report = {
      schemaVersion: 1, status: 'passed', exitCode: 0, layer: 'physical-ios', mode: 'rehearsal',
      scenario: { id: scenario.id, sha256: '' },
      runner: { sourceSha256: runnerSourceHash(), fingerprint: plan.runnerFingerprint },
      candidate: { ...plan.candidate }, environment: { ...plan.environment },
      observedCandidate: { version: plan.candidate.version, build: plan.candidate.build },
      execution: executionFor(scenario.steps),
      startedAt: new Date(now - 120000).toISOString(), finishedAt: new Date(now - 60000).toISOString(),
    }
    write()
  })
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }))

  it('accepts a fresh passing physical rehearsal for the identical regression', () => {
    expect(check()).toEqual([])
  })
  it('labels consistency separately from independently verified installation and environment', () => {
    const message = readinessMessage(plan)
    expect(message).toContain('REHEARSAL EVIDENCE CONSISTENT:')
    expect(message).toContain('installed candidate/source provenance (including TestFlight origin for App Review), API transport and account role verification still required')
    expect(message).toContain('capture/privacy verification still required')
    expect(message).not.toContain('RECORDING READY')
  })
  it('rejects an old label-only passed report independently of the runner exit', () => {
    delete report.execution
    write()
    expect(check()).toContain('modal-reopen: missing or mismatched completed execution evidence')
  })
  it.each([
    { totalTestCount: 0, passedTests: 0 }, { passedTests: 0 }, { failedTests: 1 },
    { skippedTests: 1 }, { expectedFailures: 1 }, { identity: 'Other/test()' },
    { scriptSha256: 'c'.repeat(64) }, { completedSteps: 0 }, { completedAssertions: 0 },
  ])('rejects unexecuted, wrong or incomplete normalized execution evidence: %j', (override) => {
    Object.assign(report.execution, override)
    write()
    expect(check()).toContain('modal-reopen: missing or mismatched completed execution evidence')
  })

  it('keeps exactly the six reviewed segments under the single content-report parent', () => {
    const catalog = require('../../.codex/skills/metravel-app-review-evidence/scenes.json').scenes
    expect(catalog.filter((item: any) => item.requiredSegments)).toHaveLength(1)
    expect(catalog.find((item: any) => item.id === 'ugc-flag-content').requiredSegments).toEqual(['travel', 'comment', 'message', 'trip-chat', 'quest-review', 'photo'])
  })
  it('accepts independent matching child requests without claiming a full parent', () => {
    appReview()
    addChild('photo')
    addChild('quest-review')
    expect(check()).toEqual([])
    expect(readinessMessage(plan)).toContain('0 scene request(s), 2 child segment request(s)')
    expect(readinessMessage(plan)).toContain('no parent coverage inferred')
  })
  it('rejects duplicate children but allows different children of the same parent', () => {
    appReview()
    const photo = addChild('photo')
    addChild('quest-review')
    expect(check()).toEqual([])
    plan.scenes.push({ ...photo.request })
    expect(check()).toContain('Missing or duplicate scene id')
  })
  it.each([{ id: 'ugc-flag-content', segment: 'other' }, { id: 'ugc-report', segment: 'photo' }, { id: 'unknown-parent', segment: 'photo' }, { id: 'ugc-flag-content', segment: null }])('rejects undeclared parent or segment mapping: %j', (override) => {
    appReview()
    const { request } = addChild('photo')
    Object.assign(request, override)
    expect(check().some((failure: string) => failure.includes('unknown App Review segment mapping'))).toBe(true)
  })
  it.each([['ugc-flag-content/other'], ['ugc-report/photo'], ['ugc-flag-content/photo', 'ugc-flag-content/photo']])('rejects unknown or duplicate coverage declarations: %j', (...coverage) => {
    appReview()
    const { child, save } = addChild('photo')
    child.completeReviewSegments = coverage
    save()
    expect(check()).toContain('ugc-flag-content/photo: invalid complete App Review segment declarations')
  })
  it('requires the exact requested child declaration and cannot use another child report', () => {
    appReview()
    const photo = addChild('photo')
    const review = addChild('quest-review')
    photo.child.completeReviewSegments = ['ugc-flag-content/quest-review']
    photo.save()
    expect(check()).toContain('ugc-flag-content/photo: scenario does not cover this complete App Review segment')
    photo.child.completeReviewSegments = ['ugc-flag-content/photo']
    photo.save()
    photo.request.report = review.request.report
    expect(check()).toContain('ugc-flag-content/photo: scenario changed since rehearsal')
  })
  it('rejects missing child scenario identity even when the report repeats its omission', () => {
    appReview()
    const { child, childReport, save } = addChild('photo')
    delete (child as any).id
    delete childReport.scenario.id
    childReport.scenario.sha256 = digest(JSON.stringify(child))
    save()
    expect(check()).toContain('ugc-flag-content/photo: missing or invalid scenario identity')
  })
  it('never promotes two children into the complete six-type parent', () => {
    appReview()
    const photo = addChild('photo')
    addChild('quest-review')
    plan.scenes.push({ id: 'ugc-flag-content', path: photo.request.path, report: photo.request.report })
    expect(check()).toContain('ugc-flag-content: scenario does not cover this complete App Review scene')
    expect(check()).toContain('ugc-flag-content: full scene requires every declared catalog segment')
  })
  it('requires both the explicit parent and all six declarations in its own complete scenario', () => {
    appReview()
    plan.scenes.push({ id: 'ugc-flag-content', path: 'scene.json', report: 'report.json' })
    scenario.completeReviewSegments = ['travel', 'comment', 'message', 'trip-chat', 'quest-review', 'photo'].map((segment) => `ugc-flag-content/${segment}`)
    write()
    expect(check()).toContain('ugc-flag-content: scenario does not cover this complete App Review scene')
    scenario.completeReviewScenes = ['ugc-flag-content']
    write()
    expect(check()).toEqual([])
    scenario.completeReviewSegments = ['ugc-flag-content/photo', 'ugc-flag-content/quest-review']
    write()
    expect(check()).toContain('ugc-flag-content: full scene requires every declared catalog segment')
  })
  it('keeps candidate, scenario and history validation independent for each child', () => {
    appReview()
    const photo = addChild('photo')
    addChild('quest-review')
    photo.childReport.candidate.build = 'different'
    photo.childReport.startedAt = new Date(now - MAX_AGE_MS - 2).toISOString()
    photo.childReport.finishedAt = new Date(now - MAX_AGE_MS - 1).toISOString()
    photo.save()
    fs.appendFileSync(path.join(directory, photo.request.path), '\n')
    const failures = check()
    expect(failures).toContain('ugc-flag-content/photo: candidate.build mismatch')
    expect(failures).toContain('ugc-flag-content/photo: scenario changed since rehearsal')
    expect(failures).toContain('ugc-flag-content/photo: rehearsal is stale or has invalid timestamps')
    expect(failures.every((failure: string) => !failure.startsWith('ugc-flag-content/quest-review:'))).toBe(true)
  })
  it('does not allow child segments in regression plans', () => {
    plan.scenes[0].segment = 'photo'
    expect(check()).toContain('modal-reopen/photo: unknown App Review segment mapping')
  })
  it.each(['candidate', 'environment'])('rejects changed %s identity', (group: string) => {
    const key = group === 'candidate' ? 'build' : 'apiUrl'
    report[group][key] = 'changed'
    write()
    expect(check()).toContain(`modal-reopen: ${group}.${key} mismatch`)
  })
  it('rejects scenario edits after rehearsal', () => {
    fs.appendFileSync(path.join(directory, 'scene.json'), '\n')
    expect(check()).toContain('modal-reopen: scenario changed since rehearsal')
  })
  it('requires actual installed version and build observations', () => {
    delete report.observedCandidate
    write()
    expect(check()).toContain('modal-reopen: installed candidate was not verified')
  })
  it('rejects old driver code and changed helper fingerprint', () => {
    report.runner.sourceSha256 = 'c'.repeat(64)
    write()
    expect(check()).toContain('modal-reopen: runner identity changed')
    report.runner.sourceSha256 = runnerSourceHash()
    report.runner.fingerprint = 'd'.repeat(64)
    write()
    expect(check()).toContain('modal-reopen: runner identity changed')
  })
  it.each(['failed', 'timed_out'])('rejects %s results even with a zero exit', (status: string) => {
    report.status = status
    write()
    expect(check()).toContain('modal-reopen: no successful physical rehearsal')
  })
  it('rejects diagnostic-only and simulator evidence', () => {
    report.mode = 'diagnostic'
    report.layer = 'ios-simulator'
    write()
    expect(check()).toContain('modal-reopen: no successful physical rehearsal')
  })
  it.each([now - MAX_AGE_MS - 1, now + 1])('rejects stale or future timestamps (%s)', (startedAt: number) => {
    report.startedAt = new Date(startedAt).toISOString()
    report.finishedAt = new Date(startedAt + 1).toISOString()
    write()
    expect(check()).toContain('modal-reopen: rehearsal is stale or has invalid timestamps')
  })
  it('does not promote a partial regression into a complete App Review scene', () => {
    plan.purpose = 'app-review'
    plan.candidate.origin = 'testflight'
    report.candidate.origin = 'testflight'
    plan.scenes[0].id = 'ugc-report'
    write()
    expect(check()).toContain('ugc-report: scenario does not cover this complete App Review scene')
  })
  it.each(['login', 'register', 'account-delete'])('cannot promote an isolated public phase into %s', (id: string) => {
    plan.purpose = 'app-review'
    plan.candidate.origin = report.candidate.origin = 'testflight'
    plan.scenes[0].id = id
    scenario.completeReviewScenes = [id]
    write()
    expect(check()).toContain(`${id}: complete authentication scene requires a whole phased flow`)
  })
  it('does not allow registration and deletion to switch disposable accounts', () => {
    plan.scenes = [
      { id: 'register', flow: 'missing-register.json', report: 'missing.json', accountRef: '11111111-1111-4111-8111-111111111111' },
      { id: 'account-delete', flow: 'missing-delete.json', report: 'missing.json', accountRef: '22222222-2222-4222-8222-222222222222' },
    ]
    expect(check()).toContain('Registration and deletion require the same disposable account reference')
  })
  it('rejects action-only scenarios and empty or duplicate scenes', () => {
    scenario.steps = [{ op: 'tapId', id: 'trigger' }]
    write()
    expect(check()).toContain('modal-reopen: expected physical scenario with assertions')
    plan.scenes.push({ ...plan.scenes[0] })
    expect(check()).toContain('Missing or duplicate scene id')
    plan.scenes = []
    expect(check()).toContain('No scenes requested')
  })
  it('fails closed on malformed or missing reports', () => {
    fs.writeFileSync(path.join(directory, 'report.json'), '{}')
    expect(check().length).toBeGreaterThan(0)
    fs.unlinkSync(path.join(directory, 'report.json'))
    expect(check()).toContain('modal-reopen: unreadable or invalid scenario/report')
  })
})
