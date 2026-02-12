const fs = require('fs')
const path = require('path')
const { ensure, readScriptsTestFile, findDuplicates } = require('./policy-test-utils')

const scriptsTestsDir = path.resolve(process.cwd(), '__tests__', 'scripts')

// Governance update rule:
// 1) Add new shared policy helper `.js` file to this matrix.
// 2) Add/point to its dedicated `*.test.ts` contract suite.
// 3) Keep one entry per helper and Keep this list sorted by `helperFile`.
// 4) Keep one entry per `contractTestFile` to avoid ambiguous helper ownership.
// 5) Keep that suite importing the helper and asserting an "API stable" marker.
const helperContractMatrix = [
  {
    helperFile: 'policy-message-format-governance-patterns.js',
    contractTestFile: 'policy-message-format-governance-patterns.test.ts',
  },
  {
    helperFile: 'policy-test-utils.js',
    contractTestFile: 'policy-test-utils.test.ts',
  },
  {
    helperFile: 'targeted-test-list-policy-index-utils.js',
    contractTestFile: 'targeted-test-list-policy-index-utils.test.ts',
  },
  {
    helperFile: 'targeted-test-list-policy-utils.js',
    contractTestFile: 'targeted-test-list-policy-utils.test.ts',
  },
]

describe('policy helpers contract matrix', () => {
  it('keeps helper contract matrix unique and sorted by helper file', () => {
    const helperFiles = helperContractMatrix.map((entry) => entry.helperFile)
    const duplicatedHelpers = findDuplicates(helperFiles)
    ensure(
      duplicatedHelpers.length === 0,
      `helperContractMatrix contains duplicate helper entries: [${duplicatedHelpers.join(', ')}].`,
    )
    const sorted = [...helperFiles].sort()
    ensure(
      JSON.stringify(helperFiles) === JSON.stringify(sorted),
      `helperContractMatrix must be sorted by helperFile. Current: [${helperFiles.join(', ')}].`,
    )

    const contractTests = helperContractMatrix.map((entry) => entry.contractTestFile)
    const duplicatedContractTests = findDuplicates(contractTests)
    ensure(
      duplicatedContractTests.length === 0,
      `helperContractMatrix contains duplicate contract test entries: [${duplicatedContractTests.join(', ')}].`,
    )
  })

  it('keeps shared policy helpers mapped to explicit API contract tests', () => {
    for (const entry of helperContractMatrix) {
      const helperPath = path.join(scriptsTestsDir, entry.helperFile)
      const contractTestPath = path.join(scriptsTestsDir, entry.contractTestFile)
      ensure(
        fs.existsSync(helperPath),
        `Missing helper file: ${entry.helperFile}. Add it or update helperContractMatrix.`,
      )
      ensure(
        fs.existsSync(contractTestPath),
        `Missing contract test file: ${entry.contractTestFile} for helper ${entry.helperFile}.`,
      )

      const contractContent = readScriptsTestFile(entry.contractTestFile)
      ensure(
        contractContent.includes(`require('./${entry.helperFile.replace(/\.js$/, '')}')`),
        `${entry.contractTestFile}: missing require('./${entry.helperFile.replace(/\.js$/, '')}') for ${entry.helperFile}.`,
      )
      ensure(
        contractContent.includes('API stable'),
        `${entry.contractTestFile}: missing "API stable" marker for helper ${entry.helperFile}.`,
      )
    }
  })
})
