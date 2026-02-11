const fs = require('fs')
const os = require('os')
const path = require('path')
const { publishIncidentSnippet } = require('@/scripts/publish-ci-incident-snippet')
const { validate } = require('@/scripts/validate-ci-incident-snippet')

describe('ci incident pipeline integration', () => {
  it('publishes and validates incident snippet from quality-summary fixture', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-incident-pipeline-'))
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'ci-incident-snippet.md')
    const stepSummaryFile = path.join(dir, 'step-summary.md')

    fs.writeFileSync(summaryFile, JSON.stringify({
      overallOk: false,
      failureClass: 'inconsistent_state',
      recommendationId: 'QG-002',
      lintOk: true,
      smokeOk: true,
      inconsistencies: ['Lint job failed but report is clean'],
    }), 'utf8')

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

    const stepSummary = fs.readFileSync(stepSummaryFile, 'utf8')
    expect(stepSummary).toContain('### CI Smoke Incident')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('adds selective decisions follow-up note for selective_contract failures', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-incident-pipeline-'))
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'ci-incident-snippet.md')
    const stepSummaryFile = path.join(dir, 'step-summary.md')

    fs.writeFileSync(summaryFile, JSON.stringify({
      overallOk: false,
      failureClass: 'selective_contract',
      recommendationId: 'QG-007',
      lintOk: true,
      smokeOk: true,
      selectiveDecisionsAggregateIssue: true,
    }), 'utf8')

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

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
