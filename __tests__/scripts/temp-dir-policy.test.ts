const path = require('path')
const {
  ensure,
  collectFilesRecursive,
  toPosixRelative,
  readTextFile,
} = require('./policy-test-utils')

const scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')
const allowedFiles = new Set([
  'cli-test-utils.ts',
])

describe('temp dir policy', () => {
  it('keeps mkdtempSync usage only in cli-test-utils helper', () => {
    const files = collectFilesRecursive(scriptsTestsDir)
    const forbidden = []
    const needle = 'mkdtemp' + 'Sync('

    for (const filePath of files) {
      const rel = toPosixRelative(scriptsTestsDir, filePath)
      if (allowedFiles.has(rel)) continue

      const content = readTextFile(filePath)
      if (content.includes(needle)) {
        forbidden.push(rel)
      }
    }

    ensure(
      forbidden.length === 0,
      `Found forbidden mkdtempSync usage in: [${forbidden.join(', ')}]. Use makeTempDir from __tests__/scripts/cli-test-utils.ts.`,
    )
  })
})
