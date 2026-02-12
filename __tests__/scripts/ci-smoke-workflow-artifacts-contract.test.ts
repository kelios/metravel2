const fs = require('fs')
const path = require('path')
const {
  CI_SMOKE_WORKFLOW_ARTIFACT_NAMES,
  CI_SMOKE_WORKFLOW_STEP_IDS,
  CI_SMOKE_WORKFLOW_ARTIFACT_OUTPUT_REFS,
  CI_SMOKE_WORKFLOW_ARTIFACT_PATHS,
  CI_SMOKE_WORKFLOW_SUMMARY_SETTING_CONTRACTS,
  findMissingContractEntries,
} = require('@/scripts/ci-smoke-workflow-contract')

const workflowPath = path.resolve(__dirname, '..', '..', '.github', 'workflows', 'ci-smoke.yml')

describe('ci-smoke workflow artifact-name contract', () => {
  it('keeps incident and quality artifact names stable', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')

    for (const artifactName of CI_SMOKE_WORKFLOW_ARTIFACT_NAMES) {
      expect(workflow).toContain(`name: ${artifactName}`)
    }

    for (const artifactPath of CI_SMOKE_WORKFLOW_ARTIFACT_PATHS) {
      expect(workflow).toContain(artifactPath)
    }
  })

  it('keeps critical upload step ids and artifact output references stable', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')

    for (const stepId of CI_SMOKE_WORKFLOW_STEP_IDS) {
      expect(workflow).toContain(`id: ${stepId}`)
    }

    for (const outputRef of CI_SMOKE_WORKFLOW_ARTIFACT_OUTPUT_REFS) {
      expect(workflow).toContain(outputRef)
    }
  })

  it('keeps summary max-items workflow settings stable', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    for (const setting of CI_SMOKE_WORKFLOW_SUMMARY_SETTING_CONTRACTS) {
      expect(workflow).toContain(setting)
    }
  })

  it('detects missing entries on broken workflow fixture', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    const brokenWorkflow = workflow
      .replace('name: ci-incident-payload-validation', 'name: incident-validation-missing-contract')
      .replace('id: quality_summary_upload', 'id: quality_summary_changed')
      .replace(
        'steps.validator_contracts_summary_validation_upload.outputs.artifact-id',
        'steps.validator_contracts_summary_validation_upload.outputs.other-output'
      )
      .replace('--max-items "$CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS"', '--max-items "$OTHER_SETTING"')

    const missing = findMissingContractEntries(brokenWorkflow)
    expect(missing.missingArtifactNames).toContain('ci-incident-payload-validation')
    expect(missing.missingStepIds).toContain('quality_summary_upload')
    expect(missing.missingOutputRefs).toContain(
      'steps.validator_contracts_summary_validation_upload.outputs.artifact-id'
    )
    expect(missing.missingSummarySettings).toContain('--max-items "$CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS"')
  })

  it('returns empty missing lists for current workflow', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    const missing = findMissingContractEntries(workflow)

    expect(missing.missingArtifactNames).toEqual([])
    expect(missing.missingArtifactPaths).toEqual([])
    expect(missing.missingStepIds).toEqual([])
    expect(missing.missingOutputRefs).toEqual([])
    expect(missing.missingSummarySettings).toEqual([])
  })
})
