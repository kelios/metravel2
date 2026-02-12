const fs = require('fs')
const path = require('path')

const ensure = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const collectFilesRecursive = (dir) => {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectFilesRecursive(abs))
      continue
    }
    out.push(abs)
  }
  return out
}

const toPosixRelative = (from, to) => {
  return path.relative(from, to).replace(/\\/g, '/')
}

const readTextFile = (filePath) => {
  return fs.readFileSync(filePath, 'utf8')
}

const readScriptsTestFile = (file, scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')) => {
  return readTextFile(path.join(scriptsTestsDir, file))
}

const findDuplicates = (items) => {
  const counts = new Map()
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([item]) => item)
}

const buildForbiddenUsageMessage = ({ subject, forbidden, remediation }) => {
  return [
    `Found forbidden ${subject} in: [${forbidden.join(', ')}].`,
    remediation,
  ].join(' ')
}

module.exports = {
  ensure,
  collectFilesRecursive,
  toPosixRelative,
  readTextFile,
  readScriptsTestFile,
  findDuplicates,
  buildForbiddenUsageMessage,
}
