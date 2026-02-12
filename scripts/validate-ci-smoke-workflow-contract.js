const { parseFileArg, readTextFile } = require('./validation-utils')
const { buildResult, emitResult } = require('./validator-output')
const { findMissingContractEntries } = require('./ci-smoke-workflow-contract')

const MISSING_ARTIFACT_NAME = 'CI_SMOKE_WORKFLOW_CONTRACT_MISSING_ARTIFACT_NAME'
const MISSING_ARTIFACT_PATH = 'CI_SMOKE_WORKFLOW_CONTRACT_MISSING_ARTIFACT_PATH'
const MISSING_STEP_ID = 'CI_SMOKE_WORKFLOW_CONTRACT_MISSING_STEP_ID'
const MISSING_OUTPUT_REF = 'CI_SMOKE_WORKFLOW_CONTRACT_MISSING_OUTPUT_REF'
const MISSING_SUMMARY_SETTING = 'CI_SMOKE_WORKFLOW_CONTRACT_MISSING_SUMMARY_SETTING'

const parseArgs = (argv) => {
  const args = {
    ...parseFileArg(argv, '.github/workflows/ci-smoke.yml'),
    output: 'text',
  }
  if (argv.includes('--json')) {
    args.output = 'json'
  }
  return args
}

const validateDetailed = (workflowContent) => {
  const missing = findMissingContractEntries(workflowContent)
  const errors = []

  missing.missingArtifactNames.forEach((artifactName) => {
    errors.push({
      code: MISSING_ARTIFACT_NAME,
      field: 'artifactName',
      message: `Missing required artifact name contract: ${artifactName}.`,
    })
  })

  missing.missingArtifactPaths.forEach((artifactPath) => {
    errors.push({
      code: MISSING_ARTIFACT_PATH,
      field: 'artifactPath',
      message: `Missing required artifact path contract: ${artifactPath}.`,
    })
  })

  missing.missingStepIds.forEach((stepId) => {
    errors.push({
      code: MISSING_STEP_ID,
      field: 'stepId',
      message: `Missing required workflow step id contract: ${stepId}.`,
    })
  })

  missing.missingOutputRefs.forEach((outputRef) => {
    errors.push({
      code: MISSING_OUTPUT_REF,
      field: 'outputRef',
      message: `Missing required artifact output reference contract: ${outputRef}.`,
    })
  })

  missing.missingSummarySettings.forEach((setting) => {
    errors.push({
      code: MISSING_SUMMARY_SETTING,
      field: 'summarySetting',
      message: `Missing required workflow summary setting contract: ${setting}.`,
    })
  })

  return {
    errors,
    missing,
  }
}

const validate = (workflowContent) => validateDetailed(workflowContent).errors.map((entry) => entry.message)

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const workflowContent = readTextFile(args.file, 'ci smoke workflow file')
    const validation = validateDetailed(workflowContent)
    const result = buildResult({
      file: args.file,
      errors: validation.errors,
      extra: {
        missing: validation.missing,
      },
    })
    const exitCode = emitResult({
      result,
      output: args.output,
      successMessage: 'CI smoke workflow contract validation: passed.',
      failurePrefix: 'CI smoke workflow contract validation',
    })
    process.exit(exitCode)
  } catch (error) {
    console.error(`CI smoke workflow contract validation failed: ${String(error?.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  validate,
  validateDetailed,
}
