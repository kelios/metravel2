const fs = require('fs')
const path = require('path')
const { makeTempDir, runNodeCli, writeJsonFile, writeTextFile } = require('./cli-test-utils')
const {
  parseArgs,
  readValidationFile,
  buildSummaryLines,
  appendStepSummary,
} = require('@/scripts/summarize-ci-incident-payload-validation')

describe('summarize-ci-incident-payload-validation', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/ci-incident-payload-validation.json',
      stepSummaryPath: '',
    })
    expect(parseArgs(['--file', 'tmp/a.json', '--step-summary-path', 'tmp/summary.md'])).toEqual({
      file: 'tmp/a.json',
      stepSummaryPath: 'tmp/summary.md',
    })
  })

  it('reads validation payload from file', () => {
    const dir = makeTempDir('incident-payload-summary-')
    const payloadFile = path.join(dir, 'validation.json')
    writeJsonFile(payloadFile, {
      ok: false,
      errorCount: 2,
      file: 'test-results/ci-incident-payload.json',
      errors: [
        { code: 'INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_URL', message: 'artifactUrl mismatch' },
      ],
    })

    const result = readValidationFile(payloadFile)
    expect(result.ok).toBe(true)
    expect(result.payload.ok).toBe(false)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('builds summary lines for payload and includes top errors', () => {
    const lines = buildSummaryLines({
      file: 'test-results/ci-incident-payload-validation.json',
      payload: {
        ok: false,
        errorCount: 2,
        file: 'test-results/ci-incident-payload.json',
        errors: [
          { code: 'INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_URL', message: 'artifactUrl mismatch' },
          { code: 'INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_SOURCE', message: 'artifactSource mismatch' },
        ],
      },
      missing: false,
      parseError: '',
    })

    expect(lines.join('\n')).toContain('### Incident Payload Validation')
    expect(lines.join('\n')).toContain('- OK: false')
    expect(lines.join('\n')).toContain('- Error count: 2')
    expect(lines.join('\n')).toContain('INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_URL')
  })

  it('builds summary for missing file', () => {
    const lines = buildSummaryLines({
      file: 'missing.json',
      payload: null,
      missing: true,
      parseError: '',
    })
    expect(lines.join('\n')).toContain('Result file not found')
  })

  it('appends summary to explicit step summary path', () => {
    const dir = makeTempDir('incident-payload-summary-')
    const stepSummaryPath = path.join(dir, 'summary.md')
    const appended = appendStepSummary({
      lines: ['### Incident Payload Validation', '- OK: true', ''],
      stepSummaryPath,
    })
    expect(appended).toBe(true)
    const markdown = fs.readFileSync(stepSummaryPath, 'utf8')
    expect(markdown).toContain('### Incident Payload Validation')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('writes summary to GITHUB_STEP_SUMMARY in cli mode', () => {
    const dir = makeTempDir('incident-payload-summary-')
    const payloadPath = path.join(dir, 'validation.json')
    const stepSummaryPath = path.join(dir, 'step-summary.md')

    writeJsonFile(payloadPath, {
      ok: false,
      errorCount: 1,
      file: 'test-results/ci-incident-payload.json',
      errors: [
        { code: 'INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_URL', message: 'artifactUrl mismatch' },
      ],
    })

    const result = runNodeCli([
      'scripts/summarize-ci-incident-payload-validation.js',
      '--file',
      payloadPath,
    ], {
      GITHUB_STEP_SUMMARY: stepSummaryPath,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('### Incident Payload Validation')
    const markdown = fs.readFileSync(stepSummaryPath, 'utf8')
    expect(markdown).toContain('- OK: false')
    expect(markdown).toContain('INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_URL')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('reports parse error in cli mode and writes it to step summary', () => {
    const dir = makeTempDir('incident-payload-summary-')
    const payloadPath = path.join(dir, 'validation-broken.json')
    const stepSummaryPath = path.join(dir, 'step-summary.md')

    writeTextFile(payloadPath, '{"ok":false,')

    const result = runNodeCli([
      'scripts/summarize-ci-incident-payload-validation.js',
      '--file',
      payloadPath,
    ], {
      GITHUB_STEP_SUMMARY: stepSummaryPath,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Failed to parse')
    const markdown = fs.readFileSync(stepSummaryPath, 'utf8')
    expect(markdown).toContain('Failed to parse')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('reports missing file in cli mode and writes it to step summary', () => {
    const dir = makeTempDir('incident-payload-summary-')
    const payloadPath = path.join(dir, 'missing-validation.json')
    const stepSummaryPath = path.join(dir, 'step-summary.md')

    const result = runNodeCli([
      'scripts/summarize-ci-incident-payload-validation.js',
      '--file',
      payloadPath,
    ], {
      GITHUB_STEP_SUMMARY: stepSummaryPath,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Result file not found')
    const markdown = fs.readFileSync(stepSummaryPath, 'utf8')
    expect(markdown).toContain('Result file not found')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
