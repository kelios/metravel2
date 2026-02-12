const CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS = 5

const CI_SMOKE_WORKFLOW_ARTIFACT_NAMES = Object.freeze([
  'runtime-config-diagnostics',
  'selective-decisions',
  'validator-contracts-summary-validation',
  'quality-summary',
  'ci-smoke-workflow-contract-validation',
  'ci-incident-snippet',
  'ci-incident-payload',
  'ci-incident-payload-validation',
])

const CI_SMOKE_WORKFLOW_STEP_IDS = Object.freeze([
  'runtime_config_diagnostics_upload',
  'selective_decisions_upload',
  'validator_contracts_summary_validation_upload',
  'quality_summary_upload',
  'validator_guard_comment_upload',
])

const CI_SMOKE_WORKFLOW_ARTIFACT_OUTPUT_REFS = Object.freeze([
  'steps.selective_decisions_upload.outputs.artifact-id',
  'steps.validator_contracts_summary_validation_upload.outputs.artifact-id',
  'steps.quality_summary_upload.outputs.artifact-id',
  'steps.validator_guard_comment_upload.outputs.artifact-id',
])

const CI_SMOKE_WORKFLOW_ARTIFACT_PATHS = Object.freeze([
  'path: test-results/runtime-config-diagnostics.json',
  'path: test-results/ci-incident-snippet.md',
  'path: test-results/ci-incident-payload.json',
  'path: test-results/ci-incident-payload-validation.json',
  'path: test-results/ci-smoke-workflow-contract-validation.json',
])

const CI_SMOKE_WORKFLOW_SUMMARY_SETTING_CONTRACTS = Object.freeze([
  `CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS: "${CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS}"`,
  '--max-items "$CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS"',
])

function findMissingContractEntries(workflowContent) {
  const workflow = String(workflowContent || '')
  const missingArtifactNames = CI_SMOKE_WORKFLOW_ARTIFACT_NAMES.filter((name) => !workflow.includes(`name: ${name}`))
  const missingArtifactPaths = CI_SMOKE_WORKFLOW_ARTIFACT_PATHS.filter((pathEntry) => !workflow.includes(pathEntry))
  const missingStepIds = CI_SMOKE_WORKFLOW_STEP_IDS.filter((stepId) => !workflow.includes(`id: ${stepId}`))
  const missingOutputRefs = CI_SMOKE_WORKFLOW_ARTIFACT_OUTPUT_REFS.filter((outputRef) => !workflow.includes(outputRef))
  const missingSummarySettings = CI_SMOKE_WORKFLOW_SUMMARY_SETTING_CONTRACTS.filter((entry) => !workflow.includes(entry))

  return {
    missingArtifactNames,
    missingArtifactPaths,
    missingStepIds,
    missingOutputRefs,
    missingSummarySettings,
  }
}

module.exports = {
  CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS,
  CI_SMOKE_WORKFLOW_ARTIFACT_NAMES,
  CI_SMOKE_WORKFLOW_STEP_IDS,
  CI_SMOKE_WORKFLOW_ARTIFACT_OUTPUT_REFS,
  CI_SMOKE_WORKFLOW_ARTIFACT_PATHS,
  CI_SMOKE_WORKFLOW_SUMMARY_SETTING_CONTRACTS,
  findMissingContractEntries,
}
