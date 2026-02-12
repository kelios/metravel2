const fs = require('fs')
const path = require('path')
const { runNodeCli, writeJsonFile, writeTextFile, makeTempDir } = require('./cli-test-utils')

describe('validator json contract (negative paths)', () => {
  it('returns structured json errors for incident validator', () => {
    const dir = makeTempDir('validator-contract-')
    const incidentPath = path.join(dir, 'incident.md')
    writeTextFile(incidentPath, '- Workflow run: <link>\n')

    const result = runNodeCli([
      'scripts/validate-ci-incident-snippet.js',
      '--file',
      incidentPath,
      '--json',
    ])

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(false)
    expect(payload.errorCount).toBeGreaterThan(0)
    expect(Array.isArray(payload.errors)).toBe(true)
    expect(payload.errors[0]).toHaveProperty('code')
    expect(payload.errors.some((e) => e.code === 'INCIDENT_INVALID_WORKFLOW_RUN')).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns structured json errors for incident payload validator', () => {
    const dir = makeTempDir('validator-contract-')
    const payloadPath = path.join(dir, 'incident-payload.json')
    writeJsonFile(payloadPath, {
      failureClass: 'selective_contract',
      recommendationId: 'QG-007',
      artifactSource: 'none',
      artifactUrl: '',
      markdown: '### CI Smoke Incident\n',
    })

    const result = runNodeCli([
      'scripts/validate-ci-incident-payload.js',
      '--file',
      payloadPath,
      '--json',
    ])

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(false)
    expect(payload.errorCount).toBeGreaterThan(0)
    expect(payload.errors.some((e) => e.code === 'INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_SOURCE')).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns structured json errors for suite baseline validator', () => {
    const dir = makeTempDir('validator-contract-')
    const recoPath = path.join(dir, 'reco.json')
    writeJsonFile(recoPath, {
      sourceSnapshot: '',
      suiteCount: 0,
      format: 'yaml',
      baselineValue: '',
      ghCommand: '',
    })

    const result = runNodeCli([
      'scripts/validate-smoke-suite-baseline-recommendation.js',
      '--file',
      recoPath,
      '--json',
    ])

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(false)
    expect(payload.errorCount).toBeGreaterThan(0)
    expect(payload.errors.some((e) => e.code === 'SUITE_INVALID_FORMAT')).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns structured json errors for pr exception validator', () => {
    const result = runNodeCli(
      ['scripts/validate-pr-ci-exception.js', '--json'],
      {
        PR_BODY: 'Regular PR body',
        REQUIRE_EXCEPTION: 'true',
      },
    )

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(false)
    expect(payload.errorCount).toBeGreaterThan(0)
    expect(payload.errors.some((e) => e.code === 'PR_EXCEPTION_REQUIRED')).toBe(true)
  })

  it('returns structured json errors for validator guard comment validator', () => {
    const dir = makeTempDir('validator-contract-')
    const commentPath = path.join(dir, 'validator-guard-comment.md')
    writeTextFile(commentPath, [
      '### Validator Guard Comment',
      '- Status: UNKNOWN',
      '- Reason: <fill>',
      '- Workflow run: not-a-url',
      '- Guard artifact: <link>',
      '',
    ].join('\n'))

    const result = runNodeCli([
      'scripts/validate-validator-guard-comment.js',
      '--file',
      commentPath,
      '--json',
    ])

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(false)
    expect(payload.errorCount).toBeGreaterThan(0)
    expect(payload.errors.some((e) => e.code === 'VALIDATOR_GUARD_COMMENT_INVALID_STATUS')).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns structured json errors for validator error-codes docs table validator', () => {
    const dir = makeTempDir('validator-contract-')
    const docsPath = path.join(dir, 'TESTING.md')
    writeTextFile(docsPath, '## Docs without markers\n')

    const result = runNodeCli([
      'scripts/validate-validator-error-codes-doc-table.js',
      '--file',
      docsPath,
      '--json',
    ])

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(false)
    expect(payload.errorCount).toBeGreaterThan(0)
    expect(payload.errors.some((e) => e.code === 'ERROR_CODES_DOC_MISSING_MARKERS')).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns structured json errors for validator error-codes policy validator', () => {
    const result = runNodeCli([
      'scripts/validate-validator-error-codes-policy.js',
      '--json',
    ], {
      // no env needed; validator uses in-repo ERROR_CODES
    })

    // Current repository policy is expected to pass.
    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(true)
    expect(payload.errorCount).toBe(0)
    expect(Array.isArray(payload.errors)).toBe(true)
  })

  it('returns structured json errors for validator contracts summary validator', () => {
    const dir = makeTempDir('validator-contract-')
    const summaryPath = path.join(dir, 'validator-contracts-summary.json')
    writeTextFile(summaryPath, '{')

    const result = runNodeCli([
      'scripts/validate-validator-contracts-summary.js',
      '--file',
      summaryPath,
      '--json',
    ])

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(false)
    expect(payload.errorCount).toBeGreaterThan(0)
    expect(payload.errors.some((e) => e.code === 'VALIDATOR_CONTRACTS_SUMMARY_INVALID_JSON')).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
