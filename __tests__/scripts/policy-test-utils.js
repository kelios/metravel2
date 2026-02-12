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

module.exports = {
  ensure,
  collectFilesRecursive,
  toPosixRelative,
  readTextFile,
}
