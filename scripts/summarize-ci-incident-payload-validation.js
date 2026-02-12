const {
  readJsonFileWithStatus,
  emitLines,
  appendLinesToStepSummary,
} = require('./summary-utils')

const parseArgs = (argv) => {
  const args = {
    file: 'test-results/ci-incident-payload-validation.json',
    stepSummaryPath: '',
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
  }
  return args
}

const readValidationFile = (filePath) => {
  return readJsonFileWithStatus(filePath)
}

const buildSummaryLines = ({ file, payload, missing, parseError }) => {
  if (missing) {
    return [
      '### Incident Payload Validation',
      `- Result file not found: \`${file}\``,
      '',
    ]
  }

  if (parseError) {
    return [
      '### Incident Payload Validation',
      `- Failed to parse \`${file}\`: ${parseError}`,
      '',
    ]
  }

  const ok = Boolean(payload?.ok)
  const errorCount = Number(payload?.errorCount || 0)
  const resolvedFile = String(payload?.file || file).trim() || file
  const lines = [
    '### Incident Payload Validation',
    `- OK: ${ok}`,
    `- Error count: ${errorCount}`,
    `- File: ${resolvedFile}`,
  ]

  const errors = Array.isArray(payload?.errors) ? payload.errors : []
  if (errors.length > 0) {
    lines.push('- Top errors:')
    errors.slice(0, 3).forEach((entry) => {
      const code = String(entry?.code || 'VALIDATION_ERROR')
      const message = String(entry?.message || 'Validation error')
      lines.push(`  - ${code}: ${message}`)
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
  })
  emitSummary({ lines })
  appendStepSummary({ lines, stepSummaryPath: args.stepSummaryPath })
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  readValidationFile,
  buildSummaryLines,
  appendStepSummary,
  emitSummary,
}
