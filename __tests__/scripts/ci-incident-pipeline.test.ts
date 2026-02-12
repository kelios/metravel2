const fs = require('fs')
const path = require('path')
const { writeJsonFile, makeTempDir } = require('./cli-test-utils')
const { publishIncidentSnippet } = require('@/scripts/publish-ci-incident-snippet')
const { validate } = require('@/scripts/validate-ci-incident-snippet')
const { validate: validatePayload } = require('@/scripts/validate-ci-incident-payload')

describe('ci incident pipeline integration', () => {
  it('publishes and validates incident snippet from quality-summary fixture', () => {
    const dir = makeTempDir('ci-incident-pipeline-')
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'ci-incident-snippet.md')
    const stepSummaryFile = path.join(dir, 'step-summary.md')

    writeJsonFile(summaryFile, {
      overallOk: false,
      failureClass: 'inconsistent_state',
      recommendationId: 'QG-002',
      lintOk: true,
      smokeOk: true,
      inconsistencies: ['Lint job failed but report is clean'],
    })

    const published = publishIncidentSnippet({
      summaryFile,
      outputFile,
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      branchPr: 'https://github.com/org/repo/pull/42',
      impact: '<fill>',
      owner: '<fill>',
      eta: '<fill>',
      immediateAction: 'Initial triage started',
      followUp: 'yes',
      lintResult: 'failure',
      smokeResult: 'success',
      stepSummaryPath: stepSummaryFile,
    })

    expect(published.failureClass).toBe('inconsistent_state')
    expect(published.recommendationId).toBe('QG-002')

    const incident = fs.readFileSync(outputFile, 'utf8')
    expect(incident).toContain('### CI Smoke Incident')
    expect(incident).toContain('- Failure Class: inconsistent_state')
    expect(incident).toContain('- Recommendation ID: QG-002')

    const errors = validate(incident)
    expect(errors).toEqual([])
    expect(validatePayload(published)).toEqual([])

    const stepSummary = fs.readFileSync(stepSummaryFile, 'utf8')
    expect(stepSummary).toContain('### CI Smoke Incident')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('adds selective decisions follow-up note for selective_contract failures', () => {
    const dir = makeTempDir('ci-incident-pipeline-')
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'ci-incident-snippet.md')
    const stepSummaryFile = path.join(dir, 'step-summary.md')

    writeJsonFile(summaryFile, {
      overallOk: false,
      failureClass: 'selective_contract',
      recommendationId: 'QG-007',
      lintOk: true,
      smokeOk: true,
      selectiveDecisionsAggregateIssue: true,
    })

    const published = publishIncidentSnippet({
      summaryFile,
      outputFile,
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      branchPr: 'https://github.com/org/repo/pull/42',
      impact: '<fill>',
      owner: '<fill>',
      eta: '<fill>',
      immediateAction: 'Initial triage started',
      followUp: 'yes',
      artifactUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
      lintResult: 'success',
      smokeResult: 'success',
      stepSummaryPath: stepSummaryFile,
    })

    expect(published.failureClass).toBe('selective_contract')
    expect(published.recommendationId).toBe('QG-007')

    const incident = fs.readFileSync(outputFile, 'utf8')
    expect(incident).toContain('- Failure Class: selective_contract')
    expect(incident).toContain('- Recommendation ID: QG-007')
    expect(incident).toContain('selective-decisions artifact')
    expect(incident).toContain('- Selective decisions artifact: https://github.com/org/repo/actions/runs/123#artifacts')

    const errors = validate(incident)
    expect(errors).toEqual([])
    expect(validatePayload(published)).toEqual([])

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('fails payload validation on inconsistent artifact metadata', () => {
    const dir = makeTempDir('ci-incident-pipeline-')
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'ci-incident-snippet.md')

    writeJsonFile(summaryFile, {
      overallOk: false,
      failureClass: 'selective_contract',
      recommendationId: 'QG-007',
      lintOk: true,
      smokeOk: true,
      selectiveDecisionsAggregateIssue: true,
    })

    const published = publishIncidentSnippet({
      summaryFile,
      outputFile,
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      branchPr: 'https://github.com/org/repo/pull/42',
      impact: '<fill>',
      owner: '<fill>',
      eta: '<fill>',
      immediateAction: 'Initial triage started',
      followUp: 'yes',
      artifactId: '456',
      lintResult: 'success',
      smokeResult: 'success',
    })

    expect(validatePayload(published)).toEqual([])

    const corrupted = {
      ...published,
      artifactSource: 'run_id',
      artifactUrl: '',
      markdown: String(published.markdown || '').replace(
        /^-\s*Selective decisions artifact:.*$/m,
        ''
      ),
    }

    const errors = validatePayload(corrupted)
    expect(errors.join('\n')).toContain('artifactUrl')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('adds runtime diagnostics follow-up/artifact for config_contract failures', () => {
    const dir = makeTempDir('ci-incident-pipeline-')
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'ci-incident-snippet.md')

    writeJsonFile(summaryFile, {
      overallOk: false,
      failureClass: 'config_contract',
      recommendationId: 'QG-009',
      lintOk: true,
      smokeOk: true,
      runtimeConfigDiagnosticsIssue: true,
    })

    const published = publishIncidentSnippet({
      summaryFile,
      outputFile,
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      branchPr: 'https://github.com/org/repo/pull/42',
      impact: '<fill>',
      owner: '<fill>',
      eta: '<fill>',
      immediateAction: 'Initial triage started',
      followUp: 'yes',
      runtimeArtifactUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
      lintResult: 'success',
      smokeResult: 'success',
    })

    const incident = fs.readFileSync(outputFile, 'utf8')
    expect(incident).toContain('- Failure Class: config_contract')
    expect(incident).toContain('- Recommendation ID: QG-009')
    expect(incident).toContain('runtime-config-diagnostics artifact')
    expect(incident).toContain('- Runtime config diagnostics artifact: https://github.com/org/repo/actions/runs/123#artifacts')

    const errors = validate(incident)
    expect(errors).toEqual([])
    expect(validatePayload(published)).toEqual([])
    expect(published.runtimeArtifactUrl).toBe('https://github.com/org/repo/actions/runs/123#artifacts')
    expect(published.runtimeArtifactSource).toBe('explicit')
    expect(published.primaryArtifactKind).toBe('runtime_config_diagnostics')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
