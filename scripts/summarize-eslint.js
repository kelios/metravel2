const fs = require('fs')
const path = require('path')

const inputPath = process.argv[2] || 'test-results/eslint-results.json'
const resolvedPath = path.resolve(process.cwd(), inputPath)

const appendStepSummary = (markdown) => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return
  fs.appendFileSync(summaryPath, `${markdown}\n`)
}

const print = (markdown) => {
  process.stdout.write(`${markdown}\n`)
  appendStepSummary(markdown)
}

if (!fs.existsSync(resolvedPath)) {
  print('## Lint Summary')
  print('')
  print(`- Result file not found: \`${inputPath}\``)
  process.exit(0)
}

let results
try {
  results = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
} catch (error) {
  print('## Lint Summary')
  print('')
  print(`- Failed to parse \`${inputPath}\`: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(0)
}

const files = Array.isArray(results) ? results : []
const filesWithIssues = files.filter((f) => Number(f?.errorCount ?? 0) > 0 || Number(f?.warningCount ?? 0) > 0)
const errorCount = files.reduce((sum, f) => sum + Number(f?.errorCount ?? 0), 0)
const warningCount = files.reduce((sum, f) => sum + Number(f?.warningCount ?? 0), 0)

print('## Lint Summary')
print('')
print(`- Files checked: ${files.length}`)
print(`- Files with issues: ${filesWithIssues.length}`)
print(`- Errors: ${errorCount}`)
print(`- Warnings: ${warningCount}`)

if (filesWithIssues.length > 0) {
  print('- Top files with issues:')
  filesWithIssues
    .sort((a, b) => (Number(b?.errorCount ?? 0) + Number(b?.warningCount ?? 0)) - (Number(a?.errorCount ?? 0) + Number(a?.warningCount ?? 0)))
    .slice(0, 5)
    .forEach((f) => {
      const rel = String(f?.filePath || '').replace(`${process.cwd()}/`, '')
      const errs = Number(f?.errorCount ?? 0)
      const warns = Number(f?.warningCount ?? 0)
      print(`  - \`${rel}\` (errors: ${errs}, warnings: ${warns})`)
    })
}
