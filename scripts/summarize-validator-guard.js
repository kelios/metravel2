const {
  readJsonFileWithStatus,
  emitLines,
  appendLinesToStepSummary,
} = require('./summary-utils')

const parseArgs = (argv) => {
  const args = {
    file: 'test-results/validator-guard.json',
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

const buildSummaryLines = ({ file, payload, missing, parseError }) => {
  if (missing) {
    return [
      '### Validator Guard Summary',
      `- Result file not found: \`${file}\``,
      '',
    ]
  }

  if (parseError) {
    return [
      '### Validator Guard Summary',
      `- Failed to parse \`${file}\`: ${parseError}`,
      '',
    ]
  }

  const ok = Boolean(payload?.ok)
  const missingCount = Number(payload?.missingCount || 0)
  const hintCount = Number(payload?.hintCount || 0)
  const touchedCount = Number(payload?.touchedCount || 0)
  const reason = String(payload?.reason || '').trim()
  const lines = [
    '### Validator Guard Summary',
    `- OK: ${ok}`,
    `- Touched files: ${touchedCount}`,
    `- Missing companions: ${missingCount}`,
    `- Hints: ${hintCount}`,
  ]
  if (reason) {
    lines.push(`- Reason: ${reason}`)
  }

  const hints = Array.isArray(payload?.hints) ? payload.hints : []
  if (hints.length > 0) {
    lines.push('- Top hints:')
    hints.slice(0, 3).forEach((hint) => lines.push(`  - ${String(hint)}`))
  }
  lines.push('')
  return lines
}

const emitSummary = (lines) => {
  emitLines(lines)
}

const appendSummary = ({ lines, stepSummaryPath }) => {
  return appendLinesToStepSummary({ lines, stepSummaryPath })
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const parsed = readJsonFileWithStatus(args.file)
  const lines = buildSummaryLines({
    file: args.file,
    payload: parsed.payload,
    missing: parsed.missing,
    parseError: parsed.parseError,
  })
  emitSummary(lines)
  appendSummary({ lines, stepSummaryPath: args.stepSummaryPath })
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  buildSummaryLines,
  emitSummary,
  appendSummary,
}
