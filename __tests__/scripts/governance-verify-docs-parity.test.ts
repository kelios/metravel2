const { readFileSync } = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')
const { keyOperationalGovernanceDocs } = require('./governance-docs-set')

const repoRoot = process.cwd()
const read = (file) => readFileSync(path.resolve(repoRoot, file), 'utf8')

describe('governance verify docs parity', () => {
  it('keeps governance:verify documented in PR and release operations docs', () => {
    const expectedByFile = {
      '.github/pull_request_template.md': '`yarn governance:verify`',
      'docs/DEVELOPMENT.md': 'npm run governance:verify',
      'docs/PRODUCTION_CHECKLIST.md': 'npm run governance:verify',
      'docs/RELEASE.md': 'npm run governance:verify',
      'docs/RULES.md': '`yarn governance:verify`',
    }

    for (const file of keyOperationalGovernanceDocs) {
      const expectedSnippet = expectedByFile[file]
      ensure(
        typeof expectedSnippet === 'string' && expectedSnippet.length > 0,
        `${file}: expected governance:verify snippet is missing in test config.`,
      )
      ensure(
        read(file).includes(expectedSnippet),
        `${file} must include ${expectedSnippet}.`,
      )
    }
  })
})
