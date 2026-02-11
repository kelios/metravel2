const {
  parseChangedFiles,
  getMatchedFiles,
  buildDecisionSummary,
  appendStepSummary,
} = require('./selective-check-utils')

const SCHEMA_FILES = [
  'scripts/summarize-quality-gate.js',
  'scripts/validate-quality-summary.js',
  'scripts/selective-decision-contract.js',
  'scripts/validate-selective-decision.js',
]
const SCHEMA_PATTERNS = SCHEMA_FILES.map((filePath) => new RegExp(`^${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))

const REQUIRED_TESTS_BY_SCHEMA_FILE = {
  'scripts/summarize-quality-gate.js': '__tests__/scripts/summarize-quality-gate.test.ts',
  'scripts/validate-quality-summary.js': '__tests__/scripts/validate-quality-summary.test.ts',
  'scripts/selective-decision-contract.js': '__tests__/scripts/selective-decision-contract.test.ts',
  'scripts/validate-selective-decision.js': '__tests__/scripts/validate-selective-decision.test.ts',
}

const REQUIRED_DOCS = ['docs/TESTING.md']
const OVERRIDE_PATTERN = /schema-guard:\s*skip\s*-\s*(.+)/i

const toSet = (files) => new Set((files || []).map((f) => String(f).trim()).filter(Boolean))

const parseOverrideReason = (prBody) => {
  const match = String(prBody || '').match(OVERRIDE_PATTERN)
  return match?.[1]?.trim() || ''
}

const evaluateGuard = ({ changedFiles, prBody }) => {
  const changed = toSet(changedFiles)
  const schemaTouched = SCHEMA_FILES.filter((f) => changed.has(f))
  const overrideReason = parseOverrideReason(prBody)

  if (schemaTouched.length === 0) {
    return { ok: true, reason: 'Schema files are unchanged.', touchedFiles: [] }
  }

  if (overrideReason) {
    return {
      ok: true,
      reason: `Schema guard override is present: ${overrideReason}`,
      touchedFiles: schemaTouched,
    }
  }

  const missing = []
  for (const schemaFile of schemaTouched) {
    const requiredTest = REQUIRED_TESTS_BY_SCHEMA_FILE[schemaFile]
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
      reason: `Schema-related files changed (${schemaTouched.join(', ')}), but required companions are missing.`,
      missing: uniqueMissing,
      touchedFiles: schemaTouched,
    }
  }

  return {
    ok: true,
    reason: 'Schema-related changes include required tests and docs.',
    touchedFiles: schemaTouched,
  }
}

const main = () => {
  const changedFiles = parseChangedFiles(process.env.CHANGED_FILES || '')
  const prBody = String(process.env.PR_BODY || '')

  const result = evaluateGuard({ changedFiles, prBody })
  const matchedFiles = getMatchedFiles(changedFiles, SCHEMA_PATTERNS)
  appendStepSummary(buildDecisionSummary({
    title: 'Quality Schema Guard',
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
    console.log(`quality-schema-guard: passed. ${result.reason}`)
    return
  }

  console.error('quality-schema-guard: failed.')
  console.error(`- ${result.reason}`)
  if (Array.isArray(result.missing) && result.missing.length > 0) {
    console.error('- Missing required files:')
    result.missing.forEach((m) => console.error(`  - ${m}`))
  }
  console.error('- To bypass intentionally, add to PR description:')
  console.error('  schema-guard: skip - <reason>')
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  evaluateGuard,
  parseOverrideReason,
}
