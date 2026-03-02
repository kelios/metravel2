/**
 * summary-utils.js
 * Legacy re-export — consumers can migrate to require('./lib') directly.
 */
const { resolveFromCwd, readJsonFileWithStatus } = require('./lib/fileIO')
const { emitLines, appendLinesToStepSummary } = require('./lib/reportParser')

module.exports = {
  resolveFromCwd,
  readJsonFileWithStatus,
  emitLines,
  appendLinesToStepSummary,
}
