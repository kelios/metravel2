const SELECTIVE_RUNNER_TEST_PATTERN = /^run-.*-contract-tests-if-needed\.test\.ts$/
const TARGETED_POLICY_SUITE_PATTERN = /^targeted-test-list-policy.*\.test\.ts$/
const CONTRACT_UTILS_SUITE_FILE = 'targeted-test-list-contract-utils.test.ts'

const getSelectiveRunnerTestFilesFromList = (files) => {
  return files.filter((file) => SELECTIVE_RUNNER_TEST_PATTERN.test(file))
}

const getAllowedHelperConsumerFilesFromList = (files) => {
  return files.filter((file) => (
    SELECTIVE_RUNNER_TEST_PATTERN.test(file)
    || TARGETED_POLICY_SUITE_PATTERN.test(file)
    || file === CONTRACT_UTILS_SUITE_FILE
  ))
}

module.exports = {
  SELECTIVE_RUNNER_TEST_PATTERN,
  TARGETED_POLICY_SUITE_PATTERN,
  CONTRACT_UTILS_SUITE_FILE,
  getSelectiveRunnerTestFilesFromList,
  getAllowedHelperConsumerFilesFromList,
}
