const { ensure, findDuplicates } = require('./policy-test-utils')
const { keyOperationalGovernanceDocs } = require('./governance-docs-set')

const requiredDocs = [
  '.github/pull_request_template.md',
  'docs/DEVELOPMENT.md',
  'docs/PRODUCTION_CHECKLIST.md',
  'docs/RELEASE.md',
  'docs/RULES.md',
]

describe('governance docs set contract', () => {
  it('keeps keyOperationalGovernanceDocs non-empty, unique, and sorted', () => {
    ensure(
      Array.isArray(keyOperationalGovernanceDocs) && keyOperationalGovernanceDocs.length > 0,
      'governance-docs-set: keyOperationalGovernanceDocs must be a non-empty array.',
    )

    const duplicates = findDuplicates(keyOperationalGovernanceDocs)
    ensure(
      duplicates.length === 0,
      `governance-docs-set: duplicate docs detected: [${duplicates.join(', ')}].`,
    )

    const sorted = [...keyOperationalGovernanceDocs].sort()
    ensure(
      JSON.stringify(keyOperationalGovernanceDocs) === JSON.stringify(sorted),
      `governance-docs-set: docs must be sorted. Current: [${keyOperationalGovernanceDocs.join(', ')}]. Expected: [${sorted.join(', ')}].`,
    )
  })

  it('keeps required operational governance docs covered', () => {
    const missing = requiredDocs.filter((file) => !keyOperationalGovernanceDocs.includes(file))
    ensure(
      missing.length === 0,
      `governance-docs-set: missing required docs: [${missing.join(', ')}].`,
    )
  })
})
