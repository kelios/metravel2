const { readFileSync } = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')
const { keyOperationalGovernanceDocs } = require('./governance-docs-set')

const repoRoot = process.cwd()
const read = (file) => readFileSync(path.resolve(repoRoot, file), 'utf8')
const canonicalAnchor = 'docs/TESTING.md#governance-commands'

describe('governance commands doc link parity', () => {
  it('keeps a single canonical governance commands anchor in testing docs', () => {
    const testing = read('docs/TESTING.md')
    ensure(
      testing.includes('## Governance commands'),
      'docs/TESTING.md must include "## Governance commands" section.',
    )
    ensure(
      testing.includes('yarn governance:verify'),
      'docs/TESTING.md Governance commands section must include `yarn governance:verify`.',
    )
    ensure(
      testing.includes('npm run governance:verify'),
      'docs/TESTING.md Governance commands section must include `npm run governance:verify` equivalent.',
    )
  })

  it('keeps key docs linked to canonical governance commands anchor', () => {
    for (const file of keyOperationalGovernanceDocs) {
      const content = read(file)
      ensure(
        content.includes(canonicalAnchor),
        `${file} must reference canonical governance commands anchor.`,
      )
    }
  })
})
