const {
  findMissingRepositoryPaths,
  expectTargetedTestsListUnique,
  expectTargetedTestsListResolvable,
} = require('./targeted-test-list-contract-utils')

describe('targeted-test-list-contract-utils', () => {
  it('finds only missing repository paths', () => {
    const files = [
      '__tests__/scripts/targeted-test-list-contract-utils.js',
      '__tests__/scripts/__missing_targeted_list__.test.ts',
    ]
    expect(findMissingRepositoryPaths(files)).toEqual([
      '__tests__/scripts/__missing_targeted_list__.test.ts',
    ])
  })

  it('passes unique assertion when list has no duplicates', () => {
    expect(() => expectTargetedTestsListUnique([
      '__tests__/scripts/run-schema-contract-tests-if-needed.test.ts',
      '__tests__/scripts/run-validator-contract-tests-if-needed.test.ts',
    ])).not.toThrow()
  })

  it('fails unique assertion when list contains duplicates', () => {
    expect(() => expectTargetedTestsListUnique([
      '__tests__/scripts/run-schema-contract-tests-if-needed.test.ts',
      '__tests__/scripts/run-schema-contract-tests-if-needed.test.ts',
    ])).toThrow()
  })

  it('passes resolvable assertion when all files exist', () => {
    expect(() => expectTargetedTestsListResolvable([
      '__tests__/scripts/targeted-test-list-contract-utils.js',
      '__tests__/scripts/run-schema-contract-tests-if-needed.test.ts',
    ])).not.toThrow()
  })

  it('fails resolvable assertion when some files are missing', () => {
    expect(() => expectTargetedTestsListResolvable([
      '__tests__/scripts/targeted-test-list-contract-utils.js',
      '__tests__/scripts/__missing_targeted_list__.test.ts',
    ])).toThrow()
  })
})
