const fs = require('fs')
const os = require('os')
const path = require('path')
const { writeJsonFile } = require('./cli-test-utils')
const {
  SUPPORTED_SCHEMA_VERSION,
  ALLOWED_PRIMARY_ARTIFACT_KINDS,
  parseArgs,
  validate,
  validateDetailed,
} = require('@/scripts/validate-ci-incident-payload')

const validPayload = () => ({
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  failureClass: 'selective_contract',
  recommendationId: 'QG-007',
  workflowRun: 'https://github.com/org/repo/actions/runs/123',
  branchPr: 'https://github.com/org/repo/pull/42',
  outputFile: '/tmp/ci-incident-snippet.md',
  markdown: [
    '### CI Smoke Incident',
    '- Failure Class: selective_contract',
    '- Recommendation ID: QG-007',
    '- Selective decisions artifact: https://github.com/org/repo/actions/runs/123/artifacts/456',
    '',
  ].join('\n'),
  artifactUrl: 'https://github.com/org/repo/actions/runs/123/artifacts/456',
  artifactSource: 'run_id',
  validatorArtifactUrl: '',
  validatorArtifactSource: 'none',
  primaryArtifactKind: 'selective_decisions',
})

describe('validate-ci-incident-payload', () => {
  it('parses default and override file args', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/ci-incident-payload.json',
      output: 'text',
    })
    expect(parseArgs(['--file', 'tmp/payload.json'])).toEqual({
      file: 'tmp/payload.json',
      output: 'text',
    })
    expect(parseArgs(['--json'])).toEqual({
      file: 'test-results/ci-incident-payload.json',
      output: 'json',
    })
  })

  it('passes for valid payload', () => {
    expect(validate(validPayload())).toEqual([])
  })

  it('fails when schemaVersion is unsupported', () => {
    const payload = validPayload()
    payload.schemaVersion = 999
    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INVALID_SCHEMA_VERSION')).toBe(true)
  })

  it('keeps allowed primary artifact kinds stable', () => {
    expect([...ALLOWED_PRIMARY_ARTIFACT_KINDS]).toEqual([
      'none',
      'selective_decisions',
      'validator_contracts',
      'runtime_config_diagnostics',
    ])
  })

  it('passes for validator_contract payload without selective artifact', () => {
    const payload = validPayload()
    payload.failureClass = 'validator_contract'
    payload.recommendationId = 'QG-008'
    payload.artifactSource = 'none'
    payload.artifactUrl = ''
    payload.validatorArtifactSource = 'run_id'
    payload.validatorArtifactUrl = 'https://github.com/org/repo/actions/runs/123/artifacts/789'
    payload.primaryArtifactKind = 'validator_contracts'
    payload.markdown = [
      '### CI Smoke Incident',
      '- Failure Class: validator_contract',
      '- Recommendation ID: QG-008',
      '- Validator contracts artifact: https://github.com/org/repo/actions/runs/123/artifacts/789',
      '',
    ].join('\n')
    expect(validate(payload)).toEqual([])
  })

  it('passes for config_contract payload with no contract artifacts', () => {
    const payload = validPayload()
    payload.failureClass = 'config_contract'
    payload.recommendationId = 'QG-009'
    payload.artifactSource = 'none'
    payload.artifactUrl = ''
    payload.validatorArtifactSource = 'none'
    payload.validatorArtifactUrl = ''
    payload.runtimeArtifactSource = 'fallback'
    payload.runtimeArtifactUrl = ''
    payload.primaryArtifactKind = 'runtime_config_diagnostics'
    payload.markdown = [
      '### CI Smoke Incident',
      '- Failure Class: config_contract',
      '- Recommendation ID: QG-009',
      '',
    ].join('\n')
    expect(validate(payload)).toEqual([])
  })

  it('fails for config_contract payload when runtime artifact source is missing', () => {
    const payload = validPayload()
    payload.failureClass = 'config_contract'
    payload.recommendationId = 'QG-009'
    payload.artifactSource = 'none'
    payload.artifactUrl = ''
    payload.validatorArtifactSource = 'none'
    payload.validatorArtifactUrl = ''
    payload.runtimeArtifactSource = 'none'
    payload.runtimeArtifactUrl = ''
    payload.primaryArtifactKind = 'runtime_config_diagnostics'
    payload.markdown = [
      '### CI Smoke Incident',
      '- Failure Class: config_contract',
      '- Recommendation ID: QG-009',
      '',
    ].join('\n')

    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_SOURCE')).toBe(true)
  })

  it('fails when validator contract source/url are inconsistent', () => {
    const payload = validPayload()
    payload.failureClass = 'validator_contract'
    payload.recommendationId = 'QG-008'
    payload.artifactSource = 'none'
    payload.artifactUrl = ''
    payload.validatorArtifactSource = 'none'
    payload.validatorArtifactUrl = ''
    payload.primaryArtifactKind = 'validator_contracts'
    payload.markdown = payload.markdown
      .replace('selective_contract', 'validator_contract')
      .replace('QG-007', 'QG-008')
      .replace(/^- Selective decisions artifact:.*$/m, '')
    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INCONSISTENT_VALIDATOR_ARTIFACT_SOURCE')).toBe(true)
  })

  it('fails when markdown validator artifact line does not match validatorArtifactUrl', () => {
    const payload = validPayload()
    payload.failureClass = 'validator_contract'
    payload.recommendationId = 'QG-008'
    payload.artifactSource = 'none'
    payload.artifactUrl = ''
    payload.validatorArtifactSource = 'run_id'
    payload.validatorArtifactUrl = 'https://github.com/org/repo/actions/runs/123/artifacts/789'
    payload.primaryArtifactKind = 'validator_contracts'
    payload.markdown = [
      '### CI Smoke Incident',
      '- Failure Class: validator_contract',
      '- Recommendation ID: QG-008',
      '- Validator contracts artifact: https://github.com/org/repo/actions/runs/123/artifacts/999',
      '',
    ].join('\n')
    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INCONSISTENT_MARKDOWN_VALIDATOR_ARTIFACT')).toBe(true)
  })

  it('fails when selective contract uses artifactSource none', () => {
    const payload = validPayload()
    payload.artifactSource = 'none'
    payload.artifactUrl = ''
    payload.primaryArtifactKind = 'selective_decisions'
    payload.markdown = payload.markdown.replace(/^- Selective decisions artifact:.*$/m, '')
    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_SOURCE')).toBe(true)
  })

  it('fails when artifactUrl and source are inconsistent', () => {
    const payload = validPayload()
    payload.artifactSource = 'run_id'
    payload.artifactUrl = ''
    payload.primaryArtifactKind = 'selective_decisions'
    payload.markdown = payload.markdown.replace(/^- Selective decisions artifact:.*$/m, '')
    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_URL')).toBe(true)
  })

  it('fails when markdown artifact line does not match artifactUrl', () => {
    const payload = validPayload()
    payload.markdown = payload.markdown.replace(
      'https://github.com/org/repo/actions/runs/123/artifacts/456',
      'https://github.com/org/repo/actions/runs/123/artifacts/999',
    )
    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INCONSISTENT_MARKDOWN_ARTIFACT')).toBe(true)
  })

  it('fails when primaryArtifactKind is inconsistent with failure class', () => {
    const payload = validPayload()
    payload.primaryArtifactKind = 'validator_contracts'
    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INCONSISTENT_PRIMARY_ARTIFACT_KIND')).toBe(true)
  })

  it('fails when primaryArtifactKind is invalid', () => {
    const payload = validPayload()
    payload.primaryArtifactKind = 'unknown'
    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INVALID_PRIMARY_ARTIFACT_KIND')).toBe(true)
  })

  it('reads and validates payload file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-incident-payload-'))
    const payloadPath = path.join(dir, 'payload.json')
    writeJsonFile(payloadPath, validPayload())
    const loaded = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
    expect(validate(loaded)).toEqual([])
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
