const fs = require('fs')
const path = require('path')

const scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')
const allowedFiles = new Set([
  'cli-test-utils.ts',
])

const collectFiles = (dir) => {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectFiles(abs))
      continue
    }
    out.push(abs)
  }
  return out
}

describe('temp dir policy', () => {
  it('keeps mkdtempSync usage only in cli-test-utils helper', () => {
    const files = collectFiles(scriptsTestsDir)
    const forbidden = []
    const needle = 'mkdtemp' + 'Sync('

    for (const filePath of files) {
      const rel = path.relative(scriptsTestsDir, filePath).replace(/\\/g, '/')
      if (allowedFiles.has(rel)) continue

      const content = fs.readFileSync(filePath, 'utf8')
      if (content.includes(needle)) {
        forbidden.push(rel)
      }
    }

    expect(forbidden).toEqual([])
  })
})
