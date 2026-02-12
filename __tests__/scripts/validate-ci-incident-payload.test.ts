const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  parseArgs,
  validate,
  validateDetailed,
} = require('@/scripts/validate-ci-incident-payload')

const validPayload = () => ({
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

  it('fails when selective contract uses artifactSource none', () => {
    const payload = validPayload()
    payload.artifactSource = 'none'
    payload.artifactUrl = ''
    payload.markdown = payload.markdown.replace(/^- Selective decisions artifact:.*$/m, '')
    const errors = validateDetailed(payload)
    expect(errors.some((entry) => entry.code === 'INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_SOURCE')).toBe(true)
  })

  it('fails when artifactUrl and source are inconsistent', () => {
    const payload = validPayload()
    payload.artifactSource = 'run_id'
    payload.artifactUrl = ''
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

  it('reads and validates payload file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-incident-payload-'))
    const payloadPath = path.join(dir, 'payload.json')
    fs.writeFileSync(payloadPath, JSON.stringify(validPayload()), 'utf8')
    const loaded = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
    expect(validate(loaded)).toEqual([])
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
