const fs = require('fs')
const path = require('path')

const parseFileArg = (argv, defaultFile) => {
  const args = { file: defaultFile }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--file' && argv[i + 1]) {
      args.file = argv[i + 1]
      i += 1
      continue
    }
  }

  return args
}

const readTextFile = (filePath, label = 'file') => {
  const resolved = path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} not found: ${filePath}`)
  }

  return fs.readFileSync(resolved, 'utf8')
}

const readJsonFile = (filePath, label = 'file') => {
  return JSON.parse(readTextFile(filePath, label))
}

const escapeRegExp = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const extractMarkdownLineValue = (markdown, label) => {
  const regexp = new RegExp(`^\\s*-\\s*${escapeRegExp(label)}:\\s*(.*)\\s*$`, 'm')
  const match = String(markdown || '').match(regexp)
  return String(match?.[1] || '').trim()
}

const isPlaceholderValue = (value) => {
  const normalized = String(value || '').trim()
  return !normalized || normalized.startsWith('<') || normalized.startsWith('[')
}

module.exports = {
  parseFileArg,
  readTextFile,
  readJsonFile,
  extractMarkdownLineValue,
  isPlaceholderValue,
}
