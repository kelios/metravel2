const { readScriptsTestFile, ensure, findDuplicates } = require('./policy-test-utils')

// Governance update rule:
// 1) When adding new key governance files, extend expectedDocsMarkers.
// 2) Keep one entry per file to avoid ambiguous parity ownership.
// 3) Keep expectedDocsMarkers sorted by `file`.
// 4) Do not include this file itself while exact-once marker checks are active.
// 5) Use governance-rule-enforcement-parity.test.ts for self-coverage of rule phrases.
// 6) Use explicit marker strings that are stable and human-readable.
const expectedDocsMarkers = [
  {
    file: 'governance-rule-enforcement-parity.test.ts',
    marker: 'Governance update rule:',
  },
  {
    file: 'governance-script-parity.test.ts',
    marker: 'Governance update rule:',
  },
  {
    file: 'policy-helpers-contract-matrix.test.ts',
    marker: 'Governance update rule:',
  },
  {
    file: 'policy-message-format-governance-patterns.js',
    marker: 'Pattern responsibilities:',
  },
  {
    file: 'policy-message-format-governance.test.ts',
    marker: 'Governance update rule:',
  },
  {
    file: 'targeted-test-list-policy.test.ts',
    marker: 'Governance update rule:',
  },
]

const countOccurrences = (content, marker) => content.split(marker).length - 1
describe('governance docs parity', () => {
  it('keeps docs parity config sorted by file name', () => {
    const files = expectedDocsMarkers.map((entry) => entry.file)
    const sorted = [...files].sort()
    ensure(
      JSON.stringify(files) === JSON.stringify(sorted),
      `expectedDocsMarkers must be sorted by file. Current: [${files.join(', ')}]. Expected: [${sorted.join(', ')}].`,
    )
  })

  it('keeps docs parity config free of duplicate file entries', () => {
    const files = expectedDocsMarkers.map((entry) => entry.file)
    const duplicates = findDuplicates(files)
    ensure(
      duplicates.length === 0,
      `expectedDocsMarkers contains duplicate file entries: [${duplicates.join(', ')}].`,
    )
  })

  it('keeps governance guidance comments present in key policy files', () => {
    for (const entry of expectedDocsMarkers) {
      ensure(
        entry.marker.trim().length > 0,
        `${entry.file}: marker must be non-empty.`,
      )
      const content = readScriptsTestFile(entry.file)
      const occurrences = countOccurrences(content, entry.marker)
      ensure(
        occurrences === 1,
        `${entry.file}: expected marker "${entry.marker}" exactly once, found ${occurrences}.`,
      )
    }
  })
})
