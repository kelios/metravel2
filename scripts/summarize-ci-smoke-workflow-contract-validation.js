const {
  readJsonFileWithStatus,
  emitLines,
  appendLinesToStepSummary,
} = require('./summary-utils')
const { CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS } = require('./ci-smoke-workflow-contract')

const ACTION_HINT_RULES = Object.freeze([
  {
    key: 'missingSummarySettings',
    priority: 1,
    severity: 'P1',
    text: 'Restore CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS and --max-items wiring in workflow summary command.',
  },
  {
    key: 'missingOutputRefs',
    priority: 2,
    severity: 'P1',
    text: 'Fix outputs.artifact-id references so artifact URLs can be derived correctly in follow-up steps.',
  },
  {
    key: 'missingStepIds',
    priority: 3,
    severity: 'P2',
    text: 'Revert step id changes or update downstream references that depend on those ids.',
  },
  {
    key: 'missingArtifactNames',
    priority: 4,
    severity: 'P2',
    text: 'Restore missing artifact names in upload/download steps to keep CI artifact contracts stable.',
  },
  {
    key: 'missingArtifactPaths',
    priority: 5,
    severity: 'P3',
    text: 'Align upload artifact paths with expected test-results snapshot file locations.',
  },
])

const parseArgs = (argv) => {
  const args = {
    file: 'test-results/ci-smoke-workflow-contract-validation.json',
    stepSummaryPath: '',
    maxItems: CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--file' && argv[i + 1]) {
      args.file = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--step-summary-path' && argv[i + 1]) {
      args.stepSummaryPath = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--max-items' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10)
      args.maxItems = Number.isInteger(parsed) && parsed > 0
        ? parsed
        : CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS
      i += 1
      continue
    }
  }
  return args
}

const readValidationFile = (filePath) => {
  return readJsonFileWithStatus(filePath)
}

const appendTopMissingGroup = ({ lines, label, values, maxItems }) => {
  if (!Array.isArray(values) || values.length === 0) return
  lines.push(`- Top ${label}:`)
  values.slice(0, maxItems).forEach((value) => {
    lines.push(`  - ${String(value)}`)
  })
  const remaining = values.length - Math.min(values.length, maxItems)
  if (remaining > 0) {
    lines.push(`  - ... and ${remaining} more`)
  }
}

const buildActionHints = ({
  missingArtifactNames,
  missingArtifactPaths,
  missingStepIds,
  missingOutputRefs,
  missingSummarySettings,
}) => {
  const groups = {
    missingArtifactNames,
    missingArtifactPaths,
    missingStepIds,
    missingOutputRefs,
    missingSummarySettings,
  }
  return ACTION_HINT_RULES
    .filter((rule) => Array.isArray(groups[rule.key]) && groups[rule.key].length > 0)
    .sort((a, b) => a.priority - b.priority)
    .map((rule) => `[${rule.severity}] ${rule.text}`)
}

const buildSummaryLines = ({
  file,
  payload,
  missing,
  parseError,
  maxItems = CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS,
}) => {
  if (missing) {
    return [
      '### CI Smoke Workflow Contract Validation',
      `- Result file not found: \`${file}\``,
      '',
    ]
  }

  if (parseError) {
    return [
      '### CI Smoke Workflow Contract Validation',
      `- Failed to parse \`${file}\`: ${parseError}`,
      '',
    ]
  }

  const ok = Boolean(payload?.ok)
  const errorCount = Number(payload?.errorCount || 0)
  const resolvedFile = String(payload?.file || file).trim() || file
  const missingEntries = payload?.missing || {}
  const missingArtifactNames = Array.isArray(missingEntries.missingArtifactNames) ? missingEntries.missingArtifactNames : []
  const missingArtifactPaths = Array.isArray(missingEntries.missingArtifactPaths) ? missingEntries.missingArtifactPaths : []
  const missingStepIds = Array.isArray(missingEntries.missingStepIds) ? missingEntries.missingStepIds : []
  const missingOutputRefs = Array.isArray(missingEntries.missingOutputRefs) ? missingEntries.missingOutputRefs : []
  const missingSummarySettings = Array.isArray(missingEntries.missingSummarySettings) ? missingEntries.missingSummarySettings : []

  const lines = [
    '### CI Smoke Workflow Contract Validation',
    `- OK: ${ok}`,
    `- Error count: ${errorCount}`,
    `- File: ${resolvedFile}`,
    `- Missing artifact names: ${missingArtifactNames.length}`,
    `- Missing artifact paths: ${missingArtifactPaths.length}`,
    `- Missing step ids: ${missingStepIds.length}`,
    `- Missing output refs: ${missingOutputRefs.length}`,
    `- Missing summary settings: ${missingSummarySettings.length}`,
  ]

  const errors = Array.isArray(payload?.errors) ? payload.errors : []
  if (errors.length > 0) {
    lines.push('- Top errors:')
    errors.slice(0, maxItems).forEach((entry) => {
      const code = String(entry?.code || 'VALIDATION_ERROR')
      const message = String(entry?.message || 'Validation error')
      lines.push(`  - ${code}: ${message}`)
    })
  }

  appendTopMissingGroup({
    lines,
    label: 'missing artifact names',
    values: missingArtifactNames,
    maxItems,
  })
  appendTopMissingGroup({
    lines,
    label: 'missing artifact paths',
    values: missingArtifactPaths,
    maxItems,
  })
  appendTopMissingGroup({
    lines,
    label: 'missing step ids',
    values: missingStepIds,
    maxItems,
  })
  appendTopMissingGroup({
    lines,
    label: 'missing output refs',
    values: missingOutputRefs,
    maxItems,
  })
  appendTopMissingGroup({
    lines,
    label: 'missing summary settings',
    values: missingSummarySettings,
    maxItems,
  })

  const actionHints = buildActionHints({
    missingArtifactNames,
    missingArtifactPaths,
    missingStepIds,
    missingOutputRefs,
    missingSummarySettings,
  })
  if (actionHints.length > 0) {
    lines.push('- Action hints:')
    actionHints.slice(0, maxItems).forEach((hint) => {
      lines.push(`  - ${hint}`)
    })
  }

  lines.push('')
  return lines
}

const appendStepSummary = ({ lines, stepSummaryPath }) => {
  return appendLinesToStepSummary({ lines, stepSummaryPath })
}

const emitSummary = ({ lines }) => {
  emitLines(lines)
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const validation = readValidationFile(args.file)
  const lines = buildSummaryLines({
    file: args.file,
    payload: validation.payload,
    missing: validation.missing,
    parseError: validation.parseError,
    maxItems: args.maxItems,
  })
  emitSummary({ lines })
  appendStepSummary({ lines, stepSummaryPath: args.stepSummaryPath })
}

if (require.main === module) {
  main()
}

module.exports = {
  ACTION_HINT_RULES,
  parseArgs,
  readValidationFile,
  buildSummaryLines,
  appendTopMissingGroup,
  buildActionHints,
  appendStepSummary,
  emitSummary,
}
