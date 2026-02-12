const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  INCIDENT_PAYLOAD_SCHEMA_VERSION,
  parseArgs,
  fallbackFailureClass,
  resolveFailureClass,
  resolveRecommendationId,
  resolveArtifactUrl,
  resolveArtifactSource,
  resolveValidatorArtifactSource,
  resolveRuntimeArtifactSource,
  derivePrimaryArtifactKind,
  normalizeFollowUp,
  normalizeValidatorFollowUp,
  normalizeRuntimeFollowUp,
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
      artifactUrl: '',
      artifactId: '',
      validatorArtifactUrl: '',
      validatorArtifactId: '',
      runtimeArtifactUrl: '',
      runtimeArtifactId: '',
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
      artifactUrl: '',
      artifactId: '',
      validatorArtifactUrl: '',
      validatorArtifactId: '',
      runtimeArtifactUrl: '',
      runtimeArtifactId: '',
    })
    expect(parseArgs(['--artifact-url', 'https://example.com/artifacts'])).toEqual({
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
      artifactUrl: 'https://example.com/artifacts',
      artifactId: '',
      validatorArtifactUrl: '',
      validatorArtifactId: '',
      runtimeArtifactUrl: '',
      runtimeArtifactId: '',
    })
    expect(parseArgs(['--artifact-id', '123'])).toEqual({
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
      artifactUrl: '',
      artifactId: '123',
      validatorArtifactUrl: '',
      validatorArtifactId: '',
      runtimeArtifactUrl: '',
      runtimeArtifactId: '',
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
      artifactUrl: '',
      artifactId: '',
      validatorArtifactUrl: '',
      validatorArtifactId: '',
      runtimeArtifactUrl: '',
      runtimeArtifactId: '',
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

  it('normalizes follow-up for selective contract failures', () => {
    expect(normalizeFollowUp({
      failureClass: 'selective_contract',
      followUp: 'yes',
      artifactUrl: '',
    })).toContain('selective-decisions artifact')
    expect(normalizeFollowUp({
      failureClass: 'selective_contract',
      followUp: 'yes',
      artifactUrl: 'https://github.com/org/repo/actions/runs/1#artifacts',
    })).toContain('https://github.com/org/repo/actions/runs/1#artifacts')
    expect(normalizeFollowUp({
      failureClass: 'selective_contract',
      followUp: 'yes; inspect selective-decisions artifact (test-results/selective-decisions.json)',
      artifactUrl: '',
    })).toBe('yes; inspect selective-decisions artifact (test-results/selective-decisions.json)')
    expect(normalizeFollowUp({
      failureClass: 'smoke_only',
      followUp: 'yes',
      artifactUrl: '',
    })).toBe('yes')
  })

  it('resolves artifact url from explicit value or run/id', () => {
    expect(resolveArtifactUrl({
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      artifactUrl: 'https://example.com/custom',
      artifactId: '999',
    })).toBe('https://example.com/custom')

    expect(resolveArtifactUrl({
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      artifactUrl: '',
      artifactId: '456',
    })).toBe('https://github.com/org/repo/actions/runs/123/artifacts/456')

    expect(resolveArtifactUrl({
      workflowRun: 'https://github.com/org/repo/actions/runs/abc',
      artifactUrl: '',
      artifactId: '456',
    })).toBe('')
  })

  it('resolves artifact source classification', () => {
    expect(resolveArtifactSource({
      failureClass: 'selective_contract',
      artifactUrl: 'https://example.com/custom',
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      artifactId: '456',
    })).toBe('explicit')
    expect(resolveArtifactSource({
      failureClass: 'selective_contract',
      artifactUrl: '',
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      artifactId: '456',
    })).toBe('run_id')
    expect(resolveArtifactSource({
      failureClass: 'selective_contract',
      artifactUrl: '',
      workflowRun: '',
      artifactId: '',
    })).toBe('fallback')
    expect(resolveArtifactSource({
      failureClass: 'smoke_only',
      artifactUrl: '',
      workflowRun: '',
      artifactId: '',
    })).toBe('none')
  })

  it('derives primary artifact kind from failure class', () => {
    expect(derivePrimaryArtifactKind('selective_contract')).toBe('selective_decisions')
    expect(derivePrimaryArtifactKind('validator_contract')).toBe('validator_contracts')
    expect(derivePrimaryArtifactKind('smoke_only')).toBe('none')
  })

  it('resolves validator artifact source classification', () => {
    expect(resolveValidatorArtifactSource({
      failureClass: 'validator_contract',
      artifactUrl: 'https://example.com/custom',
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      artifactId: '789',
    })).toBe('explicit')
    expect(resolveValidatorArtifactSource({
      failureClass: 'validator_contract',
      artifactUrl: '',
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      artifactId: '789',
    })).toBe('run_id')
    expect(resolveValidatorArtifactSource({
      failureClass: 'validator_contract',
      artifactUrl: '',
      workflowRun: '',
      artifactId: '',
    })).toBe('fallback')
    expect(resolveValidatorArtifactSource({
      failureClass: 'smoke_only',
      artifactUrl: '',
      workflowRun: '',
      artifactId: '',
    })).toBe('none')
  })

  it('resolves runtime artifact source classification', () => {
    expect(resolveRuntimeArtifactSource({
      failureClass: 'config_contract',
      artifactUrl: 'https://example.com/custom',
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      artifactId: '111',
    })).toBe('explicit')
    expect(resolveRuntimeArtifactSource({
      failureClass: 'config_contract',
      artifactUrl: '',
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      artifactId: '111',
    })).toBe('run_id')
    expect(resolveRuntimeArtifactSource({
      failureClass: 'config_contract',
      artifactUrl: '',
      workflowRun: '',
      artifactId: '',
    })).toBe('fallback')
    expect(resolveRuntimeArtifactSource({
      failureClass: 'smoke_only',
      artifactUrl: '',
      workflowRun: '',
      artifactId: '',
    })).toBe('none')
  })

  it('normalizes follow-up for validator contract failures', () => {
    expect(normalizeValidatorFollowUp({
      failureClass: 'validator_contract',
      followUp: 'yes',
      artifactUrl: '',
    })).toContain('validator-contracts-summary-validation artifact')
    expect(normalizeValidatorFollowUp({
      failureClass: 'validator_contract',
      followUp: 'yes',
      artifactUrl: 'https://github.com/org/repo/actions/runs/1#artifacts',
    })).toContain('https://github.com/org/repo/actions/runs/1#artifacts')
    expect(normalizeValidatorFollowUp({
      failureClass: 'smoke_only',
      followUp: 'yes',
      artifactUrl: '',
    })).toBe('yes')
  })

  it('normalizes follow-up for config contract failures', () => {
    expect(normalizeRuntimeFollowUp({
      failureClass: 'config_contract',
      followUp: 'yes',
      artifactUrl: '',
    })).toContain('runtime-config-diagnostics artifact')
    expect(normalizeRuntimeFollowUp({
      failureClass: 'config_contract',
      followUp: 'yes',
      artifactUrl: 'https://github.com/org/repo/actions/runs/1#artifacts',
    })).toContain('https://github.com/org/repo/actions/runs/1#artifacts')
    expect(normalizeRuntimeFollowUp({
      failureClass: 'smoke_only',
      followUp: 'yes',
      artifactUrl: '',
    })).toBe('yes')
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
      schemaVersion: INCIDENT_PAYLOAD_SCHEMA_VERSION,
      failureClass: 'smoke_only',
      recommendationId: 'QG-004',
      workflowRun: 'https://example.com/run/1',
      branchPr: 'https://example.com/pull/42',
      outputFile: '/tmp/incident.md',
      markdown: '### CI Smoke Incident',
      artifactUrl: '',
      artifactSource: 'none',
      validatorArtifactUrl: '',
      validatorArtifactSource: 'none',
      runtimeArtifactUrl: '',
      runtimeArtifactSource: 'none',
      primaryArtifactKind: 'none',
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
    expect(result.schemaVersion).toBe(INCIDENT_PAYLOAD_SCHEMA_VERSION)
    expect(result.recommendationId).toBe('QG-004')
    expect(result.outputFile).toBe(outputFile)
    expect(result.artifactUrl).toBe('')
    expect(result.artifactSource).toBe('none')
    expect(result.validatorArtifactUrl).toBe('')
    expect(result.validatorArtifactSource).toBe('none')
    expect(result.runtimeArtifactUrl).toBe('')
    expect(result.runtimeArtifactSource).toBe('none')
    expect(result.primaryArtifactKind).toBe('none')
    const markdown = fs.readFileSync(stepSummaryFile, 'utf8')
    expect(markdown).toContain('### CI Smoke Incident')
    expect(markdown).toContain('- Failure Class: smoke_only')
    expect(markdown).toContain('- Recommendation ID: QG-004')
    expect(fs.readFileSync(outputFile, 'utf8')).toContain('### CI Smoke Incident')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('uses validator artifact id for validator_contract failures', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-incident-'))
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'incident.md')

    fs.writeFileSync(summaryFile, JSON.stringify({
      failureClass: 'validator_contract',
      recommendationId: 'QG-008',
    }), 'utf8')

    const result = publishIncidentSnippet({
      summaryFile,
      outputFile,
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      branchPr: 'https://github.com/org/repo/pull/42',
      impact: 'Merge blocked',
      owner: 'CI Team',
      eta: '2026-02-12 12:00 UTC',
      immediateAction: 'Reran failed workflow',
      followUp: 'yes',
      validatorArtifactId: '789',
      lintResult: 'success',
      smokeResult: 'success',
    })

    const markdown = fs.readFileSync(outputFile, 'utf8')
    expect(markdown).toContain('- Validator contracts artifact: https://github.com/org/repo/actions/runs/123/artifacts/789')
    expect(result.validatorArtifactUrl).toBe('https://github.com/org/repo/actions/runs/123/artifacts/789')
    expect(result.validatorArtifactSource).toBe('run_id')
    expect(result.runtimeArtifactUrl).toBe('')
    expect(result.runtimeArtifactSource).toBe('none')
    expect(result.schemaVersion).toBe(INCIDENT_PAYLOAD_SCHEMA_VERSION)
    expect(result.primaryArtifactKind).toBe('validator_contracts')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('uses runtime artifact url for config_contract failures', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-incident-'))
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'incident.md')

    fs.writeFileSync(summaryFile, JSON.stringify({
      failureClass: 'config_contract',
      recommendationId: 'QG-009',
    }), 'utf8')

    const result = publishIncidentSnippet({
      summaryFile,
      outputFile,
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      branchPr: 'https://github.com/org/repo/pull/42',
      impact: 'Merge blocked',
      owner: 'CI Team',
      eta: '2026-02-12 12:00 UTC',
      immediateAction: 'Reran failed workflow',
      followUp: 'yes',
      runtimeArtifactUrl: 'https://github.com/org/repo/actions/runs/123#artifacts',
      lintResult: 'success',
      smokeResult: 'success',
    })

    const markdown = fs.readFileSync(outputFile, 'utf8')
    expect(markdown).toContain('- Runtime config diagnostics artifact: https://github.com/org/repo/actions/runs/123#artifacts')
    expect(result.runtimeArtifactUrl).toBe('https://github.com/org/repo/actions/runs/123#artifacts')
    expect(result.runtimeArtifactSource).toBe('explicit')
    expect(result.primaryArtifactKind).toBe('none')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('uses artifact id to build selective artifact url when explicit url is absent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-incident-'))
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'incident.md')

    fs.writeFileSync(summaryFile, JSON.stringify({
      failureClass: 'selective_contract',
      recommendationId: 'QG-007',
    }), 'utf8')

    publishIncidentSnippet({
      summaryFile,
      outputFile,
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      branchPr: 'https://github.com/org/repo/pull/42',
      impact: 'Merge blocked',
      owner: 'CI Team',
      eta: '2026-02-12 12:00 UTC',
      immediateAction: 'Reran failed workflow',
      followUp: 'yes',
      artifactId: '456',
      lintResult: 'success',
      smokeResult: 'success',
    })

    const markdown = fs.readFileSync(outputFile, 'utf8')
    expect(markdown).toContain('- Selective decisions artifact: https://github.com/org/repo/actions/runs/123/artifacts/456')
    const result = JSON.parse(JSON.stringify(publishIncidentSnippet({
      summaryFile,
      outputFile,
      workflowRun: 'https://github.com/org/repo/actions/runs/123',
      branchPr: 'https://github.com/org/repo/pull/42',
      impact: 'Merge blocked',
      owner: 'CI Team',
      eta: '2026-02-12 12:00 UTC',
      immediateAction: 'Reran failed workflow',
      followUp: 'yes',
      artifactId: '456',
      lintResult: 'success',
      smokeResult: 'success',
    })))
    expect(result.artifactUrl).toBe('https://github.com/org/repo/actions/runs/123/artifacts/456')
    expect(result.artifactSource).toBe('run_id')
    expect(result.schemaVersion).toBe(INCIDENT_PAYLOAD_SCHEMA_VERSION)
    expect(result.primaryArtifactKind).toBe('selective_decisions')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
