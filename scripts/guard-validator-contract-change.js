const {
  parseChangedFiles,
  getMatchedFiles,
  buildDecisionSummary,
  appendStepSummary,
} = require('./selective-check-utils')

const CONTRACT_FILES = [
  'scripts/validator-error-codes.js',
  'scripts/validator-output.js',
]
const CONTRACT_PATTERNS = CONTRACT_FILES.map((filePath) => new RegExp(`^${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))

const REQUIRED_TESTS_BY_CONTRACT_FILE = {
  'scripts/validator-error-codes.js': '__tests__/scripts/validator-error-codes.test.ts',
  'scripts/validator-output.js': '__tests__/scripts/validator-output.test.ts',
}

const REQUIRED_TESTS_ALWAYS = [
  '__tests__/scripts/validator-json-contract.test.ts',
]

const REQUIRED_DOCS = ['docs/TESTING.md']
const OVERRIDE_PATTERN = /validator-guard:\s*skip\s*-\s*(.+)/i

const toSet = (files) => new Set((files || []).map((f) => String(f).trim()).filter(Boolean))

const parseOverrideReason = (prBody) => {
  const match = String(prBody || '').match(OVERRIDE_PATTERN)
  return match?.[1]?.trim() || ''
}

const evaluateGuard = ({ changedFiles, prBody }) => {
  const changed = toSet(changedFiles)
  const contractTouched = CONTRACT_FILES.filter((f) => changed.has(f))
  const overrideReason = parseOverrideReason(prBody)

  if (contractTouched.length === 0) {
    return { ok: true, reason: 'Validator contract files are unchanged.', touchedFiles: [] }
  }

  if (overrideReason) {
    return {
      ok: true,
      reason: `Validator guard override is present: ${overrideReason}`,
      touchedFiles: contractTouched,
    }
  }

  const missing = []

  for (const contractFile of contractTouched) {
    const requiredTest = REQUIRED_TESTS_BY_CONTRACT_FILE[contractFile]
    if (requiredTest && !changed.has(requiredTest)) {
      missing.push(requiredTest)
    }
  }

  for (const requiredTest of REQUIRED_TESTS_ALWAYS) {
    if (!changed.has(requiredTest)) {
      missing.push(requiredTest)
    }
  }

  const docsTouched = REQUIRED_DOCS.some((docPath) => changed.has(docPath))
  if (!docsTouched) {
    missing.push(...REQUIRED_DOCS)
  }

  if (missing.length > 0) {
    const uniqueMissing = [...new Set(missing)]
    return {
      ok: false,
      reason: `Validator contract files changed (${contractTouched.join(', ')}), but required companions are missing.`,
      missing: uniqueMissing,
      touchedFiles: contractTouched,
    }
  }

  return {
    ok: true,
    reason: 'Validator contract changes include required tests and docs.',
    touchedFiles: contractTouched,
  }
}

const main = () => {
  const changedFiles = parseChangedFiles(process.env.CHANGED_FILES || '')
  const prBody = String(process.env.PR_BODY || '')

  const result = evaluateGuard({ changedFiles, prBody })
  const matchedFiles = getMatchedFiles(changedFiles, CONTRACT_PATTERNS)
  appendStepSummary(buildDecisionSummary({
    title: 'Validator Contract Guard',
    decision: result.ok ? 'pass' : 'fail',
    changedFiles,
    matchedFiles,
    notes: [
      result.reason,
      ...(Array.isArray(result.missing) && result.missing.length > 0
        ? [`Missing required files: ${result.missing.join(', ')}`]
        : []),
    ],
  }))

  if (result.ok) {
    console.log(`validator-contract-guard: passed. ${result.reason}`)
    return
  }

  console.error('validator-contract-guard: failed.')
  console.error(`- ${result.reason}`)
  if (Array.isArray(result.missing) && result.missing.length > 0) {
    console.error('- Missing required files:')
    result.missing.forEach((m) => console.error(`  - ${m}`))
  }
  console.error('- To bypass intentionally, add to PR description:')
  console.error('  validator-guard: skip - <reason>')
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  evaluateGuard,
  parseOverrideReason,
}
