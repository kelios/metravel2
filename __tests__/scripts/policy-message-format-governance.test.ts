const { readScriptsTestFile, ensure } = require('./policy-test-utils')
const {
  policyUtilsRequirePattern,
  builderImportPattern,
  builderCallPattern,
} = require('./policy-message-format-governance-patterns')

const requiredFiles = [
  'temp-dir-policy.test.ts',
  'cli-runner-policy.test.ts',
]
// Governance update rule:
// 1) Keep regex definitions in `policy-message-format-governance-patterns.js`.
// 2) When regex rules change, update/add fixture cases in `policy-message-format-governance-patterns.test.ts`.
// 3) Keep this suite focused on real-file enforcement against those shared patterns.

describe('policy message format governance', () => {
  it('keeps key policy suites using shared forbidden-usage message builder', () => {
    for (const file of requiredFiles) {
      const content = readScriptsTestFile(file)
      ensure(
        policyUtilsRequirePattern.test(content),
        `${file}: missing policy-test-utils import; builder must come from shared utils.`,
      )
      ensure(
        builderImportPattern.test(content),
        `${file}: missing buildForbiddenUsageMessage import from policy-test-utils.`,
      )
      ensure(
        builderCallPattern.test(content),
        `${file}: missing buildForbiddenUsageMessage( usage; keep shared message formatting for policy diagnostics.`,
      )
    }
  })
})
