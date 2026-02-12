const fs = require('fs')
const path = require('path')

const scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')
const helperFile = 'targeted-test-list-contract-utils.js'
const selectiveRunnerTestPattern = /^run-.*-contract-tests-if-needed\.test\.ts$/

const getSelectiveRunnerTestFiles = () => {
  return fs.readdirSync(scriptsTestsDir).filter((file) => selectiveRunnerTestPattern.test(file))
}

const getHelperImportingTestFiles = () => {
  const files = fs.readdirSync(scriptsTestsDir)
  return files.filter((file) => {
    if (!file.endsWith('.test.ts') && !file.endsWith('.test.js')) return false
    const content = readScriptsTestFile(file)
    return content.includes("require('./targeted-test-list-contract-utils')")
  })
}

const readScriptsTestFile = (file) => {
  return fs.readFileSync(path.join(scriptsTestsDir, file), 'utf8')
}

const ensure = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const ensureContains = (content, needle, file, requirement) => {
  ensure(
    content.includes(needle),
    `${file}: missing "${needle}" (${requirement}).`,
  )
}

const ensureNotContains = (content, needle, file, requirement) => {
  ensure(
    !content.includes(needle),
    `${file}: forbidden "${needle}" (${requirement}).`,
  )
}

describe('targeted test list policy', () => {
  it('keeps targeted test list helper present', () => {
    expect(fs.existsSync(path.join(scriptsTestsDir, helperFile))).toBe(true)
  })

  it('keeps selective runner tests using shared targeted test list helper', () => {
    const requiredTestFiles = getSelectiveRunnerTestFiles()
    expect(requiredTestFiles.length).toBeGreaterThan(0)
    for (const file of requiredTestFiles) {
      const content = readScriptsTestFile(file)
      ensureContains(
        content,
        "require('./targeted-test-list-contract-utils')",
        file,
        'import shared targeted-list helper',
      )
      ensureContains(content, 'expectTargetedTestsListUnique', file, 'import unique assertion helper')
      ensureContains(content, 'expectTargetedTestsListResolvable', file, 'import resolvable assertion helper')
      ensureContains(content, 'expectTargetedTestsListUnique(', file, 'call unique assertion helper')
      ensureContains(content, 'expectTargetedTestsListResolvable(', file, 'call resolvable assertion helper')
    }
  })

  it('keeps selective runner tests free of local fs/path list checks', () => {
    const requiredTestFiles = getSelectiveRunnerTestFiles()
    expect(requiredTestFiles.length).toBeGreaterThan(0)
    for (const file of requiredTestFiles) {
      const content = readScriptsTestFile(file)
      ensureNotContains(content, "require('fs')", file, 'do not duplicate filesystem checks locally')
      ensureNotContains(content, "require('path')", file, 'do not duplicate path checks locally')
    }
  })

  it('keeps helper imports scoped to intended suites', () => {
    const selectiveRunnerTests = getSelectiveRunnerTestFiles()
    const helperConsumers = getHelperImportingTestFiles().sort()
    const allowedConsumers = [
      ...selectiveRunnerTests,
      'targeted-test-list-contract-utils.test.ts',
      'targeted-test-list-policy.test.ts',
    ].sort()
    const unexpected = helperConsumers.filter((file) => !allowedConsumers.includes(file))
    const missing = allowedConsumers.filter((file) => !helperConsumers.includes(file))
    ensure(
      unexpected.length === 0 && missing.length === 0,
      `Helper import scope mismatch. Unexpected: [${unexpected.join(', ')}]. Missing: [${missing.join(', ')}].`,
    )
  })
})
