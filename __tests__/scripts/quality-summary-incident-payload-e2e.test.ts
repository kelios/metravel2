import fs from 'fs'
import path from 'path'
import { makeTempDir, runNodeCli, writeJsonFile } from './cli-test-utils'

const summarizeQualityGateScript = path.resolve(process.cwd(), 'scripts/summarize-quality-gate.js')
const validateQualitySummaryScript = path.resolve(process.cwd(), 'scripts/validate-quality-summary.js')
const publishIncidentScript = path.resolve(process.cwd(), 'scripts/publish-ci-incident-snippet.js')
const validateIncidentPayloadScript = path.resolve(process.cwd(), 'scripts/validate-ci-incident-payload.js')

describe('quality-summary -> incident payload e2e contract', () => {
  it('keeps contracts consistent for config_contract escalation path', () => {
    const dir = makeTempDir('quality-incident-e2e-')
    const eslintPath = path.join(dir, 'eslint-pass.json')
    const jestPath = path.join(dir, 'jest-pass.json')
    const runtimeDiagnosticsPath = path.join(dir, 'runtime-config-diagnostics.json')
    const qualitySummaryPath = path.join(dir, 'quality-summary.json')
    const incidentSnippetPath = path.join(dir, 'ci-incident-snippet.md')
    const incidentPayloadPath = path.join(dir, 'ci-incident-payload.json')

    writeJsonFile(eslintPath, [{ filePath: '/tmp/a.ts', errorCount: 0, warningCount: 0 }])
    writeJsonFile(jestPath, {
      numTotalTestSuites: 1,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numFailedTests: 0,
      testResults: [{ name: `${process.cwd()}/__tests__/scripts/validate-quality-summary.test.ts`, startTime: 0, endTime: 500 }],
    })
    writeJsonFile(runtimeDiagnosticsPath, {
      schemaVersion: 1,
      ok: false,
      errorCount: 1,
      warningCount: 0,
      diagnostics: [{ code: 'API_URL_MISSING', severity: 'error', message: 'missing API_URL' }],
    })

    const summarize = runNodeCli([
      summarizeQualityGateScript,
      eslintPath,
      jestPath,
      '--fail-on-missing',
      '--runtime-config-diagnostics-file',
      runtimeDiagnosticsPath,
      '--json-output',
      qualitySummaryPath,
    ])
    expect(summarize.status).toBe(0)
    expect(summarize.stdout).toContain('Failure Class: config_contract')
    expect(summarize.stdout).toContain('Recommendation ID: QG-009')

    const validateSummary = runNodeCli([validateQualitySummaryScript, qualitySummaryPath])
    expect(validateSummary.status).toBe(0)
    expect(validateSummary.stdout).toContain('quality-summary validation passed.')

    const publish = runNodeCli(
      [
        publishIncidentScript,
        '--summary-file',
        qualitySummaryPath,
        '--output-file',
        incidentSnippetPath,
        '--workflow-run',
        'https://github.com/org/repo/actions/runs/123',
        '--branch-pr',
        'https://github.com/org/repo/pull/42',
        '--runtime-artifact-id',
        '321',
        '--json',
      ],
      { LINT_RESULT: 'success', SMOKE_RESULT: 'success' },
    )
    expect(publish.status).toBe(0)

    const payload = JSON.parse(publish.stdout)
    writeJsonFile(incidentPayloadPath, payload)

    expect(payload.failureClass).toBe('config_contract')
    expect(payload.recommendationId).toBe('QG-009')
    expect(payload.primaryArtifactKind).toBe('runtime_config_diagnostics')
    expect(payload.runtimeArtifactSource).toBe('run_id')
    expect(payload.runtimeArtifactUrl).toBe('https://github.com/org/repo/actions/runs/123/artifacts/321')
    expect(String(payload.markdown)).toContain('- Runtime config diagnostics artifact: https://github.com/org/repo/actions/runs/123/artifacts/321')

    const validatePayload = runNodeCli([validateIncidentPayloadScript, '--file', incidentPayloadPath])
    expect(validatePayload.status).toBe(0)
    expect(validatePayload.stdout).toContain('CI incident payload validation: passed.')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('keeps contracts consistent for validator_contract escalation path', () => {
    const dir = makeTempDir('quality-incident-e2e-')
    const eslintPath = path.join(dir, 'eslint-pass.json')
    const jestPath = path.join(dir, 'jest-pass.json')
    const validatorContractsSummaryValidationPath = path.join(dir, 'validator-contracts-summary-validation.json')
    const qualitySummaryPath = path.join(dir, 'quality-summary.json')
    const incidentSnippetPath = path.join(dir, 'ci-incident-snippet.md')
    const incidentPayloadPath = path.join(dir, 'ci-incident-payload.json')

    writeJsonFile(eslintPath, [{ filePath: '/tmp/a.ts', errorCount: 0, warningCount: 0 }])
    writeJsonFile(jestPath, {
      numTotalTestSuites: 1,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numFailedTests: 0,
      testResults: [{ name: `${process.cwd()}/__tests__/scripts/validate-quality-summary.test.ts`, startTime: 0, endTime: 500 }],
    })
    writeJsonFile(validatorContractsSummaryValidationPath, {
      contractVersion: 1,
      ok: false,
      errorCount: 1,
      errors: [{ code: 'VALIDATOR_CONTRACTS_SUMMARY_STATUS_MISMATCH' }],
    })

    const summarize = runNodeCli([
      summarizeQualityGateScript,
      eslintPath,
      jestPath,
      '--fail-on-missing',
      '--validator-contracts-summary-validation-file',
      validatorContractsSummaryValidationPath,
      '--json-output',
      qualitySummaryPath,
    ])
    expect(summarize.status).toBe(0)
    expect(summarize.stdout).toContain('Failure Class: validator_contract')
    expect(summarize.stdout).toContain('Recommendation ID: QG-008')

    const validateSummary = runNodeCli([validateQualitySummaryScript, qualitySummaryPath])
    expect(validateSummary.status).toBe(0)
    expect(validateSummary.stdout).toContain('quality-summary validation passed.')

    const publish = runNodeCli(
      [
        publishIncidentScript,
        '--summary-file',
        qualitySummaryPath,
        '--output-file',
        incidentSnippetPath,
        '--workflow-run',
        'https://github.com/org/repo/actions/runs/123',
        '--branch-pr',
        'https://github.com/org/repo/pull/42',
        '--validator-artifact-id',
        '654',
        '--json',
      ],
      { LINT_RESULT: 'success', SMOKE_RESULT: 'success' },
    )
    expect(publish.status).toBe(0)

    const payload = JSON.parse(publish.stdout)
    writeJsonFile(incidentPayloadPath, payload)

    expect(payload.failureClass).toBe('validator_contract')
    expect(payload.recommendationId).toBe('QG-008')
    expect(payload.primaryArtifactKind).toBe('validator_contracts')
    expect(payload.validatorArtifactSource).toBe('run_id')
    expect(payload.validatorArtifactUrl).toBe('https://github.com/org/repo/actions/runs/123/artifacts/654')
    expect(String(payload.markdown)).toContain('- Validator contracts artifact: https://github.com/org/repo/actions/runs/123/artifacts/654')

    const validatePayload = runNodeCli([validateIncidentPayloadScript, '--file', incidentPayloadPath])
    expect(validatePayload.status).toBe(0)
    expect(validatePayload.stdout).toContain('CI incident payload validation: passed.')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('keeps contracts consistent for selective_contract escalation path', () => {
    const dir = makeTempDir('quality-incident-e2e-')
    const eslintPath = path.join(dir, 'eslint-pass.json')
    const jestPath = path.join(dir, 'jest-pass.json')
    const selectiveDecisionsPath = path.join(dir, 'selective-decisions.json')
    const qualitySummaryPath = path.join(dir, 'quality-summary.json')
    const incidentSnippetPath = path.join(dir, 'ci-incident-snippet.md')
    const incidentPayloadPath = path.join(dir, 'ci-incident-payload.json')

    writeJsonFile(eslintPath, [{ filePath: '/tmp/a.ts', errorCount: 0, warningCount: 0 }])
    writeJsonFile(jestPath, {
      numTotalTestSuites: 1,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numFailedTests: 0,
      testResults: [{ name: `${process.cwd()}/__tests__/scripts/validate-quality-summary.test.ts`, startTime: 0, endTime: 500 }],
    })
    writeJsonFile(selectiveDecisionsPath, {
      schemaVersion: 2,
      decisions: [],
      warnings: [],
    })

    const summarize = runNodeCli([
      summarizeQualityGateScript,
      eslintPath,
      jestPath,
      '--fail-on-missing',
      '--selective-decisions-file',
      selectiveDecisionsPath,
      '--json-output',
      qualitySummaryPath,
    ])
    expect(summarize.status).toBe(0)
    expect(summarize.stdout).toContain('Failure Class: selective_contract')
    expect(summarize.stdout).toContain('Recommendation ID: QG-007')

    const validateSummary = runNodeCli([validateQualitySummaryScript, qualitySummaryPath])
    expect(validateSummary.status).toBe(0)
    expect(validateSummary.stdout).toContain('quality-summary validation passed.')

    const publish = runNodeCli(
      [
        publishIncidentScript,
        '--summary-file',
        qualitySummaryPath,
        '--output-file',
        incidentSnippetPath,
        '--workflow-run',
        'https://github.com/org/repo/actions/runs/123',
        '--branch-pr',
        'https://github.com/org/repo/pull/42',
        '--artifact-id',
        '987',
        '--json',
      ],
      { LINT_RESULT: 'success', SMOKE_RESULT: 'success' },
    )
    expect(publish.status).toBe(0)

    const payload = JSON.parse(publish.stdout)
    writeJsonFile(incidentPayloadPath, payload)

    expect(payload.failureClass).toBe('selective_contract')
    expect(payload.recommendationId).toBe('QG-007')
    expect(payload.primaryArtifactKind).toBe('selective_decisions')
    expect(payload.artifactSource).toBe('run_id')
    expect(payload.artifactUrl).toBe('https://github.com/org/repo/actions/runs/123/artifacts/987')
    expect(String(payload.markdown)).toContain('- Selective decisions artifact: https://github.com/org/repo/actions/runs/123/artifacts/987')

    const validatePayload = runNodeCli([validateIncidentPayloadScript, '--file', incidentPayloadPath])
    expect(validatePayload.status).toBe(0)
    expect(validatePayload.stdout).toContain('CI incident payload validation: passed.')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
