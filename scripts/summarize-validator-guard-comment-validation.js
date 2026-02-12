const { readJsonFileWithStatus, emitLines, appendLinesToStepSummary } = require('./summary-utils')

const parseArgs = (argv) => {
  const args = {
    file: 'test-results/validator-guard-comment-validation.json',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--file' && argv[i + 1]) {
      args.file = argv[i + 1]
      i += 1
    }
  }
  return args
}

const toList = (value) => (Array.isArray(value) ? value : [])

const buildSummaryLines = ({ file, payload, missing, parseError }) => {
  if (missing) {
    return [
      '### Validator Guard Comment Validation',
      '- Status: warning',
      `- Validation payload not found: \`${file}\``,
      '',
    ]
  }

  if (parseError) {
    return [
      '### Validator Guard Comment Validation',
      '- Status: warning',
      `- Failed to parse validation payload: ${parseError}`,
      '',
    ]
  }

  const ok = Boolean(payload?.ok)
  const errorCount = Number(payload?.errorCount || 0)
  const errors = toList(payload?.errors)
  const codes = [...new Set(errors.map((entry) => String(entry?.code || '').trim()).filter(Boolean))]

  const lines = [
    '### Validator Guard Comment Validation',
    `- Status: ${ok ? 'pass' : 'fail'}`,
    `- Error count: ${errorCount}`,
  ]
  if (codes.length > 0) {
    lines.push(`- Error codes: ${codes.join(', ')}`)
  }
  lines.push('')
  return lines
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
  emitLines(lines)
  appendLinesToStepSummary({ lines })
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  buildSummaryLines,
}
