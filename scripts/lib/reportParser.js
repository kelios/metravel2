/**
 * scripts/lib/reportParser.js
 * Shared report parsing utilities for CI summary scripts.
 */

const escapeRegExp = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Extract a value from a Markdown list line: `- Label: Value` */
const extractMarkdownLineValue = (markdown, label) => {
  const regexp = new RegExp(`^\\s*-\\s*${escapeRegExp(label)}:\\s*(.*)\\s*$`, 'm')
  const match = String(markdown || '').match(regexp)
  return String(match?.[1] || '').trim()
}

/** Check if a value is a placeholder like `<...>` or `[...]` or empty */
const isPlaceholderValue = (value) => {
  const normalized = String(value || '').trim()
  return !normalized || normalized.startsWith('<') || normalized.startsWith('[')
}

/** Parse CLI `--file <path>` argument from argv */
const parseFileArg = (argv, defaultFile) => {
  const args = { file: defaultFile }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--file' && argv[i + 1]) {
      args.file = argv[i + 1]
      i += 1
    }
  }
  return args
}

/** Emit lines to stdout */
const emitLines = (lines) => {
  const normalized = Array.isArray(lines) ? lines : [String(lines || '')]
  process.stdout.write(`${normalized.join('\n')}\n`)
}

/** Append lines to GitHub Actions step summary */
const appendLinesToStepSummary = ({ lines, stepSummaryPath }) => {
  const fs = require('fs')
  const summaryPath = String(stepSummaryPath || process.env.GITHUB_STEP_SUMMARY || '').trim()
  if (!summaryPath) return false
  const normalized = Array.isArray(lines) ? lines : [String(lines || '')]
  fs.appendFileSync(summaryPath, `${normalized.join('\n')}\n`, 'utf8')
  return true
}

module.exports = {
  escapeRegExp,
  extractMarkdownLineValue,
  isPlaceholderValue,
  parseFileArg,
  emitLines,
  appendLinesToStepSummary,
}

