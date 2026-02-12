const fs = require('fs')
const path = require('path')

const scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')
const helperFile = 'targeted-test-list-contract-utils.js'
const requiredTestFiles = [
  'run-validator-contract-tests-if-needed.test.ts',
  'run-schema-contract-tests-if-needed.test.ts',
]

const readScriptsTestFile = (file) => {
  return fs.readFileSync(path.join(scriptsTestsDir, file), 'utf8')
}

describe('targeted test list policy', () => {
  it('keeps targeted test list helper present', () => {
    expect(fs.existsSync(path.join(scriptsTestsDir, helperFile))).toBe(true)
  })

  it('keeps selective runner tests using shared targeted test list helper', () => {
    for (const file of requiredTestFiles) {
      const content = readScriptsTestFile(file)
      expect(content).toContain("require('./targeted-test-list-contract-utils')")
      expect(content).toContain('expectTargetedTestsListUnique')
      expect(content).toContain('expectTargetedTestsListResolvable')
    }
  })

  it('keeps selective runner tests free of local fs/path list checks', () => {
    for (const file of requiredTestFiles) {
      const content = readScriptsTestFile(file)
      expect(content).not.toContain("require('fs')")
      expect(content).not.toContain("require('path')")
    }
  })
})
