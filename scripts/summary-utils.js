const fs = require('fs')
const path = require('path')

const resolveFromCwd = (filePath) => {
  return path.resolve(process.cwd(), String(filePath || ''))
}

const readJsonFileWithStatus = (filePath) => {
  const resolved = resolveFromCwd(filePath)
  if (!fs.existsSync(resolved)) {
    return { ok: false, missing: true, payload: null }
  }
  try {
    return {
      ok: true,
      missing: false,
      payload: JSON.parse(fs.readFileSync(resolved, 'utf8')),
    }
  } catch (error) {
    return {
      ok: false,
      missing: false,
      payload: null,
      parseError: error instanceof Error ? error.message : String(error),
    }
  }
}

const emitLines = (lines) => {
  const normalized = Array.isArray(lines) ? lines : [String(lines || '')]
  process.stdout.write(`${normalized.join('\n')}\n`)
}

const appendLinesToStepSummary = ({ lines, stepSummaryPath }) => {
  const summaryPath = String(stepSummaryPath || process.env.GITHUB_STEP_SUMMARY || '').trim()
  if (!summaryPath) return false
  const normalized = Array.isArray(lines) ? lines : [String(lines || '')]
  fs.appendFileSync(summaryPath, `${normalized.join('\n')}\n`, 'utf8')
  return true
}

module.exports = {
  resolveFromCwd,
  readJsonFileWithStatus,
  emitLines,
  appendLinesToStepSummary,
}
