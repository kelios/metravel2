const { ensure } = require('./policy-test-utils')

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

const validateSelectiveRunnerPolicyContent = ({ file, content }) => {
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
  ensureNotContains(content, "require('fs')", file, 'do not duplicate filesystem checks locally')
  ensureNotContains(content, "require('path')", file, 'do not duplicate path checks locally')
}

module.exports = {
  validateSelectiveRunnerPolicyContent,
  ensureContains,
  ensureNotContains,
}
