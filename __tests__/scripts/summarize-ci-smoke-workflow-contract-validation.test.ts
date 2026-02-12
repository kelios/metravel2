const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const {
  ACTION_HINT_RULES,
  parseArgs,
  readValidationFile,
  buildSummaryLines,
  buildActionHints,
  appendStepSummary,
} = require('@/scripts/summarize-ci-smoke-workflow-contract-validation')

describe('summarize-ci-smoke-workflow-contract-validation', () => {
  it('parses args with defaults and overrides', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/ci-smoke-workflow-contract-validation.json',
      stepSummaryPath: '',
      maxItems: 5,
    })
    expect(parseArgs(['--file', 'tmp/a.json', '--step-summary-path', 'tmp/summary.md', '--max-items', '5'])).toEqual({
      file: 'tmp/a.json',
      stepSummaryPath: 'tmp/summary.md',
      maxItems: 5,
    })
    expect(parseArgs(['--max-items', '0']).maxItems).toBe(5)
  })

  it('reads validation payload from file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-contract-summary-'))
    const payloadFile = path.join(dir, 'validation.json')
    fs.writeFileSync(payloadFile, JSON.stringify({
      ok: false,
      errorCount: 1,
      file: '.github/workflows/ci-smoke.yml',
      missing: {
        missingArtifactNames: ['quality-summary'],
        missingArtifactPaths: [],
        missingStepIds: [],
        missingOutputRefs: [],
        missingSummarySettings: ['--max-items "$CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS"'],
      },
      errors: [
        { code: 'CI_SMOKE_WORKFLOW_CONTRACT_MISSING_ARTIFACT_NAME', message: 'missing quality-summary' },
      ],
    }), 'utf8')

    const result = readValidationFile(payloadFile)
    expect(result.ok).toBe(true)
    expect(result.payload.ok).toBe(false)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('builds summary lines for payload and includes top errors', () => {
    const lines = buildSummaryLines({
      file: 'test-results/ci-smoke-workflow-contract-validation.json',
      payload: {
        ok: false,
        errorCount: 2,
        file: '.github/workflows/ci-smoke.yml',
        missing: {
          missingArtifactNames: ['quality-summary', 'ci-incident-payload', 'ci-incident-snippet'],
          missingArtifactPaths: ['path: test-results/quality-summary.json', 'path: test-results/ci-incident-payload.json'],
          missingStepIds: ['quality_summary_upload'],
          missingOutputRefs: ['steps.quality_summary_upload.outputs.artifact-id'],
          missingSummarySettings: ['--max-items "$CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS"'],
        },
        errors: [
          { code: 'CI_SMOKE_WORKFLOW_CONTRACT_MISSING_ARTIFACT_NAME', message: 'missing quality-summary' },
          { code: 'CI_SMOKE_WORKFLOW_CONTRACT_MISSING_ARTIFACT_PATH', message: 'missing path' },
        ],
      },
      missing: false,
      parseError: '',
      maxItems: 2,
    })

    expect(lines.join('\n')).toContain('### CI Smoke Workflow Contract Validation')
    expect(lines.join('\n')).toContain('- OK: false')
    expect(lines.join('\n')).toContain('- Missing artifact names: 3')
    expect(lines.join('\n')).toContain('CI_SMOKE_WORKFLOW_CONTRACT_MISSING_ARTIFACT_NAME')
    expect(lines.join('\n')).toContain('- Top missing artifact names:')
    expect(lines.join('\n')).toContain('- ... and 1 more')
    expect(lines.join('\n')).toContain('- Top missing artifact paths:')
    expect(lines.join('\n')).toContain('- Top missing step ids:')
    expect(lines.join('\n')).toContain('- Top missing output refs:')
    expect(lines.join('\n')).toContain('- Missing summary settings: 1')
    expect(lines.join('\n')).toContain('- Top missing summary settings:')
    expect(lines.join('\n')).toContain('- Action hints:')
    expect(lines.join('\n')).toContain('[P1] Restore CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS')
    expect(lines.join('\n')).toContain('[P1] Fix outputs.artifact-id references')
  })

  it('builds actionable hints for missing groups', () => {
    const hints = buildActionHints({
      missingArtifactNames: ['quality-summary'],
      missingArtifactPaths: ['path: test-results/quality-summary.json'],
      missingStepIds: ['quality_summary_upload'],
      missingOutputRefs: ['steps.quality_summary_upload.outputs.artifact-id'],
      missingSummarySettings: ['CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS: "5"'],
    })

    expect(hints.length).toBe(5)
    expect(hints[0]).toContain('[P1] Restore CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS')
    expect(hints[1]).toContain('[P1] Fix outputs.artifact-id references')
    expect(hints[2]).toContain('[P2] Revert step id changes')
    expect(hints[3]).toContain('[P2] Restore missing artifact names')
    expect(hints[4]).toContain('[P3] Align upload artifact paths')
  })

  it('keeps action hint rules ordered and stable', () => {
    expect(ACTION_HINT_RULES.map((entry) => `${entry.priority}:${entry.key}:${entry.severity}`)).toEqual([
      '1:missingSummarySettings:P1',
      '2:missingOutputRefs:P1',
      '3:missingStepIds:P2',
      '4:missingArtifactNames:P2',
      '5:missingArtifactPaths:P3',
    ])
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-contract-summary-'))
    const stepSummaryPath = path.join(dir, 'summary.md')
    const appended = appendStepSummary({
      lines: ['### CI Smoke Workflow Contract Validation', '- OK: true', ''],
      stepSummaryPath,
    })
    expect(appended).toBe(true)
    const markdown = fs.readFileSync(stepSummaryPath, 'utf8')
    expect(markdown).toContain('### CI Smoke Workflow Contract Validation')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('writes summary to GITHUB_STEP_SUMMARY in cli mode', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-contract-summary-'))
    const payloadPath = path.join(dir, 'validation.json')
    const stepSummaryPath = path.join(dir, 'step-summary.md')

    fs.writeFileSync(payloadPath, JSON.stringify({
      ok: false,
      errorCount: 1,
      file: '.github/workflows/ci-smoke.yml',
      missing: {
        missingArtifactNames: ['quality-summary'],
        missingArtifactPaths: [],
        missingStepIds: [],
        missingOutputRefs: [],
        missingSummarySettings: ['CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS: "5"'],
      },
      errors: [
        { code: 'CI_SMOKE_WORKFLOW_CONTRACT_MISSING_ARTIFACT_NAME', message: 'missing quality-summary' },
      ],
    }), 'utf8')

    const result = spawnSync(process.execPath, [
      'scripts/summarize-ci-smoke-workflow-contract-validation.js',
      '--file',
      payloadPath,
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: stepSummaryPath,
      },
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('### CI Smoke Workflow Contract Validation')
    const markdown = fs.readFileSync(stepSummaryPath, 'utf8')
    expect(markdown).toContain('- OK: false')
    expect(markdown).toContain('CI_SMOKE_WORKFLOW_CONTRACT_MISSING_ARTIFACT_NAME')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
