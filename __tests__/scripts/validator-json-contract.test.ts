const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const runNode = (args, env = {}) => {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

describe('validator json contract (negative paths)', () => {
  it('returns structured json errors for incident validator', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-contract-'))
    const incidentPath = path.join(dir, 'incident.md')
    fs.writeFileSync(incidentPath, '- Workflow run: <link>\n', 'utf8')

    const result = runNode([
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-contract-'))
    const payloadPath = path.join(dir, 'incident-payload.json')
    fs.writeFileSync(payloadPath, JSON.stringify({
      failureClass: 'selective_contract',
      recommendationId: 'QG-007',
      artifactSource: 'none',
      artifactUrl: '',
      markdown: '### CI Smoke Incident\n',
    }), 'utf8')

    const result = runNode([
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-contract-'))
    const recoPath = path.join(dir, 'reco.json')
    fs.writeFileSync(recoPath, JSON.stringify({
      sourceSnapshot: '',
      suiteCount: 0,
      format: 'yaml',
      baselineValue: '',
      ghCommand: '',
    }), 'utf8')

    const result = runNode([
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
    const result = runNode(
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-contract-'))
    const commentPath = path.join(dir, 'validator-guard-comment.md')
    fs.writeFileSync(commentPath, [
      '### Validator Guard Comment',
      '- Status: UNKNOWN',
      '- Reason: <fill>',
      '- Workflow run: not-a-url',
      '- Guard artifact: <link>',
      '',
    ].join('\n'), 'utf8')

    const result = runNode([
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-contract-'))
    const docsPath = path.join(dir, 'TESTING.md')
    fs.writeFileSync(docsPath, '## Docs without markers\n', 'utf8')

    const result = runNode([
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
})
