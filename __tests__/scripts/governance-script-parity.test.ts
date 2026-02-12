const fs = require('fs')
const path = require('path')
const { ensure, findDuplicates } = require('./policy-test-utils')

const repoRoot = process.cwd()
const scriptsTestsDir = path.resolve(repoRoot, '__tests__', 'scripts')
const packageJsonPath = path.resolve(repoRoot, 'package.json')

// Governance update rule:
// 1) Keep governanceScopePattern aligned with the intended governance test domain only.
// 2) Keep package.json scripts.test:governance explicitly listing the same scope.
// 3) Keep scripts.test:governance file list unique and sorted.
// 4) Update scope pattern and script list together when adding/removing governance suites.
const governanceScopePattern = /^(cli-runner-policy\.test\.ts|external-links-docs-policy-parity\.test\.ts|external-links-guard-script-contract\.test\.ts|temp-dir-policy\.test\.ts|governance-docs-parity\.test\.ts|governance-rule-enforcement-parity\.test\.ts|governance-script-parity\.test\.ts|guard-no-direct-linking-openurl\.test\.ts|guard-no-direct-window-open\.test\.ts|policy-(helpers-contract-matrix|message-format-governance(?:-patterns)?|test-utils)\.test\.ts|targeted-test-list-.*\.test\.ts)$/

const parseGovernanceScriptFiles = (scriptValue) => {
  return scriptValue
    .split(/\s+/)
    .filter((token) => token.startsWith('__tests__/scripts/') && token.endsWith('.test.ts'))
}

describe('governance script parity', () => {
  it('keeps package.json test:governance aligned with governance scope', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const scriptValue = packageJson?.scripts?.['test:governance']
    ensure(typeof scriptValue === 'string' && scriptValue.length > 0, 'package.json: missing scripts.test:governance.')

    const configuredFiles = parseGovernanceScriptFiles(scriptValue).sort()
    ensure(configuredFiles.length > 0, 'package.json: scripts.test:governance contains no explicit test files.')

    const expectedFiles = fs.readdirSync(scriptsTestsDir)
      .filter((file) => governanceScopePattern.test(file))
      .map((file) => `__tests__/scripts/${file}`)
      .sort()
    ensure(expectedFiles.length > 0, 'No governance test files found for configured governance scope pattern.')

    const missing = expectedFiles.filter((file) => !configuredFiles.includes(file))
    const unexpected = configuredFiles.filter((file) => !expectedFiles.includes(file))
    ensure(
      missing.length === 0 && unexpected.length === 0,
      `scripts.test:governance drift. Missing: [${missing.join(', ')}]. Unexpected: [${unexpected.join(', ')}].`,
    )
  })

  it('keeps package.json test:governance file list unique and sorted', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const scriptValue = packageJson?.scripts?.['test:governance']
    ensure(typeof scriptValue === 'string' && scriptValue.length > 0, 'package.json: missing scripts.test:governance.')

    const files = parseGovernanceScriptFiles(scriptValue)
    ensure(files.length > 0, 'package.json: scripts.test:governance contains no explicit test files.')

    const duplicates = findDuplicates(files)
    ensure(
      duplicates.length === 0,
      `scripts.test:governance contains duplicate test files: [${duplicates.join(', ')}].`,
    )

    const sortedFiles = [...files].sort()
    ensure(
      JSON.stringify(files) === JSON.stringify(sortedFiles),
      `scripts.test:governance test files must be sorted. Current: [${files.join(', ')}]. Expected: [${sortedFiles.join(', ')}].`,
    )
  })
})
