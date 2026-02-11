const fs = require('fs')
const { parseChangedFiles } = require('./selective-check-utils')

const readChangedFiles = ({ changedFilesFile = '', envVarName = 'CHANGED_FILES' } = {}) => {
  if (changedFilesFile && fs.existsSync(changedFilesFile)) {
    return parseChangedFiles(fs.readFileSync(changedFilesFile, 'utf8'))
  }

  return parseChangedFiles(process.env[envVarName] || '')
}

module.exports = {
  readChangedFiles,
}
