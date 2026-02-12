const fs = require('fs')
const os = require('os')
const path = require('path')
const { runNodeCli, writeTextFile } = require('./cli-test-utils')
const {
  parseArgs,
  validate,
  validateDetailed,
} = require('@/scripts/validate-ci-smoke-workflow-contract')

const workflowPath = path.resolve(process.cwd(), '.github', 'workflows', 'ci-smoke.yml')

describe('validate-ci-smoke-workflow-contract', () => {
  it('parses default and override file args', () => {
    expect(parseArgs([])).toEqual({
      file: '.github/workflows/ci-smoke.yml',
      output: 'text',
    })
    expect(parseArgs(['--file', 'tmp/workflow.yml'])).toEqual({
      file: 'tmp/workflow.yml',
      output: 'text',
    })
    expect(parseArgs(['--json'])).toEqual({
      file: '.github/workflows/ci-smoke.yml',
      output: 'json',
    })
  })

  it('passes for current workflow', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    expect(validate(workflow)).toEqual([])
  })

  it('reports missing entries for broken workflow', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    const brokenWorkflow = workflow
      .replace('name: ci-incident-payload-validation', 'name: incident-validation-missing-contract')
      .replace('id: quality_summary_upload', 'id: quality_summary_changed')
      .replace(
        'steps.validator_contracts_summary_validation_upload.outputs.artifact-id',
        'steps.validator_contracts_summary_validation_upload.outputs.other-output'
      )
      .replace('--max-items "$CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS"', '--max-items "$OTHER_SETTING"')

    const result = validateDetailed(brokenWorkflow)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.missing.missingArtifactNames).toContain('ci-incident-payload-validation')
    expect(result.missing.missingStepIds).toContain('quality_summary_upload')
    expect(result.missing.missingOutputRefs).toContain(
      'steps.validator_contracts_summary_validation_upload.outputs.artifact-id'
    )
    expect(result.missing.missingSummarySettings).toContain('--max-items "$CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS"')
  })

  it('emits json payload contract from cli', () => {
    const result = runNodeCli(['scripts/validate-ci-smoke-workflow-contract.js', '--json'])
    expect(result.status).toBe(0)

    const payload = JSON.parse(result.stdout)
    expect(payload.contractVersion).toBe(1)
    expect(payload.ok).toBe(true)
    expect(payload.errorCount).toBe(0)
    expect(payload.file).toBe('.github/workflows/ci-smoke.yml')
    expect(payload.missing).toEqual({
      missingArtifactNames: [],
      missingArtifactPaths: [],
      missingStepIds: [],
      missingOutputRefs: [],
      missingSummarySettings: [],
    })
  })

  it('fails with json payload for broken workflow file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-ci-smoke-workflow-contract-'))
    const file = path.join(dir, 'ci-smoke.yml')
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    const brokenWorkflow = workflow.replace('name: quality-summary', 'name: quality-aggregate-broken')
    writeTextFile(file, brokenWorkflow)

    const result = runNodeCli([
      'scripts/validate-ci-smoke-workflow-contract.js',
      '--file',
      file,
      '--json',
    ])

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.ok).toBe(false)
    expect(payload.errorCount).toBeGreaterThan(0)
    expect(payload.missing.missingArtifactNames).toContain('quality-summary')

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
