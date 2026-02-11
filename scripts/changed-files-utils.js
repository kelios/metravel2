const fs = require('fs')
const { parseChangedFiles } = require('./selective-check-utils')

const readChangedFilesWithMeta = ({ changedFilesFile = '', envVarName = 'CHANGED_FILES' } = {}) => {
  if (changedFilesFile && fs.existsSync(changedFilesFile)) {
    const raw = fs.readFileSync(changedFilesFile, 'utf8')
    return {
      files: parseChangedFiles(raw),
      source: 'file',
      available: true,
    }
  }

  const envRaw = process.env[envVarName] || ''
  if (String(envRaw).trim()) {
    return {
      files: parseChangedFiles(envRaw),
      source: 'env',
      available: true,
    }
  }

  return {
    files: [],
    source: 'none',
    available: false,
  }
}

const readChangedFiles = ({ changedFilesFile = '', envVarName = 'CHANGED_FILES' } = {}) => {
  return readChangedFilesWithMeta({ changedFilesFile, envVarName }).files
}

module.exports = {
  readChangedFiles,
  readChangedFilesWithMeta,
}
