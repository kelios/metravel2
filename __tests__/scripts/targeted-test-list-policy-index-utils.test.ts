const {
  SELECTIVE_RUNNER_TEST_PATTERN,
  TARGETED_POLICY_SUITE_PATTERN,
  CONTRACT_UTILS_SUITE_FILE,
  getSelectiveRunnerTestFilesFromList,
  getAllowedHelperConsumerFilesFromList,
} = require('./targeted-test-list-policy-index-utils')
const exported = require('./targeted-test-list-policy-index-utils')

describe('targeted-test-list-policy-index-utils', () => {
  it('keeps exported index-utils API stable', () => {
    expect(Object.keys(exported).sort()).toEqual([
      'CONTRACT_UTILS_SUITE_FILE',
      'SELECTIVE_RUNNER_TEST_PATTERN',
      'TARGETED_POLICY_SUITE_PATTERN',
      'getAllowedHelperConsumerFilesFromList',
      'getSelectiveRunnerTestFilesFromList',
    ])
  })

  it('keeps naming contract constants stable', () => {
    expect(String(SELECTIVE_RUNNER_TEST_PATTERN)).toBe('/^run-.*-contract-tests-if-needed\\.test\\.ts$/')
    expect(String(TARGETED_POLICY_SUITE_PATTERN)).toBe('/^targeted-test-list-policy.*\\.test\\.ts$/')
    expect(CONTRACT_UTILS_SUITE_FILE).toBe('targeted-test-list-contract-utils.test.ts')
  })

  it('selects selective runner suites from file list', () => {
    const files = [
      'run-schema-contract-tests-if-needed.test.ts',
      'run-validator-contract-tests-if-needed.test.ts',
      'targeted-test-list-policy.test.ts',
      'README.md',
    ]
    expect(getSelectiveRunnerTestFilesFromList(files)).toEqual([
      'run-schema-contract-tests-if-needed.test.ts',
      'run-validator-contract-tests-if-needed.test.ts',
    ])
  })

  it('selects allowed helper consumer suites from file list', () => {
    const files = [
      'run-schema-contract-tests-if-needed.test.ts',
      'run-validator-contract-tests-if-needed.test.ts',
      'targeted-test-list-policy.test.ts',
      'targeted-test-list-policy-utils.test.ts',
      'targeted-test-list-contract-utils.test.ts',
      'unrelated.test.ts',
    ]
    expect(getAllowedHelperConsumerFilesFromList(files)).toEqual([
      'run-schema-contract-tests-if-needed.test.ts',
      'run-validator-contract-tests-if-needed.test.ts',
      'targeted-test-list-policy.test.ts',
      'targeted-test-list-policy-utils.test.ts',
      'targeted-test-list-contract-utils.test.ts',
    ])
  })
})
