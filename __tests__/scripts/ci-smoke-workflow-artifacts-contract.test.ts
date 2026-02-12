const fs = require('fs')
const path = require('path')

const workflowPath = path.resolve(__dirname, '..', '..', '.github', 'workflows', 'ci-smoke.yml')

describe('ci-smoke workflow artifact-name contract', () => {
  it('keeps incident and quality artifact names stable', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    const requiredArtifactNames = [
      'selective-decisions',
      'validator-contracts-summary-validation',
      'quality-summary',
      'ci-incident-snippet',
      'ci-incident-payload',
      'ci-incident-payload-validation',
    ]

    for (const artifactName of requiredArtifactNames) {
      expect(workflow).toContain(`name: ${artifactName}`)
    }

    expect(workflow).toContain('path: test-results/ci-incident-snippet.md')
    expect(workflow).toContain('path: test-results/ci-incident-payload.json')
    expect(workflow).toContain('path: test-results/ci-incident-payload-validation.json')
  })

  it('keeps critical upload step ids and artifact output references stable', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    const requiredStepIds = [
      'selective_decisions_upload',
      'validator_contracts_summary_validation_upload',
      'quality_summary_upload',
      'validator_guard_comment_upload',
    ]

    for (const stepId of requiredStepIds) {
      expect(workflow).toContain(`id: ${stepId}`)
    }

    const requiredOutputRefs = [
      'steps.selective_decisions_upload.outputs.artifact-id',
      'steps.validator_contracts_summary_validation_upload.outputs.artifact-id',
      'steps.quality_summary_upload.outputs.artifact-id',
      'steps.validator_guard_comment_upload.outputs.artifact-id',
    ]

    for (const outputRef of requiredOutputRefs) {
      expect(workflow).toContain(outputRef)
    }
  })
})
