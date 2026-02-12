const { readFileSync } = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')
const { keyOperationalGovernanceDocs } = require('./governance-docs-set')

const repoRoot = process.cwd()
const read = (file) => readFileSync(path.resolve(repoRoot, file), 'utf8')

describe('governance docs minimal command surface', () => {
  it('keeps low-level external-link guard commands out of key operational docs', () => {
    for (const file of keyOperationalGovernanceDocs) {
      const content = read(file)
      ensure(
        !content.includes('guard:no-direct-linking-openurl'),
        `${file} must not reference guard:no-direct-linking-openurl directly.`,
      )
      ensure(
        !content.includes('guard:no-direct-window-open'),
        `${file} must not reference guard:no-direct-window-open directly.`,
      )
    }
  })
})
