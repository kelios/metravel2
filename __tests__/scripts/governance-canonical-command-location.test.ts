const { readFileSync } = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')

const repoRoot = process.cwd()
const read = (file) => readFileSync(path.resolve(repoRoot, file), 'utf8')
const canonicalHeading = '## Governance commands'

describe('governance canonical command location', () => {
  it('keeps governance commands heading defined exactly once in docs/TESTING.md', () => {
    const testing = read('docs/TESTING.md')
    const testingHeadingCount = testing.split(canonicalHeading).length - 1
    ensure(
      testingHeadingCount === 1,
      `docs/TESTING.md must contain "${canonicalHeading}" exactly once, found ${testingHeadingCount}.`,
    )
  })

  it('prevents duplicating canonical governance commands heading in other docs', () => {
    const files = [
      '.github/pull_request_template.md',
      'docs/DEVELOPMENT.md',
      'docs/PRODUCTION_CHECKLIST.md',
      'docs/RELEASE.md',
      'docs/RULES.md',
    ]

    for (const file of files) {
      const content = read(file)
      ensure(
        !content.includes(canonicalHeading),
        `${file} must not define "${canonicalHeading}". Use docs/TESTING.md canonical section instead.`,
      )
    }
  })
})
