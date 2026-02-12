const {
  readJsonFileWithStatus,
  emitLines,
  appendLinesToStepSummary,
} = require('./summary-utils')

const inputPath = process.argv[2] || 'test-results/eslint-results.json'
const printLines = (lines) => {
  emitLines(lines)
  appendLinesToStepSummary({ lines })
}

const lintResults = readJsonFileWithStatus(inputPath)

if (lintResults.missing) {
  printLines([
    '## Lint Summary',
    '',
    `- Result file not found: \`${inputPath}\``,
  ])
  process.exit(0)
}

if (lintResults.parseError) {
  printLines([
    '## Lint Summary',
    '',
    `- Failed to parse \`${inputPath}\`: ${lintResults.parseError}`,
  ])
  process.exit(0)
}

const results = lintResults.payload
const files = Array.isArray(results) ? results : []
const filesWithIssues = files.filter((f) => Number(f?.errorCount ?? 0) > 0 || Number(f?.warningCount ?? 0) > 0)
const errorCount = files.reduce((sum, f) => sum + Number(f?.errorCount ?? 0), 0)
const warningCount = files.reduce((sum, f) => sum + Number(f?.warningCount ?? 0), 0)

const lines = [
  '## Lint Summary',
  '',
  `- Files checked: ${files.length}`,
  `- Files with issues: ${filesWithIssues.length}`,
  `- Errors: ${errorCount}`,
  `- Warnings: ${warningCount}`,
]

if (filesWithIssues.length > 0) {
  lines.push('- Top files with issues:')
  filesWithIssues
    .sort((a, b) => (Number(b?.errorCount ?? 0) + Number(b?.warningCount ?? 0)) - (Number(a?.errorCount ?? 0) + Number(a?.warningCount ?? 0)))
    .slice(0, 5)
    .forEach((f) => {
      const rel = String(f?.filePath || '').replace(`${process.cwd()}/`, '')
      const errs = Number(f?.errorCount ?? 0)
      const warns = Number(f?.warningCount ?? 0)
      lines.push(`  - \`${rel}\` (errors: ${errs}, warnings: ${warns})`)
    })
}

printLines(lines)
