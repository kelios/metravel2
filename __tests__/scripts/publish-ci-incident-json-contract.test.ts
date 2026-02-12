const fs = require('fs')
const path = require('path')
const { runNodeCli, writeJsonFile, makeTempDir } = require('./cli-test-utils')

describe('publish incident json contract', () => {
  it('emits artifactUrl and artifactSource in json output for selective contract', () => {
    const dir = makeTempDir('publish-incident-json-')
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'incident.md')
    writeJsonFile(summaryFile, {
      failureClass: 'selective_contract',
      recommendationId: 'QG-007',
    })

    const result = runNodeCli([
      'scripts/publish-ci-incident-snippet.js',
      '--summary-file',
      summaryFile,
      '--output-file',
      outputFile,
      '--workflow-run',
      'https://github.com/org/repo/actions/runs/123',
      '--branch-pr',
      'https://github.com/org/repo/pull/42',
      '--artifact-id',
      '456',
      '--json',
    ])

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.schemaVersion).toBe(1)
    expect(payload.failureClass).toBe('selective_contract')
    expect(payload.recommendationId).toBe('QG-007')
    expect(payload.artifactUrl).toBe('https://github.com/org/repo/actions/runs/123/artifacts/456')
    expect(payload.artifactSource).toBe('run_id')
    expect(payload.validatorArtifactUrl).toBe('')
    expect(payload.validatorArtifactSource).toBe('none')
    expect(payload.runtimeArtifactUrl).toBe('')
    expect(payload.runtimeArtifactSource).toBe('none')
    expect(payload.primaryArtifactKind).toBe('selective_decisions')
    expect(payload.markdown).toContain('Selective decisions artifact')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('emits validator artifact fields for validator contract', () => {
    const dir = makeTempDir('publish-incident-json-')
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'incident.md')
    writeJsonFile(summaryFile, {
      failureClass: 'validator_contract',
      recommendationId: 'QG-008',
    })

    const result = runNodeCli([
      'scripts/publish-ci-incident-snippet.js',
      '--summary-file',
      summaryFile,
      '--output-file',
      outputFile,
      '--workflow-run',
      'https://github.com/org/repo/actions/runs/123',
      '--branch-pr',
      'https://github.com/org/repo/pull/42',
      '--validator-artifact-id',
      '789',
      '--json',
    ])

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.schemaVersion).toBe(1)
    expect(payload.failureClass).toBe('validator_contract')
    expect(payload.recommendationId).toBe('QG-008')
    expect(payload.validatorArtifactUrl).toBe('https://github.com/org/repo/actions/runs/123/artifacts/789')
    expect(payload.validatorArtifactSource).toBe('run_id')
    expect(payload.runtimeArtifactUrl).toBe('')
    expect(payload.runtimeArtifactSource).toBe('none')
    expect(payload.primaryArtifactKind).toBe('validator_contracts')
    expect(payload.markdown).toContain('Validator contracts artifact')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('emits runtime artifact fields for config contract', () => {
    const dir = makeTempDir('publish-incident-json-')
    const summaryFile = path.join(dir, 'quality-summary.json')
    const outputFile = path.join(dir, 'incident.md')
    writeJsonFile(summaryFile, {
      failureClass: 'config_contract',
      recommendationId: 'QG-009',
    })

    const result = runNodeCli([
      'scripts/publish-ci-incident-snippet.js',
      '--summary-file',
      summaryFile,
      '--output-file',
      outputFile,
      '--workflow-run',
      'https://github.com/org/repo/actions/runs/123',
      '--branch-pr',
      'https://github.com/org/repo/pull/42',
      '--runtime-artifact-url',
      'https://github.com/org/repo/actions/runs/123#artifacts',
      '--json',
    ])

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.failureClass).toBe('config_contract')
    expect(payload.recommendationId).toBe('QG-009')
    expect(payload.runtimeArtifactUrl).toBe('https://github.com/org/repo/actions/runs/123#artifacts')
    expect(payload.runtimeArtifactSource).toBe('explicit')
    expect(payload.primaryArtifactKind).toBe('runtime_config_diagnostics')
    expect(payload.markdown).toContain('Runtime config diagnostics artifact')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
