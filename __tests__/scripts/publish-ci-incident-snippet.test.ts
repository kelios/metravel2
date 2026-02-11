const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  parseArgs,
  fallbackFailureClass,
  resolveFailureClass,
  resolveRecommendationId,
  renderIncidentPayload,
  publishIncidentSnippet,
} = require('@/scripts/publish-ci-incident-snippet')

describe('publish-ci-incident-snippet', () => {
  it('parses arguments with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      summaryFile: 'test-results/quality-summary.json',
      outputFile: 'test-results/ci-incident-snippet.md',
      output: 'text',
      workflowRun: '',
      branchPr: '',
      impact: '<fill>',
      owner: '<fill>',
      eta: '<fill>',
      immediateAction: 'Initial triage started',
      followUp: 'yes',
    })

    expect(parseArgs(['--summary-file', 'a.json', '--workflow-run', 'run-url', '--branch-pr', 'pr-url'])).toEqual({
      summaryFile: 'a.json',
      outputFile: 'test-results/ci-incident-snippet.md',
      output: 'text',
      workflowRun: 'run-url',
      branchPr: 'pr-url',
      impact: '<fill>',
      owner: '<fill>',
      eta: '<fill>',
      immediateAction: 'Initial triage started',
      followUp: 'yes',
    })
  })

  it('supports machine-readable json output mode', () => {
    expect(parseArgs(['--json'])).toEqual({
      summaryFile: 'test-results/quality-summary.json',
      outputFile: 'test-results/ci-incident-snippet.md',
      output: 'json',
      workflowRun: '',
      branchPr: '',
      impact: '<fill>',
      owner: '<fill>',
      eta: '<fill>',
      immediateAction: 'Initial triage started',
      followUp: 'yes',
    })
  })

  it('builds fallback failure classes from job results', () => {
    expect(fallbackFailureClass({ lintResult: 'failure', smokeResult: 'success' })).toBe('lint_only')
    expect(fallbackFailureClass({ lintResult: 'success', smokeResult: 'failure' })).toBe('smoke_only')
    expect(fallbackFailureClass({ lintResult: 'failure', smokeResult: 'failure' })).toBe('mixed')
  })

  it('resolves failure class from summary first', () => {
    const fromSummary = resolveFailureClass({
      summary: { failureClass: 'inconsistent_state' },
      lintResult: 'failure',
      smokeResult: 'success',
    })
    expect(fromSummary).toBe('inconsistent_state')
  })

  it('falls back to recommendation placeholder when summary is missing id', () => {
    expect(resolveRecommendationId({})).toBe('<from Quality Gate Summary>')
    expect(resolveRecommendationId({ recommendationId: 'QG-004' })).toBe('QG-004')
  })

  it('renders payload for machine consumers', () => {
    const payload = renderIncidentPayload({
      failureClass: 'smoke_only',
      recommendationId: 'QG-004',
      workflowRun: 'https://example.com/run/1',
      branchPr: 'https://example.com/pull/42',
      outputFile: '/tmp/incident.md',
      markdown: '### CI Smoke Incident',
    })

    expect(payload).toEqual({
      failureClass: 'smoke_only',
      recommendationId: 'QG-004',
      workflowRun: 'https://example.com/run/1',
      branchPr: 'https://example.com/pull/42',
      outputFile: '/tmp/incident.md',
      markdown: '### CI Smoke Incident',
    })
  })

  it('publishes incident snippet to step summary using snapshot values', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-incident-'))
    const summaryFile = path.join(dir, 'quality-summary.json')
    const stepSummaryFile = path.join(dir, 'step-summary.md')
    const outputFile = path.join(dir, 'incident.md')

    fs.writeFileSync(summaryFile, JSON.stringify({
      failureClass: 'smoke_only',
      recommendationId: 'QG-004',
    }), 'utf8')

    const result = publishIncidentSnippet({
      summaryFile,
      outputFile,
      workflowRun: 'https://example.com/run/1',
      branchPr: 'https://example.com/pull/42',
      impact: 'Merge blocked',
      owner: 'CI Team',
      eta: '2026-02-12 12:00 UTC',
      immediateAction: 'Reran failed workflow',
      followUp: 'yes - investigate test flakiness',
      lintResult: 'success',
      smokeResult: 'failure',
      stepSummaryPath: stepSummaryFile,
    })

    expect(result.failureClass).toBe('smoke_only')
    expect(result.recommendationId).toBe('QG-004')
    expect(result.outputFile).toBe(outputFile)
    const markdown = fs.readFileSync(stepSummaryFile, 'utf8')
    expect(markdown).toContain('### CI Smoke Incident')
    expect(markdown).toContain('- Failure Class: smoke_only')
    expect(markdown).toContain('- Recommendation ID: QG-004')
    expect(fs.readFileSync(outputFile, 'utf8')).toContain('### CI Smoke Incident')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
