const {
  parseChangedFiles,
  getMatchedFiles,
  buildDecisionSummary,
  appendStepSummary,
} = require('./selective-check-utils')

const CONTRACT_FILES = [
  'scripts/validator-error-codes.js',
  'scripts/validator-output.js',
  'scripts/summary-utils.js',
  'scripts/validation-rules.js',
  'scripts/validate-validator-guard-comment.js',
  'scripts/validate-validator-error-codes-doc-table.js',
  'scripts/update-validator-error-codes-doc-table.js',
  'scripts/validator-guard-comment-template.js',
]
const SUMMARY_SCRIPT_PATTERN = /^scripts\/summarize-.*\.js$/
const CONTRACT_PATTERNS = [
  ...CONTRACT_FILES.map((filePath) => new RegExp(`^${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)),
  SUMMARY_SCRIPT_PATTERN,
]

const REQUIRED_TESTS_BY_CONTRACT_FILE = {
  'scripts/validator-error-codes.js': [
    '__tests__/scripts/validator-error-codes.test.ts',
  ],
  'scripts/validator-output.js': [
    '__tests__/scripts/validator-output.test.ts',
  ],
  'scripts/summary-utils.js': [
    '__tests__/scripts/summary-utils.test.ts',
    '__tests__/scripts/run-validator-contract-tests-if-needed.test.ts',
  ],
  'scripts/validation-rules.js': [
    '__tests__/scripts/validation-rules.test.ts',
  ],
  'scripts/validate-validator-guard-comment.js': [
    '__tests__/scripts/validate-validator-guard-comment.test.ts',
  ],
  'scripts/validate-validator-error-codes-doc-table.js': [
    '__tests__/scripts/validate-validator-error-codes-doc-table.test.ts',
  ],
  'scripts/update-validator-error-codes-doc-table.js': [
    '__tests__/scripts/update-validator-error-codes-doc-table.test.ts',
  ],
  'scripts/validator-guard-comment-template.js': [
    '__tests__/scripts/validator-guard-comment-template.test.ts',
  ],
}

const REQUIRED_TESTS_ALWAYS_FOR_VALIDATOR_CORE = [
  '__tests__/scripts/validator-json-contract.test.ts',
]

const REQUIRED_DOCS = ['docs/TESTING.md']
const OVERRIDE_PATTERN = /validator-guard:\s*skip\s*-\s*(.+)/i
const OUTPUT_CONTRACT_VERSION = 1

const toSet = (files) => new Set((files || []).map((f) => String(f).trim()).filter(Boolean))
const summaryTestPathForScript = (scriptPath) => {
  const name = String(scriptPath || '').replace(/^scripts\//, '').replace(/\.js$/, '')
  return `__tests__/scripts/${name}.test.ts`
}

const parseOverrideReason = (prBody) => {
  const match = String(prBody || '').match(OVERRIDE_PATTERN)
  return match?.[1]?.trim() || ''
}

const parseArgs = (argv) => {
  return {
    output: argv.includes('--json') ? 'json' : 'text',
  }
}

const buildJsonResult = (result) => {
  const missing = Array.isArray(result?.missing) ? result.missing : []
  const hints = Array.isArray(result?.hints) ? result.hints : []
  const touchedFiles = Array.isArray(result?.touchedFiles) ? result.touchedFiles : []
  return {
    contractVersion: OUTPUT_CONTRACT_VERSION,
    ok: Boolean(result?.ok),
    reason: String(result?.reason || ''),
    touchedFiles,
    touchedCount: touchedFiles.length,
    missing,
    missingCount: missing.length,
    hints,
    hintCount: hints.length,
  }
}

const evaluateGuard = ({ changedFiles, prBody }) => {
  const changed = toSet(changedFiles)
  const contractTouched = CONTRACT_FILES.filter((f) => changed.has(f))
  const summaryScriptsTouched = (changedFiles || []).filter((f) => SUMMARY_SCRIPT_PATTERN.test(String(f || '')))
  const guardedTouched = [...contractTouched, ...summaryScriptsTouched]
  const overrideReason = parseOverrideReason(prBody)

  if (guardedTouched.length === 0) {
    return { ok: true, reason: 'Validator contract files are unchanged.', touchedFiles: [] }
  }

  if (overrideReason) {
    return {
      ok: true,
      reason: `Validator guard override is present: ${overrideReason}`,
      touchedFiles: guardedTouched,
    }
  }

  const missing = []
  const summaryTestHints = []

  for (const contractFile of contractTouched) {
    const requiredTests = REQUIRED_TESTS_BY_CONTRACT_FILE[contractFile] || []
    for (const requiredTest of requiredTests) {
      if (!changed.has(requiredTest)) {
        missing.push(requiredTest)
      }
    }
  }

  const validatorCoreTouched = contractTouched.some((filePath) => (
    filePath === 'scripts/validator-error-codes.js'
    || filePath === 'scripts/validator-output.js'
  ))
  if (validatorCoreTouched) {
    for (const requiredTest of REQUIRED_TESTS_ALWAYS_FOR_VALIDATOR_CORE) {
      if (!changed.has(requiredTest)) {
        missing.push(requiredTest)
      }
    }
  }

  for (const summaryScript of summaryScriptsTouched) {
    const requiredTest = summaryTestPathForScript(summaryScript)
    if (!changed.has(requiredTest)) {
      missing.push(requiredTest)
      summaryTestHints.push(`Expected summary companion test for ${summaryScript}: ${requiredTest}`)
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
      reason: `Validator/summary guard files changed (${guardedTouched.join(', ')}), but required companions are missing.`,
      missing: uniqueMissing,
      hints: summaryTestHints,
      touchedFiles: guardedTouched,
    }
  }

  return {
    ok: true,
    reason: 'Guarded changes include required tests and docs.',
    touchedFiles: guardedTouched,
  }
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
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
      ...(Array.isArray(result.hints) && result.hints.length > 0
        ? result.hints
        : []),
    ],
  }))
  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
  }

  if (result.ok) {
    if (args.output !== 'json') {
      console.log(`validator-contract-guard: passed. ${result.reason}`)
    }
    return
  }

  if (args.output !== 'json') {
    console.error('validator-contract-guard: failed.')
    console.error(`- ${result.reason}`)
    if (Array.isArray(result.missing) && result.missing.length > 0) {
      console.error('- Missing required files:')
      result.missing.forEach((m) => console.error(`  - ${m}`))
    }
    if (Array.isArray(result.hints) && result.hints.length > 0) {
      console.error('- Hints:')
      result.hints.forEach((hint) => console.error(`  - ${hint}`))
    }
    console.error('- To bypass intentionally, add to PR description:')
    console.error('  validator-guard: skip - <reason>')
  }
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  evaluateGuard,
  parseOverrideReason,
  parseArgs,
  buildJsonResult,
  OUTPUT_CONTRACT_VERSION,
}
