const fs = require('fs')

const parseChangedFiles = (raw) => {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const getMatchedFiles = (changedFiles, patterns) => {
  const safePatterns = Array.isArray(patterns) ? patterns : []
  return (changedFiles || []).filter((filePath) =>
    safePatterns.some((pattern) => pattern.test(filePath))
  )
}

const getCategoryBreakdown = (changedFiles, categories) => {
  const safeCategories = Array.isArray(categories) ? categories : []
  const buckets = new Map()
  safeCategories.forEach((category) => {
    const name = String(category?.name || '').trim()
    const pattern = category?.pattern
    if (!name) return
    const count = (changedFiles || []).filter((filePath) => pattern && pattern.test(filePath)).length
    buckets.set(name, (buckets.get(name) || 0) + count)
  })

  return [...buckets.entries()].map(([name, count]) => ({ name, count }))
}

const buildDecisionSummary = ({
  title,
  decision,
  changedFiles = [],
  matchedFiles = [],
  notes = [],
}) => {
  const lines = [
    '',
    `### ${title}`,
    `- Decision: ${decision}`,
    `- Changed files scanned: ${changedFiles.length}`,
    `- Relevant file matches: ${matchedFiles.length}`,
  ]

  if (matchedFiles.length > 0) {
    lines.push('- Matched files:')
    matchedFiles.slice(0, 20).forEach((filePath) => lines.push(`  - \`${filePath}\``))
    if (matchedFiles.length > 20) {
      lines.push(`  - ... and ${matchedFiles.length - 20} more`)
    }
  }

  if (Array.isArray(notes)) {
    notes.filter(Boolean).forEach((note) => lines.push(`- ${note}`))
  }
  lines.push('')
  return lines.join('\n')
}

const appendStepSummary = (markdown, stepSummaryPath) => {
  const summaryPath = stepSummaryPath || process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return false
  fs.appendFileSync(summaryPath, String(markdown || ''), 'utf8')
  return true
}

module.exports = {
  parseChangedFiles,
  getMatchedFiles,
  getCategoryBreakdown,
  buildDecisionSummary,
  appendStepSummary,
}
