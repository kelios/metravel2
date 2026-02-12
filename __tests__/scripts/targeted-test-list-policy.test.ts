const fs = require('fs')
const path = require('path')
const { ensure, readTextFile } = require('./policy-test-utils')
const { validateSelectiveRunnerPolicyContent } = require('./targeted-test-list-policy-utils')
const {
  SELECTIVE_RUNNER_TEST_PATTERN,
  TARGETED_POLICY_SUITE_PATTERN,
  CONTRACT_UTILS_SUITE_FILE,
  getSelectiveRunnerTestFilesFromList,
  getAllowedHelperConsumerFilesFromList,
} = require('./targeted-test-list-policy-index-utils')

const scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')
const helperFile = 'targeted-test-list-contract-utils.js'
const listScriptTests = () => fs.readdirSync(scriptsTestsDir)

const getSelectiveRunnerTestFiles = () => {
  return getSelectiveRunnerTestFilesFromList(listScriptTests())
}

const getHelperImportingTestFiles = () => {
  const files = fs.readdirSync(scriptsTestsDir)
  return files.filter((file) => {
    if (!file.endsWith('.test.ts') && !file.endsWith('.test.js')) return false
    const content = readScriptsTestFile(file)
    return content.includes("require('./targeted-test-list-contract-utils')")
  })
}

const getAllowedHelperConsumerFiles = () => {
  return getAllowedHelperConsumerFilesFromList(listScriptTests())
}

const readScriptsTestFile = (file) => {
  return readTextFile(path.join(scriptsTestsDir, file))
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
      validateSelectiveRunnerPolicyContent({ file, content })
    }
  })

  it('keeps selective runner tests free of local fs/path list checks', () => {
    const requiredTestFiles = getSelectiveRunnerTestFiles()
    expect(requiredTestFiles.length).toBeGreaterThan(0)
    for (const file of requiredTestFiles) {
      const content = readScriptsTestFile(file)
      validateSelectiveRunnerPolicyContent({ file, content })
    }
  })

  it('keeps helper imports scoped to intended suites', () => {
    const selectiveRunnerTests = getSelectiveRunnerTestFiles()
    ensure(
      selectiveRunnerTests.length > 0,
      `No selective runner suites found for pattern ${String(SELECTIVE_RUNNER_TEST_PATTERN)}.`,
    )
    const helperConsumers = getHelperImportingTestFiles().sort()
    const allowedConsumers = getAllowedHelperConsumerFiles().sort()
    ensure(
      allowedConsumers.length > 0,
      'No allowed helper consumers found. Check naming contract for selective/policy test suites.',
    )
    const unexpected = helperConsumers.filter((file) => !allowedConsumers.includes(file))
    ensure(
      unexpected.length === 0,
      `Helper import scope mismatch. Unexpected: [${unexpected.join(', ')}].`,
    )
  })

  it('keeps allowed helper consumer match set aligned with naming contracts', () => {
    const selectiveRunnerTests = getSelectiveRunnerTestFiles().sort()
    const allowedConsumers = getAllowedHelperConsumerFiles().sort()
    ensure(
      selectiveRunnerTests.length > 0,
      `No selective runner suites found for pattern ${String(SELECTIVE_RUNNER_TEST_PATTERN)}.`,
    )
    ensure(
      allowedConsumers.length > 0,
      'No allowed helper consumers found. Check naming contract for selective/policy test suites.',
    )

    const expected = [
      ...selectiveRunnerTests,
      ...listScriptTests().filter((file) => TARGETED_POLICY_SUITE_PATTERN.test(file)).sort(),
      CONTRACT_UTILS_SUITE_FILE,
    ].sort()
    const uniqueExpected = [...new Set(expected)].sort()
    expect(allowedConsumers).toEqual(uniqueExpected)
  })
})
