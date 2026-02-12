const path = require('path')
const { readTextFile, ensure } = require('./policy-test-utils')

const scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')
const requiredFiles = [
  'temp-dir-policy.test.ts',
  'cli-runner-policy.test.ts',
]

const readScriptsTestFile = (file) => {
  return readTextFile(path.join(scriptsTestsDir, file))
}

describe('policy message format governance', () => {
  it('keeps key policy suites using shared forbidden-usage message builder', () => {
    for (const file of requiredFiles) {
      const content = readScriptsTestFile(file)
      ensure(
        content.includes("require('./policy-test-utils')"),
        `${file}: missing policy-test-utils import; builder must come from shared utils.`,
      )
      ensure(
        content.includes('buildForbiddenUsageMessage,'),
        `${file}: missing buildForbiddenUsageMessage import from policy-test-utils.`,
      )
      ensure(
        content.includes('buildForbiddenUsageMessage('),
        `${file}: missing buildForbiddenUsageMessage( usage; keep shared message formatting for policy diagnostics.`,
      )
    }
  })
})
