/**
 * validation-utils.js
 * Legacy re-export — consumers can migrate to require('./lib') directly.
 */
const { readTextFile, readJsonFile } = require('./lib/fileIO')
const { parseFileArg, extractMarkdownLineValue, isPlaceholderValue } = require('./lib/reportParser')

module.exports = {
  parseFileArg,
  readTextFile,
  readJsonFile,
  extractMarkdownLineValue,
  isPlaceholderValue,
}
