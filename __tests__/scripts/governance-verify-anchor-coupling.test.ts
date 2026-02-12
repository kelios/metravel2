const { readFileSync } = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')
const { keyOperationalGovernanceDocs } = require('./governance-docs-set')

const repoRoot = process.cwd()
const read = (file) => readFileSync(path.resolve(repoRoot, file), 'utf8')

const canonicalAnchor = 'docs/TESTING.md#governance-commands'

describe('governance verify anchor coupling', () => {
  it('requires canonical anchor in every key doc that mentions governance:verify', () => {
    for (const file of keyOperationalGovernanceDocs) {
      const content = read(file)
      const mentionsGovernanceVerify = content.includes('governance:verify')
      if (!mentionsGovernanceVerify) continue

      ensure(
        content.includes(canonicalAnchor),
        `${file} mentions governance:verify and must also reference ${canonicalAnchor}.`,
      )
    }
  })
})
