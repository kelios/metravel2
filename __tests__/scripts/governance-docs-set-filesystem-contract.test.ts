const fs = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')
const { keyOperationalGovernanceDocs } = require('./governance-docs-set')

const repoRoot = process.cwd()

describe('governance docs set filesystem contract', () => {
  it('keeps every governance docs set entry pointing to an existing file', () => {
    for (const file of keyOperationalGovernanceDocs) {
      const absolutePath = path.resolve(repoRoot, file)
      ensure(
        fs.existsSync(absolutePath),
        `governance-docs-set: file does not exist: ${file}.`,
      )
    }
  })
})
