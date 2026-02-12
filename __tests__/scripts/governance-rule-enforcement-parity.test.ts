const fs = require('fs')
const path = require('path')
const { ensure, readScriptsTestFile, findDuplicates } = require('./policy-test-utils')

const packageJsonPath = path.resolve(process.cwd(), 'package.json')
const parseGovernanceScriptFiles = (scriptValue) => {
  return String(scriptValue || '')
    .split(/\s+/)
    .filter((token) => token.startsWith('__tests__/scripts/') && token.endsWith('.test.ts'))
}

// Governance update rule:
// 1) Keep required phrases aligned with actively enforced invariants.
// 2) Update this map together with rule comment changes in target files.
// 3) Keep phrase wording style consistent (capitalize action verbs like "Keep"/"Do not").
const requiredRulePhrases = [
  {
    file: 'governance-docs-parity.test.ts',
    phrases: [
      'Do not include this file itself while exact-once marker checks are active',
      'Keep expectedDocsMarkers sorted by `file`',
      'Keep one entry per file',
      'Use governance-rule-enforcement-parity.test.ts for self-coverage of rule phrases',
    ],
  },
  {
    file: 'governance-rule-enforcement-parity.test.ts',
    phrases: [
      'Keep phrase wording style consistent (capitalize action verbs like "Keep"/"Do not")',
      'Keep required phrases aligned with actively enforced invariants',
      'Update this map together with rule comment changes in target files',
    ],
  },
  {
    file: 'governance-script-parity.test.ts',
    phrases: [
      'Keep governanceScopePattern aligned',
      'Keep package.json scripts.test:governance explicitly listing the same scope',
      'Keep scripts.test:governance file list unique and sorted',
    ],
  },
  {
    file: 'policy-helpers-contract-matrix.test.ts',
    phrases: [
      'Keep one entry per `contractTestFile`',
      'Keep one entry per helper',
      'Keep this list sorted by `helperFile`',
    ],
  },
  {
    file: 'targeted-test-list-policy.test.ts',
    phrases: [
      'Scope check is subset-based: only unexpected helper consumers are failures',
    ],
  },
]

describe('governance rule enforcement parity', () => {
  it('keeps rule phrase config unique and sorted by file', () => {
    const files = requiredRulePhrases.map((entry) => entry.file)
    const duplicates = findDuplicates(files)
    ensure(
      duplicates.length === 0,
      `requiredRulePhrases contains duplicate file entries: [${duplicates.join(', ')}].`,
    )
    const sorted = [...files].sort()
    ensure(
      JSON.stringify(files) === JSON.stringify(sorted),
      `requiredRulePhrases must be sorted by file. Current: [${files.join(', ')}]. Expected: [${sorted.join(', ')}].`,
    )
  })

  it('keeps per-file governance phrase lists non-empty and duplicate-free', () => {
    for (const entry of requiredRulePhrases) {
      ensure(
        entry.phrases.length > 0,
        `${entry.file}: governance phrase list must be non-empty.`,
      )
      for (const phrase of entry.phrases) {
        ensure(
          phrase === phrase.trim(),
          `${entry.file}: governance phrase must not have leading/trailing whitespace.`,
        )
        ensure(
          phrase.trim().length > 0,
          `${entry.file}: governance phrase must be non-empty after trim.`,
        )
        ensure(
          /^[A-Z]/.test(phrase),
          `${entry.file}: governance phrase must start with an uppercase letter: "${phrase}".`,
        )
      }
      const duplicates = findDuplicates(entry.phrases)
      ensure(
        duplicates.length === 0,
        `${entry.file}: duplicate governance phrases: [${duplicates.join(', ')}].`,
      )
      const sorted = [...entry.phrases].sort()
      ensure(
        JSON.stringify(entry.phrases) === JSON.stringify(sorted),
        `${entry.file}: governance phrases must be sorted. Current: [${entry.phrases.join(' | ')}]. Expected: [${sorted.join(' | ')}].`,
      )
    }
  })

  it('keeps key governance rule comments aligned with enforced invariants', () => {
    for (const entry of requiredRulePhrases) {
      const content = readScriptsTestFile(entry.file)
      for (const phrase of entry.phrases) {
        ensure(
          content.includes(phrase),
          `${entry.file}: missing governance rule phrase "${phrase}".`,
        )
      }
    }
  })

  it('keeps required rule phrase files covered by test:governance script', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const scriptValue = packageJson?.scripts?.['test:governance']
    ensure(typeof scriptValue === 'string' && scriptValue.length > 0, 'package.json: missing scripts.test:governance.')

    const configured = parseGovernanceScriptFiles(scriptValue)
    const required = requiredRulePhrases.map((entry) => `__tests__/scripts/${entry.file}`)
    const missing = required.filter((file) => !configured.includes(file))
    ensure(
      missing.length === 0,
      `requiredRulePhrases files missing from scripts.test:governance: [${missing.join(', ')}].`,
    )
  })
})
